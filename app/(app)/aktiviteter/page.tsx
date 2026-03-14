'use client'

import { useState, useMemo, useRef } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useActivities } from '@/hooks/useActivities'
import PlanningMap from '@/components/map/PlanningMap'
import { ActivityTypeIcon, getActivityTypeConfig } from '@/lib/activityTypes'
import { MapPin, Clock } from 'lucide-react'
import Link from 'next/link'

export default function AktiviteterPage() {
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const { currentTrip } = useTrips()
  const { stops } = useStops(currentTrip?.id ?? null)
  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const { activities } = useActivities(stopIds)

  // Stops in trip order, each with sorted activities
  const stopsWithActivities = useMemo(() => {
    return stops
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((stop) => ({
        stop,
        activities: activities
          .filter((a) => a.stop_id === stop.id)
          .sort((a, b) => {
            const dateA = a.activity_date ?? stop.arrival_date ?? ''
            const dateB = b.activity_date ?? stop.arrival_date ?? ''
            if (dateA !== dateB) return dateA < dateB ? -1 : 1
            return (a.activity_time ?? '') < (b.activity_time ?? '') ? -1 : 1
          }),
      }))
      .filter((s) => s.activities.length > 0)
  }, [stops, activities])

  const selectedActivity = activities.find((a) => a.id === selectedActivityId)

  const mapCenter = useMemo(() => {
    if (!selectedActivity?.map_lat || !selectedActivity?.map_lng) return null
    return { lat: selectedActivity.map_lat, lng: selectedActivity.map_lng }
  }, [selectedActivity?.map_lat, selectedActivity?.map_lng])

  function handleSelectActivity(id: string) {
    setSelectedActivityId((prev) => (prev === id ? null : id))
    setTimeout(() => {
      const el = itemRefs.current[id]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 0)
  }

  if (!currentTrip) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="text-center space-y-2">
          <p className="text-slate-300 text-sm font-medium">Ingen tur valgt</p>
          <p className="text-slate-500 text-xs">
            Gå til{' '}
            <Link href="/plan" className="text-blue-400 hover:underline">
              Planlegg
            </Link>{' '}
            for å velge eller opprette en tur.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ─── Left panel ─────────────────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">Aktiviteter</h2>
          <p className="text-xs text-slate-500 truncate mt-0.5">{currentTrip.name}</p>
        </div>

        {/* Activity list */}
        <div className="flex-1 overflow-y-auto">
          {stopsWithActivities.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-slate-500 text-xs">
                Ingen aktiviteter lagt til enda.
                <br />
                Legg til aktiviteter fra{' '}
                <Link href="/plan" className="text-blue-400 hover:underline">
                  Planlegg
                </Link>
                .
              </p>
            </div>
          ) : (
            stopsWithActivities.map(({ stop, activities: acts }) => (
              <div key={stop.id}>
                {/* Stop header */}
                <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/50 sticky top-0 z-10">
                  <p className="text-xs font-semibold text-slate-300">
                    {stop.city}
                    {stop.state ? `, ${stop.state}` : ''}
                  </p>
                  {stop.arrival_date && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(stop.arrival_date + 'T00:00:00').toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  )}
                </div>

                {/* Activities */}
                {acts.map((activity) => {
                  const cfg = getActivityTypeConfig(activity.activity_type)
                  const isSelected = activity.id === selectedActivityId
                  const hasPinnedLocation = !!(activity.map_lat && activity.map_lng)

                  return (
                    <div
                      key={activity.id}
                      ref={(el) => { itemRefs.current[activity.id] = el }}
                      onClick={() => handleSelectActivity(activity.id)}
                      className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/40 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-900/30 border-l-2 border-l-blue-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Type icon */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: cfg.color + '33' }}
                      >
                        <ActivityTypeIcon type={activity.activity_type} size={14} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium truncate ${
                            isSelected ? 'text-blue-200' : 'text-slate-200'
                          }`}
                        >
                          {activity.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {activity.activity_date && (
                            <span className="text-[10px] text-slate-500">
                              {new Date(activity.activity_date + 'T00:00:00').toLocaleDateString(
                                'nb-NO',
                                { day: 'numeric', month: 'short' }
                              )}
                            </span>
                          )}
                          {activity.activity_time && (
                            <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                              <Clock className="w-2.5 h-2.5" />
                              {activity.activity_time}
                            </span>
                          )}
                          {hasPinnedLocation && (
                            <span className="flex items-center gap-0.5 text-[10px] text-blue-400">
                              <MapPin className="w-2.5 h-2.5" />
                              Kart
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Right: Map ──────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <PlanningMap
          stops={stops}
          selectedStopId={null}
          onAddStop={() => {}}
          onSelectStop={() => {}}
          readOnly
          activities={activities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={handleSelectActivity}
          mapCenter={mapCenter}
        />
      </div>
    </div>
  )
}
