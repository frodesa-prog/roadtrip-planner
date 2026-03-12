'use client'

import { useState } from 'react'
import PlanSidebar from '@/components/planning/PlanSidebar'
import PlanningMap from '@/components/map/PlanningMap'
import { useTrips } from '@/hooks/useTrips'
import { useStops } from '@/hooks/useStops'
import { useHotels } from '@/hooks/useHotels'
import { useActivities } from '@/hooks/useActivities'
import { Stop } from '@/types'

export default function PlanPage() {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)

  const {
    trips,
    currentTrip,
    loading: tripsLoading,
    setCurrentTrip,
    createTrip,
    deleteTrip,
  } = useTrips()

  const {
    stops,
    loading: stopsLoading,
    addStop,
    removeStop,
    reorderStops,
    updateStop,
  } = useStops(currentTrip?.id ?? null)

  const stopIds = stops.map((s) => s.id)
  const { hotels, saveHotel } = useHotels(stopIds)
  const { activities, addActivity, removeActivity } = useActivities(stopIds)

  function handleAddStop(stop: Stop) {
    if (!currentTrip) return
    addStop({ ...stop, trip_id: currentTrip.id })
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
        onSelectStop={setSelectedStopId}
        onRemoveStop={removeStop}
        onReorderStops={reorderStops}
        onUpdateStop={updateStop}
        onSaveHotel={saveHotel}
        onAddActivity={addActivity}
        onRemoveActivity={removeActivity}
        onSelectTrip={setCurrentTrip}
        onCreateTrip={createTrip}
        onDeleteTrip={deleteTrip}
      />

      {/* Høyre: kart */}
      <div className="flex-1 relative">
        <PlanningMap
          stops={stops}
          selectedStopId={selectedStopId}
          onAddStop={handleAddStop}
          onSelectStop={setSelectedStopId}
          disabled={!currentTrip}
        />
      </div>
    </div>
  )
}
