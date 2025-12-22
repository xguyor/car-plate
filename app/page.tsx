'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.push('/camera')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center">
      <p className="text-white">Loading...</p>
    </div>
  )
}
