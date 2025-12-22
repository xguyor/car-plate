import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { name, email, phone, carPlate, pushSubscription } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Check if user exists by email
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    let userId = existingUser?.id

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: name || null,
          phone: phone || null,
          car_plate: carPlate || null,
          push_subscription: pushSubscription || null,
          updated_at: new Date().toISOString()
        })
        .eq('email', email)

      if (updateError) throw updateError
    } else {
      // Insert new user
      userId = crypto.randomUUID()
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          name: name || null,
          email: email,
          phone: phone || null,
          car_plate: carPlate || null,
          push_subscription: pushSubscription || null
        })

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true, userId })

  } catch (error: unknown) {
    console.error('Profile save error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to save profile'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
