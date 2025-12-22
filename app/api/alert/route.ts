import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import webpush from 'web-push'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Hardcoded VAPID keys (public key is safe to expose, private should be in env but hardcoding for reliability)
const VAPID_PUBLIC_KEY = 'BEXb7h-x0dmbvwN2TAwg9jWAONGrRZ0Z9qWp4bkRu625o_J43QTYXkhnNHLnt_-iL4ms-5iNf-MVC77OMPwgAUI'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() || ''

// Configure VAPID for Web Push
let webPushConfigured = false
try {
  if (VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:alerts@carblock.app',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )
    webPushConfigured = true
    console.log('Web push configured successfully')
  } else {
    console.warn('VAPID_PRIVATE_KEY not set')
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
          subject: 'URGENT: You are blocking someone! Please move your car',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #581c87, #86198f); padding: 30px; border-radius: 16px;">
              <h1 style="color: white; margin: 0 0 20px 0; font-size: 24px;">You Are Blocking Someone!</h1>

              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">Your Car</p>
                <p style="color: white; margin: 0; font-size: 28px; font-family: monospace; font-weight: bold;">${plate}</p>
              </div>

              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">Blocked Person</p>
                <p style="color: white; margin: 0; font-size: 18px; font-weight: bold;">${senderName}</p>
                ${senderPhone ? `<a href="tel:${senderPhone}" style="color: #a855f7; text-decoration: none; font-size: 16px;">Call: ${senderPhone}</a>` : ''}
              </div>

              <p style="color: #fbbf24; font-size: 16px; margin-top: 20px; font-weight: bold;">
                Please move your car as soon as possible so they can leave!
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
    console.log('Push check - webPushConfigured:', webPushConfigured)
    console.log('Push check - owner.push_subscription exists:', !!owner.push_subscription)

    if (owner.push_subscription && webPushConfigured) {
      try {
        console.log('Sending push to subscription:', JSON.stringify(owner.push_subscription).substring(0, 100))
        await webpush.sendNotification(
          owner.push_subscription,
          JSON.stringify({
            title: 'You are blocking someone!',
            body: `${senderName} needs you to move your car (${plate}). Please move it ASAP!`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: { url: '/camera' }
          })
        )
        console.log('Push notification sent successfully')
      } catch (pushError) {
        console.error('Push notification failed:', pushError)
      }
    } else {
      console.log('Push notification skipped - no subscription or not configured')
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
