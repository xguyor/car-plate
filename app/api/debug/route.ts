import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Get all alerts (recent 10)
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

    // Check table info
    const { data: tableInfo } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    return NextResponse.json({
      tables: tableInfo?.map(t => t.table_name) || [],
      alertsError: alertsError?.message || null,
      alertsCount: alerts?.length || 0,
      recentAlerts: alerts || [],
      usersError: usersError?.message || null,
      usersCount: users?.length || 0,
      users: users?.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        car_plate: u.car_plate,
        has_push: !!u.push_subscription,
        push_endpoint: u.push_subscription?.endpoint?.substring(0, 50) || null
      })) || []
    })

  } catch (error: unknown) {
    console.error('Debug error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Debug failed'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
