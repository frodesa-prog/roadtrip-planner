'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Note } from '@/types'
import { toast } from 'sonner'

export function useNotes(tripId: string | null) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const loadNotes = useCallback(async () => {
    if (!tripId) { setNotes([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
    if (data) setNotes(data as Note[])
    setLoading(false)
  }, [tripId, supabase])

  useEffect(() => { loadNotes() }, [loadNotes])

  const addNote = useCallback(async () => {
    if (!tripId) return null
    const newNote: Note = {
      id: crypto.randomUUID(),
      trip_id: tripId,
      title: null,
      content: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setNotes((prev) => [newNote, ...prev])
    const { error } = await supabase.from('notes').insert(newNote)
    if (error) {
      setNotes((prev) => prev.filter((n) => n.id !== newNote.id))
      toast.error('Kunne ikke opprette notat')
      return null
    }
    return newNote
  }, [tripId, supabase])

  const updateNote = useCallback(
    async (id: string, updates: Partial<Pick<Note, 'title' | 'content'>>) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n
        )
      )
      const { error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) toast.error('Kunne ikke lagre notat')
    },
    [supabase]
  )

  const deleteNote = useCallback(
    async (id: string) => {
      const snapshot = notes
      setNotes((prev) => prev.filter((n) => n.id !== id))
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) {
        setNotes(snapshot)
        toast.error('Kunne ikke slette notat')
      }
    },
    [notes, supabase]
  )

  return { notes, loading, addNote, updateNote, deleteNote }
}
