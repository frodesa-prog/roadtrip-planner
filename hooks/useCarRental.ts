'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CarRental } from '@/types'
import { toast } from 'sonner'

type RentalUpdates = Partial<Omit<CarRental, 'id' | 'trip_id'>>

export function useCarRental(tripId: string | null) {
  const [rental, setRental] = useState<CarRental | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) {
      setRental(null)
      return
    }
    supabase
      .from('car_rentals')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRental(data as CarRental)
      })
  }, [tripId, supabase])

  const saveRental = useCallback(
    async (updates: RentalUpdates) => {
      if (!tripId) return
      const prev = rental

      // Optimistic update
      setRental((cur) =>
        cur
          ? { ...cur, ...updates }
          : {
              id: '',
              trip_id: tripId,
              company: null,
              car_type: null,
              reference_nr: null,
              confirmation_nr: null,
              url: null,
              notes: null,
              km_start: null,
              km_end: null,
              ...updates,
            }
      )

      const { data, error } = await supabase
        .from('car_rentals')
        .upsert({ trip_id: tripId, ...updates }, { onConflict: 'trip_id' })
        .select()
        .maybeSingle()

      if (error) {
        setRental(prev)
        toast.error('Kunne ikke lagre leiebilinfo')
      } else if (data) {
        setRental(data as CarRental)
      }
    },
    [rental, tripId, supabase]
  )

  return { rental, saveRental }
}
