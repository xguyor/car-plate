'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface Alert {
  id: string
  detected_plate: string
  manual_correction: boolean
  ocr_confidence: number | null
  created_at: string
  sender?: { email: string }
  receiver?: { email: string; car_plate: string }
}

export default function HistoryPage() {
  const supabase = createClient()
  const [sent, setSent] = useState<Alert[]>([])
  const [received, setReceived] = useState<Alert[]>([])
  const [tab, setTab] = useState<'sent' | 'received'>('received')

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Alerts I received
    const { data: receivedData } = await supabase
      .from('alerts')
      .select(`
        *,
        sender:users!sender_id(email)
      `)
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setReceived(receivedData || [])

    // Alerts I sent
    const { data: sentData } = await supabase
      .from('alerts')
      .select(`
        *,
        receiver:users!receiver_id(email, car_plate)
      `)
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setSent(sentData || [])
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  const currentList = tab === 'sent' ? sent : received

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4">
        <Link href="/camera" className="text-sm">← Back</Link>
        <h1 className="text-xl font-bold mt-2">Alert History</h1>
      </div>

      <div className="flex border-b bg-white">
        <button
          onClick={() => setTab('received')}
          className={`flex-1 py-3 font-semibold ${
            tab === 'received' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'
          }`}
        >
          Received ({received.length})
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 py-3 font-semibold ${
            tab === 'sent' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'
          }`}
        >
          Sent ({sent.length})
        </button>
      </div>

      <div className="p-4 space-y-3">
        {currentList.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No alerts yet
          </div>
        ) : (
          currentList.map((alert) => (
            <div key={alert.id} className="bg-white rounded-lg p-4 shadow">
              <div className="flex justify-between items-start mb-2">
                <span className="text-2xl font-mono font-bold">
                  {alert.detected_plate}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(alert.created_at)}
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                {tab === 'sent' ? (
                  <p>Sent to: {alert.receiver?.email}</p>
                ) : (
                  <p>From: {alert.sender?.email}</p>
                )}

                {alert.manual_correction && (
                  <p className="text-yellow-600">Manually corrected</p>
                )}

                {alert.ocr_confidence != null && (
                  <p>OCR confidence: {(alert.ocr_confidence * 100).toFixed(0)}%</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
