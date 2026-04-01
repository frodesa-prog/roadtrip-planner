'use client'

import { Activity, Dining } from '@/types'
import { ActivityTypeIcon, getActivityTypeConfig } from '@/lib/activityTypes'
import { ExternalLink, MapPin, UtensilsCrossed } from 'lucide-react'

interface Props {
  stopId:     string
  activities: Activity[]
  dining:     Dining[]
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function MapsLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Åpne i Google Maps"
      onClick={e => e.stopPropagation()}
      className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-emerald-400 transition-colors flex-shrink-0"
    >
      <MapPin className="w-3.5 h-3.5" />
    </a>
  )
}

function WebLink({ url }: { url: string }) {
  return (
    <a
      href={url.startsWith('http') ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Åpne nettside"
      onClick={e => e.stopPropagation()}
      className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-amber-400 transition-colors flex-shrink-0"
    >
      <ExternalLink className="w-3.5 h-3.5" />
    </a>
  )
}

export default function StopActivityList({ stopId, activities, dining }: Props) {
  const stopActs = activities.filter(a => a.stop_id === stopId)
  const stopDin  = dining.filter(d => d.stop_id === stopId)

  if (!stopActs.length && !stopDin.length) return null

  return (
    <div className="mt-5 space-y-4">

      {/* ── Aktiviteter ── */}
      {stopActs.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider mb-2">
            Aktiviteter
          </p>
          <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/70">
            {stopActs.map(act => {
              const cfg = getActivityTypeConfig(act.activity_type)
              return (
                <div key={act.id} className="flex items-start gap-2.5 px-3 py-2.5 bg-slate-900/50 hover:bg-slate-800/40 transition-colors">

                  {/* Type icon */}
                  <div className="flex-shrink-0 mt-0.5 w-5 flex items-center justify-center" title={cfg.label}>
                    <ActivityTypeIcon type={act.activity_type} size={15} />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-slate-100 truncate">
                        {act.name}
                      </span>
                      {act.activity_date && (
                        <span className="text-[11px] text-slate-500 flex-shrink-0">
                          {fmtDate(act.activity_date)}
                          {act.activity_time && ` · ${act.activity_time.slice(0, 5)}`}
                        </span>
                      )}
                    </div>
                    {act.notes && (
                      <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-2">{act.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                    {act.url && <WebLink url={act.url} />}
                    {act.map_lat != null && act.map_lng != null && (
                      <MapsLink lat={act.map_lat} lng={act.map_lng} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Spisesteder ── */}
      {stopDin.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <UtensilsCrossed className="w-3 h-3" />
            Restauranter / Spisesteder
          </p>
          <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/70">
            {stopDin.map(d => (
              <div key={d.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-900/50 hover:bg-slate-800/40 transition-colors">

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-slate-100 truncate">{d.name}</span>
                    {d.booking_date && (
                      <span className="text-[11px] text-slate-500 flex-shrink-0">
                        {fmtDate(d.booking_date)}
                        {d.booking_time && ` · ${d.booking_time.slice(0, 5)}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {d.url && <WebLink url={d.url} />}
                  {d.map_lat != null && d.map_lng != null && (
                    <MapsLink lat={d.map_lat} lng={d.map_lng} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
