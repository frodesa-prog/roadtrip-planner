'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Note } from '@/types'
import { toast } from 'sonner'

export type NoteInput = Pick<Note, 'content' | 'title' | 'stop_id' | 'note_date'> &
  Partial<Pick<Note, 'activity_id' | 'dining_id' | 'possible_activity_id'>>

// Module-level cache – keyed by tripId
const notesCache = new Map<string, Note[]>()

export function useNotes(tripId: string | null) {
  const cached = tripId ? (notesCache.get(tripId) ?? null) : null
  const [notes, setNotes] = useState<Note[]>(cached ?? [])
  const supabase = useMemo(() => createClient(), [])

  const setAndCache = useCallback((updater: Note[] | ((prev: Note[]) => Note[])) => {
    setNotes((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (tripId) notesCache.set(tripId, next)
      return next
    })
  }, [tripId])

  useEffect(() => {
    if (!tripId) { setNotes([]); return }
    supabase
      .from('notes')
      .select('*')
      .eq('trip_id', tripId)
      .is('archived_at', null)
      .order('created_at')
      .then(({ data }) => {
        if (data) {
          notesCache.set(tripId, data as Note[])
          setNotes(data as Note[])
        }
      })
  }, [tripId, supabase])

  const addNote = useCallback(async (data: NoteInput): Promise<Note | null> => {
    if (!tripId) return null
    const optimistic: Note = {
      id: crypto.randomUUID(),
      trip_id: tripId,
      activity_id: null,
      dining_id: null,
      possible_activity_id: null,
      ...data,
      archived_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setAndCache((prev) => [...prev, optimistic])
    const { data: created, error } = await supabase
      .from('notes')
      .insert({ trip_id: tripId, ...data })
      .select()
      .single()
    if (error) {
      setAndCache((prev) => prev.filter((n) => n.id !== optimistic.id))
      toast.error('Kunne ikke lagre notat')
      return null
    }
    setAndCache((prev) => prev.map((n) => n.id === optimistic.id ? created as Note : n))
    return created as Note
  }, [tripId, supabase, setAndCache])

  const updateNote = useCallback(async (id: string, data: Partial<NoteInput>) => {
    setAndCache((prev) => prev.map((n) => n.id === id ? { ...n, ...data } : n))
    const { error } = await supabase
      .from('notes')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) toast.error('Kunne ikke oppdatere notat')
  }, [supabase, setAndCache])

  const archiveNote = useCallback(async (id: string) => {
    setAndCache((prev) => prev.filter((n) => n.id !== id))
    const { error } = await supabase
      .from('notes')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
    if (error) toast.error('Kunne ikke arkivere notat')
  }, [supabase, setAndCache])

  const deleteNote = useCallback(async (id: string) => {
    setAndCache((prev) => prev.filter((n) => n.id !== id))
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) toast.error('Kunne ikke slette notat')
  }, [supabase, setAndCache])

  return { notes, addNote, updateNote, archiveNote, deleteNote }
}

// ─── Archived notes (for the archive page) ───────────────────────────────────

export function useArchivedNotes(tripId: string | null) {
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!tripId) { setArchivedNotes([]); return }
    supabase
      .from('notes')
      .select('*')
      .eq('trip_id', tripId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
      .then(({ data }) => { if (data) setArchivedNotes(data as Note[]) })
  }, [tripId, supabase])

  const deleteNotePermanently = useCallback(async (id: string) => {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== id))
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) toast.error('Kunne ikke slette notat')
  }, [supabase])

  const restoreNote = useCallback(async (id: string) => {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== id))
    const { error } = await supabase
      .from('notes')
      .update({ archived_at: null })
      .eq('id', id)
    if (error) toast.error('Kunne ikke gjenopprette notat')
  }, [supabase])

  const deleteAllPermanently = useCallback(async (): Promise<boolean> => {
    if (!tripId) return false
    const snapshot = archivedNotes
    setArchivedNotes([])
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('trip_id', tripId)
      .not('archived_at', 'is', null)
    if (error) {
      setArchivedNotes(snapshot)
      toast.error('Kunne ikke slette arkivet')
      return false
    }
    toast.success('Arkivet er tømt')
    return true
  }, [tripId, archivedNotes, supabase])

  return { archivedNotes, deleteNotePermanently, restoreNote, deleteAllPermanently }
}
