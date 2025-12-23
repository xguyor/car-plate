import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Save or update push subscription for a user
export async function POST(request: Request) {
  try {
    const { visitorId, pushSubscription } = await request.json()

    console.log('Push subscription save - visitorId:', visitorId)
    console.log('Push subscription save - subscription exists:', !!pushSubscription)

    if (!visitorId || !pushSubscription) {
      return NextResponse.json({ error: 'Missing visitorId or subscription' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Store subscription with visitorId - we'll merge it when user registers
    // For now, if user exists with this visitorId, update their subscription
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', visitorId)
      .single()

    if (existingUser) {
      // Update existing user's push subscription
      const { error: updateError } = await supabase
        .from('users')
        .update({
          push_subscription: pushSubscription,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitorId)

      if (updateError) throw updateError
      console.log('Updated push subscription for existing user:', visitorId)
    } else {
      console.log('No user found with visitorId, subscription saved to localStorage only')
    }

    return NextResponse.json({ success: true })

  } catch (error: unknown) {
    console.error('Push subscription save error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to save subscription'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
