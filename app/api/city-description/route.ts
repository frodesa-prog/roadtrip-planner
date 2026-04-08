import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

// In-memory cache – overlever ikke restart, men unngår dupliserte kall i samme økt
const cache = new Map<string, string>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const city    = searchParams.get('city')?.trim()
  const state   = searchParams.get('state')?.trim() || null
  const country = searchParams.get('country')?.trim() || null

  if (!city) {
    return NextResponse.json({ error: 'Mangler city-parameter' }, { status: 400 })
  }

  const cacheKey = [city, state, country].filter(Boolean).join('|').toLowerCase()

  if (cache.has(cacheKey)) {
    return NextResponse.json({ extract: cache.get(cacheKey) })
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY ikke satt')

    const client = new Anthropic({ apiKey })
    const location = [city, state, country].filter(Boolean).join(', ')

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 120,
      system: 'Du er en reiseguide. Skriv alltid på norsk. Svar med kun tekst, ingen markdown.',
      messages: [{
        role: 'user',
        content: `Skriv 2 korte setninger på norsk om ${location}. Hva er stedet kjent for? Vær konkret og informativ.`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : null
    if (text) {
      cache.set(cacheKey, text)
      return NextResponse.json({ extract: text })
    }
  } catch (err) {
    console.error('city-description feilet:', err)
  }

  return NextResponse.json({ extract: null })
}
