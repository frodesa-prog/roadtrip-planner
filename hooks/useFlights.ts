'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Flight } from '@/types'
import { toast } from 'sonner'

type FlightUpdates = Partial<Omit<Flight, 'id' | 'trip_id' | 'direction'>>

// Module-level cache – keyed by tripId
const flightsCache = new Map<string, Flight[]>()

export function useFlights(tripId: string | null) {
  const cached = tripId ? (flightsCache.get(tripId) ?? null) : null
  const [flights, setFlights] = useState<Flight[]>(cached ?? [])
  const supabase = useMemo(() => createClient(), [])

  const setAndCache = useCallback((updater: Flight[] | ((prev: Flight[]) => Flight[])) => {
    setFlights((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (tripId) flightsCache.set(tripId, next)
      return next
    })
  }, [tripId])

  useEffect(() => {
    if (!tripId) {
      setFlights([])
      return
    }
    supabase
      .from('flights')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data }) => {
        if (data) {
          flightsCache.set(tripId, data as Flight[])
          setFlights(data as Flight[])
        }
      })
  }, [tripId, supabase])

  const saveFlight = useCallback(
    async (direction: 'outbound' | 'return', updates: FlightUpdates) => {
      if (!tripId) return

      const existing = flights.find((f) => f.direction === direction)

      if (existing) {
        setAndCache((prev) => prev.map((f) => (f.direction === direction ? { ...f, ...updates } : f)))
      } else {
        const newFlight: Flight = {
          id: crypto.randomUUID(),
          trip_id: tripId,
          direction,
          flight_date: null,
          leg1_from: null,
          leg1_departure: null,
          leg1_flight_nr: null,
          leg1_to: null,
          leg1_arrival: null,
          has_stopover: false,
          stopover_duration: null,
          leg2_flight_nr: null,
          leg2_departure: null,
          leg2_to: null,
          leg2_arrival: null,
          ticket_class: null,
          seat_row: null,
          seat_number: null,
          leg2_ticket_class: null,
          leg2_seat_row: null,
          leg2_seat_number: null,
          has_second_stopover: false,
          leg3_flight_nr: null,
          leg3_departure: null,
          leg3_to: null,
          leg3_arrival: null,
          leg3_ticket_class: null,
          leg3_seat_row: null,
          leg3_seat_number: null,
          ...updates,
        }
        setAndCache((prev) => [...prev, newFlight])
      }

      const { error } = await supabase
        .from('flights')
        .upsert(
          { trip_id: tripId, direction, ...updates },
          { onConflict: 'trip_id,direction' }
        )

      if (error) {
        setAndCache((prev) =>
          existing
            ? prev.map((f) => (f.direction === direction ? existing : f))
            : prev.filter((f) => !(f.trip_id === tripId && f.direction === direction))
        )
        toast.error('Kunne ikke lagre flyinformasjon')
      }
    },
    [flights, tripId, supabase, setAndCache]
  )

  const outbound = flights.find((f) => f.direction === 'outbound') ?? null
  const returnFlight = flights.find((f) => f.direction === 'return') ?? null

  return { outbound, returnFlight, saveFlight }
}
