'use client'

import { useState, useMemo, useRef } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useActivities } from '@/hooks/useActivities'
import { useHotels } from '@/hooks/useHotels'
import PlanningMap from '@/components/map/PlanningMap'
import { ActivityTypeIcon, getActivityTypeConfig } from '@/lib/activityTypes'
import { MapPin, Clock, X, ExternalLink, Navigation } from 'lucide-react'
import Link from 'next/link'

export default function AktiviteterPage() {
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const { currentTrip } = useTrips()
  const { stops } = useStops(currentTrip?.id ?? null)
  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const { activities } = useActivities(stopIds)
  const { hotels } = useHotels(stopIds)

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

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedActivityId) ?? null,
    [activities, selectedActivityId]
  )

  const selectedStop = useMemo(
    () => (selectedActivity ? stops.find((s) => s.id === selectedActivity.stop_id) ?? null : null),
    [selectedActivity, stops]
  )

  const selectedHotel = useMemo(
    () => (selectedStop ? hotels.find((h) => h.stop_id === selectedStop.id) ?? null : null),
    [selectedStop, hotels]
  )

  // Map center: pan to selected activity location
  const mapCenter = useMemo(() => {
    if (!selectedActivity?.map_lat || !selectedActivity?.map_lng) return null
    return { lat: selectedActivity.map_lat, lng: selectedActivity.map_lng }
  }, [selectedActivity?.map_lat, selectedActivity?.map_lng])

  // Route from activity to hotel/stop
  const activityRoute = useMemo(() => {
    if (!selectedActivity?.map_lat || !selectedActivity?.map_lng) return null
    if (!selectedStop) return null
    return {
      fromLat: selectedActivity.map_lat,
      fromLng: selectedActivity.map_lng,
      toAddress: selectedHotel?.address ?? null,
      toLat: selectedStop.lat,
      toLng: selectedStop.lng,
    }
  }, [
    selectedActivity?.map_lat,
    selectedActivity?.map_lng,
    selectedStop,
    selectedHotel?.address,
  ])

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
        <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">Aktiviteter</h2>
          <p className="text-xs text-slate-500 truncate mt-0.5">{currentTrip.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {stopsWithActivities.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-slate-500 text-xs">
                Ingen aktiviteter lagt til enda.
                <br />
                Legg til fra{' '}
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
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: cfg.color + '33' }}
                      >
                        <ActivityTypeIcon type={activity.activity_type} size={14} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-blue-200' : 'text-slate-200'}`}>
                          {activity.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {activity.activity_date && (
                            <span className="text-[10px] text-slate-500">
                              {new Date(activity.activity_date + 'T00:00:00').toLocaleDateString('nb-NO', {
                                day: 'numeric', month: 'short',
                              })}
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
          activityRoute={activityRoute}
        />

        {/* ─── Activity info box overlay ─────────────────────────────── */}
        {selectedActivity && (
          <div className="absolute bottom-5 left-4 z-20 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-2xl p-4 w-72 max-w-[calc(100%-2rem)]">
            {/* Header */}
            <div className="flex items-start gap-3">
              {(() => {
                const cfg = getActivityTypeConfig(selectedActivity.activity_type)
                return (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: cfg.color + '33' }}
                  >
                    <ActivityTypeIcon type={selectedActivity.activity_type} size={18} />
                  </div>
                )
              })()}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-100 leading-tight">
                  {selectedActivity.name}
                </p>
                {selectedStop && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedStop.city}{selectedStop.state ? `, ${selectedStop.state}` : ''}
                  </p>
                )}
              </div>

              <button
                onClick={() => setSelectedActivityId(null)}
                className="flex-shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Details */}
            <div className="mt-3 space-y-1.5">
              {(selectedActivity.activity_date || selectedActivity.activity_time) && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span>
                    {selectedActivity.activity_date &&
                      new Date(selectedActivity.activity_date + 'T00:00:00').toLocaleDateString('nb-NO', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    {selectedActivity.activity_time && ` · ${selectedActivity.activity_time}`}
                  </span>
                </div>
              )}

              {selectedActivity.cost != null && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-slate-500">kr</span>
                  <span>{selectedActivity.cost.toLocaleString('nb-NO')}</span>
                </div>
              )}

              {/* Route destination info */}
              {activityRoute && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Rute til{' '}
                    {selectedHotel?.name
                      ? selectedHotel.name
                      : selectedStop?.city ?? 'hotellet'}
                  </span>
                </div>
              )}
            </div>

            {/* Link */}
            {selectedActivity.url && (
              <a
                href={selectedActivity.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 w-full h-8 rounded-lg bg-blue-700/80 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Åpne lenke
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
