'use client'

import { useState } from 'react'
import { Plane, ChevronDown, ArrowLeftRight, PlaneLanding, PlaneTakeoff } from 'lucide-react'
import { Flight } from '@/types'
import { useFlights } from '@/hooks/useFlights'

// ── Hjelpere ────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
      {children}
    </p>
  )
}

interface TxtProps {
  defaultValue?: string | null
  placeholder?: string
  onSave: (v: string) => void
}
function Txt({ defaultValue, placeholder, onSave }: TxtProps) {
  return (
    <input
      type="text"
      defaultValue={defaultValue ?? ''}
      placeholder={placeholder}
      onBlur={(e) => onSave(e.target.value.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
    />
  )
}

interface TimeProps {
  defaultValue?: string | null
  onSave: (v: string) => void
}
function Time({ defaultValue, onSave }: TimeProps) {
  return (
    <input
      type="time"
      defaultValue={defaultValue ?? ''}
      onBlur={(e) => onSave(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
    />
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

// ── Flyskjema for én retning ─────────────────────────────────────────────────

interface FlightFormProps {
  flight: Flight | null
  onSave: (updates: Partial<Omit<Flight, 'id' | 'trip_id' | 'direction'>>) => void
}

function FlightForm({ flight, onSave }: FlightFormProps) {
  const stopover = flight?.has_stopover ?? false

  return (
    <div className="px-4 pt-2 pb-4 space-y-2.5">

      {/* Fra */}
      <div>
        <Label>Fra (flyplass / by)</Label>
        <Txt
          key={`from-${flight?.id}`}
          defaultValue={flight?.leg1_from}
          placeholder="Oslo Lufthavn (OSL)"
          onSave={(v) => onSave({ leg1_from: v })}
        />
      </div>

      {/* Avgang + Flightnr. */}
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
            <Txt
              key={`to-d-${flight?.id}`}
              defaultValue={flight?.leg1_to}
              placeholder="JFK, New York"
              onSave={(v) => onSave({ leg1_to: v })}
            />
          </div>
        </div>
      ) : (
        <>
          {/* ── Ankomst mellomlanding ── */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ankomst</Label>
              <Time
                key={`arr1-s-${flight?.id}`}
                defaultValue={flight?.leg1_arrival}
                onSave={(v) => onSave({ leg1_arrival: v })}
              />
            </div>
            <div>
              <Label>Mellomstasjon</Label>
              <Txt
                key={`stop-${flight?.id}`}
                defaultValue={flight?.leg1_to}
                placeholder="AMS, Amsterdam"
                onSave={(v) => onSave({ leg1_to: v })}
              />
            </div>
          </div>

          {/* Tid på flyplass */}
          <div>
            <Label>Tid på flyplass</Label>
            <Txt
              key={`dur-${flight?.id}`}
              defaultValue={flight?.stopover_duration}
              placeholder="1t 30min"
              onSave={(v) => onSave({ stopover_duration: v })}
            />
          </div>

          <Divider label="Neste etappe" />

          {/* Avgang etappe 2 + flightnr. */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Avgang</Label>
              <Time
                key={`dep2-${flight?.id}`}
                defaultValue={flight?.leg2_departure}
                onSave={(v) => onSave({ leg2_departure: v })}
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

          {/* Ankomst endelig destinasjon */}
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
              <Txt
                key={`to2-${flight?.id}`}
                defaultValue={flight?.leg2_to}
                placeholder="JFK, New York"
                onSave={(v) => onSave({ leg2_to: v })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── FlightSummaryLine: kort oppsummering i kollapset tilstand ────────────────

function FlightSummary({ outbound, returnFlight }: { outbound: Flight | null; returnFlight: Flight | null }) {
  const parts: string[] = []
  if (outbound?.leg1_from) parts.push(outbound.leg1_from.split(' ')[0])
  if (outbound?.leg1_to || outbound?.leg2_to) {
    const dest = outbound.has_stopover ? outbound.leg2_to : outbound.leg1_to
    if (dest) parts.push(dest.split(',')[0])
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
        <div className="max-h-[480px] overflow-y-auto border-t border-slate-800/60">
          {/* Tab-rad */}
          <div className="flex gap-0 border-b border-slate-800 bg-slate-900/50">
            {(
              [
                { dir: 'outbound', label: 'Utreise', icon: PlaneTakeoff },
                { dir: 'return', label: 'Hjemreise', icon: PlaneLanding },
              ] as const
            ).map(({ dir, label, icon: Icon }) => (
              <button
                key={dir}
                onClick={() => setTab(dir)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors ${
                  tab === dir
                    ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800/40'
                    : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
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
