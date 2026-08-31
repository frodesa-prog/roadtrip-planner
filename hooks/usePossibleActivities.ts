'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PossibleActivity } from '@/types'
import { toast } from 'sonner'

export type AddPossibleActivityData = Pick<PossibleActivity, 'description'> &
  Partial<Pick<PossibleActivity, 'url' | 'category' | 'notes' | 'map_lat' | 'map_lng' | 'activity_date' | 'activity_dates'>>

export type UpdatePossibleActivityData = Partial<Pick<PossibleActivity, 'description' | 'url' | 'category' | 'notes' | 'map_lat' | 'map_lng' | 'activity_date' | 'activity_dates'>>

// Module-level cache – keyed by sorted stop-ids string
const possibleCache = new Map<string, PossibleActivity[]>()

export function usePossibleActivities(stopIds: string[]) {
  const key = stopIds.slice().sort().join(',')
  const cached = key ? (possibleCache.get(key) ?? null) : null
  const [possibleActivities, setPossibleActivities] = useState<PossibleActivity[]>(cached ?? [])
  const supabase = useMemo(() => createClient(), [])

  const setAndCache = useCallback((updater: PossibleActivity[] | ((prev: PossibleActivity[]) => PossibleActivity[])) => {
    setPossibleActivities((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (key) possibleCache.set(key, next)
      return next
    })
  }, [key])

  useEffect(() => {
    if (stopIds.length === 0) {
      setPossibleActivities([])
      return
    }
    supabase
      .from('possible_activities')
      .select('*')
      .in('stop_id', stopIds)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          possibleCache.set(key, data as PossibleActivity[])
          setPossibleActivities(data as PossibleActivity[])
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase])

  const addPossibleActivity = useCallback(
    async (stopId: string, data: AddPossibleActivityData) => {
      const newEntry: PossibleActivity = {
        id: crypto.randomUUID(),
        stop_id: stopId,
        description: data.description,
        url: data.url ?? null,
        category: data.category ?? null,
        notes: data.notes ?? null,
        map_lat: data.map_lat ?? null,
        map_lng: data.map_lng ?? null,
        activity_date: data.activity_date ?? null,
        activity_dates: data.activity_dates ?? [],
      }
      setAndCache((prev) => [...prev, newEntry])
      const { error } = await supabase.from('possible_activities').insert(newEntry)
      if (error) {
        setAndCache((prev) => prev.filter((a) => a.id !== newEntry.id))
        toast.error('Kunne ikke lagre mulig aktivitet')
      }
    },
    [supabase, setAndCache]
  )

  const removePossibleActivity = useCallback(
    async (id: string) => {
      const snapshot = possibleCache.get(key) ?? possibleActivities
      setAndCache((prev) => prev.filter((a) => a.id !== id))
      const { error } = await supabase.from('possible_activities').delete().eq('id', id)
      if (error) {
        setAndCache(snapshot)
        toast.error('Kunne ikke slette mulig aktivitet')
      }
    },
    [possibleActivities, supabase, setAndCache, key]
  )

  const updatePossibleActivity = useCallback(
    async (id: string, updates: UpdatePossibleActivityData) => {
      setAndCache((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
      const { error } = await supabase.from('possible_activities').update(updates).eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere mulig aktivitet')
    },
    [supabase, setAndCache]
  )

  return { possibleActivities, addPossibleActivity, removePossibleActivity, updatePossibleActivity }
}
