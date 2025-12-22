'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [carPlate, setCarPlate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Load from localStorage
    const savedEmail = localStorage.getItem('userEmail') || ''
    const savedPlate = localStorage.getItem('userPlate') || ''
    setEmail(savedEmail)
    setCarPlate(savedPlate)
  }, [])

  async function saveProfile() {
    setSaving(true)
    setError('')
    setSuccess('')

    // Validate email
    if (!email) {
      setError('Email is required')
      setSaving(false)
      return
    }

    // Validate plate format (7 or 8 digits)
    const digitsOnly = carPlate.replace(/-/g, '')
    if (carPlate && (digitsOnly.length < 7 || digitsOnly.length > 8)) {
      setError('Plate must be 7 or 8 digits')
      setSaving(false)
      return
    }

    try {
      // Save to API (which saves to Supabase)
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, carPlate })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Save to localStorage as backup
      localStorage.setItem('userEmail', email)
      localStorage.setItem('userPlate', carPlate)

      setSuccess('Profile saved! You will receive alerts at this email.')
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function formatPlate(value: string) {
    // Remove non-digits
    const digits = value.replace(/\D/g, '')

    // Format based on length
    if (digits.length <= 7) {
      // 7 digit format: XX-XXX-XX
      if (digits.length <= 2) return digits
      if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5, 7)}`
    } else {
      // 8 digit format: XXX-XX-XXX
      if (digits.length <= 3) return digits
      if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 8)}`
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <Link href="/camera" className="text-sm">← Back</Link>
        <h1 className="text-xl font-bold mt-2">My Profile</h1>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Email (for receiving alerts)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>

        <div className="bg-white rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Car Plate Number
          </label>
          <input
            type="text"
            value={carPlate}
            onChange={(e) => setCarPlate(formatPlate(e.target.value))}
            placeholder="1234567 or 12345678"
            maxLength={11}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl font-mono"
          />
          <p className="text-sm text-gray-500 mt-2">
            Register your plate to receive alerts when your car is blocking someone.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg text-center">
            {success}
          </div>
        )}

        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
