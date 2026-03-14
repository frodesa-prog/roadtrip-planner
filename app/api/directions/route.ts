import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin      = searchParams.get('origin')
  const destination = searchParams.get('destination')
  // Valgfritt: pipe-separerte "lat,lng"-par for via-punkter (ikke stopp)
  const waypoints   = searchParams.get('waypoints')

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Mangler origin eller destination' }, { status: 400 })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Google Directions API forventer "via:lat,lng|via:lat,lng|..."
  const waypointsParam = waypoints
    ? `&waypoints=${waypoints.split('|').map((w) => `via:${w}`).join('|')}`
    : ''

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving${waypointsParam}&key=${apiKey}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== 'OK' || !data.routes?.[0]) {
      return NextResponse.json({ error: data.status }, { status: 400 })
    }

    // Summer opp distanse og tid fra alle etapper (via-punkter splitter ikke legs,
    // men det er tryggere å summere alle for å håndtere edge cases)
    const legs = data.routes[0].legs as Array<{ distance: { value: number }; duration: { value: number } }>
    const totalDistanceM  = legs.reduce((s, l) => s + l.distance.value, 0)
    const totalDurationS  = legs.reduce((s, l) => s + l.duration.value, 0)
    const distanceKm      = totalDistanceM / 1000

    return NextResponse.json({
      distanceKm:      Math.round(distanceKm),
      durationMinutes: Math.round(totalDurationS / 60),
      distanceText:    `${Math.round(distanceKm)} km`,
      durationText:    formatDuration(Math.round(totalDurationS / 60)),
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
