'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plane, ChevronDown, PlaneLanding, PlaneTakeoff, Clock } from 'lucide-react'
import { Flight } from '@/types'
import { useFlights } from '@/hooks/useFlights'
import {
  Airport,
  filterAirports,
  getOffset,
  calcFlightMinutes,
  calcStopoverMinutes,
  formatDuration,
} from '@/data/airports'

// ── Hjelpere ────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
      {children}
    </p>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 border-t border-slate-700/60" />
      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
        {label}
      </span>
      <div className="flex-1 border-t border-slate-700/60" />
    </div>
  )
}

/** Viser beregnet flytid eller ventetid som et lite merke. */
function DurationBadge({ minutes, label }: { minutes: number; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1 py-0.5 text-[10px] text-sky-500/80">
      <Clock className="w-2.5 h-2.5 flex-shrink-0" />
      <span>{label}: {formatDuration(minutes)}</span>
    </div>
  )
}

// ── Flyplass-autocomplete ─────────────────────────────────────────────────────

interface AirportInputProps {
  defaultValue?: string | null
  placeholder?: string
  onSave: (v: string) => void
}

function AirportInput({ defaultValue, placeholder, onSave }: AirportInputProps) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [results, setResults] = useState<Airport[]>([])
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 200 })
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function updatePos() {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 2, left: r.left, width: r.width })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setValue(q)
    const matches = filterAirports(q)
    setResults(matches)
    if (matches.length > 0) { setOpen(true); updatePos() }
    else setOpen(false)
  }

  function handleSelect(airport: Airport) {
    const formatted = `${airport.code} – ${airport.city}`
    setValue(formatted)
    setResults([])
    setOpen(false)
    onSave(formatted)
  }

  function handleBlur() {
    // Gir dropdown-klikk tid til å registrere seg (onMouseDown) før blur avslutter
    setTimeout(() => setOpen(false), 150)
    onSave(value.trim())
  }

  const dropdown = open && results.length > 0 && mounted
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: Math.max(dropPos.width, 260),
            zIndex: 9999,
          }}
          className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden"
        >
          {results.map((a) => (
            <button
              key={a.code}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(a) }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-700 transition-colors flex items-center gap-2.5 border-b border-slate-700/40 last:border-0"
            >
              <span className="font-mono text-xs font-bold text-sky-400 w-9 flex-shrink-0">
                {a.code}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-200 truncate">{a.city}</p>
                <p className="text-[10px] text-slate-500 truncate">{a.name}</p>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )
    : null

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (results.length > 0) { setOpen(true); updatePos() }
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
          if (e.key === 'Enter') inputRef.current?.blur()
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
      />
      {dropdown}
    </>
  )
}

// ── Vanlig tekstfelt ──────────────────────────────────────────────────────────

function Txt({
  defaultValue, placeholder, onSave,
}: { defaultValue?: string | null; placeholder?: string; onSave: (v: string) => void }) {
  return (
    <input
      type="text"
      defaultValue={defaultValue ?? ''}
      placeholder={placeholder}
      onBlur={(e) => onSave(e.target.value.trim())}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
    />
  )
}

function Time({ defaultValue, onSave }: { defaultValue?: string | null; onSave: (v: string) => void }) {
  return (
    <input
      type="time"
      defaultValue={defaultValue ?? ''}
      onBlur={(e) => onSave(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
    />
  )
}

function DateInput({ defaultValue, onSave }: { defaultValue?: string | null; onSave: (v: string) => void }) {
  return (
    <input
      type="date"
      defaultValue={defaultValue ?? ''}
      onBlur={(e) => onSave(e.target.value)}
      onChange={(e) => onSave(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
    />
  )
}

// ── Flyskjema for én retning ─────────────────────────────────────────────────

interface FlightFormProps {
  flight: Flight | null
  onSave: (updates: Partial<Omit<Flight, 'id' | 'trip_id' | 'direction'>>) => void
}

function FlightForm({ flight, onSave }: FlightFormProps) {
  const stopover = flight?.has_stopover ?? false

  // Offsets for tidssoneberegning
  const fromOffset  = getOffset(flight?.leg1_from)
  const viaOffset   = getOffset(flight?.leg1_to)   // mellomstasjon ELLER endelig (direktefly)
  const finalOffset = getOffset(flight?.leg2_to)

  // Beregnet flytid
  const leg1Min = calcFlightMinutes(
    flight?.leg1_departure, fromOffset,
    flight?.leg1_arrival,   viaOffset,
  )
  const leg2Min = stopover
    ? calcFlightMinutes(
        flight?.leg2_departure, viaOffset,
        flight?.leg2_arrival,   finalOffset,
      )
    : null

  // Beregnet ventetid på mellomlandingsflyplass (automatisk)
  const stopoverMin = stopover
    ? calcStopoverMinutes(flight?.leg1_arrival, flight?.leg2_departure)
    : null

  function saveLeg1Arrival(v: string) { onSave({ leg1_arrival: v }) }
  function saveLeg2Departure(v: string) { onSave({ leg2_departure: v }) }

  return (
    <div className="px-4 pt-2 pb-4 space-y-2.5">

      {/* Dato */}
      <div>
        <Label>Dato</Label>
        <DateInput
          key={`date-${flight?.id}`}
          defaultValue={flight?.flight_date}
          onSave={(v) => onSave({ flight_date: v })}
        />
      </div>

      {/* Fra */}
      <div>
        <Label>Fra (flyplass / by)</Label>
        <AirportInput
          key={`from-${flight?.id}`}
          defaultValue={flight?.leg1_from}
          placeholder="OSL – Oslo"
          onSave={(v) => onSave({ leg1_from: v })}
        />
      </div>

      {/* Avgang + Flightnr. – etappe 1 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Avgang</Label>
          <Time
            key={`dep1-${flight?.id}`}
            defaultValue={flight?.leg1_departure}
            onSave={(v) => onSave({ leg1_departure: v })}
          />
        </div>
        <div>
          <Label>Flightnr.</Label>
          <Txt
            key={`fn1-${flight?.id}`}
            defaultValue={flight?.leg1_flight_nr}
            placeholder="DY 7081"
            onSave={(v) => onSave({ leg1_flight_nr: v })}
          />
        </div>
      </div>

      {/* Mellomlanding toggle */}
      <label className="flex items-center gap-2 py-0.5 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={stopover}
          onChange={(e) => onSave({ has_stopover: e.target.checked })}
          className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
        />
        <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
          Mellomlanding
        </span>
      </label>

      {!stopover ? (
        /* ── Direktefly: ankomst + destinasjon ── */
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ankomst</Label>
              <Time
                key={`arr-d-${flight?.id}`}
                defaultValue={flight?.leg1_arrival}
                onSave={(v) => onSave({ leg1_arrival: v })}
              />
            </div>
            <div>
              <Label>Destinasjon</Label>
              <AirportInput
                key={`to-d-${flight?.id}`}
                defaultValue={flight?.leg1_to}
                placeholder="JFK – New York"
                onSave={(v) => onSave({ leg1_to: v })}
              />
            </div>
          </div>
          {/* Flytid – direktefly */}
          {leg1Min !== null && (
            <DurationBadge minutes={leg1Min} label="Flytid" />
          )}
        </>
      ) : (
        <>
          {/* ── Ankomst mellomlanding + mellomstasjon ── */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ankomst</Label>
              <Time
                key={`arr1-s-${flight?.id}`}
                defaultValue={flight?.leg1_arrival}
                onSave={saveLeg1Arrival}
              />
            </div>
            <div>
              <Label>Mellomstasjon</Label>
              <AirportInput
                key={`stop-${flight?.id}`}
                defaultValue={flight?.leg1_to}
                placeholder="AMS – Amsterdam"
                onSave={(v) => onSave({ leg1_to: v })}
              />
            </div>
          </div>

          {/* Flytid etappe 1 */}
          {leg1Min !== null && (
            <DurationBadge minutes={leg1Min} label="Flytid etappe 1" />
          )}

          {/* Ventetid på mellomlandingsflyplass – beregnes automatisk */}
          {stopoverMin !== null && (
            <DurationBadge minutes={stopoverMin} label="Ventetid på flyplass" />
          )}

          <Divider label="Neste etappe" />

          {/* Avgang etappe 2 + flightnr. */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Avgang</Label>
              <Time
                key={`dep2-${flight?.id}`}
                defaultValue={flight?.leg2_departure}
                onSave={saveLeg2Departure}
              />
            </div>
            <div>
              <Label>Flightnr.</Label>
              <Txt
                key={`fn2-${flight?.id}`}
                defaultValue={flight?.leg2_flight_nr}
                placeholder="KL 0870"
                onSave={(v) => onSave({ leg2_flight_nr: v })}
              />
            </div>
          </div>

          {/* Ankomst + endelig destinasjon */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ankomst</Label>
              <Time
                key={`arr2-${flight?.id}`}
                defaultValue={flight?.leg2_arrival}
                onSave={(v) => onSave({ leg2_arrival: v })}
              />
            </div>
            <div>
              <Label>Endelig destinasjon</Label>
              <AirportInput
                key={`to2-${flight?.id}`}
                defaultValue={flight?.leg2_to}
                placeholder="JFK – New York"
                onSave={(v) => onSave({ leg2_to: v })}
              />
            </div>
          </div>

          {/* Flytid etappe 2 */}
          {leg2Min !== null && (
            <DurationBadge minutes={leg2Min} label="Flytid etappe 2" />
          )}
        </>
      )}
    </div>
  )
}

// ── FlightSummaryLine ─────────────────────────────────────────────────────────

function FlightSummary({
  outbound, returnFlight,
}: { outbound: Flight | null; returnFlight: Flight | null }) {
  const parts: string[] = []
  if (outbound?.leg1_from) parts.push(outbound.leg1_from.split(/[\s–]/)[0])
  if (outbound?.leg1_to || outbound?.leg2_to) {
    const dest = outbound.has_stopover ? outbound.leg2_to : outbound.leg1_to
    if (dest) parts.push(dest.split(/[\s–]/)[0])
  }
  if (parts.length === 0) return null
  return (
    <span className="text-xs text-slate-500 ml-auto mr-1 truncate max-w-[120px]">
      {parts.join(' → ')}
    </span>
  )
}

// ── Hoveddkomponent ──────────────────────────────────────────────────────────

interface FlightPanelProps {
  tripId: string
}

export default function FlightPanel({ tripId }: FlightPanelProps) {
  const { outbound, returnFlight, saveFlight } = useFlights(tripId)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'outbound' | 'return'>('outbound')

  const activeFlight = tab === 'outbound' ? outbound : returnFlight

  return (
    <div className="border-t border-slate-800">
      {/* ── Header-knapp ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-slate-300 hover:bg-slate-800/50 transition-colors"
      >
        <Plane className="w-4 h-4 text-sky-400 flex-shrink-0" />
        <span>Fly tur/retur</span>
        <FlightSummary outbound={outbound} returnFlight={returnFlight} />
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ── Utvidet innhold ── */}
      {open && (
        <div className="border-t border-slate-800/60">
          {/* Tab-rad */}
          <div className="flex gap-0 border-b border-slate-800 bg-slate-900/50">
            {(
              [
                { dir: 'outbound', label: 'Utreise',   icon: PlaneTakeoff, flight: outbound },
                { dir: 'return',   label: 'Hjemreise', icon: PlaneLanding, flight: returnFlight },
              ] as const
            ).map(({ dir, label, icon: Icon, flight }) => {
              const dateStr = flight?.flight_date
                ? new Date(flight.flight_date + 'T12:00:00').toLocaleDateString('nb-NO', {
                    day: 'numeric', month: 'short',
                  })
                : null
              return (
                <button
                  key={dir}
                  onClick={() => setTab(dir)}
                  className={`flex-1 flex flex-col items-center justify-center px-3 py-2 text-xs font-semibold transition-colors ${
                    tab === dir
                      ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800/40'
                      : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </div>
                  {dateStr && (
                    <span className={`text-[10px] mt-0.5 ${tab === dir ? 'text-sky-500/70' : 'text-slate-600'}`}>
                      {dateStr}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Skjema – remount ved tab-skifte og mellomlanding-toggle */}
          <FlightForm
            key={`${tab}-${activeFlight?.has_stopover ?? false}`}
            flight={activeFlight}
            onSave={(updates) => saveFlight(tab, updates)}
          />
        </div>
      )}
    </div>
  )
}
