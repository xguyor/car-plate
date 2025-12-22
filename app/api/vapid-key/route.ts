import { NextResponse } from 'next/server'

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidPublicKey) {
      return NextResponse.json({
        error: 'VAPID key not configured'
      }, {
        status: 500,
        headers: { 'Cache-Control': 'no-store' }
      })
    }

    return NextResponse.json(
      { vapidPublicKey },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    return NextResponse.json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    })
  }
}
