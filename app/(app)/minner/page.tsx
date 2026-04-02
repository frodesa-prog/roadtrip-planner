'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import VacationStats from '@/components/minner/VacationStats'
import { Trip, TripMemory, Stop, Dining } from '@/types'
import { BookHeart, Map, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function MinnerPage() {
  const [trips, setTrips]   = useState<Trip[]>([])
  const [stops, setStops]   = useState<Stop[]>([])
  const [dining, setDining] = useState<Dining[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: tripsData }] = await Promise.all([
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
      ])

      const loadedTrips = (tripsData ?? []) as Trip[]
      setTrips(loadedTrips)

      if (loadedTrips.length > 0) {
        const tripIds = loadedTrips.map(t => t.id)
        const { data: stopsData } = await supabase
          .from('stops')
          .select('id, trip_id, city, state, lat, lng, order, arrival_date, nights, notes, created_at')
          .in('trip_id', tripIds)
        const loadedStops = (stopsData ?? []) as Stop[]
        setStops(loadedStops)

        if (loadedStops.length > 0) {
          const stopIds = loadedStops.map(s => s.id)
          const { data: diningData } = await supabase
            .from('dining')
            .select('id, stop_id, name, url, booking_date, booking_time, notes, map_lat, map_lng')
            .in('stop_id', stopIds)
          setDining((diningData ?? []) as Dining[])
        }
      }

      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Laster…
      </div>
    )
  }

  // Tell opp minnebøker (hentes ikke her lenger, men vi bruker trips-count som indikasjon)
  const tripCount = trips.length

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <BookHeart className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-lg font-bold text-slate-100">Ferieminner</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Statistikk og minnebøker fra dine reiser
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-5 space-y-4">

        {/* Snarveier */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Minnebøker */}
          <Link
            href="/minner/minneboker"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-amber-700/40 transition-all group"
          >
            <BookHeart className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-amber-300 transition-colors">Minnebøker</p>
              <p className="text-xs text-slate-500">
                {tripCount > 0 ? `${tripCount} reiser` : 'Generer minnebøker fra turene dine'}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors flex-shrink-0" />
          </Link>

          {/* USA-kart */}
          <Link
            href="/usa-map"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-amber-700/40 transition-all group"
          >
            <span className="text-xl flex-shrink-0">🇺🇸</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 group-hover:text-amber-300 transition-colors">USA-kart</p>
              <p className="text-xs text-slate-500">Se reisene dine på interaktivt kart</p>
            </div>
            <Map className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors flex-shrink-0" />
          </Link>
        </div>

        {/* Feriestatistikk */}
        <VacationStats trips={trips} stops={stops} dining={dining} />

      </div>
    </div>
  )
}
