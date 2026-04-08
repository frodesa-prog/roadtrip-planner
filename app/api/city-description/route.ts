import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET: hent fra DB → generer med AI hvis ikke funnet ───────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const city    = searchParams.get('city')?.trim()
  const state   = searchParams.get('state')?.trim() || null
  const country = searchParams.get('country')?.trim() || null
  const visitNumber = parseInt(searchParams.get('visit') ?? '1', 10)
  const revisit = visitNumber > 1

  if (!city) {
    return NextResponse.json({ error: 'Mangler city-parameter' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Sjekk databasen (bare for første gangs besøk)
  if (!revisit) {
    let query = supabase
      .from('city_descriptions')
      .select('id, extract')
      .eq('city', city)
    if (state)   query = query.eq('state',   state)
    else         query = query.is('state',   null)
    if (country) query = query.eq('country', country)
    else         query = query.is('country', null)

    const { data: existing } = await query.maybeSingle()

    if (existing) {
      return NextResponse.json({ id: existing.id, extract: existing.extract })
    }
  }

  // 2. Generer med Claude Haiku
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY ikke satt')

    const client   = new Anthropic({ apiKey })
    const location = [city, state, country].filter(Boolean).join(', ')

    const revisitAngles = [
      'lokale mattradisjoner og restaurantkultur',
      'historie og arkitektur',
      'natur, parker og friluftsliv',
      'kunst, musikk og kulturliv',
      'spennende nabolag og lokale skjulte perler',
    ]
    const angle = revisitAngles[(visitNumber - 2) % revisitAngles.length]

    const prompt = revisit
      ? `Skriv 2 korte setninger på norsk om ${location}, med fokus på ${angle}. Vær konkret og informativ. Ikke gjenta generelle fakta om stedet.`
      : `Skriv 2 korte setninger på norsk om ${location}. Hva er stedet kjent for? Vær konkret og informativ.`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 120,
      system: 'Du er en reiseguide. Skriv alltid på norsk. Svar med kun tekst, ingen markdown.',
      messages: [{ role: 'user', content: prompt }],
    })

    const extract = msg.content[0].type === 'text' ? msg.content[0].text.trim() : null
    if (!extract) return NextResponse.json({ extract: null })

    // 3. Lagre i databasen (bare for første gangs besøk)
    if (!revisit) {
      const { data: inserted } = await supabase
        .from('city_descriptions')
        .insert({ city, state, country, extract })
        .select('id')
        .single()

      return NextResponse.json({ id: inserted?.id ?? null, extract })
    }

    // Revisit-tekster lagres ikke i DB – returneres uten id
    return NextResponse.json({ id: null, extract })
  } catch (err) {
    console.error('city-description feilet:', err)
    return NextResponse.json({ extract: null })
  }
}

// ── PATCH: oppdater en eksisterende bybeskrivelse ────────────────────────────

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, extract } = await request.json()
  if (!id || !extract?.trim()) {
    return NextResponse.json({ error: 'id og extract er påkrevd' }, { status: 400 })
  }

  const { error } = await supabase
    .from('city_descriptions')
    .update({ extract: extract.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
