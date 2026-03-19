'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users, Map, Activity, MessageSquare, FileText, CheckSquare,
  Trash2, RefreshCw, AlertTriangle, TrendingUp, Hotel,
  Plane, Package, Camera, FolderOpen, Loader2, ShieldCheck,
  Terminal, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminStats {
  users: {
    total: number
    activeLastMonth: number
    monthlySignups: Record<string, number>
    recentSignups: { display_name: string | null; email: string; created_at: string }[]
  }
  trips: {
    total: number
    thisMonth: number
    byType: Record<string, number>
    byStatus: Record<string, number>
    recent: { name: string; trip_type: string; status: string; created_at: string }[]
  }
  content: {
    stops: number
    activities: number
    activityTypes: Record<string, number>
    hotels: number
    travelers: number
    flights: number
  }
  engagement: {
    chatMessages: number
    chatArchives: number
    notes: number
    documents: number
    photos: number
    todosDone: number
    todosPending: number
    totalBudget: number
  }
  recentActivity: {
    action: string
    entity_type: string
    created_at: string
    user_id: string
  }[]
}

interface DevLogEntry {
  id: string
  prompt: string
  created_at: string
  deploy_status: 'pending' | 'success' | 'failed' | 'none'
  commit_hash: string | null
  commit_message: string | null
  deployed_at: string | null
  project: string
  session_id: string | null
}

interface AdminUser {
  id: string
  email: string
  displayName: string | null
  isAdmin: boolean
  createdAt: string
  lastSignIn: string | null
  emailConfirmed: boolean
  tripCount: number
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('nb-NO')
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'akkurat nå'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min siden`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} t siden`
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)} d siden`
  return fmtDate(iso)
}

const TRIP_TYPE_LABEL: Record<string, string> = {
  road_trip: 'Roadtrip',
  resort: 'Resort',
  storbytour: 'Storbytur',
}

const STATUS_LABEL: Record<string, string> = {
  planning: 'Planlegger',
  active: 'Aktiv',
  completed: 'Fullført',
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'rose'
}) {
  const colors = {
    blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green:  'bg-green-500/10 text-green-400 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose:   'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-white mt-0.5 leading-none">{fmt(Number(value))}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────

function MiniBarChart({ data, color = '#3b82f6' }: { data: Record<string, number>; color?: string }) {
  const entries = Object.entries(data)
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {entries.map(([label, value]) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-sm"
            style={{ height: `${Math.max(4, (value / max) * 52)}px`, backgroundColor: color }}
          />
          <span className="text-[9px] text-slate-500 truncate w-full text-center">{label}</span>
          <span className="text-[9px] text-slate-400 font-medium">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null)
  const [activeView, setActiveView] = useState<'oversikt' | 'brukere' | 'devlog'>('oversikt')
  const [devLog, setDevLog] = useState<DevLogEntry[]>([])
  const [devLogLoading, setDevLogLoading] = useState(false)
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Feil ved henting av statistikk')
      setStats(await res.json())
    } catch (e) {
      toast.error('Kunne ikke laste statistikk')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      toast.error('Kunne ikke laste brukerliste')
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const fetchDevLog = useCallback(async () => {
    setDevLogLoading(true)
    try {
      const res = await fetch('/api/admin/dev-log')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDevLog(data.entries ?? [])
    } catch {
      toast.error('Kunne ikke laste dev-logg')
    } finally {
      setDevLogLoading(false)
    }
  }, [])

  async function handleDeleteLogEntry(id: string) {
    setDeletingLogId(id)
    try {
      const res = await fetch('/api/admin/dev-log', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      setDevLog((prev) => prev.filter((e) => e.id !== id))
    } catch {
      toast.error('Kunne ikke slette loggoppføring')
    } finally {
      setDeletingLogId(null)
    }
  }

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { if (activeView === 'brukere') fetchUsers() }, [activeView, fetchUsers])
  useEffect(() => { if (activeView === 'devlog') fetchDevLog() }, [activeView, fetchDevLog])

  async function handleDeleteUser() {
    if (!confirmDelete) return
    setDeletingId(confirmDelete.id)
    setConfirmDelete(null)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: confirmDelete.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ukjent feil')
      toast.success(`Brukeren ${confirmDelete.email} er slettet`)
      setUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id))
    } catch (e) {
      toast.error(`Sletting feilet: ${(e as Error).message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Administrator</h2>
            <p className="text-[11px] text-slate-500">Systemstatistikk og brukeradministrasjon</p>
          </div>
        </div>
        <button
          onClick={() => { fetchStats(); if (activeView === 'brukere') fetchUsers(); if (activeView === 'devlog') fetchDevLog() }}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Oppdater
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
        {([
          { id: 'oversikt', label: 'Oversikt' },
          { id: 'brukere',  label: 'Brukere' },
          { id: 'devlog',   label: 'Dev-logg' },
        ] as { id: 'oversikt' | 'brukere' | 'devlog'; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERSIKT ─────────────────────────────────────────────────────────── */}
      {activeView === 'oversikt' && (
        loading ? (
          <div className="flex items-center gap-2 text-slate-500 py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Laster statistikk…</span>
          </div>
        ) : stats ? (
          <div className="space-y-8">

            {/* Brukere */}
            <Section title="Brukere">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <StatCard icon={Users} label="Totalt registrert" value={stats.users.total} color="blue" />
                <StatCard icon={TrendingUp} label="Aktive siste 30 dager" value={stats.users.activeLastMonth} color="green" />
                <StatCard icon={Map} label="Totalt ferier" value={stats.trips.total} sub={`${stats.trips.thisMonth} denne måneden`} color="purple" />
                <StatCard icon={Activity} label="Stoppesteder" value={stats.content.stops} color="amber" />
              </div>

              {/* Monthly signups */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-400 mb-3">Nye brukere per måned (siste 6 mnd)</p>
                <MiniBarChart data={stats.users.monthlySignups} color="#3b82f6" />
              </div>

              {/* Recent signups */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden mt-3">
                <div className="px-4 py-2.5 border-b border-slate-700/50">
                  <p className="text-xs font-medium text-slate-300">Siste registrerte brukere</p>
                </div>
                {stats.users.recentSignups.map((u, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60 last:border-0">
                    <div>
                      <p className="text-xs text-slate-200">{u.display_name ?? u.email}</p>
                      <p className="text-[10px] text-slate-500">{u.email}</p>
                    </div>
                    <p className="text-[10px] text-slate-500">{fmtDate(u.created_at)}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Ferier */}
            <Section title="Ferier">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {Object.entries(stats.trips.byType).map(([type, count]) => (
                  <div key={type} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{TRIP_TYPE_LABEL[type] ?? type}</p>
                    <p className="text-2xl font-bold text-white mt-0.5">{count}</p>
                  </div>
                ))}
              </div>

              {/* By status */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-400 mb-3">Status på ferier</p>
                <div className="flex gap-4">
                  {Object.entries(stats.trips.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        status === 'planning' ? 'bg-amber-400' :
                        status === 'active' ? 'bg-green-400' : 'bg-slate-500'
                      }`} />
                      <span className="text-xs text-slate-300">{STATUS_LABEL[status] ?? status}</span>
                      <span className="text-xs font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent trips */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden mt-3">
                <div className="px-4 py-2.5 border-b border-slate-700/50">
                  <p className="text-xs font-medium text-slate-300">Siste opprettede ferier</p>
                </div>
                {stats.trips.recent.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60 last:border-0">
                    <div>
                      <p className="text-xs text-slate-200">{t.name}</p>
                      <p className="text-[10px] text-slate-500">{TRIP_TYPE_LABEL[t.trip_type] ?? t.trip_type}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        t.status === 'planning' ? 'bg-amber-500/10 text-amber-400' :
                        t.status === 'active' ? 'bg-green-500/10 text-green-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">{fmtDate(t.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Innhold */}
            <Section title="Innhold og planlegging">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Activity} label="Aktiviteter" value={stats.content.activities} color="blue" />
                <StatCard icon={Hotel} label="Hoteller" value={stats.content.hotels} color="green" />
                <StatCard icon={Plane} label="Flyreiser" value={stats.content.flights} color="purple" />
                <StatCard icon={Package} label="Reisefølge" value={stats.content.travelers} color="amber" />
              </div>

              {/* Activity types */}
              {Object.keys(stats.content.activityTypes).length > 0 && (
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 mt-3">
                  <p className="text-xs font-medium text-slate-400 mb-3">Aktivitetstyper</p>
                  <MiniBarChart data={stats.content.activityTypes} color="#a855f7" />
                </div>
              )}
            </Section>

            {/* Engagement */}
            <Section title="Bruk og engasjement">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={MessageSquare} label="Chatmeldinger" value={stats.engagement.chatMessages} color="blue" />
                <StatCard icon={FileText} label="Notater" value={stats.engagement.notes} color="green" />
                <StatCard icon={Camera} label="Bilder" value={stats.engagement.photos} color="purple" />
                <StatCard icon={FolderOpen} label="Dokumenter" value={stats.engagement.documents} color="amber" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                <StatCard icon={CheckSquare} label="Oppgaver fullført" value={stats.engagement.todosDone} color="green" />
                <StatCard icon={CheckSquare} label="Oppgaver åpne" value={stats.engagement.todosPending} color="amber" />
                <StatCard
                  icon={TrendingUp}
                  label="Totalbudsjett registrert"
                  value={`${fmt(Math.round(stats.engagement.totalBudget))} kr`}
                  color="rose"
                />
              </div>
            </Section>

            {/* Recent activity */}
            <Section title="Siste aktivitet i systemet">
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
                {stats.recentActivity.slice(0, 15).map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-slate-800/60 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <p className="text-xs text-slate-300 flex-1 min-w-0 truncate">
                      <span className="capitalize">{entry.action}</span>{' '}
                      <span className="text-slate-500">{entry.entity_type}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 flex-shrink-0">{fmtDateTime(entry.created_at)}</p>
                  </div>
                ))}
                {stats.recentActivity.length === 0 && (
                  <p className="text-xs text-slate-500 px-4 py-4">Ingen aktivitet funnet</p>
                )}
              </div>
            </Section>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Ingen data tilgjengelig</p>
        )
      )}

      {/* ── BRUKERE ──────────────────────────────────────────────────────────── */}
      {activeView === 'brukere' && (
        <div className="space-y-4">
          {usersLoading ? (
            <div className="flex items-center gap-2 text-slate-500 py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Laster brukere…</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">{users.length} brukere totalt</p>
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-slate-800/60 border-b border-slate-700/50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Bruker</span>
                  <span className="text-right">Ferier</span>
                  <span className="text-right">Siste innlogging</span>
                  <span />
                </div>

                {users.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* User info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-slate-200 truncate">{u.displayName ?? u.email}</p>
                        {u.isAdmin && (
                          <span className="flex-shrink-0 text-[9px] bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-full px-1.5 py-0.5 font-medium">
                            Admin
                          </span>
                        )}
                        {!u.emailConfirmed && (
                          <span className="flex-shrink-0 text-[9px] bg-amber-500/10 text-amber-400 rounded-full px-1.5 py-0.5">
                            Ubekreftet
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                      <p className="text-[10px] text-slate-600">Registrert {fmtDate(u.createdAt)}</p>
                    </div>

                    {/* Trip count */}
                    <p className="text-xs text-slate-400 text-right">{u.tripCount}</p>

                    {/* Last sign in */}
                    <p className="text-[10px] text-slate-500 text-right whitespace-nowrap">{timeAgo(u.lastSignIn)}</p>

                    {/* Delete */}
                    <div className="flex justify-end">
                      {!u.isAdmin && (
                        <button
                          onClick={() => setConfirmDelete(u)}
                          disabled={deletingId === u.id}
                          title="Slett bruker"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                        >
                          {deletingId === u.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DEV-LOGG ─────────────────────────────────────────────────────────── */}
      {activeView === 'devlog' && (
        <div className="space-y-4">
          {devLogLoading ? (
            <div className="flex items-center gap-2 text-slate-500 py-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Laster logg…</span>
            </div>
          ) : devLog.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Terminal className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Ingen loggoppføringer ennå.</p>
              <p className="text-xs mt-1 text-slate-600">Prompts logges automatisk fra Claude Code når dev-serveren kjører.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {devLog.map((entry) => {
                const isExpanded = expandedEntry === entry.id
                const statusIcon =
                  entry.deploy_status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" /> :
                  entry.deploy_status === 'failed'  ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" /> :
                  entry.deploy_status === 'pending' ? <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" /> :
                  <Terminal className="w-4 h-4 text-slate-500 flex-shrink-0" />
                const statusLabel =
                  entry.deploy_status === 'success' ? 'Deployet' :
                  entry.deploy_status === 'failed'  ? 'Deploy feilet' :
                  entry.deploy_status === 'pending' ? 'Venter på deploy' : 'Ingen deploy'
                const statusColor =
                  entry.deploy_status === 'success' ? 'text-green-400' :
                  entry.deploy_status === 'failed'  ? 'text-red-400' :
                  entry.deploy_status === 'pending' ? 'text-amber-400' : 'text-slate-500'

                return (
                  <div key={entry.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
                    {/* Summary row */}
                    <div
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/80 transition-colors"
                      onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                    >
                      {statusIcon}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                          {entry.prompt}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500">
                            {new Date(entry.created_at).toLocaleString('nb-NO', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                          <span className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
                          {entry.commit_hash && (
                            <span className="text-[10px] text-slate-600 font-mono">{entry.commit_hash}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteLogEntry(entry.id) }}
                          disabled={deletingLogId === entry.id}
                          className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                          title="Slett oppføring"
                        >
                          {deletingLogId === entry.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                          : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-slate-700/50 px-4 py-3 space-y-3 bg-slate-900/40">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Prompt</p>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                            {entry.prompt}
                          </p>
                        </div>
                        {entry.commit_message && (
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Commit-melding</p>
                            <p className="text-xs text-slate-400 font-mono leading-relaxed">{entry.commit_message}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                          {entry.commit_hash && (
                            <span>Hash: <span className="font-mono text-slate-400">{entry.commit_hash}</span></span>
                          )}
                          {entry.deployed_at && (
                            <span>Deployet: <span className="text-slate-400">
                              {new Date(entry.deployed_at).toLocaleString('nb-NO', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                              })}
                            </span></span>
                          )}
                          {entry.session_id && (
                            <span>Sesjon: <span className="font-mono text-slate-400">{entry.session_id.slice(0, 8)}…</span></span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Slett-bekreftelse ─────────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5 text-rose-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Slett bruker</h3>
            </div>
            <p className="text-sm text-slate-400 mb-1">
              Er du sikker på at du vil slette brukeren:
            </p>
            <p className="text-sm font-medium text-white mb-1">{confirmDelete.displayName ?? confirmDelete.email}</p>
            <p className="text-xs text-slate-500 mb-5">{confirmDelete.email}</p>
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-5">
              ⚠️ Dette kan ikke angres. All data knyttet til brukeren slettes permanent.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-sm font-medium transition-colors"
              >
                Slett permanent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
