import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import webpush from 'web-push'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Hardcoded VAPID keys
const VAPID_PUBLIC_KEY = 'BEXb7h-x0dmbvwN2TAwg9jWAONGrRZ0Z9qWp4bkRu625o_J43QTYXkhnNHLnt_-iL4ms-5iNf-MVC77OMPwgAUI'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() || ''

let webPushConfigured = false
try {
  if (VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:alerts@carblock.app',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )
    webPushConfigured = true
  }
} catch (e) {
  console.warn('Web push not configured:', e)
}

export async function POST(request: Request) {
  try {
    const { alertId, status, userId } = await request.json()

    if (!alertId || !status || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['leaving_soon', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Get the alert with sender and receiver info
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select(`
        *,
        sender:sender_id(id, name, phone, email, push_subscription),
        receiver:receiver_id(id, name, phone, email, push_subscription)
      `)
      .eq('id', alertId)
      .single()

    if (alertError || !alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    // Verify the user has permission to update this alert
    const sender = alert.sender as { id: string; name?: string; phone?: string; email?: string; push_subscription?: object } | null
    const receiver = alert.receiver as { id: string; name?: string; phone?: string; email?: string; push_subscription?: object } | null

    if (status === 'leaving_soon') {
      // Only the blocked person (receiver) can send "leaving soon"
      if (receiver?.id !== userId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
    } else if (status === 'resolved') {
      // Both the blocker (sender) and the blocked person (receiver) can mark as "resolved"
      if (sender?.id !== userId && receiver?.id !== userId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
    }

    // Track who resolved it for notification logic
    const resolvedBySender = sender?.id === userId
    const resolvedByReceiver = receiver?.id === userId

    // Update the alert status
    const { error: updateError } = await supabase
      .from('alerts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', alertId)

    if (updateError) {
      console.error('Failed to update alert:', updateError)
      return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
    }

    // Send notification to the other party
    if (status === 'leaving_soon' && sender) {
      // Notify the blocker that the blocked person wants to leave
      const blockedPersonName = receiver?.name || 'The car owner'
      const blockedPersonPhone = receiver?.phone || ''

      // Send push notification
      if (sender.push_subscription && webPushConfigured) {
        try {
          await webpush.sendNotification(
            sender.push_subscription as webpush.PushSubscription,
            JSON.stringify({
              title: 'Time to move your car!',
              body: `${blockedPersonName} needs to leave. Please move your car.`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              data: { url: '/history' }
            })
          )
        } catch (pushError) {
          console.error('Push notification failed:', pushError)
        }
      }

      // Send email
      if (resend && sender.email) {
        try {
          await resend.emails.send({
            from: 'CarBlock Alert <onboarding@resend.dev>',
            to: sender.email,
            subject: 'Time to move your car!',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #581c87, #86198f); padding: 30px; border-radius: 16px;">
                <h1 style="color: white; margin: 0 0 20px 0; font-size: 24px;">Time to Move Your Car!</h1>

                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                  <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">Car you're blocking</p>
                  <p style="color: white; margin: 0; font-size: 28px; font-family: monospace; font-weight: bold;">${alert.detected_plate}</p>
                </div>

                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                  <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">Owner</p>
                  <p style="color: white; margin: 0; font-size: 18px; font-weight: bold;">${blockedPersonName}</p>
                  ${blockedPersonPhone ? `<a href="tel:${blockedPersonPhone}" style="color: #a855f7; text-decoration: none; font-size: 16px;">Call: ${blockedPersonPhone}</a>` : ''}
                </div>

                <p style="color: #fbbf24; font-size: 16px; margin-top: 20px; font-weight: bold;">
                  Please move your car as soon as possible!
                </p>

                <p style="color: #9333ea; font-size: 12px; margin-top: 30px;">
                  Sent via CarBlock by Forsight Robotics
                </p>
              </div>
            `
          })
        } catch (emailError) {
          console.error('Email failed:', emailError)
        }
      }
    } else if (status === 'resolved' && resolvedBySender && receiver) {
      // Notify the blocked person that the blocker has left (only if resolved by sender)
      const blockerName = sender?.name || 'The person blocking you'

      // Send push notification
      if (receiver.push_subscription && webPushConfigured) {
        try {
          await webpush.sendNotification(
            receiver.push_subscription as webpush.PushSubscription,
            JSON.stringify({
              title: 'Your car is no longer blocked!',
              body: `${blockerName} has moved their car. You can leave now.`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              data: { url: '/history' }
            })
          )
        } catch (pushError) {
          console.error('Push notification failed:', pushError)
        }
      }

      // Send email
      if (resend && receiver.email) {
        try {
          await resend.emails.send({
            from: 'CarBlock Alert <onboarding@resend.dev>',
            to: receiver.email,
            subject: 'Your car is no longer blocked!',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #581c87, #86198f); padding: 30px; border-radius: 16px;">
                <h1 style="color: white; margin: 0 0 20px 0; font-size: 24px;">You Can Leave Now!</h1>

                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                  <p style="color: #e9d5ff; margin: 0 0 10px 0; font-size: 14px;">Your Car</p>
                  <p style="color: white; margin: 0; font-size: 28px; font-family: monospace; font-weight: bold;">${alert.detected_plate}</p>
                </div>

                <p style="color: #22c55e; font-size: 18px; font-weight: bold;">
                  ${blockerName} has moved their car. Your car is no longer blocked!
                </p>

                <p style="color: #9333ea; font-size: 12px; margin-top: 30px;">
                  Sent via CarBlock by Forsight Robotics
                </p>
              </div>
            `
          })
        } catch (emailError) {
          console.error('Email failed:', emailError)
        }
      }
    }

    return NextResponse.json({ success: true, status })

  } catch (error: unknown) {
    console.error('Alert status error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update alert status'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
