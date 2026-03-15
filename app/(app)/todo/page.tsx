'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Plus, Trash2, Link2, ChevronDown, ChevronRight, ClipboardList,
  CheckSquare, Square, Pencil, ChevronUp, Bell, X, Flag,
} from 'lucide-react'
import { useTrips } from '@/hooks/useTrips'
import { useTodoItems } from '@/hooks/useTodoItems'
import { useTravelers } from '@/hooks/useTravelers'
import { useStops } from '@/hooks/useStops'
import TripManager from '@/components/planning/TripManager'
import { TodoItem, Traveler } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TodoPage() {
  const {
    trips, currentTrip, loading: tripsLoading, userId,
    setCurrentTrip, createTrip, deleteTrip,
  } = useTrips()
  const { items, loading, addItem, updateItem, toggleItem, moveItem, setReminder, toggleCritical, deleteItem } =
    useTodoItems(currentTrip?.id ?? null)
  const { travelers } = useTravelers(currentTrip?.id ?? null)
  const { stops } = useStops(currentTrip?.id ?? null)
  const [showReminderPanel, setShowReminderPanel] = useState(false)

  // Departure date = earliest stop arrival_date
  const departureDate = useMemo(() => {
    const dated = stops.filter((s) => s.arrival_date).map((s) => s.arrival_date!)
    return dated.length > 0 ? dated.sort()[0] : null
  }, [stops])

  const daysLeft = departureDate ? daysUntil(departureDate) : null
  const totalItems = items.length
  const completedItems = items.filter((i) => i.completed).length
  const activeItems = totalItems - completedItems
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  // Upcoming reminders (uncompleted with reminder_date >= today)
  const today = new Date().toISOString().slice(0, 10)
  const pendingReminders = items.filter(
    (i) => !i.completed && i.reminder_date && i.reminder_date >= today,
  ).sort((a, b) => (a.reminder_date ?? '').localeCompare(b.reminder_date ?? ''))

  function travelerName(id: string) {
    return travelers.find((t) => t.id === id)?.name ?? 'Ukjent'
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">

      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <div className="w-[240px] min-w-[200px] h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <TripManager
          trips={trips} currentTrip={currentTrip} loading={tripsLoading} userId={userId}
          onSelectTrip={setCurrentTrip} onCreateTrip={createTrip} onDeleteTrip={deleteTrip}
        />

        {/* Stats */}
        {currentTrip && (
          <div className="border-t border-slate-800 p-3 flex-shrink-0 space-y-3">

            {/* Countdown */}
            <div className="text-center py-1">
              {daysLeft !== null ? (
                <>
                  <p className={`text-2xl font-bold ${daysLeft <= 7 ? 'text-amber-400' : 'text-blue-400'}`}>
                    {daysLeft > 0 ? daysLeft : daysLeft === 0 ? '🎉' : '✈️'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {daysLeft > 0 ? 'dager til avreise' : daysLeft === 0 ? 'Avreise i dag!' : 'God tur!'}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-slate-600 italic">Ingen avreisedato satt</p>
              )}
            </div>

            {/* Progress */}
            {totalItems > 0 && (
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>{completedItems} utført</span>
                  <span>{activeItems} gjenstår</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-blue-600 rounded-full h-2 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-center text-[11px] text-slate-600 mt-1">{pct}% fullført</p>
              </div>
            )}

            {/* Reminders */}
            <button
              onClick={() => setShowReminderPanel((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                pendingReminders.length > 0
                  ? 'bg-amber-900/30 border border-amber-700/40 text-amber-300 hover:bg-amber-900/50'
                  : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                {pendingReminders.length > 0
                  ? `${pendingReminders.length} varsel på vent`
                  : 'Ingen varsler'}
              </span>
              {showReminderPanel
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />
              }
            </button>

            {/* Reminder list */}
            {showReminderPanel && (
              <div className="space-y-1.5">
                {pendingReminders.length === 0 ? (
                  <p className="text-[11px] text-slate-600 text-center py-1">Ingen kommende varsler</p>
                ) : (
                  pendingReminders.map((item) => (
                    <div key={item.id} className="bg-slate-800 rounded-md px-2.5 py-2">
                      <p className="text-[11px] text-amber-300 font-medium">
                        {fmtDate(item.reminder_date!)}
                      </p>
                      <p className="text-[11px] text-slate-300 truncate mt-0.5">{item.description}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {item.responsible === 'felles' ? 'Felles ansvar' : travelerName(item.responsible)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!currentTrip ? (
          <EmptyState message="Velg en tur til venstre for å se gjøremål" />
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <h1 className="text-lg font-semibold text-slate-100">Gjøremål</h1>
              <p className="text-xs text-slate-500">{currentTrip.name}</p>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-slate-600 text-sm">Laster gjøremål…</p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div
                  className="flex gap-4 p-5 h-full"
                  style={{ minWidth: `${(travelers.length + 1) * 285}px` }}
                >
                  <TodoColumn
                    title="Felles ansvar"
                    responsible="felles"
                    items={items.filter((i) => i.responsible === 'felles')}
                    onAdd={addItem}
                    onUpdate={updateItem}
                    onToggle={toggleItem}
                    onMove={moveItem}
                    onSetReminder={setReminder}
                    onToggleCritical={toggleCritical}
                    onDelete={deleteItem}
                  />
                  {travelers.map((traveler) => (
                    <TodoColumn
                      key={traveler.id}
                      title={traveler.name}
                      responsible={traveler.id}
                      items={items.filter((i) => i.responsible === traveler.id)}
                      onAdd={addItem}
                      onUpdate={updateItem}
                      onToggle={toggleItem}
                      onMove={moveItem}
                      onSetReminder={setReminder}
                      onToggleCritical={toggleCritical}
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
  title, responsible, items,
  onAdd, onUpdate, onToggle, onMove, onSetReminder, onToggleCritical, onDelete,
}: {
  title: string
  responsible: string
  items: TodoItem[]
  onAdd: (desc: string, link: string | null, responsible: string) => Promise<void>
  onUpdate: (id: string, desc: string, link: string | null) => Promise<void>
  onToggle: (id: string, completed: boolean) => void
  onMove: (id: string, dir: 'up' | 'down') => Promise<void>
  onSetReminder: (id: string, date: string | null) => Promise<void>
  onToggleCritical: (id: string, critical: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [showCompleted, setShowCompleted] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newLink, setNewLink] = useState('')
  const addInputRef = useRef<HTMLTextAreaElement>(null)

  const active = items.filter((i) => !i.completed).sort((a, b) => a.sort_order - b.sort_order)
  const completed = items.filter((i) => i.completed).sort((a, b) => a.sort_order - b.sort_order)

  useEffect(() => {
    if (showAddForm) addInputRef.current?.focus()
  }, [showAddForm])

  async function handleAdd() {
    if (!newDesc.trim()) return
    await onAdd(newDesc.trim(), newLink.trim() || null, responsible)
    setNewDesc('')
    setNewLink('')
    setShowAddForm(false)
  }

  return (
    <div className="w-[270px] flex-shrink-0 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <span className="text-xs text-slate-500">{active.length} aktive</span>
      </div>

      {/* Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="p-2 space-y-1 flex-1">
          {active.length === 0 && !showAddForm && (
            <p className="text-xs text-slate-600 text-center py-4">Ingen oppgaver</p>
          )}
          {active.map((item, idx) => (
            <TodoCard
              key={item.id}
              item={item}
              isFirst={idx === 0}
              isLast={idx === active.length - 1}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onMove={onMove}
              onSetReminder={onSetReminder}
              onToggleCritical={onToggleCritical}
              onDelete={onDelete}
            />
          ))}

          {/* Inline add form */}
          {showAddForm ? (
            <div className="bg-slate-800 rounded-lg p-2.5 space-y-2 border border-slate-700">
              <textarea
                ref={addInputRef}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Beskriv oppgaven…"
                rows={2}
                className="w-full bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 placeholder:text-slate-500 px-2 py-1.5 outline-none focus:border-blue-500 resize-none transition-colors"
              />
              <div className="relative">
                <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://… (valgfri lenke)"
                  className="w-full bg-slate-700 border border-slate-600 rounded text-xs text-slate-300 placeholder:text-slate-500 pl-6 pr-2 py-1.5 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => { setShowAddForm(false); setNewDesc(''); setNewLink('') }}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newDesc.trim()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded transition-colors"
                >
                  Legg til
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Legg til oppgave
            </button>
          )}

          {/* Completed section */}
          {completed.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 hover:text-slate-400 transition-colors w-full"
              >
                {showCompleted ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Fullført ({completed.length})
              </button>
              {showCompleted && (
                <div className="space-y-1">
                  {completed.map((item) => (
                    <TodoCard
                      key={item.id}
                      item={item}
                      isFirst={false}
                      isLast={false}
                      onToggle={onToggle}
                      onUpdate={onUpdate}
                      onMove={onMove}
                      onSetReminder={onSetReminder}
                      onToggleCritical={onToggleCritical}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function TodoCard({
  item, isFirst, isLast,
  onToggle, onUpdate, onMove, onSetReminder, onToggleCritical, onDelete,
}: {
  item: TodoItem
  isFirst: boolean
  isLast: boolean
  onToggle: (id: string, completed: boolean) => void
  onUpdate: (id: string, desc: string, link: string | null) => Promise<void>
  onMove: (id: string, dir: 'up' | 'down') => Promise<void>
  onSetReminder: (id: string, date: string | null) => Promise<void>
  onToggleCritical: (id: string, critical: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState(item.description)
  const [editLink, setEditLink] = useState(item.link ?? '')
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const descRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (editing) descRef.current?.focus() }, [editing])

  async function saveEdit() {
    setEditing(false)
    setShowReminderPicker(false)
    if (editDesc.trim() !== item.description || (editLink.trim() || null) !== item.link) {
      await onUpdate(item.id, editDesc.trim() || item.description, editLink.trim() || null)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-950/40 border border-red-800/40">
        <span className="flex-1 text-xs text-red-300 truncate">Slette oppgaven?</span>
        <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-slate-400 hover:text-slate-200">Avbryt</button>
        <button onClick={() => onDelete(item.id)} className="text-[11px] font-semibold text-red-400 hover:text-red-300">Slett</button>
      </div>
    )
  }

  const borderClass = item.completed
    ? 'bg-slate-900/20 border-slate-800/40 opacity-60'
    : editing
      ? 'bg-slate-800 border-blue-600/50'
      : item.is_critical
        ? 'bg-slate-800/50 border-red-600/70 hover:border-red-500/80 shadow-[0_0_0_1px_rgba(220,38,38,0.15)]'
        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/60'

  return (
    <div className={`group/card rounded-lg border transition-colors ${borderClass}`}>
      {editing ? (
        /* ── Edit mode ── */
        <div className="p-2.5 space-y-2">
          <textarea
            ref={descRef}
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            className="w-full bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 px-2 py-1.5 outline-none focus:border-blue-500 resize-none transition-colors"
          />
          <div className="relative">
            <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              value={editLink}
              onChange={(e) => setEditLink(e.target.value)}
              placeholder="https://… (lenke)"
              className="w-full bg-slate-700 border border-slate-600 rounded text-xs text-slate-300 placeholder:text-slate-500 pl-6 pr-2 py-1.5 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex gap-1.5 justify-end">
            <button onClick={() => { setEditing(false); setEditDesc(item.description); setEditLink(item.link ?? '') }} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200">Avbryt</button>
            <button onClick={saveEdit} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors">Lagre</button>
          </div>
        </div>
      ) : (
        /* ── View mode ── */
        <div className="flex items-start gap-2 px-2.5 py-2">
          {/* Checkbox */}
          <button
            onClick={() => onToggle(item.id, !item.completed)}
            className="flex-shrink-0 mt-0.5"
          >
            {item.completed
              ? <CheckSquare className="w-4 h-4 text-blue-500" />
              : <Square className="w-4 h-4 text-slate-500 hover:text-blue-400" />
            }
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1">
              <p className={`flex-1 text-xs leading-snug ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                {item.description}
              </p>
              {item.is_critical && !item.completed && (
                <Flag className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
              )}
            </div>
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 mt-0.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{item.link.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            {item.reminder_date && (
              <p className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-400">
                <Bell className="w-2.5 h-2.5" />
                {fmtDate(item.reminder_date)}
              </p>
            )}
          </div>

          {/* Action buttons */}
          {!item.completed && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={() => setEditing(true)} className="p-0.5 text-slate-600 hover:text-blue-400 transition-colors" title="Rediger">
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowReminderPicker((v) => !v)}
                className={`p-0.5 transition-colors ${item.reminder_date ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-amber-400'}`}
                title={item.reminder_date ? 'Endre påminnelse' : 'Sett påminnelse'}
              >
                <Bell className="w-3 h-3" />
              </button>
              <button
                onClick={() => onToggleCritical(item.id, !item.is_critical)}
                className={`p-0.5 transition-colors ${item.is_critical ? 'text-red-500 hover:text-red-400' : 'text-slate-600 hover:text-red-400'}`}
                title={item.is_critical ? 'Fjern kritisk-markering' : 'Merk som kritisk'}
              >
                <Flag className="w-3 h-3" />
              </button>
              <button onClick={() => onMove(item.id, 'up')} disabled={isFirst} className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors" title="Flytt opp">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button onClick={() => onMove(item.id, 'down')} disabled={isLast} className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors" title="Flytt ned">
                <ChevronDown className="w-3 h-3" />
              </button>
              <button onClick={() => setConfirmDelete(true)} className="p-0.5 text-slate-600 hover:text-red-400 transition-colors" title="Slett">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
          {item.completed && (
            <button onClick={() => setConfirmDelete(true)} className="p-0.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover/card:opacity-100 flex-shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Reminder date picker */}
      {showReminderPicker && !editing && (
        <div className="px-2.5 pb-2.5 flex items-center gap-2">
          <Bell className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <input
            type="date"
            min={today}
            value={item.reminder_date ?? ''}
            onChange={(e) => onSetReminder(item.id, e.target.value || null)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-300 px-2 py-1 outline-none focus:border-blue-500 transition-colors"
          />
          {item.reminder_date && (
            <button
              onClick={() => { onSetReminder(item.id, null); setShowReminderPicker(false) }}
              className="text-slate-500 hover:text-red-400 transition-colors"
              title="Fjern påminnelse"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => setShowReminderPicker(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronUp className="w-3 h-3" />
          </button>
        </div>
      )}
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
