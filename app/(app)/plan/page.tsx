'use client'

import { useState, useMemo, useCallback } from 'react'
import PlanSidebar from '@/components/planning/PlanSidebar'
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

  const {
    trips, currentTrip, loading: tripsLoading,
    setCurrentTrip, createTrip, deleteTrip,
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
  const { notes, updateNote, deleteNote } = useNotes(currentTrip?.id ?? null)
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
  const selectedDate = selectedStop?.arrival_date ?? new Date().toISOString().split('T')[0]

  function handleAddStop(stop: Stop) {
    if (!currentTrip) return
    addStop({ ...stop, trip_id: currentTrip.id })
  }

  function handleSelectStop(id: string) {
    setSelectedStopId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Venstre sidebar */}
      <PlanSidebar
        trips={trips}
        currentTrip={currentTrip}
        tripsLoading={tripsLoading}
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
      />

      {/* Detaljpanel – mellom sidebar og kart */}
      {selectedStop && (
        <div className="w-[300px] flex-shrink-0 h-full border-r border-slate-700/50 overflow-hidden shadow-xl">
          <StopDetailPanel
            stop={selectedStop}
            hotel={hotels.find((h) => h.stop_id === selectedStop.id) ?? null}
            activities={activities.filter((a) => a.stop_id === selectedStop.id)}
            dining={dining.filter((d) => d.stop_id === selectedStop.id)}
            possibleActivities={possibleActivities.filter((a) => a.stop_id === selectedStop.id)}
            leg={selectedStopLeg}
            selectedDate={selectedDate}
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
            onClose={() => setSelectedStopId(null)}
          />
        </div>
      )}

      {/* Høyre: kart */}
      <div className="flex-1 relative overflow-hidden">
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
        />
      </div>
    </div>
  )
}
