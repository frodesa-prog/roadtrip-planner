'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripPackingItem, PackingCategory, DefaultPackingItem } from '@/types'
import { toast } from 'sonner'

export function useTripPackingList(tripId: string | null) {
  const [items, setItems] = useState<TripPackingItem[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) { setItems([]); return }
    setLoading(true)

    async function load() {
      const { data: existing } = await supabase
        .from('trip_packing_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })

      if (existing && existing.length > 0) {
        setItems(existing as TripPackingItem[])
        setLoading(false)
        return
      }

      // Ingen elementer ennå – prøv å forhåndsutfylle fra brukerens standardliste
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Finn reisendes knyttet til innlogget bruker
      const { data: travelerData } = await supabase
        .from('travelers')
        .select('id')
        .eq('trip_id', tripId)
        .eq('linked_user_id', user.id)
        .maybeSingle()

      const { data: defaults } = await supabase
        .from('default_packing_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at')

      if (!defaults || defaults.length === 0) { setLoading(false); return }

      const travelerId = (travelerData as { id: string } | null)?.id ?? null
      const insertData = (defaults as DefaultPackingItem[]).map((d) => ({
        trip_id: tripId,
        traveler_id: travelerId,
        item: d.item,
        category: d.category,
        packed: false,
      }))

      const { data: inserted } = await supabase
        .from('trip_packing_items')
        .insert(insertData)
        .select()

      if (inserted) setItems(inserted as TripPackingItem[])
      setLoading(false)
    }

    load()
  }, [tripId, supabase])

  const addItem = useCallback(
    async (item: string, category: PackingCategory, travelerId: string | null): Promise<void> => {
      if (!tripId) return
      const optimistic: TripPackingItem = {
        id: crypto.randomUUID(),
        trip_id: tripId,
        traveler_id: travelerId,
        item,
        category,
        packed: false,
        created_at: new Date().toISOString(),
      }
      setItems((prev) => [...prev, optimistic])
      const { data, error } = await supabase
        .from('trip_packing_items')
        .insert({ trip_id: tripId, traveler_id: travelerId, item, category })
        .select()
        .single()
      if (error) {
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
        toast.error('Kunne ikke legge til element')
        return
      }
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? (data as TripPackingItem) : i)))
    },
    [tripId, supabase],
  )

  const togglePacked = useCallback(
    async (id: string, packed: boolean): Promise<void> => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, packed } : i)))
      const { error } = await supabase
        .from('trip_packing_items')
        .update({ packed })
        .eq('id', id)
      if (error) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, packed: !packed } : i)))
        toast.error('Kunne ikke oppdatere element')
      }
    },
    [supabase],
  )

  const deleteItem = useCallback(
    async (id: string): Promise<void> => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('trip_packing_items').delete().eq('id', id)
      if (error) toast.error('Kunne ikke slette element')
    },
    [supabase],
  )

  return { items, loading, addItem, togglePacked, deleteItem }
}
