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
        .order('sort_order', { ascending: true })

      if (existing && existing.length > 0) {
        setItems(existing as TripPackingItem[])
        setLoading(false)
        return
      }

      // Ingen elementer ennå – prøv å forhåndsutfylle fra brukerens standardliste
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

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
      const insertData = (defaults as DefaultPackingItem[]).map((d, i) => ({
        trip_id: tripId,
        traveler_id: travelerId,
        item: d.item,
        category: d.category,
        packed: false,
        sort_order: i,
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
      // Sett sort_order til høyeste eksisterende + 1 i samme gruppe
      const groupItems = items.filter(
        (i) => i.traveler_id === travelerId && i.category === category,
      )
      const nextOrder = groupItems.length > 0
        ? Math.max(...groupItems.map((i) => i.sort_order)) + 1
        : 0

      const optimistic: TripPackingItem = {
        id: crypto.randomUUID(),
        trip_id: tripId,
        traveler_id: travelerId,
        item,
        category,
        packed: false,
        sort_order: nextOrder,
        created_at: new Date().toISOString(),
      }
      setItems((prev) => [...prev, optimistic])
      const { data, error } = await supabase
        .from('trip_packing_items')
        .insert({ trip_id: tripId, traveler_id: travelerId, item, category, sort_order: nextOrder })
        .select()
        .single()
      if (error) {
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
        toast.error('Kunne ikke legge til element')
        return
      }
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? (data as TripPackingItem) : i)))
    },
    [tripId, items, supabase],
  )

  const updateItem = useCallback(
    async (id: string, newText: string): Promise<void> => {
      if (!newText.trim()) return
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, item: newText.trim() } : i)))
      const { error } = await supabase
        .from('trip_packing_items')
        .update({ item: newText.trim() })
        .eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere element')
    },
    [supabase],
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

  const moveItem = useCallback(
    async (id: string, direction: 'up' | 'down'): Promise<void> => {
      const item = items.find((i) => i.id === id)
      if (!item) return

      // Grupper etter samme traveler + kategori (kun upacked)
      const group = items
        .filter(
          (i) =>
            i.traveler_id === item.traveler_id &&
            i.category === item.category &&
            !i.packed,
        )
        .sort((a, b) => a.sort_order - b.sort_order)

      const idx = group.findIndex((i) => i.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= group.length) return

      const swapItem = group[swapIdx]
      const newOrder = swapItem.sort_order
      const swapOrder = item.sort_order

      setItems((prev) =>
        prev.map((i) => {
          if (i.id === id) return { ...i, sort_order: newOrder }
          if (i.id === swapItem.id) return { ...i, sort_order: swapOrder }
          return i
        }),
      )

      await Promise.all([
        supabase.from('trip_packing_items').update({ sort_order: newOrder }).eq('id', id),
        supabase.from('trip_packing_items').update({ sort_order: swapOrder }).eq('id', swapItem.id),
      ])
    },
    [items, supabase],
  )

  const deleteItem = useCallback(
    async (id: string): Promise<void> => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('trip_packing_items').delete().eq('id', id)
      if (error) toast.error('Kunne ikke slette element')
    },
    [supabase],
  )

  return { items, loading, addItem, updateItem, togglePacked, moveItem, deleteItem }
}
