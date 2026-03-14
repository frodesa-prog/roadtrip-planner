'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Note } from '@/types'
import { toast } from 'sonner'

type NoteInput = Pick<Note, 'content' | 'title' | 'stop_id' | 'note_date'>

export function useNotes(tripId: string | null) {
  const [notes, setNotes] = useState<Note[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) { setNotes([]); return }
    supabase
      .from('notes')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at')
      .then(({ data }) => { if (data) setNotes(data as Note[]) })
  }, [tripId, supabase])

  const addNote = useCallback(async (data: NoteInput): Promise<Note | null> => {
    if (!tripId) return null
    const optimistic: Note = {
      id: crypto.randomUUID(),
      trip_id: tripId,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setNotes((prev) => [...prev, optimistic])
    const { data: created, error } = await supabase
      .from('notes')
      .insert({ trip_id: tripId, ...data })
      .select()
      .single()
    if (error) {
      setNotes((prev) => prev.filter((n) => n.id !== optimistic.id))
      toast.error('Kunne ikke lagre notat')
      return null
    }
    setNotes((prev) => prev.map((n) => n.id === optimistic.id ? created as Note : n))
    return created as Note
  }, [tripId, supabase])

  const updateNote = useCallback(async (id: string, data: Partial<NoteInput>) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...data } : n))
    const { error } = await supabase
      .from('notes')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) toast.error('Kunne ikke oppdatere notat')
  }, [supabase])

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) toast.error('Kunne ikke slette notat')
  }, [supabase])

  return { notes, addNote, updateNote, deleteNote }
}
