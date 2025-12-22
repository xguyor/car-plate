import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Normalize phone number (remove dashes and spaces)
    const normalizedPhone = phone.replace(/[-\s]/g, '')

    const supabase = await createServerSupabaseClient()

    // Try to find user by phone
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (error || !user) {
      // Also try with normalized phone
      const { data: userNormalized } = await supabase
        .from('users')
        .select('*')
        .eq('phone', normalizedPhone)
        .single()

      if (!userNormalized) {
        return NextResponse.json({
          found: false,
          message: 'Phone number not registered'
        })
      }

      return NextResponse.json({
        found: true,
        user: {
          id: userNormalized.id,
          name: userNormalized.name,
          email: userNormalized.email,
          phone: userNormalized.phone,
          carPlate: userNormalized.car_plate
        }
      })
    }

    return NextResponse.json({
      found: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        carPlate: user.car_plate
      }
    })

  } catch (error: unknown) {
    console.error('Login error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Login failed'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
