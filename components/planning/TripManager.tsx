'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown, Plus, Check, Route,
  Loader2, Trash2, X
} from 'lucide-react'
import { Trip } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TripManagerProps {
  trips: Trip[]
  currentTrip: Trip | null
  loading: boolean
  onSelectTrip: (trip: Trip) => void
  onCreateTrip: (name: string, year: number) => Promise<Trip | null>
  onDeleteTrip: (id: string) => void
}

export default function TripManager({
  trips,
  currentTrip,
  loading,
  onSelectTrip,
  onCreateTrip,
  onDeleteTrip,
}: TripManagerProps) {
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newYear, setNewYear] = useState(new Date().getFullYear())
  const [creating, setCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCreate(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    await onCreateTrip(newName.trim(), newYear)
    setNewName('')
    setNewYear(new Date().getFullYear())
    setCreating(false)
    setShowCreate(false)
    setOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => { setOpen(!open); setShowCreate(false) }}
        className="w-full flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 transition-colors"
      >
        <Route className="w-5 h-5 text-white/80 flex-shrink-0" />
        <div className="flex-1 text-left min-w-0">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-white/60 animate-spin" />
              <span className="text-white/60 text-sm">Laster turer…</span>
            </div>
          ) : currentTrip ? (
            <>
              <p className="text-white font-bold text-base leading-tight truncate">{currentTrip.name}</p>
              <p className="text-blue-200/60 text-xs">{currentTrip.year}</p>
            </>
          ) : (
            <p className="text-blue-200/80 text-sm font-medium">Velg eller opprett en tur</p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-b-xl overflow-hidden">
          {trips.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              {trips.map((trip) => (
                <div key={trip.id} className="flex items-center group">
                  <button
                    onClick={() => { onSelectTrip(trip); setOpen(false) }}
                    className={`flex-1 flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      currentTrip?.id === trip.id
                        ? 'bg-blue-900/40'
                        : 'hover:bg-slate-800'
                    }`}
                  >
                    {currentTrip?.id === trip.id && (
                      <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    )}
                    <div className={currentTrip?.id === trip.id ? '' : 'ml-5'}>
                      <p className="text-sm font-medium text-slate-100">{trip.name}</p>
                      <p className="text-xs text-slate-500">{trip.year}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => onDeleteTrip(trip.id)}
                    className="px-3 py-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Slett tur"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {trips.length > 0 && <div className="border-t border-slate-700/50" />}

          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-blue-400 hover:bg-slate-800 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Opprett ny tur
            </button>
          ) : (
            <form onSubmit={handleCreate} className="p-3 space-y-2 bg-slate-800/50">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-300">Ny tur</p>
                <button type="button" onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Navn på tur (f.eks. Route 66 2026)"
                className="h-8 text-sm bg-slate-800 border-slate-700 text-slate-100"
                autoFocus
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(Number(e.target.value))}
                  className="h-8 text-sm w-24 bg-slate-800 border-slate-700 text-slate-100"
                  min={2020}
                  max={2035}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newName.trim() || creating}
                  className="flex-1 h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Opprett'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
