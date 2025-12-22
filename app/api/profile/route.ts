import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const { email, carPlate } = await request.json()

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

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          car_plate: carPlate || null,
          updated_at: new Date().toISOString()
        })
        .eq('email', email)

      if (updateError) throw updateError
    } else {
      // Insert new user
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: crypto.randomUUID(),
          email: email,
          car_plate: carPlate || null
        })

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })

  } catch (error: unknown) {
    console.error('Profile save error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to save profile'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
