import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { name, email, phone, carPlate, pushSubscription, existingUserId } = await request.json()

    console.log('Profile save - phone:', phone)
    console.log('Profile save - email:', email)
    console.log('Profile save - existingUserId:', existingUserId)
    console.log('Profile save - pushSubscription received:', !!pushSubscription)

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // First, check if user exists by existingUserId (they're editing their profile)
    let existingUser = null
    if (existingUserId) {
      const { data: userById } = await supabase
        .from('users')
        .select('id, phone, email, car_plate')
        .eq('id', existingUserId)
        .single()
      existingUser = userById
    }

    // If no existingUserId, check by phone (new registration or re-login)
    if (!existingUser) {
      const { data: userByPhone } = await supabase
        .from('users')
        .select('id, phone, email, car_plate')
        .eq('phone', phone)
        .single()
      existingUser = userByPhone
    }

    // Check if email is already registered to someone else
    const { data: emailUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (emailUser && (!existingUser || emailUser.id !== existingUser.id)) {
      return NextResponse.json({
        error: 'This email is already registered to another user'
      }, { status: 409 })
    }

    // Check if phone is already registered to someone else
    const { data: phoneUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single()

    if (phoneUser && (!existingUser || phoneUser.id !== existingUser.id)) {
      return NextResponse.json({
        error: 'This phone number is already registered to another user'
      }, { status: 409 })
    }

    // Check if car plate is already registered to someone else
    if (carPlate) {
      const { data: plateUser } = await supabase
        .from('users')
        .select('id')
        .eq('car_plate', carPlate)
        .single()

      if (plateUser && (!existingUser || plateUser.id !== existingUser.id)) {
        return NextResponse.json({
          error: 'This car plate is already registered to another user'
        }, { status: 409 })
      }
    }

    let userId = existingUser?.id

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: name || null,
          email: email,
          phone: phone,
          car_plate: carPlate || null,
          push_subscription: pushSubscription || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)

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
          phone: phone,
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
