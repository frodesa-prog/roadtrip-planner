'use client'

import { useEffect, useState } from 'react'
import {
  Trip, Stop, RouteLeg, Activity, Dining, Hotel, Flight, CarRental,
} from '@/types'
import MapReplay from './MapReplay'
import {
  Plane, Train, Car, BedDouble, UtensilsCrossed, Star,
  Moon, MapPin, Calendar, Clock, Route, ChevronRight, Info,
  Ticket, ArrowRight,
} from 'lucide-react'

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
  drivingLegs: (LegInfo | null)[]
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

// ── Wikipedia city facts ─────────────────────────────────────────────────────

interface WikiFact {
  extract: string
  thumbnail?: string
}

async function fetchWikiFact(city: string, state?: string): Promise<WikiFact | null> {
  const queries = [
    state ? `${city}, ${state}` : null,
    city,
  ].filter(Boolean) as string[]

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(4000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      if (data.type === 'disambiguation') continue
      // Return only first 2 sentences
      const sentences = (data.extract ?? '').split('. ').slice(0, 2).join('. ')
      const extract = sentences.endsWith('.') ? sentences : sentences + '.'
      return { extract, thumbnail: data.thumbnail?.source }
    } catch {
      // try next query
    }
  }
  return null
}

// ── Flight card ──────────────────────────────────────────────────────────────

function FlightCard({ flight }: { flight: Flight }) {
  const label = flight.direction === 'outbound' ? 'Utreise' : 'Hjemreise'
  const legColor = flight.direction === 'outbound' ? 'text-sky-300' : 'text-violet-300'
  const borderColor = flight.direction === 'outbound' ? 'border-sky-700/40' : 'border-violet-700/40'
  const bgColor = flight.direction === 'outbound' ? 'from-sky-950/40' : 'from-violet-950/40'

  return (
    <div className={`rounded-xl border ${borderColor} bg-gradient-to-br ${bgColor} to-slate-900/60 p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Plane className={`w-4 h-4 ${legColor}`} />
        <span className={`text-sm font-semibold ${legColor}`}>{label}</span>
        {flight.flight_date && (
          <span className="text-xs text-slate-500 ml-auto">{fmtDate(flight.flight_date)}</span>
        )}
      </div>

      {/* Etappe 1 */}
      {flight.leg1_from && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex-1">
              <p className="font-medium text-slate-200">{flight.leg1_from}</p>
              {flight.leg1_departure && (
                <p className="text-xs text-slate-500">{flight.leg1_departure}</p>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
            <div className="flex-1 text-right">
              <p className="font-medium text-slate-200">
                {flight.leg1_to}
              </p>
              {flight.leg1_arrival && (
                <p className="text-xs text-slate-500">{flight.leg1_arrival}</p>
              )}
            </div>
          </div>

          {/* Flight nr + sete */}
          <div className="flex flex-wrap gap-2 mt-1">
            {flight.leg1_flight_nr && (
              <span className="flex items-center gap-1 text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                <Ticket className="w-3 h-3" />
                {flight.leg1_flight_nr}
              </span>
            )}
            {flight.ticket_class && (
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                {flight.ticket_class}
              </span>
            )}
            {(flight.seat_row || flight.seat_number) && (
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                Sete {[flight.seat_row, flight.seat_number].filter(Boolean).join('')}
              </span>
            )}
          </div>

          {/* Mellomlanding */}
          {flight.has_stopover && (
            <div className="mt-2 pl-2 border-l-2 border-slate-700">
              <p className="text-xs text-slate-500">
                Mellomlanding{flight.stopover_duration ? ` · ${flight.stopover_duration}` : ''}
              </p>

              {/* Etappe 2 */}
              {flight.leg2_flight_nr && (
                <div className="flex items-center gap-2 text-sm mt-2">
                  <div className="flex-1">
                    <p className="font-medium text-slate-200">{flight.leg1_to}</p>
                    {flight.leg2_departure && (
                      <p className="text-xs text-slate-500">{flight.leg2_departure}</p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <div className="flex-1 text-right">
                    <p className="font-medium text-slate-200">{flight.leg2_to}</p>
                    {flight.leg2_arrival && (
                      <p className="text-xs text-slate-500">{flight.leg2_arrival}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-1">
                {flight.leg2_flight_nr && (
                  <span className="flex items-center gap-1 text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    <Ticket className="w-3 h-3" />
                    {flight.leg2_flight_nr}
                  </span>
                )}
                {flight.leg2_ticket_class && (
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    {flight.leg2_ticket_class}
                  </span>
                )}
                {(flight.leg2_seat_row || flight.leg2_seat_number) && (
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                    Sete {[flight.leg2_seat_row, flight.leg2_seat_number].filter(Boolean).join('')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TripSummary({
  trip, stops, routeLegs, activities, dining, hotels, flights, carRentals,
  drivingLegs, computedTotalKm,
}: Props) {
  const [wikiFacts, setWikiFacts] = useState<Map<string, WikiFact>>(new Map())

  const sortedStops = [...stops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Fetch Wikipedia facts for each stop
  useEffect(() => {
    if (sortedStops.length === 0) return

    const controller = new AbortController()
    let cancelled = false

    async function fetchAll() {
      const results = new Map<string, WikiFact>()
      for (const stop of sortedStops) {
        if (cancelled) break
        const fact = await fetchWikiFact(stop.city, stop.state || undefined)
        if (fact) results.set(stop.id, fact)
        if (!cancelled) setWikiFacts(new Map(results))
      }
    }

    fetchAll()
    return () => {
      cancelled = true
      controller.abort()
    }
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
            {/* Fly */}
            {flights.length > 0 && (
              <div className="space-y-3">
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
      {sortedStops.length >= 2 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Route className="w-4 h-4 text-amber-400" />
            Reiserute
          </h2>
          <MapReplay stops={sortedStops} color="#f59e0b" />
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
            const wikiFact       = wikiFacts.get(stop.id)
            const leg            = drivingLegs[i] // leg from this stop to next stop

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
                    {/* Wikipedia fact */}
                    {wikiFact ? (
                      <div className="flex gap-2 text-xs text-slate-400 leading-relaxed">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" />
                        <p>{wikiFact.extract}</p>
                      </div>
                    ) : (
                      <div className="flex gap-2 text-xs text-slate-600 italic">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <p>Laster faktaopplysninger…</p>
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
