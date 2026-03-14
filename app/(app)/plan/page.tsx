'use client'

import { useState, useMemo } from 'react'
import PlanSidebar from '@/components/planning/PlanSidebar'
import PlanningMap from '@/components/map/PlanningMap'
import StopDetailPanel from '@/components/planning/StopDetailPanel'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities } from '@/hooks/useActivities'
import { useDrivingInfo } from '@/hooks/useDrivingInfo'
import { Stop } from '@/types'

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
  const drivingLegs = useDrivingInfo(stops)

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
      />

      {/* Detaljpanel – mellom sidebar og kart */}
      {selectedStop && (
        <div className="w-[300px] flex-shrink-0 h-full border-r border-slate-700/50 overflow-hidden shadow-xl">
          <StopDetailPanel
            stop={selectedStop}
            hotel={hotels.find((h) => h.stop_id === selectedStop.id) ?? null}
            activities={activities.filter((a) => a.stop_id === selectedStop.id)}
            leg={selectedStopLeg}
            selectedDate={selectedDate}
            onUpdateStop={(updates) => updateStop(selectedStop.id, updates)}
            onSaveHotel={(updates) => saveHotel(selectedStop.id, updates)}
            onAddActivity={(data) => addActivity(selectedStop.id, data)}
            onRemoveActivity={removeActivity}
            onUpdateActivity={updateActivity}
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
        />
      </div>
    </div>
  )
}
