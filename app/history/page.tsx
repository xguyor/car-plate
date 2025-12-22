'use client'

import Link from 'next/link'

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4">
        <Link href="/camera" className="text-sm">← Back</Link>
        <h1 className="text-xl font-bold mt-2">Alert History</h1>
      </div>

      <div className="p-4">
        <div className="text-center py-12 text-gray-500">
          <p>History feature coming soon.</p>
          <p className="text-sm mt-2">Alerts are sent directly to the car owner&apos;s email.</p>
        </div>
      </div>
    </div>
  )
}
