'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trip, TripShare } from '@/types'
import { useTrips } from '@/hooks/useTrips'
import {
  Archive, RotateCcw, Trash2, Users, CalendarDays, Clock,
  ChevronDown, ChevronRight, Loader2, UserCheck, MapPin, Globe,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function tripDateRange(trip: Trip) {
  if (trip.date_from && trip.date_to) return `${fmt(trip.date_from)} – ${fmt(trip.date_to)}`
  if (trip.date_from) return `Fra ${fmt(trip.date_from)}`
  return trip.year ? String(trip.year) : '—'
}

function tripTypeLabel(type: string) {
  if (type === 'storbytur') return 'Storbytur'
  if (type === 'resort')    return 'Resort'
  return 'Roadtrip'
}

// ── Trip card ─────────────────────────────────────────────────────────────────

function TripRow({
  trip,
  shares,
  ownerName,
  isOwner,
  isArchived,
  onArchive,
  onRestore,
  onDelete,
}: {
  trip: Trip
  shares: TripShare[]
  ownerName?: string
  isOwner: boolean
  isArchived: boolean
  onArchive?: () => void
  onRestore?: () => void
  onDelete?: () => void
}) {
  const accepted = shares.filter((s) => s.status === 'accepted')
  const pending  = shares.filter((s) => s.status === 'pending')

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{trip.name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 flex-shrink-0">
              {tripTypeLabel(trip.trip_type)}
            </span>
            {isArchived && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">
                Arkivert
              </span>
            )}
            {!isOwner && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex-shrink-0">
                Delt med meg
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {(trip.destination_city || trip.destination_country) && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Globe className="w-3 h-3 flex-shrink-0" />
                {[trip.destination_city, trip.destination_country].filter(Boolean).join(', ')}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <CalendarDays className="w-3 h-3 flex-shrink-0" />
              {tripDateRange(trip)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {isOwner && !isArchived && onArchive && (
            <button
              onClick={onArchive}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors border border-slate-600/40"
            >
              <Archive className="w-3.5 h-3.5" />
              Arkiver
            </button>
          )}
          {isOwner && isArchived && (
            <>
              {onRestore && (
                <button
                  onClick={onRestore}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-green-400 transition-colors border border-slate-600/40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Gjenopprett
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Slett permanent
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-slate-500 border-t border-slate-700/40 pt-2.5">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Opprettet: <span className="text-slate-400 ml-0.5">{fmtFull(trip.created_at)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Sist endret: <span className="text-slate-400 ml-0.5">{fmtFull(trip.updated_at)}</span>
        </span>
        {!isOwner && ownerName && (
          <span className="flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            Eier: <span className="text-slate-400 ml-0.5">{ownerName}</span>
          </span>
        )}
      </div>

      {/* Shared users (only for owner) */}
      {isOwner && shares.length > 0 && (
        <div className="flex items-start gap-2 pt-0.5">
          <Users className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {accepted.map((s) => (
              <span key={s.id} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                ✓ {s.shared_with_email}
                <span className="text-green-600 ml-0.5">· {s.access_level === 'write' ? 'skriv' : 'les'}</span>
              </span>
            ))}
            {pending.map((s) => (
              <span key={s.id} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                ⏳ {s.shared_with_email}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  open,
  onToggle,
  toggleable = false,
}: {
  icon: React.ElementType
  title: string
  count: number
  open?: boolean
  onToggle?: () => void
  toggleable?: boolean
}) {
  if (toggleable) {
    return (
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 mb-3 group"
      >
        <Icon className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 ml-0.5">{count}</span>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-auto group-hover:text-slate-300 transition-colors" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto group-hover:text-slate-300 transition-colors" />
        }
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-slate-500" />
      <h2 className="text-sm font-semibold text-slate-300">{title}</h2>
      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 ml-0.5">{count}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdministerReiserTab() {
  const { trips, userId, archiveTrip, restoreTrip, deleteTrip } = useTrips()
  const supabase = useMemo(() => createClient(), [])

  const [allShares, setAllShares] = useState<TripShare[]>([])
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({})
  const [sharesLoading, setSharesLoading] = useState(true)
  const [showArchive, setShowArchive] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  // Partition trips
  const myTrips       = useMemo(() => trips.filter((t) => t.owner_id === userId && t.status !== 'archived'), [trips, userId])
  const sharedTrips   = useMemo(() => trips.filter((t) => t.owner_id !== userId), [trips, userId])
  const archivedTrips = useMemo(() => trips.filter((t) => t.owner_id === userId && t.status === 'archived'), [trips, userId])

  // Fetch shares + owner display names
  useEffect(() => {
    if (!userId) return
    const ownedIds = trips.filter((t) => t.owner_id === userId).map((t) => t.id)
    const ownerIds = [...new Set(trips.filter((t) => t.owner_id !== userId).map((t) => t.owner_id))]

    const fetches: Promise<void>[] = []

    if (ownedIds.length > 0) {
      fetches.push(
        Promise.resolve(
          supabase
            .from('trip_shares')
            .select('*')
            .in('trip_id', ownedIds)
        ).then(({ data }) => { if (data) setAllShares(data as TripShare[]) })
      )
    }

    if (ownerIds.length > 0) {
      fetches.push(
        Promise.resolve(
          supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .in('user_id', ownerIds)
        ).then(({ data }) => {
          if (data) {
            const map: Record<string, string> = {}
            for (const p of data as { user_id: string; display_name: string | null }[]) {
              map[p.user_id] = p.display_name || 'Ukjent bruker'
            }
            setOwnerNames(map)
          }
        })
      )
    }

    Promise.all(fetches).finally(() => setSharesLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, trips.length, supabase])

  function sharesFor(tripId: string) {
    return allShares.filter((s) => s.trip_id === tripId)
  }

  if (sharesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Mine reiser ── */}
      <section>
        <SectionHeader icon={MapPin} title="Mine reiser" count={myTrips.length} />
        {myTrips.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Ingen aktive reiser opprettet av deg.</p>
        ) : (
          <div className="space-y-3">
            {myTrips.map((trip) => (
              <TripRow
                key={trip.id}
                trip={trip}
                shares={sharesFor(trip.id)}
                isOwner
                isArchived={false}
                onArchive={() => setConfirmArchive({ id: trip.id, name: trip.name })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Delt med meg ── */}
      {sharedTrips.length > 0 && (
        <section>
          <SectionHeader icon={Users} title="Reiser du er invitert til" count={sharedTrips.length} />
          <div className="space-y-3">
            {sharedTrips.map((trip) => (
              <TripRow
                key={trip.id}
                trip={trip}
                shares={[]}
                ownerName={ownerNames[trip.owner_id]}
                isOwner={false}
                isArchived={trip.status === 'archived'}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-600 italic">
            Kun reisens eier kan arkivere eller slette disse reisene.
          </p>
        </section>
      )}

      {/* ── Arkiverte reiser ── */}
      <section>
        <SectionHeader
          icon={Archive}
          title="Arkiverte reiser"
          count={archivedTrips.length}
          open={showArchive}
          onToggle={() => setShowArchive((v) => !v)}
          toggleable
        />
        {showArchive && (
          archivedTrips.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Ingen arkiverte reiser.</p>
          ) : (
            <div className="space-y-3">
              {archivedTrips.map((trip) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  shares={sharesFor(trip.id)}
                  isOwner
                  isArchived
                  onRestore={() => restoreTrip(trip.id)}
                  onDelete={() => setConfirmDelete({ id: trip.id, name: trip.name })}
                />
              ))}
            </div>
          )
        )}
      </section>

      {/* ── Confirm dialogs ── */}
      {confirmArchive && (
        <ConfirmDialog
          message={`Arkiver reisen «${confirmArchive.name}»? Den vil ikke lenger vises i planer, men kan gjenopprettes fra arkivet her.`}
          confirmLabel="Arkiver"
          onConfirm={async () => {
            await archiveTrip(confirmArchive.id)
            setConfirmArchive(null)
          }}
          onCancel={() => setConfirmArchive(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          message={`Slett reisen «${confirmDelete.name}» permanent? Alle data, stopp, aktiviteter og kostnader slettes for alltid og kan ikke gjenopprettes.`}
          confirmLabel="Slett permanent"
          onConfirm={async () => {
            await deleteTrip(confirmDelete.id)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
