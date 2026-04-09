'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, PieChart, Pie,
} from 'recharts'
import {
  BarChart3, TrendingUp, Receipt, BedDouble, UtensilsCrossed,
  Ticket, Plane, Car, Fuel, ShoppingBag, ParkingCircle, Package,
  Train, Filter, Check,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'hotel',       label: 'Hotell',       color: '#10b981', icon: BedDouble },
  { key: 'aktiviteter', label: 'Aktiviteter',  color: '#3b82f6', icon: Ticket },
  { key: 'fly',         label: 'Fly/tog',      color: '#0ea5e9', icon: Plane },
  { key: 'leiebil',     label: 'Leiebil',      color: '#f59e0b', icon: Car },
  { key: 'bensin',      label: 'Bensin',       color: '#f97316', icon: Fuel },
  { key: 'mat',         label: 'Mat',          color: '#a855f7', icon: UtensilsCrossed },
  { key: 'shopping',    label: 'Shopping',     color: '#ec4899', icon: ShoppingBag },
  { key: 'parkering',   label: 'Parkering',    color: '#14b8a6', icon: ParkingCircle },
  { key: 'diverse',     label: 'Diverse',      color: '#64748b', icon: Package },
  { key: 'transport',   label: 'Transport',    color: '#84cc16', icon: Train },
] as const

type CatKey = typeof CATEGORIES[number]['key']

const CAT_MAP: Record<string, CatKey> = {
  hotel: 'hotel', aktiviteter: 'aktiviteter', fly: 'fly',
  leiebil: 'leiebil', bensin: 'bensin', mat: 'mat',
  shopping: 'shopping', parkering: 'parkering', diverse: 'diverse', transport: 'transport',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Costs = Record<CatKey, number>

interface TripAnalysis {
  trip: Trip
  days: number
  hotelNights: number
  costs: Costs
  total: number
  perDay: number
  hotelPerNight: number
  matPerDay: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n).toLocaleString('nb-NO')
}
function fmtK(n: number) {
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`
  return String(Math.round(n))
}

function zeroCosts(): Costs {
  return { hotel: 0, aktiviteter: 0, fly: 0, leiebil: 0, bensin: 0, mat: 0, shopping: 0, parkering: 0, diverse: 0, transport: 0 }
}

function tripDays(trip: Trip, stopNights: number): number {
  if (trip.date_from && trip.date_to) {
    const d = (new Date(trip.date_to).getTime() - new Date(trip.date_from).getTime()) / 86400000
    return Math.max(1, Math.round(d))
  }
  return Math.max(1, stopNights)
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function NbTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0)
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-slate-300 mb-2 truncate max-w-[180px]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-slate-400">{p.name}</span>
          </span>
          <span className="font-semibold text-slate-200 tabular-nums">{fmt(p.value)} kr</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex items-center justify-between text-xs pt-1.5 mt-1 border-t border-slate-700">
          <span className="text-slate-500">Totalt</span>
          <span className="font-bold text-white tabular-nums">{fmt(total)} kr</span>
        </div>
      )}
    </div>
  )
}

function SimpleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3">
      <p className="text-xs font-semibold text-slate-300 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-slate-400">{p.name}</span>
          <span className="font-semibold text-slate-200 tabular-nums">{fmt(p.value)} kr</span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'text-amber-400' }: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
      {children}
    </h2>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KostnadsanalysePage() {
  const supabase = createClient()

  // ── Raw data ──────────────────────────────────────────────────────────────
  const [trips,    setTrips]    = useState<Trip[]>([])
  const [budgets,  setBudgets]  = useState<any[]>([])
  const [entries,  setEntries]  = useState<any[]>([])
  const [hotels,   setHotels]   = useState<any[]>([])
  const [acts,     setActs]     = useState<any[]>([])
  const [stops,    setStops]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)

  // ── Fetch all data ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      const [tripRes, budRes, entRes, hotRes, actRes, stopRes] = await Promise.all([
        supabase.from('trips').select('*').order('date_from', { ascending: false }),
        supabase.from('budget_items').select('trip_id,category,amount,remaining_amount'),
        supabase.from('expense_entries').select('trip_id,category,amount'),
        supabase.from('hotels').select('stop_id,cost,remaining_amount,parking_cost_per_night'),
        supabase.from('activities').select('stop_id,cost,remaining_amount'),
        supabase.from('stops').select('trip_id,nights,id'),
      ])
      const allTrips = tripRes.data ?? []
      // Kun turer med registrerte kostnader
      // Hotels og activities er koblet via stop_id — bygg oppslag for filtrering
      const stopTripMap: Record<string, string> = {}
      ;(stopRes.data ?? []).forEach((s: any) => { stopTripMap[s.id] = s.trip_id })

      const budgetTripIds = new Set((budRes.data ?? []).filter((b: any) => (b.amount ?? 0) > 0).map((b: any) => b.trip_id))
      const entryTripIds  = new Set((entRes.data ?? []).filter((e: any) => (e.amount ?? 0) > 0).map((e: any) => e.trip_id))
      const hotelTripIds  = new Set((hotRes.data ?? []).filter((h: any) => (h.cost ?? 0) > 0).map((h: any) => stopTripMap[h.stop_id]).filter(Boolean))
      const actTripIds    = new Set((actRes.data ?? []).filter((a: any) => (a.cost ?? 0) > 0).map((a: any) => stopTripMap[a.stop_id]).filter(Boolean))
      const tripsWithCosts = allTrips.filter((t: Trip) =>
        budgetTripIds.has(t.id) || entryTripIds.has(t.id) || hotelTripIds.has(t.id) || actTripIds.has(t.id)
      )
      setTrips(tripsWithCosts)
      setSelected(new Set(tripsWithCosts.map((t: Trip) => t.id)))
      setBudgets(budRes.data ?? [])
      setEntries(entRes.data ?? [])
      setHotels(hotRes.data ?? [])
      setActs(actRes.data ?? [])
      setStops(stopRes.data ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Compute per-trip analysis ─────────────────────────────────────────────
  const analyses = useMemo<TripAnalysis[]>(() => {
    // Hotels og activities er koblet til stops (ikke direkte til trips)
    // Bygg et oppslag: stop_id → trip_id
    const stopToTrip: Record<string, string> = {}
    stops.forEach((s: any) => { stopToTrip[s.id] = s.trip_id })

    return trips.map((trip) => {
      const tid = trip.id
      const costs = zeroCosts()

      // Helpers — eksakt samme logikk som kostnader-siden
      const tripStops   = stops.filter((s: any) => s.trip_id === tid)
      const tripHotels  = hotels.filter((h: any) => stopToTrip[h.stop_id] === tid)
      const tripBudgets = budgets.filter((b: any) => b.trip_id === tid)
      const tripEntries = entries.filter((e: any) => e.trip_id === tid)

      const getBudget  = (cat: string) => tripBudgets.find((b: any) => b.category === cat)
      const entriesSum = (cat: string) =>
        tripEntries.filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + (e.amount ?? 0), 0)

      // Flagg: identiske regler som kostnader-siden bruker
      // null/undefined behandles som true for bakoverkompatibilitet med gamle turer
      const hasCarRental = (trip as any).has_car_rental !== false
      const hasFlight    = (trip as any).has_flight    !== false

      // Hotels: betalt + gjenstående
      costs.hotel = tripHotels.reduce((s: number, h: any) =>
        s + (h.cost ?? 0) + (h.remaining_amount ?? 0), 0)

      // Activities: betalt + gjenstående (koblet via stop_id)
      costs.aktiviteter = acts
        .filter((a: any) => stopToTrip[a.stop_id] === tid)
        .reduce((s: number, a: any) => s + (a.cost ?? 0) + (a.remaining_amount ?? 0), 0)

      // Fly — kun hvis hasFlight (identisk med: hasFlight ? getAmount('flight') : 0)
      const bFlight = getBudget('flight')
      costs.fly = hasFlight
        ? (bFlight?.amount ?? 0) + (bFlight?.remaining_amount ?? 0)
        : 0

      // Leiebil — kun hvis hasCarRental
      const bCar = getBudget('car')
      costs.leiebil = hasCarRental
        ? (bCar?.amount ?? 0) + (bCar?.remaining_amount ?? 0)
        : 0

      // Bensin — kun hvis hasCarRental
      // amount = manuelt registrert betalt, remaining_amount = kalkulator-estimat
      const bGas = getBudget('gas')
      costs.bensin = hasCarRental
        ? (bGas?.amount ?? 0) + (bGas?.remaining_amount ?? 0)
        : 0

      // Parkering — kun hvis hasCarRental
      // Betalt = bParking.amount (brukerregistrert), gjenstår = remaining_amount ?? auto fra hotellsatser
      const stopNights: Record<string, number> = {}
      tripStops.forEach((s: any) => { stopNights[s.id] = s.nights ?? 0 })
      const parkingFromHotels = hasCarRental
        ? tripHotels.reduce((s: number, h: any) =>
            s + (h.parking_cost_per_night ?? 0) * (stopNights[h.stop_id] ?? 0), 0)
        : 0
      const bParking = getBudget('parking')
      const parkingBetalt   = hasCarRental ? (bParking?.amount ?? 0) : 0
      const parkingGjenstar = hasCarRental ? (bParking?.remaining_amount ?? parkingFromHotels) : 0
      costs.parkering = parkingBetalt + parkingGjenstar

      // Transport — kun hvis IKKE hasCarRental
      const bTransport = getBudget('transport')
      costs.transport = !hasCarRental
        ? (bTransport?.amount ?? 0) + (bTransport?.remaining_amount ?? 0)
        : 0

      // Mat: expense entries (betalt) + gjenstående fra budsjett
      const foodPaid = entriesSum('food')
      const bFood = getBudget('food')
      const foodRemaining = bFood?.remaining_amount ?? Math.max(0, (bFood?.amount ?? 0) - foodPaid)
      costs.mat = foodPaid + foodRemaining

      // Shopping: expense entries (betalt) + gjenstående fra budsjett
      const shopPaid = entriesSum('shopping')
      const bShop = getBudget('shopping')
      const shopRemaining = bShop?.remaining_amount ?? Math.max(0, (bShop?.amount ?? 0) - shopPaid)
      costs.shopping = shopPaid + shopRemaining

      // Diverse: expense entries (betalt) + gjenstående fra budsjett
      const miscPaid = entriesSum('misc')
      const bMisc = getBudget('misc')
      const miscRemaining = bMisc?.remaining_amount ?? Math.max(0, (bMisc?.amount ?? 0) - miscPaid)
      costs.diverse = miscPaid + miscRemaining

      const totalNights = tripStops.reduce((s: number, st: any) => s + (st.nights ?? 0), 0)
      const days = tripDays(trip, totalNights)
      const total = Object.values(costs).reduce((s, v) => s + v, 0)
      const hotelNights = totalNights || days

      return {
        trip,
        days,
        hotelNights,
        costs,
        total,
        perDay:        days > 0    ? total / days         : 0,
        hotelPerNight: costs.hotel > 0 && hotelNights > 0 ? costs.hotel / hotelNights : 0,
        matPerDay:     days > 0    ? costs.mat / days     : 0,
      }
    })
  }, [trips, budgets, entries, hotels, acts, stops])

  // ── Filter to selected trips ──────────────────────────────────────────────
  const filtered = useMemo(
    () => analyses.filter((a) => selected.has(a.trip.id)),
    [analyses, selected],
  )

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const totalSpent   = filtered.reduce((s, a) => s + a.total, 0)
  const avgPerDay    = filtered.length ? filtered.reduce((s, a) => s + a.perDay, 0) / filtered.length : 0
  const avgHotelNight = filtered.filter((a) => a.hotelPerNight > 0).length
    ? filtered.filter((a) => a.hotelPerNight > 0).reduce((s, a) => s + a.hotelPerNight, 0)
      / filtered.filter((a) => a.hotelPerNight > 0).length
    : 0
  const avgMatDay    = filtered.filter((a) => a.matPerDay > 0).length
    ? filtered.filter((a) => a.matPerDay > 0).reduce((s, a) => s + a.matPerDay, 0)
      / filtered.filter((a) => a.matPerDay > 0).length
    : 0

  // ── Chart data ────────────────────────────────────────────────────────────
  const barData = useMemo(() =>
    filtered.map((a) => ({
      name: `${a.trip.name} (${a.trip.year})`,
      shortName: a.trip.name.length > 14 ? a.trip.name.slice(0, 13) + '…' : a.trip.name,
      ...Object.fromEntries(CATEGORIES.map((c) => [c.label, Math.round(a.costs[c.key])])),
    })),
    [filtered],
  )

  const perDayData = useMemo(() =>
    filtered.map((a) => ({
      name: a.trip.name.length > 14 ? a.trip.name.slice(0, 13) + '…' : a.trip.name,
      'Per dag': Math.round(a.perDay),
      'Hotell/natt': Math.round(a.hotelPerNight),
      'Mat/dag': Math.round(a.matPerDay),
    })),
    [filtered],
  )

  const yearData = useMemo(() => {
    const byYear: Record<number, number> = {}
    filtered.forEach((a) => {
      const yr = a.trip.year
      byYear[yr] = (byYear[yr] ?? 0) + a.total
    })
    return Object.entries(byYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, total]) => ({ year, total: Math.round(total) }))
  }, [filtered])

  const catTotalData = useMemo(() => {
    const totals: Record<CatKey, number> = zeroCosts()
    filtered.forEach((a) => {
      CATEGORIES.forEach((c) => { totals[c.key] += a.costs[c.key] })
    })
    return CATEGORIES
      .map((c) => ({ name: c.label, value: Math.round(totals[c.key]), color: c.color }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // ── Toggle filter ─────────────────────────────────────────────────────────
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  // ── Short trip name for x-axis ────────────────────────────────────────────
  const maxBar = Math.max(1, barData.length)
  const tickAngle = maxBar > 4 ? -35 : 0
  const tickAnchor = maxBar > 4 ? 'end' : 'middle'
  const xHeight = maxBar > 4 ? 60 : 30

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <BarChart3 className="w-8 h-8 text-amber-400 animate-pulse" />
          <p className="text-sm text-slate-400">Laster kostnadsdata…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <h1 className="text-sm font-bold text-white">Kostnadsanalyse</h1>

        {/* Filter trigger */}
        <div className="relative ml-auto">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              filterOpen
                ? 'bg-amber-700 border-amber-600 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {selected.size} av {trips.length} turer
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 min-w-[240px] max-h-[60vh] overflow-y-auto z-30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Velg turer</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(new Set(trips.map((t) => t.id)))}
                    className="text-[10px] text-amber-400 hover:text-amber-300"
                  >
                    Alle
                  </button>
                  <button
                    onClick={() => setSelected(new Set([trips[0]?.id].filter(Boolean)))}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Ingen
                  </button>
                </div>
              </div>
              <div className="space-y-0.5">
                {trips.map((trip) => {
                  const isOn = selected.has(trip.id)
                  return (
                    <button
                      key={trip.id}
                      onClick={() => toggle(trip.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                        isOn ? 'bg-amber-900/30 text-slate-200' : 'text-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                        isOn ? 'bg-amber-500 border-amber-400' : 'border-slate-600'
                      }`}>
                        {isOn && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span className="flex-1 truncate">{trip.name}</span>
                      <span className="text-slate-600 flex-shrink-0">{trip.year}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close filter */}
      {filterOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
      )}

      <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={Receipt}
            label="Totalt brukt"
            value={`${fmt(totalSpent)} kr`}
            sub={`${filtered.length} tur${filtered.length !== 1 ? 'er' : ''} analysert`}
            color="text-green-400"
          />
          <StatCard
            icon={TrendingUp}
            label="Snitt per dag"
            value={`${fmt(avgPerDay)} kr`}
            sub="per reisedag"
            color="text-amber-400"
          />
          <StatCard
            icon={BedDouble}
            label="Snitt hotell/natt"
            value={avgHotelNight > 0 ? `${fmt(avgHotelNight)} kr` : '–'}
            sub="per overnattingsnatt"
            color="text-emerald-400"
          />
          <StatCard
            icon={UtensilsCrossed}
            label="Snitt mat/dag"
            value={avgMatDay > 0 ? `${fmt(avgMatDay)} kr` : '–'}
            sub="per dag på reise"
            color="text-purple-400"
          />
        </div>

        {/* ── Totalt per tur (stacked bar) ────────────────────────────────── */}
        {barData.length > 0 && (
          <section>
            <SectionHead>Totalkostnad per tur</SectionHead>
            <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: xHeight }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    angle={tickAngle}
                    textAnchor={tickAnchor}
                    height={xHeight}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={(v) => fmtK(v)}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    width={48}
                  />
                  <Tooltip content={<NbTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  {CATEGORIES.filter((c) =>
                    filtered.some((a) => a.costs[c.key] > 0)
                  ).map((c) => (
                    <Bar
                      key={c.key}
                      dataKey={c.label}
                      stackId="a"
                      fill={c.color}
                      radius={c.key === 'diverse' || c.key === 'transport' ? [4, 4, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Kostnad per dag + hotell/natt ────────────────────────────────── */}
        {perDayData.length > 0 && (
          <section>
            <SectionHead>Daglige snitt per tur</SectionHead>
            <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={perDayData} margin={{ top: 4, right: 4, left: 0, bottom: xHeight }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    angle={tickAngle}
                    textAnchor={tickAnchor}
                    height={xHeight}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={(v) => fmtK(v)}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    width={48}
                  />
                  <Tooltip content={<SimpleTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="Per dag"     fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Hotell/natt" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Mat/dag"     fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ── Årsforbruk + kategorifordeling ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Årsforbruk */}
          {yearData.length > 0 && (
            <section>
              <SectionHead>Årsforbruk på reiser</SectionHead>
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearData} margin={{ top: 4, right: 4, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => fmtK(v)}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      width={48}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3">
                            <p className="text-xs font-semibold text-slate-300 mb-1">{label}</p>
                            <p className="text-sm font-bold text-white tabular-nums">
                              {fmt(payload[0].value as number)} kr
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="total" name="Total" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                      {yearData.map((_, i) => (
                        <Cell key={i} fill={i === yearData.length - 1 ? '#fbbf24' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Kategorifordeling (pie) */}
          {catTotalData.length > 0 && (
            <section>
              <SectionHead>Kategorifordeling (totalt)</SectionHead>
              <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4 h-[280px] flex items-center gap-4">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={catTotalData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius="45%"
                      outerRadius="80%"
                      paddingAngle={2}
                    >
                      {catTotalData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]
                        const pct = totalSpent > 0
                          ? Math.round(((d.value as number) / totalSpent) * 100)
                          : 0
                        return (
                          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3">
                            <p className="text-xs text-slate-300 mb-1">{d.name}</p>
                            <p className="text-sm font-bold text-white tabular-nums">
                              {fmt(d.value as number)} kr
                            </p>
                            <p className="text-xs text-slate-500">{pct}% av totalt</p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[220px]">
                  {catTotalData.map((d) => {
                    const pct = totalSpent > 0 ? Math.round((d.value / totalSpent) * 100) : 0
                    return (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="flex-1 text-slate-400 truncate">{d.name}</span>
                        <span className="text-slate-500 tabular-nums">{pct}%</span>
                        <span className="text-slate-300 tabular-nums font-medium">{fmtK(d.value)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ── Detaljert sammenligningstabell ──────────────────────────────── */}
        {filtered.length > 0 && (
          <section>
            <SectionHead>Detaljert sammenligning</SectionHead>
            <div className="bg-slate-800/30 border border-slate-700 rounded-2xl overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/60">
                    <th className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Kategori</th>
                    {filtered.map((a) => (
                      <th key={a.trip.id} className="text-right px-3 py-3 text-slate-400 font-semibold whitespace-nowrap text-[10px]">
                        {a.trip.name}
                        <span className="block text-slate-600 font-normal">{a.trip.year}</span>
                      </th>
                    ))}
                    {filtered.length > 1 && (
                      <th className="text-right px-4 py-3 text-amber-500 font-semibold text-[10px]">Snitt</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {CATEGORIES.filter((c) => filtered.some((a) => a.costs[c.key] > 0)).map((c) => {
                    const CatIcon = c.icon
                    const avg = filtered.length
                      ? filtered.reduce((s, a) => s + a.costs[c.key], 0) / filtered.length
                      : 0
                    return (
                      <tr key={c.key} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5 text-slate-300">
                          <div className="flex items-center gap-2">
                            <CatIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: c.color }} />
                            {c.label}
                          </div>
                        </td>
                        {filtered.map((a) => (
                          <td key={a.trip.id} className="text-right px-3 py-2.5 tabular-nums text-slate-300">
                            {a.costs[c.key] > 0 ? `${fmt(a.costs[c.key])} kr` : (
                              <span className="text-slate-700">–</span>
                            )}
                          </td>
                        ))}
                        {filtered.length > 1 && (
                          <td className="text-right px-4 py-2.5 tabular-nums text-amber-400 font-semibold">
                            {avg > 0 ? `${fmt(avg)} kr` : <span className="text-slate-700">–</span>}
                          </td>
                        )}
                      </tr>
                    )
                  })}

                  {/* Separator rows */}
                  <tr className="bg-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-400 font-semibold">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                        Totalt
                      </div>
                    </td>
                    {filtered.map((a) => (
                      <td key={a.trip.id} className="text-right px-3 py-2.5 tabular-nums text-white font-bold">
                        {fmt(a.total)} kr
                      </td>
                    ))}
                    {filtered.length > 1 && (
                      <td className="text-right px-4 py-2.5 tabular-nums text-amber-400 font-bold">
                        {fmt(filtered.reduce((s, a) => s + a.total, 0) / filtered.length)} kr
                      </td>
                    )}
                  </tr>
                  <tr className="bg-slate-800/20">
                    <td className="px-4 py-2 text-slate-500">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5 text-slate-600" />
                        Dager
                      </div>
                    </td>
                    {filtered.map((a) => (
                      <td key={a.trip.id} className="text-right px-3 py-2 tabular-nums text-slate-500">
                        {a.days}
                      </td>
                    ))}
                    {filtered.length > 1 && (
                      <td className="text-right px-4 py-2 tabular-nums text-slate-600">
                        {Math.round(filtered.reduce((s, a) => s + a.days, 0) / filtered.length)}
                      </td>
                    )}
                  </tr>
                  <tr className="bg-slate-800/20">
                    <td className="px-4 py-2 text-slate-500">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
                        Kr per dag
                      </div>
                    </td>
                    {filtered.map((a) => (
                      <td key={a.trip.id} className="text-right px-3 py-2 tabular-nums text-slate-400">
                        {a.perDay > 0 ? `${fmt(a.perDay)} kr` : '–'}
                      </td>
                    ))}
                    {filtered.length > 1 && (
                      <td className="text-right px-4 py-2 tabular-nums text-slate-500">
                        {avgPerDay > 0 ? `${fmt(avgPerDay)} kr` : '–'}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
