'use client'

import { useMemo, useRef, useState } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities } from '@/hooks/useActivities'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import {
  Plane, Car, Fuel, BedDouble, Ticket,
  ChevronDown, Loader2, Receipt, ExternalLink,
} from 'lucide-react'

// ── Formattering ─────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString('nb-NO')
}
function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short',
  })
}

// ── CostInput med tusentallskille ────────────────────────────────────────────
function CostInput({
  defaultValue,
  onSave,
  placeholder = '0',
}: {
  defaultValue: number | null
  onSave: (v: number) => void
  placeholder?: string
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
      defaultValue={defaultValue && defaultValue > 0 ? fmt(defaultValue) : ''}
      placeholder={placeholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className="w-full text-right bg-slate-700/50 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
    />
  )
}

// ── RemainingCell ─────────────────────────────────────────────────────────────
function RemainingCell({
  remainingAmount,
  onSave,
}: {
  remainingAmount: number | null
  onSave: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  function commit() {
    const n = parseInt(ref.current?.value.replace(/[^0-9]/g, '') ?? '') || 0
    onSave(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        defaultValue={remainingAmount && remainingAmount > 0 ? String(remainingAmount) : ''}
        placeholder="0"
        autoFocus
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-20 text-right text-[11px] bg-slate-800 border border-amber-500 rounded-md px-2 py-1 text-slate-100 focus:outline-none"
      />
    )
  }
  if (remainingAmount && remainingAmount > 0) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Klikk for å redigere gjenstående beløp"
        className="text-[11px] font-semibold text-amber-300 bg-amber-900/40 border border-amber-600/50 rounded-md px-2 py-0.5 hover:bg-amber-900/60 whitespace-nowrap transition-colors"
      >
        {fmt(remainingAmount)} kr
      </button>
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      title="Klikk for å registrere gjenstående beløp"
      className="text-[11px] text-green-600 hover:text-green-400 transition-colors px-1 py-0.5 rounded hover:bg-slate-800"
    >
      ✓
    </button>
  )
}

// ── Mini-komponentar ──────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div className={`text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2 py-1.5 ${right ? 'text-right' : ''}`}>
      {children}
    </div>
  )
}
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      {icon}
      <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wide">{title}</h2>
    </div>
  )
}
function EmptyRow({ text }: { text: string }) {
  return <div className="px-3 py-3 text-center text-slate-600 text-xs">{text}</div>
}
function TableTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="border-t border-slate-700 bg-slate-800/60 flex items-center justify-between px-2 py-1.5">
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>
      <span className="text-[11px] font-bold text-white">{fmt(amount)} kr</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function KostnaderPage() {
  const { trips, currentTrip, loading: tripsLoading, setCurrentTrip } = useTrips()
  const { stops, loading: stopsLoading } = useStops(currentTrip?.id ?? null)

  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const stopById = useMemo(
    () => Object.fromEntries(stops.map((s) => [s.id, s])),
    [stops]
  )

  const { hotels, saveHotel } = useHotels(stopIds)
  const { activities, updateActivity } = useActivities(stopIds)
  const { saveItem, getAmount, getRemaining } = useBudgetItems(currentTrip?.id ?? null)

  // ── Rader ────────────────────────────────────────────────────────────────
  const hotelRows = useMemo(() =>
    hotels
      .map((h) => ({ hotel: h, stop: stopById[h.stop_id] }))
      .filter((r) => r.stop)
      .sort((a, b) => a.stop.order - b.stop.order),
    [hotels, stopById]
  )

  // Kun aktiviteter MED kostnad > 0
  const activityRows = useMemo(() =>
    activities
      .map((a) => ({ activity: a, stop: stopById[a.stop_id] }))
      .filter((r) => r.stop && r.activity.cost != null && r.activity.cost > 0)
      .sort((a, b) => {
        if (a.stop.order !== b.stop.order) return a.stop.order - b.stop.order
        if (a.activity.activity_date && b.activity.activity_date)
          return a.activity.activity_date.localeCompare(b.activity.activity_date)
        return 0
      }),
    [activities, stopById]
  )

  // ── Totaler ──────────────────────────────────────────────────────────────
  const totalHotels = hotelRows.reduce((s, r) => s + (r.hotel.cost ?? 0), 0)
  const totalActivities = activityRows.reduce((s, r) => s + (r.activity.cost ?? 0), 0)
  const totalFlight = getAmount('flight')
  const totalCar = getAmount('car')
  const totalGas = getAmount('gas')
  const totalOther = totalFlight + totalCar + totalGas
  const grandTotal = totalHotels + totalActivities + totalOther

  const grandRemaining =
    hotelRows.reduce((s, r) => s + (r.hotel.remaining_amount ?? 0), 0) +
    activityRows.reduce((s, r) => s + (r.activity.remaining_amount ?? 0), 0) +
    (getRemaining('flight') ?? 0) +
    (getRemaining('car') ?? 0) +
    (getRemaining('gas') ?? 0)

  const budgetLines = [
    { key: 'flight' as const, label: 'Fly', icon: <Plane className="w-3 h-3 text-sky-400" />, amount: totalFlight },
    { key: 'car' as const, label: 'Leiebil', icon: <Car className="w-3 h-3 text-violet-400" />, amount: totalCar },
    { key: 'gas' as const, label: 'Bensin (est.)', icon: <Fuel className="w-3 h-3 text-amber-400" />, amount: totalGas },
  ]

  const loading = stopsLoading

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">

      {/* ── Toppbar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-green-400" />
          <h1 className="text-sm font-bold text-white">Kostnader</h1>
        </div>

        {currentTrip && !loading && (
          <div className="flex items-center gap-2 ml-1">
            <span className="text-sm font-extrabold text-green-400 tabular-nums">
              {fmt(grandTotal)} kr
            </span>
            {grandRemaining > 0 && (
              <span className="text-[11px] font-semibold text-amber-300 bg-amber-900/40 border border-amber-600/40 rounded-full px-2 py-0.5">
                {fmt(grandRemaining)} kr gjenstår
              </span>
            )}
          </div>
        )}

        <div className="relative ml-auto">
          {tripsLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : (
            <div className="relative inline-flex items-center">
              <select
                value={currentTrip?.id ?? ''}
                onChange={(e) => {
                  const t = trips.find((t) => t.id === e.target.value)
                  if (t) setCurrentTrip(t)
                }}
                className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-7 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Velg tur…</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.year})</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            </div>
          )}
        </div>
      </div>

      {/* ── Innhold ──────────────────────────────────────────────────────── */}
      {!currentTrip ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Velg en tur for å se kostnader</p>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Laster…</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex gap-3 items-start min-h-0">

            {/* ══ VENSTRE: Hoteller ════════════════════════════════════════ */}
            <div className="flex-[3] min-w-0">
              <SectionTitle
                icon={<BedDouble className="w-3.5 h-3.5 text-blue-400" />}
                title="Hoteller"
              />
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                {/* Kolonne-hoder: By | Hotell | N | Kostnad | Snitt | Gjenstår */}
                <div className="grid grid-cols-[minmax(64px,auto)_1fr_1.5rem_5.5rem_3.5rem_auto] border-b border-slate-800 bg-slate-800/50">
                  <Th>By</Th>
                  <Th>Hotell</Th>
                  <Th right>N</Th>
                  <Th right>Kostnad</Th>
                  <Th right>Snitt</Th>
                  <Th right>Gjenstår</Th>
                </div>

                {hotelRows.length === 0 ? (
                  <EmptyRow text="Ingen hoteller registrert ennå" />
                ) : (
                  hotelRows.map(({ hotel, stop }, i) => {
                    const avg = hotel.cost && stop.nights > 0
                      ? hotel.cost / stop.nights
                      : null
                    return (
                      <div
                        key={hotel.id}
                        className={`grid grid-cols-[minmax(64px,auto)_1fr_1.5rem_5.5rem_3.5rem_auto] items-center ${
                          i % 2 === 0 ? '' : 'bg-slate-800/20'
                        } hover:bg-slate-800/40 transition-colors`}
                      >
                        {/* By */}
                        <div className="px-2 py-2 text-[11px] text-slate-400 truncate max-w-[90px]">
                          {stop.city}
                          {stop.state && <span className="text-slate-600">, {stop.state}</span>}
                        </div>

                        {/* Hotellnavn (link hvis url fins) */}
                        <div className="px-2 py-2 min-w-0">
                          {hotel.url ? (
                            <a
                              href={hotel.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 truncate group"
                            >
                              <span className="truncate">{hotel.name || 'Ukjent'}</span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-200 truncate block">
                              {hotel.name || <span className="text-slate-600 italic">Ukjent</span>}
                            </span>
                          )}
                        </div>

                        {/* Netter */}
                        <div className="px-1 py-2 text-[11px] text-slate-500 text-right">
                          {stop.nights}
                        </div>

                        {/* Kostnad */}
                        <div className="px-1.5 py-1.5">
                          <CostInput
                            key={`h-${hotel.id}-${hotel.cost}`}
                            defaultValue={hotel.cost}
                            onSave={(v) => saveHotel(hotel.stop_id, { cost: v })}
                          />
                        </div>

                        {/* Snitt/natt */}
                        <div className="px-1.5 py-2 text-[11px] text-slate-500 text-right whitespace-nowrap">
                          {avg !== null ? fmt(avg) : '—'}
                        </div>

                        {/* Gjenstår */}
                        <div className="px-2 py-2 flex justify-end">
                          <RemainingCell
                            remainingAmount={hotel.remaining_amount ?? null}
                            onSave={(v) => saveHotel(hotel.stop_id, { remaining_amount: v })}
                          />
                        </div>
                      </div>
                    )
                  })
                )}

                <TableTotal label="Total hoteller" amount={totalHotels} />
              </div>
            </div>

            {/* ══ HØYRE: Aktiviteter + Andre kostnader ════════════════════ */}
            <div className="flex-[2] min-w-0 space-y-3" key={currentTrip.id}>

              {/* Aktiviteter */}
              <div>
                <SectionTitle
                  icon={<Ticket className="w-3.5 h-3.5 text-purple-400" />}
                  title="Aktiviteter"
                />
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="grid grid-cols-[1fr_5.5rem_auto] border-b border-slate-800 bg-slate-800/50">
                    <Th>Aktivitet</Th>
                    <Th right>Kostnad</Th>
                    <Th right>Gjenstår</Th>
                  </div>

                  {activityRows.length === 0 ? (
                    <EmptyRow text="Ingen aktiviteter med kostnad" />
                  ) : (
                    activityRows.map(({ activity, stop }, i) => (
                      <div
                        key={activity.id}
                        className={`grid grid-cols-[1fr_5.5rem_auto] items-center ${
                          i % 2 === 0 ? '' : 'bg-slate-800/20'
                        } hover:bg-slate-800/40 transition-colors`}
                      >
                        <div className="px-2 py-2 min-w-0">
                          <p className="text-xs text-slate-200 truncate">{activity.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {stop.city}
                            {activity.activity_date && ` · ${fmtDate(activity.activity_date)}`}
                          </p>
                        </div>
                        <div className="px-1.5 py-1.5">
                          <CostInput
                            key={`a-${activity.id}-${activity.cost}`}
                            defaultValue={activity.cost}
                            onSave={(v) => updateActivity(activity.id, { cost: v })}
                          />
                        </div>
                        <div className="px-2 py-2 flex justify-end">
                          <RemainingCell
                            remainingAmount={activity.remaining_amount ?? null}
                            onSave={(v) => updateActivity(activity.id, { remaining_amount: v })}
                          />
                        </div>
                      </div>
                    ))
                  )}

                  <TableTotal label="Total aktiviteter" amount={totalActivities} />
                </div>
              </div>

              {/* Andre kostnader */}
              <div>
                <SectionTitle
                  icon={<Plane className="w-3.5 h-3.5 text-sky-400" />}
                  title="Andre kostnader"
                />
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="grid grid-cols-[1fr_5.5rem_auto] border-b border-slate-800 bg-slate-800/50">
                    <Th>Post</Th>
                    <Th right>Kostnad</Th>
                    <Th right>Gjenstår</Th>
                  </div>

                  {budgetLines.map(({ key, label, icon, amount }, i) => (
                    <div
                      key={key}
                      className={`grid grid-cols-[1fr_5.5rem_auto] items-center ${
                        i % 2 === 0 ? '' : 'bg-slate-800/20'
                      } hover:bg-slate-800/40 transition-colors`}
                    >
                      <div className="px-2 py-2 flex items-center gap-1.5">
                        {icon}
                        <span className="text-xs text-slate-200">{label}</span>
                      </div>
                      <div className="px-1.5 py-1.5">
                        <CostInput
                          defaultValue={amount || null}
                          onSave={(v) => saveItem(key, { amount: v })}
                        />
                      </div>
                      <div className="px-2 py-2 flex justify-end">
                        <RemainingCell
                          remainingAmount={getRemaining(key)}
                          onSave={(v) => saveItem(key, { remaining_amount: v })}
                        />
                      </div>
                    </div>
                  ))}

                  <TableTotal label="Total andre" amount={totalOther} />
                </div>
              </div>

              {/* Totalsum (under høyre kolonne) */}
              <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/20 border border-green-800/50 rounded-xl px-3 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-green-400/70 uppercase tracking-widest">
                    Totalsum
                  </span>
                  <span className="text-xl font-extrabold text-green-400 tabular-nums">
                    {fmt(grandTotal)} kr
                  </span>
                </div>
                {grandRemaining > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-amber-400/70">Gjenstår å betale</span>
                    <span className="text-sm font-bold text-amber-300">{fmt(grandRemaining)} kr</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5 mt-1 border-t border-green-800/30 pt-2">
                  {[
                    { label: 'Hoteller', value: totalHotels },
                    { label: 'Aktiviteter', value: totalActivities },
                    { label: 'Fly + leiebil', value: totalFlight + totalCar },
                    { label: 'Bensin', value: totalGas },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">{label}</span>
                      <span className="text-[11px] font-semibold text-slate-300 tabular-nums">
                        {fmt(value)} kr
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
