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

export function useDining(stopIds: string[]) {
  const [dining, setDining] = useState<Dining[]>([])
  const supabase = useMemo(() => createClient(), [])

  const key = stopIds.join(',')

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
        if (data) setDining(data as Dining[])
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
      setDining((prev) => [...prev, newEntry])
      const { error } = await supabase.from('dining').insert(newEntry)
      if (error) {
        setDining((prev) => prev.filter((d) => d.id !== newEntry.id))
        toast.error('Kunne ikke lagre spisested')
      }
    },
    [supabase]
  )

  const removeDining = useCallback(
    async (id: string) => {
      const snapshot = dining
      setDining((prev) => prev.filter((d) => d.id !== id))
      const { error } = await supabase.from('dining').delete().eq('id', id)
      if (error) {
        setDining(snapshot)
        toast.error('Kunne ikke slette spisested')
      }
    },
    [dining, supabase]
  )

  const updateDining = useCallback(
    async (id: string, updates: UpdateDiningData) => {
      setDining((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
      )
      const { error } = await supabase.from('dining').update(updates).eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere spisested')
    },
    [supabase]
  )

  return { dining, addDining, removeDining, updateDining }
}
