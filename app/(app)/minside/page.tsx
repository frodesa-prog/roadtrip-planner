'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTrips } from '@/hooks/useTrips'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { useDefaultPackingList } from '@/hooks/useDefaultPackingList'
import { useUserDocuments } from '@/hooks/useUserDocuments'
import { useTripShares } from '@/hooks/useTripShares'
import { useActivityLog } from '@/hooks/useActivityLog'
import { logActivity } from '@/hooks/useActivityLog'
import { PackingCategory, DocumentType, ActivityLogEntry } from '@/types'
import { toast } from 'sonner'
import {
  User,
  Share2,
  ClipboardList,
  BarChart2,
  FolderOpen,
  Luggage,
  Settings2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Upload,
  FileText,
  ImageIcon,
  X,
  ChevronDown,
  Loader2,
  Check,
  MapPin,
  Calendar,
  Globe,
  TrendingUp,
  Clock,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Tab definitions ────────────────────────────────────────────────────────────

const tabs = [
  { id: 'profil',       label: 'Profil',            icon: User },
  { id: 'del',          label: 'Del ferie',          icon: Share2 },
  { id: 'logg',         label: 'Endringslogg',       icon: ClipboardList },
  { id: 'statistikk',   label: 'Statistikk',         icon: BarChart2 },
  { id: 'dokumenter',   label: 'Dokumentarkiv',      icon: FolderOpen },
  { id: 'pakkeliste',   label: 'Standard pakkeliste', icon: Luggage },
  { id: 'preferanser',  label: 'Preferanser',        icon: Settings2 },
] as const

type TabId = typeof tabs[number]['id']

// ── Profil-tab ─────────────────────────────────────────────────────────────────

function ProfilTab({ user }: { user: SupabaseUser | null }) {
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  async function handleChangePw() {
    if (newPw.length < 6) { toast.error('Passordet må være minst 6 tegn'); return }
    if (newPw !== confirmPw) { toast.error('Passordene stemmer ikke overens'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)
    if (error) { toast.error('Kunne ikke endre passord: ' + error.message); return }
    toast.success('Passord endret!')
    setNewPw(''); setConfirmPw('')
    logActivity({ log_type: 'functional', action: 'passord endret', entity_type: 'profil', entity_name: 'Passord' })
  }

  return (
    <div className="max-w-md space-y-8">
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Kontoinformasjon</h2>
        <div className="space-y-3">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-0.5">E-postadresse</p>
            <p className="text-sm text-slate-200">{user?.email ?? '—'}</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-0.5">Konto opprettet</p>
            <p className="text-sm text-slate-200">
              {user?.created_at ? fmtDateShort(user.created_at) : '—'}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-0.5">Bruker-ID</p>
            <p className="text-xs text-slate-500 font-mono break-all">{user?.id ?? '—'}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-white mb-4">Endre passord</h2>
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Nytt passord (minst 6 tegn)"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500 pr-10"
            />
            <button onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Bekreft nytt passord"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500"
          />
          <button
            onClick={handleChangePw}
            disabled={saving || !newPw || !confirmPw}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Lagre nytt passord
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Del ferie-tab ──────────────────────────────────────────────────────────────

function DelFerieTab() {
  const { trips } = useTrips()
  const [selectedTripId, setSelectedTripId] = useState<string>('')
  const [email, setEmail] = useState('')
  const [accessLevel, setAccessLevel] = useState<'read' | 'write'>('read')
  const [sending, setSending] = useState(false)
  const { shares, loading, shareTrip, removeShare } = useTripShares(selectedTripId || null)

  useEffect(() => {
    if (trips.length > 0 && !selectedTripId) setSelectedTripId(trips[0].id)
  }, [trips, selectedTripId])

  async function handleShare() {
    if (!email.trim() || !selectedTripId) return
    setSending(true)
    const ok = await shareTrip(email.trim(), accessLevel)
    if (ok) {
      setEmail('')
      logActivity({ log_type: 'functional', action: 'delt', entity_type: 'tur', entity_name: trips.find((t) => t.id === selectedTripId)?.name, trip_id: selectedTripId })
    }
    setSending(false)
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Del en ferie</h2>
        <div className="space-y-3">
          {/* Trip selector */}
          <div className="relative">
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500 appearance-none pr-10"
            >
              {trips.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.year})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          {/* Email */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-postadresse til mottaker"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500"
          />

          {/* Access level */}
          <div className="flex gap-3">
            {(['read', 'write'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setAccessLevel(level)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  accessLevel === level
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {level === 'read' ? '👁️ Kun lesetilgang' : '✏️ Full tilgang'}
              </button>
            ))}
          </div>

          <button
            onClick={handleShare}
            disabled={sending || !email.trim() || !selectedTripId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            Send invitasjon
          </button>
        </div>
      </div>

      {/* Existing shares */}
      {selectedTripId && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">Aktive delinger for valgt tur</h3>
          {loading ? (
            <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
          ) : shares.length === 0 ? (
            <p className="text-xs text-slate-600">Ingen delinger ennå</p>
          ) : (
            <div className="space-y-2">
              {shares.map((s) => (
                <div key={s.id} className="flex items-center gap-3 bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{s.shared_with_email}</p>
                    <p className="text-xs text-slate-500">
                      {s.access_level === 'read' ? 'Lesetilgang' : 'Full tilgang'} ·{' '}
                      <span className={s.status === 'accepted' ? 'text-emerald-400' : s.status === 'declined' ? 'text-red-400' : 'text-amber-400'}>
                        {s.status === 'accepted' ? 'Akseptert' : s.status === 'declined' ? 'Avslått' : 'Venter'}
                      </span>
                    </p>
                  </div>
                  <button onClick={() => removeShare(s.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Endringslogg-tab ───────────────────────────────────────────────────────────

function LogEntry({ entry }: { entry: ActivityLogEntry }) {
  const actionColors: Record<string, string> = {
    INSERT: 'text-emerald-400',
    DELETE: 'text-red-400',
    UPDATE: 'text-amber-400',
  }
  const color = actionColors[entry.action.toUpperCase()] ?? 'text-blue-400'

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        <span className={`text-xs font-mono font-semibold uppercase ${color}`}>{entry.action}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300 leading-snug">
          {entry.entity_type && <span className="text-slate-500">{entry.entity_type}: </span>}
          {entry.entity_name ?? '—'}
        </p>
        {entry.details && (
          <p className="text-xs text-slate-600 mt-0.5 truncate">{JSON.stringify(entry.details)}</p>
        )}
      </div>
      <p className="flex-shrink-0 text-xs text-slate-600">{fmtDate(entry.created_at)}</p>
    </div>
  )
}

function EndringsloggTab() {
  const [subTab, setSubTab] = useState<'functional' | 'database'>('database')
  const { entries, loading, hasMore, loadMore } = useActivityLog(subTab)

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-base font-semibold text-white">Endringslogg</h2>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-800/40 rounded-lg p-1 w-fit">
        {([['database', 'Databaselogg'], ['functional', 'Funksjonell logg']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              subTab === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        {subTab === 'database'
          ? 'Viser hva som er lagt til og fjernet fra databasen (stopp, aktiviteter, turer osv.)'
          : 'Viser funksjonelle endringer i appen (passord, preferanser, delinger osv.)'}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-600 py-8 text-center">Ingen loggoppføringer ennå</p>
      ) : (
        <>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-1">
            {entries.map((e) => <LogEntry key={e.id} entry={e} />)}
          </div>
          {hasMore && (
            <button onClick={loadMore} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Last inn flere…
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Statistikk-tab ─────────────────────────────────────────────────────────────

function StatistikkTab() {
  const supabase = useMemo(() => createClient(), [])
  const [allTrips, setAllTrips] = useState<Array<{ id: string; name: string; year: number }>>([])
  const [allStops, setAllStops] = useState<Array<{ trip_id: string; city: string; state: string; lat: number; lng: number; nights: number; arrival_date: string | null }>>([])
  const [allActivities, setAllActivities] = useState<Array<{ stop_id: string; activity_type: string | null }>>([])
  const [allBudget, setAllBudget] = useState<Array<{ trip_id: string; category: string; amount: number }>>([])
  const [loadingStat, setLoadingStat] = useState(true)
  const [filterTripId, setFilterTripId] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const [tripsRes, stopsRes, activitiesRes, budgetRes] = await Promise.all([
        supabase.from('trips').select('id, name, year').order('year'),
        supabase.from('stops').select('trip_id, city, state, lat, lng, nights, arrival_date'),
        supabase.from('activities').select('stop_id, activity_type'),
        supabase.from('budget_items').select('trip_id, category, amount'),
      ])
      if (tripsRes.data) setAllTrips(tripsRes.data as typeof allTrips)
      if (stopsRes.data) setAllStops(stopsRes.data as typeof allStops)
      if (activitiesRes.data) setAllActivities(activitiesRes.data as typeof allActivities)
      if (budgetRes.data) setAllBudget(budgetRes.data as typeof allBudget)
      setLoadingStat(false)
    }
    load()
  }, [supabase])

  // Build stop→trip mapping
  const stopToTrip = useMemo(() => {
    const map: Record<string, string> = {}
    allStops.forEach((s) => { map[s.city + s.trip_id] = s.trip_id })
    return map
  }, [allStops])

  const years = useMemo(() => [...new Set(allTrips.map((t) => String(t.year)))].sort(), [allTrips])

  // Filter
  const filteredTrips = useMemo(() => {
    let t = allTrips
    if (filterTripId !== 'all') t = t.filter((x) => x.id === filterTripId)
    if (filterYear !== 'all') t = t.filter((x) => String(x.year) === filterYear)
    return t
  }, [allTrips, filterTripId, filterYear])

  const filteredTripIds = useMemo(() => new Set(filteredTrips.map((t) => t.id)), [filteredTrips])

  const filteredStops = useMemo(
    () => allStops.filter((s) => filteredTripIds.has(s.trip_id)),
    [allStops, filteredTripIds],
  )

  const filteredActivities = useMemo(() => {
    const stopIds = new Set(filteredStops.map((s) => s.city + (filteredTrips.find((t) => filteredTripIds.has(t.id))?.id ?? '')))
    // Use trip_id matching via stops
    const validStopIds = new Set<string>()
    allStops.forEach((s) => { if (filteredTripIds.has(s.trip_id)) validStopIds.add(s.city + s.trip_id) })
    void stopIds
    // Map activities by stop_id - we need to join with stops
    const stopTripMap: Record<string, string> = {}
    allStops.forEach((s) => { stopTripMap[s.city + s.trip_id] = s.trip_id })
    void stopTripMap
    // Simply use all activities and filter by stops that belong to filtered trips
    const filteredStopCities = new Set(filteredStops.map((s) => s.city + s.trip_id))
    void filteredStopCities
    return allActivities
  }, [allActivities, filteredStops, allStops, filteredTripIds, filteredTrips])

  void filteredActivities

  // Stats calculations
  const stats = useMemo(() => {
    const totalNights = filteredStops.reduce((sum, s) => sum + (s.nights ?? 0), 0)
    const uniqueCities = new Set(filteredStops.map((s) => s.city)).size
    const uniqueStates = new Set(filteredStops.map((s) => s.state).filter(Boolean)).size

    // Estimate km: sum Haversine between consecutive stops per trip
    let totalKm = 0
    filteredTrips.forEach((trip) => {
      const tripStops = allStops
        .filter((s) => s.trip_id === trip.id)
        .sort((a, b) => (a.arrival_date ?? '').localeCompare(b.arrival_date ?? ''))
      for (let i = 1; i < tripStops.length; i++) {
        const prev = tripStops[i - 1]
        const curr = tripStops[i]
        if (prev.lat && prev.lng && curr.lat && curr.lng) {
          totalKm += haversine(prev.lat, prev.lng, curr.lat, curr.lng)
        }
      }
    })

    const totalCost = allBudget
      .filter((b) => filteredTripIds.has(b.trip_id))
      .reduce((sum, b) => sum + b.amount, 0)

    // Count activities per trip-stop
    const activityStopIds = new Set<string>()
    allStops.filter((s) => filteredTripIds.has(s.trip_id)).forEach((s) => activityStopIds.add(s.city + s.trip_id))
    void activityStopIds

    return { totalNights, uniqueCities, uniqueStates, totalKm: Math.round(totalKm), totalCost }
  }, [filteredStops, filteredTrips, filteredTripIds, allStops, allBudget])

  if (loadingStat) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 text-slate-600 animate-spin" /></div>

  const StatCard = ({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) => (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString('nb-NO') : value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-white">Reisestatistikk</h2>
        {/* Filters */}
        <div className="flex gap-2 ml-auto">
          <div className="relative">
            <select
              value={filterTripId}
              onChange={(e) => { setFilterTripId(e.target.value); setFilterYear('all') }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none appearance-none pr-7"
            >
              <option value="all">Alle turer</option>
              {allTrips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterYear}
              onChange={(e) => { setFilterYear(e.target.value); setFilterTripId('all') }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none appearance-none pr-7"
            >
              <option value="all">Alle år</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {filterTripId !== 'all' || filterYear !== 'all' ? (
        <p className="text-xs text-slate-500">
          Viser statistikk for {filterTripId !== 'all' ? `«${allTrips.find((t) => t.id === filterTripId)?.name}»` : `år ${filterYear}`}
        </p>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={TrendingUp} label="Turer" value={filteredTrips.length} />
        <StatCard icon={Calendar} label="Netter totalt" value={stats.totalNights} />
        <StatCard icon={MapPin} label="Byer besøkt" value={stats.uniqueCities} />
        <StatCard icon={Globe} label="Stater / land" value={stats.uniqueStates} />
        <StatCard icon={Clock} label="Estimert km" value={stats.totalKm} sub="luftlinje mellom stopp" />
        <StatCard icon={BarChart2} label="Totalbudsjett" value={`${stats.totalCost.toLocaleString('nb-NO')} kr`} />
      </div>

      {/* Per-trip breakdown */}
      {filterTripId === 'all' && filteredTrips.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">Per tur</h3>
          <div className="space-y-2">
            {filteredTrips.map((trip) => {
              const tripStops = allStops.filter((s) => s.trip_id === trip.id)
              const nights = tripStops.reduce((s, x) => s + (x.nights ?? 0), 0)
              const cities = new Set(tripStops.map((s) => s.city)).size
              return (
                <div key={trip.id} className="bg-slate-800/40 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{trip.name}</p>
                    <p className="text-xs text-slate-500">{trip.year}</p>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div><p className="text-xs text-slate-500">Netter</p><p className="text-sm font-semibold text-white">{nights}</p></div>
                    <div><p className="text-xs text-slate-500">Byer</p><p className="text-sm font-semibold text-white">{cities}</p></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dokumentarkiv-tab ──────────────────────────────────────────────────────────

const DOC_TYPES: { value: DocumentType; label: string; emoji: string }[] = [
  { value: 'passport',        label: 'Pass',            emoji: '🛂' },
  { value: 'drivers_license', label: 'Førerkort',       emoji: '🪪' },
  { value: 'insurance',       label: 'Forsikringsbevis', emoji: '🛡️' },
  { value: 'esta',            label: 'ESTA / Visum',    emoji: '🗂️' },
  { value: 'other',           label: 'Annet',           emoji: '📄' },
]

function DokumentTab() {
  const { documents, loading, isUploading, uploadDocument, deleteDocument } = useUserDocuments()
  const [name, setName] = useState('')
  const [docType, setDocType] = useState<DocumentType>('passport')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!name.trim()) { toast.error('Gi dokumentet et navn'); return }
    await uploadDocument(file, name.trim(), docType)
    setName('')
    logActivity({ log_type: 'database', action: 'INSERT', entity_type: 'document', entity_name: name.trim() })
  }

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-base font-semibold text-white">Dokumentarkiv</h2>
      <p className="text-xs text-slate-500">Last opp pass, førerkort, forsikringsbevis, ESTA og andre viktige reisedokumenter. Dokumentene er kun synlige for deg.</p>

      {/* Upload form */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn på dokument (f.eks. «Mitt pass»)"
            className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500"
          />
          <div className="relative">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none appearance-none pr-8"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.emoji} {d.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700 hover:border-slate-500'
          }`}
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin mx-auto" />
          ) : (
            <>
              <Upload className="w-5 h-5 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Dra og slipp fil her, eller klikk for å velge</p>
              <p className="text-xs text-slate-600 mt-1">PDF, JPG, PNG støttes</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      {/* Document list */}
      {loading ? (
        <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
      ) : documents.length === 0 ? (
        <p className="text-xs text-slate-600">Ingen dokumenter lastet opp ennå</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const typeInfo = DOC_TYPES.find((d) => d.value === doc.document_type) ?? DOC_TYPES[4]
            const isImage = doc.file_type?.startsWith('image/') ?? false
            return (
              <div key={doc.id} className="group flex items-center gap-3 bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3">
                <span className="text-xl flex-shrink-0">{typeInfo.emoji}</span>
                {isImage ? <ImageIcon className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{doc.name}</p>
                  <p className="text-xs text-slate-500">{typeInfo.label} · {fmtDateShort(doc.created_at)}</p>
                </div>
                {doc.publicUrl && (
                  <a href={doc.publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0">
                    Åpne
                  </a>
                )}
                <button
                  onClick={() => { deleteDocument(doc.id, doc.storage_path); logActivity({ log_type: 'database', action: 'DELETE', entity_type: 'document', entity_name: doc.name }) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Standard pakkeliste-tab ────────────────────────────────────────────────────

const PACKING_CATEGORIES: { value: PackingCategory; label: string; emoji: string }[] = [
  { value: 'documents',   label: 'Dokumenter',  emoji: '🛂' },
  { value: 'electronics', label: 'Elektronikk', emoji: '🔌' },
  { value: 'clothes',     label: 'Klær',        emoji: '👕' },
  { value: 'hygiene',     label: 'Hygiene',     emoji: '🪥' },
  { value: 'other',       label: 'Annet',       emoji: '📦' },
]

function PakkelisteTab() {
  const { items, loading, addItem, deleteItem } = useDefaultPackingList()
  const [newItem, setNewItem] = useState('')
  const [newCat, setNewCat] = useState<PackingCategory>('documents')

  async function handleAdd() {
    if (!newItem.trim()) return
    await addItem(newItem.trim(), newCat)
    setNewItem('')
    logActivity({ log_type: 'database', action: 'INSERT', entity_type: 'packing_item', entity_name: newItem.trim() })
  }

  // Group by category
  const grouped = useMemo(() => {
    const map: Partial<Record<PackingCategory, typeof items>> = {}
    items.forEach((item) => {
      if (!map[item.category]) map[item.category] = []
      map[item.category]!.push(item)
    })
    return map
  }, [items])

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Standard pakkeliste</h2>
        <p className="text-xs text-slate-500">Mal som gjelder for alle turer. Legg inn faste ting du alltid trenger å pakke.</p>
      </div>

      {/* Add item */}
      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Nytt element (f.eks. Pass, Lader, Solkrem)"
          className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500"
        />
        <div className="relative">
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value as PackingCategory)}
            className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none appearance-none pr-7"
          >
            {PACKING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Items grouped by category */}
      {loading ? (
        <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-600">Pakkelisten er tom. Legg til det første elementet!</p>
      ) : (
        <div className="space-y-4">
          {PACKING_CATEGORIES.filter((c) => grouped[c.value]?.length).map((cat) => (
            <div key={cat.value}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {cat.emoji} {cat.label}
              </h3>
              <div className="space-y-1">
                {grouped[cat.value]!.map((item) => (
                  <div key={item.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/40 transition-colors">
                    <div className="w-3.5 h-3.5 border border-slate-600 rounded flex-shrink-0" />
                    <span className="flex-1 text-sm text-slate-300">{item.item}</span>
                    <button
                      onClick={() => { deleteItem(item.id); logActivity({ log_type: 'database', action: 'DELETE', entity_type: 'packing_item', entity_name: item.item }) }}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Preferanser-tab ────────────────────────────────────────────────────────────

function PreferanserTab() {
  const { preferences, loading, savePreferences } = useUserPreferences()
  const [interests, setInterests] = useState('')
  const [food, setFood] = useState('')
  const [mobility, setMobility] = useState('')
  const [other, setOther] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  // Sync when loaded
  useEffect(() => {
    if (preferences) {
      setInterests(preferences.interests ?? '')
      setFood(preferences.food_preferences ?? '')
      setMobility(preferences.mobility_notes ?? '')
      setOther(preferences.other_info ?? '')
      if (preferences.updated_at) setLastSaved(new Date(preferences.updated_at))
    }
  }, [preferences])

  const debounceSave = useCallback((updates: Parameters<typeof savePreferences>[0]) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await savePreferences(updates)
      setLastSaved(new Date())
      logActivity({ log_type: 'functional', action: 'lagret', entity_type: 'preferences', entity_name: 'Personlige preferanser' })
    }, 800)
  }, [savePreferences])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 text-slate-600 animate-spin" /></div>

  const fields: { label: string; desc: string; value: string; setter: (v: string) => void; key: keyof Parameters<typeof savePreferences>[0] }[] = [
    { label: 'Interesser', desc: 'Mat, kultur, sport, natur, shopping osv.', value: interests, setter: setInterests, key: 'interests' },
    { label: 'Matpreferanser og allergier', desc: 'Vegetar, vegansk, glutenfri, allergier osv.', value: food, setter: setFood, key: 'food_preferences' },
    { label: 'Mobilitet og spesielle hensyn', desc: 'Rullestol, barnevogn, høyt tempo, slow travel osv.', value: mobility, setter: setMobility, key: 'mobility_notes' },
    { label: 'Annen informasjon til reiseassistenten', desc: 'Budsjettbevissthet, preferert reisestil, eller noe annet som er nyttig å vite', value: other, setter: setOther, key: 'other_info' },
  ]

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Personlige preferanser</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Informasjonen du legger inn her brukes som kontekst i Ferietips-chatten slik at den kan gi deg mer relevante og personlige råd.
        </p>
      </div>

      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
            <p className="text-xs text-slate-600 mb-1.5">{f.desc}</p>
            <textarea
              value={f.value}
              onChange={(e) => { f.setter(e.target.value); debounceSave({ [f.key]: e.target.value }) }}
              rows={3}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500 resize-none"
              placeholder={`Skriv inn ${f.label.toLowerCase()}…`}
            />
          </div>
        ))}
      </div>

      {lastSaved && (
        <p className="text-xs text-slate-600">Sist lagret: {fmtDate(lastSaved.toISOString())}</p>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MinSidePage() {
  const [activeTab, setActiveTab] = useState<TabId>('profil')
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [supabase])

  const renderContent = () => {
    switch (activeTab) {
      case 'profil':      return <ProfilTab user={user} />
      case 'del':         return <DelFerieTab />
      case 'logg':        return <EndringsloggTab />
      case 'statistikk':  return <StatistikkTab />
      case 'dokumenter':  return <DokumentTab />
      case 'pakkeliste':  return <PakkelisteTab />
      case 'preferanser': return <PreferanserTab />
    }
  }

  return (
    <div className="h-full flex bg-slate-950">
      {/* ── Sidebar ── */}
      <aside className="w-52 flex-shrink-0 border-r border-slate-800 flex flex-col py-4">
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">Min side</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email ?? '…'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                activeTab === id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 min-w-0">
        {renderContent()}
      </div>
    </div>
  )
}
