'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type ViewMode = 'login' | 'register' | 'edit'

export default function ProfilePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('login')
  const [loginPhone, setLoginPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [carPlate, setCarPlate] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showIOSInstall, setShowIOSInstall] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      // Check if user is already logged in
      const userId = localStorage.getItem('userId')
      if (userId) {
        // Load existing profile data
        setName(localStorage.getItem('userName') || '')
        setEmail(localStorage.getItem('userEmail') || '')
        setPhone(localStorage.getItem('userPhone') || '')
        setCarPlate(localStorage.getItem('userPlate') || '')
        setViewMode('edit')
      }

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
    } catch (err) {
      console.error('Error loading profile data:', err)
    }
  }, [])

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

  async function enableNotifications(): Promise<PushSubscription | null> {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setError('Push notifications not supported on this browser')
      return null
    }

    try {
      console.log('Fetching VAPID key from API...')
      const vapidResponse = await fetch('/api/vapid-key', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (!vapidResponse.ok) {
        setError(`VAPID API error: ${vapidResponse.status}`)
        return null
      }

      const vapidData = await vapidResponse.json()
      if (!vapidData.vapidPublicKey) {
        setError('VAPID key missing')
        return null
      }

      const vapidPublicKey = vapidData.vapidPublicKey.trim()

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Please allow notifications to receive alerts')
        return null
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      const subscriptionJson = subscription.toJSON()
      localStorage.setItem('pushSubscription', JSON.stringify(subscriptionJson))

      setNotificationsEnabled(true)
      return subscription
    } catch (err) {
      console.error('Notification error:', err)
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      alert(`Push error: ${errorMsg}`)
      setError(`Failed to enable notifications: ${errorMsg}`)
      return null
    }
  }

  async function handleLogin() {
    if (!loginPhone) {
      setError('Please enter your phone number')
      return
    }

    setChecking(true)
    setError('')

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        return
      }

      if (data.found) {
        // User exists - log them in
        localStorage.setItem('userId', data.user.id)
        localStorage.setItem('userName', data.user.name || '')
        localStorage.setItem('userEmail', data.user.email || '')
        localStorage.setItem('userPhone', data.user.phone || '')
        localStorage.setItem('userPlate', data.user.carPlate || '')

        setName(data.user.name || '')
        setEmail(data.user.email || '')
        setPhone(data.user.phone || '')
        setCarPlate(data.user.carPlate || '')
        setSuccess('Welcome back!')
        setViewMode('edit')

        // Sync push subscription if available
        const existingSubscription = localStorage.getItem('pushSubscription')
        if (existingSubscription) {
          try {
            await fetch('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: data.user.name,
                email: data.user.email,
                phone: data.user.phone,
                carPlate: data.user.carPlate,
                pushSubscription: JSON.parse(existingSubscription),
                existingUserId: data.user.id
              })
            })
            console.log('Push subscription synced on login')
          } catch (syncErr) {
            console.error('Failed to sync push subscription:', syncErr)
          }
        }
      } else {
        // User not found - show registration
        setPhone(loginPhone)
        setViewMode('register')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Failed to check phone number')
    } finally {
      setChecking(false)
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

    if (!phone) {
      setError('Phone number is required')
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
      let pushSubscription = localStorage.getItem('pushSubscription')

      // If notifications are enabled but we don't have a subscription, try to get one
      if (notificationsEnabled && !pushSubscription) {
        const subscription = await enableNotifications()
        if (subscription) {
          pushSubscription = JSON.stringify(subscription.toJSON())
        }
      }

      // Also try to get existing subscription from service worker if we have permission but no stored subscription
      if (!pushSubscription && 'Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready
          const existingSub = await registration.pushManager.getSubscription()
          if (existingSub) {
            pushSubscription = JSON.stringify(existingSub.toJSON())
            localStorage.setItem('pushSubscription', pushSubscription)
          }
        } catch (e) {
          console.error('Failed to get existing subscription:', e)
        }
      }

      const parsedSubscription = pushSubscription ? JSON.parse(pushSubscription) : null
      const existingUserId = localStorage.getItem('userId')

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          carPlate,
          pushSubscription: parsedSubscription,
          existingUserId
        })
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        setError(data.error || 'Failed to save profile')
        setSaving(false)
        return
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
      setViewMode('edit')
    } catch (err) {
      console.error('Save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function logout() {
    localStorage.removeItem('userId')
    localStorage.removeItem('userName')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userPhone')
    localStorage.removeItem('userPlate')
    localStorage.removeItem('pushSubscription')
    setName('')
    setEmail('')
    setPhone('')
    setCarPlate('')
    setLoginPhone('')
    setViewMode('login')
    setSuccess('')
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

  // Login view
  if (viewMode === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-purple-950">
        <div className="bg-purple-800/50 backdrop-blur-sm text-white p-4 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Link href="/camera" className="text-purple-200 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <img src="/logo.png" alt="CarBlock" className="w-10 h-10 rounded-lg object-cover scale-125" />
            <h1 className="text-xl font-bold">Login</h1>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-md mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30">
            <div className="text-center mb-6">
              <img src="/logo.png" alt="CarBlock" className="w-24 h-24 mx-auto mb-4 rounded-2xl object-cover scale-110" />
              <h2 className="text-white text-xl font-bold mb-2">Welcome to CarBlock</h2>
              <p className="text-purple-300 text-sm">Enter your phone number to login or register</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={loginPhone}
                onChange={(e) => setLoginPhone(formatPhone(e.target.value))}
                placeholder="050-123-4567"
                className="w-full px-4 py-3 bg-purple-900/50 border border-purple-500/30 rounded-xl text-white text-center text-xl placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 p-3 rounded-xl text-center text-sm mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={checking || !loginPhone}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 shadow-lg shadow-purple-500/30"
            >
              {checking ? 'Checking...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Register view
  if (viewMode === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-purple-950">
        <div className="bg-purple-800/50 backdrop-blur-sm text-white p-4 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewMode('login')} className="text-purple-200 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <img src="/logo.png" alt="CarBlock" className="w-10 h-10 rounded-lg object-cover scale-125" />
            <h1 className="text-xl font-bold">Register</h1>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-md mx-auto">
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 mb-4">
            <p className="text-blue-200 text-sm text-center">
              Phone number not found. Please complete your registration below.
            </p>
          </div>

          <ProfileForm
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={(v) => setPhone(formatPhone(v))}
            carPlate={carPlate}
            setCarPlate={(v) => setCarPlate(formatPlate(v))}
            notificationsEnabled={notificationsEnabled}
            enableNotifications={async () => {
              const sub = await enableNotifications()
              if (sub) setSuccess('Notifications enabled!')
            }}
            isIOS={isIOS}
            isStandalone={isStandalone}
            showIOSInstall={showIOSInstall}
            setShowIOSInstall={setShowIOSInstall}
            error={error}
            success={success}
            saving={saving}
            onSave={saveProfile}
            buttonText="Create Account"
          />
        </div>
      </div>
    )
  }

  // Edit profile view
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-purple-950">
      <div className="bg-purple-800/50 backdrop-blur-sm text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/camera" className="text-purple-200 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <img src="/logo.png" alt="CarBlock" className="w-10 h-10 rounded-lg object-cover scale-125" />
            <h1 className="text-xl font-bold">My Profile</h1>
          </div>
          <button
            onClick={logout}
            className="text-purple-300 hover:text-white text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <ProfileForm
          name={name}
          setName={setName}
          email={email}
          setEmail={setEmail}
          phone={phone}
          setPhone={(v) => setPhone(formatPhone(v))}
          carPlate={carPlate}
          setCarPlate={(v) => setCarPlate(formatPlate(v))}
          notificationsEnabled={notificationsEnabled}
          enableNotifications={async () => {
            const sub = await enableNotifications()
            if (sub) setSuccess('Notifications enabled!')
          }}
          isIOS={isIOS}
          isStandalone={isStandalone}
          showIOSInstall={showIOSInstall}
          setShowIOSInstall={setShowIOSInstall}
          error={error}
          success={success}
          saving={saving}
          onSave={saveProfile}
          buttonText="Save Profile"
        />
      </div>
    </div>
  )
}

interface ProfileFormProps {
  name: string
  setName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  carPlate: string
  setCarPlate: (v: string) => void
  notificationsEnabled: boolean
  enableNotifications: () => Promise<void>
  isIOS: boolean
  isStandalone: boolean
  showIOSInstall: boolean
  setShowIOSInstall: (v: boolean) => void
  error: string
  success: string
  saving: boolean
  onSave: () => void
  buttonText: string
}

function ProfileForm({
  name, setName,
  email, setEmail,
  phone, setPhone,
  carPlate, setCarPlate,
  notificationsEnabled, enableNotifications,
  isIOS, isStandalone,
  showIOSInstall, setShowIOSInstall,
  error, success,
  saving, onSave,
  buttonText
}: ProfileFormProps) {
  return (
    <>
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
          Phone Number (for login & contact)
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
          onChange={(e) => setCarPlate(e.target.value)}
          placeholder="1234567"
          maxLength={11}
          className="w-full px-4 py-3 bg-purple-900/50 border border-purple-500/30 rounded-xl text-white text-center text-2xl font-mono placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <p className="text-sm text-purple-300 mt-2 text-center">
          Register to receive alerts when someone blocks you
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
              onClick={enableNotifications}
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
              <span>Tap the <strong>Share</strong> button at the bottom of Safari</span>
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
        onClick={onSave}
        disabled={saving}
        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
      >
        {saving ? 'Saving...' : buttonText}
      </button>
    </>
  )
}
