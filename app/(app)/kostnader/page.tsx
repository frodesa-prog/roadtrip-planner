'use client'

import { useMemo, useRef } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities } from '@/hooks/useActivities'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import {
  Plane, Car, Fuel, BedDouble, Ticket,
  ChevronDown, Loader2, Receipt,
} from 'lucide-react'

// ── Formattering ────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString('nb-NO')
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'short',
  })
}

// ── Inline kostnadsinput ─────────────────────────────────────────────────────
interface CostInputProps {
  defaultValue: number | null
  onSave: (value: number) => void
  id?: string
}
function CostInput({ defaultValue, onSave, id }: CostInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  function commit() {
    const v = parseInt(ref.current?.value ?? '0') || 0
    onSave(v)
  }
  return (
    <input
      ref={ref}
      id={id}
      type="number"
      min={0}
      defaultValue={defaultValue ?? ''}
      placeholder="0"
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      className="w-32 text-right bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
    />
  )
}

// ── Seksjonsoverskrift ───────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
    </div>
  )
}

// ── Tabellhode-celle ─────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div className={`text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2 px-3 ${right ? 'text-right' : ''}`}>
      {children}
    </div>
  )
}
function Td({ children, right, muted }: { children: React.ReactNode; right?: boolean; muted?: boolean }) {
  return (
    <div className={`py-2.5 px-3 text-sm ${right ? 'text-right' : ''} ${muted ? 'text-slate-500' : 'text-slate-200'}`}>
      {children}
    </div>
  )
}

// ── Totalrad ─────────────────────────────────────────────────────────────────
function TotalRow({ label, amount, cols }: { label: string; amount: number; cols: number }) {
  return (
    <div
      className="border-t border-slate-700 mt-1 pt-1"
      style={{ display: 'grid', gridColumn: `1 / -1` }}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-sm font-semibold text-slate-300">{label}</span>
        <span className="text-sm font-bold text-white">{fmt(amount)} kr</span>
      </div>
    </div>
  )
}

// ── Tommelfingerregel tom-tilstand ───────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-3 py-6 text-center text-slate-500 text-sm">{text}</div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Hoved-side
// ══════════════════════════════════════════════════════════════════════════════
export default function KostnaderPage() {
  const {
    trips, currentTrip, loading: tripsLoading,
    setCurrentTrip,
  } = useTrips()

  const { stops, loading: stopsLoading } = useStops(currentTrip?.id ?? null)

  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const stopById = useMemo(
    () => Object.fromEntries(stops.map((s) => [s.id, s])),
    [stops]
  )

  const { hotels, saveHotel } = useHotels(stopIds)
  const { activities, updateActivity } = useActivities(stopIds)
  const { saveItem, getAmount } = useBudgetItems(currentTrip?.id ?? null)

  // ── Sorterte hotellrader ────────────────────────────────────────────────
  const hotelRows = useMemo(() => {
    return hotels
      .map((h) => ({ hotel: h, stop: stopById[h.stop_id] }))
      .filter((r) => r.stop)
      .sort((a, b) => a.stop.order - b.stop.order)
  }, [hotels, stopById])

  // ── Sorterte aktivitetsrader ────────────────────────────────────────────
  const activityRows = useMemo(() => {
    return activities
      .map((a) => ({ activity: a, stop: stopById[a.stop_id] }))
      .filter((r) => r.stop)
      .sort((a, b) => {
        if (a.stop.order !== b.stop.order) return a.stop.order - b.stop.order
        if (a.activity.activity_date && b.activity.activity_date)
          return a.activity.activity_date.localeCompare(b.activity.activity_date)
        return 0
      })
  }, [activities, stopById])

  // ── Totaler ─────────────────────────────────────────────────────────────
  const totalHotels = hotelRows.reduce((s, r) => s + (r.hotel.cost ?? 0), 0)
  const totalActivities = activityRows.reduce((s, r) => s + (r.activity.cost ?? 0), 0)
  const totalFlight = getAmount('flight')
  const totalCar = getAmount('car')
  const totalGas = getAmount('gas')
  const totalOther = totalFlight + totalCar + totalGas
  const grandTotal = totalHotels + totalActivities + totalOther

  const loading = stopsLoading

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">
      {/* ── Toppbar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Receipt className="w-5 h-5 text-green-400" />
          <h1 className="text-lg font-bold text-white">Kostnader</h1>
        </div>

        <div className="relative ml-auto">
          {tripsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Laster turer…</span>
            </div>
          ) : (
            <div className="relative inline-flex items-center">
              <select
                value={currentTrip?.id ?? ''}
                onChange={(e) => {
                  const t = trips.find((t) => t.id === e.target.value)
                  if (t) setCurrentTrip(t)
                }}
                className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-4 pr-9 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Velg tur…</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.year})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>
      </div>

      {/* ── Innhold ─────────────────────────────────────────────────────── */}
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
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* ══ HOTELLER ══════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                icon={<BedDouble className="w-4 h-4 text-blue-400" />}
                title="Hoteller"
              />
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                {/* Kolonne-hoder */}
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] border-b border-slate-800 bg-slate-800/50">
                  <Th>Hotellnavn</Th>
                  <Th>By</Th>
                  <Th right>Netter</Th>
                  <Th right>Kostnad</Th>
                  <Th right>Snitt / natt</Th>
                </div>

                {hotelRows.length === 0 ? (
                  <EmptyState text="Ingen hoteller registrert ennå" />
                ) : (
                  hotelRows.map(({ hotel, stop }, i) => {
                    const avgPerNight =
                      hotel.cost && stop.nights > 0
                        ? hotel.cost / stop.nights
                        : null
                    return (
                      <div
                        key={hotel.id}
                        className={`grid grid-cols-[1fr_1fr_auto_auto_auto] ${
                          i % 2 === 0 ? '' : 'bg-slate-800/30'
                        } hover:bg-slate-800/60 transition-colors`}
                      >
                        <Td>{hotel.name || <span className="text-slate-500 italic">Ukjent</span>}</Td>
                        <Td>
                          {stop.city}
                          {stop.state && (
                            <span className="text-slate-500">, {stop.state}</span>
                          )}
                        </Td>
                        <Td right>{stop.nights}</Td>
                        <Td right>
                          <CostInput
                            key={`${hotel.id}-${hotel.cost}`}
                            defaultValue={hotel.cost}
                            onSave={(v) => saveHotel(hotel.stop_id, { cost: v })}
                          />
                        </Td>
                        <Td right muted>
                          {avgPerNight !== null ? `${fmt(avgPerNight)} kr` : '—'}
                        </Td>
                      </div>
                    )
                  })
                )}

                {/* Totalrad */}
                <div className="border-t border-slate-700 bg-slate-800/50 flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-semibold text-slate-300">Total hoteller</span>
                  <span className="text-sm font-bold text-white">{fmt(totalHotels)} kr</span>
                </div>
              </div>
            </section>

            {/* ══ AKTIVITETER ═══════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                icon={<Ticket className="w-4 h-4 text-purple-400" />}
                title="Aktiviteter"
              />
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                {/* Kolonne-hoder */}
                <div className="grid grid-cols-[1fr_1fr_auto_auto] border-b border-slate-800 bg-slate-800/50">
                  <Th>Aktivitet</Th>
                  <Th>By</Th>
                  <Th right>Dato</Th>
                  <Th right>Kostnad</Th>
                </div>

                {activityRows.length === 0 ? (
                  <EmptyState text="Ingen aktiviteter registrert ennå" />
                ) : (
                  activityRows.map(({ activity, stop }, i) => (
                    <div
                      key={activity.id}
                      className={`grid grid-cols-[1fr_1fr_auto_auto] ${
                        i % 2 === 0 ? '' : 'bg-slate-800/30'
                      } hover:bg-slate-800/60 transition-colors`}
                    >
                      <Td>{activity.name}</Td>
                      <Td>
                        {stop.city}
                        {stop.state && (
                          <span className="text-slate-500">, {stop.state}</span>
                        )}
                      </Td>
                      <Td right muted>{fmtDate(activity.activity_date)}</Td>
                      <Td right>
                        <CostInput
                          key={`${activity.id}-${activity.cost}`}
                          defaultValue={activity.cost}
                          onSave={(v) => updateActivity(activity.id, { cost: v })}
                        />
                      </Td>
                    </div>
                  ))
                )}

                {/* Totalrad */}
                <div className="border-t border-slate-700 bg-slate-800/50 flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-semibold text-slate-300">Total aktiviteter</span>
                  <span className="text-sm font-bold text-white">{fmt(totalActivities)} kr</span>
                </div>
              </div>
            </section>

            {/* ══ ANDRE KOSTNADER ═══════════════════════════════════════════ */}
            <section key={currentTrip.id}>
              <SectionHeader
                icon={<Plane className="w-4 h-4 text-sky-400" />}
                title="Andre kostnader"
              />
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
                {[
                  {
                    key: 'flight' as const,
                    label: 'Fly',
                    icon: <Plane className="w-4 h-4 text-sky-400" />,
                    amount: totalFlight,
                  },
                  {
                    key: 'car' as const,
                    label: 'Leiebil',
                    icon: <Car className="w-4 h-4 text-violet-400" />,
                    amount: totalCar,
                  },
                  {
                    key: 'gas' as const,
                    label: 'Bensin (estimat)',
                    icon: <Fuel className="w-4 h-4 text-amber-400" />,
                    amount: totalGas,
                  },
                ].map(({ key, label, icon, amount }) => (
                  <div
                    key={key}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {icon}
                    </div>
                    <span className="flex-1 text-sm text-slate-200">{label}</span>
                    <div className="flex items-center gap-2">
                      <CostInput
                        defaultValue={amount || null}
                        onSave={(v) => saveItem(key, v)}
                      />
                      <span className="text-sm text-slate-500 w-5">kr</span>
                    </div>
                  </div>
                ))}

                {/* Totalrad */}
                <div className="bg-slate-800/50 flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm font-semibold text-slate-300">Total andre</span>
                  <span className="text-sm font-bold text-white">{fmt(totalOther)} kr</span>
                </div>
              </div>
            </section>

            {/* ══ TOTALSUM ══════════════════════════════════════════════════ */}
            <section>
              <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/30 border border-green-700/50 rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-400/80 uppercase tracking-wide mb-0.5">
                    Totalsum
                  </p>
                  <p className="text-xs text-slate-400">
                    Hoteller + aktiviteter + fly + leiebil + bensin
                  </p>
                </div>
                <span className="text-3xl font-extrabold text-green-400 tabular-nums">
                  {fmt(grandTotal)} kr
                </span>
              </div>

              {/* Oppsummering */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Hoteller', value: totalHotels },
                  { label: 'Aktiviteter', value: totalActivities },
                  { label: 'Fly + leiebil', value: totalFlight + totalCar },
                  { label: 'Bensin', value: totalGas },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-center"
                  >
                    <p className="text-[11px] text-slate-500 mb-1">{label}</p>
                    <p className="text-sm font-semibold text-slate-200">{fmt(value)} kr</p>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>
      )}
    </div>
  )
}
