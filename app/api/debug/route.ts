import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Get all alerts (recent 10)
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select('id, sender_id, receiver_id, detected_plate, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get all users (for reference)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, phone, car_plate, push_subscription')
      .limit(20)

    return NextResponse.json({
      recentAlerts: alerts,
      alertsError: alertsError?.message,
      users: users?.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        car_plate: u.car_plate,
        has_push: !!u.push_subscription
      })),
      usersError: usersError?.message
    })

  } catch (error: unknown) {
    console.error('Debug error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Debug failed'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
