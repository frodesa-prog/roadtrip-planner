'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plane, Train, Users, ChevronDown, PlaneLanding, PlaneTakeoff, Clock,
  Plus, Pencil, Trash2, Check, X, Link2, Loader2,
} from 'lucide-react'
import { Flight, Traveler, TransportType } from '@/types'
import { useFlights } from '@/hooks/useFlights'
import { useTravelers } from '@/hooks/useTravelers'
import type { LinkedTravelerResult } from '@/hooks/useTravelers'
import {
  Airport, filterAirports, getOffset,
  calcFlightMinutes, calcStopoverMinutes, formatDuration,
} from '@/data/airports'
import { TRAVEL_INTERESTS, parseInterests } from '@/lib/travelInterests'

// ── Flight form helpers ───────────────────────────────────────────────────────

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
      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{label}</span>
      <div className="flex-1 border-t border-slate-700/60" />
    </div>
  )
}

function DurationBadge({ minutes, label }: { minutes: number; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1 py-0.5 text-[10px] text-sky-500/80">
      <Clock className="w-2.5 h-2.5 flex-shrink-0" />
      <span>{label}: {formatDuration(minutes)}</span>
    </div>
  )
}

function AirportInput({ defaultValue, placeholder, onSave }: {
  defaultValue?: string | null
  placeholder?: string
  onSave: (v: string) => void
}) {
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
    if (matches.length > 0) { setOpen(true); updatePos() } else setOpen(false)
  }
  function handleSelect(airport: Airport) {
    const formatted = `${airport.code} – ${airport.city}`
    setValue(formatted); setResults([]); setOpen(false); onSave(formatted)
  }
  function handleBlur() {
    setTimeout(() => setOpen(false), 150)
    onSave(value.trim())
  }

  const dropdown = open && results.length > 0 && mounted
    ? createPortal(
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: Math.max(dropPos.width, 260), zIndex: 9999 }}
          className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden"
        >
          {results.map((a) => (
            <button
              key={a.code}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(a) }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-700 transition-colors flex items-center gap-2.5 border-b border-slate-700/40 last:border-0"
            >
              <span className="font-mono text-xs font-bold text-sky-400 w-9 flex-shrink-0">{a.code}</span>
              <div className="min-w-0">
                <p className="text-xs text-slate-200 truncate">{a.city}</p>
                <p className="text-[10px] text-slate-500 truncate">{a.name}</p>
              </div>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => { if (results.length > 0) { setOpen(true); updatePos() } }}
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

function Txt({ defaultValue, placeholder, onSave }: {
  defaultValue?: string | null; placeholder?: string; onSave: (v: string) => void
}) {
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

function TimeInput({ defaultValue, onSave }: { defaultValue?: string | null; onSave: (v: string) => void }) {
  return (
    <input
      type="time"
      defaultValue={defaultValue ?? ''}
      onBlur={(e) => onSave(e.target.value)}
      className="w-full h-7 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
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
      className="w-full h-7 bg-slate-800 border border-slate-700 rounded-lg px-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
    />
  )
}

function FlightForm({ flight, onSave, tripDateFrom, transportType = 'fly' }: {
  flight: Flight | null
  onSave: (updates: Partial<Omit<Flight, 'id' | 'trip_id' | 'direction'>>) => void
  tripDateFrom?: string
  transportType?: TransportType
}) {
  const isTrain = transportType === 'tog'
  const stopover = flight?.has_stopover ?? false
  const fromOffset  = getOffset(flight?.leg1_from)
  const viaOffset   = getOffset(flight?.leg1_to)
  const finalOffset = getOffset(flight?.leg2_to)
  const leg1Min = calcFlightMinutes(flight?.leg1_departure, fromOffset, flight?.leg1_arrival, viaOffset)
  const leg2Min = stopover
    ? calcFlightMinutes(flight?.leg2_departure, viaOffset, flight?.leg2_arrival, finalOffset)
    : null
  const stopoverMin = stopover ? calcStopoverMinutes(flight?.leg1_arrival, flight?.leg2_departure) : null
  const totalMin = stopover && leg1Min !== null && stopoverMin !== null && leg2Min !== null
    ? leg1Min + stopoverMin + leg2Min
    : null

  function saveLeg1Arrival(v: string)   { onSave({ leg1_arrival: v }) }
  function saveLeg2Departure(v: string) { onSave({ leg2_departure: v }) }

  return (
    <div className="px-4 pt-2 pb-4 space-y-2.5">

      {/* Dato | Avgang */}
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Dato</Label><DateInput key={`date-${flight?.id}`} defaultValue={flight?.flight_date ?? tripDateFrom} onSave={(v) => onSave({ flight_date: v })} /></div>
        <div><Label>Avgang</Label><TimeInput key={`dep1-${flight?.id}`} defaultValue={flight?.leg1_departure} onSave={(v) => onSave({ leg1_departure: v })} /></div>
      </div>

      {/* Rutenr./Flightnr. | Fra (holdeplass/flyplass) */}
      <div className="grid grid-cols-2 gap-2">
        <div><Label>{isTrain ? 'Rutenr.' : 'Flightnr.'}</Label><Txt key={`fn1-${flight?.id}`} defaultValue={flight?.leg1_flight_nr} placeholder={isTrain ? 'R10' : 'DY 7081'} onSave={(v) => onSave({ leg1_flight_nr: v })} /></div>
        <div>
          <Label>{isTrain ? 'Holdeplass (avgang)' : 'Fra (flyplass / by)'}</Label>
          {isTrain
            ? <Txt key={`from-${flight?.id}`} defaultValue={flight?.leg1_from} placeholder="Oslo S" onSave={(v) => onSave({ leg1_from: v })} />
            : <AirportInput key={`from-${flight?.id}`} defaultValue={flight?.leg1_from} placeholder="OSL – Oslo" onSave={(v) => onSave({ leg1_from: v })} />
          }
        </div>
      </div>

      {/* Billett + sete + Mellomstopp/Mellomlanding på samme linje */}
      <div className="flex items-end gap-1.5">
        <div className="flex-[2] min-w-0">
          <Label>Billettkategori</Label>
          <Txt key={`tc-1-${flight?.id}`} defaultValue={flight?.ticket_class} placeholder="Economy" onSave={(v) => onSave({ ticket_class: v })} />
        </div>
        <div className="w-12 flex-shrink-0">
          <Label>Rad</Label>
          <Txt key={`sr-1-${flight?.id}`} defaultValue={flight?.seat_row} placeholder="24" onSave={(v) => onSave({ seat_row: v })} />
        </div>
        <div className="w-10 flex-shrink-0">
          <Label>Sete</Label>
          <Txt key={`sn-1-${flight?.id}`} defaultValue={flight?.seat_number} placeholder="A" onSave={(v) => onSave({ seat_number: v })} />
        </div>
        <label className="flex-shrink-0 flex items-center gap-1.5 mb-[3px] cursor-pointer select-none group">
          <input type="checkbox" checked={stopover} onChange={(e) => onSave({ has_stopover: e.target.checked })} className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer" />
          <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{isTrain ? 'Mellomstopp' : 'Mellomlanding'}</span>
        </label>
      </div>

      {/* Reisetid/Flytid etappe 1 – midtstilt */}
      {leg1Min !== null && (
        <div className="flex justify-center">
          <DurationBadge minutes={leg1Min} label={stopover ? (isTrain ? 'Reisetid etappe 1' : 'Flytid etappe 1') : (isTrain ? 'Reisetid' : 'Flytid')} />
        </div>
      )}

      {!stopover ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Ankomst</Label><TimeInput key={`arr-d-${flight?.id}`} defaultValue={flight?.leg1_arrival} onSave={saveLeg1Arrival} /></div>
            <div>
              <Label>{isTrain ? 'Holdeplass (destinasjon)' : 'Destinasjon'}</Label>
              {isTrain
                ? <Txt key={`to-d-${flight?.id}`} defaultValue={flight?.leg1_to} placeholder="Bergen stasjon" onSave={(v) => onSave({ leg1_to: v })} />
                : <AirportInput key={`to-d-${flight?.id}`} defaultValue={flight?.leg1_to} placeholder="JFK – New York" onSave={(v) => onSave({ leg1_to: v })} />
              }
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Ankomst</Label><TimeInput key={`arr1-s-${flight?.id}`} defaultValue={flight?.leg1_arrival} onSave={saveLeg1Arrival} /></div>
            <div>
              <Label>{isTrain ? 'Holdeplass (mellomstopp)' : 'Mellomstasjon'}</Label>
              {isTrain
                ? <Txt key={`stop-${flight?.id}`} defaultValue={flight?.leg1_to} placeholder="Myrdal" onSave={(v) => onSave({ leg1_to: v })} />
                : <AirportInput key={`stop-${flight?.id}`} defaultValue={flight?.leg1_to} placeholder="AMS – Amsterdam" onSave={(v) => onSave({ leg1_to: v })} />
              }
            </div>
          </div>
          {stopoverMin !== null && <DurationBadge minutes={stopoverMin} label={isTrain ? 'Ventetid på holdeplass' : 'Ventetid på flyplass'} />}
          <Divider label="Neste etappe" />
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Avgang</Label><TimeInput key={`dep2-${flight?.id}`} defaultValue={flight?.leg2_departure} onSave={saveLeg2Departure} /></div>
            <div><Label>{isTrain ? 'Rutenr.' : 'Flightnr.'}</Label><Txt key={`fn2-${flight?.id}`} defaultValue={flight?.leg2_flight_nr} placeholder={isTrain ? 'R10' : 'KL 0870'} onSave={(v) => onSave({ leg2_flight_nr: v })} /></div>
          </div>

          {/* Billett + sete etappe 2 */}
          <div className="flex items-end gap-1.5">
            <div className="flex-[2] min-w-0">
              <Label>Billettkategori</Label>
              <Txt key={`tc-2-${flight?.id}`} defaultValue={flight?.leg2_ticket_class} placeholder="Economy" onSave={(v) => onSave({ leg2_ticket_class: v })} />
            </div>
            <div className="w-12 flex-shrink-0">
              <Label>Rad</Label>
              <Txt key={`sr-2-${flight?.id}`} defaultValue={flight?.leg2_seat_row} placeholder="24" onSave={(v) => onSave({ leg2_seat_row: v })} />
            </div>
            <div className="w-10 flex-shrink-0">
              <Label>Sete</Label>
              <Txt key={`sn-2-${flight?.id}`} defaultValue={flight?.leg2_seat_number} placeholder="A" onSave={(v) => onSave({ leg2_seat_number: v })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label>Ankomst</Label><TimeInput key={`arr2-${flight?.id}`} defaultValue={flight?.leg2_arrival} onSave={(v) => onSave({ leg2_arrival: v })} /></div>
            <div>
              <Label>{isTrain ? 'Holdeplass (destinasjon)' : 'Endelig destinasjon'}</Label>
              {isTrain
                ? <Txt key={`to2-${flight?.id}`} defaultValue={flight?.leg2_to} placeholder="Bergen stasjon" onSave={(v) => onSave({ leg2_to: v })} />
                : <AirportInput key={`to2-${flight?.id}`} defaultValue={flight?.leg2_to} placeholder="JFK – New York" onSave={(v) => onSave({ leg2_to: v })} />
              }
            </div>
          </div>
          {leg2Min !== null && (
            <div className="flex justify-center">
              <DurationBadge minutes={leg2Min} label={isTrain ? 'Reisetid etappe 2' : 'Flytid etappe 2'} />
            </div>
          )}
          {/* Total reisetid */}
          {totalMin !== null && (
            <div className="pt-1 border-t border-slate-700/50">
              <div className="flex items-center justify-center gap-1 py-0.5 text-[10px] font-semibold text-emerald-500/80">
                <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                <span>Total reisetid: {formatDuration(totalMin)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Traveler helpers ──────────────────────────────────────────────────────────

// Interessekategorier importert fra lib/travelInterests.ts
const INTERESTS = TRAVEL_INTERESTS

const GENDERS = [
  { value: 'mann',   label: 'Mann' },
  { value: 'kvinne', label: 'Kvinne' },
  { value: 'annet',  label: 'Annet' },
]

function genderEmoji(gender: string | null) {
  if (gender === 'mann') return '👨'
  return '🧑'
}

function GenderIcon({ gender, size }: { gender: string | null; size: number }) {
  if (gender === 'kvinne') {
    return <img src="/femailemoji.png" alt="Kvinne" width={size} height={size} className="object-contain" />
  }
  return <span className="leading-none" style={{ fontSize: size }}>{genderEmoji(gender)}</span>
}

interface FormState {
  name: string
  age: string
  gender: string
  interests: string[]
  description: string
}

function blankForm(): FormState {
  return { name: '', age: '', gender: '', interests: [], description: '' }
}

function travelerToForm(t: Traveler): FormState {
  return {
    name: t.name,
    age: t.age != null ? String(t.age) : '',
    gender: t.gender ?? '',
    interests: parseInterests(t.interests),
    description: t.description ?? '',
  }
}

function TravelerForm({
  initial, onSave, onCancel, isSaving,
}: {
  initial: FormState
  onSave: (form: FormState) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)

  function toggleInterest(label: string) {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(label)
        ? prev.interests.filter((i) => i !== label)
        : [...prev.interests, label],
    }))
  }

  return (
    <div className="space-y-3">
      {/* Name + Age */}
      <div className="grid grid-cols-[1fr_4.5rem] gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Navn *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Fornavn og etternavn"
            className="w-full h-7 rounded-md bg-slate-800 border border-slate-700 px-2.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/60"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Alder</label>
          <input
            type="number"
            min={0}
            max={120}
            value={form.age}
            onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
            placeholder="–"
            className="w-full h-7 rounded-md bg-slate-800 border border-slate-700 px-2 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/60"
          />
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-500">Kjønn</label>
        <div className="flex gap-1.5">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setForm((p) => ({ ...p, gender: p.gender === g.value ? '' : g.value }))}
              className={`flex-1 py-1 text-xs rounded-md border transition-colors ${
                form.gender === g.value
                  ? 'bg-blue-600/30 border-blue-500/60 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-500">Interesser</label>
        <div className="flex flex-wrap gap-1">
          {INTERESTS.map((i) => (
            <button
              key={i.label}
              type="button"
              onClick={() => toggleInterest(i.label)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                form.interests.includes(i.label)
                  ? 'bg-blue-600/30 border-blue-500/60 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {i.emoji} {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-500">Beskrivelse</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Litt om personen, preferanser…"
          rows={2}
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/60 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-3 h-3" /> Avbryt
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || isSaving}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check className="w-3 h-3" /> Lagre
        </button>
      </div>
    </div>
  )
}

function TravelerCard({
  traveler, onUpdate, onDelete,
}: {
  traveler: Traveler
  onUpdate: (id: string, form: FormState) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const interests = useMemo(() => {
    const parsed = parseInterests(traveler.interests)
    return INTERESTS.filter((i) => parsed.includes(i.label))
  }, [traveler.interests])

  async function handleSave(form: FormState) {
    setSaving(true)
    await onUpdate(traveler.id, form)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-slate-800/60 border border-blue-500/40 rounded-xl p-3">
        <TravelerForm
          initial={travelerToForm(traveler)}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          isSaving={saving}
        />
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <GenderIcon gender={traveler.gender} size={64} />
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-slate-100">{traveler.name}</p>
              {traveler.linked_user_id && (
                <span title="Koblet til app-bruker" className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/30">
                  <Link2 className="w-2.5 h-2.5 text-blue-400" />
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              {[
                traveler.age != null && `${traveler.age} år`,
                GENDERS.find((g) => g.value === traveler.gender)?.label,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(traveler.id)}
            className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {interests.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {interests.map((i) => (
            <span
              key={i.label}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-700/60 text-slate-400 border border-slate-700"
            >
              {i.emoji} {i.label}
            </span>
          ))}
        </div>
      )}

      {traveler.description && (
        <p className="text-[10px] text-slate-500 leading-relaxed italic mt-1.5">
          &ldquo;{traveler.description}&rdquo;
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface TripPanelsProps {
  tripId: string
  groupDescription?: string | null
  onUpdateGroupDescription?: (desc: string) => void
  /** Trip start date – pre-fills flight date when no flight is saved yet */
  tripDateFrom?: string
  /** Transport mode – bestemmer om fly/tog-panel vises og hvilke etiketter som brukes */
  transportType?: TransportType
}

export default function TripPanels({
  tripId,
  groupDescription,
  onUpdateGroupDescription,
  tripDateFrom,
  transportType = 'fly',
}: TripPanelsProps) {
  const hasFlight = transportType !== 'ingen'
  const isTrain   = transportType === 'tog'
  const { outbound, returnFlight, saveFlight } = useFlights(tripId)
  const { travelers, addTraveler, addLinkedTraveler, updateTraveler, deleteTraveler } = useTravelers(tripId)

  const [openPanel, setOpenPanel] = useState<'flight' | 'crew' | null>(null)
  const [flightTab, setFlightTab] = useState<'outbound' | 'return'>('outbound')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [showLinkedForm, setShowLinkedForm] = useState(false)
  const [linkedEmail, setLinkedEmail] = useState('')
  const [linkedSaving, setLinkedSaving] = useState(false)
  const [linkedResult, setLinkedResult] = useState<LinkedTravelerResult | null>(null)

  // Local state for the group description
  const [descValue, setDescValue] = useState(groupDescription ?? '')
  const [editingDesc, setEditingDesc] = useState(false)
  // Reset when a different trip is selected
  useEffect(() => {
    setDescValue(groupDescription ?? '')
    setEditingDesc(false)
  }, [tripId]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeFlight = flightTab === 'outbound' ? outbound : returnFlight

  function togglePanel(panel: 'flight' | 'crew') {
    setOpenPanel((p) => (p === panel ? null : panel))
  }

  // Short flight summary for collapsed header
  const flightSummaryText = (() => {
    const parts: string[] = []
    if (outbound?.leg1_from) parts.push(outbound.leg1_from.split(/[\s–]/)[0])
    const dest = outbound?.has_stopover ? outbound?.leg2_to : outbound?.leg1_to
    if (dest) parts.push(dest.split(/[\s–]/)[0])
    return parts.length > 0 ? parts.join('→') : null
  })()

  async function handleAddTraveler(form: FormState) {
    setAddSaving(true)
    await addTraveler({
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      interests: form.interests.length > 0 ? form.interests.join(',') : null,
      description: form.description.trim() || null,
    })
    setAddSaving(false)
    setShowAddForm(false)
  }

  async function handleUpdateTraveler(id: string, form: FormState) {
    await updateTraveler(id, {
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      interests: form.interests.length > 0 ? form.interests.join(',') : null,
      description: form.description.trim() || null,
    })
  }

  return (
    <div className="border-t border-slate-800">

      {/* ── Header row: two buttons side by side ── */}
      <div className="flex">

        {/* Flight button – skjult hvis turen ikke har fly */}
        {hasFlight && (
          <button
            onClick={() => togglePanel('flight')}
            className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-r border-slate-800 min-w-0 ${
              openPanel === 'flight'
                ? 'text-slate-200 bg-slate-800/60'
                : 'text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            {isTrain
              ? <Train className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              : <Plane className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            }
            <span className="text-xs truncate">{isTrain ? 'Tog tur/retur' : 'Fly tur/retur'}</span>
            {flightSummaryText && (
              <span className="text-[10px] text-slate-500 ml-auto truncate max-w-[56px] flex-shrink-0">
                {flightSummaryText}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform flex-shrink-0 ${
                openPanel === 'flight' ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}

        {/* Turfølge button */}
        <button
          onClick={() => togglePanel('crew')}
          className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors min-w-0 ${
            openPanel === 'crew'
              ? 'text-slate-200 bg-slate-800/60'
              : 'text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
          <span className="text-xs truncate">Turfølge</span>
          {travelers.length > 0 && (
            <span className="text-[10px] text-slate-500 ml-auto flex-shrink-0">
              {travelers.length} pers.
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-500 transition-transform flex-shrink-0 ${
              openPanel === 'crew' ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* ── Flight expanded (full width) ── */}
      {hasFlight && openPanel === 'flight' && (
        <div className="border-t border-slate-800/60 max-h-[70vh] overflow-y-auto">
          {/* Tabs: Utreise / Hjemreise */}
          <div className="flex border-b border-slate-800 bg-slate-900/50">
            {([
              { dir: 'outbound', label: 'Utreise',   flyIcon: PlaneTakeoff, flight: outbound },
              { dir: 'return',   label: 'Hjemreise', flyIcon: PlaneLanding, flight: returnFlight },
            ] as const).map(({ dir, label, flyIcon: FlyIcon, flight }) => {
              const Icon = isTrain ? Train : FlyIcon
              const dateStr = flight?.flight_date
                ? new Date(flight.flight_date + 'T12:00:00').toLocaleDateString('nb-NO', {
                    day: 'numeric', month: 'short',
                  })
                : null
              return (
                <button
                  key={dir}
                  onClick={() => setFlightTab(dir)}
                  className={`flex-1 flex flex-col items-center px-3 py-2 text-xs font-semibold transition-colors ${
                    flightTab === dir
                      ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800/40'
                      : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </div>
                  {dateStr && (
                    <span className={`text-[10px] mt-0.5 ${flightTab === dir ? 'text-sky-500/70' : 'text-slate-600'}`}>
                      {dateStr}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {isTrain && (
            <div className="px-4 pt-3 pb-1">
              <a
                href="https://www.vy.no"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-green-700/20 hover:bg-green-700/30 border border-green-700/40 text-green-400 hover:text-green-300 text-xs font-medium transition-colors"
              >
                <Train className="w-3.5 h-3.5 flex-shrink-0" />
                Bestill togtur på vy.no
              </a>
            </div>
          )}

          <FlightForm
            key={`${flightTab}-${activeFlight?.has_stopover ?? false}`}
            flight={activeFlight}
            onSave={(updates) => saveFlight(flightTab, updates)}
            tripDateFrom={tripDateFrom}
            transportType={transportType}
          />
        </div>
      )}

      {/* ── Turfølge expanded (full width) ── */}
      {openPanel === 'crew' && (
        <div className="border-t border-slate-800/60">
          {/* Sub-header */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {travelers.length === 0
                ? 'Ingen registrert ennå'
                : `${travelers.length} ${travelers.length === 1 ? 'person' : 'personer'} på tur`}
            </span>
            {!showAddForm && !showLinkedForm && (
              <div className="flex gap-1">
                <button
                  onClick={() => setShowLinkedForm(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  title="Legg til registrert app-bruker"
                >
                  <Link2 className="w-3 h-3" /> App-bruker
                </button>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  <Plus className="w-3 h-3" /> Legg til
                </button>
              </div>
            )}
          </div>

          {/* Add linked user form */}
          {showLinkedForm && (
            <div className="mx-3 mb-3 bg-slate-800/60 border border-blue-500/40 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="w-3 h-3 text-blue-400" /> Legg til app-bruker
              </p>
              <p className="text-[10px] text-slate-500">
                Skriv inn e-postadressen til en annen bruker av appen. Hvis de har gitt deg tilgang til sine preferanser hentes disse inn automatisk.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={linkedEmail}
                  onChange={(e) => { setLinkedEmail(e.target.value); setLinkedResult(null) }}
                  placeholder="bruker@eksempel.no"
                  className="flex-1 h-7 rounded-md bg-slate-800 border border-slate-700 px-2.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/60"
                />
                <button
                  onClick={async () => {
                    if (!linkedEmail.trim()) return
                    setLinkedSaving(true)
                    const result = await addLinkedTraveler(linkedEmail.trim())
                    setLinkedResult(result)
                    setLinkedSaving(false)
                    if (result !== 'error' && result !== 'not_found') {
                      setLinkedEmail('')
                      setTimeout(() => { setShowLinkedForm(false); setLinkedResult(null) }, 1500)
                    }
                  }}
                  disabled={linkedSaving || !linkedEmail.trim()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
                >
                  {linkedSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Legg til
                </button>
                <button
                  onClick={() => { setShowLinkedForm(false); setLinkedEmail(''); setLinkedResult(null) }}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {linkedResult === 'not_found' && (
                <p className="text-[10px] text-red-400">Fant ingen bruker med denne e-postadressen</p>
              )}
              {linkedResult === 'no_access' && (
                <p className="text-[10px] text-amber-400">Lagt til uten preferanser (brukeren har ikke gitt deg tilgang)</p>
              )}
              {linkedResult === 'success' && (
                <p className="text-[10px] text-emerald-400">✓ Lagt til med preferanser!</p>
              )}
            </div>
          )}

          {/* Add form */}
          {showAddForm && (
            <div className="mx-3 mb-3 bg-slate-800/60 border border-blue-500/40 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Ny person
              </p>
              <TravelerForm
                initial={blankForm()}
                onSave={handleAddTraveler}
                onCancel={() => setShowAddForm(false)}
                isSaving={addSaving}
              />
            </div>
          )}

          {/* Traveler cards */}
          <div className="px-3 pb-3 space-y-2">
            {travelers.map((t) => (
              <TravelerCard
                key={t.id}
                traveler={t}
                onUpdate={handleUpdateTraveler}
                onDelete={deleteTraveler}
              />
            ))}
          </div>

          {/* Empty state */}
          {travelers.length === 0 && !showAddForm && (
            <div className="px-4 pb-2 text-center">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-xs text-slate-500">Legg til personene som skal være med på ferien.</p>
            </div>
          )}

          {/* ── Group description ── */}
          <div className="mx-3 mb-3 mt-1 pt-3 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Generell beskrivelse
              </p>
              {!editingDesc && descValue && (
                <button
                  onClick={() => setEditingDesc(true)}
                  title="Rediger beskrivelse"
                  className="text-slate-600 hover:text-slate-400 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Edit mode OR empty → show textarea */}
            {(editingDesc || !descValue) ? (
              <textarea
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={editingDesc}
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={() => {
                  setEditingDesc(false)
                  if (onUpdateGroupDescription && descValue !== (groupDescription ?? '')) {
                    onUpdateGroupDescription(descValue)
                  }
                }}
                placeholder="F.eks. familie med barn, sportsglade tenåringer, ekteparet som liker god mat og kultur…"
                rows={3}
                className="w-full rounded-lg bg-slate-800/60 border border-slate-700 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500/60 resize-none transition-colors"
              />
            ) : (
              /* View mode → read-only text, click to edit */
              <button
                onClick={() => setEditingDesc(true)}
                className="w-full text-left text-xs text-slate-400 leading-relaxed hover:text-slate-300 transition-colors"
              >
                {descValue}
              </button>
            )}

            <p className="text-[10px] text-slate-600 leading-snug">
              💡 Brukes av Ferietips-chat for å gi mer relevante reiseforslag
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
