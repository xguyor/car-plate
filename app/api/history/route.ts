import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const email = searchParams.get('email')

    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Get user's car plate
    const { data: user } = await supabase
      .from('users')
      .select('car_plate')
      .eq('id', userId)
      .single()

    // Get received alerts (where user's car plate was reported)
    const receivedAlerts = []
    if (user?.car_plate) {
      const { data: received } = await supabase
        .from('alerts')
        .select(`
          id,
          detected_plate,
          created_at,
          sender:sender_id(name, phone)
        `)
        .eq('detected_plate', user.car_plate)
        .order('created_at', { ascending: false })
        .limit(50)

      if (received) {
        for (const alert of received) {
          receivedAlerts.push({
            id: alert.id,
            detected_plate: alert.detected_plate,
            created_at: alert.created_at,
            sender_name: (alert.sender as { name?: string } | null)?.name,
            sender_phone: (alert.sender as { phone?: string } | null)?.phone,
            type: 'received' as const
          })
        }
      }
    }

    // Get sent alerts (where user reported someone)
    const { data: sent } = await supabase
      .from('alerts')
      .select(`
        id,
        detected_plate,
        created_at
      `)
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    const sentAlerts = (sent || []).map(alert => ({
      id: alert.id,
      detected_plate: alert.detected_plate,
      created_at: alert.created_at,
      type: 'sent' as const
    }))

    // Combine and return
    const allAlerts = [...receivedAlerts, ...sentAlerts]

    return NextResponse.json({ alerts: allAlerts })

  } catch (error: unknown) {
    console.error('History error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to load history'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
