'use client'

import { useState, useEffect, useRef } from 'react'
import { Stop, RouteLeg } from '@/types'

export interface LegInfo {
  distanceKm: number
  durationMinutes: number
  distanceText: string
  durationText: string
}

// Enkel in-memory cache – overlever re-renders men ikke page reload
const cache = new Map<string, LegInfo>()

function stopPairKey(from: Stop, to: Stop): string {
  return `${from.lat.toFixed(4)},${from.lng.toFixed(4)}->${to.lat.toFixed(4)},${to.lng.toFixed(4)}`
}

function waypointsKey(waypoints: Array<{ lat: number; lng: number }>): string {
  if (!waypoints.length) return ''
  return waypoints.map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join('|')
}

function fullCacheKey(from: Stop, to: Stop, waypoints: Array<{ lat: number; lng: number }>): string {
  const base = stopPairKey(from, to)
  const wp   = waypointsKey(waypoints)
  return wp ? `${base}@${wp}` : base
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDrivingInfo(stops: Stop[], routeLegs?: RouteLeg[]): (LegInfo | null)[] {
  const [legs, setLegs] = useState<(LegInfo | null)[]>([])
  const fetchIdRef = useRef(0)

  // Nøkkel som endres når lagrede waypoints oppdateres (etter drag)
  // Bruker updated_at slik at vi re-fetcher når brukeren drar ruten
  const routeLegsKey = (routeLegs ?? [])
    .map((l) => `${l.from_stop_id}-${l.to_stop_id}:${l.updated_at}`)
    .join(',')

  useEffect(() => {
    if (stops.length < 2) {
      setLegs([])
      return
    }

    const currentFetchId = ++fetchIdRef.current

    async function fetchLeg(from: Stop, to: Stop, waypoints: Array<{ lat: number; lng: number }>): Promise<LegInfo | null> {
      const key = fullCacheKey(from, to, waypoints)
      if (cache.has(key)) return cache.get(key)!

      try {
        let url = `/api/directions?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}`
        if (waypoints.length) {
          // Pipe-separerte "lat,lng"-par sendes til API-et
          url += `&waypoints=${waypoints.map((w) => `${w.lat},${w.lng}`).join('|')}`
        }
        const res = await fetch(url)
        if (!res.ok) return null
        const data: LegInfo = await res.json()
        cache.set(key, data)
        return data
      } catch {
        return null
      }
    }

    // Initier med null-verdier mens vi fetcher
    setLegs(new Array(stops.length - 1).fill(null))

    // Fetch alle benetapper parallelt, med eventuelle via-punkter
    Promise.all(
      stops.slice(1).map((to, i) => {
        const from = stops[i]
        const leg  = routeLegs?.find(
          (l) => l.from_stop_id === from.id && l.to_stop_id === to.id
        )
        return fetchLeg(from, to, leg?.waypoints ?? [])
      })
    ).then((results) => {
      if (fetchIdRef.current !== currentFetchId) return
      setLegs(results)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stops.map((s) => s.id).join(','),
    routeLegsKey,
  ])

  return legs
}

// Beregn ankomsttid basert på avreisetidspunkt + minutter kjøring
export function addMinutes(timeStr: string, minutes: number): string {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}
