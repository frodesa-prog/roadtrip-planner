'use client'

import { useState } from 'react'
import { X, Globe, Car, MapPin, Flag, Navigation, Map } from 'lucide-react'
import type { Trip, TripMemory, Stop } from '@/types'

// ── Hjelpere ─────────────────────────────────────────────────────────────────

const USA_NAMES = ['usa', 'us', 'united states', 'united states of america', 'amerika', 'usa (roadtrip)']
const isUSATrip = (t: Trip) => USA_NAMES.includes((t.destination_country ?? '').toLowerCase().trim())

const TRIP_TYPE_LABEL: Record<string, string> = {
  road_trip: 'Roadtrip',
  storbytur: 'Storbytur',
  resort:    'Resort',
}
const TRIP_TYPE_EMOJI: Record<string, string> = {
  road_trip: '🚗',
  storbytur: '🏙️',
  resort:    '🌴',
}

// Enkelt land → flagg-emoji mapping
const COUNTRY_FLAG: Record<string, string> = {
  'usa': '🇺🇸', 'united states': '🇺🇸', 'us': '🇺🇸', 'amerika': '🇺🇸',
  'norge': '🇳🇴', 'norway': '🇳🇴',
  'frankrike': '🇫🇷', 'france': '🇫🇷',
  'spania': '🇪🇸', 'spain': '🇪🇸',
  'italia': '🇮🇹', 'italy': '🇮🇹',
  'tyskland': '🇩🇪', 'germany': '🇩🇪',
  'england': '🇬🇧', 'uk': '🇬🇧', 'united kingdom': '🇬🇧', 'storbritannia': '🇬🇧',
  'portugal': '🇵🇹',
  'hellas': '🇬🇷', 'greece': '🇬🇷',
  'kroatia': '🇭🇷', 'croatia': '🇭🇷',
  'østerrike': '🇦🇹', 'austria': '🇦🇹',
  'sveits': '🇨🇭', 'switzerland': '🇨🇭',
  'nederland': '🇳🇱', 'netherlands': '🇳🇱',
  'belgia': '🇧🇪', 'belgium': '🇧🇪',
  'sverige': '🇸🇪', 'sweden': '🇸🇪',
  'denmark': '🇩🇰', 'danmark': '🇩🇰',
  'finland': '🇫🇮',
  'canada': '🇨🇦',
  'mexico': '🇲🇽',
  'japan': '🇯🇵',
  'thailand': '🇹🇭',
  'australia': '🇦🇺',
  'new zealand': '🇳🇿', 'new zealand / australia': '🇳🇿',
  'dubai': '🇦🇪', 'de': '🇦🇪', 'uae': '🇦🇪',
  'cuba': '🇨🇺',
  'dominican republic': '🇩🇴', 'dominikanske republikk': '🇩🇴',
  'maldivene': '🇲🇻', 'maldives': '🇲🇻',
}
function countryFlag(name: string) {
  return COUNTRY_FLAG[name.toLowerCase().trim()] ?? '🌍'
}

// ── Typer ─────────────────────────────────────────────────────────────────────

interface DetailItem { label: string; sub?: string }
interface DetailModal { title: string; icon: React.ReactNode; items: DetailItem[] }

interface Props {
  trips:    Trip[]
  memories: TripMemory[]
  stops:    Stop[]
}

// ── Statistikkboks ────────────────────────────────────────────────────────────

interface StatCardProps {
  icon:     React.ReactNode
  value:    string | number
  label:    string
  sub?:     React.ReactNode
  color:    string   // tailwind text-color class
  bgColor:  string   // tailwind bg-color class
  onClick:  () => void
}

function StatCard({ icon, value, label, sub, color, bgColor, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 text-left hover:border-slate-600 hover:bg-slate-800/80 transition-all duration-150 active:scale-[0.98]"
    >
      <div className={`flex items-center justify-between`}>
        <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
        <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">
          Trykk for detaljer →
        </span>
      </div>
      <div>
        <p className={`text-3xl font-bold tracking-tight ${color}`}>{value}</p>
        <p className="text-xs font-medium text-slate-400 mt-0.5">{label}</p>
        {sub && <div className="mt-1.5">{sub}</div>}
      </div>
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function DetailDrawer({ modal, onClose }: { modal: DetailModal; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">{modal.icon}</span>
            <h2 className="text-sm font-semibold text-slate-100">{modal.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Liste */}
        <div className="overflow-y-auto flex-1">
          {modal.items.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Ingen data ennå</p>
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {modal.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-slate-200">{item.label}</span>
                  {item.sub && (
                    <span className="text-xs text-slate-500 ml-3 text-right">{item.sub}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex-shrink-0">
          <p className="text-xs text-slate-500 text-center">{modal.items.length} element{modal.items.length !== 1 ? 'er' : ''}</p>
        </div>
      </div>
    </div>
  )
}

// ── Hoved-komponent ───────────────────────────────────────────────────────────

export default function VacationStats({ trips, memories, stops }: Props) {
  const [modal, setModal] = useState<DetailModal | null>(null)

  // ── Beregn statistikk ──────────────────────────────────────────────────────

  // 1. Unike land
  const countryList = [...new Set(
    trips.map(t => t.destination_country).filter(Boolean) as string[]
  )].sort()

  // 2. Turer per type
  const roadtrips = trips.filter(t => t.trip_type === 'road_trip')
  const storbyturer = trips.filter(t => t.trip_type === 'storbytur')
  const resorts = trips.filter(t => t.trip_type === 'resort')

  // 3. Totalt km kjørt (fra minnebøker)
  const totalKm = Math.round(
    memories.reduce((sum, m) => sum + (m.total_km ?? 0), 0)
  )
  // Km per tur (kun de med km > 0)
  const kmPerTrip = trips
    .map(t => ({ trip: t, km: Math.round(memories.find(m => m.trip_id === t.id)?.total_km ?? 0) }))
    .filter(({ km }) => km > 0)
    .sort((a, b) => b.km - a.km)

  // 4 & 5. USA-statistikk
  const usaTripIds = new Set(trips.filter(isUSATrip).map(t => t.id))
  const usaStops = stops.filter(s => usaTripIds.has(s.trip_id))
  const usaStateList = [...new Set(usaStops.map(s => s.state).filter(Boolean))].sort()
  const usaCityList  = usaStops.map(s => s.city).filter(Boolean).sort()

  // 6. Alle steder i verden
  const allCities = stops.map(s => s.city).filter(Boolean)
  // Legg til destination_city for turer uten stoppesteder
  const tripsWithStops = new Set(stops.map(s => s.trip_id))
  const extraCities = trips
    .filter(t => !tripsWithStops.has(t.id) && t.destination_city)
    .map(t => t.destination_city as string)
  const worldCityList = [...allCities, ...extraCities].sort()

  // ── Detaljvisning ──────────────────────────────────────────────────────────

  function showCountries() {
    setModal({
      title: 'Land jeg har besøkt',
      icon: <Globe className="w-4 h-4" />,
      items: countryList.map(c => ({ label: `${countryFlag(c)} ${c}` })),
    })
  }

  function showTrips() {
    const items: DetailItem[] = []
    if (roadtrips.length) {
      items.push({ label: '🚗 Roadtrips', sub: `${roadtrips.length} turer` })
      roadtrips.forEach(t => items.push({ label: `  ${t.name}`, sub: t.date_from?.slice(0, 4) ?? String(t.year) }))
    }
    if (storbyturer.length) {
      items.push({ label: '🏙️ Storbyturer', sub: `${storbyturer.length} turer` })
      storbyturer.forEach(t => items.push({ label: `  ${t.name}`, sub: t.date_from?.slice(0, 4) ?? String(t.year) }))
    }
    if (resorts.length) {
      items.push({ label: '🌴 Resort', sub: `${resorts.length} turer` })
      resorts.forEach(t => items.push({ label: `  ${t.name}`, sub: t.date_from?.slice(0, 4) ?? String(t.year) }))
    }
    setModal({ title: 'Alle turer', icon: <Car className="w-4 h-4" />, items })
  }

  function showKm() {
    setModal({
      title: 'Kilometer kjørt',
      icon: <Navigation className="w-4 h-4" />,
      items: kmPerTrip.map(({ trip, km }) => ({
        label: trip.name,
        sub: `${km.toLocaleString('nb-NO')} km`,
      })),
    })
  }

  function showUsaStates() {
    setModal({
      title: 'Stater i USA vi har besøkt',
      icon: <Flag className="w-4 h-4" />,
      items: usaStateList.map(s => ({ label: `🇺🇸 ${s}` })),
    })
  }

  function showUsaCities() {
    setModal({
      title: 'Steder vi har besøkt i USA',
      icon: <MapPin className="w-4 h-4" />,
      items: usaCityList.map(c => ({ label: `📍 ${c}` })),
    })
  }

  function showWorldCities() {
    setModal({
      title: 'Alle steder i verden',
      icon: <Map className="w-4 h-4" />,
      items: worldCityList.map(c => ({ label: `📍 ${c}` })),
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
        {/* Overskrift */}
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-2">
          <Globe className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">Reisestatistikk</h2>
        </div>

        {/* Statistikk-grid */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">

          {/* Land */}
          <StatCard
            icon={<Globe className="w-4.5 h-4.5" />}
            value={countryList.length}
            label="Land besøkt"
            color="text-sky-400"
            bgColor="bg-sky-400/10"
            onClick={showCountries}
          />

          {/* Turer */}
          <StatCard
            icon={<Car className="w-4.5 h-4.5" />}
            value={trips.length}
            label="Turer totalt"
            color="text-amber-400"
            bgColor="bg-amber-400/10"
            sub={
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {roadtrips.length > 0  && <span className="text-[10px] text-slate-500">🚗 {roadtrips.length}</span>}
                {storbyturer.length > 0 && <span className="text-[10px] text-slate-500">🏙️ {storbyturer.length}</span>}
                {resorts.length > 0    && <span className="text-[10px] text-slate-500">🌴 {resorts.length}</span>}
              </div>
            }
            onClick={showTrips}
          />

          {/* Km kjørt */}
          <StatCard
            icon={<Navigation className="w-4.5 h-4.5" />}
            value={totalKm > 0 ? totalKm.toLocaleString('nb-NO') : '–'}
            label="Km kjørt totalt"
            color="text-emerald-400"
            bgColor="bg-emerald-400/10"
            onClick={showKm}
          />

          {/* Stater i USA */}
          <StatCard
            icon={<Flag className="w-4.5 h-4.5" />}
            value={usaStateList.length}
            label="Stater i USA"
            color="text-red-400"
            bgColor="bg-red-400/10"
            onClick={showUsaStates}
          />

          {/* Steder i USA */}
          <StatCard
            icon={<MapPin className="w-4.5 h-4.5" />}
            value={usaCityList.length}
            label="Steder i USA"
            color="text-orange-400"
            bgColor="bg-orange-400/10"
            onClick={showUsaCities}
          />

          {/* Steder i verden */}
          <StatCard
            icon={<Map className="w-4.5 h-4.5" />}
            value={worldCityList.length}
            label="Steder i verden"
            color="text-purple-400"
            bgColor="bg-purple-400/10"
            onClick={showWorldCities}
          />

        </div>
      </div>

      {/* Detalj-modal */}
      {modal && <DetailDrawer modal={modal} onClose={() => setModal(null)} />}
    </>
  )
}
