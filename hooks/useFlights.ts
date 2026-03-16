'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Flight } from '@/types'
import { toast } from 'sonner'

type FlightUpdates = Partial<Omit<Flight, 'id' | 'trip_id' | 'direction'>>

export function useFlights(tripId: string | null) {
  const [flights, setFlights] = useState<Flight[]>([])
  const supabase = useMemo(() => createClient(), [])

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
        if (data) setFlights(data as Flight[])
      })
  }, [tripId, supabase])

  /**
   * Upsert: creates the flight record the first time a field is saved,
   * and updates it on subsequent saves.  Uses unique(trip_id, direction)
   * as the conflict target so concurrent saves are safe.
   */
  const saveFlight = useCallback(
    async (direction: 'outbound' | 'return', updates: FlightUpdates) => {
      if (!tripId) return

      const existing = flights.find((f) => f.direction === direction)

      // Optimistic update
      if (existing) {
        setFlights((prev) =>
          prev.map((f) => (f.direction === direction ? { ...f, ...updates } : f))
        )
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
          ...updates,
        }
        setFlights((prev) => [...prev, newFlight])
      }

      // DB upsert – handles both insert and update gracefully
      const { error } = await supabase
        .from('flights')
        .upsert(
          { trip_id: tripId, direction, ...updates },
          { onConflict: 'trip_id,direction' }
        )

      if (error) {
        // Rollback
        setFlights((prev) =>
          existing
            ? prev.map((f) => (f.direction === direction ? existing : f))
            : prev.filter(
                (f) => !(f.trip_id === tripId && f.direction === direction)
              )
        )
        toast.error('Kunne ikke lagre flyinformasjon')
      }
    },
    [flights, tripId, supabase]
  )

  const outbound = flights.find((f) => f.direction === 'outbound') ?? null
  const returnFlight = flights.find((f) => f.direction === 'return') ?? null

  return { outbound, returnFlight, saveFlight }
}
