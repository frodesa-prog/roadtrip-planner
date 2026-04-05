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
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.[0]) {
      return NextResponse.json({ state: null, country: null, city: null })
    }

    const components: { types: string[]; long_name: string; short_name: string }[] =
      data.results[0].address_components ?? []

    const get = (type: string, useLong = true) => {
      const c = components.find(c => c.types.includes(type))
      return c ? (useLong ? c.long_name : c.short_name) : null
    }

    return NextResponse.json({
      state:   get('administrative_area_level_1', false), // e.g. "KS"
      country: get('country'),                            // e.g. "United States"
      city:    get('locality') ?? get('postal_town') ?? get('sublocality_level_1'),
    })
  } catch {
    return NextResponse.json({ state: null, country: null, city: null })
  }
}
