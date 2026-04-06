'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExpenseEntry } from '@/types'
import { toast } from 'sonner'

type NewEntryData = Omit<ExpenseEntry, 'id' | 'created_at'>

export function useExpenseEntries(tripId: string | null) {
  const [entries, setEntries] = useState<ExpenseEntry[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) {
      setEntries([])
      return
    }
    supabase
      .from('expense_entries')
      .select('*')
      .eq('trip_id', tripId)
      .order('entry_date', { ascending: true })
      .then(({ data }) => {
        if (data) setEntries(data as ExpenseEntry[])
      })
  }, [tripId, supabase])

  const addEntry = useCallback(
    async (data: NewEntryData) => {
      const id = crypto.randomUUID()
      const optimistic: ExpenseEntry = {
        id,
        created_at: new Date().toISOString(),
        ...data,
      }
      setEntries((prev) => [...prev, optimistic])

      // Send only the columns the DB expects — omit created_at so the
      // server-side DEFAULT now() is used and avoids any type mismatch.
      const { error } = await supabase.from('expense_entries').insert({
        id,
        trip_id:     data.trip_id,
        category:    data.category,
        entry_date:  data.entry_date,
        name:        data.name,
        amount:      data.amount,
        stop_id:     data.stop_id,
        activity_id: data.activity_id,
        dining_id:   data.dining_id,
      })
      if (error) {
        console.error('[useExpenseEntries] insert error:', error)
        setEntries((prev) => prev.filter((e) => e.id !== id))
        toast.error(`Kunne ikke lagre utgift: ${error.message}`)
      }
    },
    [supabase]
  )

  const removeEntry = useCallback(
    async (id: string) => {
      const snapshot = entries
      setEntries((prev) => prev.filter((e) => e.id !== id))
      const { error } = await supabase.from('expense_entries').delete().eq('id', id)
      if (error) {
        setEntries(snapshot)
        toast.error('Kunne ikke slette utgift')
      }
    },
    [entries, supabase]
  )

  /** Sum of amounts for a given category */
  function totalFor(category: ExpenseEntry['category']): number {
    return entries
      .filter((e) => e.category === category)
      .reduce((s, e) => s + e.amount, 0)
  }

  /** Entries filtered by category */
  function entriesFor(category: ExpenseEntry['category']): ExpenseEntry[] {
    return entries.filter((e) => e.category === category)
  }

  return { entries, addEntry, removeEntry, totalFor, entriesFor }
}
