'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import MemoryBookCard from '@/components/minner/MemoryBookCard'
import { Trip, TripMemory } from '@/types'
import { BookHeart, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function MinnebokerPage() {
  const [trips, setTrips]       = useState<Trip[]>([])
  const [memories, setMemories] = useState<TripMemory[]>([])
  const [loading, setLoading]   = useState(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => { document.title = 'Minnebøker' }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: tripsData }, { data: memoriesData }] = await Promise.all([
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
        supabase.from('trip_memories').select('*').order('created_at', { ascending: false }),
      ])

      setTrips((tripsData ?? []) as Trip[])
      setMemories((memoriesData ?? []) as TripMemory[])
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleGenerate(trip: Trip, existingMemory: TripMemory | null) {
    setGeneratingId(trip.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGeneratingId(null); return }

    let memory = existingMemory

    if (!memory) {
      const { nanoid } = await import('nanoid')
      const { data, error } = await supabase
        .from('trip_memories')
        .insert({
          trip_id:     trip.id,
          created_by:  user.id,
          title:       trip.name,
          public_slug: nanoid(10),
        })
        .select()
        .single()

      if (error || !data) { setGeneratingId(null); return }
      memory = data as TripMemory
      setMemories(prev => [memory!, ...prev])
    }

    const res = await fetch('/api/minner/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: trip.id, memoryId: memory.id }),
    })

    if (res.ok) {
      const { data: updated } = await supabase
        .from('trip_memories').select('*').eq('id', memory.id).single()
      if (updated) {
        setMemories(prev => prev.map(m => m.id === memory!.id ? updated as TripMemory : m))
      }
    }

    setGeneratingId(null)
  }

  async function handleDelete(memoryId: string) {
    await supabase.from('trip_memories').delete().eq('id', memoryId)
    setMemories(prev => prev.filter(m => m.id !== memoryId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Laster…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/minner"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" /> Tilbake til Ferieminner
          </Link>
          <div className="flex items-center gap-3">
            <BookHeart className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-lg font-bold text-slate-100">Minnebøker</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Generer vakre minnebøker fra dine reiser
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        {trips.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <BookHeart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Ingen reiser å vise ennå.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map(trip => {
              const memory = memories.find(m => m.trip_id === trip.id) ?? null
              return (
                <MemoryBookCard
                  key={trip.id}
                  trip={trip}
                  memory={memory}
                  generating={generatingId === trip.id}
                  onGenerate={() => handleGenerate(trip, memory)}
                  onDelete={memory ? () => handleDelete(memory.id) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
