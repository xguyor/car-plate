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
    const body = await request.json()
    console.log('Alert request body:', JSON.stringify(body))

    const { plate, manualCorrection, confidence, senderEmail, senderId } = body
    console.log('Parsed senderId:', senderId, 'type:', typeof senderId)

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

    // Check if there's already an active alert for this plate (prevent duplicate blocking)
    const { data: existingAlert } = await supabase
      .from('alerts')
      .select('id, sender_id')
      .eq('detected_plate', plate)
      .neq('status', 'resolved')
      .single()

    if (existingAlert) {
      // If the same sender is trying to block again, just return success
      if (existingAlert.sender_id === senderId) {
        return NextResponse.json({
          success: true,
          message: 'You are already blocking this car',
          owner: {
            name: owner.name,
            email: owner.email,
            phone: owner.phone
          }
        })
      }
      // Different person trying to block - this car is already being blocked
      return NextResponse.json({
        error: 'This car is already being blocked by someone else'
      }, { status: 409 })
    }

    // Log the alert
    console.log('Creating alert - senderId:', senderId, 'receiverId:', owner.id, 'plate:', plate)
    const { error: alertError } = await supabase
      .from('alerts')
      .insert({
        sender_id: senderId || null,
        receiver_id: owner.id,
        detected_plate: plate,
        manual_correction: manualCorrection,
        ocr_confidence: confidence
      })

    if (alertError) {
      console.error('Failed to create alert:', alertError)
    } else {
      console.log('Alert created successfully')
    }

    // Send email notification
    if (resend && owner.email) {
      try {
        await resend.emails.send({
          from: 'CarBlock Alert <onboarding@resend.dev>',
          to: owner.email,
          subject: 'Someone parked and is blocking your car',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #581c87, #86198f); padding: 30px; border-radius: 16px;">
              <h1 style="color: white; margin: 0 0 20px 0; font-size: 24px;">Your Car is Being Blocked</h1>

              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">Your Car</p>
                <p style="color: white; margin: 0; font-size: 28px; font-family: monospace; font-weight: bold;">${plate}</p>
              </div>

              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">Blocked by</p>
                <p style="color: white; margin: 0; font-size: 18px; font-weight: bold;">${senderName}</p>
                ${senderPhone ? `<a href="tel:${senderPhone}" style="color: #a855f7; text-decoration: none; font-size: 16px;">Call: ${senderPhone}</a>` : ''}
              </div>

              <p style="color: #fbbf24; font-size: 16px; margin-top: 20px; font-weight: bold;">
                When you need to leave, contact them to move their car.
              </p>

              <p style="color: #9333ea; font-size: 12px; margin-top: 30px;">
                Sent via CarBlock by Guy Or, SW Engineer
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
    console.log('Push check - VAPID_PRIVATE_KEY set:', !!VAPID_PRIVATE_KEY)

    if (owner.push_subscription && webPushConfigured) {
      try {
        const subscriptionForPush = owner.push_subscription
        console.log('Push subscription endpoint:', subscriptionForPush.endpoint)
        console.log('Push subscription keys present:', !!subscriptionForPush.keys)

        const pushPayload = JSON.stringify({
          title: 'Someone is blocking your car!',
          body: `${senderName} parked behind you. Contact them when you need to leave.`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url: '/history' }
        })
        console.log('Push payload:', pushPayload)

        const result = await webpush.sendNotification(subscriptionForPush, pushPayload)
        console.log('Push notification result:', result.statusCode, result.body)
      } catch (pushError: unknown) {
        console.error('Push notification failed:', pushError)
        if (pushError instanceof Error) {
          console.error('Push error message:', pushError.message)
          console.error('Push error stack:', pushError.stack)
        }
        // Check if it's a WebPushError with more details
        const webPushError = pushError as { statusCode?: number; body?: string; headers?: Record<string, string> }
        if (webPushError.statusCode) {
          console.error('Push error status:', webPushError.statusCode)
          console.error('Push error body:', webPushError.body)
        }
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
