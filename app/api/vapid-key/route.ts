import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    console.log('VAPID API called')
    console.log('VAPID key exists:', !!vapidPublicKey)
    console.log('VAPID key length:', vapidPublicKey?.length || 0)

    if (!vapidPublicKey) {
      console.error('VAPID key not found in environment variables')
      return NextResponse.json({
        error: 'VAPID key not configured',
        debug: {
          hasKey: false,
          envKeys: Object.keys(process.env).filter(k => k.includes('VAPID')).join(', ')
        }
      }, { status: 500 })
    }

    return NextResponse.json({ vapidPublicKey })
  } catch (err) {
    console.error('VAPID API error:', err)
    return NextResponse.json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
