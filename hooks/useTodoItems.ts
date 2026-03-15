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
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setItems(data ? (data as TodoItem[]) : [])
        setLoading(false)
      })
  }, [tripId, supabase])

  const addItem = useCallback(
    async (description: string, link: string | null, responsible: string): Promise<void> => {
      if (!tripId) return
      const optimistic: TodoItem = {
        id: crypto.randomUUID(),
        trip_id: tripId,
        description,
        link,
        responsible,
        completed: false,
        completed_at: null,
        created_at: new Date().toISOString(),
      }
      setItems((prev) => [...prev, optimistic])
      const { data, error } = await supabase
        .from('todo_items')
        .insert({ trip_id: tripId, description, link, responsible })
        .select()
        .single()
      if (error) {
        setItems((prev) => prev.filter((i) => i.id !== optimistic.id))
        toast.error('Kunne ikke legge til oppgave')
        return
      }
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? (data as TodoItem) : i)))
    },
    [tripId, supabase],
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

  const deleteItem = useCallback(
    async (id: string): Promise<void> => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('todo_items').delete().eq('id', id)
      if (error) toast.error('Kunne ikke slette oppgave')
    },
    [supabase],
  )

  return { items, loading, addItem, toggleItem, deleteItem }
}
