'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Trip, Stop, RouteLeg, Activity, Dining, Hotel, Flight, CarRental,
} from '@/types'
import {
  APIProvider, Map as GoogleMap, useMapsLibrary, useMap,
} from '@vis.gl/react-google-maps'
import {
  Plane, Train, Car, BedDouble, UtensilsCrossed, Star,
  Moon, MapPin, Calendar, Clock, Route, ChevronRight, Info,
  ArrowRight,
} from 'lucide-react'
import { getOffset, calcFlightMinutes, calcStopoverMinutes, formatDuration } from '@/data/airports'

// ── Types ────────────────────────────────────────────────────────────────────

interface LegInfo {
  distanceKm: number
  durationMinutes: number
  distanceText: string
  durationText: string
}

interface Props {
  trip: Trip
  stops: Stop[]
  routeLegs: RouteLeg[]
  activities: Activity[]
  dining: Dining[]
  hotels: Hotel[]
  flights: Flight[]
  carRentals: CarRental[]
  drivingLegs: (LegInfo | null | undefined)[]
  computedTotalKm: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShortDate(d: string | null): string {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function nightLabel(n: number): string {
  return `${n} ${n === 1 ? 'natt' : 'netter'}`
}


// ── City description (Wikipedia → Claude Haiku fallback) ─────────────────────

interface CityFact {
  extract: string
}

// Klient-side cache per page-load – unngår doble kall for samme by
const clientCache = new Map<string, string>()

async function fetchCityFact(city: string, state?: string | null, country?: string | null): Promise<CityFact | null> {
  const params = new URLSearchParams({ city })
  if (state)   params.set('state',   state)
  if (country) params.set('country', country)
  const cacheKey = params.toString()

  if (clientCache.has(cacheKey)) {
    const cached = clientCache.get(cacheKey)!
    return cached ? { extract: cached } : null
  }

  try {
    const res = await fetch(`/api/city-description?${params}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) { clientCache.set(cacheKey, ''); return null }
    const data = await res.json()
    const extract: string | null = data.extract ?? null
    clientCache.set(cacheKey, extract ?? '')
    return extract ? { extract } : null
  } catch {
    clientCache.set(cacheKey, '')
    return null
  }
}

// ── Compact flight card ───────────────────────────────────────────────────────

function FlightCard({ flight }: { flight: Flight }) {
  const isOut = flight.direction === 'outbound'
  const label = isOut ? 'Utreise' : 'Hjemreise'
  const accentText   = isOut ? 'text-sky-300'      : 'text-violet-300'
  const borderColor  = isOut ? 'border-sky-700/40' : 'border-violet-700/40'
  const bgGradient   = isOut ? 'from-sky-950/40'   : 'from-violet-950/40'

  // Timezone-aware duration using the same logic as FlightPanel
  const fromOffset  = getOffset(flight.leg1_from)
  const viaOffset   = getOffset(flight.leg1_to)
  const finalOffset = getOffset(flight.leg2_to)

  const leg1Min = calcFlightMinutes(
    flight.leg1_departure, fromOffset,
    flight.leg1_arrival,   viaOffset,
  )
  const leg2Min = flight.has_stopover
    ? calcFlightMinutes(
        flight.leg2_departure, viaOffset,
        flight.leg2_arrival,   finalOffset,
      )
    : null
  const stopoverMin = flight.has_stopover
    ? calcStopoverMinutes(flight.leg1_arrival, flight.leg2_departure)
    : null

  const leg1Duration    = leg1Min    != null ? formatDuration(leg1Min)    : null
  const leg2Duration    = leg2Min    != null ? formatDuration(leg2Min)    : null
  const stopoverDuration = stopoverMin != null ? formatDuration(stopoverMin) : null

  return (
    <div className={`rounded-xl border ${borderColor} bg-gradient-to-br ${bgGradient} to-slate-900/60 p-3 flex flex-col gap-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Plane className={`w-3.5 h-3.5 ${accentText}`} />
          <span className={`text-xs font-semibold ${accentText}`}>{label}</span>
        </div>
        {flight.flight_date && (
          <span className="text-xs text-slate-500">{fmtDate(flight.flight_date)}</span>
        )}
      </div>

      {/* Leg 1 */}
      {flight.leg1_from && (
        <div className="space-y-1.5">
          {/* Route row */}
          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-200 truncate">{flight.leg1_from}</p>
              {flight.leg1_departure && (
                <p className="text-slate-500">{flight.leg1_departure}</p>
              )}
            </div>
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0 px-1">
              <ArrowRight className="w-3 h-3 text-slate-600" />
              {leg1Duration && (
                <span className="text-slate-600 text-[10px] whitespace-nowrap">{leg1Duration}</span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="font-semibold text-slate-200 truncate">{flight.leg1_to}</p>
              {flight.leg1_arrival && (
                <p className="text-slate-500">{flight.leg1_arrival}</p>
              )}
            </div>
          </div>

          {/* Badges: class + seat */}
          {(flight.ticket_class || flight.seat_row || flight.seat_number) && (
            <div className="flex flex-wrap gap-1.5">
              {flight.ticket_class && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                  {flight.ticket_class}
                </span>
              )}
              {(flight.seat_row || flight.seat_number) && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                  Sete {[flight.seat_row, flight.seat_number].filter(Boolean).join('')}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stopover + Leg 2 */}
      {flight.has_stopover && (
        <div className="pl-2 border-l-2 border-slate-700 space-y-1.5">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
            Mellomlanding på {flight.leg1_to}
            {stopoverDuration ? ` · ${stopoverDuration} ventetid` : flight.stopover_duration ? ` · ${flight.stopover_duration} ventetid` : ''}
          </p>

          {(flight.leg2_departure || flight.leg2_to) && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-200 truncate">{flight.leg1_to}</p>
                {flight.leg2_departure && (
                  <p className="text-slate-500">{flight.leg2_departure}</p>
                )}
              </div>
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0 px-1">
                <ArrowRight className="w-3 h-3 text-slate-600" />
                {leg2Duration && (
                  <span className="text-slate-600 text-[10px] whitespace-nowrap">{leg2Duration}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="font-semibold text-slate-200 truncate">{flight.leg2_to}</p>
                {flight.leg2_arrival && (
                  <p className="text-slate-500">{flight.leg2_arrival}</p>
                )}
              </div>
            </div>
          )}

          {/* Leg 2 badges */}
          {(flight.leg2_ticket_class || flight.leg2_seat_row || flight.leg2_seat_number) && (
            <div className="flex flex-wrap gap-1.5">
              {flight.leg2_ticket_class && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                  {flight.leg2_ticket_class}
                </span>
              )}
              {(flight.leg2_seat_row || flight.leg2_seat_number) && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                  Sete {[flight.leg2_seat_row, flight.leg2_seat_number].filter(Boolean).join('')}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Map zoom controls ─────────────────────────────────────────────────────────

function ZoomControls() {
  const map = useMap()

  function zoomIn()  { if (map) map.setZoom((map.getZoom() ?? 5) + 1) }
  function zoomOut() { if (map) map.setZoom((map.getZoom() ?? 5) - 1) }

  return (
    <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
      <button
        onClick={zoomIn}
        aria-label="Zoom inn"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/90 border border-slate-600 text-slate-200 text-base font-bold hover:bg-slate-700 active:scale-95 transition shadow-md select-none"
      >
        +
      </button>
      <button
        onClick={zoomOut}
        aria-label="Zoom ut"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/90 border border-slate-600 text-slate-200 text-base font-bold hover:bg-slate-700 active:scale-95 transition shadow-md select-none"
      >
        −
      </button>
    </div>
  )
}

// ── Static route map ──────────────────────────────────────────────────────────

function RouteMapInner({ stops }: { stops: Stop[] }) {
  const map        = useMap()
  const mapsLib    = useMapsLibrary('maps')
  const markerLib  = useMapsLibrary('marker')
  const drawDoneRef = useRef(false)

  useEffect(() => {
    if (!map || !mapsLib || !markerLib || stops.length < 1 || drawDoneRef.current) return
    drawDoneRef.current = true

    // Fit bounds to all stops
    const bounds = new google.maps.LatLngBounds()
    stops.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }))
    map.fitBounds(bounds, { top: 48, bottom: 32, left: 32, right: 32 })

    // Draw polyline
    if (stops.length >= 2) {
      new mapsLib.Polyline({
        path: stops.map(s => ({ lat: s.lat, lng: s.lng })),
        map,
        strokeColor: '#f59e0b',
        strokeWeight: 3,
        strokeOpacity: 0.85,
        geodesic: true,
      })
    }

    // Draw numbered pins using AdvancedMarkerElement
    stops.forEach((stop, i) => {
      const pinEl = document.createElement('div')
      pinEl.style.cssText = `
        width: 26px; height: 26px;
        border-radius: 50%;
        background: #92400e;
        border: 2px solid #f59e0b;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; color: #fcd34d;
        font-family: sans-serif;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        cursor: default;
      `
      pinEl.textContent = String(i + 1)

      new markerLib.AdvancedMarkerElement({
        map,
        position: { lat: stop.lat, lng: stop.lng },
        content: pinEl,
        title: stop.city,
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapsLib, markerLib])

  return null
}

function RouteStaticMap({ stops }: { stops: Stop[] }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey || stops.length < 1) return null

  // Approximate center for initial render (overridden by fitBounds)
  const center = {
    lat: stops.reduce((s, st) => s + st.lat, 0) / stops.length,
    lng: stops.reduce((s, st) => s + st.lng, 0) / stops.length,
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="relative w-full rounded-xl overflow-hidden border border-slate-700" style={{ height: 320 }}>
        <GoogleMap
          defaultCenter={center}
          defaultZoom={5}
          mapId="route_summary_map"
          disableDefaultUI
          gestureHandling="cooperative"
          mapTypeId="roadmap"
          styles={[
            { elementType: 'geometry',       stylers: [{ color: '#1e293b' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
            { elementType: 'labels.text.fill',   stylers: [{ color: '#94a3b8' }] },
            { featureType: 'road',           elementType: 'geometry', stylers: [{ color: '#334155' }] },
            { featureType: 'water',          elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
            { featureType: 'landscape',      elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
            { featureType: 'poi',            elementType: 'labels',   stylers: [{ visibility: 'off' }] },
            { featureType: 'transit',        elementType: 'labels',   stylers: [{ visibility: 'off' }] },
            { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#475569' }] },
          ]}
        >
          <RouteMapInner stops={stops} />
          <ZoomControls />
        </GoogleMap>
      </div>
    </APIProvider>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TripSummary({
  trip, stops, activities, dining, hotels, flights, carRentals,
  drivingLegs, computedTotalKm,
}: Props) {
  const [cityFacts, setCityFacts] = useState<Map<string, CityFact>>(new Map())

  const sortedStops = [...stops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Hent bybeskrivelse for hvert stoppested (Wikipedia → Claude Haiku fallback)
  useEffect(() => {
    if (sortedStops.length === 0) return

    let cancelled = false

    async function fetchAll() {
      const results = new Map<string, CityFact>()
      for (const stop of sortedStops) {
        if (cancelled) break
        // For USA-turer bruker vi staten; for internasjonale turer bruker vi landet
        const country = trip.road_trip_region === 'international'
          ? (stop.state || null)   // state-feltet inneholder landet for internasjonale stopp
          : null
        const state = trip.road_trip_region !== 'international'
          ? (stop.state || null)
          : null
        const fact = await fetchCityFact(stop.city, state, country)
        if (fact) results.set(stop.id, fact)
        if (!cancelled) setCityFacts(new Map(results))
      }
    }

    fetchAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.map(s => s.id).join(',')])

  // Totals
  const totalNights = sortedStops.reduce((s, st) => s + (st.nights ?? 0), 0)

  const outboundFlight = flights.find(f => f.direction === 'outbound')
  const returnFlight   = flights.find(f => f.direction === 'return')

  const hasTransport = trip.transport_type !== 'ingen' || trip.has_flight || flights.length > 0
  const hasCar       = trip.has_car_rental || carRentals.length > 0

  return (
    <div className="space-y-8">

      {/* ── Header stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(trip.date_from || trip.date_to) && (
          <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3 flex flex-col gap-1">
            <Calendar className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-slate-500">Datoer</p>
            <p className="text-sm font-semibold text-slate-200">
              {fmtShortDate(trip.date_from)} – {fmtShortDate(trip.date_to)}
            </p>
          </div>
        )}
        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3 flex flex-col gap-1">
          <Moon className="w-4 h-4 text-amber-400" />
          <p className="text-xs text-slate-500">Netter</p>
          <p className="text-sm font-semibold text-slate-200">{totalNights}</p>
        </div>
        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3 flex flex-col gap-1">
          <MapPin className="w-4 h-4 text-amber-400" />
          <p className="text-xs text-slate-500">Stopp</p>
          <p className="text-sm font-semibold text-slate-200">{sortedStops.length}</p>
        </div>
        {computedTotalKm != null && (
          <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3 flex flex-col gap-1">
            <Route className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-slate-500">Kjørelengde</p>
            <p className="text-sm font-semibold text-slate-200">{computedTotalKm.toLocaleString('nb-NO')} km</p>
          </div>
        )}
      </div>

      {/* ── Transport ─────────────────────────────────────────────────────── */}
      {(hasTransport || hasCar) && (
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            {trip.transport_type === 'tog' ? (
              <Train className="w-4 h-4 text-amber-400" />
            ) : (
              <Plane className="w-4 h-4 text-amber-400" />
            )}
            Transport
          </h2>

          <div className="space-y-3">
            {/* Fly – side by side */}
            {flights.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {outboundFlight && <FlightCard flight={outboundFlight} />}
                {returnFlight   && <FlightCard flight={returnFlight} />}
              </div>
            )}

            {/* Tog (ingen flyinfo) */}
            {trip.transport_type === 'tog' && flights.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
                <Train className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-slate-300">Togreise</p>
              </div>
            )}

            {/* Leiebil */}
            {hasCar && carRentals.map((cr) => (
              <div key={cr.id} className="rounded-xl border border-amber-700/30 bg-gradient-to-br from-amber-950/30 to-slate-900/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-300">Leiebil</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {cr.company && (
                    <><span className="text-slate-500">Firma</span><span className="text-slate-200">{cr.company}</span></>
                  )}
                  {cr.car_type && (
                    <><span className="text-slate-500">Biltype</span><span className="text-slate-200">{cr.car_type}</span></>
                  )}
                  {cr.confirmation_nr && (
                    <><span className="text-slate-500">Bekreftelse</span><span className="text-slate-200">{cr.confirmation_nr}</span></>
                  )}
                  {cr.reference_nr && (
                    <><span className="text-slate-500">Referanse</span><span className="text-slate-200">{cr.reference_nr}</span></>
                  )}
                </div>
                {cr.notes && (
                  <p className="mt-2 text-xs text-slate-500">{cr.notes}</p>
                )}
              </div>
            ))}

            {/* Leiebil uten detaljer */}
            {hasCar && carRentals.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
                <Car className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-sm text-slate-300">Leiebil</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Kart ──────────────────────────────────────────────────────────── */}
      {sortedStops.length >= 1 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Route className="w-4 h-4 text-amber-400" />
            Reiserute
          </h2>
          <RouteStaticMap stops={sortedStops} />
        </section>
      )}

      {/* ── Stopp ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-400" />
          Stoppesteder
        </h2>

        <div className="space-y-3">
          {sortedStops.map((stop, i) => {
            const stopActivities = activities.filter(a => a.stop_id === stop.id)
            const stopDining     = dining.filter(d => d.stop_id === stop.id)
            const stopHotels     = hotels.filter(h => h.stop_id === stop.id)
            const wikiFact       = cityFacts.get(stop.id)
            const leg            = drivingLegs[i]

            return (
              <div key={stop.id}>
                {/* Stop card */}
                <div className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
                  {/* City header */}
                  <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-900/60 border border-amber-600/60 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-300 text-xs font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-100 truncate">
                        {stop.city}{stop.state ? `, ${stop.state}` : ''}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                        {stop.arrival_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmtShortDate(stop.arrival_date)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Moon className="w-3 h-3" />
                          {nightLabel(stop.nights)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Wikipedia fact – vises kun når norsk artikkel finnes */}
                    {wikiFact && (
                      <div className="flex gap-2 text-xs text-slate-400 leading-relaxed">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" />
                        <p>{wikiFact.extract}</p>
                      </div>
                    )}

                    {/* Hotels */}
                    {stopHotels.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5 text-emerald-400" />
                          Overnatting
                        </p>
                        <ul className="space-y-1">
                          {stopHotels.map((h) => (
                            <li key={h.id} className="text-xs text-slate-300 pl-4 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0" />
                              {h.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Activities */}
                    {stopActivities.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-blue-400" />
                          Aktiviteter
                        </p>
                        <ul className="space-y-1">
                          {stopActivities.map((a) => (
                            <li key={a.id} className="text-xs text-slate-300 pl-4 flex items-start gap-1">
                              <span className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                              <span>
                                {a.name}
                                {a.activity_date && (
                                  <span className="text-slate-500 ml-1">· {fmtShortDate(a.activity_date)}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Dining */}
                    {stopDining.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-purple-400" />
                          Spisesteder
                        </p>
                        <ul className="space-y-1">
                          {stopDining.map((d) => (
                            <li key={d.id} className="text-xs text-slate-300 pl-4 flex items-start gap-1">
                              <span className="w-1 h-1 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" />
                              <span>
                                {d.name}
                                {d.booking_date && (
                                  <span className="text-slate-500 ml-1">· {fmtShortDate(d.booking_date)}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Driving connector to next stop */}
                {i < sortedStops.length - 1 && (
                  <div className="flex items-center gap-2 my-2 px-4">
                    <div className="w-px h-6 bg-slate-700 ml-3.5" />
                    {leg ? (
                      <div className="flex items-center gap-1.5 ml-2 text-xs text-slate-500">
                        <ChevronRight className="w-3 h-3" />
                        <span>{leg.distanceText}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>{leg.durationText}</span>
                        <span className="text-slate-600">til {sortedStops[i + 1].city}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 ml-2 text-xs text-slate-600">
                        <ChevronRight className="w-3 h-3" />
                        <span>til {sortedStops[i + 1].city}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
