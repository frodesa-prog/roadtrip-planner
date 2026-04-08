'use client'

import { useMemo, useRef, useState } from 'react'
import { useAppTheme, ThemeName } from '@/contexts/ThemeContext'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities } from '@/hooks/useActivities'
import { useBudgetItems } from '@/hooks/useBudgetItems'
import { useFlights } from '@/hooks/useFlights'
import { useCarRental } from '@/hooks/useCarRental'
import { useDining } from '@/hooks/useDining'
import { useExpenseEntries } from '@/hooks/useExpenseEntries'
import { useDrivingInfo } from '@/hooks/useDrivingInfo'
import { useRouteWaypoints } from '@/hooks/useRouteWaypoints'
import { ExpenseEntryModal } from '@/components/planning/ExpenseEntryModal'
import { Flight, CarRental } from '@/types'
import {
  Plane, Train, Car, Fuel, BedDouble, Ticket,
  ChevronDown, Loader2, Receipt, ExternalLink,
  PlaneTakeoff, PlaneLanding, X, ChevronRight,
  Link as LinkIcon, Clock, Calculator, Bus,
} from 'lucide-react'
import {
  getOffset,
  calcFlightMinutes,
  calcStopoverMinutes,
  formatDuration,
} from '@/data/airports'

// ── Fargeaksent per tema ──────────────────────────────────────────────────────
const THEME_ACCENT: Record<ThemeName, string> = {
  'default':       'text-green-400',
  'light-white':   'text-blue-500',
  'light-ocean':   'text-cyan-700',
  'light-sunset':  'text-orange-600',
  'light-steel':   'text-blue-600',
  'dark-forest':   'text-green-400',
  'dark-midnight': 'text-violet-400',
  'dark-dodgers':  'text-blue-400',
  'light-vacay':   'text-blue-400',
}

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
        className="w-full text-right text-[11px] bg-slate-800 border border-amber-500 rounded-md px-1 py-0.5 text-slate-100 focus:outline-none"
      />
    )
  }
  if (remainingAmount && remainingAmount > 0) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Klikk for å redigere gjenstående beløp"
        className="w-full text-right text-[11px] font-semibold text-amber-300 bg-amber-900/40 border border-amber-600/50 rounded-md px-1.5 py-0.5 hover:bg-amber-900/60 whitespace-nowrap transition-colors"
      >
        {fmt(remainingAmount)} kr
      </button>
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      title="Klikk for å registrere gjenstående beløp"
      className="w-full text-center text-[11px] text-green-600 hover:text-green-400 transition-colors py-0.5 rounded hover:bg-slate-800"
    >
      ✓
    </button>
  )
}

// ── Mini-komponentar ──────────────────────────────────────────────────────────
function Th({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <div className={`text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2 py-1.5 ${right ? 'text-right' : center ? 'text-center' : ''}`}>
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

// ── FlightInfoModal ────────────────────────────────────────────────────────────
function FlightInfoModal({
  outbound,
  returnFlight,
  isTrain = false,
  onClose,
}: {
  outbound: Flight | null
  returnFlight: Flight | null
  isTrain?: boolean
  onClose: () => void
}) {
  const [tab, setTab] = useState<'outbound' | 'return'>('outbound')
  const flight = tab === 'outbound' ? outbound : returnFlight

  function FlightInfo({ f }: { f: Flight | null }) {
    if (!f) return (
      <p className="text-slate-500 text-xs text-center py-6">
        {isTrain ? 'Ingen toginformasjon registrert' : 'Ingen flyinformasjon registrert'}
      </p>
    )

    const fromOffset  = getOffset(f.leg1_from)
    const viaOffset   = getOffset(f.leg1_to)
    const finalOffset = getOffset(f.leg2_to)

    const leg1Min = calcFlightMinutes(f.leg1_departure, fromOffset, f.leg1_arrival, viaOffset)
    const leg2Min = f.has_stopover
      ? calcFlightMinutes(f.leg2_departure, viaOffset, f.leg2_arrival, finalOffset)
      : null
    const stopoverMin = f.has_stopover
      ? calcStopoverMinutes(f.leg1_arrival, f.leg2_departure)
      : null

    return (
      <div className="space-y-3">
        {/* Etappe 1 */}
        <div className="bg-slate-800/60 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              {f.has_stopover ? 'Etappe 1' : isTrain ? 'Strekning' : 'Flyvning'}
            </p>
            {leg1Min !== null && (
              <span className="flex items-center gap-1 text-[10px] text-sky-400 font-semibold">
                <Clock className="w-2.5 h-2.5" />
                {formatDuration(leg1Min)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <InfoField label="Fra" value={f.leg1_from} />
            <InfoField label="Avgang" value={f.leg1_departure} />
            <InfoField label={isTrain ? 'Rutenr.' : 'Flightnr.'} value={f.leg1_flight_nr} />
            <InfoField label="Til" value={f.leg1_to} />
            <InfoField label="Ankomst" value={f.leg1_arrival} />
          </div>
        </div>

        {/* Mellomlanding */}
        {f.has_stopover && (
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-amber-500/70 uppercase tracking-wide">
              Mellomlanding – {f.leg1_to ?? ''}
            </p>
            <InfoField
              label="Tid på flyplass"
              value={
                f.stopover_duration ||
                (stopoverMin !== null ? formatDuration(stopoverMin) : null)
              }
            />
          </div>
        )}

        {/* Etappe 2 */}
        {f.has_stopover && (
          <div className="bg-slate-800/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Etappe 2</p>
              {leg2Min !== null && (
                <span className="flex items-center gap-1 text-[10px] text-sky-400 font-semibold">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDuration(leg2Min)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <InfoField label={isTrain ? 'Rutenr.' : 'Flightnr.'} value={f.leg2_flight_nr} />
              <InfoField label="Avgang" value={f.leg2_departure} />
              <InfoField label="Til" value={f.leg2_to} />
              <InfoField label="Ankomst" value={f.leg2_arrival} />
            </div>
          </div>
        )}
      </div>
    )
  }

  function InfoField({ label, value }: { label: string; value: string | null }) {
    return (
      <div>
        <p className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</p>
        <p className="text-xs text-slate-200 font-medium">{value || <span className="text-slate-600 italic">—</span>}</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {isTrain
              ? <Train className="w-4 h-4 text-sky-400" />
              : <Plane className="w-4 h-4 text-sky-400" />
            }
            <h3 className="text-sm font-bold text-white">
              {isTrain ? 'Toginformasjon' : 'Flyinformasjon'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setTab('outbound')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
              tab === 'outbound'
                ? 'text-sky-400 border-b-2 border-sky-500 bg-sky-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <PlaneTakeoff className="w-3 h-3" />
            Utreise
          </button>
          <button
            onClick={() => setTab('return')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
              tab === 'return'
                ? 'text-sky-400 border-b-2 border-sky-500 bg-sky-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <PlaneLanding className="w-3 h-3" />
            Hjemreise
          </button>
        </div>
        {/* Content */}
        <div className="p-4">
          <FlightInfo f={flight} />
        </div>
      </div>
    </div>
  )
}

// ── CarRentalModal ────────────────────────────────────────────────────────────
function CarRentalModal({
  rental,
  onSave,
  onClose,
}: {
  rental: CarRental | null
  onSave: (updates: Partial<Omit<CarRental, 'id' | 'trip_id'>>) => void
  onClose: () => void
}) {
  function Field({
    label,
    field,
    defaultValue,
    placeholder,
    textarea,
    type = 'text',
  }: {
    label: string
    field: keyof Omit<CarRental, 'id' | 'trip_id'>
    defaultValue: string | number | null
    placeholder?: string
    textarea?: boolean
    type?: string
  }) {
    const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

    function handleBlur() {
      const raw = ref.current?.value.trim() ?? ''
      if (type === 'number') {
        const num = raw === '' ? null : Number(raw)
        onSave({ [field]: isNaN(num as number) ? null : num })
      } else {
        onSave({ [field]: raw || null })
      }
    }

    const cls =
      'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors'

    return (
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
          {label}
        </label>
        {textarea ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            defaultValue={defaultValue ?? ''}
            placeholder={placeholder}
            rows={3}
            onBlur={handleBlur}
            className={cls + ' resize-none'}
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            type={type}
            defaultValue={defaultValue ?? ''}
            placeholder={placeholder}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') ref.current?.blur() }}
            className={cls}
          />
        )}
      </div>
    )
  }

  const kmTotal =
    rental?.km_start != null && rental?.km_end != null
      ? rental.km_end - rental.km_start
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Leiebilinfo</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Form */}
        <div className="p-4 space-y-3">
          <Field label="Leiebilfirma" field="company" defaultValue={rental?.company ?? null} placeholder="f.eks. Hertz, Avis…" />
          <Field label="Type bil" field="car_type" defaultValue={rental?.car_type ?? null} placeholder="f.eks. Toyota Camry" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referansenr." field="reference_nr" defaultValue={rental?.reference_nr ?? null} placeholder="Ref.nr." />
            <Field label="Bekreftelsesnr." field="confirmation_nr" defaultValue={rental?.confirmation_nr ?? null} placeholder="Bekr.nr." />
          </div>
          <Field label="Link til bestilling" field="url" defaultValue={rental?.url ?? null} placeholder="https://…" />
          {rental?.url && (
            <a
              href={rental.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 hover:underline"
            >
              <LinkIcon className="w-3 h-3" />
              Åpne bestillingslink
            </a>
          )}
          <Field label="Tilleggsinfo" field="notes" defaultValue={rental?.notes ?? null} placeholder="Andre opplysninger…" textarea />

          {/* ── KM-stand ───────────────────────────────────────────────── */}
          <div className="border-t border-slate-800 pt-3 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">KM-stand</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="KM start" field="km_start" type="number" defaultValue={rental?.km_start ?? null} placeholder="f.eks. 12 450" />
              <Field label="KM slutt" field="km_end"   type="number" defaultValue={rental?.km_end   ?? null} placeholder="f.eks. 15 200" />
            </div>
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
              kmTotal != null
                ? 'bg-violet-950/40 border-violet-700/50'
                : 'bg-slate-800/40 border-slate-700/40'
            }`}>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">KM totalt</span>
              <span className={`text-sm font-bold ${kmTotal != null ? 'text-violet-300' : 'text-slate-600'}`}>
                {kmTotal != null
                  ? `${kmTotal.toLocaleString('nb-NO')} km`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FuelCalculatorModal ───────────────────────────────────────────────────────
interface CarPreset {
  id: string
  label: string
  lPer100: number | null
}

const CAR_PRESETS: CarPreset[] = [
  { id: 'compact',   label: 'Kompaktbil (Corolla o.l.)',     lPer100: 8.0  },
  { id: 'midsize',   label: 'Mellomklasse (Camry o.l.)',     lPer100: 9.5  },
  { id: 'suv_small', label: 'Kompakt SUV (RAV4 o.l.)',       lPer100: 10.5 },
  { id: 'suv_large', label: 'Stor SUV/Pickup (Tahoe o.l.)',  lPer100: 13.5 },
  { id: 'custom',    label: 'Egendefinert',                   lPer100: null },
]

type CarPresetId = 'compact' | 'midsize' | 'suv_small' | 'suv_large' | 'custom'

interface FuelSettings {
  carPresetId: CarPresetId
  lPer100: number
  pricePerGallon: number
  exchangeRate: number
}

function parseFuelSettings(notes: string | null): Partial<FuelSettings> {
  if (!notes) return {}
  try { return JSON.parse(notes) as Partial<FuelSettings> } catch { return {} }
}

function FuelCalculatorModal({
  totalKm,
  legsLoading,
  currentNotes,
  onSave,
  onClose,
}: {
  totalKm: number
  legsLoading: boolean
  currentNotes: string | null
  onSave: (amount: number, remaining: number, notes: string) => void
  onClose: () => void
}) {
  const saved = parseFuelSettings(currentNotes)

  const [carPresetId, setCarPresetId] = useState<CarPresetId>(saved.carPresetId ?? 'midsize')
  const [customL, setCustomL] = useState(
    saved.carPresetId === 'custom' && saved.lPer100 ? String(saved.lPer100) : ''
  )
  const [pricePerGallon, setPricePerGallon] = useState(
    saved.pricePerGallon ? String(saved.pricePerGallon) : '3.50'
  )
  const [exchangeRate, setExchangeRate] = useState(
    saved.exchangeRate ? String(saved.exchangeRate) : '10.50'
  )

  const preset = CAR_PRESETS.find((c) => c.id === carPresetId)!
  const lPer100 =
    carPresetId === 'custom' ? (parseFloat(customL) || 0) : (preset.lPer100 ?? 0)
  const ppg = parseFloat(pricePerGallon) || 0
  const er = parseFloat(exchangeRate) || 0

  // 1 gallon = 3.785 liter
  const totalLiters = (totalKm * lPer100) / 100
  const totalGallons = totalLiters / 3.785
  const totalUSD = totalGallons * ppg
  const totalNOK = Math.round(totalUSD * er)

  const canSave = totalNOK > 0 && !legsLoading

  function handleSave() {
    const settings: FuelSettings = {
      carPresetId,
      lPer100: carPresetId === 'custom' ? (parseFloat(customL) || 0) : (preset.lPer100 ?? 0),
      pricePerGallon: ppg,
      exchangeRate: er,
    }
    onSave(totalNOK, totalNOK, JSON.stringify(settings))
  }

  const inputCls =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Bensinskalkulator</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Total km */}
          <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-400">Total kjøreavstand (rute)</span>
            {legsLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Beregner…
              </span>
            ) : (
              <span className="text-sm font-bold text-white tabular-nums">
                {totalKm.toLocaleString('nb-NO')} km
              </span>
            )}
          </div>

          {/* Biltype */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Biltype
            </label>
            <div className="relative">
              <select
                value={carPresetId}
                onChange={(e) => setCarPresetId(e.target.value as CarPresetId)}
                className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              >
                {CAR_PRESETS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}{c.lPer100 ? ` – ${c.lPer100} L/100km` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            </div>
          </div>

          {/* Egendefinert forbruk */}
          {carPresetId === 'custom' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Forbruk (L/100km)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={customL}
                onChange={(e) => setCustomL(e.target.value)}
                placeholder="f.eks. 10.5"
                className={inputCls}
              />
            </div>
          )}

          {/* Pris + valutakurs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Pris (USD/gallon)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricePerGallon}
                  onChange={(e) => setPricePerGallon(e.target.value)}
                  placeholder="3.50"
                  className={inputCls + ' pl-6'}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Valutakurs (kr/USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="10.50"
                className={inputCls}
              />
            </div>
          </div>

          {/* Resultatboks */}
          <div className={`rounded-lg p-3 border transition-all ${
            canSave
              ? 'bg-amber-900/20 border-amber-700/40'
              : 'bg-slate-800/40 border-slate-700/40'
          }`}>
            <p className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wide mb-2">
              Estimat
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Forbruk totalt</span>
                <span className="text-slate-200 tabular-nums">
                  {lPer100 > 0 && totalKm > 0
                    ? `${totalLiters.toFixed(0)} L (${totalGallons.toFixed(0)} gal)`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Pris i USD</span>
                <span className="text-slate-200 tabular-nums">
                  {ppg > 0 && lPer100 > 0 && totalKm > 0 ? `$${totalUSD.toFixed(0)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1.5 border-t border-amber-700/30">
                <span className="font-semibold text-amber-300">Estimert kostnad (NOK)</span>
                <span className={`font-bold tabular-nums ${canSave ? 'text-amber-300' : 'text-slate-500'}`}>
                  {canSave ? `${fmt(totalNOK)} kr` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Info: gjenstår settes automatisk */}
          {canSave && (
            <p className="text-[10px] text-slate-500 text-center -mt-1">
              Gjenstående beløp settes automatisk lik estimert kostnad
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Lagre estimat
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ParkingModal ──────────────────────────────────────────────────────────────
function ParkingModal({
  rows,
  onClose,
}: {
  rows: Array<{
    hotel: { id: string; name: string; parking_cost_per_night: number | null }
    stop: { city: string; state: string | null; nights: number }
  }>
  onClose: () => void
}) {
  const parkingRows = rows.filter((r) => r.hotel.parking_cost_per_night && r.hotel.parking_cost_per_night > 0)
  const total = parkingRows.reduce((s, r) => s + (r.hotel.parking_cost_per_night ?? 0) * r.stop.nights, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-slate-500 rounded text-white flex items-center justify-center text-[9px] font-bold leading-none">P</span>
            <h3 className="text-sm font-bold text-white">Parkering per hotell</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {parkingRows.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-4">Ingen parkeringspriser registrert på hotellene</p>
          ) : (
            <div className="space-y-2">
              {parkingRows.map(({ hotel, stop }) => {
                const perNight = hotel.parking_cost_per_night ?? 0
                const rowTotal = perNight * stop.nights
                return (
                  <div key={hotel.id} className="bg-slate-800/60 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{hotel.name || 'Ukjent hotell'}</p>
                        <p className="text-[10px] text-slate-500">{stop.city}{stop.state && `, ${stop.state}`}</p>
                      </div>
                      <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">{fmt(rowTotal)} kr</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="tabular-nums">{fmt(perNight)} kr/natt</span>
                      <span>×</span>
                      <span>{stop.nights} netter</span>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-700">
                <span className="text-xs font-semibold text-slate-400">Total parkering</span>
                <span className="text-sm font-bold text-white tabular-nums">{fmt(total)} kr</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 pb-4 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-colors">
            Lukk
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function KostnaderPage() {
  const { theme } = useAppTheme()
  const accentClass = THEME_ACCENT[theme] ?? 'text-green-400'
  const { trips, currentTrip, loading: tripsLoading, setCurrentTrip } = useTrips()
  const { stops, loading: stopsLoading } = useStops(currentTrip?.id ?? null)

  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const stopById = useMemo(
    () => Object.fromEntries(stops.map((s) => [s.id, s])),
    [stops]
  )

  const { hotels, saveHotel } = useHotels(stopIds)
  const { activities, updateActivity } = useActivities(stopIds)
  const { dining } = useDining(stopIds)
  const { saveItem, getAmount, getRemaining, getNotes } = useBudgetItems(currentTrip?.id ?? null)
  const { outbound, returnFlight } = useFlights(currentTrip?.id ?? null)
  const { rental, saveRental } = useCarRental(currentTrip?.id ?? null)
  const { entriesFor, addEntry, removeEntry, totalFor } = useExpenseEntries(currentTrip?.id ?? null)

  // ── Kjøreavstand for bensinskalkulator ───────────────────────────────────
  const sortedStops = useMemo(() => [...stops].sort((a, b) => a.order - b.order), [stops])
  const { legs: routeLegs } = useRouteWaypoints(currentTrip?.id ?? null)
  const drivingLegs = useDrivingInfo(sortedStops, routeLegs)
  const totalKm = useMemo(
    () => drivingLegs.reduce((s, l) => s + (l?.distanceKm ?? 0), 0),
    [drivingLegs]
  )
  const legsLoading =
    sortedStops.length >= 2 && drivingLegs.length > 0 && drivingLegs.every((l) => l === null)

  // ── Modal state ─────────────────────────────────────────────────────────
  const [showFlightModal, setShowFlightModal] = useState(false)
  const [showCarRentalModal, setShowCarRentalModal] = useState(false)
  const [showFuelModal, setShowFuelModal] = useState(false)
  const [showParkingModal, setShowParkingModal] = useState(false)
  const [showShoppingModal, setShowShoppingModal] = useState(false)
  const [showFoodModal, setShowFoodModal] = useState(false)
  const [showMiscModal, setShowMiscModal] = useState(false)

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

  // ── Car/flight flags (null/undefined = true for backward compat with old trips) ──
  const hasCarRental  = currentTrip?.has_car_rental !== false
  const hasFlight     = currentTrip?.has_flight !== false
  const isTrain       = currentTrip?.transport_type === 'tog'

  // ── Totaler ──────────────────────────────────────────────────────────────
  const totalHotels = hotelRows.reduce((s, r) => s + (r.hotel.cost ?? 0), 0)
  const totalActivities = activityRows.reduce((s, r) => s + (r.activity.cost ?? 0), 0)
  const totalFlight = hasFlight ? getAmount('flight') : 0
  const totalCar = hasCarRental ? getAmount('car') : 0
  const totalGas = hasCarRental ? getAmount('gas') : 0
  const totalParking = hasCarRental
    ? hotelRows.reduce((s, r) => s + (r.hotel.parking_cost_per_night ?? 0) * r.stop.nights, 0)
    : 0
  const totalTransport = !hasCarRental ? getAmount('transport') : 0
  const totalShopping  = totalFor('shopping')
  const totalFood      = totalFor('food')
  const totalMisc      = totalFor('misc')
  const budgetShopping = getAmount('shopping')
  const budgetFood     = getAmount('food')
  const budgetMisc     = getAmount('misc')
  const totalOther = totalFlight + totalCar + totalGas + totalParking + totalTransport + totalShopping + totalFood + totalMisc
  const grandTotal = totalHotels + totalActivities + totalOther

  const grandRemaining =
    hotelRows.reduce((s, r) => s + (r.hotel.remaining_amount ?? 0), 0) +
    activityRows.reduce((s, r) => s + (r.activity.remaining_amount ?? 0), 0) +
    (hasFlight ? (getRemaining('flight') ?? 0) : 0) +
    (hasCarRental ? (getRemaining('car') ?? 0) : 0) +
    (hasCarRental ? (getRemaining('gas') ?? 0) : 0) +
    (hasCarRental ? (getRemaining('parking') ?? totalParking) : 0) +
    (!hasCarRental ? (getRemaining('transport') ?? 0) : 0) +
    (getRemaining('shopping') ?? (budgetShopping > 0 ? Math.max(0, budgetShopping - totalShopping) : 0)) +
    (getRemaining('food')     ?? (budgetFood     > 0 ? Math.max(0, budgetFood     - totalFood)     : 0)) +
    (getRemaining('misc')     ?? (budgetMisc     > 0 ? Math.max(0, budgetMisc     - totalMisc)     : 0))

  // Felles kolonne-grid for aktiviteter og andre kostnader
  // [Label | Kostnad (5.5rem) | Gjenstår (4.5rem)]
  const rightGrid = 'grid-cols-[1fr_5.5rem_4.5rem]'

  const loading = stopsLoading

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">

      {/* ── Toppbar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900 px-4 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Receipt className={`w-4 h-4 ${accentClass}`} />
          <h1 className="text-sm font-bold text-white">Kostnader</h1>
        </div>

        {currentTrip && !loading && (
          <div className="flex items-center gap-2 ml-1">
            <span className={`text-sm font-extrabold tabular-nums ${accentClass}`}>
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

      {/* ── Modaler ──────────────────────────────────────────────────────── */}
      {showFlightModal && (
        <FlightInfoModal
          outbound={outbound}
          returnFlight={returnFlight}
          isTrain={isTrain}
          onClose={() => setShowFlightModal(false)}
        />
      )}
      {showCarRentalModal && (
        <CarRentalModal
          rental={rental}
          onSave={saveRental}
          onClose={() => setShowCarRentalModal(false)}
        />
      )}
      {showFuelModal && (
        <FuelCalculatorModal
          totalKm={totalKm}
          legsLoading={legsLoading}
          currentNotes={getNotes('gas')}
          onSave={(amount, remaining, notes) => {
            saveItem('gas', { amount, remaining_amount: remaining, notes })
            setShowFuelModal(false)
          }}
          onClose={() => setShowFuelModal(false)}
        />
      )}
      {showParkingModal && (
        <ParkingModal
          rows={hotelRows}
          onClose={() => setShowParkingModal(false)}
        />
      )}
      {showShoppingModal && currentTrip && (
        <ExpenseEntryModal
          category="shopping"
          title="Shopping"
          emoji="🛍️"
          tripId={currentTrip.id}
          stops={stops}
          activities={activities}
          dining={dining}
          entries={entriesFor('shopping')}
          budget={budgetShopping}
          onBudgetSave={(v) => saveItem('shopping', { amount: v })}
          onAddEntry={addEntry}
          onRemoveEntry={removeEntry}
          onClose={() => setShowShoppingModal(false)}
        />
      )}
      {showFoodModal && currentTrip && (
        <ExpenseEntryModal
          category="food"
          title="Mat"
          emoji="🍽️"
          tripId={currentTrip.id}
          stops={stops}
          activities={activities}
          dining={dining}
          entries={entriesFor('food')}
          budget={budgetFood}
          onBudgetSave={(v) => saveItem('food', { amount: v })}
          onAddEntry={addEntry}
          onRemoveEntry={removeEntry}
          onClose={() => setShowFoodModal(false)}
        />
      )}
      {showMiscModal && currentTrip && (
        <ExpenseEntryModal
          category="misc"
          title="Diverse"
          emoji="🎒"
          tripId={currentTrip.id}
          stops={stops}
          activities={activities}
          dining={dining}
          entries={entriesFor('misc')}
          budget={budgetMisc}
          onBudgetSave={(v) => saveItem('misc', { amount: v })}
          onAddEntry={addEntry}
          onRemoveEntry={removeEntry}
          onClose={() => setShowMiscModal(false)}
        />
      )}

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">

            {/* ══ VENSTRE: Hoteller ════════════════════════════════════════ */}
            <div className="min-w-0">
              <SectionTitle
                icon={<BedDouble className="w-3.5 h-3.5 text-blue-400" />}
                title="Hoteller"
              />
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
                {/*
                  Kolonner: By | Hotell | NETTER | Kostnad | Snitt | Gjenstår
                  Faste bredder for de to siste slik at beløpene alltid er på
                  samme plass uavhengig av gjenstår-innhold.
                */}
                <div className="grid grid-cols-[7rem_1fr_3.5rem_5.5rem_3.5rem_4.5rem] border-b border-slate-800 bg-slate-800/50" style={{minWidth:'480px'}}>
                  <Th>By</Th>
                  <Th>Hotell</Th>
                  <Th center>NETTER</Th>
                  <Th right>Kostnad</Th>
                  <Th right>Snitt</Th>
                  <Th right>Gjenstår</Th>
                </div>

                {hotelRows.length === 0 ? (
                  <EmptyRow text="Ingen hoteller registrert ennå" />
                ) : (
                  <div className="divide-y divide-slate-800">
                  {hotelRows.map(({ hotel, stop }) => {
                    const avg = hotel.cost && stop.nights > 0
                      ? hotel.cost / stop.nights
                      : null
                    return (
                      <div
                        key={hotel.id}
                        className="grid grid-cols-[7rem_1fr_3.5rem_5.5rem_3.5rem_4.5rem] items-center hover:bg-slate-800/40 transition-colors"
                      >
                        {/* By */}
                        <div className="px-2 py-2 text-[11px] text-slate-400 truncate">
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
                        <div className="px-1 py-2 text-[11px] text-slate-500 text-center">
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
                        <div className="px-1.5 py-1.5">
                          <RemainingCell
                            remainingAmount={hotel.remaining_amount ?? null}
                            onSave={(v) => saveHotel(hotel.stop_id, { remaining_amount: v })}
                          />
                        </div>
                      </div>
                    )
                  })}
                  </div>
                )}

                <TableTotal label="Total hoteller" amount={totalHotels} />
              </div>
            </div>

            {/* ══ HØYRE: Aktiviteter + Andre kostnader ════════════════════ */}
            <div className="min-w-0 space-y-3" key={currentTrip.id}>

              {/* Aktiviteter */}
              <div>
                <SectionTitle
                  icon={<Ticket className="w-3.5 h-3.5 text-purple-400" />}
                  title="Aktiviteter"
                />
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className={`grid ${rightGrid} border-b border-slate-800 bg-slate-800/50`}>
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
                        className={`grid ${rightGrid} items-center ${
                          i % 2 === 0 ? '' : 'bg-slate-800/20'
                        } hover:bg-slate-800/40 transition-colors`}
                      >
                        <div className="px-2 py-2 min-w-0">
                          {activity.url ? (
                            <a
                              href={activity.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 truncate group"
                            >
                              <span className="truncate">{activity.name}</span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <p className="text-xs text-slate-200 truncate">{activity.name}</p>
                          )}
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
                        <div className="px-1.5 py-1.5">
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
                  <div className={`grid ${rightGrid} border-b border-slate-800 bg-slate-800/50`}>
                    <Th>Post</Th>
                    <Th right>Kostnad</Th>
                    <Th right>Gjenstår</Th>
                  </div>

                  {/* Fly/Tog – vises kun når turen inkluderer fly eller tog */}
                  {hasFlight && (
                    <div
                      className={`grid ${rightGrid} items-center hover:bg-slate-800/40 transition-colors`}
                    >
                      <button
                        onClick={() => setShowFlightModal(true)}
                        className="px-2 py-2 flex items-center gap-1.5 text-left group"
                        title={isTrain ? 'Vis toginformasjon' : 'Vis flyinformasjon'}
                      >
                        {isTrain
                          ? <Train className="w-3 h-3 text-sky-400 flex-shrink-0" />
                          : <Plane className="w-3 h-3 text-sky-400 flex-shrink-0" />
                        }
                        <span className="text-xs text-slate-200">{isTrain ? 'Tog' : 'Fly'}</span>
                        <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors ml-auto" />
                      </button>
                      <div className="px-1.5 py-1.5">
                        <CostInput
                          defaultValue={totalFlight || null}
                          onSave={(v) => saveItem('flight', { amount: v })}
                        />
                      </div>
                      <div className="px-1.5 py-1.5">
                        <RemainingCell
                          remainingAmount={getRemaining('flight')}
                          onSave={(v) => saveItem('flight', { remaining_amount: v })}
                        />
                      </div>
                    </div>
                  )}

                  {hasCarRental ? (
                    <>
                      {/* Leiebil – klikk åpner CarRentalModal */}
                      <div
                        className={`grid ${rightGrid} items-center bg-slate-800/20 hover:bg-slate-800/40 transition-colors`}
                      >
                        <button
                          onClick={() => setShowCarRentalModal(true)}
                          className="px-2 py-2 flex items-center gap-1.5 text-left group"
                          title="Vis/rediger leiebilinfo"
                        >
                          <Car className="w-3 h-3 text-violet-400 flex-shrink-0" />
                          <span className="text-xs text-slate-200">Leiebil</span>
                          <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors ml-auto" />
                        </button>
                        <div className="px-1.5 py-1.5">
                          <CostInput
                            defaultValue={totalCar || null}
                            onSave={(v) => saveItem('car', { amount: v })}
                          />
                        </div>
                        <div className="px-1.5 py-1.5">
                          <RemainingCell
                            remainingAmount={getRemaining('car')}
                            onSave={(v) => saveItem('car', { remaining_amount: v })}
                          />
                        </div>
                      </div>

                      {/* Bensin */}
                      <div
                        className={`grid ${rightGrid} items-center hover:bg-slate-800/40 transition-colors`}
                      >
                        <div className="px-2 py-2 flex items-center gap-1.5">
                          <Fuel className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span className="text-xs text-slate-200">Bensin</span>
                          <button
                            onClick={() => setShowFuelModal(true)}
                            title="Beregn bensinkostnad automatisk"
                            className="text-amber-400/50 hover:text-amber-400 flex-shrink-0 transition-colors ml-auto"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="px-1.5 py-1.5">
                          <CostInput
                            key={`gas-${totalGas}`}
                            defaultValue={totalGas || null}
                            onSave={(v) => saveItem('gas', { amount: v })}
                          />
                        </div>
                        <div className="px-1.5 py-1.5">
                          <RemainingCell
                            remainingAmount={getRemaining('gas')}
                            onSave={(v) => saveItem('gas', { remaining_amount: v })}
                          />
                        </div>
                      </div>

                      {/* Parkering – auto-beregnet fra parkeringspris pr. natt × netter */}
                      <div
                        className={`grid ${rightGrid} items-center bg-slate-800/20 hover:bg-slate-800/40 transition-colors cursor-pointer`}
                        onClick={() => setShowParkingModal(true)}
                        title="Vis parkeringsdetaljer per hotell"
                      >
                        <div className="px-2 py-2 flex items-center gap-1.5">
                          <span className="w-3 h-3 bg-slate-500 rounded text-white flex items-center justify-center text-[7px] font-bold leading-none flex-shrink-0">P</span>
                          <span className="text-xs text-slate-200">Parkering</span>
                          <ChevronRight className="w-3 h-3 text-slate-600 ml-auto" />
                        </div>
                        <div className="px-1.5 py-2 text-[11px] text-right tabular-nums whitespace-nowrap">
                          {totalParking > 0
                            ? <span className="text-slate-300">{fmt(totalParking)} kr</span>
                            : <span className="text-slate-600">—</span>
                          }
                        </div>
                        <div className="px-1.5 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <RemainingCell
                            remainingAmount={getRemaining('parking') ?? (totalParking > 0 ? totalParking : null)}
                            onSave={(v) => saveItem('parking', { remaining_amount: v })}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Transport (vises kun når leiebil ikke er inkludert) */
                    <div
                      className={`grid ${rightGrid} items-center bg-slate-800/20 hover:bg-slate-800/40 transition-colors`}
                    >
                      <div className="px-2 py-2 flex items-center gap-1.5">
                        <Bus className="w-3 h-3 text-teal-400 flex-shrink-0" />
                        <span className="text-xs text-slate-200">Transport</span>
                      </div>
                      <div className="px-1.5 py-1.5">
                        <CostInput
                          defaultValue={totalTransport || null}
                          onSave={(v) => saveItem('transport', { amount: v })}
                        />
                      </div>
                      <div className="px-1.5 py-1.5">
                        <RemainingCell
                          remainingAmount={getRemaining('transport')}
                          onSave={(v) => saveItem('transport', { remaining_amount: v })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Shopping */}
                  <div
                    className={`grid ${rightGrid} items-center bg-slate-800/20 hover:bg-slate-800/40 transition-colors cursor-pointer`}
                    onClick={() => setShowShoppingModal(true)}
                    title="Vis/legg til shopping-utgifter"
                  >
                    <div className="px-2 py-2 flex items-center gap-1.5">
                      <span className="text-sm leading-none">🛍️</span>
                      <span className="text-xs text-slate-200">Shopping</span>
                      <ChevronRight className="w-3 h-3 text-slate-600 ml-auto" />
                    </div>
                    <div className="px-1.5 py-2 text-[11px] text-right tabular-nums whitespace-nowrap">
                      {totalShopping > 0
                        ? <span className="text-slate-300">{fmt(totalShopping)} kr</span>
                        : <span className="text-slate-600">—</span>
                      }
                    </div>
                    <div className="px-1.5 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <RemainingCell
                        remainingAmount={getRemaining('shopping') ?? (budgetShopping > 0 ? Math.max(0, budgetShopping - totalShopping) : null)}
                        onSave={(v) => saveItem('shopping', { remaining_amount: v })}
                      />
                    </div>
                  </div>

                  {/* Mat */}
                  <div
                    className={`grid ${rightGrid} items-center hover:bg-slate-800/40 transition-colors cursor-pointer`}
                    onClick={() => setShowFoodModal(true)}
                    title="Vis/legg til mat-utgifter"
                  >
                    <div className="px-2 py-2 flex items-center gap-1.5">
                      <span className="text-sm leading-none">🍽️</span>
                      <span className="text-xs text-slate-200">Mat</span>
                      <ChevronRight className="w-3 h-3 text-slate-600 ml-auto" />
                    </div>
                    <div className="px-1.5 py-2 text-[11px] text-right tabular-nums whitespace-nowrap">
                      {totalFood > 0
                        ? <span className="text-slate-300">{fmt(totalFood)} kr</span>
                        : <span className="text-slate-600">—</span>
                      }
                    </div>
                    <div className="px-1.5 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <RemainingCell
                        remainingAmount={getRemaining('food') ?? (budgetFood > 0 ? Math.max(0, budgetFood - totalFood) : null)}
                        onSave={(v) => saveItem('food', { remaining_amount: v })}
                      />
                    </div>
                  </div>

                  {/* Diverse */}
                  <div
                    className={`grid ${rightGrid} items-center bg-slate-800/20 hover:bg-slate-800/40 transition-colors cursor-pointer`}
                    onClick={() => setShowMiscModal(true)}
                    title="Vis/legg til diverse utgifter"
                  >
                    <div className="px-2 py-2 flex items-center gap-1.5">
                      <span className="text-sm leading-none">🎒</span>
                      <span className="text-xs text-slate-200">Diverse</span>
                      <ChevronRight className="w-3 h-3 text-slate-600 ml-auto" />
                    </div>
                    <div className="px-1.5 py-2 text-[11px] text-right tabular-nums whitespace-nowrap">
                      {totalMisc > 0
                        ? <span className="text-slate-300">{fmt(totalMisc)} kr</span>
                        : <span className="text-slate-600">—</span>
                      }
                    </div>
                    <div className="px-1.5 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <RemainingCell
                        remainingAmount={getRemaining('misc') ?? (budgetMisc > 0 ? Math.max(0, budgetMisc - totalMisc) : null)}
                        onSave={(v) => saveItem('misc', { remaining_amount: v })}
                      />
                    </div>
                  </div>

                  <TableTotal label="Total andre" amount={totalOther} />
                </div>
              </div>

              {/* Totalsum (under høyre kolonne) */}
              <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/20 border border-green-800/50 rounded-xl px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-green-400/70 uppercase tracking-widest">Betalt</span>
                  <span className="text-sm font-bold text-green-400 tabular-nums">{fmt(grandTotal)} kr</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest">Gjenstående</span>
                  <span className="text-sm font-bold text-amber-300 tabular-nums">
                    {grandRemaining > 0 ? `${fmt(grandRemaining)} kr` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-green-800/40 pt-2">
                  <span className="text-[10px] font-bold text-green-300/80 uppercase tracking-widest">Totalt</span>
                  <span className="text-xl font-extrabold text-green-300 tabular-nums">
                    {fmt(grandTotal + grandRemaining)} kr
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
