import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Get all alerts (recent 10) - without status column in case it doesn't exist
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get all users (for reference)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(20)

    return NextResponse.json({
      recentAlerts: alerts,
      alertsError: alertsError?.message,
      alertsCount: alerts?.length || 0,
      users: users?.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        car_plate: u.car_plate,
        has_push: !!u.push_subscription,
        push_endpoint: u.push_subscription?.endpoint?.substring(0, 50) || null
      })),
      usersError: usersError?.message
    })

  } catch (error: unknown) {
    console.error('Debug error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Debug failed'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
