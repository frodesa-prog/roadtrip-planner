'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hotel, BookingStatus } from '@/types'
import { toast } from 'sonner'

export function useHotels(stopIds: string[]) {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const supabase = useMemo(() => createClient(), [])

  // Stringify the stop IDs to use as a stable dependency
  const key = stopIds.join(',')

  useEffect(() => {
    if (stopIds.length === 0) {
      setHotels([])
      return
    }
    supabase
      .from('hotels')
      .select('*')
      .in('stop_id', stopIds)
      .then(({ data }) => {
        if (data) setHotels(data as Hotel[])
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase])

  /**
   * Upsert: if a hotel already exists for this stop, update it.
   * Otherwise, insert a new one.
   */
  const saveHotel = useCallback(
    async (
      stopId: string,
      updates: Partial<Pick<Hotel, 'name' | 'address' | 'url' | 'status' | 'cost' | 'remaining_amount' | 'parking_cost_per_night'>>
    ) => {
      const existing = hotels.find((h) => h.stop_id === stopId)

      if (existing) {
        // Optimistic update
        setHotels((prev) =>
          prev.map((h) => (h.stop_id === stopId ? { ...h, ...updates } : h))
        )
        const { error } = await supabase
          .from('hotels')
          .update(updates)
          .eq('id', existing.id)
        if (error) {
          // Rollback
          setHotels((prev) =>
            prev.map((h) => (h.stop_id === stopId ? existing : h))
          )
          toast.error('Kunne ikke lagre hotell')
        }
      } else {
        const newHotel: Hotel = {
          id: crypto.randomUUID(),
          stop_id: stopId,
          name: updates.name ?? '',
          address: updates.address ?? null,
          url: updates.url ?? null,
          status: (updates.status ?? 'not_booked') as BookingStatus,
          cost: updates.cost ?? null,
          remaining_amount: updates.remaining_amount ?? null,
          confirmation_number: null,
          parking_cost_per_night: updates.parking_cost_per_night ?? null,
        }
        // Optimistic add
        setHotels((prev) => [...prev, newHotel])
        const { error } = await supabase.from('hotels').insert(newHotel)
        if (error) {
          setHotels((prev) => prev.filter((h) => h.id !== newHotel.id))
          toast.error('Kunne ikke lagre hotell')
        }
      }
    },
    [hotels, supabase]
  )

  return { hotels, saveHotel }
}
