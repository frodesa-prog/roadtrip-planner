'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { ExpenseEntry, Stop, Activity, Dining } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString('nb-NO')
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LocationOption {
  value: string   // "stop:id" | "activity:id" | "dining:id"
  label: string
  group: 'stop' | 'activity' | 'dining'
}

interface Props {
  category: 'shopping' | 'food' | 'misc'
  title: string       // e.g. "Shopping"
  emoji: string       // e.g. "🛍️"
  tripId: string
  tripDateFrom?: string | null  // ISO date – brukes som default-dato for nye poster
  stops: Stop[]
  activities: Activity[]
  dining: Dining[]
  entries: ExpenseEntry[]
  budget: number                            // getAmount(category) from budget_items
  onBudgetSave: (amount: number) => void
  onAddEntry: (data: Omit<ExpenseEntry, 'id' | 'created_at'>) => void
  onRemoveEntry: (id: string) => void
  onClose: () => void
}

// ── BudgetInput ───────────────────────────────────────────────────────────────
function BudgetInput({
  value,
  onSave,
}: {
  value: number
  onSave: (v: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  function handleFocus() {
    if (!ref.current) return
    const n = parseInt(ref.current.value.replace(/[^0-9]/g, '')) || 0
    ref.current.value = n > 0 ? String(n) : ''
    ref.current.select()
  }
  function handleBlur() {
    if (!ref.current) return
    const n = parseInt(ref.current.value.replace(/[^0-9]/g, '')) || 0
    onSave(n)
    ref.current.value = n > 0 ? fmt(n) : ''
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      defaultValue={value > 0 ? fmt(value) : ''}
      placeholder="0"
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className="w-28 text-right bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ExpenseEntryModal({
  category,
  title,
  emoji,
  tripId,
  tripDateFrom,
  stops,
  activities,
  dining,
  entries,
  budget,
  onBudgetSave,
  onAddEntry,
  onRemoveEntry,
  onClose,
}: Props) {
  // ── Add-form state ────────────────────────────────────────────────────────
  const [newDate, setNewDate]       = useState(tripDateFrom ?? '')
  const [newName, setNewName]       = useState('')
  const [newAmount, setNewAmount]   = useState('')
  const [newLocation, setNewLocation] = useState('')

  // ── Build location options ────────────────────────────────────────────────
  const stopById: Record<string, Stop> = Object.fromEntries(stops.map((s) => [s.id, s]))

  const locationOptions: LocationOption[] = [
    ...stops
      .filter((s) => s.stop_type === 'stop' || !s.stop_type)
      .map((s) => ({
        value: `stop:${s.id}`,
        label: `${s.city}${s.state ? `, ${s.state}` : ''}`,
        group: 'stop' as const,
      })),
    ...activities
      .filter((a) => a.name)
      .map((a) => {
        const stop = stopById[a.stop_id]
        return {
          value: `activity:${a.id}`,
          label: `${a.name}${stop ? ` (${stop.city})` : ''}`,
          group: 'activity' as const,
        }
      }),
    ...dining
      .filter((d) => d.name)
      .map((d) => {
        const stop = stopById[d.stop_id]
        return {
          value: `dining:${d.id}`,
          label: `${d.name}${stop ? ` (${stop.city})` : ''}`,
          group: 'dining' as const,
        }
      }),
  ]

  const stopOptions      = locationOptions.filter((o) => o.group === 'stop')
  const activityOptions  = locationOptions.filter((o) => o.group === 'activity')
  const diningOptions    = locationOptions.filter((o) => o.group === 'dining')

  // ── Location label for display ────────────────────────────────────────────
  function locationLabel(entry: ExpenseEntry): string {
    if (entry.stop_id) {
      const s = stops.find((s) => s.id === entry.stop_id)
      return s ? `${s.city}${s.state ? `, ${s.state}` : ''}` : '—'
    }
    if (entry.activity_id) {
      const a = activities.find((a) => a.id === entry.activity_id)
      return a ? a.name : '—'
    }
    if (entry.dining_id) {
      const d = dining.find((d) => d.id === entry.dining_id)
      return d ? d.name : '—'
    }
    return '—'
  }

  // ── Parse location selection ──────────────────────────────────────────────
  function parseLocation(val: string): { stop_id: string | null; activity_id: string | null; dining_id: string | null } {
    if (!val) return { stop_id: null, activity_id: null, dining_id: null }
    const [type, id] = val.split(':')
    return {
      stop_id:      type === 'stop'     ? id : null,
      activity_id:  type === 'activity' ? id : null,
      dining_id:    type === 'dining'   ? id : null,
    }
  }

  // ── Add entry ─────────────────────────────────────────────────────────────
  const handleAdd = useCallback(() => {
    const amt = parseInt(newAmount.replace(/[^0-9]/g, '')) || 0
    if (!newName.trim() || amt <= 0) return
    const loc = parseLocation(newLocation)
    onAddEntry({
      trip_id: tripId,
      category,
      entry_date: newDate || null,
      name: newName.trim(),
      amount: amt,
      ...loc,
    })
    setNewName('')
    setNewAmount('')
    setNewDate(tripDateFrom ?? '')
    setNewLocation('')
  }, [newDate, newName, newAmount, newLocation, category, tripId, onAddEntry])

  // ── Totals ────────────────────────────────────────────────────────────────
  const total = entries.reduce((s, e) => s + e.amount, 0)
  const gjenstår = budget > 0 ? Math.max(0, budget - total) : null

  // ── Input style ───────────────────────────────────────────────────────────
  const inputCls =
    'bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{emoji}</span>
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Budget ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-800/30 flex-shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
            Budsjett (planlegging)
          </span>
          <div className="flex items-center gap-1.5">
            <BudgetInput
              key={`budget-${budget}`}
              value={budget}
              onSave={onBudgetSave}
            />
            <span className="text-xs text-slate-500">kr</span>
          </div>
        </div>

        {/* ── Entry table ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Table header */}
          <div className="grid grid-cols-[6rem_1fr_5rem_6rem_2rem] gap-1 px-3 py-1.5 border-b border-slate-800 bg-slate-800/50">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Dato</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Navn</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right">Beløp</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Sted</div>
            <div />
          </div>

          {/* Existing entries */}
          {entries.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-600 text-xs">
              Ingen utgifter registrert ennå
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[6rem_1fr_5rem_6rem_2rem] gap-1 items-center px-3 py-1.5 hover:bg-slate-800/30 transition-colors group"
                >
                  <div className="text-[11px] text-slate-500 truncate">
                    {fmtDate(entry.entry_date)}
                  </div>
                  <div className="text-xs text-slate-200 truncate">{entry.name}</div>
                  <div className="text-[11px] font-semibold text-slate-200 text-right tabular-nums whitespace-nowrap">
                    {fmt(entry.amount)} kr
                  </div>
                  <div className="text-[11px] text-slate-500 truncate" title={locationLabel(entry)}>
                    {locationLabel(entry)}
                  </div>
                  <button
                    onClick={() => onRemoveEntry(entry.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                    title="Slett utgift"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Add row ──────────────────────────────────────────────────────── */}
          <div className="border-t border-slate-800 bg-slate-800/20 px-3 py-2">
            <div className="grid grid-cols-[6rem_1fr_5rem_6rem_2rem] gap-1 items-center">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={inputCls + ' w-full text-[11px]'}
              />
              <input
                type="text"
                placeholder="Navn på utgift"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                className={inputCls + ' w-full'}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                className={inputCls + ' w-full text-right'}
              />
              <div className="relative">
                <select
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className={inputCls + ' w-full appearance-none pr-4 text-[11px]'}
                >
                  <option value="">Velg sted…</option>
                  {stopOptions.length > 0 && (
                    <optgroup label="Stoppesteder">
                      {stopOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {activityOptions.length > 0 && (
                    <optgroup label="Aktiviteter">
                      {activityOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {diningOptions.length > 0 && (
                    <optgroup label="Spisesteder">
                      {diningOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newAmount}
                title="Legg til utgift"
                className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer: total + gjenstår ──────────────────────────────────────── */}
        <div className="border-t border-slate-800 bg-slate-800/50 px-4 py-3 flex-shrink-0 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total brukt</span>
            <span className="text-sm font-bold text-white tabular-nums">{fmt(total)} kr</span>
          </div>
          {budget > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Budsjett</span>
              <span className="text-xs text-slate-400 tabular-nums">{fmt(budget)} kr</span>
            </div>
          )}
          {gjenstår !== null && (
            <div className="flex items-center justify-between border-t border-slate-700 pt-1.5">
              <span className="text-xs font-semibold text-amber-400/80">Gjenstår (auto)</span>
              <span className={`text-sm font-bold tabular-nums ${gjenstår > 0 ? 'text-amber-300' : 'text-green-400'}`}>
                {gjenstår > 0 ? `${fmt(gjenstår)} kr` : '✓ Innenfor budsjett'}
              </span>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full mt-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  )
}
