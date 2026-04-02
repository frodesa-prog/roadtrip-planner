'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Globe, Car, MapPin, Flag, Navigation, Map as MapIcon, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import type { Trip, Stop } from '@/types'

// ── US-delstat forkortelse → fullt navn ───────────────────────────────────────
const US_STATE_FULL: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas',
  CA:'California', CO:'Colorado', CT:'Connecticut', DE:'Delaware',
  FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho',
  IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas',
  KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland',
  MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi',
  MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada',
  NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York',
  NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma',
  OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina',
  SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah',
  VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia',
  WI:'Wisconsin', WY:'Wyoming', DC:'Washington D.C.',
}
// Alle kjente verdier (forkortelse + fullt navn) for gjenkjenning
const US_STATES_SET = new Set([
  ...Object.keys(US_STATE_FULL).map(k => k.toLowerCase()),
  ...Object.values(US_STATE_FULL).map(v => v.toLowerCase()),
])
const expandStateName = (s: string): string =>
  US_STATE_FULL[s.trim().toUpperCase()] ?? s.trim()

const isUSState = (s: string) => US_STATES_SET.has(s.toLowerCase().trim())

// ── USA-gjenkjenning ──────────────────────────────────────────────────────────
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
const countryFlag = (name: string) => COUNTRY_FLAG[name.toLowerCase().trim()] ?? '🌍'

// ── Typer ─────────────────────────────────────────────────────────────────────
interface Props { trips: Trip[]; stops: Stop[] }
interface GroupedSection { header: string; cities: string[] }

// ── StatCard ──────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode; value: React.ReactNode; label: string
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
function FlatModal({ title, icon, items, onClose }: {
  title: string; icon: React.ReactNode; items: FlatItem[]; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
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

// ── Gruppert modal (steder med seksjonshoder) ─────────────────────────────────
function GroupedModal({ title, icon, groups, footer, onClose }: {
  title: string; icon: React.ReactNode
  groups: GroupedSection[]; footer?: string; onClose: () => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const total = groups.reduce((s, g) => s + g.cities.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
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
          {groups.length === 0
            ? <p className="text-sm text-slate-500 text-center py-8">Ingen data ennå</p>
            : groups.map((g) => {
                const isOpen = expanded[g.header] ?? false
                return (
                  <div key={g.header} className="border-b border-slate-800/60 last:border-0">
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [g.header]: !isOpen }))}
                      className="flex items-center justify-between w-full px-5 py-3 hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{g.header}</span>
                        <span className="text-xs text-slate-500">({g.cities.length})</span>
                      </div>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                               : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                    </button>
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
          <p className="text-xs text-slate-500 text-center">{footer ?? `${total} steder`}</p>
        </div>
      </div>
    </div>
  )
}

type ModalType = 'countries' | 'trips' | 'km' | 'states' | 'usacities' | 'world' | null

// ── Hoved-komponent ───────────────────────────────────────────────────────────
export default function VacationStats({ trips, stops }: Props) {
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  // Faktisk kjørelengde fra Google Directions (beregnes asynkront)
  const [drivingKm, setDrivingKm] = useState<number | null>(null)
  const [kmLoading, setKmLoading] = useState(false)
  const [kmPerTrip, setKmPerTrip] = useState<{ name: string; km: number }[]>([])

  // ── Hent faktisk kjørelengde via Google Directions (samme kilde som planleggeren) ──
  useEffect(() => {
    if (!stops.length || !trips.length) return

    const roadtrips = trips.filter(t => t.trip_type === 'road_trip')
    if (!roadtrips.length) { setDrivingKm(0); return }

    setKmLoading(true)

    async function fetchLeg(fromStop: Stop, toStop: Stop): Promise<number> {
      try {
        const res = await fetch(
          `/api/directions?origin=${fromStop.lat},${fromStop.lng}&destination=${toStop.lat},${toStop.lng}`
        )
        if (!res.ok) return 0
        const data = await res.json()
        return data.distanceKm ?? 0
      } catch {
        return 0
      }
    }

    async function computeAllKm() {
      const stopsByTrip = new globalThis.Map<string, Stop[]>()
      stops.forEach(s => {
        if (!stopsByTrip.has(s.trip_id)) stopsByTrip.set(s.trip_id, [])
        stopsByTrip.get(s.trip_id)!.push(s)
      })

      const results: { name: string; km: number }[] = []
      let total = 0

      await Promise.all(roadtrips.map(async (trip) => {
        const tStops = (stopsByTrip.get(trip.id) ?? [])
          .slice().sort((a, b) => a.order - b.order)
        if (tStops.length < 2) return

        const legKms = await Promise.all(
          tStops.slice(1).map((to, i) => fetchLeg(tStops[i], to))
        )
        const tripKm = Math.round(legKms.reduce((s, k) => s + k, 0))
        if (tripKm > 0) results.push({ name: trip.name, km: tripKm })
        total += tripKm
      }))

      results.sort((a, b) => b.km - a.km)
      setKmPerTrip(results)
      setDrivingKm(Math.round(total))
      setKmLoading(false)
    }

    computeAllKm()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips.map(t => t.id).join(','), stops.map(s => s.id).join(',')])

  // ── Beregn statistikk (synkront, fra planlegger-data) ─────────────────────
  const stats = useMemo(() => {
    const tripMap = new globalThis.Map<string, Trip>(trips.map(t => [t.id, t] as [string, Trip]))

    // Land
    const countrySet = new globalThis.Set<string>()
    trips.forEach(t => { if (t.destination_country?.trim()) countrySet.add(t.destination_country.trim()) })
    const hasUsaStops = stops.some(isUSAStop)
    if (hasUsaStops && !Array.from(countrySet).some(c => USA_COUNTRY_NAMES.includes(c.toLowerCase()))) {
      countrySet.add('USA')
    }
    const countryList = Array.from(countrySet).sort()

    // Turer per type
    const roadtrips   = trips.filter(t => t.trip_type === 'road_trip')
    const storbyturer = trips.filter(t => t.trip_type === 'storbytur')
    const resorts     = trips.filter(t => t.trip_type === 'resort')

    // USA-stopp
    const usaTripIds = new globalThis.Set(trips.filter(isUSATrip).map(t => t.id))
    const usaStops = stops.filter(s => usaTripIds.has(s.trip_id) || isUSAStop(s))

    // Unike stater (fullt navn)
    const stateMap = new globalThis.Map<string, string>() // lower → full name
    usaStops.forEach(s => {
      if (s.state?.trim()) {
        const full = expandStateName(s.state)
        stateMap.set(full.toLowerCase(), full)
      }
    })
    const usaStateList = Array.from(stateMap.values()).sort()

    // Unike byer i USA, gruppert per stat (fullt navn)
    const usaCityByState = new globalThis.Map<string, globalThis.Set<string>>()
    usaStops.forEach(s => {
      if (!s.city?.trim()) return
      const stateFull = s.state?.trim() ? expandStateName(s.state) : 'Ukjent stat'
      if (!usaCityByState.has(stateFull)) usaCityByState.set(stateFull, new globalThis.Set())
      usaCityByState.get(stateFull)!.add(s.city.trim())
    })
    // Dedup på tvers av stater: samme by kan stå i to stater – behold per stat
    const usaCityGroups: GroupedSection[] = Array.from(usaCityByState.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'nb'))
      .map(([state, citySet]) => ({
        header: `🇺🇸 ${state}`,
        cities: Array.from(citySet).sort(),
      }))
    const usaTotalCities = usaCityGroups.reduce((s, g) => s + g.cities.length, 0)

    // Alle steder i verden, gruppert per land (deduplisert)
    const cityByCountry = new globalThis.Map<string, globalThis.Map<string, string>>() // country → Map<city_lower, city_original>
    stops.forEach(s => {
      if (!s.city?.trim()) return
      const trip = tripMap.get(s.trip_id)
      let country = trip?.destination_country?.trim() || ''
      if (!country && isUSAStop(s)) country = 'USA'
      if (!country) country = 'Ukjent'

      if (!cityByCountry.has(country)) cityByCountry.set(country, new globalThis.Map())
      const cm = cityByCountry.get(country)!
      const low = s.city.trim().toLowerCase()
      if (!cm.has(low)) cm.set(low, s.city.trim())
    })
    const worldGroups: GroupedSection[] = Array.from(cityByCountry.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'nb'))
      .map(([country, cityMap]) => ({
        header: `${countryFlag(country)} ${country}`,
        cities: Array.from(cityMap.values()).sort(),
      }))
    const totalWorldCities = worldGroups.reduce((s, g) => s + g.cities.length, 0)

    return {
      countryList, roadtrips, storbyturer, resorts,
      usaStateList, usaCityGroups, usaTotalCities,
      worldGroups, totalWorldCities,
    }
  }, [trips, stops])

  // ── Modal-innhold ──────────────────────────────────────────────────────────
  const countriesItems: FlatItem[] = stats.countryList.map(c => ({ label: `${countryFlag(c)} ${c}` }))

  const tripsItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = []
    const push = (list: Trip[], emoji: string, label: string) => {
      if (!list.length) return
      items.push({ label: `${emoji} ${label}`, sub: `${list.length} turer` })
      list.forEach(t => items.push({
        label: `  ${t.name}`,
        sub: t.date_from?.slice(0, 4) ?? String(t.year),
      }))
    }
    push(stats.roadtrips, '🚗', 'Roadtrips')
    push(stats.storbyturer, '🏙️', 'Storbyturer')
    push(stats.resorts, '🌴', 'Resort')
    return items
  }, [stats.roadtrips, stats.storbyturer, stats.resorts])

  const kmItems: FlatItem[] = kmPerTrip.map(({ name, km }) => ({
    label: name,
    sub: `${km.toLocaleString('nb-NO')} km`,
  }))

  const statesItems: FlatItem[] = stats.usaStateList.map(s => ({ label: s }))

  const kmDisplay = kmLoading
    ? <span className="flex items-center gap-1.5"><Loader2 className="w-6 h-6 animate-spin" /></span>
    : drivingKm != null && drivingKm > 0
      ? drivingKm.toLocaleString('nb-NO')
      : '–'

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
            value={kmDisplay}
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
            value={stats.usaTotalCities}
            label="Steder i USA"
            color="text-orange-400" bgColor="bg-orange-400/10"
            onClick={() => setActiveModal('usacities')}
          />

          <StatCard
            icon={<MapIcon className="w-4 h-4" />}
            value={stats.totalWorldCities}
            label="Steder i verden"
            color="text-purple-400" bgColor="bg-purple-400/10"
            onClick={() => setActiveModal('world')}
          />

        </div>
      </div>

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
        <GroupedModal
          title="Steder besøkt i USA"
          icon={<MapPin className="w-4 h-4" />}
          groups={stats.usaCityGroups}
          footer={`${stats.usaTotalCities} steder i ${stats.usaCityGroups.length} stater`}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'world' && (
        <GroupedModal
          title="Alle steder i verden"
          icon={<MapIcon className="w-4 h-4" />}
          groups={stats.worldGroups}
          footer={`${stats.totalWorldCities} steder i ${stats.worldGroups.length} land`}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  )
}
