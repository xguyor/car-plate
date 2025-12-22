'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Alert {
  id: string
  detected_plate: string
  created_at: string
  sender_name?: string
  sender_phone?: string
  type: 'sent' | 'received'
}

export default function HistoryPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')

  useEffect(() => {
    loadAlerts()
  }, [])

  async function loadAlerts() {
    try {
      const userId = localStorage.getItem('userId')
      const userEmail = localStorage.getItem('userEmail')

      if (!userId || !userEmail) {
        setLoading(false)
        return
      }

      const response = await fetch(`/api/history?userId=${userId}&email=${userEmail}`)
      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setAlerts(data.alerts || [])
      }
    } catch (err) {
      console.error('Error loading alerts:', err)
      setError('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const filteredAlerts = alerts.filter(a => a.type === activeTab)

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-purple-950">
      {/* Header */}
      <div className="bg-purple-800/50 backdrop-blur-sm text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4 max-w-md mx-auto">
          <Link href="/camera" className="text-purple-200 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">Alert History</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex bg-purple-800/30 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('received')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'received'
                ? 'bg-purple-500 text-white shadow-lg'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            Received
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sent'
                ? 'bg-purple-500 text-white shadow-lg'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            Sent
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-md mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 p-4 rounded-xl text-center">
            {error}
          </div>
        ) : !localStorage.getItem('userId') ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center border border-purple-500/30">
            <svg className="w-16 h-16 mx-auto mb-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-purple-200 mb-4">Register to see your alert history</p>
            <Link
              href="/profile"
              className="inline-block bg-purple-500 text-white px-6 py-2 rounded-xl font-medium"
            >
              Go to Profile
            </Link>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center border border-purple-500/30">
            <svg className="w-16 h-16 mx-auto mb-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-purple-200">
              {activeTab === 'received'
                ? 'No alerts received yet'
                : 'No alerts sent yet'}
            </p>
            <p className="text-sm text-purple-400 mt-2">
              {activeTab === 'received'
                ? 'When someone reports your car blocking, it will appear here'
                : 'Alerts you send to other car owners will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      activeTab === 'received' ? 'bg-red-400' : 'bg-green-400'
                    }`}></div>
                    <span className="text-white font-mono text-lg">{alert.detected_plate}</span>
                  </div>
                  <span className="text-xs text-purple-400">{formatDate(alert.created_at)}</span>
                </div>
                {alert.sender_name && activeTab === 'received' && (
                  <div className="mt-2 pt-2 border-t border-purple-500/20">
                    <p className="text-sm text-purple-300">From: {alert.sender_name}</p>
                    {alert.sender_phone && (
                      <a
                        href={`tel:${alert.sender_phone}`}
                        className="text-sm text-purple-400 hover:text-purple-200"
                      >
                        {alert.sender_phone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
