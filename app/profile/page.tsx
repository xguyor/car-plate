'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [carPlate, setCarPlate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showIOSInstall, setShowIOSInstall] = useState(false)

  useEffect(() => {
    // Load from localStorage
    setName(localStorage.getItem('userName') || '')
    setEmail(localStorage.getItem('userEmail') || '')
    setPhone(localStorage.getItem('userPhone') || '')
    setCarPlate(localStorage.getItem('userPlate') || '')

    // Check notification permission
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted')
    }

    // Detect iOS and standalone mode
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsIOS(ios)
    setIsStandalone(standalone)

    // Show iOS install prompt if iOS + not standalone + notifications not enabled
    if (ios && !standalone && Notification.permission !== 'granted') {
      setShowIOSInstall(true)
    }
  }, [])

  async function enableNotifications(): Promise<PushSubscription | null> {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setError('Push notifications not supported on this browser')
      return null
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Please allow notifications to receive alerts')
        return null
      }

      setNotificationsEnabled(true)

      // Register service worker and get push subscription
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      })

      // Save subscription to localStorage - use toJSON() for proper serialization
      const subscriptionJson = subscription.toJSON()
      localStorage.setItem('pushSubscription', JSON.stringify(subscriptionJson))
      console.log('Push subscription saved:', subscriptionJson.endpoint?.substring(0, 50))
      return subscription
    } catch (err) {
      console.error('Notification error:', err)
      setError('Failed to enable notifications')
      return null
    }
  }

  async function saveProfile() {
    setSaving(true)
    setError('')
    setSuccess('')

    if (!email) {
      setError('Email is required')
      setSaving(false)
      return
    }

    const digitsOnly = carPlate.replace(/-/g, '')
    if (carPlate && (digitsOnly.length < 7 || digitsOnly.length > 8)) {
      setError('Plate must be 7 or 8 digits')
      setSaving(false)
      return
    }

    try {
      // Get existing subscription or try to get a new one if notifications enabled
      let pushSubscription = localStorage.getItem('pushSubscription')
      console.log('Save profile - existing pushSubscription in localStorage:', !!pushSubscription)

      // If notifications are enabled but no subscription, get one
      if (notificationsEnabled && !pushSubscription) {
        console.log('Notifications enabled but no subscription, getting one...')
        const subscription = await enableNotifications()
        if (subscription) {
          pushSubscription = JSON.stringify(subscription.toJSON())
        }
      }

      const parsedSubscription = pushSubscription ? JSON.parse(pushSubscription) : null
      console.log('Sending to API - pushSubscription:', parsedSubscription ? 'yes' : 'no')

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          carPlate,
          pushSubscription: parsedSubscription
        })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Save to localStorage
      localStorage.setItem('userName', name)
      localStorage.setItem('userEmail', email)
      localStorage.setItem('userPhone', phone)
      localStorage.setItem('userPlate', carPlate)
      if (data.userId) {
        localStorage.setItem('userId', data.userId)
      }

      setSuccess('Profile saved!')
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
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

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-purple-950">
      {/* Header */}
      <div className="bg-purple-800/50 backdrop-blur-sm text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/camera" className="text-purple-200 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">My Profile</h1>
        </div>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/30">
          <label className="block text-sm font-medium text-purple-200 mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-4 py-3 bg-purple-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/30">
          <label className="block text-sm font-medium text-purple-200 mb-2">
            Email (for alerts)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 bg-purple-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/30">
          <label className="block text-sm font-medium text-purple-200 mb-2">
            Phone Number (so others can call you)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="050-123-4567"
            className="w-full px-4 py-3 bg-purple-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/30">
          <label className="block text-sm font-medium text-purple-200 mb-2">
            Car Plate Number
          </label>
          <input
            type="text"
            value={carPlate}
            onChange={(e) => setCarPlate(formatPlate(e.target.value))}
            placeholder="1234567"
            maxLength={11}
            className="w-full px-4 py-3 bg-purple-900/50 border border-purple-500/30 rounded-xl text-white text-center text-2xl font-mono placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <p className="text-sm text-purple-300 mt-2 text-center">
            Register to receive alerts when blocking
          </p>
        </div>

        {/* Push Notifications */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Push Notifications</p>
              <p className="text-sm text-purple-300">Get instant alerts on your phone</p>
            </div>
            {isIOS && !isStandalone ? (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-lg">
                Install app first
              </span>
            ) : (
              <button
                onClick={async () => {
                  const subscription = await enableNotifications()
                  if (subscription) {
                    setSuccess('Notifications enabled! Save your profile to activate.')
                  }
                }}
                disabled={notificationsEnabled}
                className={`px-4 py-2 rounded-xl font-medium ${
                  notificationsEnabled
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-purple-500 text-white hover:bg-purple-400'
                }`}
              >
                {notificationsEnabled ? 'Enabled' : 'Enable'}
              </button>
            )}
          </div>
        </div>

        {/* iOS Install Instructions */}
        {showIOSInstall && (
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-2xl p-4">
            <div className="flex justify-between items-start mb-3">
              <p className="text-white font-medium">Install CarBlock App</p>
              <button
                onClick={() => setShowIOSInstall(false)}
                className="text-blue-300 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-blue-200 text-sm mb-3">
              To receive push notifications on iPhone, install this app to your home screen:
            </p>
            <ol className="text-blue-200 text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="bg-blue-500/30 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                <span>Tap the <strong>Share</strong> button <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> at the bottom of Safari</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-500/30 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                <span>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-blue-500/30 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                <span>Open the app from your home screen, then enable notifications</span>
              </li>
            </ol>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 p-4 rounded-xl text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500/30 text-green-300 p-4 rounded-xl text-center">
            {success}
          </div>
        )}

        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
