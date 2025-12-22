import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import webpush from 'web-push'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Configure VAPID for Web Push (only if valid keys are provided)
let webPushConfigured = false
try {
  if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(
      'mailto:alerts@carblock.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
    webPushConfigured = true
  }
} catch (e) {
  console.warn('Web push not configured:', e)
}

export async function POST(request: Request) {
  try {
    const { plate, manualCorrection, confidence, senderEmail, senderId } = await request.json()

    // Validate plate format (7 or 8 digits)
    const digitsOnly = plate.replace(/-/g, '')
    if (digitsOnly.length < 7 || digitsOnly.length > 8) {
      return NextResponse.json({ error: 'Invalid plate format' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Get sender info if available
    let senderName = 'Someone'
    let senderPhone = ''
    if (senderEmail) {
      const { data: sender } = await supabase
        .from('users')
        .select('name, phone')
        .eq('email', senderEmail)
        .single()

      if (sender) {
        senderName = sender.name || senderEmail
        senderPhone = sender.phone || ''
      }
    }

    // Find car owner by plate in Supabase
    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('*')
      .eq('car_plate', plate)
      .single()

    if (ownerError || !owner) {
      return NextResponse.json({
        error: 'Plate not registered in system'
      }, { status: 404 })
    }

    // Log the alert
    await supabase
      .from('alerts')
      .insert({
        sender_id: senderId || null,
        receiver_id: owner.id,
        detected_plate: plate,
        manual_correction: manualCorrection,
        ocr_confidence: confidence
      })

    // Send email notification
    if (resend && owner.email) {
      try {
        await resend.emails.send({
          from: 'CarBlock Alert <onboarding@resend.dev>',
          to: owner.email,
          subject: 'URGENT: Your car is blocking someone!',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #581c87, #86198f); padding: 30px; border-radius: 16px;">
              <h1 style="color: white; margin: 0 0 20px 0; font-size: 24px;">Your Car is Blocking!</h1>

              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">License Plate</p>
                <p style="color: white; margin: 0; font-size: 28px; font-family: monospace; font-weight: bold;">${plate}</p>
              </div>

              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">Reported by</p>
                <p style="color: white; margin: 0; font-size: 18px; font-weight: bold;">${senderName}</p>
                ${senderPhone ? `<a href="tel:${senderPhone}" style="color: #a855f7; text-decoration: none; font-size: 16px;">${senderPhone}</a>` : ''}
              </div>

              <p style="color: #e9d5ff; font-size: 14px; margin-top: 20px;">
                Please move your car as soon as possible.
              </p>

              <p style="color: #9333ea; font-size: 12px; margin-top: 30px;">
                Sent via CarBlock by Forsight Robotics
              </p>
            </div>
          `
        })
        console.log('Email sent to:', owner.email)
      } catch (emailError) {
        console.error('Email failed:', emailError)
      }
    }

    // Send push notification
    if (owner.push_subscription && webPushConfigured) {
      try {
        await webpush.sendNotification(
          owner.push_subscription,
          JSON.stringify({
            title: 'Move Your Car!',
            body: `${senderName} says your car (${plate}) is blocking them`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: { url: '/camera' }
          })
        )
        console.log('Push notification sent')
      } catch (pushError) {
        console.error('Push notification failed:', pushError)
      }
    }

    return NextResponse.json({
      success: true,
      owner: {
        name: owner.name,
        email: owner.email,
        phone: owner.phone
      }
    })

  } catch (error: unknown) {
    console.error('Alert error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send alert'
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}
