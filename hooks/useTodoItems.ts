'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TodoItem } from '@/types'
import { toast } from 'sonner'

export function useTodoItems(tripId: string | null) {
  const [items, setItems] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) { setItems([]); return }
    setLoading(true)
    supabase
      .from('todo_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setItems(data ? (data as TodoItem[]) : [])
        setLoading(false)
      })
  }, [tripId, supabase])

  const addItem = useCallback(
    async (description: string, link: string | null, responsible: string): Promise<void> => {
      if (!tripId) return
      const groupItems = items.filter((i) => i.responsible === responsible)
      const nextOrder = groupItems.length > 0
        ? Math.max(...groupItems.map((i) => i.sort_order)) + 1
        : 0
      const optimistic: TodoItem = {
        id: crypto.randomUUID(),
        trip_id: tripId,
        description,
        link,
        responsible,
        completed: false,
        completed_at: null,
        sort_order: nextOrder,
        reminder_date: null,
        is_critical: false,
        created_at: new Date().toISOString(),
      }
      setItems((prev) => [...prev, optimistic])
      const { data, error } = await supabase
        .from('todo_items')
        .insert({ trip_id: tripId, description, link, responsible, sort_order: nextOrder })
        .select()
        .single()
      if (error) {
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
        toast.error('Kunne ikke legge til oppgave')
        return
      }
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? (data as TodoItem) : i)))
    },
    [tripId, items, supabase],
  )

  const updateItem = useCallback(
    async (id: string, description: string, link: string | null): Promise<void> => {
      if (!description.trim()) return
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, description: description.trim(), link } : i)),
      )
      const { error } = await supabase
        .from('todo_items')
        .update({ description: description.trim(), link })
        .eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere oppgave')
    },
    [supabase],
  )

  const toggleItem = useCallback(
    async (id: string, completed: boolean): Promise<void> => {
      const completedAt = completed ? new Date().toISOString() : null
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, completed, completed_at: completedAt } : i)),
      )
      const { error } = await supabase
        .from('todo_items')
        .update({ completed, completed_at: completedAt })
        .eq('id', id)
      if (error) {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, completed: !completed, completed_at: null } : i)),
        )
        toast.error('Kunne ikke oppdatere oppgave')
      }
    },
    [supabase],
  )

  const moveItem = useCallback(
    async (id: string, direction: 'up' | 'down'): Promise<void> => {
      const item = items.find((i) => i.id === id)
      if (!item) return
      const group = items
        .filter((i) => i.responsible === item.responsible && !i.completed)
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
        supabase.from('todo_items').update({ sort_order: newOrder }).eq('id', id),
        supabase.from('todo_items').update({ sort_order: swapOrder }).eq('id', swapItem.id),
      ])
    },
    [items, supabase],
  )

  const setReminder = useCallback(
    async (id: string, reminderDate: string | null): Promise<void> => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, reminder_date: reminderDate } : i)),
      )
      const { error } = await supabase
        .from('todo_items')
        .update({ reminder_date: reminderDate })
        .eq('id', id)
      if (error) toast.error('Kunne ikke sette påminnelse')
    },
    [supabase],
  )

  const toggleCritical = useCallback(
    async (id: string, critical: boolean): Promise<void> => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, is_critical: critical } : i)),
      )
      const { error } = await supabase
        .from('todo_items')
        .update({ is_critical: critical })
        .eq('id', id)
      if (error) toast.error('Kunne ikke oppdatere oppgave')
    },
    [supabase],
  )

  const deleteItem = useCallback(
    async (id: string): Promise<void> => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('todo_items').delete().eq('id', id)
      if (error) toast.error('Kunne ikke slette oppgave')
    },
    [supabase],
  )

  return { items, loading, addItem, updateItem, toggleItem, moveItem, setReminder, toggleCritical, deleteItem }
}
