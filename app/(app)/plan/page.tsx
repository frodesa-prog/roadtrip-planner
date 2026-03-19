'use client'

import { useState, useMemo, useCallback } from 'react'
import { Map, MapPin, FileText } from 'lucide-react'
import PlanSidebar from '@/components/planning/PlanSidebar'
import CityPlanSidebar from '@/components/planning/CityPlanSidebar'
import CityDayPanel from '@/components/planning/CityDayPanel'
import CityMapPinModal from '@/components/planning/CityMapPinModal'
import CityTripOverviewModal from '@/components/planning/CityTripOverviewModal'
import PlanningMap from '@/components/map/PlanningMap'
import StopDetailPanel from '@/components/planning/StopDetailPanel'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities } from '@/hooks/useActivities'
import { useDining } from '@/hooks/useDining'
import { usePossibleActivities } from '@/hooks/usePossibleActivities'
import { useNotes } from '@/hooks/useNotes'
import { useDrivingInfo } from '@/hooks/useDrivingInfo'
import { useRouteWaypoints } from '@/hooks/useRouteWaypoints'
import { Stop } from '@/types'
import type { LegWaypoints } from '@/components/map/RoutePolyline'

export default function PlanPage() {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null)
  const [routeStates, setRouteStates] = useState<string[]>([])
  type MobileView = 'kart' | 'steder' | 'detaljer'
  const [mobileView, setMobileView] = useState<MobileView>('steder')

  // City trip map state
  const [citySearchCenter, setCitySearchCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [cityZoomVersion, setCityZoomVersion] = useState(0)
  const [cityMapPinPending, setCityMapPinPending] = useState<{ lat: number; lng: number } | null>(null)
  const [showCityOverview, setShowCityOverview] = useState(false)
  const [selectedCityActivityId, setSelectedCityActivityId] = useState<string | null>(null)
  const [selectedCityDiningId, setSelectedCityDiningId] = useState<string | null>(null)

  const {
    trips, currentTrip, loading: tripsLoading, userId,
    setCurrentTrip, createTrip, updateTrip, deleteTrip,
  } = useTrips()

  const {
    stops, loading: stopsLoading,
    addStop, removeStop, reorderStops, updateStop,
  } = useStops(currentTrip?.id ?? null)

  const stopIds = useMemo(() => stops.map((s) => s.id), [stops])
  const { hotels, saveHotel } = useHotels(stopIds)
  const { activities, addActivity, removeActivity, updateActivity } = useActivities(stopIds)
  const { dining, addDining, removeDining, updateDining } = useDining(stopIds)
  const { possibleActivities, addPossibleActivity, removePossibleActivity, updatePossibleActivity } = usePossibleActivities(stopIds)
  const { notes, addNote, updateNote, deleteNote } = useNotes(currentTrip?.id ?? null)
  const { legs: routeLegs, loaded: routeLegsLoaded, saveLeg } = useRouteWaypoints(currentTrip?.id ?? null)
  const drivingLegs = useDrivingInfo(stops, routeLegs)

  const handleRouteLegsChange = useCallback(
    (legs: LegWaypoints[]) => {
      for (const leg of legs) {
        saveLeg(leg.fromStopId, leg.toStopId, leg.waypoints)
      }
    },
    [saveLeg]
  )

  // Selected stop + its driving leg
  const selectedStop = stops.find((s) => s.id === selectedStopId) ?? null
  const selectedStopIndex = stops.findIndex((s) => s.id === selectedStopId)
  const selectedStopLeg = selectedStopIndex > 0 ? (drivingLegs[selectedStopIndex - 1] ?? null) : null
  const selectedDate = selectedStop?.arrival_date ?? currentTrip?.date_from ?? ''

  // City trip helpers
  const isCityTrip = !!(currentTrip && currentTrip.trip_type && currentTrip.trip_type !== 'road_trip')
  const cityStop = isCityTrip ? (stops[0] ?? null) : null
  const cityCenter = cityStop ? { lat: cityStop.lat, lng: cityStop.lng } : null

  // City trip: map fit points — day pins when a day is selected, all pins otherwise
  const cityMapFitPoints = useMemo(() => {
    if (!isCityTrip || citySearchCenter) return null

    if (selectedDayStr && cityStop) {
      const pts = [
        ...activities
          .filter((a) => a.stop_id === cityStop.id && a.activity_date === selectedDayStr && a.map_lat != null && a.map_lng != null)
          .map((a) => ({ lat: a.map_lat!, lng: a.map_lng! })),
        ...dining
          .filter((d) => d.stop_id === cityStop.id && d.booking_date === selectedDayStr && d.map_lat != null && d.map_lng != null)
          .map((d) => ({ lat: d.map_lat!, lng: d.map_lng! })),
      ]
      if (pts.length > 0) return pts
      // Day has no pins → fall through to show all
    }

    // Default: all pinned activities + dining across trip
    const all = [
      ...activities.filter((a) => a.map_lat != null && a.map_lng != null).map((a) => ({ lat: a.map_lat!, lng: a.map_lng! })),
      ...dining.filter((d) => d.map_lat != null && d.map_lng != null).map((d) => ({ lat: d.map_lat!, lng: d.map_lng! })),
    ]
    if (all.length > 0) return cityCenter ? [...all, cityCenter] : all
    return cityCenter ? [cityCenter] : null
  }, [isCityTrip, citySearchCenter, selectedDayStr, cityStop, activities, dining, cityCenter])

  // City trip: route from selected activity/dining pin → H-pin (city stop)
  const cityActivityRoute = useMemo(() => {
    if (!isCityTrip || !cityStop) return null
    if (selectedCityActivityId) {
      const act = activities.find((a) => a.id === selectedCityActivityId)
      if (act?.map_lat != null && act?.map_lng != null) {
        return {
          fromLat: act.map_lat,
          fromLng: act.map_lng,
          toAddress: null as string | null,
          toLat: cityStop.lat,
          toLng: cityStop.lng,
        }
      }
    }
    if (selectedCityDiningId) {
      const din = dining.find((d) => d.id === selectedCityDiningId)
      if (din?.map_lat != null && din?.map_lng != null) {
        return {
          fromLat: din.map_lat,
          fromLng: din.map_lng,
          toAddress: null as string | null,
          toLat: cityStop.lat,
          toLng: cityStop.lng,
        }
      }
    }
    return null
  }, [isCityTrip, cityStop, selectedCityActivityId, selectedCityDiningId, activities, dining])

  // Day index for CityDayPanel header
  const dayIndex = selectedDayStr && currentTrip?.date_from
    ? Math.max(0, Math.round(
        (new Date(selectedDayStr + 'T12:00:00').getTime() - new Date(currentTrip.date_from + 'T12:00:00').getTime()) / 86_400_000
      ))
    : 0

  // Day plan note for city trips (stored in notes table with special title)
  const dayPlanNote = (isCityTrip && cityStop && selectedDayStr)
    ? notes.find((n) => n.stop_id === cityStop.id && n.note_date === selectedDayStr && n.title === '__day_plan__')
    : undefined

  const handleSaveDayPlan = useCallback(async (text: string) => {
    if (!cityStop || !selectedDayStr) return
    if (dayPlanNote) {
      updateNote(dayPlanNote.id, { content: text })
    } else {
      addNote({ stop_id: cityStop.id, note_date: selectedDayStr, title: '__day_plan__', content: text })
    }
  }, [cityStop, selectedDayStr, dayPlanNote, updateNote, addNote])

  // Generic save-day-plan for the overview modal (takes explicit dateStr)
  const handleSaveDayPlanForDate = useCallback((dateStr: string, text: string) => {
    if (!cityStop) return
    const existing = notes.find(
      (n) => n.stop_id === cityStop.id && n.note_date === dateStr && n.title === '__day_plan__',
    )
    if (existing) {
      updateNote(existing.id, { content: text })
    } else {
      addNote({ stop_id: cityStop.id, note_date: dateStr, title: '__day_plan__', content: text })
    }
  }, [cityStop, notes, updateNote, addNote])

  function handleAddStop(stop: Stop) {
    if (!currentTrip) return
    addStop({ ...stop, trip_id: currentTrip.id })
  }

  function handleSelectStop(id: string) {
    setSelectedStopId((prev) => (prev === id ? null : id))
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('detaljer')
    }
  }

  function handleSelectDay(day: string | null) {
    setSelectedDayStr(day)
    setCityZoomVersion((v) => v + 1)
    setSelectedCityActivityId(null)
    setSelectedCityDiningId(null)
    if (day && typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('detaljer')
    }
  }

  // Handle map pin confirm (activity or dining with coordinates)
  function handleCityMapPinConfirm(
    type: 'activity' | 'dining',
    name: string,
    time: string,
    date: string | null,
    setAsStartPin: boolean,
  ) {
    if (!cityMapPinPending || !cityStop) return
    const { lat, lng } = cityMapPinPending

    // Only create activity/dining if a name was actually provided
    if (name.trim()) {
      if (type === 'activity') {
        addActivity(cityStop.id, {
          name,
          activity_time: time || undefined,
          activity_date: date || undefined,
          map_lat: lat,
          map_lng: lng,
        })
      } else {
        addDining(cityStop.id, {
          name,
          booking_time: time || undefined,
          booking_date: date || undefined,
          map_lat: lat,
          map_lng: lng,
        })
      }
    }

    if (setAsStartPin) {
      updateStop(cityStop.id, { lat, lng })
    }
    setCityMapPinPending(null)
  }

  // Mobile tab label for detail panel
  const detailTabLabel = isCityTrip
    ? (selectedDayStr ? `Dag ${dayIndex + 1}` : 'Dag')
    : (selectedStop?.city ?? 'Detaljer')
  const showDetailTab = isCityTrip ? !!selectedDayStr : !!selectedStop

  const mobileTabs = [
    { id: 'kart',    label: 'Kart',    icon: Map },
    { id: 'steder',  label: 'Steder',  icon: MapPin },
    ...(showDetailTab ? [{ id: 'detaljer', label: detailTabLabel, icon: FileText }] : []),
  ] as { id: MobileView; label: string; icon: React.ElementType }[]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Mobil tab-bar øverst ── */}
      <div className="md:hidden flex border-b border-slate-800 bg-slate-900 flex-shrink-0">
        {mobileTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMobileView(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              mobileView === id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="truncate max-w-[80px]">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Paneler ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Venstre sidebar – Road trip vs City/Resort */}
        <div className={`${mobileView === 'steder' ? 'flex' : 'hidden'} md:flex h-full`}>
          {!isCityTrip ? (
            <PlanSidebar
              trips={trips}
              currentTrip={currentTrip}
              tripsLoading={tripsLoading}
              userId={userId}
              stops={stops}
              stopsLoading={stopsLoading}
              selectedStopId={selectedStopId}
              hotels={hotels}
              activities={activities}
              onSelectStop={handleSelectStop}
              onRemoveStop={removeStop}
              onReorderStops={reorderStops}
              onUpdateStop={updateStop}
              onSelectTrip={setCurrentTrip}
              onCreateTrip={createTrip}
              onDeleteTrip={deleteTrip}
              routeLegs={routeLegs}
              routeStates={routeStates}
              onUpdateGroupDescription={(desc) =>
                currentTrip && updateTrip(currentTrip.id, { group_description: desc })
              }
              onUpdateTripDates={(dateFrom, dateTo) => {
                if (!currentTrip) return
                const year = new Date(dateFrom + 'T00:00:00').getFullYear()
                updateTrip(currentTrip.id, { date_from: dateFrom, date_to: dateTo, year })
                // Road trip: stopp røres ikke
              }}
            />
          ) : (
            <CityPlanSidebar
              trips={trips}
              currentTrip={currentTrip}
              tripsLoading={tripsLoading}
              userId={userId}
              stop={stops[0] ?? null}
              activities={activities}
              dining={dining}
              possibleActivities={possibleActivities}
              selectedDayStr={selectedDayStr}
              onSelectDay={handleSelectDay}
              onSelectTrip={setCurrentTrip}
              onCreateTrip={createTrip}
              onDeleteTrip={deleteTrip}
              onMoveHotelPin={(lat, lng) => {
                if (stops[0]) updateStop(stops[0].id, { lat, lng })
              }}
              onZoomToCity={() => {
                setCitySearchCenter(null)
                setSelectedDayStr(null)
                setCityZoomVersion((v) => v + 1)
              }}
              onUpdateGroupDescription={(desc) =>
                currentTrip && updateTrip(currentTrip.id, { group_description: desc })
              }
              onUpdateTripDates={(dateFrom, dateTo) => {
                if (!currentTrip) return
                const year = new Date(dateFrom + 'T00:00:00').getFullYear()
                updateTrip(currentTrip.id, { date_from: dateFrom, date_to: dateTo, year })
                // Oppdater også stop (nights) for city/resort-turer
                const nights = Math.max(0, Math.round(
                  (new Date(dateTo + 'T00:00:00').getTime() - new Date(dateFrom + 'T00:00:00').getTime()) / 86_400_000
                ))
                if (stops[0]) updateStop(stops[0].id, { arrival_date: dateFrom, nights })
              }}
              onOpenOverview={() => setShowCityOverview(true)}
            />
          )}
        </div>

        {/* Detaljpanel – Road trip stop */}
        {!isCityTrip && selectedStop && (
          <div className={`
            ${mobileView === 'detaljer' ? 'flex' : 'hidden'} md:flex
            w-full md:w-[370px] flex-shrink-0 h-full border-r border-slate-700/50 overflow-hidden shadow-xl
          `}>
            <StopDetailPanel
              stop={selectedStop}
              hotel={hotels.find((h) => h.stop_id === selectedStop.id) ?? null}
              activities={activities.filter((a) => a.stop_id === selectedStop.id)}
              dining={dining.filter((d) => d.stop_id === selectedStop.id)}
              possibleActivities={possibleActivities.filter((a) => a.stop_id === selectedStop.id)}
              leg={selectedStopLeg}
              selectedDate={selectedDate}
              tripDateFrom={currentTrip?.date_from ?? ''}
              onUpdateStop={(updates) => updateStop(selectedStop.id, updates)}
              onSaveHotel={(updates) => saveHotel(selectedStop.id, updates)}
              onAddActivity={(data) => addActivity(selectedStop.id, data)}
              onRemoveActivity={removeActivity}
              onUpdateActivity={updateActivity}
              onAddDining={(data) => addDining(selectedStop.id, data)}
              onRemoveDining={removeDining}
              onUpdateDining={updateDining}
              onAddPossibleActivity={(data) => addPossibleActivity(selectedStop.id, data)}
              onRemovePossibleActivity={removePossibleActivity}
              onUpdatePossibleActivity={updatePossibleActivity}
              stopNotes={notes.filter((n) => n.stop_id === selectedStop.id)}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onClose={() => { setSelectedStopId(null); setMobileView('steder') }}
            />
          </div>
        )}

        {/* Detaljpanel – City trip day */}
        {isCityTrip && selectedDayStr && cityStop && (
          <div className={`
            ${mobileView === 'detaljer' ? 'flex' : 'hidden'} md:flex
            w-full md:w-[370px] flex-shrink-0 h-full border-r border-slate-700/50 overflow-hidden shadow-xl
          `}>
            <CityDayPanel
              dateStr={selectedDayStr}
              dayIndex={dayIndex}
              activities={activities.filter((a) => a.stop_id === cityStop.id && a.activity_date === selectedDayStr)}
              dining={dining.filter((d) => d.stop_id === cityStop.id && d.booking_date === selectedDayStr)}
              possibleActivities={possibleActivities.filter((a) => a.stop_id === cityStop.id)}
              onAddActivity={(data) => addActivity(cityStop.id, data)}
              onRemoveActivity={removeActivity}
              onUpdateActivity={updateActivity}
              onAddDining={(data) => addDining(cityStop.id, data)}
              onRemoveDining={removeDining}
              onUpdateDining={updateDining}
              onAddPossibleActivity={(data) => addPossibleActivity(cityStop.id, data)}
              onRemovePossibleActivity={removePossibleActivity}
              onUpdatePossibleActivity={updatePossibleActivity}
              dayPlanText={dayPlanNote?.content ?? ''}
              onSaveDayPlan={handleSaveDayPlan}
              selectedActivityId={selectedCityActivityId}
              selectedDiningId={selectedCityDiningId}
              onSelectActivity={(id) => { setSelectedCityActivityId(id); setSelectedCityDiningId(null) }}
              onSelectDining={(id) => { setSelectedCityDiningId(id); setSelectedCityActivityId(null) }}
              onClose={() => { setSelectedDayStr(null); setMobileView('steder') }}
            />
          </div>
        )}

        {/* Kart */}
        <div className={`
          ${mobileView === 'kart' ? 'flex' : 'hidden'} md:flex
          flex-1 relative overflow-hidden
        `}>
          {isCityTrip ? (
            <PlanningMap
              stops={stops}
              selectedStopId={null}
              onAddStop={() => {}}
              onSelectStop={() => {}}
              disabled={!currentTrip}
              readOnly
              hotels={hotels}
              activities={activities}
              dining={dining}
              selectedActivityId={selectedCityActivityId}
              selectedDiningId={selectedCityDiningId}
              onSelectActivity={(id) => { setSelectedCityActivityId((prev) => prev === id ? null : id); setSelectedCityDiningId(null) }}
              onSelectDining={(id) => { setSelectedCityDiningId((prev) => prev === id ? null : id); setSelectedCityActivityId(null) }}
              activityRoute={cityActivityRoute}
              mapCenter={citySearchCenter ?? null}
              mapFitPoints={citySearchCenter ? null : cityMapFitPoints}
              mapForcePanVersion={cityZoomVersion}
              routeLegs={[]}
              routeLegsLoaded
              onRouteLegsChange={() => {}}
              onRouteStatesChange={() => {}}
              onCitySearch={({ lat, lng }) => setCitySearchCenter({ lat, lng })}
              onCityMapClick={(lat, lng) => setCityMapPinPending({ lat, lng })}
              cityTripMode
            />
          ) : (
            <PlanningMap
              stops={stops}
              selectedStopId={selectedStopId}
              onAddStop={handleAddStop}
              onSelectStop={handleSelectStop}
              disabled={!currentTrip}
              hotels={hotels}
              mapCenter={selectedStop ? { lat: selectedStop.lat, lng: selectedStop.lng } : null}
              routeLegs={routeLegs}
              routeLegsLoaded={routeLegsLoaded}
              onRouteLegsChange={handleRouteLegsChange}
              onRouteStatesChange={setRouteStates}
            />
          )}
        </div>
      </div>

      {/* City map pin modal */}
      {cityMapPinPending && (
        <CityMapPinModal
          lat={cityMapPinPending.lat}
          lng={cityMapPinPending.lng}
          defaultDate={selectedDayStr ?? currentTrip?.date_from ?? ''}
          onConfirm={handleCityMapPinConfirm}
          onCancel={() => setCityMapPinPending(null)}
        />
      )}

      {/* City trip overview modal */}
      {showCityOverview && currentTrip && cityStop && (
        <CityTripOverviewModal
          trip={currentTrip}
          activities={activities.filter((a) => a.stop_id === cityStop.id)}
          dining={dining.filter((d) => d.stop_id === cityStop.id)}
          notes={notes}
          stopId={cityStop.id}
          onSelectDay={handleSelectDay}
          onSaveDayPlan={handleSaveDayPlanForDate}
          onClose={() => setShowCityOverview(false)}
        />
      )}
    </div>
  )
}
