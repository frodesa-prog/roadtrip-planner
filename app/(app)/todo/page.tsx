'use client'

import { useState } from 'react'
import { Plus, Trash2, Link2, ChevronDown, ChevronRight, ClipboardList, CheckSquare, Square } from 'lucide-react'
import { useTrips } from '@/hooks/useTrips'
import { useTodoItems } from '@/hooks/useTodoItems'
import { useTravelers } from '@/hooks/useTravelers'
import TripManager from '@/components/planning/TripManager'
import { TodoItem } from '@/types'

export default function TodoPage() {
  const {
    trips, currentTrip, loading: tripsLoading, userId,
    setCurrentTrip, createTrip, deleteTrip,
  } = useTrips()
  const { items, loading, addItem, toggleItem, deleteItem } = useTodoItems(currentTrip?.id ?? null)
  const { travelers } = useTravelers(currentTrip?.id ?? null)

  const [showCompleted, setShowCompleted] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [responsible, setResponsible] = useState('felles')

  const active = items.filter((i) => !i.completed)
  const completed = items.filter((i) => i.completed)

  async function handleAdd() {
    if (!description.trim()) return
    await addItem(description.trim(), link.trim() || null, responsible)
    setDescription('')
    setLink('')
    setResponsible('felles')
    setShowForm(false)
  }

  function getResponsibleLabel(resp: string) {
    if (resp === 'felles') return 'Felles ansvar'
    return travelers.find((t) => t.id === resp)?.name ?? 'Ukjent'
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
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex-shrink-0 space-y-3">
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

            {/* Todo list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {!loading && active.length === 0 && completed.length === 0 && (
                <div className="text-center py-12">
                  <div className="bg-slate-800 rounded-full p-5 mb-4 inline-block">
                    <ClipboardList className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-slate-500 text-sm">Ingen oppgaver ennå</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    + Legg til første oppgave
                  </button>
                </div>
              )}

              {active.map((item) => (
                <TodoCard
                  key={item.id}
                  item={item}
                  responsibleLabel={getResponsibleLabel(item.responsible)}
                  onToggle={toggleItem}
                  onDelete={deleteItem}
                />
              ))}

              {/* Completed section */}
              {completed.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowCompleted((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 hover:text-slate-400 transition-colors"
                  >
                    {showCompleted
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                    Fullførte oppgaver ({completed.length})
                  </button>
                  {showCompleted && (
                    <div className="space-y-2">
                      {completed.map((item) => (
                        <TodoCard
                          key={item.id}
                          item={item}
                          responsibleLabel={getResponsibleLabel(item.responsible)}
                          onToggle={toggleItem}
                          onDelete={deleteItem}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TodoCard({
  item,
  responsibleLabel,
  onToggle,
  onDelete,
}: {
  item: TodoItem
  responsibleLabel: string
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={`group/card flex items-start gap-3 p-4 rounded-lg border transition-colors ${
      item.completed
        ? 'bg-slate-900/30 border-slate-800/50'
        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
    }`}>
      <button
        onClick={() => onToggle(item.id, !item.completed)}
        className="flex-shrink-0 mt-0.5 transition-colors"
        title={item.completed ? 'Marker som aktiv' : 'Marker som fullført'}
      >
        {item.completed
          ? <CheckSquare className="w-5 h-5 text-blue-500" />
          : <Square className="w-5 h-5 text-slate-500 hover:text-blue-400" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${
          item.completed ? 'line-through text-slate-500' : 'text-slate-200'
        }`}>
          {item.description}
        </p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
            {responsibleLabel}
          </span>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Link2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[220px]">
                {item.link.replace(/^https?:\/\//, '')}
              </span>
            </a>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover/card:opacity-100 flex-shrink-0 p-1 text-slate-600 hover:text-red-400 transition-all"
        title="Slett oppgave"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

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
