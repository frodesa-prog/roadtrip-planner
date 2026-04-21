import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client – bypasses RLS for cache reads/writes from the server
function cacheClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Reverse geocode: lat,lng → { state, country, city }
// Checks the geocode_cache table first; calls Google only on a cache miss.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Mangler lat eller lng' }, { status: 400 })
  }

  // Round to 4 decimal places (~11 m) – matches the cache table's numeric(8,4) key
  const latR = Math.round(parseFloat(lat) * 10000) / 10000
  const lngR = Math.round(parseFloat(lng) * 10000) / 10000

  const supabase = cacheClient()

  // ── Cache lookup ─────────────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from('geocode_cache')
    .select('state, country, city')
    .eq('lat', latR)
    .eq('lng', lngR)
    .single()

  if (cached) {
    return NextResponse.json({ state: cached.state, country: cached.country, city: cached.city })
  }

  // ── Cache miss – call Google Geocoding API ────────────────────────────────
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latR},${lngR}&key=${apiKey}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json({ state: null, country: null, city: null })
    }

    type Component = { types: string[]; long_name: string; short_name: string }

    // Helper: find a component of a given type across an array of components
    const findComp = (comps: Component[], type: string) =>
      comps.find((c) => c.types.includes(type))

    // Google sometimes puts a Plus Code result first (no address components).
    // Prefer the first result that actually has an administrative_area_level_1.
    const results: { address_components: Component[] }[] = data.results
    const bestResult =
      results.find((r) => findComp(r.address_components ?? [], 'administrative_area_level_1')) ??
      results[0]

    const components: Component[] = bestResult.address_components ?? []

    const get = (type: string, useLong = true) => {
      const c = findComp(components, type)
      return c ? (useLong ? c.long_name : c.short_name) : null
    }

    const state   = get('administrative_area_level_1', false) // e.g. "NE"
    const country = get('country')                            // e.g. "United States"
    const city    = get('locality') ?? get('postal_town') ?? get('sublocality_level_1')

    // ── Upsert into cache (fire-and-forget – don't block the response) ────
    supabase
      .from('geocode_cache')
      .upsert({ lat: latR, lng: lngR, state, country, city }, { onConflict: 'lat,lng' })
      .then()

    return NextResponse.json({ state, country, city })
  } catch {
    return NextResponse.json({ state: null, country: null, city: null })
  }
}
