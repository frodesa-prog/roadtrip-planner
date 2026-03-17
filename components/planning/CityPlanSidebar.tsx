'use client'

import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Hotel as HotelIcon, MapPin,
  UtensilsCrossed, Calendar, Plus, Moon, Check,
} from 'lucide-react'
import { Trip, Stop, Hotel, Activity, Dining, PossibleActivity, NewTripData } from '@/types'
import TripManager from './TripManager'
import TripPanels from './TripPanels'
import NewTripWizard from './NewTripWizard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useHotels } from '@/hooks/useHotels'

// ── Helpers ────────────────────────────────────────────────────────────────────

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDayHeader(dateStr: string, index: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  const weekdays = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
  const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
  return `Dag ${index + 1} – ${weekdays[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]}`
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface CityPlanSidebarProps {
  trips: Trip[]
  currentTrip: Trip
  tripsLoading: boolean
  userId?: string | null
  stop: Stop | null            // The single city stop (auto-created)
  activities: Activity[]
  dining: Dining[]
  possibleActivities: PossibleActivity[]
  selectedDayStr: string | null
  onSelectDay: (day: string | null) => void
  onSelectActivity?: (id: string) => void
  onSelectDining?: (id: string) => void
  onSelectTrip: (trip: Trip) => void
  onCreateTrip: (data: NewTripData) => Promise<Trip | null>
  onDeleteTrip: (id: string) => void
  onUpdateGroupDescription?: (desc: string) => void
}

// ── Hotel section ──────────────────────────────────────────────────────────────

function HotelSection({ stopId }: { stopId: string }) {
  const { hotels, saveHotel } = useHotels([stopId])
  const hotel = hotels.find((h) => h.stop_id === stopId) ?? null
  const [editing, setEditing] = useState(!hotel?.name)

  function save(field: 'name' | 'address' | 'url', value: string) {
    saveHotel(stopId, { [field]: value || null })
  }

  return (
    <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/30 flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <HotelIcon className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Hotell</span>
        <button
          onClick={() => setEditing((e) => !e)}
          className="ml-auto text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          {editing ? 'Ferdig' : 'Rediger'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <input
            type="text"
            defaultValue={hotel?.name ?? ''}
            placeholder="Hotellnavn"
            onBlur={(e) => save('name', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            defaultValue={hotel?.address ?? ''}
            placeholder="Adresse"
            onBlur={(e) => save('address', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            defaultValue={hotel?.url ?? ''}
            placeholder="URL (valgfritt)"
            onBlur={(e) => save('url', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      ) : hotel?.name ? (
        <div>
          <p className="text-sm font-medium text-slate-200">{hotel.name}</p>
          {hotel.address && <p className="text-xs text-slate-400 mt-0.5">{hotel.address}</p>}
          {hotel.url && (
            <a
              href={hotel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:underline mt-0.5 block truncate"
            >
              {hotel.url}
            </a>
          )}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Plus className="w-3 h-3" /> Legg til hotell
        </button>
      )}
    </div>
  )
}

// ── Day row ────────────────────────────────────────────────────────────────────

function DayRow({
  dateStr,
  index,
  activities,
  dining,
  isSelected,
  onToggle,
  onSelectActivity,
  onSelectDining,
}: {
  dateStr: string
  index: number
  activities: Activity[]
  dining: Dining[]
  isSelected: boolean
  onToggle: () => void
  onSelectActivity?: (id: string) => void
  onSelectDining?: (id: string) => void
}) {
  const hasItems = activities.length > 0 || dining.length > 0

  return (
    <div className="border-b border-slate-800/60 last:border-0">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
          isSelected ? 'bg-blue-900/20' : 'hover:bg-slate-800/40'
        }`}
      >
        {isSelected ? (
          <ChevronDown className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        )}
        <span className="text-sm text-slate-200 font-medium flex-1">{formatDayHeader(dateStr, index)}</span>
        {hasItems && (
          <span className="text-[10px] text-slate-500 flex-shrink-0">
            {activities.length > 0 && `${activities.length} akt.`}
            {activities.length > 0 && dining.length > 0 && ' · '}
            {dining.length > 0 && `${dining.length} rest.`}
          </span>
        )}
      </button>

      {isSelected && (
        <div className="pb-2 px-4 space-y-1">
          {activities.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelectActivity?.(a.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-left transition-colors"
            >
              <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-slate-200 flex-1 truncate">{a.name}</span>
              {a.activity_time && (
                <span className="text-[10px] text-slate-500 flex-shrink-0">{a.activity_time}</span>
              )}
            </button>
          ))}
          {dining.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelectDining?.(d.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-left transition-colors"
            >
              <UtensilsCrossed className="w-3 h-3 text-orange-400 flex-shrink-0" />
              <span className="text-xs text-slate-200 flex-1 truncate">{d.name}</span>
              {d.booking_time && (
                <span className="text-[10px] text-slate-500 flex-shrink-0">{d.booking_time}</span>
              )}
            </button>
          ))}
          {!hasItems && (
            <p className="text-xs text-slate-600 italic px-3 py-1">Ingen aktiviteter planlagt</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CityPlanSidebar({
  trips, currentTrip, tripsLoading, userId,
  stop, activities, dining,
  selectedDayStr, onSelectDay,
  onSelectActivity, onSelectDining,
  onSelectTrip, onCreateTrip, onDeleteTrip,
  onUpdateGroupDescription,
}: CityPlanSidebarProps) {
  const [showWizard, setShowWizard] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  // Derive days from date_from / date_to
  const days: string[] = []
  if (currentTrip.date_from && currentTrip.date_to) {
    const from = new Date(currentTrip.date_from + 'T12:00:00')
    const to = new Date(currentTrip.date_to + 'T12:00:00')
    const count = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000))
    for (let i = 0; i < count; i++) {
      days.push(addDays(currentTrip.date_from, i))
    }
  }

  const totalActivities = activities.length
  const nights = currentTrip.date_from && currentTrip.date_to
    ? Math.max(0, Math.round((new Date(currentTrip.date_to + 'T12:00:00').getTime() - new Date(currentTrip.date_from + 'T12:00:00').getTime()) / 86_400_000))
    : stop?.nights ?? 0

  return (
    <div className="w-full md:w-[420px] h-full bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">

      {/* Trip selector */}
      <TripManager
        trips={trips}
        currentTrip={currentTrip}
        loading={tripsLoading}
        userId={userId}
        onSelectTrip={onSelectTrip}
        onRequestCreate={() => setShowWizard(true)}
        onDeleteTrip={(id) => {
          const name = trips.find((t) => t.id === id)?.name ?? 'denne turen'
          setConfirmDelete({ id, name })
        }}
      />
      <NewTripWizard open={showWizard} onClose={() => setShowWizard(false)} onCreateTrip={onCreateTrip} />

      {/* Flight info panel */}
      <TripPanels
        tripId={currentTrip.id}
        groupDescription={currentTrip.group_description}
        onUpdateGroupDescription={onUpdateGroupDescription}
      />

      {/* Hotel (static) */}
      {stop && <HotelSection stopId={stop.id} />}

      {/* Stats */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/30 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs text-slate-400">
            <span className="text-white font-semibold">{totalActivities}</span> aktiviteter
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Moon className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs text-slate-400">
            <span className="text-white font-semibold">{nights}</span> netter
          </span>
        </div>
        {currentTrip.destination_city && (
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <span>{currentTrip.destination_city}</span>
            {currentTrip.destination_country && <span>· {currentTrip.destination_country}</span>}
          </div>
        )}
      </div>

      {/* Day list */}
      <div className="flex-1 overflow-y-auto">
        {days.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
            <Calendar className="w-8 h-8 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 font-medium">Ingen datoer satt</p>
            <p className="text-xs text-slate-600 mt-1">Datoer settes i opprettelsesvinduet for turen.</p>
          </div>
        ) : (
          days.map((dateStr, i) => (
            <DayRow
              key={dateStr}
              dateStr={dateStr}
              index={i}
              activities={activities.filter(
                (a) => a.activity_date === dateStr
              )}
              dining={dining.filter(
                (d) => d.booking_date === dateStr
              )}
              isSelected={selectedDayStr === dateStr}
              onToggle={() => onSelectDay(selectedDayStr === dateStr ? null : dateStr)}
              onSelectActivity={onSelectActivity}
              onSelectDining={onSelectDining}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-800 flex-shrink-0">
        <p className="text-[10px] text-slate-600 text-center">Alle endringer lagres automatisk</p>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Er du sikker på at du vil slette «${confirmDelete.name}»? Dette kan ikke angres.`}
          confirmLabel="Slett"
          onConfirm={() => {
            onDeleteTrip(confirmDelete.id)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
