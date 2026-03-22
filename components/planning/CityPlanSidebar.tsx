'use client'

import { useState, useEffect, useRef } from 'react'

import {
  ChevronDown, ChevronRight, Hotel as HotelIcon, MapPin,
  UtensilsCrossed, Plus, Moon, ExternalLink, Navigation, Loader2, LayoutList,
  Check, X,
} from 'lucide-react'
import { Trip, Stop, Activity, Dining, PossibleActivity, NewTripData, Hotel } from '@/types'
import TripManager from './TripManager'
import TripPanels from './TripPanels'
import NewTripWizard from './NewTripWizard'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { OPEN_NEW_TRIP_WIZARD_EVENT } from '@/components/NavBar'

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

// ── Hotel section ──────────────────────────────────────────────────────────────

function HotelSection({
  stopId,
  hotel,
  onSaveHotel,
  onMovePin,
}: {
  stopId: string
  hotel: Hotel | null
  onSaveHotel: (stopId: string, updates: Partial<Hotel>) => void
  onMovePin?: (lat: number, lng: number) => void
}) {
  const [editing, setEditing] = useState(!hotel?.name)
  const initialized = useRef(false)
  const [geocoding, setGeocoding] = useState(false)

  // Switch out of editing mode once hotel data arrives
  useEffect(() => {
    if (!initialized.current && hotel?.name) {
      initialized.current = true
      setEditing(false)
    }
  }, [hotel?.name])

  async function save(field: 'name' | 'address' | 'url', value: string) {
    onSaveHotel(stopId, { [field]: value || null })
    if (field === 'address' && value.trim() && onMovePin) {
      setGeocoding(true)
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(value.trim())}&key=${apiKey}`
        )
        const json = await res.json()
        const loc = json.results?.[0]?.geometry?.location
        if (loc) onMovePin(loc.lat, loc.lng)
      } finally {
        setGeocoding(false)
      }
    }
  }

  function saveNumber(field: 'cost' | 'parking_cost_per_night', raw: string) {
    const parsed = raw.trim() ? Number(raw.trim()) : null
    onSaveHotel(stopId, { [field]: parsed })
  }

  async function geocodeAddress() {
    if (!hotel?.address && !hotel?.name) return
    const query = hotel.address || hotel.name
    setGeocoding(true)
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query!)}&key=${apiKey}`
      )
      const json = await res.json()
      const loc = json.results?.[0]?.geometry?.location
      if (loc && onMovePin) {
        onMovePin(loc.lat, loc.lng)
      }
    } finally {
      setGeocoding(false)
    }
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500'

  return (
    <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/30 flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <HotelIcon className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Hotell</span>
        {hotel?.address && onMovePin && (
          <button
            onClick={geocodeAddress}
            disabled={geocoding}
            title="Flytt kartet til hotellets adresse"
            className="text-slate-500 hover:text-blue-400 transition-colors disabled:opacity-50"
          >
            {geocoding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
          </button>
        )}
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
            className={inputCls}
          />
          <input
            type="text"
            defaultValue={hotel?.address ?? ''}
            placeholder="Adresse"
            onBlur={(e) => save('address', e.target.value)}
            className={inputCls}
          />
          <input
            type="text"
            defaultValue={hotel?.url ?? ''}
            placeholder="URL (valgfritt)"
            onBlur={(e) => save('url', e.target.value)}
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Kostnad (kr)</p>
              <input
                type="number"
                min="0"
                defaultValue={hotel?.cost ?? ''}
                placeholder="0"
                onBlur={(e) => saveNumber('cost', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Parkering/døgn (kr)</p>
              <input
                type="number"
                min="0"
                defaultValue={hotel?.parking_cost_per_night ?? ''}
                placeholder="0"
                onBlur={(e) => saveNumber('parking_cost_per_night', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ) : hotel?.name ? (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">{hotel.name}</p>
              {hotel.address && <p className="text-xs text-slate-400 mt-0.5">{hotel.address}</p>}
            </div>
            {hotel.url && (
              <a
                href={hotel.url}
                target="_blank"
                rel="noopener noreferrer"
                title={hotel.url}
                className="flex-shrink-0 text-slate-500 hover:text-blue-400 transition-colors mt-0.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {(hotel.cost != null || hotel.parking_cost_per_night != null) && (
            <div className="flex gap-3">
              {hotel.cost != null && (
                <span className="text-[11px] text-slate-400">
                  Kostnad: <span className="text-slate-200 font-medium">{hotel.cost.toLocaleString('nb-NO')} kr</span>
                </span>
              )}
              {hotel.parking_cost_per_night != null && (
                <span className="text-[11px] text-slate-400">
                  Parkering: <span className="text-slate-200 font-medium">{hotel.parking_cost_per_night.toLocaleString('nb-NO')} kr/døgn</span>
                </span>
              )}
            </div>
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
  isCheckout,
  onToggle,
}: {
  dateStr: string
  index: number
  activities: Activity[]
  dining: Dining[]
  isSelected: boolean
  isCheckout?: boolean
  onToggle: () => void
}) {
  const hasItems = activities.length > 0 || dining.length > 0

  const dayLabel = isCheckout
    ? (() => {
        const d = new Date(dateStr + 'T12:00:00')
        const weekdays = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']
        const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
        return `Utreise – ${weekdays[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]}`
      })()
    : formatDayHeader(dateStr, index)

  return (
    <div className="border-b border-slate-800/60 last:border-0">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
          isSelected ? 'bg-blue-900/20 border-l-2 border-blue-500'
          : isCheckout ? 'hover:bg-slate-800/40 opacity-70'
          : 'hover:bg-slate-800/40'
        }`}
      >
        {isSelected ? (
          <ChevronDown className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        ) : (
          <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isCheckout ? 'text-slate-600' : 'text-slate-500'}`} />
        )}
        <span className={`text-sm font-medium flex-1 ${isCheckout ? 'text-slate-400 italic' : 'text-slate-200'}`}>{dayLabel}</span>
        {hasItems && (
          <span className="text-[10px] text-slate-500 flex-shrink-0">
            {activities.length > 0 && `${activities.length} akt.`}
            {activities.length > 0 && dining.length > 0 && ' · '}
            {dining.length > 0 && `${dining.length} rest.`}
          </span>
        )}
      </button>

      {/* Mini preview when expanded – full editing in the right panel */}
      {isSelected && (
        <div className="pb-2 px-4 space-y-1">
          {activities.map((a) => (
            <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60">
              <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-slate-300 flex-1 truncate">{a.name}</span>
              {a.activity_time && (
                <span className="text-[10px] text-slate-500 flex-shrink-0">{a.activity_time.slice(0, 5)}</span>
              )}
            </div>
          ))}
          {dining.map((d) => (
            <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60">
              <UtensilsCrossed className="w-3 h-3 text-orange-400 flex-shrink-0" />
              <span className="text-xs text-slate-300 flex-1 truncate">{d.name}</span>
              {d.booking_time && (
                <span className="text-[10px] text-slate-500 flex-shrink-0">{d.booking_time.slice(0, 5)}</span>
              )}
            </div>
          ))}
          {!hasItems && (
            <p className="text-xs text-slate-600 italic px-3 py-1">Klikk for å planlegge dagen →</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface CityPlanSidebarProps {
  trips: Trip[]
  currentTrip: Trip
  tripsLoading: boolean
  userId?: string | null
  stop: Stop | null
  hotel: Hotel | null
  onSaveHotel: (stopId: string, updates: Partial<Hotel>) => void
  activities: Activity[]
  dining: Dining[]
  possibleActivities: PossibleActivity[]
  selectedDayStr: string | null
  onSelectDay: (day: string | null) => void
  onSelectTrip: (trip: Trip) => void
  onCreateTrip: (data: NewTripData) => Promise<Trip | null>
  onDeleteTrip: (id: string) => void
  onMoveHotelPin?: (lat: number, lng: number) => void
  onZoomToCity?: () => void
  onUpdateGroupDescription?: (desc: string) => void
  onOpenOverview?: () => void
  onUpdateTripDates?: (dateFrom: string, dateTo: string) => void
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CityPlanSidebar({
  trips, currentTrip, tripsLoading, userId,
  stop, hotel, onSaveHotel, activities, dining,
  selectedDayStr, onSelectDay,
  onSelectTrip, onCreateTrip, onDeleteTrip,
  onMoveHotelPin,
  onZoomToCity,
  onUpdateGroupDescription,
  onOpenOverview,
  onUpdateTripDates,
}: CityPlanSidebarProps) {
  const [showWizard, setShowWizard] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  // Open wizard when navigated with ?new=1 (reads URL directly, avoids useSearchParams/Suspense)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('new') === '1') {
      setShowWizard(true)
      window.history.replaceState({}, '', '/plan')
    }
  }, [])

  useEffect(() => {
    function onOpenWizard() { setShowWizard(true) }
    window.addEventListener(OPEN_NEW_TRIP_WIZARD_EVENT, onOpenWizard)
    return () => window.removeEventListener(OPEN_NEW_TRIP_WIZARD_EVENT, onOpenWizard)
  }, [])

  // ── Edit dates state ───────────────────────────────────────────────────────
  const [editingDates, setEditingDates] = useState(false)
  const [editDateFrom, setEditDateFrom] = useState('')
  const [editDateTo, setEditDateTo] = useState('')

  function openEditDates() {
    setEditDateFrom(currentTrip.date_from ?? '')
    setEditDateTo(currentTrip.date_to ?? '')
    setEditingDates(true)
  }

  function cancelEditDates() {
    setEditingDates(false)
  }

  function saveEditDates() {
    if (editDateFrom && editDateTo && editDateFrom <= editDateTo) {
      onUpdateTripDates?.(editDateFrom, editDateTo)
    }
    setEditingDates(false)
  }

  // Derive days from date_from / date_to
  const days: string[] = []
  if (currentTrip.date_from && currentTrip.date_to) {
    const from = new Date(currentTrip.date_from + 'T12:00:00')
    const to = new Date(currentTrip.date_to + 'T12:00:00')
    const count = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000))
    // i <= count: inkluderer siste dag (utreisedag / checkout)
    for (let i = 0; i <= count; i++) {
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
        currentTrip={currentTrip}
        loading={tripsLoading}
        onEditDates={openEditDates}
        showCountdown
      />
      <NewTripWizard open={showWizard} onClose={() => setShowWizard(false)} onCreateTrip={onCreateTrip} />

      {/* Flight info panel */}
      <TripPanels
        tripId={currentTrip.id}
        groupDescription={currentTrip.group_description}
        onUpdateGroupDescription={onUpdateGroupDescription}
        tripDateFrom={currentTrip.date_from ?? undefined}
        transportType={currentTrip.transport_type ?? (currentTrip.has_flight !== false ? 'fly' : 'ingen')}
      />

      {/* Hotel (static, always visible) */}
      {stop && (
        <HotelSection
          stopId={stop.id}
          hotel={hotel}
          onSaveHotel={onSaveHotel}
          onMovePin={onMoveHotelPin}
        />
      )}

      {/* Stats row + edit dates */}
      {editingDates ? (
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-800/40 flex-shrink-0 space-y-2">
          <p className="text-[11px] font-medium text-slate-300">Rediger datoer</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-0.5 block">Fra</label>
              <input
                type="date"
                value={editDateFrom}
                onChange={(e) => {
                  setEditDateFrom(e.target.value)
                  if (editDateTo && e.target.value > editDateTo) setEditDateTo('')
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 mb-0.5 block">Til</label>
              <input
                type="date"
                value={editDateTo}
                min={editDateFrom || undefined}
                onChange={(e) => setEditDateTo(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          {editDateFrom && editDateTo && (
            <p className="text-[10px] text-slate-500">
              {Math.max(0, Math.round((new Date(editDateTo + 'T12:00:00').getTime() - new Date(editDateFrom + 'T12:00:00').getTime()) / 86_400_000))} netter
            </p>
          )}
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={saveEditDates}
              disabled={!editDateFrom || !editDateTo || editDateFrom > editDateTo}
              className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              <Check className="w-3 h-3" /> Lagre
            </button>
            <button
              onClick={cancelEditDates}
              className="flex items-center gap-1 text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
            >
              <X className="w-3 h-3" /> Avbryt
            </button>
          </div>
        </div>
      ) : (
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
          {(currentTrip.destination_city || currentTrip.destination_country) && (
            <button
              onClick={onZoomToCity}
              title="Zoom til destinasjon i kartet"
              className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors"
            >
              <Navigation className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[80px]">
                {[currentTrip.destination_city, currentTrip.destination_country].filter(Boolean).join(', ')}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Day list */}
      <div className="flex-1 overflow-y-auto">
        {days.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
            <MapPin className="w-8 h-8 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 font-medium">Ingen datoer satt</p>
            <p className="text-xs text-slate-600 mt-1">Datoer settes i opprettelsesvinduet for turen.</p>
          </div>
        ) : (
          days.map((dateStr, i) => (
            <DayRow
              key={dateStr}
              dateStr={dateStr}
              index={i}
              activities={activities.filter(a => a.activity_date === dateStr)}
              dining={dining.filter(d => d.booking_date === dateStr)}
              isSelected={selectedDayStr === dateStr}
              isCheckout={i === days.length - 1}
              onToggle={() => onSelectDay(selectedDayStr === dateStr ? null : dateStr)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-800 flex-shrink-0 flex items-center justify-between">
        <p className="text-[10px] text-slate-600">Alle endringer lagres automatisk</p>
        {onOpenOverview && days.length > 0 && (
          <button
            onClick={onOpenOverview}
            title="Vis reiseoversikt"
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
          >
            <LayoutList className="w-3 h-3" />
            Oversikt
          </button>
        )}
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
