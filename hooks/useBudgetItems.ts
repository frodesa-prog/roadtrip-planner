'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BudgetItem } from '@/types'
import { toast } from 'sonner'

export function useBudgetItems(tripId: string | null) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) {
      setItems([])
      return
    }
    supabase
      .from('budget_items')
      .select('*')
      .eq('trip_id', tripId)
      .then(({ data }) => {
        if (data) setItems(data as BudgetItem[])
      })
  }, [tripId, supabase])

  /** Upsert a category amount for the current trip */
  const saveItem = useCallback(
    async (category: BudgetItem['category'], amount: number) => {
      if (!tripId) return
      const existing = items.find((i) => i.category === category)

      if (existing) {
        setItems((prev) =>
          prev.map((i) => (i.category === category ? { ...i, amount } : i))
        )
        const { error } = await supabase
          .from('budget_items')
          .update({ amount })
          .eq('id', existing.id)
        if (error) {
          setItems((prev) =>
            prev.map((i) => (i.category === category ? existing : i))
          )
          toast.error('Kunne ikke lagre')
        }
      } else {
        const newItem: BudgetItem = {
          id: crypto.randomUUID(),
          trip_id: tripId,
          category,
          amount,
          notes: null,
        }
        setItems((prev) => [...prev, newItem])
        const { error } = await supabase.from('budget_items').insert(newItem)
        if (error) {
          setItems((prev) => prev.filter((i) => i.id !== newItem.id))
          toast.error('Kunne ikke lagre')
        }
      }
    },
    [items, tripId, supabase]
  )

  /** Get the stored amount for a category (0 if not set) */
  function getAmount(category: BudgetItem['category']): number {
    return items.find((i) => i.category === category)?.amount ?? 0
  }

  return { items, saveItem, getAmount }
}
