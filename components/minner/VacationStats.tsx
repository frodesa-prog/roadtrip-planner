'use client'

import { useState, useMemo } from 'react'
import { X, Globe, Car, MapPin, Flag, Navigation, Map, ChevronDown, ChevronRight } from 'lucide-react'
import type { Trip, Stop } from '@/types'

// ── Haversine km mellom to koordinater ───────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Alle 50 US-delstater (navn + forkortelse) ─────────────────────────────────
const US_STATES = new Set([
  'alabama','al','alaska','ak','arizona','az','arkansas','ar',
  'california','ca','colorado','co','connecticut','ct','delaware','de',
  'florida','fl','georgia','ga','hawaii','hi','idaho','id',
  'illinois','il','indiana','in','iowa','ia','kansas','ks',
  'kentucky','ky','louisiana','la','maine','me','maryland','md',
  'massachusetts','ma','michigan','mi','minnesota','mn','mississippi','ms',
  'missouri','mo','montana','mt','nebraska','ne','nevada','nv',
  'new hampshire','nh','new jersey','nj','new mexico','nm','new york','ny',
  'north carolina','nc','north dakota','nd','ohio','oh','oklahoma','ok',
  'oregon','or','pennsylvania','pa','rhode island','ri','south carolina','sc',
  'south dakota','sd','tennessee','tn','texas','tx','utah','ut',
  'vermont','vt','virginia','va','washington','wa','west virginia','wv',
  'wisconsin','wi','wyoming','wy','district of columbia','dc','washington dc',
])
const isUSState = (s: string) => US_STATES.has(s.toLowerCase().trim())

// ── USA-gjenkjenning (land-felt ELLER delstat på stopp) ───────────────────────
const USA_COUNTRY_NAMES = ['usa','us','united states','united states of america','amerika']
const isUSATrip = (t: Trip) => USA_COUNTRY_NAMES.includes((t.destination_country ?? '').toLowerCase().trim())
const isUSAStop = (s: Stop) => !!s.state && isUSState(s.state)

// ── Flagg-emoji per land ──────────────────────────────────────────────────────
const COUNTRY_FLAG: Record<string, string> = {
  usa:'🇺🇸',us:'🇺🇸','united states':'🇺🇸',amerika:'🇺🇸',
  norge:'🇳🇴',norway:'🇳🇴',
  frankrike:'🇫🇷',france:'🇫🇷',
  spania:'🇪🇸',spain:'🇪🇸',
  italia:'🇮🇹',italy:'🇮🇹',
  tyskland:'🇩🇪',germany:'🇩🇪',
  england:'🇬🇧',uk:'🇬🇧','united kingdom':'🇬🇧',storbritannia:'🇬🇧',
  portugal:'🇵🇹',
  hellas:'🇬🇷',greece:'🇬🇷',
  kroatia:'🇭🇷',croatia:'🇭🇷',
  østerrike:'🇦🇹',austria:'🇦🇹',
  sveits:'🇨🇭',switzerland:'🇨🇭',
  nederland:'🇳🇱',netherlands:'🇳🇱',
  belgia:'🇧🇪',belgium:'🇧🇪',
  sverige:'🇸🇪',sweden:'🇸🇪',
  denmark:'🇩🇰',danmark:'🇩🇰',
  finland:'🇫🇮',
  canada:'🇨🇦',
  mexico:'🇲🇽',
  japan:'🇯🇵',
  thailand:'🇹🇭',
  australia:'🇦🇺',
  'new zealand':'🇳🇿',
  dubai:'🇦🇪',uae:'🇦🇪',
  cuba:'🇨🇺',
  'dominikanske republikk':'🇩🇴','dominican republic':'🇩🇴',
  maldivene:'🇲🇻',maldives:'🇲🇻',
}
function countryFlag(name: string) {
  return COUNTRY_FLAG[name.toLowerCase().trim()] ?? '🌍'
}

// ── Typer ─────────────────────────────────────────────────────────────────────
interface Props { trips: Trip[]; stops: Stop[] }

interface GroupedCountry { country: string; cities: string[]; expanded: boolean }

// ── StatCard ──────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode; value: string | number; label: string
  sub?: React.ReactNode; color: string; bgColor: string; onClick: () => void
}
function StatCard({ icon, value, label, sub, color, bgColor, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 text-left hover:border-slate-600 hover:bg-slate-800/80 transition-all duration-150 active:scale-[0.98] w-full"
    >
      <div className="flex items-center justify-between">
        <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
        <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">detaljer →</span>
      </div>
      <div>
        <p className={`text-3xl font-bold tracking-tight ${color}`}>{value}</p>
        <p className="text-xs font-medium text-slate-400 mt-0.5">{label}</p>
        {sub && <div className="mt-1.5">{sub}</div>}
      </div>
    </button>
  )
}

// ── Enkel modal (flat liste) ──────────────────────────────────────────────────
interface FlatItem { label: string; sub?: string }
interface FlatModalProps {
  title: string; icon: React.ReactNode
  items: FlatItem[]; onClose: () => void
}
function FlatModal({ title, icon, items, onClose }: FlatModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">{icon}</span>
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {items.length === 0
            ? <p className="text-sm text-slate-500 text-center py-8">Ingen data ennå</p>
            : <ul className="divide-y divide-slate-800/60">
                {items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-slate-200">{item.label}</span>
                    {item.sub && <span className="text-xs text-slate-500 ml-3 text-right">{item.sub}</span>}
                  </li>
                ))}
              </ul>
          }
        </div>
        <div className="px-5 py-3 border-t border-slate-800 flex-shrink-0">
          <p className="text-xs text-slate-500 text-center">{items.length} element{items.length !== 1 ? 'er' : ''}</p>
        </div>
      </div>
    </div>
  )
}

// ── Gruppert modal (steder i verden → per land) ───────────────────────────────
function GroupedWorldModal({ groups, onClose }: { groups: GroupedCountry[]; onClose: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const totalCities = groups.reduce((s, g) => s + g.cities.length, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-400"><Map className="w-4 h-4" /></span>
            <h2 className="text-sm font-semibold text-slate-100">Alle steder i verden</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {groups.length === 0
            ? <p className="text-sm text-slate-500 text-center py-8">Ingen data ennå</p>
            : groups.map((g) => {
                const isOpen = expanded[g.country] ?? false
                return (
                  <div key={g.country} className="border-b border-slate-800/60 last:border-0">
                    {/* Land-rad */}
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [g.country]: !isOpen }))}
                      className="flex items-center justify-between w-full px-5 py-3 hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{countryFlag(g.country)}</span>
                        <span className="text-sm font-medium text-slate-200">{g.country}</span>
                        <span className="text-xs text-slate-500">({g.cities.length})</span>
                      </div>
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      }
                    </button>
                    {/* Byer */}
                    {isOpen && (
                      <ul className="bg-slate-950/40">
                        {g.cities.map((city, i) => (
                          <li key={i} className="flex items-center gap-2 px-8 py-2 border-t border-slate-800/40">
                            <span className="text-slate-500 text-xs">📍</span>
                            <span className="text-sm text-slate-300">{city}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })
          }
        </div>

        <div className="px-5 py-3 border-t border-slate-800 flex-shrink-0">
          <p className="text-xs text-slate-500 text-center">{totalCities} steder i {groups.length} land</p>
        </div>
      </div>
    </div>
  )
}

// ── Hva som vises i modal-state ───────────────────────────────────────────────
type ModalType = 'countries' | 'trips' | 'km' | 'states' | 'usacities' | 'world' | null

// ── Hoved-komponent ───────────────────────────────────────────────────────────
export default function VacationStats({ trips, stops }: Props) {
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  const stats = useMemo(() => {
    // Kart: tripId → trip
    const tripMap = new Map(trips.map(t => [t.id, t]))

    // ── Land ──────────────────────────────────────────────────────────────────
    // Samle land fra destination_country OG fra stopp med US-delstat
    const countrySet = new Set<string>()
    trips.forEach(t => {
      if (t.destination_country?.trim()) countrySet.add(t.destination_country.trim())
    })
    // Legg til "USA" hvis noen stopp er i en US-delstat men turen mangler land-felt
    const hasUsaStops = stops.some(isUSAStop)
    if (hasUsaStops && !Array.from(countrySet).some(c => USA_COUNTRY_NAMES.includes(c.toLowerCase()))) {
      countrySet.add('USA')
    }
    const countryList = [...countrySet].sort()

    // ── Turer per type ─────────────────────────────────────────────────────────
    const roadtrips   = trips.filter(t => t.trip_type === 'road_trip')
    const storbyturer = trips.filter(t => t.trip_type === 'storbytur')
    const resorts     = trips.filter(t => t.trip_type === 'resort')

    // ── Km kjørt (Haversine, kun roadtrips, fra planlegger-stopp) ─────────────
    const stopsByTrip = new Map<string, Stop[]>()
    stops.forEach(s => {
      if (!stopsByTrip.has(s.trip_id)) stopsByTrip.set(s.trip_id, [])
      stopsByTrip.get(s.trip_id)!.push(s)
    })

    let totalKm = 0
    const kmPerTrip: { name: string; km: number }[] = []
    roadtrips.forEach(t => {
      const tStops = (stopsByTrip.get(t.id) ?? []).slice().sort((a, b) => a.order - b.order)
      let tripKm = 0
      for (let i = 1; i < tStops.length; i++) {
        tripKm += haversineKm(tStops[i-1].lat, tStops[i-1].lng, tStops[i].lat, tStops[i].lng)
      }
      if (tripKm > 0) {
        totalKm += tripKm
        kmPerTrip.push({ name: t.name, km: Math.round(tripKm) })
      }
    })
    kmPerTrip.sort((a, b) => b.km - a.km)

    // ── USA-stopp ──────────────────────────────────────────────────────────────
    // USA-tur = turen er merket USA ELLER stoppet har en US-delstat
    const usaStops = stops.filter(s => {
      const trip = tripMap.get(s.trip_id)
      return (trip && isUSATrip(trip)) || isUSAStop(s)
    })

    // Unike stater (case-insensitive, men vis originalt)
    const stateMap = new Map<string, string>() // lower → original
    usaStops.forEach(s => {
      if (s.state?.trim()) stateMap.set(s.state.trim().toLowerCase(), s.state.trim())
    })
    const usaStateList = [...stateMap.values()].sort()

    // Unike byer i USA (case-insensitive dedup)
    const usaCityMap = new Map<string, string>()
    usaStops.forEach(s => {
      if (s.city?.trim()) usaCityMap.set(s.city.trim().toLowerCase(), s.city.trim())
    })
    const usaCityList = [...usaCityMap.values()].sort()

    // ── Alle steder i verden (unike, gruppert per land) ────────────────────────
    const cityByCountry = new Map<string, Set<string>>() // country → Set<city_lower>
    const cityOriginal  = new Map<string, string>()      // city_lower → original city

    stops.forEach(s => {
      if (!s.city?.trim()) return
      const cityLow = s.city.trim().toLowerCase()
      cityOriginal.set(cityLow, s.city.trim())

      // Finn land for dette stoppet
      const trip = tripMap.get(s.trip_id)
      let country = trip?.destination_country?.trim() || ''
      // Hvis turen mangler land men stoppet er i USA → "USA"
      if (!country && isUSAStop(s)) country = 'USA'
      if (!country) country = 'Ukjent'

      if (!cityByCountry.has(country)) cityByCountry.set(country, new Set())
      cityByCountry.get(country)!.add(cityLow)
    })

    const worldGroups: GroupedCountry[] = [...cityByCountry.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'nb'))
      .map(([country, citySet]) => ({
        country,
        cities: [...citySet].map(c => cityOriginal.get(c) ?? c).sort(),
        expanded: false,
      }))

    const totalWorldCities = worldGroups.reduce((s, g) => s + g.cities.length, 0)

    return {
      countryList, roadtrips, storbyturer, resorts,
      totalKm: Math.round(totalKm), kmPerTrip,
      usaStateList, usaCityList,
      worldGroups, totalWorldCities,
    }
  }, [trips, stops])

  // ── Modal-innhold ──────────────────────────────────────────────────────────
  const countriesItems = stats.countryList.map(c => ({ label: `${countryFlag(c)} ${c}` }))

  const tripsItems = useMemo(() => {
    const items: { label: string; sub?: string }[] = []
    const push = (list: Trip[], emoji: string, label: string) => {
      if (!list.length) return
      items.push({ label: `${emoji} ${label}`, sub: `${list.length} turer` })
      list.forEach(t => items.push({
        label: `  ${t.name}`,
        sub: t.date_from?.slice(0, 4) ?? String(t.year),
      }))
    }
    push(stats.roadtrips,   '🚗', 'Roadtrips')
    push(stats.storbyturer, '🏙️', 'Storbyturer')
    push(stats.resorts,     '🌴', 'Resort')
    return items
  }, [stats.roadtrips, stats.storbyturer, stats.resorts])

  const kmItems = stats.kmPerTrip.map(({ name, km }) => ({
    label: name,
    sub: `${km.toLocaleString('nb-NO')} km`,
  }))

  const statesItems = stats.usaStateList.map(s => ({ label: `🇺🇸 ${s}` }))
  const usaCitiesItems = stats.usaCityList.map(c => ({ label: `📍 ${c}` }))

  return (
    <>
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center gap-2">
          <Globe className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">Reisestatistikk</h2>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">

          <StatCard
            icon={<Globe className="w-4 h-4" />}
            value={stats.countryList.length}
            label="Land besøkt"
            color="text-sky-400" bgColor="bg-sky-400/10"
            onClick={() => setActiveModal('countries')}
          />

          <StatCard
            icon={<Car className="w-4 h-4" />}
            value={trips.length}
            label="Turer totalt"
            color="text-amber-400" bgColor="bg-amber-400/10"
            sub={
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {stats.roadtrips.length   > 0 && <span className="text-[10px] text-slate-500">🚗 {stats.roadtrips.length}</span>}
                {stats.storbyturer.length > 0 && <span className="text-[10px] text-slate-500">🏙️ {stats.storbyturer.length}</span>}
                {stats.resorts.length     > 0 && <span className="text-[10px] text-slate-500">🌴 {stats.resorts.length}</span>}
              </div>
            }
            onClick={() => setActiveModal('trips')}
          />

          <StatCard
            icon={<Navigation className="w-4 h-4" />}
            value={stats.totalKm > 0 ? stats.totalKm.toLocaleString('nb-NO') : '–'}
            label="Km kjørt totalt"
            color="text-emerald-400" bgColor="bg-emerald-400/10"
            onClick={() => setActiveModal('km')}
          />

          <StatCard
            icon={<Flag className="w-4 h-4" />}
            value={stats.usaStateList.length}
            label="Stater i USA"
            color="text-red-400" bgColor="bg-red-400/10"
            onClick={() => setActiveModal('states')}
          />

          <StatCard
            icon={<MapPin className="w-4 h-4" />}
            value={stats.usaCityList.length}
            label="Steder i USA"
            color="text-orange-400" bgColor="bg-orange-400/10"
            onClick={() => setActiveModal('usacities')}
          />

          <StatCard
            icon={<Map className="w-4 h-4" />}
            value={stats.totalWorldCities}
            label="Steder i verden"
            color="text-purple-400" bgColor="bg-purple-400/10"
            onClick={() => setActiveModal('world')}
          />

        </div>
      </div>

      {/* Modaler */}
      {activeModal === 'countries' && (
        <FlatModal title="Land besøkt" icon={<Globe className="w-4 h-4" />}
          items={countriesItems} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'trips' && (
        <FlatModal title="Alle turer" icon={<Car className="w-4 h-4" />}
          items={tripsItems} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'km' && (
        <FlatModal title="Km kjørt per roadtrip" icon={<Navigation className="w-4 h-4" />}
          items={kmItems} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'states' && (
        <FlatModal title="Stater i USA besøkt" icon={<Flag className="w-4 h-4" />}
          items={statesItems} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'usacities' && (
        <FlatModal title="Steder besøkt i USA" icon={<MapPin className="w-4 h-4" />}
          items={usaCitiesItems} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'world' && (
        <GroupedWorldModal groups={stats.worldGroups} onClose={() => setActiveModal(null)} />
      )}
    </>
  )
}
