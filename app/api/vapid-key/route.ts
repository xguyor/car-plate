import { NextResponse } from 'next/server'

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic'

// Hardcoded public VAPID key - this is safe since it's meant to be public
const VAPID_PUBLIC_KEY = 'BEXb7h-x0dmbvwN2TAwg9jWAONGrRZ0Z9qWp4bkRu625o_J43QTYXkhnNHLnt_-iL4ms-5iNf-MVC77OMPwgAUI'

export async function GET() {
  return NextResponse.json(
    { vapidPublicKey: VAPID_PUBLIC_KEY },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
