'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dining } from '@/types'
import { toast } from 'sonner'

export type AddDiningData = Pick<Dining, 'name'> &
  Partial<Pick<Dining, 'url' | 'notes' | 'booking_date' | 'booking_time' | 'map_lat' | 'map_lng'>>

export type UpdateDiningData = Partial<Pick<
  Dining,
  'name' | 'url' | 'notes' | 'booking_date' | 'booking_time' | 'map_lat' | 'map_lng'
>>

// Module-level cache – keyed by sorted stop-ids string
const diningCache = new Map<string, Dining[]>()

export function useDining(stopIds: string[]) {
  const key = stopIds.slice().sort().join(',')
  const cached = key ? (diningCache.get(key) ?? null) : null
  const [dining, setDining] = useState<Dining[]>(cached ?? [])
  const supabase = useMemo(() => createClient(), [])

  const setAndCache = useCallback((updater: Dining[] | ((prev: Dining[]) => Dining[])) => {
    setDining((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (key) diningCache.set(key, next)
      return next
    })
  }, [key])

  useEffect(() => {
    if (stopIds.length === 0) {
      setDining([])
      return
    }
    supabase
      .from('dining')
      .select('*')
      .in('stop_id', stopIds)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          diningCache.set(key, data as Dining[])
          setDining(data as Dining[])
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase])

  const addDining = useCallback(
    async (stopId: string, data: AddDiningData) => {
      const newEntry: Dining = {
        id: crypto.randomUUID(),
        stop_id: stopId,
        name: data.name,
        url: data.url ?? null,
        notes: data.notes ?? null,
        booking_date: data.booking_date ?? null,
        booking_time: data.booking_time ?? null,
        map_lat: data.map_lat ?? null,
        map_lng: data.map_lng ?? null,
      }
      setAndCache((prev) => [...prev, newEntry])
      const { error } = await supabase.from('dining').insert(newEntry)
      if (error) {
        setAndCache((prev) => prev.filter((d) => d.id !== newEntry.id))
        toast.error('Kunne ikke lagre spisested')
      }
    },
    [supabase, setAndCache]
  )

  const removeDining = useCallback(
    async (id: string) => {
      const snapshot = diningCache.get(key) ?? dining
      setAndCache((prev) => prev.filter((d) => d.id !== id))
      const { error } = await supabase.from('dining').delete().eq('id', id)
      if (error) {
        setAndCache(snapshot)
        toast.error('Kunne ikke slette spisested')
      }
    },
    [dining, supabase, setAndCache, key]
  )

  const updateDining = useCallback(
    async (id: string, updates: UpdateDiningData) => {
      setAndCache((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)))
      const { error } = await supabase.from('dining').update(updates).eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere spisested')
    },
    [supabase, setAndCache]
  )

  return { dining, addDining, removeDining, updateDining }
}
