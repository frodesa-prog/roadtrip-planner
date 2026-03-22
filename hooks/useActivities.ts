'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity } from '@/types'
import { toast } from 'sonner'

export type AddActivityData = Pick<Activity, 'name'> &
  Partial<Pick<Activity, 'url' | 'cost' | 'notes' | 'activity_date' | 'activity_time' | 'activity_type' |
    'stadium' | 'section' | 'seat_row' | 'seat' | 'map_lat' | 'map_lng'>>

export type UpdateActivityData = Partial<Pick<
  Activity,
  'name' | 'url' | 'cost' | 'notes' | 'activity_date' | 'activity_time' |
  'remaining_amount' | 'activity_type' | 'map_lat' | 'map_lng' |
  'stadium' | 'section' | 'seat_row' | 'seat'
>>

export function useActivities(stopIds: string[]) {
  const [activities, setActivities] = useState<Activity[]>([])
  const supabase = useMemo(() => createClient(), [])

  const key = stopIds.join(',')

  useEffect(() => {
    if (stopIds.length === 0) {
      setActivities([])
      return
    }
    supabase
      .from('activities')
      .select('*')
      .in('stop_id', stopIds)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setActivities(data as Activity[])
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supabase])

  const addActivity = useCallback(
    async (stopId: string, data: AddActivityData) => {
      const newActivity: Activity = {
        id: crypto.randomUUID(),
        stop_id: stopId,
        name: data.name,
        url: data.url ?? null,
        cost: data.cost ?? null,
        remaining_amount: null,
        notes: null,
        activity_date: data.activity_date ?? null,
        activity_time: data.activity_time ?? null,
        activity_type: data.activity_type ?? null,
        map_lat: data.map_lat ?? null,
        map_lng: data.map_lng ?? null,
        stadium:  data.stadium  ?? null,
        section:  data.section  ?? null,
        seat_row: data.seat_row ?? null,
        seat:     data.seat     ?? null,
      }
      setActivities((prev) => [...prev, newActivity])
      const { error } = await supabase.from('activities').insert(newActivity)
      if (error) {
        setActivities((prev) => prev.filter((a) => a.id !== newActivity.id))
        toast.error('Kunne ikke lagre aktivitet')
      }
    },
    [supabase]
  )

  const removeActivity = useCallback(
    async (id: string) => {
      const snapshot = activities
      setActivities((prev) => prev.filter((a) => a.id !== id))
      const { error } = await supabase.from('activities').delete().eq('id', id)
      if (error) {
        setActivities(snapshot)
        toast.error('Kunne ikke slette aktivitet')
      }
    },
    [activities, supabase]
  )

  const updateActivity = useCallback(
    async (id: string, updates: UpdateActivityData) => {
      setActivities((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
      )
      const { error } = await supabase.from('activities').update(updates).eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere aktivitet')
    },
    [supabase]
  )

  return { activities, addActivity, removeActivity, updateActivity }
}
