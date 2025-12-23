'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface OwnerInfo {
  name?: string
  email: string
  phone?: string
}

interface ActiveAlert {
  id: string
  detected_plate: string
  status: 'active' | 'leaving_soon' | 'resolved'
  type: 'sent' | 'received'
  sender_name?: string
  sender_phone?: string
  receiver_name?: string
  receiver_phone?: string
  created_at: string
}

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraStartedRef = useRef(false)

  const [hasCamera, setHasCamera] = useState(false)
  const [plate, setPlate] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [manualEdit, setManualEdit] = useState(false)
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false)
  const [userName, setUserName] = useState('')

  // Active alerts state
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null)

  // Push notification prompt state
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const [enablingPush, setEnablingPush] = useState(false)

  function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray.buffer as ArrayBuffer
  }

  async function enablePushNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setShowPushPrompt(false)
      localStorage.setItem('pushPromptShown', 'true')
      return
    }

    setEnablingPush(true)
    try {
      const vapidResponse = await fetch('/api/vapid-key', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (!vapidResponse.ok) {
        throw new Error('Failed to get VAPID key')
      }

      const vapidData = await vapidResponse.json()
      const vapidPublicKey = vapidData.vapidPublicKey?.trim()

      if (!vapidPublicKey) {
        throw new Error('VAPID key missing')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setShowPushPrompt(false)
        localStorage.setItem('pushPromptShown', 'true')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      const subscriptionJson = subscription.toJSON()
      localStorage.setItem('pushSubscription', JSON.stringify(subscriptionJson))

      // If user is registered, update their push subscription
      const userId = localStorage.getItem('userId')
      if (userId) {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: localStorage.getItem('userName'),
            email: localStorage.getItem('userEmail'),
            phone: localStorage.getItem('userPhone'),
            carPlate: localStorage.getItem('userPlate'),
            pushSubscription: subscriptionJson,
            existingUserId: userId
          })
        })
      }

      setShowPushPrompt(false)
      localStorage.setItem('pushPromptShown', 'true')
    } catch (err) {
      console.error('Push notification error:', err)
    } finally {
      setEnablingPush(false)
    }
  }

  function dismissPushPrompt() {
    setShowPushPrompt(false)
    localStorage.setItem('pushPromptShown', 'true')
  }

  function formatPlate(value: string) {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 7) {
      if (digits.length <= 2) return digits
      if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5, 7)}`
    } else {
      if (digits.length <= 3) return digits
      if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 8)}`
    }
  }

  // Load active alerts
  const loadActiveAlerts = useCallback(async () => {
    try {
      const userId = localStorage.getItem('userId')
      const userEmail = localStorage.getItem('userEmail')
      if (!userId || !userEmail) return

      setAlertsLoading(true)
      const response = await fetch(`/api/history?userId=${userId}&email=${userEmail}`)
      const data = await response.json()

      if (data.alerts) {
        // Filter only active (non-resolved) alerts
        const active = data.alerts.filter((a: ActiveAlert) => a.status !== 'resolved')
        setActiveAlerts(active)
      }
    } catch (err) {
      console.error('Error loading alerts:', err)
    } finally {
      setAlertsLoading(false)
    }
  }, [])

  // Update alert status
  async function updateAlertStatus(alertId: string, status: 'leaving_soon' | 'resolved') {
    setUpdatingAlertId(alertId)
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
        // Reload alerts
        loadActiveAlerts()
      }
    } catch (err) {
      console.error('Error updating alert:', err)
      alert('Failed to update status')
    } finally {
      setUpdatingAlertId(null)
    }
  }

  useEffect(() => {
    // Ensure we're in the browser
    if (typeof window === 'undefined') return

    startCamera()
    // Check if user is registered and get their name
    try {
      const userEmail = localStorage.getItem('userEmail')
      const userId = localStorage.getItem('userId')
      const storedName = localStorage.getItem('userName')
      setIsRegistered(!!(userEmail && userId))
      setUserName(storedName || '')

      // Load active alerts if registered
      if (userEmail && userId) {
        loadActiveAlerts()
      }

      // Check if we should show push notification prompt
      const pushPromptShown = localStorage.getItem('pushPromptShown')
      if (!pushPromptShown && 'Notification' in window && Notification.permission === 'default') {
        // Show prompt after a short delay to not overwhelm user
        setTimeout(() => setShowPushPrompt(true), 1000)
      }
    } catch (err) {
      console.error('Error checking registration:', err)
    }

    return () => stopCamera()
  }, [loadActiveAlerts])

  async function startCamera() {
    // Prevent multiple camera starts in same session
    if (cameraStartedRef.current) return
    cameraStartedRef.current = true

    try {
      // Check if we already have an active stream
      if (videoRef.current?.srcObject) {
        const existingStream = videoRef.current.srcObject as MediaStream
        if (existingStream.active) {
          setHasCamera(true)
          return
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasCamera(true)
      }
    } catch (err) {
      console.log('Camera error:', err)
      setHasCamera(false)
    }
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
    }
  }

  async function captureAndDetect() {
    if (!videoRef.current || !canvasRef.current) return

    setLoading(true)
    setError('')
    setPlate('')
    setOwnerInfo(null)

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0)

      const imageData = canvas.toDataURL('image/jpeg', 0.8)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.plate) {
        setPlate(data.plate)
        setConfidence(data.confidence)
        setManualEdit(false)
      } else {
        setError('No plate detected. Try again or enter manually.')
      }
    } catch (err) {
      console.log('OCR error:', err)
      setError('Failed to process image')
    } finally {
      setLoading(false)
    }
  }

  async function sendAlert() {
    if (!plate) return

    // Check if user is registered
    let senderEmail: string | null = null
    let senderId: string | null = null
    try {
      senderEmail = localStorage.getItem('userEmail')
      senderId = localStorage.getItem('userId')
    } catch (err) {
      console.error('Error accessing localStorage:', err)
    }

    if (!senderEmail || !senderId) {
      setShowRegisterPrompt(true)
      return
    }

    setSending(true)
    setError('')
    setSuccess('')
    setOwnerInfo(null)

    try {
      const response = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate,
          manualCorrection: manualEdit,
          confidence,
          senderEmail,
          senderId
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setOwnerInfo(data.owner)
        setSuccess(`Alert sent!`)
        // Reload active alerts to show the new blocking status
        loadActiveAlerts()
      }
    } catch (err) {
      console.log('Alert error:', err)
      setError('Failed to send alert')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-purple-950">
      {/* Push Notification Prompt Modal */}
      {showPushPrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-purple-800 to-purple-900 rounded-2xl p-6 max-w-sm w-full border border-purple-500/30 shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Enable Notifications</h2>
              <p className="text-purple-300 text-sm">
                Get instant alerts when someone blocks your car or when a blocked car owner needs to leave.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={enablePushNotifications}
                disabled={enablingPush}
                className="w-full bg-purple-500 hover:bg-purple-400 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {enablingPush ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Enable Notifications
                  </>
                )}
              </button>
              <button
                onClick={dismissPushPrompt}
                className="w-full bg-purple-800/50 hover:bg-purple-700/50 text-purple-300 py-3 px-4 rounded-xl font-medium"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-purple-800/50 backdrop-blur-sm text-white p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CarBlock" className="w-12 h-12 rounded-xl object-cover scale-125" />
            <div>
              <h1 className="text-lg font-bold">CarBlock</h1>
              <p className="text-xs text-purple-300">by Forsight Robotics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* User status indicator */}
            {isRegistered ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-green-300 truncate max-w-[100px]">
                  {userName || 'Logged in'}
                </span>
              </div>
            ) : (
              <Link href="/profile" className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-sm text-yellow-300">Not registered</span>
              </Link>
            )}
            <Link href="/profile" className="p-2 rounded-xl bg-purple-700/50 hover:bg-purple-600/50 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
            <Link href="/history" className="p-2 rounded-xl bg-purple-700/50 hover:bg-purple-600/50 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Active Alerts Panel */}
      {activeAlerts.length > 0 && (
        <div className="p-4 max-w-md mx-auto space-y-3">
          {/* Being Blocked Alerts */}
          {activeAlerts.filter(a => a.type === 'received').map(alert => (
            <div key={alert.id} className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
                <span className="text-red-300 font-medium">Someone is blocking you!</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white text-sm">Blocker: <span className="font-medium">{alert.sender_name || 'Unknown'}</span></p>
                  {alert.sender_phone && (
                    <a href={`tel:${alert.sender_phone}`} className="text-purple-300 text-sm flex items-center gap-1 mt-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {alert.sender_phone}
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-purple-300 text-xs">Your car</p>
                  <p className="text-white font-mono font-bold">{alert.detected_plate}</p>
                </div>
              </div>

              {alert.status === 'active' && (
                <button
                  onClick={() => updateAlertStatus(alert.id, 'leaving_soon')}
                  disabled={updatingAlertId === alert.id}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {updatingAlertId === alert.id ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

              {alert.status === 'leaving_soon' && (
                <div className="bg-orange-500/20 text-orange-300 py-3 px-4 rounded-xl text-center font-medium mb-3">
                  Waiting for blocker to move...
                </div>
              )}

              {/* Dismiss button - always show for received alerts */}
              <button
                onClick={() => updateAlertStatus(alert.id, 'resolved')}
                disabled={updatingAlertId === alert.id}
                className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {updatingAlertId === alert.id ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Dismiss (They Left)
                  </>
                )}
              </button>
            </div>
          ))}

          {/* Blocking Others Alerts */}
          {activeAlerts.filter(a => a.type === 'sent').map(alert => (
            <div key={alert.id} className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/40 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <span className="text-yellow-300 font-medium">
                  {alert.status === 'leaving_soon' ? 'Owner wants to leave!' : 'You are blocking a car'}
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white text-sm">Owner: <span className="font-medium">{alert.receiver_name || 'Unknown'}</span></p>
                  {alert.receiver_phone && (
                    <a href={`tel:${alert.receiver_phone}`} className="text-purple-300 text-sm flex items-center gap-1 mt-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {alert.receiver_phone}
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-purple-300 text-xs">Blocked car</p>
                  <p className="text-white font-mono font-bold">{alert.detected_plate}</p>
                </div>
              </div>

              {alert.status === 'leaving_soon' && (
                <div className="bg-red-500/30 text-red-300 py-2 px-3 rounded-lg text-sm text-center mb-3 animate-pulse">
                  The owner needs to leave! Please move your car.
                </div>
              )}

              <button
                onClick={() => updateAlertStatus(alert.id, 'resolved')}
                disabled={updatingAlertId === alert.id}
                className="w-full bg-green-500 hover:bg-green-400 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updatingAlertId === alert.id ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    I Moved My Car
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 max-w-md mx-auto">
        {/* Camera View */}
        <div className="bg-black rounded-2xl overflow-hidden relative aspect-[4/3] shadow-2xl shadow-purple-500/20">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {!hasCamera && (
            <div className="absolute inset-0 flex items-center justify-center bg-purple-900/80 text-white text-center p-6">
              <div>
                <svg className="w-16 h-16 mx-auto mb-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-purple-200">Camera not available</p>
                <p className="text-sm text-purple-400 mt-1">Enter plate manually below</p>
              </div>
            </div>
          )}

          {/* Scanning overlay */}
          {loading && (
            <div className="absolute inset-0 bg-purple-900/50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-white mt-4 font-medium">Scanning plate...</p>
              </div>
            </div>
          )}
        </div>

        {/* Capture Button */}
        <button
          onClick={captureAndDetect}
          disabled={loading || !hasCamera}
          className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          {loading ? 'Scanning...' : 'Scan Plate'}
        </button>

        {/* Manual Entry */}
        <div className="mt-6">
          <label className="block text-sm text-purple-300 mb-2 text-center">
            Or enter plate manually
          </label>
          <input
            type="text"
            value={plate}
            onChange={(e) => {
              const formatted = formatPlate(e.target.value)
              setPlate(formatted)
              setManualEdit(true)
              setOwnerInfo(null)
            }}
            placeholder="1234567"
            className="w-full px-4 py-4 bg-purple-900/50 border border-purple-500/30 rounded-xl text-white text-center text-2xl font-mono placeholder-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        {/* Detected Plate Display */}
        {plate && !manualEdit && (
          <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center border border-purple-500/30">
            <p className="text-sm text-purple-300 mb-1">Detected Plate</p>
            <p className="text-3xl font-mono font-bold text-white">{plate}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${confidence > 0.7 ? 'bg-green-400' : confidence > 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
              <p className="text-sm text-purple-300">
                {(confidence * 100).toFixed(0)}% confidence
              </p>
            </div>
          </div>
        )}

        {/* Register Prompt */}
        {showRegisterPrompt && (
          <div className="mt-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex justify-between items-start mb-3">
              <p className="text-yellow-300 font-medium">Registration Required</p>
              <button
                onClick={() => setShowRegisterPrompt(false)}
                className="text-yellow-300 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-yellow-200 text-sm mb-4">
              Please register your profile first. This lets the car owner know who is blocking them and how to contact you.
            </p>
            <Link
              href="/profile"
              className="block w-full bg-yellow-500 text-black py-3 rounded-xl font-medium text-center"
            >
              Go to Profile
            </Link>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/30 text-red-300 p-4 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Success Message with Owner Info */}
        {success && (
          <div className="mt-4 bg-green-500/20 border border-green-500/30 p-4 rounded-xl">
            <p className="text-green-300 text-center font-medium mb-3">{success}</p>
            {ownerInfo && (
              <div className="bg-white/10 rounded-xl p-4 space-y-3">
                <p className="text-white font-medium text-center">Car owner notified!</p>
                <p className="text-purple-300 text-sm text-center">They know you&apos;re blocking them and have your contact info</p>
                {ownerInfo.name && (
                  <p className="text-purple-200 text-center mt-2">{ownerInfo.name}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Send Alert Button */}
        {plate && !success && (
          <button
            onClick={sendAlert}
            disabled={sending}
            className={`w-full mt-4 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 shadow-lg transition-all flex items-center justify-center gap-2 ${
              isRegistered
                ? 'bg-gradient-to-r from-red-500 to-orange-500 shadow-red-500/30 hover:shadow-red-500/50'
                : 'bg-gradient-to-r from-gray-500 to-gray-600 shadow-gray-500/30'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {sending ? 'Notifying...' : isRegistered ? 'I\'m Blocking This Car' : 'Register First to Notify'}
          </button>
        )}

        {/* Reset Button */}
        {success && (
          <button
            onClick={() => {
              setPlate('')
              setSuccess('')
              setOwnerInfo(null)
              setConfidence(0)
            }}
            className="w-full mt-4 bg-purple-700/50 text-white py-4 rounded-xl font-medium"
          >
            Scan Another Plate
          </button>
        )}
      </div>
    </div>
  )
}
