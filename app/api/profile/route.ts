import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { name, email, phone, carPlate, pushSubscription, existingUserId } = await request.json()

    console.log('Profile save - email:', email)
    console.log('Profile save - existingUserId:', existingUserId)
    console.log('Profile save - pushSubscription received:', !!pushSubscription)

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Check if user exists by email
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    // Check if car plate is already registered to someone else
    if (carPlate) {
      const { data: existingPlateUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('car_plate', carPlate)
        .single()

      if (existingPlateUser && existingPlateUser.email !== email) {
        return NextResponse.json({
          error: 'This car plate is already registered to another user'
        }, { status: 409 })
      }
    }

    // Check if phone is already registered to someone else
    if (phone) {
      const { data: existingPhoneUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('phone', phone)
        .single()

      if (existingPhoneUser && existingPhoneUser.email !== email) {
        return NextResponse.json({
          error: 'This phone number is already registered to another user'
        }, { status: 409 })
      }
    }

    let userId = existingUserByEmail?.id

    if (existingUserByEmail) {
      // User exists - check if this is the same user updating their profile
      // Allow update only if they have the userId in localStorage (they own this account)
      if (existingUserId && existingUserId !== existingUserByEmail.id) {
        return NextResponse.json({
          error: 'This email is already registered to another account'
        }, { status: 409 })
      }

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
      // New user - create account
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
