'use client'

import { useState, useEffect, useRef } from 'react'
import { Stop } from '@/types'

export interface LegInfo {
  distanceKm: number
  durationMinutes: number
  distanceText: string
  durationText: string
}

// Enkel in-memory cache – overlever re-renders men ikke page reload
const cache = new Map<string, LegInfo>()

function cacheKey(from: Stop, to: Stop) {
  return `${from.lat.toFixed(4)},${from.lng.toFixed(4)}->${to.lat.toFixed(4)},${to.lng.toFixed(4)}`
}

export function useDrivingInfo(stops: Stop[]): (LegInfo | null)[] {
  const [legs, setLegs] = useState<(LegInfo | null)[]>([])
  // Brukes for å unngå at foreldede fetches overskriver ny state
  const fetchIdRef = useRef(0)

  useEffect(() => {
    if (stops.length < 2) {
      setLegs([])
      return
    }

    const currentFetchId = ++fetchIdRef.current

    async function fetchLeg(from: Stop, to: Stop): Promise<LegInfo | null> {
      const key = cacheKey(from, to)
      if (cache.has(key)) return cache.get(key)!

      try {
        const res = await fetch(
          `/api/directions?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}`
        )
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

    // Fetch alle benetapper parallelt
    Promise.all(
      stops.slice(1).map((stop, i) => fetchLeg(stops[i], stop))
    ).then((results) => {
      // Kast resultater fra foreldede kall
      if (fetchIdRef.current !== currentFetchId) return
      setLegs(results)
    })
  }, [
    // Avheng av faktiske koordinater, ikke array-referansen
    // eslint-disable-next-line react-hooks/exhaustive-deps
    stops.map((s) => `${s.id}`).join(','),
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
