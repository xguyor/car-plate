'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CameraPage() {
  const supabase = createClient()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [hasCamera, setHasCamera] = useState(false)
  const [plate, setPlate] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [manualEdit, setManualEdit] = useState(false)

  useEffect(() => {
    checkAuth()
    startCamera()
    return () => stopCamera()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setHasCamera(true)
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera access.')
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
      setError('Failed to process image')
    } finally {
      setLoading(false)
    }
  }

  async function sendAlert() {
    if (!plate) return

    setSending(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate,
          manualCorrection: manualEdit,
          confidence
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setSuccess(`Alert sent to ${data.owner}!`)
        setPlate('')
        setConfidence(0)
      }
    } catch (err) {
      setError('Failed to send alert')
    } finally {
      setSending(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">CarBlock Alert</h1>
          <div className="flex gap-4">
            <Link href="/profile" className="text-sm hover:underline">Profile</Link>
            <Link href="/history" className="text-sm hover:underline">History</Link>
            <button onClick={handleLogout} className="text-sm hover:underline">Logout</button>
          </div>
        </div>
      </div>

      {/* Camera View */}
      <div className="p-4">
        <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {!hasCamera && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
              <p>Camera not available. Enable camera access or enter plate manually.</p>
            </div>
          )}
        </div>

        {/* Capture Button */}
        <button
          onClick={captureAndDetect}
          disabled={loading || !hasCamera}
          className="w-full mt-4 bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50"
        >
          {loading ? 'Detecting...' : 'Capture & Detect Plate'}
        </button>

        {/* Manual Entry */}
        <div className="mt-4">
          <label className="block text-sm text-gray-600 mb-1">
            Or enter plate manually:
          </label>
          <input
            type="text"
            value={plate}
            onChange={(e) => {
              setPlate(e.target.value.toUpperCase())
              setManualEdit(true)
            }}
            placeholder="XX-XXX-XX or XXX-XX-XXX"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl font-mono"
          />
        </div>

        {/* Detected Plate Display */}
        {plate && !manualEdit && (
          <div className="mt-4 bg-white rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">Detected Plate:</p>
            <p className="text-3xl font-mono font-bold">{plate}</p>
            <p className="text-sm text-gray-500 mt-1">
              Confidence: {(confidence * 100).toFixed(0)}%
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mt-4 bg-green-50 text-green-600 p-3 rounded-lg text-center">
            {success}
          </div>
        )}

        {/* Send Alert Button */}
        {plate && (
          <button
            onClick={sendAlert}
            disabled={sending}
            className="w-full mt-4 bg-red-600 text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Alert to Owner'}
          </button>
        )}
      </div>
    </div>
  )
}
