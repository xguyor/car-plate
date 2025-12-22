'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Alert {
  id: string
  detected_plate: string
  created_at: string
  status: 'active' | 'leaving_soon' | 'resolved'
  sender_name?: string
  sender_phone?: string
  receiver_name?: string
  receiver_phone?: string
  type: 'sent' | 'received'
}

export default function HistoryPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

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

  async function updateAlertStatus(alertId: string, status: 'leaving_soon' | 'resolved') {
    setUpdatingId(alertId)
    try {
      const userId = localStorage.getItem('userId')
      const response = await fetch('/api/alert-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, status, userId })
      })

      const data = await response.json()
      if (data.error) {
        alert(data.error)
      } else {
        // Update the local state
        setAlerts(alerts.map(a =>
          a.id === alertId ? { ...a, status } : a
        ))
      }
    } catch (err) {
      console.error('Error updating alert:', err)
      alert('Failed to update status')
    } finally {
      setUpdatingId(null)
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

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
            Blocking
          </span>
        )
      case 'leaving_soon':
        return (
          <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">
            Wants to leave
          </span>
        )
      case 'resolved':
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
            Resolved
          </span>
        )
      default:
        return null
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-yellow-400'
      case 'leaving_soon':
        return 'bg-orange-400'
      case 'resolved':
        return 'bg-green-400'
      default:
        return 'bg-gray-400'
    }
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
            Blocked by Others
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sent'
                ? 'bg-purple-500 text-white shadow-lg'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            Cars I Blocked
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
                ? 'No one is blocking you'
                : 'You are not blocking anyone'}
            </p>
            <p className="text-sm text-purple-400 mt-2">
              {activeTab === 'received'
                ? 'When someone parks behind you and scans your plate, it will appear here'
                : 'When you scan someone\'s plate after blocking them, it will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white/10 backdrop-blur-sm rounded-xl p-4 border ${
                  alert.status === 'resolved'
                    ? 'border-green-500/30'
                    : alert.status === 'leaving_soon'
                    ? 'border-orange-500/30'
                    : 'border-purple-500/30'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(alert.status)}`}></div>
                    <span className="text-white font-mono text-lg">{alert.detected_plate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(alert.status)}
                    <span className="text-xs text-purple-400">{formatDate(alert.created_at)}</span>
                  </div>
                </div>

                {/* Contact info for received alerts */}
                {activeTab === 'received' && alert.sender_name && (
                  <div className="mt-2 pt-2 border-t border-purple-500/20">
                    <p className="text-sm text-purple-300">Blocked by: {alert.sender_name}</p>
                    {alert.sender_phone && (
                      <a
                        href={`tel:${alert.sender_phone}`}
                        className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-200 mt-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {alert.sender_phone}
                      </a>
                    )}
                  </div>
                )}

                {/* Contact info for sent alerts */}
                {activeTab === 'sent' && alert.receiver_name && (
                  <div className="mt-2 pt-2 border-t border-purple-500/20">
                    <p className="text-sm text-purple-300">Owner: {alert.receiver_name}</p>
                    {alert.receiver_phone && (
                      <a
                        href={`tel:${alert.receiver_phone}`}
                        className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-200 mt-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {alert.receiver_phone}
                      </a>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {alert.status !== 'resolved' && (
                  <div className="mt-3 pt-3 border-t border-purple-500/20">
                    {activeTab === 'received' && alert.status === 'active' && (
                      <button
                        onClick={() => updateAlertStatus(alert.id, 'leaving_soon')}
                        disabled={updatingId === alert.id}
                        className="w-full bg-orange-500 hover:bg-orange-400 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {updatingId === alert.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            I Need to Leave Soon
                          </>
                        )}
                      </button>
                    )}

                    {activeTab === 'received' && alert.status === 'leaving_soon' && (
                      <div className="text-center text-orange-300 text-sm">
                        Waiting for the blocker to move...
                      </div>
                    )}

                    {activeTab === 'sent' && (
                      <button
                        onClick={() => updateAlertStatus(alert.id, 'resolved')}
                        disabled={updatingId === alert.id}
                        className="w-full bg-green-500 hover:bg-green-400 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {updatingId === alert.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            I Moved My Car
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {alert.status === 'resolved' && (
                  <div className="mt-3 pt-3 border-t border-green-500/20 text-center text-green-300 text-sm">
                    Resolved - No longer blocking
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
