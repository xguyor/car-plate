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
    const { plate, manualCorrection, confidence } = await request.json()

    // Validate plate format (7 digits: XX-XXX-XX or 8 digits: XXX-XX-XXX)
    const isValid = /^\d{2,3}-\d{2,3}-\d{2,3}$/.test(plate) && (plate.replace(/-/g, '').length === 7 || plate.replace(/-/g, '').length === 8)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid plate format' }, { status: 400 })
    }

    // Find car owner by plate in Supabase
    const supabase = await createServerSupabaseClient()
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
        receiver_id: owner.id,
        detected_plate: plate,
        manual_correction: manualCorrection,
        ocr_confidence: confidence
      })

    // Send email notification
    if (resend) {
      try {
        await resend.emails.send({
          from: 'CarBlock Alert <onboarding@resend.dev>',
          to: owner.email,
          subject: 'URGENT: Your car is blocking someone',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Your Car is Blocking</h2>
              <p>Hi,</p>
              <p>Your car with plate number <strong>${plate}</strong> is blocking someone at the parking lot.</p>
              <p>Please move it as soon as possible.</p>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Sent via CarBlock Alert System
              </p>
            </div>
          `
        })
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
            title: 'Move Your Car',
            body: `Your car (${plate}) is blocking someone`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: { url: '/history' }
          })
        )
      } catch (pushError) {
        console.error('Push notification failed:', pushError)
      }
    }

    return NextResponse.json({
      success: true,
      owner: owner.email
    })

  } catch (error: unknown) {
    console.error('Alert error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send alert'
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}
