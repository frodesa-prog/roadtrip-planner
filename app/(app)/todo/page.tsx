'use client'

import { useState } from 'react'
import { Plus, Trash2, Link2, ChevronDown, ChevronRight, ClipboardList, CheckSquare, Square } from 'lucide-react'
import { useTrips } from '@/hooks/useTrips'
import { useTodoItems } from '@/hooks/useTodoItems'
import { useTravelers } from '@/hooks/useTravelers'
import TripManager from '@/components/planning/TripManager'
import { TodoItem } from '@/types'
import { Traveler } from '@/types'

export default function TodoPage() {
  const {
    trips, currentTrip, loading: tripsLoading, userId,
    setCurrentTrip, createTrip, deleteTrip,
  } = useTrips()
  const { items, loading, addItem, toggleItem, deleteItem } = useTodoItems(currentTrip?.id ?? null)
  const { travelers } = useTravelers(currentTrip?.id ?? null)

  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [responsible, setResponsible] = useState('felles')

  async function handleAdd() {
    if (!description.trim()) return
    await addItem(description.trim(), link.trim() || null, responsible)
    setDescription('')
    setLink('')
    setResponsible('felles')
    setShowForm(false)
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">
      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[200px] h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <TripManager
          trips={trips} currentTrip={currentTrip} loading={tripsLoading} userId={userId}
          onSelectTrip={setCurrentTrip} onCreateTrip={createTrip} onDeleteTrip={deleteTrip}
        />
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!currentTrip ? (
          <EmptyState message="Velg en tur til venstre for å se gjøremål" />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <div>
                <h1 className="text-lg font-semibold text-slate-100">Gjøremål</h1>
                <p className="text-xs text-slate-500">{currentTrip.name}</p>
              </div>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ny oppgave
              </button>
            </div>

            {/* Add form */}
            {showForm && (
              <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50 flex-shrink-0 space-y-2.5">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Beskriv oppgaven..."
                  rows={2}
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 placeholder:text-slate-600 px-3 py-2 outline-none focus:border-blue-500 resize-none transition-colors"
                />
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://... (valgfri lenke)"
                      className="w-full bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-300 placeholder:text-slate-600 pl-8 pr-3 py-2 outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <select
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-300 px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="felles">Felles ansvar</option>
                    {travelers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!description.trim()}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Legg til
                  </button>
                </div>
              </div>
            )}

            {/* Columns */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-slate-600 text-sm">Laster gjøremål…</p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div
                  className="flex gap-4 p-5 h-full"
                  style={{ minWidth: `${(travelers.length + 1) * 280}px` }}
                >
                  {/* Felles-kolonne */}
                  <TodoColumn
                    title="Felles ansvar"
                    items={items.filter((i) => i.responsible === 'felles')}
                    onToggle={toggleItem}
                    onDelete={deleteItem}
                  />

                  {/* Én kolonne per reisende */}
                  {travelers.map((traveler) => (
                    <TodoColumn
                      key={traveler.id}
                      title={traveler.name}
                      items={items.filter((i) => i.responsible === traveler.id)}
                      onToggle={toggleItem}
                      onDelete={deleteItem}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function TodoColumn({
  title,
  items,
  onToggle,
  onDelete,
}: {
  title: string
  items: TodoItem[]
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  const [showCompleted, setShowCompleted] = useState(false)

  const active = items.filter((i) => !i.completed)
  const completed = items.filter((i) => i.completed)

  return (
    <div className="w-[265px] flex-shrink-0 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden h-full">
      {/* Column header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <span className="text-xs text-slate-500">{active.length} aktive</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
        {active.length === 0 && completed.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-6">Ingen oppgaver</p>
        )}

        {active.map((item) => (
          <TodoCard
            key={item.id}
            item={item}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}

        {/* Completed section */}
        {completed.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 hover:text-slate-400 transition-colors w-full"
            >
              {showCompleted
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />
              }
              Fullført ({completed.length})
            </button>
            {showCompleted && (
              <div className="space-y-1">
                {completed.map((item) => (
                  <TodoCard
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function TodoCard({
  item,
  onToggle,
  onDelete,
}: {
  item: TodoItem
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={`group/card flex items-start gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
      item.completed
        ? 'bg-slate-900/20 border-slate-800/40 opacity-60'
        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/60'
    }`}>
      <button
        onClick={() => onToggle(item.id, !item.completed)}
        className="flex-shrink-0 mt-0.5 transition-colors"
        title={item.completed ? 'Marker som aktiv' : 'Marker som fullført'}
      >
        {item.completed
          ? <CheckSquare className="w-4 h-4 text-blue-500" />
          : <Square className="w-4 h-4 text-slate-500 hover:text-blue-400" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug ${
          item.completed ? 'line-through text-slate-500' : 'text-slate-200'
        }`}>
          {item.description}
        </p>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 mt-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{item.link.replace(/^https?:\/\//, '')}</span>
          </a>
        )}
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover/card:opacity-100 flex-shrink-0 p-0.5 text-slate-600 hover:text-red-400 transition-all"
        title="Slett oppgave"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
      <div className="bg-slate-800 rounded-full p-5 mb-4">
        <ClipboardList className="w-10 h-10 text-slate-600" />
      </div>
      <p className="text-slate-400 text-sm max-w-xs">{message}</p>
    </div>
  )
}
