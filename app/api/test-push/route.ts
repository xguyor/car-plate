import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import webpush from 'web-push'

// Configure VAPID for Web Push
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
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('Test push - user found:', user.email)
    console.log('Test push - push_subscription:', user.push_subscription ? 'exists' : 'missing')
    console.log('Test push - webPushConfigured:', webPushConfigured)

    if (!user.push_subscription) {
      return NextResponse.json({
        error: 'No push subscription found for this user',
        debug: {
          email: user.email,
          hasPushSubscription: false,
          webPushConfigured
        }
      }, { status: 400 })
    }

    if (!webPushConfigured) {
      return NextResponse.json({
        error: 'Web push not configured on server',
        debug: {
          webPushConfigured,
          hasVapidPublic: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY
        }
      }, { status: 500 })
    }

    // Send test push notification
    try {
      await webpush.sendNotification(
        user.push_subscription,
        JSON.stringify({
          title: 'Test Notification',
          body: 'Push notifications are working!',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url: '/camera' }
        })
      )

      return NextResponse.json({
        success: true,
        message: 'Test notification sent!',
        debug: {
          email: user.email,
          subscriptionEndpoint: user.push_subscription.endpoint?.substring(0, 50)
        }
      })
    } catch (pushError) {
      console.error('Push error:', pushError)
      return NextResponse.json({
        error: 'Failed to send push notification',
        debug: {
          pushError: String(pushError),
          subscriptionEndpoint: user.push_subscription.endpoint?.substring(0, 50)
        }
      }, { status: 500 })
    }

  } catch (error: unknown) {
    console.error('Test push error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to test push'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
