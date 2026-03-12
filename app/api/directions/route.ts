import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Mangler origin eller destination' }, { status: 400 })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${apiKey}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK' || !data.routes?.[0]) {
      return NextResponse.json({ error: data.status }, { status: 400 })
    }

    const leg = data.routes[0].legs[0]
    const distanceKm = leg.distance.value / 1000

    return NextResponse.json({
      distanceKm: Math.round(distanceKm),
      durationMinutes: Math.round(leg.duration.value / 60),
      distanceText: `${Math.round(distanceKm)} km`,
      durationText: formatDuration(Math.round(leg.duration.value / 60)),
    })
  } catch {
    return NextResponse.json({ error: 'Kunne ikke hente rute' }, { status: 500 })
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}t`
  return `${h}t ${m}min`
}
