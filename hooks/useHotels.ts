'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hotel, BookingStatus } from '@/types'
import { toast } from 'sonner'

// Module-level cache – keyed by sorted stop-ids string
const hotelsCache = new Map<string, Hotel[]>()

export function useHotels(stopIds: string[]) {
  const key = stopIds.slice().sort().join(',')
  const cached = key ? (hotelsCache.get(key) ?? null) : null
  const [hotels, setHotels] = useState<Hotel[]>(cached ?? [])
  const [loading, setLoading] = useState(key ? cached === null : false)
  const supabase = useMemo(() => createClient(), [])

  const setAndCache = useCallback((updater: Hotel[] | ((prev: Hotel[]) => Hotel[])) => {
    setHotels((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (key) hotelsCache.set(key, next)
      return next
    })
  }, [key])

  useEffect(() => {
    if (stopIds.length === 0) {
      setHotels([])
      setLoading(false)
      return
    }
    if (!hotelsCache.has(key)) setLoading(true)
    supabase
      .from('hotels')
      .select('*')
      .in('stop_id', stopIds)
      .then(({ data }) => {
        if (data) {
          hotelsCache.set(key, data as Hotel[])
          setHotels(data as Hotel[])
        }
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase])

  const saveHotel = useCallback(
    async (
      stopId: string,
      updates: Partial<Pick<Hotel, 'name' | 'address' | 'url' | 'status' | 'cost' | 'remaining_amount' | 'parking_cost_per_night' | 'has_washer' | 'has_kitchen' | 'has_breakfast'>>
    ) => {
      const existing = hotels.find((h) => h.stop_id === stopId)

      if (existing) {
        setAndCache((prev) => prev.map((h) => (h.stop_id === stopId ? { ...h, ...updates } : h)))
        const { error } = await supabase.from('hotels').update(updates).eq('id', existing.id)
        if (error) {
          setAndCache((prev) => prev.map((h) => (h.stop_id === stopId ? existing : h)))
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
          has_washer: updates.has_washer ?? null,
          has_kitchen: updates.has_kitchen ?? null,
          has_breakfast: updates.has_breakfast ?? null,
        }
        setAndCache((prev) => [...prev, newHotel])
        const { error } = await supabase.from('hotels').insert(newHotel)
        if (error) {
          setAndCache((prev) => prev.filter((h) => h.id !== newHotel.id))
          toast.error('Kunne ikke lagre hotell')
        }
      }
    },
    [hotels, supabase, setAndCache]
  )

  return { hotels, saveHotel, loading }
}
