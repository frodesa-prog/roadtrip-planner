'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  APIProvider,
  Map,
  MapMouseEvent,
  useMap,
} from '@vis.gl/react-google-maps'
import { Activity, Stop } from '@/types'
import RoutePolyline from './RoutePolyline'
import StopMarker from './StopMarker'
import AddStopPopup from './AddStopPopup'
import MapSearchBox from './MapSearchBox'
import ActivityMarker from './ActivityMarker'
import ActivityRoutePolyline from './ActivityRoutePolyline'

interface ActivityRoute {
  fromLat: number
  fromLng: number
  toAddress: string | null
  toLat: number
  toLng: number
}

interface PlanningMapProps {
  stops: Stop[]
  selectedStopId: string | null
  onAddStop: (stop: Stop) => void
  onSelectStop: (id: string) => void
  disabled?: boolean
  readOnly?: boolean
  activities?: Activity[]
  selectedActivityId?: string | null
  onSelectActivity?: (id: string) => void
  mapCenter?: { lat: number; lng: number } | null
  activityRoute?: ActivityRoute | null
}

interface PendingStop {
  lat: number
  lng: number
  city?: string
  state?: string
  fromSearch?: boolean
}

const USA_CENTER = { lat: 39.5, lng: -98.35 }

// ─── Pans + zooms map when a new activity is selected ────────────────────────

function MapController({ center }: { center: { lat: number; lng: number } | null | undefined }) {
  const map = useMap()
  const prevRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!map || !center) return
    if (prevRef.current?.lat === center.lat && prevRef.current?.lng === center.lng) return
    map.panTo(center)
    map.setZoom(14)
    prevRef.current = center
  }, [map, center])

  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlanningMap({
  stops,
  selectedStopId,
  onAddStop,
  onSelectStop,
  disabled = false,
  readOnly = false,
  activities = [],
  selectedActivityId = null,
  onSelectActivity,
  mapCenter,
  activityRoute,
}: PlanningMapProps) {
  const [pendingStop, setPendingStop] = useState<PendingStop | null>(null)

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (disabled || readOnly || !e.detail.latLng) return
    setPendingStop({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng })
  }, [disabled, readOnly])

  const handleSearchSelect = useCallback(
    ({ lat, lng, city, state }: { lat: number; lng: number; city: string; state: string }) => {
      setPendingStop({ lat, lng, city, state, fromSearch: true })
    },
    []
  )

  function handleConfirmStop(city: string, state: string) {
    if (!pendingStop) return
    const newStop: Stop = {
      id: crypto.randomUUID(),
      trip_id: 'local',
      city,
      state,
      lat: pendingStop.lat,
      lng: pendingStop.lng,
      order: stops.length,
      arrival_date: null,
      nights: 1,
      notes: null,
      created_at: new Date().toISOString(),
    }
    onAddStop(newStop)
    setPendingStop(null)
  }

  const pinnedActivities = activities.filter((a) => a.map_lat != null && a.map_lng != null)

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="relative w-full h-full">
        <Map
          defaultCenter={USA_CENTER}
          defaultZoom={4}
          mapTypeId="hybrid"
          onClick={handleMapClick}
          className="w-full h-full"
          gestureHandling="greedy"
          mapTypeControl={true}
          streetViewControl={false}
          fullscreenControl={false}
        >
          {/* Programmatic pan + zoom */}
          <MapController center={mapCenter} />

          {/* Stoppesteder */}
          {stops.map((stop, index) => (
            <StopMarker
              key={stop.id}
              stop={stop}
              index={index}
              isSelected={stop.id === selectedStopId}
              onClick={() => onSelectStop(stop.id)}
            />
          ))}

          {/* Aktivitetsmarkører */}
          {pinnedActivities.map((activity) => (
            <ActivityMarker
              key={activity.id}
              activity={activity}
              isSelected={activity.id === selectedActivityId}
              onClick={onSelectActivity ? () => onSelectActivity(activity.id) : undefined}
            />
          ))}

          {/* Reiserute fra aktivitet til hotell */}
          {activityRoute && (
            <ActivityRoutePolyline
              fromLat={activityRoute.fromLat}
              fromLng={activityRoute.fromLng}
              toAddress={activityRoute.toAddress}
              toLat={activityRoute.toLat}
              toLng={activityRoute.toLng}
            />
          )}

          {/* Midlertidig markør ved klikk */}
          {pendingStop && !pendingStop.fromSearch && (
            <StopMarker
              stop={{
                id: 'pending',
                trip_id: '',
                city: '...',
                state: '',
                lat: pendingStop.lat,
                lng: pendingStop.lng,
                order: -1,
                arrival_date: null,
                nights: 0,
                notes: null,
                created_at: '',
              }}
              index={-1}
              isSelected={false}
              onClick={() => {}}
              isPending
            />
          )}

          {/* Rute mellom stopp */}
          {stops.length >= 2 && <RoutePolyline stops={stops} />}

          {/* Søkeboks */}
          {!readOnly && <MapSearchBox onPlaceSelect={handleSearchSelect} />}
        </Map>

        {/* Popup for å bekrefte nytt stopp */}
        {pendingStop && !readOnly && (
          <AddStopPopup
            lat={pendingStop.lat}
            lng={pendingStop.lng}
            initialCity={pendingStop.city}
            initialState={pendingStop.state}
            fromSearch={pendingStop.fromSearch}
            onConfirm={handleConfirmStop}
            onCancel={() => setPendingStop(null)}
          />
        )}

        {stops.length === 0 && !pendingStop && !disabled && !readOnly && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-full px-5 py-2.5 shadow-lg text-sm text-slate-600 pointer-events-none whitespace-nowrap">
            🔍 Søk etter en by eller klikk på kartet for å starte
          </div>
        )}

        {disabled && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-center">
              <p className="text-slate-600 text-sm font-medium">Velg eller opprett en tur i sidepanelet for å komme i gang</p>
            </div>
          </div>
        )}
      </div>
    </APIProvider>
  )
}
