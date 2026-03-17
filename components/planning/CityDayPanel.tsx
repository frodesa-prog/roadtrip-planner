'use client'

import { useState } from 'react'
import {
  X, MapPin, UtensilsCrossed, Plus, Trash2, Pencil,
  Lightbulb, ExternalLink, Clock,
} from 'lucide-react'
import { Activity, Dining, PossibleActivity } from '@/types'
import { AddActivityData, UpdateActivityData } from '@/hooks/useActivities'
import { AddDiningData, UpdateDiningData } from '@/hooks/useDining'
import { AddPossibleActivityData, UpdatePossibleActivityData } from '@/hooks/usePossibleActivities'
import { ACTIVITY_TYPE_PRESETS, getActivityTypeConfig } from '@/lib/activityTypes'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ── Props ────────────────────────────────────────────────────────────────────

interface CityDayPanelProps {
  dateStr: string
  dayIndex: number
  /** Activities already filtered for this day */
  activities: Activity[]
  /** Dining already filtered for this day */
  dining: Dining[]
  /** All possible activities for the stop (not day-specific) */
  possibleActivities: PossibleActivity[]
  onAddActivity: (data: AddActivityData) => void
  onRemoveActivity: (id: string) => void
  onUpdateActivity: (id: string, updates: UpdateActivityData) => void
  onAddDining: (data: AddDiningData) => void
  onRemoveDining: (id: string) => void
  onUpdateDining: (id: string, updates: UpdateDiningData) => void
  onAddPossibleActivity: (data: AddPossibleActivityData) => void
  onRemovePossibleActivity: (id: string) => void
  onUpdatePossibleActivity: (id: string, updates: UpdatePossibleActivityData) => void
  onClose: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDayHeader(dateStr: string, index: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  const weekdays = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
  const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
  return `Dag ${index + 1} – ${weekdays[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]}`
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CityDayPanel({
  dateStr, dayIndex,
  activities, dining, possibleActivities,
  onAddActivity, onRemoveActivity, onUpdateActivity,
  onAddDining, onRemoveDining, onUpdateDining,
  onAddPossibleActivity, onRemovePossibleActivity, onUpdatePossibleActivity,
  onClose,
}: CityDayPanelProps) {

  // ── Activity state ────────────────────────────────────────────────────────
  const [showAddActivity, setShowAddActivity]   = useState(false)
  const [newActName, setNewActName]             = useState('')
  const [newActUrl, setNewActUrl]               = useState('')
  const [newActTime, setNewActTime]             = useState('')
  const [newActType, setNewActType]             = useState<string | null>(null)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [editActName, setEditActName]           = useState('')
  const [editActUrl, setEditActUrl]             = useState('')
  const [editActTime, setEditActTime]           = useState('')

  // ── Dining state ──────────────────────────────────────────────────────────
  const [showAddDining, setShowAddDining]       = useState(false)
  const [newDiningName, setNewDiningName]       = useState('')
  const [newDiningUrl, setNewDiningUrl]         = useState('')
  const [newDiningTime, setNewDiningTime]       = useState('')
  const [editingDiningId, setEditingDiningId]   = useState<string | null>(null)
  const [editDiningName, setEditDiningName]     = useState('')
  const [editDiningUrl, setEditDiningUrl]       = useState('')
  const [editDiningTime, setEditDiningTime]     = useState('')

  // ── Possible activities state ─────────────────────────────────────────────
  const [showAddPossible, setShowAddPossible]       = useState(false)
  const [newPossibleDesc, setNewPossibleDesc]       = useState('')
  const [newPossibleUrl, setNewPossibleUrl]         = useState('')
  const [editingPossibleId, setEditingPossibleId]   = useState<string | null>(null)
  const [editPossibleDesc, setEditPossibleDesc]     = useState('')
  const [editPossibleUrl, setEditPossibleUrl]       = useState('')

  // ── Confirm dialog ────────────────────────────────────────────────────────
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null)

  // ── Sorted lists ──────────────────────────────────────────────────────────
  const sortedActivities = [...activities].sort((a, b) => {
    const ta = a.activity_time ?? '99:99'
    const tb = b.activity_time ?? '99:99'
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })
  const sortedDining = [...dining].sort((a, b) => {
    const ta = a.booking_time ?? '99:99'
    const tb = b.booking_time ?? '99:99'
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAddActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!newActName.trim()) return
    onAddActivity({
      name: newActName.trim(),
      url: newActUrl.trim() || undefined,
      activity_date: dateStr,
      activity_time: newActTime.trim() || undefined,
      activity_type: newActType || undefined,
    })
    setNewActName(''); setNewActUrl(''); setNewActTime(''); setNewActType(null)
    setShowAddActivity(false)
  }

  function startEditActivity(act: Activity) {
    setEditingActivityId(act.id)
    setEditActName(act.name)
    setEditActUrl(act.url ?? '')
    setEditActTime(act.activity_time ?? '')
  }

  function saveEditActivity() {
    if (!editingActivityId || !editActName.trim()) return
    onUpdateActivity(editingActivityId, {
      name: editActName.trim(),
      url: editActUrl.trim() || null,
      activity_time: editActTime || null,
      activity_date: dateStr,
    })
    setEditingActivityId(null)
  }

  function handleAddDining(e: React.FormEvent) {
    e.preventDefault()
    if (!newDiningName.trim()) return
    onAddDining({
      name: newDiningName.trim(),
      url: newDiningUrl.trim() || undefined,
      booking_date: dateStr,
      booking_time: newDiningTime.trim() || undefined,
    })
    setNewDiningName(''); setNewDiningUrl(''); setNewDiningTime('')
    setShowAddDining(false)
  }

  function startEditDining(d: Dining) {
    setEditingDiningId(d.id)
    setEditDiningName(d.name)
    setEditDiningUrl(d.url ?? '')
    setEditDiningTime(d.booking_time ?? '')
  }

  function saveEditDining() {
    if (!editingDiningId || !editDiningName.trim()) return
    onUpdateDining(editingDiningId, {
      name: editDiningName.trim(),
      url: editDiningUrl.trim() || null,
      booking_time: editDiningTime || null,
      booking_date: dateStr,
    })
    setEditingDiningId(null)
  }

  function handleAddPossible(e: React.FormEvent) {
    e.preventDefault()
    if (!newPossibleDesc.trim()) return
    onAddPossibleActivity({
      description: newPossibleDesc.trim(),
      url: newPossibleUrl.trim() || undefined,
    })
    setNewPossibleDesc(''); setNewPossibleUrl('')
    setShowAddPossible(false)
  }

  function startEditPossible(a: PossibleActivity) {
    setEditingPossibleId(a.id)
    setEditPossibleDesc(a.description)
    setEditPossibleUrl(a.url ?? '')
  }

  function saveEditPossible() {
    if (!editingPossibleId || !editPossibleDesc.trim()) return
    onUpdatePossibleActivity(editingPossibleId, {
      description: editPossibleDesc.trim(),
      url: editPossibleUrl.trim() || null,
    })
    setEditingPossibleId(null)
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500'
  const timeCls  = 'w-24 flex-shrink-0 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full md:w-[370px] flex-shrink-0 h-full flex flex-col bg-slate-900 border-l border-slate-800 overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-slate-100">{formatDayHeader(dateStr, dayIndex)}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {activities.length} aktiviteter · {dining.length} spisesteder
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">

          {/* ── Aktiviteter ────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-blue-400" /> Aktiviteter
              </h3>
              {!showAddActivity && (
                <button
                  onClick={() => setShowAddActivity(true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Legg til
                </button>
              )}
            </div>

            {showAddActivity && (
              <form onSubmit={handleAddActivity} className="space-y-1.5 mb-3 p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <input
                  autoFocus
                  placeholder="Aktivitetsnavn"
                  value={newActName}
                  onChange={(e) => setNewActName(e.target.value)}
                  className={inputCls}
                />
                <div className="flex gap-1.5">
                  <input
                    placeholder="URL (valgfritt)"
                    value={newActUrl}
                    onChange={(e) => setNewActUrl(e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="time"
                    value={newActTime}
                    onChange={(e) => setNewActTime(e.target.value)}
                    className={timeCls}
                  />
                </div>
                {/* Type picker */}
                <div className="flex flex-wrap gap-1">
                  {ACTIVITY_TYPE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setNewActType(newActType === p.value ? null : p.value)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                        newActType === p.value
                          ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {p.emoji} {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowAddActivity(false); setNewActName(''); setNewActUrl(''); setNewActTime(''); setNewActType(null) }}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button type="submit" className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
                    Lagre
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5">
              {sortedActivities.length === 0 && !showAddActivity && (
                <p className="text-xs text-slate-600 italic">Ingen aktiviteter denne dagen.</p>
              )}
              {sortedActivities.map((act) => {
                const cfg = getActivityTypeConfig(act.activity_type)
                if (editingActivityId === act.id) {
                  return (
                    <div key={act.id} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-1.5">
                      <input value={editActName} onChange={(e) => setEditActName(e.target.value)} className={inputCls} autoFocus />
                      <div className="flex gap-1.5">
                        <input value={editActUrl} onChange={(e) => setEditActUrl(e.target.value)} placeholder="URL (valgfritt)" className={inputCls} />
                        <input type="time" value={editActTime} onChange={(e) => setEditActTime(e.target.value)} className={timeCls} />
                      </div>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditingActivityId(null)} className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200">Avbryt</button>
                        <button onClick={saveEditActivity} className="px-2.5 py-0.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded">Lagre</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={act.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-800/50 group">
                    <span className="text-sm flex-shrink-0" title={cfg.label}>{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 font-medium truncate">{act.name}</p>
                      {act.activity_time && (
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" /> {act.activity_time}
                        </p>
                      )}
                    </div>
                    {act.url && (
                      <a href={act.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-slate-600 hover:text-blue-400 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditActivity(act)} className="text-slate-500 hover:text-blue-400 transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setConfirm({ message: `Fjerne «${act.name}»?`, action: () => onRemoveActivity(act.id) })}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Spisesteder ────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <UtensilsCrossed className="w-3 h-3 text-orange-400" /> Spisesteder
              </h3>
              {!showAddDining && (
                <button
                  onClick={() => setShowAddDining(true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Legg til
                </button>
              )}
            </div>

            {showAddDining && (
              <form onSubmit={handleAddDining} className="space-y-1.5 mb-3 p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <input
                  autoFocus
                  placeholder="Restaurantnavn"
                  value={newDiningName}
                  onChange={(e) => setNewDiningName(e.target.value)}
                  className={inputCls}
                />
                <div className="flex gap-1.5">
                  <input
                    placeholder="URL / booking-link"
                    value={newDiningUrl}
                    onChange={(e) => setNewDiningUrl(e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="time"
                    value={newDiningTime}
                    onChange={(e) => setNewDiningTime(e.target.value)}
                    className={timeCls}
                  />
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowAddDining(false); setNewDiningName(''); setNewDiningUrl(''); setNewDiningTime('') }}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button type="submit" className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
                    Lagre
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5">
              {sortedDining.length === 0 && !showAddDining && (
                <p className="text-xs text-slate-600 italic">Ingen spisesteder denne dagen.</p>
              )}
              {sortedDining.map((d) => {
                if (editingDiningId === d.id) {
                  return (
                    <div key={d.id} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-1.5">
                      <input value={editDiningName} onChange={(e) => setEditDiningName(e.target.value)} className={inputCls} autoFocus />
                      <div className="flex gap-1.5">
                        <input value={editDiningUrl} onChange={(e) => setEditDiningUrl(e.target.value)} placeholder="URL (valgfritt)" className={inputCls} />
                        <input type="time" value={editDiningTime} onChange={(e) => setEditDiningTime(e.target.value)} className={timeCls} />
                      </div>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditingDiningId(null)} className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200">Avbryt</button>
                        <button onClick={saveEditDining} className="px-2.5 py-0.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded">Lagre</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={d.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-800/50 group">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 font-medium truncate">{d.name}</p>
                      {d.booking_time && (
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" /> {d.booking_time}
                        </p>
                      )}
                    </div>
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-slate-600 hover:text-blue-400 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditDining(d)} className="text-slate-500 hover:text-blue-400 transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setConfirm({ message: `Fjerne «${d.name}»?`, action: () => onRemoveDining(d.id) })}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Mulige aktiviteter ──────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3 text-yellow-400" /> Mulige aktiviteter
              </h3>
              {!showAddPossible && (
                <button
                  onClick={() => setShowAddPossible(true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Legg til
                </button>
              )}
            </div>

            {showAddPossible && (
              <form onSubmit={handleAddPossible} className="space-y-1.5 mb-3 p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <input
                  autoFocus
                  placeholder="Beskrivelse"
                  value={newPossibleDesc}
                  onChange={(e) => setNewPossibleDesc(e.target.value)}
                  className={inputCls}
                />
                <input
                  placeholder="URL (valgfritt)"
                  value={newPossibleUrl}
                  onChange={(e) => setNewPossibleUrl(e.target.value)}
                  className={inputCls}
                />
                <div className="flex gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowAddPossible(false); setNewPossibleDesc(''); setNewPossibleUrl('') }}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button type="submit" className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
                    Lagre
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5">
              {possibleActivities.length === 0 && !showAddPossible && (
                <p className="text-xs text-slate-600 italic">Ingen mulige aktiviteter lagt til.</p>
              )}
              {possibleActivities.map((a) => {
                if (editingPossibleId === a.id) {
                  return (
                    <div key={a.id} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-1.5">
                      <input value={editPossibleDesc} onChange={(e) => setEditPossibleDesc(e.target.value)} className={inputCls} autoFocus />
                      <input value={editPossibleUrl} onChange={(e) => setEditPossibleUrl(e.target.value)} placeholder="URL (valgfritt)" className={inputCls} />
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditingPossibleId(null)} className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200">Avbryt</button>
                        <button onClick={saveEditPossible} className="px-2.5 py-0.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded">Lagre</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={a.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-800/50 group">
                    <Lightbulb className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{a.description}</p>
                    </div>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-slate-600 hover:text-blue-400 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditPossible(a)} className="text-slate-500 hover:text-blue-400 transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setConfirm({ message: `Fjerne «${a.description}»?`, action: () => onRemovePossibleActivity(a.id) })}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel="Fjern"
          onConfirm={() => { confirm.action(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  )
}
