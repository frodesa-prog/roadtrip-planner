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
  label,
}: {
  checked: boolean
  onChange: (val: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none group">
      <div className="relative flex-shrink-0">
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
      <span className={`text-xs transition-colors ${checked ? 'text-slate-200' : 'text-slate-500'}`}>
        {label}
      </span>
    </label>
  )
}

// ── Newsletter type config ────────────────────────────────────────────────────

interface NewsletterTypeDef {
  type: NewsletterType
  label: string
  description: string
  badge?: string
}

const NEWSLETTER_TYPES: NewsletterTypeDef[] = [
  {
    type: 'weekly_reminder',
    label: 'Ukentlig påminnelse',
    description: 'Sendes hver mandag. Inneholder antall dager til avreise, hvem som er i turfølget og en påminnelse om å sjekke gjørelisten.',
    badge: 'Mandager',
  },
]

// ── Trip card ─────────────────────────────────────────────────────────────────

function TripNewsletterCard({
  trip,
  isEnabled,
  onToggle,
}: {
  trip: Trip
  isEnabled: (type: NewsletterType) => boolean
  onToggle: (type: NewsletterType, val: boolean) => void
}) {
  const isArchived = trip.status === 'archived'

  return (
    <div className={`bg-slate-800/40 border rounded-xl p-4 space-y-4 ${isArchived ? 'border-slate-700/30 opacity-60' : 'border-slate-700/60'}`}>
      {/* Trip header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{trip.name}</h3>
            {isArchived && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-500">
                Arkivert
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {(trip.destination_city || trip.destination_country) && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Globe className="w-3 h-3 flex-shrink-0" />
                {[trip.destination_city, trip.destination_country].filter(Boolean).join(', ')}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <CalendarDays className="w-3 h-3 flex-shrink-0" />
              {tripDateRange(trip)}
            </span>
          </div>
        </div>
      </div>

      {/* Newsletter toggles */}
      <div className="border-t border-slate-700/40 pt-3 space-y-3">
        {NEWSLETTER_TYPES.map((def) => (
          <div key={def.type} className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-300">{def.label}</span>
                  {def.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400">
                      {def.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{def.description}</p>
              </div>
              <div className="flex-shrink-0">
                <Toggle
                  checked={isEnabled(def.type)}
                  onChange={(val) => onToggle(def.type, val)}
                  label={isEnabled(def.type) ? 'På' : 'Av'}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function NyhetsbrevTab() {
  const { trips, userId } = useTrips()
  const { loading, isEnabled, setSubscription } = useNewsletterSubscriptions(userId)

  // Show all non-archived trips first, then archived
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
    <div className="max-w-2xl space-y-6">
      {/* Intro */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <Mail className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-200">E-postvarsler for reisene dine</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Velg hvilke nyhetsbrev du ønsker å motta for hver reise. Slår du av et nyhetsbrev for en reise
            vil du ikke lenger motta e-post for den reisen. Standardinnstillingen er påslått.
          </p>
        </div>
      </div>

      {/* Trip list */}
      {sortedTrips.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Ingen reiser registrert ennå.</p>
      ) : (
        <div className="space-y-3">
          {sortedTrips.map((trip) => (
            <TripNewsletterCard
              key={trip.id}
              trip={trip}
              isEnabled={(type) => isEnabled(trip.id, type)}
              onToggle={(type, val) => setSubscription(trip.id, type, val)}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-600 italic">
        Fremtidige nyhetsbrevtyper vil dukke opp her automatisk. Innstillingene lagres per reise.
      </p>
    </div>
  )
}
