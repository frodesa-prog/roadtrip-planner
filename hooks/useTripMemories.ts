'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TripMemory, MemoryEntry } from '@/types'
import { toast } from 'sonner'
import { nanoid } from 'nanoid'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemoryEntryPatch = Partial<Pick<MemoryEntry, 'diary_text' | 'highlight' | 'mood_emoji'>>

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTripMemories(tripId: string | null) {
  const [memory, setMemory]   = useState<TripMemory | null>(null)
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tripId) { setMemory(null); setEntries([]); return }

    setLoading(true)
    supabase
      .from('trip_memories')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle()
      .then(async ({ data: mem }) => {
        if (!mem) { setMemory(null); setEntries([]); setLoading(false); return }
        setMemory(mem as TripMemory)

        const { data: ents } = await supabase
          .from('memory_entries')
          .select('*')
          .eq('memory_id', mem.id)
          .order('stop_order', { ascending: true })

        setEntries((ents ?? []) as MemoryEntry[])
        setLoading(false)
      })
  }, [tripId, supabase])

  // ── Create memory book ────────────────────────────────────────────────────

  const createMemory = useCallback(async (tripName: string): Promise<TripMemory | null> => {
    if (!tripId) return null

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    let slug = nanoid(10)

    const { data, error } = await supabase
      .from('trip_memories')
      .insert({
        trip_id:    tripId,
        created_by: user.id,
        title:      tripName,
        public_slug: slug,
      })
      .select()
      .single()

    if (error) {
      // Slug collision retry (extremely rare)
      if (error.code === '23505') {
        slug = nanoid(10)
        const { data: d2, error: e2 } = await supabase
          .from('trip_memories')
          .insert({ trip_id: tripId, created_by: user.id, title: tripName, public_slug: slug })
          .select().single()
        if (e2) { toast.error('Kunne ikke opprette minnebok'); return null }
        setMemory(d2 as TripMemory)
        return d2 as TripMemory
      }
      toast.error('Kunne ikke opprette minnebok')
      return null
    }

    setMemory(data as TripMemory)
    return data as TripMemory
  }, [tripId, supabase])

  // ── Update memory book ────────────────────────────────────────────────────

  const updateMemory = useCallback(async (patch: Partial<TripMemory>) => {
    if (!memory) return
    setMemory((prev) => prev ? { ...prev, ...patch } : prev)

    const { error } = await supabase
      .from('trip_memories')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', memory.id)

    if (error) {
      toast.error('Kunne ikke lagre endring')
    }
  }, [memory, supabase])

  // ── Toggle public ─────────────────────────────────────────────────────────

  const togglePublic = useCallback(async () => {
    if (!memory) return
    await updateMemory({ is_public: !memory.is_public })
  }, [memory, updateMemory])

  // ── Update entry (debounced auto-save) ────────────────────────────────────

  const updateEntry = useCallback((entryId: string, patch: MemoryEntryPatch) => {
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) => e.id === entryId ? { ...e, ...patch } : e)
    )

    // Clear existing timer for this entry
    const existing = debounceTimers.current.get(entryId)
    if (existing) clearTimeout(existing)

    // Debounce DB write 1500 ms
    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from('memory_entries')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', entryId)

      if (error) toast.error('Kunne ikke lagre dagbokinnføring')
      debounceTimers.current.delete(entryId)
    }, 1500)

    debounceTimers.current.set(entryId, timer)
  }, [supabase])

  // ── Generate with AI ──────────────────────────────────────────────────────

  const generateMemory = useCallback(async (): Promise<boolean> => {
    if (!tripId || !memory) return false
    setGenerating(true)

    try {
      const res = await fetch('/api/minner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, memoryId: memory.id }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Generering feilet')
        return false
      }

      const { summary, entries: newEntries, stats } = await res.json()

      // Refresh memory + entries from DB after generation
      const { data: updatedMem } = await supabase
        .from('trip_memories')
        .select('*')
        .eq('id', memory.id)
        .single()

      if (updatedMem) setMemory(updatedMem as TripMemory)

      const { data: updatedEntries } = await supabase
        .from('memory_entries')
        .select('*')
        .eq('memory_id', memory.id)
        .order('stop_order', { ascending: true })

      if (updatedEntries) setEntries(updatedEntries as MemoryEntry[])

      toast.success('Minnebok generert!')
      return true
    } catch {
      toast.error('Noe gikk galt under generering')
      return false
    } finally {
      setGenerating(false)
    }
  }, [tripId, memory, supabase])

  // ── Delete memory book ────────────────────────────────────────────────────

  const deleteMemory = useCallback(async () => {
    if (!memory) return
    const { error } = await supabase.from('trip_memories').delete().eq('id', memory.id)
    if (error) { toast.error('Kunne ikke slette minnebok'); return }
    setMemory(null)
    setEntries([])
    toast.success('Minnebok slettet')
  }, [memory, supabase])

  return {
    memory,
    entries,
    loading,
    generating,
    createMemory,
    updateMemory,
    updateEntry,
    togglePublic,
    generateMemory,
    deleteMemory,
  }
}
