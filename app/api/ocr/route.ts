import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { image } = await request.json()
    const base64Data = image.split(',')[1]

    if (!process.env.OCR_SPACE_API_KEY) {
      return NextResponse.json({
        plate: '',
        confidence: 0,
        rawText: '',
        error: 'OCR not configured'
      })
    }

    // Call OCR.space API
    const formData = new FormData()
    formData.append('base64Image', `data:image/jpeg;base64,${base64Data}`)
    formData.append('apikey', process.env.OCR_SPACE_API_KEY)
    formData.append('language', 'eng')
    formData.append('OCREngine', '2')
    formData.append('detectOrientation', 'true')
    formData.append('scale', 'true')

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    })

    const data = await response.json()

    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      return NextResponse.json({
        plate: '',
        confidence: 0,
        rawText: '',
        error: 'No text detected'
      })
    }

    const text = data.ParsedResults[0].ParsedText || ''

    // Israeli plate patterns: XX-XXX-XX or XXX-XX-XXX
    const patterns = [
      /\b(\d{2})-?(\d{3})-?(\d{2})\b/,  // Old format
      /\b(\d{3})-?(\d{2})-?(\d{3})\b/   // New format
    ]

    let bestMatch = null
    let bestConfidence = 0

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const cleaned = match[0].replace(/[^0-9-]/g, '')
        const formatted = cleaned.includes('-') ? cleaned :
          (cleaned.length === 7 ? `${cleaned.slice(0,2)}-${cleaned.slice(2,5)}-${cleaned.slice(5)}` :
           `${cleaned.slice(0,3)}-${cleaned.slice(3,5)}-${cleaned.slice(5)}`)

        bestMatch = formatted
        bestConfidence = 0.85
        break
      }
    }

    // Fallback: extract any numbers
    if (!bestMatch) {
      const numbers = text.replace(/[^0-9]/g, '')
      if (numbers.length >= 7) {
        bestMatch = `${numbers.slice(0,2)}-${numbers.slice(2,5)}-${numbers.slice(5,7)}`
        bestConfidence = 0.4
      } else {
        bestMatch = numbers
        bestConfidence = 0.2
      }
    }

    return NextResponse.json({
      plate: bestMatch || '',
      confidence: bestConfidence,
      rawText: text
    })

  } catch (error: unknown) {
    console.error('OCR error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      plate: '',
      confidence: 0,
      rawText: '',
      error: errorMessage
    }, { status: 500 })
  }
}
