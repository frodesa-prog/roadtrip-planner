import { NextRequest, NextResponse } from 'next/server'

// Reverse geocode: lat,lng → { state, country, city }
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Mangler lat eller lng' }, { status: 400 })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`

  try {
    // no-store ensures we never serve a cached Plus Code response
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

    return NextResponse.json({
      state:   get('administrative_area_level_1', false), // e.g. "NE"
      country: get('country'),                            // e.g. "United States"
      city:    get('locality') ?? get('postal_town') ?? get('sublocality_level_1'),
    })
  } catch {
    return NextResponse.json({ state: null, country: null, city: null })
  }
}
