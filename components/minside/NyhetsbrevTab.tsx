'use client'

import { useMemo } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useNewsletterSubscriptions, NewsletterType } from '@/hooks/useNewsletterSubscriptions'
import { Mail, CalendarDays, Globe, Loader2 } from 'lucide-react'
import { Trip } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function tripDateRange(trip: Trip): string {
  if (trip.date_from && trip.date_to) return `${fmt(trip.date_from)} – ${fmt(trip.date_to)}`
  if (trip.date_from) return `Fra ${fmt(trip.date_from)}`
  return trip.year ? String(trip.year) : '—'
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-10 h-5 rounded-full transition-colors duration-200 ${
            checked ? 'bg-blue-500' : 'bg-slate-700'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      <span className={`text-xs w-5 transition-colors ${checked ? 'text-slate-300' : 'text-slate-500'}`}>
        {checked ? 'På' : 'Av'}
      </span>
    </label>
  )
}

// ── Frequency selector ────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { days: 1, label: 'Daglig' },
  { days: 3, label: 'Hver 3. dag' },
  { days: 5, label: 'Hver 5. dag' },
  { days: 7, label: 'Ukentlig' },
]

function FrequencySelector({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (days: number) => void
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center gap-1.5 flex-wrap transition-opacity ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      {FREQUENCY_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          onClick={() => onChange(opt.days)}
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
            value === opt.days
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
              : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Newsletter type config ────────────────────────────────────────────────────

interface NewsletterTypeDef {
  type: NewsletterType
  icon: string
  label: string
  description: string
  badge: string
  badgeColor: 'blue' | 'amber'
  hasFrequency?: boolean
}

const NEWSLETTER_TYPES: NewsletterTypeDef[] = [
  {
    type: 'weekly_reminder',
    icon: '📅',
    label: 'Ukentlig påminnelse',
    description: 'Sendes hver mandag. Inneholder antall dager til avreise, hvem som er i turfølget og en påminnelse om å sjekke gjørelisten.',
    badge: 'Mandager',
    badgeColor: 'blue',
  },
  {
    type: 'ai_destination_tips',
    icon: '🤖',
    label: 'AI-reisedestinasjonsnips',
    description: 'AI-genererte tips om restauranter, aktiviteter og severdigheter på reisemålene dine. Inkluderer generell info om stedet og antall dager til avreise.',
    badge: 'AI-generert',
    badgeColor: 'amber',
    hasFrequency: true,
  },
]

// ── Trip row inside a newsletter section ──────────────────────────────────────

function TripRow({
  trip,
  enabled,
  frequency,
  hasFrequency,
  onToggle,
  onSetFrequency,
}: {
  trip: Trip
  enabled: boolean
  frequency: number
  hasFrequency?: boolean
  onToggle: (val: boolean) => void
  onSetFrequency: (days: number) => void
}) {
  const isArchived = trip.status === 'archived'

  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
      isArchived ? 'opacity-50' : 'hover:bg-slate-800/40'
    }`}>
      {/* Trip info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-200 truncate">{trip.name}</span>
          {isArchived && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 flex-shrink-0">
              Arkivert
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          {(trip.destination_city || trip.destination_country) && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Globe className="w-2.5 h-2.5 flex-shrink-0" />
              {[trip.destination_city, trip.destination_country].filter(Boolean).join(', ')}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <CalendarDays className="w-2.5 h-2.5 flex-shrink-0" />
            {tripDateRange(trip)}
          </span>
        </div>
      </div>

      {/* Frequency selector (right of trip info, left of toggle) */}
      {hasFrequency && (
        <FrequencySelector
          value={frequency}
          onChange={onSetFrequency}
          disabled={!enabled}
        />
      )}

      {/* Toggle */}
      <Toggle checked={enabled} onChange={onToggle} />
    </div>
  )
}

// ── Newsletter section card ────────────────────────────────────────────────────

function NewsletterSection({
  def,
  trips,
  isEnabled,
  getFrequency,
  onToggle,
  onSetFrequency,
}: {
  def: NewsletterTypeDef
  trips: Trip[]
  isEnabled: (tripId: string) => boolean
  getFrequency: (tripId: string) => number
  onToggle: (tripId: string, val: boolean) => void
  onSetFrequency: (tripId: string, days: number) => void
}) {
  const badgeClass = def.badgeColor === 'amber'
    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
    : 'bg-blue-500/15 border-blue-500/30 text-blue-400'

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">{def.icon}</span>
          <span className="text-sm font-semibold text-slate-100">{def.label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badgeClass}`}>
            {def.badge}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{def.description}</p>
      </div>

      {/* Trip rows */}
      <div className="px-1 py-1">
        {trips.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-600 italic">Ingen reiser registrert ennå.</p>
        ) : (
          trips.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              enabled={isEnabled(trip.id)}
              frequency={getFrequency(trip.id)}
              hasFrequency={def.hasFrequency}
              onToggle={(val) => onToggle(trip.id, val)}
              onSetFrequency={(days) => onSetFrequency(trip.id, days)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function NyhetsbrevTab() {
  const { trips, userId } = useTrips()
  const { loading, isEnabled, getFrequency, setSubscription, setFrequency } = useNewsletterSubscriptions(userId)

  // Non-archived first, then archived — alphabetical within each group
  const sortedTrips = useMemo(() => {
    const active   = trips.filter((t) => t.status !== 'archived').sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    const archived = trips.filter((t) => t.status === 'archived').sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    return [...active, ...archived]
  }, [trips])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Intro */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <Mail className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-200">E-postvarsler for reisene dine</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Velg hvilke nyhetsbrev du ønsker å motta for hver reise. Standardinnstillingen er påslått.
            For AI-reisedestinasjonsnips kan du også velge hyppighet per reise.
          </p>
        </div>
      </div>

      {/* One section per newsletter type */}
      {NEWSLETTER_TYPES.map((def) => (
        <NewsletterSection
          key={def.type}
          def={def}
          trips={sortedTrips}
          isEnabled={(tripId) => isEnabled(tripId, def.type)}
          getFrequency={(tripId) => getFrequency(tripId, def.type)}
          onToggle={(tripId, val) => setSubscription(tripId, def.type, val)}
          onSetFrequency={(tripId, days) => setFrequency(tripId, def.type, days)}
        />
      ))}

      <p className="text-[11px] text-slate-600 italic">
        Fremtidige nyhetsbrevtyper vil dukke opp her automatisk. Innstillingene lagres per reise.
      </p>
    </div>
  )
}
