import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()

    // Delete all alerts with null sender_id (bad data from before fix)
    const { data: deleted, error: deleteError } = await supabase
      .from('alerts')
      .delete()
      .is('sender_id', null)
      .select()

    if (deleteError) {
      console.error('Cleanup error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deletedCount: deleted?.length || 0,
      message: `Deleted ${deleted?.length || 0} alerts with null sender_id`
    })

  } catch (error: unknown) {
    console.error('Cleanup error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Cleanup failed'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
