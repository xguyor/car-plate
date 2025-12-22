import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import webpush from 'web-push'

const resend = new Resend(process.env.RESEND_API_KEY)

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
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { plate, manualCorrection, confidence } = await request.json()

    // Validate plate format
    const isValid = /^\d{2}-\d{3}-\d{2}$/.test(plate) || /^\d{3}-\d{2}-\d{3}$/.test(plate)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid plate format' }, { status: 400 })
    }

    // Rate limiting: max 3 alerts per minute
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
    const { data: recentAlerts } = await supabase
      .from('alerts')
      .select('id')
      .eq('sender_id', user.id)
      .gte('created_at', oneMinuteAgo)

    if (recentAlerts && recentAlerts.length >= 3) {
      return NextResponse.json({
        error: 'Rate limit: Max 3 alerts per minute'
      }, { status: 429 })
    }

    // Find car owner by plate
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

    // Don't allow alerting yourself
    if (owner.id === user.id) {
      return NextResponse.json({
        error: 'Cannot alert your own car'
      }, { status: 400 })
    }

    // Log the alert
    const { error: insertError } = await supabase
      .from('alerts')
      .insert({
        sender_id: user.id,
        receiver_id: owner.id,
        detected_plate: plate,
        manual_correction: manualCorrection,
        ocr_confidence: confidence
      })

    if (insertError) throw insertError

    // Send email notification
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
