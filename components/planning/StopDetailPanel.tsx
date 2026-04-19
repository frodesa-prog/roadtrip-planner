'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X, Calendar, Moon, Hotel, ExternalLink,
  Ticket, Plus, Trash2, MapPin, Car, Pencil, Check, UtensilsCrossed, Clock, Lightbulb, FileText, ArrowRightLeft,
} from 'lucide-react'
import { Stop, Hotel as HotelType, Activity, Dining, PossibleActivity, Note } from '@/types'
import { AddActivityData, UpdateActivityData } from '@/hooks/useActivities'
import { AddDiningData, UpdateDiningData } from '@/hooks/useDining'
import { AddPossibleActivityData, UpdatePossibleActivityData } from '@/hooks/usePossibleActivities'
import { NoteInput } from '@/hooks/useNotes'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LegInfo } from '@/hooks/useDrivingInfo'
import {
  ACTIVITY_TYPE_PRESETS,
  getActivityTypeConfig,
  ActivityTypeIcon,
} from '@/lib/activityTypes'
import ActivityLocationSearch from '@/components/map/ActivityLocationSearch'
import InlineLocationPicker from '@/components/map/InlineLocationPicker'
import NoteModal from '@/components/planning/NoteModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import LocationAutocompleteInput from '@/components/planning/LocationAutocompleteInput'
import AttachmentSection from '@/components/planning/AttachmentSection'
import { useAttachments } from '@/hooks/useAttachments'
import { toast } from 'sonner'

interface StopDetailPanelProps {
  stop: Stop
  hotel: HotelType | null
  activities: Activity[]
  dining: Dining[]
  possibleActivities: PossibleActivity[]
  leg: LegInfo | null
  selectedDate: string
  /** Trip start date – used as fallback default for new activity/dining dates */
  tripDateFrom?: string
  stopIndex?: number
  onUpdateStop: (updates: Partial<Pick<Stop, 'nights' | 'arrival_date' | 'lat' | 'lng' | 'city' | 'state' | 'notes'>>) => void
  onSaveHotel: (updates: Partial<Pick<HotelType, 'name' | 'address' | 'url' | 'status' | 'cost' | 'parking_cost_per_night'>>, lat?: number | null, lng?: number | null) => void
  onAddActivity: (data: AddActivityData) => void
  onRemoveActivity: (id: string) => void
  onUpdateActivity: (id: string, updates: UpdateActivityData) => void
  onAddDining: (data: AddDiningData) => void
  onRemoveDining: (id: string) => void
  onUpdateDining: (id: string, updates: UpdateDiningData) => void
  onAddPossibleActivity: (data: AddPossibleActivityData) => void
  onRemovePossibleActivity: (id: string) => void
  onUpdatePossibleActivity: (id: string, updates: UpdatePossibleActivityData) => void
  selectedActivityId?: string | null
  onSelectActivity?: (id: string | null) => void
  selectedDiningId?: string | null
  onSelectDining?: (id: string | null) => void
  selectedPossibleId?: string | null
  onSelectPossible?: (id: string | null) => void
  stopNotes: Note[]
  onAddNote: (data: NoteInput) => Promise<Note | null>
  onUpdateNote: (id: string, data: Partial<Pick<Note, 'title' | 'content' | 'note_date'>>) => void
  onDeleteNote: (id: string) => void
  onClose: () => void
  /** Shown in the panel header, e.g. "Dag 5 av 30 dager" */
  tripDayLabel?: string
  /** Replaces the nights counter, e.g. "2 av 4 netter" */
  nightOfStayLabel?: string
  /** Hides the arrival-date field (used from summary page) */
  hideArrivalDate?: boolean
  /** Used for address autocomplete – country vs state in place resolution */
  isInternational?: boolean
}

function getStopDates(stop: Stop): string[] {
  if (!stop.arrival_date) return []
  const dates: string[] = []
  // Include arrival through last night + departure day (n <= nights)
  for (let n = 0; n <= stop.nights; n++) {
    const d = new Date(stop.arrival_date + 'T12:00:00')
    d.setDate(d.getDate() + n)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

export default function StopDetailPanel({
  stop, hotel, activities, dining, possibleActivities, stopNotes, leg, selectedDate,
  tripDateFrom = '',
  onUpdateStop, onSaveHotel, onAddActivity, onRemoveActivity, onUpdateActivity,
  onAddDining, onRemoveDining, onUpdateDining,
  onAddPossibleActivity, onRemovePossibleActivity, onUpdatePossibleActivity,
  selectedActivityId = null, onSelectActivity,
  selectedDiningId = null, onSelectDining,
  selectedPossibleId = null, onSelectPossible,
  onAddNote, onUpdateNote, onDeleteNote,
  onClose,
  tripDayLabel,
  nightOfStayLabel,
  hideArrivalDate = false,
  isInternational = false,
}: StopDetailPanelProps) {
  const [hotelName, setHotelName]               = useState(hotel?.name ?? '')
  const [hotelAddress, setHotelAddress]         = useState(hotel?.address ?? '')
  const [hotelUrl, setHotelUrl]                 = useState(hotel?.url ?? '')
  const [hotelCost, setHotelCost]               = useState(hotel?.cost != null ? String(hotel.cost) : '')
  const [hotelParkingCost, setHotelParkingCost] = useState(hotel?.parking_cost_per_night != null ? String(hotel.parking_cost_per_night) : '')
  const [hotelBooked, setHotelBooked]           = useState(hotel?.status === 'confirmed')
  // Compact view when hotel has a name; open edit form when no hotel yet
  const [editingHotel, setEditingHotel] = useState(!(hotel?.name))
  const [nights, setNights]             = useState(stop.nights)
  const [arrivalDate, setArrivalDate]   = useState(stop.arrival_date ?? '')
  const [editingStopName, setEditingStopName] = useState(false)
  const [stopEditResetKey, setStopEditResetKey] = useState(0)
  const [homeNotes, setHomeNotes] = useState(stop.notes ?? '')

  const [showAddActivity, setShowAddActivity] = useState(false)
  const [newActName, setNewActName]         = useState('')
  const [newActUrl, setNewActUrl]           = useState('')
  const [newActCost, setNewActCost]         = useState('')
  const [newActNotes, setNewActNotes]       = useState('')
  const [newActDate, setNewActDate]         = useState(selectedDate || tripDateFrom)
  const [newActTime, setNewActTime]         = useState('')
  const [newActType, setNewActType]         = useState<string | null>(null)
  const [customTypeInput, setCustomTypeInput]   = useState('')
  const [showCustomType, setShowCustomType]     = useState(false)
  const [newActStadium, setNewActStadium]   = useState('')
  const [newActSection, setNewActSection]   = useState('')
  const [newActRow, setNewActRow]           = useState('')
  const [newActSeat, setNewActSeat]         = useState('')

  const [typePickerForId, setTypePickerForId]       = useState<string | null>(null)
  const [pinningActivityId, setPinningActivityId]   = useState<string | null>(null)
  const [editingStopLocation, setEditingStopLocation] = useState(false)

  // Inline location state for new-item forms
  const [newActLocation, setNewActLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [newDiningLocation, setNewDiningLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [newPossibleLocation, setNewPossibleLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)

  // Confirm-dialog state
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null)

  // ── Vedlegg ───────────────────────────────────────────────────────────────
  const attachmentEntityIds = useMemo(() => {
    const ids: string[] = [stop.id]
    if (hotel?.id) ids.push(hotel.id)
    activities.forEach((a) => ids.push(a.id))
    dining.forEach((d) => ids.push(d.id))
    possibleActivities.forEach((p) => ids.push(p.id))
    return ids
  }, [stop.id, hotel?.id, activities, dining, possibleActivities])

  const { byEntityId: attachmentsByEntity, addAttachment, removeAttachment } =
    useAttachments(stop.trip_id, attachmentEntityIds)

  // Inline edit state – activities
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [editActName, setEditActName]       = useState('')
  const [editActUrl, setEditActUrl]         = useState('')
  const [editActCost, setEditActCost]       = useState('')
  const [editActNotes, setEditActNotes]     = useState('')
  const [editActDate, setEditActDate]       = useState('')
  const [editActTime, setEditActTime]       = useState('')
  const [editActStadium, setEditActStadium] = useState('')
  const [editActSection, setEditActSection] = useState('')
  const [editActRow, setEditActRow]         = useState('')
  const [editActSeat, setEditActSeat]       = useState('')

  function startEdit(act: Activity) {
    setEditingActivityId(act.id)
    setEditActName(act.name)
    setEditActUrl(act.url ?? '')
    setEditActCost(act.cost != null ? String(act.cost) : '')
    setEditActNotes(act.notes ?? '')
    setEditActDate(act.activity_date ?? '')
    setEditActTime(act.activity_time ?? '')
    setEditActStadium(act.stadium ?? '')
    setEditActSection(act.section ?? '')
    setEditActRow(act.seat_row ?? '')
    setEditActSeat(act.seat ?? '')
    setTypePickerForId(null)
  }

  function saveEdit() {
    if (!editingActivityId || !editActName.trim()) return
    onUpdateActivity(editingActivityId, {
      name: editActName.trim(),
      url: editActUrl.trim() || null,
      cost: editActCost ? Number(editActCost) : null,
      notes: editActNotes.trim() || null,
      activity_date: editActDate || null,
      activity_time: editActTime || null,
      stadium:  editActStadium.trim() || null,
      section:  editActSection.trim() || null,
      seat_row: editActRow.trim()     || null,
      seat:     editActSeat.trim()    || null,
    })
    setEditingActivityId(null)
  }

  function cancelEdit() { setEditingActivityId(null) }

  // Dining state
  const [showAddDining, setShowAddDining]       = useState(false)
  const [newDiningName, setNewDiningName]       = useState('')
  const [newDiningUrl, setNewDiningUrl]         = useState('')
  const [newDiningNotes, setNewDiningNotes]     = useState('')
  const [newDiningDate, setNewDiningDate]       = useState(selectedDate || tripDateFrom)
  const [newDiningTime, setNewDiningTime]       = useState('')
  const [pinningDiningId, setPinningDiningId]   = useState<string | null>(null)

  // Inline edit state – dining
  const [editingDiningId, setEditingDiningId]   = useState<string | null>(null)
  const [editDiningName, setEditDiningName]     = useState('')
  const [editDiningUrl, setEditDiningUrl]       = useState('')
  const [editDiningNotes, setEditDiningNotes]   = useState('')
  const [editDiningDate, setEditDiningDate]     = useState('')
  const [editDiningTime, setEditDiningTime]     = useState('')

  // Possible activities state
  const [showAddPossible, setShowAddPossible]         = useState(false)
  const [newPossibleDesc, setNewPossibleDesc]         = useState('')
  const [newPossibleUrl, setNewPossibleUrl]           = useState('')
  const [newPossibleNotes, setNewPossibleNotes]       = useState('')
  const [newPossibleCategory, setNewPossibleCategory] = useState<string | null>(null)
  const [newPossibleDates, setNewPossibleDates]       = useState<string[]>(() => {
    const d = selectedDate || stop.arrival_date || ''
    return d ? [d] : []
  })
  const [editingPossibleId, setEditingPossibleId]     = useState<string | null>(null)
  const [editPossibleDesc, setEditPossibleDesc]       = useState('')
  const [editPossibleUrl, setEditPossibleUrl]         = useState('')
  const [editPossibleNotes, setEditPossibleNotes]     = useState('')
  const [editPossibleCategory, setEditPossibleCategory] = useState<string | null>(null)
  const [editPossibleDates, setEditPossibleDates]     = useState<string[]>([])
  const [editPossibleLocation, setEditPossibleLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [pinningPossibleId, setPinningPossibleId]     = useState<string | null>(null)
  const [convertingPossibleId, setConvertingPossibleId] = useState<string | null>(null)

  function startEditPossible(a: PossibleActivity) {
    setEditingPossibleId(a.id)
    setEditPossibleDesc(a.description)
    setEditPossibleUrl(a.url ?? '')
    setEditPossibleNotes(a.notes ?? '')
    setEditPossibleCategory(a.category ?? null)
    setEditPossibleDates(
      a.activity_dates?.length
        ? a.activity_dates
        : a.activity_date
          ? [a.activity_date]
          : []
    )
    setEditPossibleLocation(
      a.map_lat != null && a.map_lng != null
        ? { lat: a.map_lat, lng: a.map_lng, name: a.description }
        : null
    )
  }

  function saveEditPossible() {
    if (!editingPossibleId || !editPossibleDesc.trim()) return
    onUpdatePossibleActivity(editingPossibleId, {
      description: editPossibleDesc.trim(),
      url: editPossibleUrl.trim() || null,
      notes: editPossibleNotes.trim() || null,
      category: editPossibleCategory,
      activity_dates: editPossibleDates,
      activity_date: editPossibleDates[0] ?? null,
      map_lat: editPossibleLocation?.lat ?? null,
      map_lng: editPossibleLocation?.lng ?? null,
    })
    setEditingPossibleId(null)
    setEditPossibleLocation(null)
  }

  function handleAddPossible(e: React.FormEvent) {
    e.preventDefault()
    if (!newPossibleDesc.trim()) return
    onAddPossibleActivity({
      description: newPossibleDesc.trim(),
      url: newPossibleUrl.trim() || undefined,
      notes: newPossibleNotes.trim() || undefined,
      category: newPossibleCategory ?? undefined,
      activity_dates: newPossibleDates,
      activity_date: newPossibleDates[0] ?? undefined,
      map_lat: newPossibleLocation?.lat ?? undefined,
      map_lng: newPossibleLocation?.lng ?? undefined,
    })
    setNewPossibleDesc('')
    setNewPossibleUrl('')
    setNewPossibleNotes('')
    setNewPossibleCategory(null)
    setNewPossibleDates(() => {
      const d = selectedDate || stop.arrival_date || ''
      return d ? [d] : []
    })
    setNewPossibleLocation(null)
    setShowAddPossible(false)
  }

  // Modal state – general notes
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  // Modal state – entity-linked notes (activity / dining / possible)
  const [entityNoteModal, setEntityNoteModal] = useState<{
    entityType: 'activity' | 'dining' | 'possible'
    entityId: string
    entityTitle: string
    note: Note | null
  } | null>(null)

  function startEditDining(d: Dining) {
    setEditingDiningId(d.id)
    setEditDiningName(d.name)
    setEditDiningUrl(d.url ?? '')
    setEditDiningNotes(d.notes ?? '')
    setEditDiningDate(d.booking_date ?? '')
    setEditDiningTime(d.booking_time ?? '')
  }

  function saveEditDining() {
    if (!editingDiningId || !editDiningName.trim()) return
    onUpdateDining(editingDiningId, {
      name: editDiningName.trim(),
      url: editDiningUrl.trim() || null,
      notes: editDiningNotes.trim() || null,
      booking_date: editDiningDate || null,
      booking_time: editDiningTime || null,
    })
    setEditingDiningId(null)
  }

  function handleAddDining(e: React.FormEvent) {
    e.preventDefault()
    if (!newDiningName.trim()) return
    onAddDining({
      name: newDiningName.trim(),
      url: newDiningUrl.trim() || undefined,
      notes: newDiningNotes.trim() || undefined,
      booking_date: newDiningDate || undefined,
      booking_time: newDiningTime.trim() || undefined,
      map_lat: newDiningLocation?.lat ?? undefined,
      map_lng: newDiningLocation?.lng ?? undefined,
    })
    setNewDiningName(''); setNewDiningUrl(''); setNewDiningNotes('')
    setNewDiningDate(selectedDate || tripDateFrom); setNewDiningTime('')
    setNewDiningLocation(null)
    setShowAddDining(false)
  }

  const stopDates = getStopDates(stop)
  const prevHotelId = useRef<string | null>(null)

  useEffect(() => {
    if (hotel) {
      if (hotel.id !== prevHotelId.current) {
        setHotelName(hotel.name ?? '')
        setHotelAddress(hotel.address ?? '')
        setHotelUrl(hotel.url ?? '')
        setHotelCost(hotel.cost != null ? String(hotel.cost) : '')
        setHotelParkingCost(hotel.parking_cost_per_night != null ? String(hotel.parking_cost_per_night) : '')
        setHotelBooked(hotel.status === 'confirmed')
        setEditingHotel(!hotel.name)
        prevHotelId.current = hotel.id
      }
    } else if (prevHotelId.current !== null) {
      // Switched to a stop with no hotel – clear all fields
      setHotelName('')
      setHotelAddress('')
      setHotelUrl('')
      setHotelCost('')
      setHotelParkingCost('')
      setHotelBooked(false)
      setEditingHotel(true)
      prevHotelId.current = null
    }
  }, [hotel])

  useEffect(() => { setNights(stop.nights) }, [stop.nights])
  useEffect(() => { setArrivalDate(stop.arrival_date ?? '') }, [stop.arrival_date])
  useEffect(() => {
    setStopEditResetKey((k) => k + 1)
    setEditingStopName(false)
    setHomeNotes(stop.notes ?? '')
  }, [stop.id])
  useEffect(() => { setNewActDate(selectedDate || tripDateFrom) }, [selectedDate, tripDateFrom])
  useEffect(() => { setNewDiningDate(selectedDate || tripDateFrom) }, [selectedDate, tripDateFrom])

  function handleBookedToggle() {
    const newStatus = hotelBooked ? 'not_booked' : 'confirmed'
    setHotelBooked(!hotelBooked)
    onSaveHotel({ status: newStatus as 'not_booked' | 'confirmed' })
  }

  async function handleSaveHotel() {
    const address = hotelAddress.trim() || null
    const updates: Parameters<typeof onSaveHotel>[0] = {
      name: hotelName.trim(),
      address,
      url: hotelUrl.trim() || null,
      cost: hotelCost ? Number(hotelCost) : null,
      parking_cost_per_night: hotelParkingCost ? Number(hotelParkingCost) : null,
      status: hotelBooked ? 'confirmed' : 'not_booked',
    }

    if (address) {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
        )
        const json = await res.json()
        const loc = json.results?.[0]?.geometry?.location
        if (loc) {
          onSaveHotel(updates, loc.lat, loc.lng)
          toast.success('Hotell lagret · stoppested flyttet til hotellets posisjon')
          setEditingHotel(false)
          return
        }
      } catch {
        // fall through — save without coordinates
      }
    }

    onSaveHotel(updates)
    setEditingHotel(false)
  }

  function handleCancelHotel() {
    setHotelName(hotel?.name ?? '')
    setHotelAddress(hotel?.address ?? '')
    setHotelUrl(hotel?.url ?? '')
    setHotelCost(hotel?.cost != null ? String(hotel.cost) : '')
    setHotelParkingCost(hotel?.parking_cost_per_night != null ? String(hotel.parking_cost_per_night) : '')
    setHotelBooked(hotel?.status === 'confirmed')
    setEditingHotel(!hotel?.name)
  }

  function handleAddActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!newActName.trim()) return
    onAddActivity({
      name: newActName.trim(),
      url: newActUrl.trim() || undefined,
      cost: newActCost ? Number(newActCost) : undefined,
      notes: newActNotes.trim() || undefined,
      activity_date: newActDate || undefined,
      activity_time: newActTime.trim() || undefined,
      activity_type: newActType || undefined,
      stadium:  newActStadium.trim()  || undefined,
      section:  newActSection.trim()  || undefined,
      seat_row: newActRow.trim()      || undefined,
      seat:     newActSeat.trim()     || undefined,
      map_lat:  newActLocation?.lat   ?? undefined,
      map_lng:  newActLocation?.lng   ?? undefined,
    })
    setNewActName(''); setNewActUrl(''); setNewActCost(''); setNewActNotes('')
    setNewActDate(selectedDate || tripDateFrom); setNewActTime('')
    setNewActType(null); setCustomTypeInput(''); setShowCustomType(false); setShowAddActivity(false)
    setNewActStadium(''); setNewActSection(''); setNewActRow(''); setNewActSeat('')
    setNewActLocation(null)
  }

  function handleCancelAddActivity() {
    setShowAddActivity(false)
    setNewActName(''); setNewActUrl(''); setNewActCost(''); setNewActNotes('')
    setNewActDate(selectedDate || tripDateFrom); setNewActTime('')
    setNewActType(null); setCustomTypeInput(''); setShowCustomType(false)
    setNewActStadium(''); setNewActSection(''); setNewActRow(''); setNewActSeat('')
    setNewActLocation(null)
  }

  const pinningDining = pinningDiningId
    ? dining.find((d) => d.id === pinningDiningId) ?? null
    : null

  const totalActivityCost = activities.reduce((s, a) => s + (a.cost ?? 0), 0)
  const sortedActivities = [...activities].sort((a, b) => {
    const dateA = a.activity_date ?? '9999-12-31'
    const dateB = b.activity_date ?? '9999-12-31'
    if (dateA !== dateB) return dateA < dateB ? -1 : 1
    const timeA = a.activity_time ?? '99:99'
    const timeB = b.activity_time ?? '99:99'
    return timeA < timeB ? -1 : timeA > timeB ? 1 : 0
  })
  const dayLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const pinningActivity = pinningActivityId
    ? activities.find((a) => a.id === pinningActivityId) ?? null
    : null

  return (
    <>
      <div className="w-full min-w-0 h-full flex flex-col bg-slate-900 border-l border-slate-800 overflow-x-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {editingStopName ? (
                <div className="mb-0.5">
                  <div className="flex items-center gap-1 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <div className="flex gap-1 flex-1">
                      <div className="flex-1 min-w-0">
                        <LocationAutocompleteInput
                          placeholder={`${stop.city}${stop.state ? `, ${stop.state}` : ''}`}
                          isIntl={isInternational}
                          size="xs"
                          accentColor="blue"
                          resetKey={stopEditResetKey}
                          onSelect={(result) => {
                            if (result) {
                              onUpdateStop({ city: result.city, state: result.state || undefined, lat: result.lat, lng: result.lng })
                              setEditingStopName(false)
                            }
                          }}
                        />
                      </div>
                      <button
                        onClick={() => setEditingStopName(false)}
                        className="px-2 py-0.5 text-slate-400 hover:text-slate-200 text-xs rounded transition-colors flex-shrink-0"
                        title="Avbryt"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <button
                    onClick={() => { setEditingStopName(true); setStopEditResetKey((k) => k + 1) }}
                    className="text-sm font-bold text-slate-100 truncate hover:text-blue-300 transition-colors text-left"
                    title="Klikk for å redigere stedsnavn"
                  >
                    {stop.city}
                    {stop.state && <span className="text-slate-400 font-normal">, {stop.state}</span>}
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500 capitalize ml-5">{dayLabel}</p>
              {tripDayLabel && (
                <p className="text-xs text-blue-400/80 ml-5 mt-0.5 font-medium">{tripDayLabel}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setEditingStopLocation(true)}
                title="Endre kartplassering"
                className="p-1 rounded-md text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
              </button>
              <a
                href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Åpne i Google Maps"
                className="p-1 rounded-md text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button onClick={onClose}
                className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {leg && (
            <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-blue-950/40 border border-blue-800/40 rounded-lg">
              <Car className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-blue-300 font-medium">{leg.durationText} kjøring · {leg.distanceText}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-4">

          {/* ── Beskrivelse (kun startsted / sluttsted) ─────────────────── */}
          {(stop.stop_type === 'home_start' || stop.stop_type === 'home_end') && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {stop.stop_type === 'home_start' ? 'Beskrivelse startsted' : 'Beskrivelse sluttsted'}
              </h3>
              <textarea
                value={homeNotes}
                onChange={(e) => setHomeNotes(e.target.value)}
                onBlur={() => onUpdateStop({ notes: homeNotes.trim() || null })}
                placeholder={stop.stop_type === 'home_start' ? 'F.eks. hjemmefra, Oslo lufthavn…' : 'F.eks. Oslo lufthavn, hjemkomst…'}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </section>
          )}

          {/* ── Opphold + Hotell (ikke for startsted/sluttsted) ─────────── */}
          {stop.stop_type !== 'home_start' && stop.stop_type !== 'home_end' && (<>
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Opphold</h3>
            {(hideArrivalDate && nightOfStayLabel) ? (
              /* Summary-page compact view: just show night-of-stay label */
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <Moon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-200 font-medium">{nightOfStayLabel}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {!hideArrivalDate && (
                  <div>
                    <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3" /> Ankomstdato
                    </label>
                    <Input type="date" value={arrivalDate}
                      onChange={(e) => { setArrivalDate(e.target.value); onUpdateStop({ arrival_date: e.target.value || null }) }}
                      className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <Moon className="w-3 h-3" /> Netter
                  </label>
                  {nightOfStayLabel ? (
                    <div className="h-7 flex items-center px-2 bg-slate-800/50 rounded border border-slate-700/50">
                      <span className="text-xs text-slate-200">{nightOfStayLabel}</span>
                    </div>
                  ) : (
                    <Input type="number" min={1} value={nights}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (!isNaN(val) && val >= 1) { setNights(val); onUpdateStop({ nights: val }) }
                      }}
                      className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100" />
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── Hotell ──────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Hotel className="w-3 h-3" /> Hotell
            </h3>

            {editingHotel ? (
              /* ── Edit / add form ─────────────────────────────────────── */
              <div className="space-y-1.5 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                <Input value={hotelName} onChange={(e) => setHotelName(e.target.value)}
                  placeholder="Hotellnavn" autoFocus
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                <div className="flex gap-1.5">
                  <Input value={hotelAddress} onChange={(e) => setHotelAddress(e.target.value)}
                    placeholder="Adresse"
                    className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                  {hotelAddress.trim() && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelAddress.trim())}`}
                      target="_blank" rel="noopener noreferrer" title="Åpne i Google Maps"
                      className="flex items-center px-2 rounded border border-slate-700 hover:bg-slate-700 transition-colors">
                      <MapPin className="w-3 h-3 text-slate-400" />
                    </a>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Input value={hotelUrl} onChange={(e) => setHotelUrl(e.target.value)}
                    placeholder="https://booking.com/..."
                    className="h-7 text-xs flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                  {hotelUrl && (
                    <a href={hotelUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center px-2 rounded border border-slate-700 hover:bg-slate-700">
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} value={hotelCost} onChange={(e) => setHotelCost(e.target.value)}
                    placeholder="Pris"
                    className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                  <span className="text-xs text-slate-500 flex-shrink-0">kr</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} value={hotelParkingCost} onChange={(e) => setHotelParkingCost(e.target.value)}
                    placeholder="Pris parkering pr. natt"
                    className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                  <span className="text-xs text-slate-500 flex-shrink-0">kr</span>
                </div>
                <button onClick={() => setHotelBooked(!hotelBooked)} className="flex items-center">
                  <Badge variant={hotelBooked ? 'default' : 'secondary'}
                    className={`text-xs cursor-pointer ${
                      hotelBooked
                        ? 'bg-green-900/50 text-green-400 border border-green-700/50 hover:bg-green-900/70'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}>
                    {hotelBooked ? '✓ Bekreftet' : '○ Ikke booket'}
                  </Badge>
                </button>
                <div className="flex gap-1.5 pt-0.5">
                  <button onClick={handleSaveHotel} disabled={!hotelName.trim()}
                    className="flex-1 h-7 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                    <Check className="w-3 h-3" /> Lagre
                  </button>
                  {(hotel?.name || hotelName) && (
                    <button onClick={handleCancelHotel}
                      className="px-3 h-7 rounded border border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                      Avbryt
                    </button>
                  )}
                </div>
              </div>
            ) : hotelName ? (
              /* ── Compact card ────────────────────────────────────────── */
              <>
              <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-800/60 rounded-lg border border-slate-700/50">
                <Hotel className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-200 truncate block">{hotelName}</span>
                  {hotelAddress && (
                    <span className="text-[10px] text-slate-500 truncate block">{hotelAddress}</span>
                  )}
                </div>
                {/* Booking status toggle */}
                <button onClick={handleBookedToggle}
                  title={hotelBooked ? 'Bekreftet – klikk for å endre' : 'Ikke booket – klikk for å bekrefte'}>
                  <Badge variant={hotelBooked ? 'default' : 'secondary'}
                    className={`text-[10px] cursor-pointer px-1.5 ${
                      hotelBooked
                        ? 'bg-green-900/50 text-green-400 border border-green-700/50 hover:bg-green-900/70'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}>
                    {hotelBooked ? '✓' : '○'}
                  </Badge>
                </button>
                {/* Address map link */}
                {hotelAddress.trim() && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelAddress.trim())}`}
                    target="_blank" rel="noopener noreferrer" title="Åpne i Google Maps"
                    className="text-slate-500 hover:text-green-400 flex-shrink-0 transition-colors">
                    <MapPin className="w-3 h-3" />
                  </a>
                )}
                {/* Hotel URL link */}
                {hotelUrl && (
                  <a href={hotelUrl} target="_blank" rel="noopener noreferrer" title="Åpne hotellside"
                    className="text-slate-500 hover:text-green-400 flex-shrink-0 transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {/* Edit */}
                <button onClick={() => setEditingHotel(true)} title="Rediger hotell"
                  className="text-slate-500 hover:text-green-400 flex-shrink-0 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              {hotel?.id && (
                <div className="px-1.5 mt-1">
                  <AttachmentSection
                    entityType="hotel"
                    entityId={hotel.id}
                    attachments={attachmentsByEntity.get(hotel.id) ?? []}
                    onAdd={addAttachment}
                    onRemove={removeAttachment}
                  />
                </div>
              )}
              </>
            ) : (
              /* ── No hotel yet ────────────────────────────────────────── */
              <button onClick={() => setEditingHotel(true)}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-xs transition-colors">
                <Plus className="w-3 h-3" /> Legg til hotell
              </button>
            )}
          </section>
          </>)}

          {/* ── Aktiviteter ─────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Ticket className="w-3 h-3" /> Aktiviteter
                {activities.length > 0 && <span className="text-slate-600 normal-case font-normal">({activities.length})</span>}
              </h3>
              {totalActivityCost > 0 && (
                <span className="text-xs text-slate-500">{totalActivityCost.toLocaleString('nb-NO')} kr</span>
              )}
            </div>

            {activities.length > 0 && (
              <div className="space-y-1 mb-2">
                {sortedActivities.map((act) => {
                  const isPinned = !!(act.map_lat && act.map_lng)
                  const isEditing = editingActivityId === act.id

                  if (isEditing) {
                    return (
                      <div key={act.id} className="bg-slate-800/80 rounded-lg border border-blue-600/40 p-2.5 space-y-1.5">
                        <input
                          value={editActName} onChange={(e) => setEditActName(e.target.value)}
                          placeholder="Aktivitetsnavn"
                          autoFocus
                          className="w-full h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors" />
                        <div className="flex gap-1.5">
                          <input value={editActUrl} onChange={(e) => setEditActUrl(e.target.value)}
                            placeholder="https://..."
                            className="flex-1 h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors" />
                          <input type="number" min={0} value={editActCost} onChange={(e) => setEditActCost(e.target.value)}
                            placeholder="Pris"
                            className="w-20 h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors" />
                          <span className="text-xs text-slate-500 self-center">kr</span>
                        </div>
                        <textarea value={editActNotes} onChange={(e) => setEditActNotes(e.target.value)}
                          placeholder="Kommentar (valgfritt)"
                          rows={2}
                          className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors resize-none" />
                        <div className="flex gap-1.5 items-center">
                          <input type="time" value={editActTime} onChange={(e) => setEditActTime(e.target.value)}
                            className="w-28 h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 outline-none focus:border-blue-500 transition-colors" />
                          <span className="text-[10px] text-slate-500">Klokkeslett</span>
                        </div>
                        {stopDates.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {stopDates.map((d) => (
                              <button key={d} type="button" onClick={() => setEditActDate(d)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                  d === editActDate ? 'bg-blue-700 border-blue-600 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                }`}>
                                {new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Baseball-felt i redigeringsform */}
                        {act.activity_type === 'baseball' && (
                          <div className="space-y-1.5 pt-0.5">
                            <p className="text-[10px] text-orange-400/80">⚾ Baseballdetaljer</p>
                            <input value={editActStadium} onChange={(e) => setEditActStadium(e.target.value)}
                              placeholder="Stadion"
                              className="w-full h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-orange-500 transition-colors" />
                            <div className="grid grid-cols-3 gap-1.5">
                              <input value={editActSection} onChange={(e) => setEditActSection(e.target.value)}
                                placeholder="Felt"
                                className="h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-orange-500 transition-colors" />
                              <input value={editActRow} onChange={(e) => setEditActRow(e.target.value)}
                                placeholder="Rad"
                                className="h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-orange-500 transition-colors" />
                              <input value={editActSeat} onChange={(e) => setEditActSeat(e.target.value)}
                                placeholder="Sete"
                                className="h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-orange-500 transition-colors" />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-1.5">
                          <button onClick={saveEdit} disabled={!editActName.trim()}
                            className="flex-1 h-7 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                            <Check className="w-3 h-3" /> Lagre
                          </button>
                          <button onClick={cancelEdit}
                            className="px-3 h-7 rounded border border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                            Avbryt
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={act.id} className="space-y-1">
                    <div
                      onClick={onSelectActivity ? () => {
                        onSelectActivity(selectedActivityId === act.id ? null : act.id)
                      } : undefined}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border group relative transition-colors ${
                        onSelectActivity ? 'cursor-pointer' : ''
                      } ${
                        selectedActivityId === act.id
                          ? 'bg-blue-500/15 border-blue-500/40'
                          : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80'
                      }`}>
                      {/* Type icon + picker */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setTypePickerForId(typePickerForId === act.id ? null : act.id) }}
                          className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity"
                          title="Endre aktivitetstype">
                          <ActivityTypeIcon type={act.activity_type} size={14} />
                        </button>

                        {typePickerForId === act.id && (
                          <div className="absolute left-0 top-7 z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 min-w-[180px]"
                            onClick={(e) => e.stopPropagation()}>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide px-1 mb-1.5">Type</p>
                            {ACTIVITY_TYPE_PRESETS.map((p) => (
                              <button key={p.value}
                                onClick={() => { onUpdateActivity(act.id, { activity_type: p.value }); setTypePickerForId(null) }}
                                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                                  act.activity_type === p.value ? 'bg-slate-700 text-slate-100' : 'text-slate-300 hover:bg-slate-700/60'
                                }`}>
                                <ActivityTypeIcon type={p.value} size={13} />
                                <span>{p.label}</span>
                              </button>
                            ))}
                            <div className="border-t border-slate-700 my-1.5 pt-1">
                              <CustomTypeInput
                                onSave={(val) => { onUpdateActivity(act.id, { activity_type: val || null }); setTypePickerForId(null) }} />
                              {act.activity_type && (
                                <button
                                  onClick={() => { onUpdateActivity(act.id, { activity_type: null }); setTypePickerForId(null) }}
                                  className="w-full text-left px-2 py-1 text-[10px] text-slate-500 hover:text-red-400 hover:bg-slate-700/60 rounded-lg transition-colors mt-0.5">
                                  ✕ Fjern type
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Name + date + baseball info */}
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs text-slate-200 truncate">{act.name}</span>
                        {(act.activity_date || act.activity_time) && (
                          <span className="text-[10px] text-slate-500">
                            {act.activity_date && new Date(act.activity_date + 'T12:00:00').toLocaleDateString('nb-NO', {
                              weekday: 'short', day: 'numeric', month: 'short',
                            })}
                            {act.activity_time && ` · ${act.activity_time.slice(0, 5)}`}
                          </span>
                        )}
                        {act.activity_type === 'baseball' && (act.stadium || act.section || act.seat_row || act.seat) && (
                          <span className="text-[10px] text-orange-400/70 truncate block">
                            {[
                              act.stadium,
                              act.section  && `Felt ${act.section}`,
                              act.seat_row && `Rad ${act.seat_row}`,
                              act.seat     && `Sete ${act.seat}`,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {act.notes && <p className="text-[10px] text-slate-400 mt-0.5 break-words leading-relaxed">{act.notes}</p>}
                      </div>

                      {/* Action buttons — stop propagation so row click isn't double-fired */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const actNotes = stopNotes.filter((n) => n.activity_id === act.id)
                          return (
                            <button
                              onClick={() => setEntityNoteModal({ entityType: 'activity', entityId: act.id, entityTitle: act.name, note: actNotes[0] ?? null })}
                              title={actNotes.length > 0 ? `${actNotes.length} notat` : 'Legg til notat'}
                              className={`relative transition-colors ${actNotes.length > 0 ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'}`}>
                              <FileText className="w-3 h-3" />
                              {actNotes.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[7px] text-white flex items-center justify-center font-bold leading-none">
                                  {actNotes.length}
                                </span>
                              )}
                            </button>
                          )
                        })()}
                        {act.url && (
                          <a href={act.url} target="_blank" rel="noopener noreferrer"
                            className="text-slate-600 hover:text-blue-400">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button onClick={() => startEdit(act)}
                          title="Rediger aktivitet"
                          className="text-slate-500 hover:text-blue-400 transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setPinningActivityId(act.id)}
                          title={isPinned ? 'Endre kartplassering' : 'Fest på kart'}
                          className={`transition-colors ${isPinned ? 'text-blue-400 hover:text-blue-300' : 'text-slate-500 hover:text-blue-400'}`}>
                          <MapPin className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setConfirm({
                            message: `Slett aktiviteten "${act.name}"?`,
                            action: () => onRemoveActivity(act.id),
                          })}
                          className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="px-1.5" onClick={(e) => e.stopPropagation()}>
                      <AttachmentSection
                        entityType="activity"
                        entityId={act.id}
                        attachments={attachmentsByEntity.get(act.id) ?? []}
                        onAdd={addAttachment}
                        onRemove={removeAttachment}
                      />
                    </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add form */}
            {showAddActivity ? (
              <form onSubmit={handleAddActivity} className="space-y-1.5 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                <Input value={newActName} onChange={(e) => setNewActName(e.target.value)}
                  placeholder="Aktivitetsnavn"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" autoFocus />
                <div className="flex gap-1.5">
                  <Input value={newActUrl} onChange={(e) => setNewActUrl(e.target.value)} placeholder="https://..."
                    className="h-7 text-xs flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                  <Input type="number" min={0} value={newActCost} onChange={(e) => setNewActCost(e.target.value)}
                    placeholder="Pris" className="h-7 text-xs w-20 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                  <span className="text-xs text-slate-500 self-center flex-shrink-0">kr</span>
                </div>

                <textarea value={newActNotes} onChange={(e) => setNewActNotes(e.target.value)}
                  placeholder="Kommentar (valgfritt)"
                  rows={2}
                  className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 placeholder:text-slate-600 outline-none focus:border-blue-500 transition-colors resize-none" />

                <div className="flex items-center gap-1.5">
                  <Input type="time" value={newActTime} onChange={(e) => setNewActTime(e.target.value)}
                    className="h-7 text-xs w-28 bg-slate-800 border-slate-700 text-slate-100" />
                  <span className="text-[10px] text-slate-500">Klokkeslett (valgfritt)</span>
                </div>

                {/* Type selector */}
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Type</p>
                  <div className="flex flex-wrap gap-1">
                    {ACTIVITY_TYPE_PRESETS.map((p) => (
                      <button key={p.value} type="button"
                        onClick={() => { if (newActType === p.value) { setNewActType(null) } else { setNewActType(p.value); setShowCustomType(false); setCustomTypeInput('') } }}
                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          newActType === p.value ? 'bg-purple-700 border-purple-600 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}>
                        <ActivityTypeIcon type={p.value} size={11} />
                        <span>{p.label}</span>
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => { setShowCustomType(!showCustomType); if (!showCustomType) setNewActType(null) }}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        showCustomType ? 'border-slate-600 text-slate-300 bg-slate-700' : 'border-dashed border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                      }`}>
                      + Annen
                    </button>
                  </div>
                  {showCustomType && (
                    <input value={customTypeInput}
                      onChange={(e) => { setCustomTypeInput(e.target.value); setNewActType(e.target.value.trim() || null) }}
                      placeholder="Skriv inn type…"
                      className="mt-1 h-7 text-xs w-full bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-purple-500 transition-colors" />
                  )}
                </div>

                {/* Date picker */}
                {stopDates.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Dato</p>
                    <div className="flex flex-wrap gap-1">
                      {stopDates.map((d) => (
                        <button key={d} type="button" onClick={() => setNewActDate(d)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            d === newActDate ? 'bg-purple-700 border-purple-600 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                          }`}>
                          {new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Baseball-felt */}
                {newActType === 'baseball' && (
                  <div className="space-y-1.5 pt-0.5">
                    <p className="text-[10px] text-orange-400/80">⚾ Baseballdetaljer</p>
                    <input value={newActStadium} onChange={(e) => setNewActStadium(e.target.value)}
                      placeholder="Stadion"
                      className="w-full h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors" />
                    <div className="grid grid-cols-3 gap-1.5">
                      <input value={newActSection} onChange={(e) => setNewActSection(e.target.value)}
                        placeholder="Felt"
                        className="h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors" />
                      <input value={newActRow} onChange={(e) => setNewActRow(e.target.value)}
                        placeholder="Rad"
                        className="h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors" />
                      <input value={newActSeat} onChange={(e) => setNewActSeat(e.target.value)}
                        placeholder="Sete"
                        className="h-7 text-xs bg-slate-800 border border-slate-700 rounded px-2 text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 transition-colors" />
                    </div>
                  </div>
                )}

                <InlineLocationPicker
                  selected={newActLocation}
                  onSelect={(lat, lng, name) => setNewActLocation({ lat, lng, name })}
                  onClear={() => setNewActLocation(null)}
                  accentColor="purple"
                />

                <div className="flex gap-1.5">
                  <button type="submit" disabled={!newActName.trim()}
                    className="flex-1 h-7 rounded-md bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-medium transition-colors">
                    Legg til
                  </button>
                  <button type="button" onClick={handleCancelAddActivity}
                    className="px-3 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                    Avbryt
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowAddActivity(true)}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-xs transition-colors">
                <Plus className="w-3 h-3" /> Legg til aktivitet
              </button>
            )}
          </section>

          {/* ── Spisestedet ──────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <UtensilsCrossed className="w-3 h-3" /> Spisestedet
                {dining.length > 0 && <span className="text-slate-600 normal-case font-normal">({dining.length})</span>}
              </h3>
            </div>

            {dining.length > 0 && (
              <div className="space-y-1 mb-2">
                {dining.map((d) => {
                  const isPinned = !!(d.map_lat && d.map_lng)
                  const isEditing = editingDiningId === d.id

                  if (isEditing) {
                    return (
                      <div key={d.id} className="bg-slate-800/80 rounded-lg border border-red-600/40 p-2.5 space-y-1.5">
                        <input
                          value={editDiningName} onChange={(e) => setEditDiningName(e.target.value)}
                          placeholder="Navn på spisested"
                          autoFocus
                          className="w-full h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-red-500 transition-colors" />
                        <input value={editDiningUrl} onChange={(e) => setEditDiningUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-red-500 transition-colors" />
                        <textarea value={editDiningNotes} onChange={(e) => setEditDiningNotes(e.target.value)}
                          placeholder="Kommentar (valgfritt)"
                          rows={2}
                          className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-red-500 transition-colors resize-none" />
                        <div className="flex gap-1.5 items-center">
                          <input type="time" value={editDiningTime} onChange={(e) => setEditDiningTime(e.target.value)}
                            className="w-28 h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 outline-none focus:border-red-500 transition-colors" />
                          <span className="text-[10px] text-slate-500">Klokkeslett</span>
                        </div>
                        {stopDates.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {stopDates.map((sd) => (
                              <button key={sd} type="button" onClick={() => setEditDiningDate(sd)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                  sd === editDiningDate ? 'bg-red-700 border-red-600 text-white' : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                }`}>
                                {new Date(sd + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <button onClick={saveEditDining} disabled={!editDiningName.trim()}
                            className="flex-1 h-7 rounded bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                            <Check className="w-3 h-3" /> Lagre
                          </button>
                          <button onClick={() => setEditingDiningId(null)}
                            className="px-3 h-7 rounded border border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                            Avbryt
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={d.id} className="space-y-1">
                    <div
                      onClick={onSelectDining ? () => {
                        onSelectDining(selectedDiningId === d.id ? null : d.id)
                      } : undefined}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border group transition-colors ${
                        onSelectDining ? 'cursor-pointer' : ''
                      } ${
                        selectedDiningId === d.id
                          ? 'bg-orange-500/15 border-orange-500/40'
                          : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80'
                      }`}>
                      <span className="text-base flex-shrink-0" style={{ lineHeight: 1 }}>🍽️</span>

                      <div className="flex-1 min-w-0">
                        <span className="block text-xs text-slate-200 truncate">{d.name}</span>
                        {(d.booking_date || d.booking_time) && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {d.booking_date && new Date(d.booking_date + 'T12:00:00').toLocaleDateString('nb-NO', {
                              weekday: 'short', day: 'numeric', month: 'short',
                            })}
                            {d.booking_time && ` · ${d.booking_time.slice(0, 5)}`}
                          </span>
                        )}
                        {d.notes && <p className="text-[10px] text-slate-400 mt-0.5 break-words leading-relaxed">{d.notes}</p>}
                      </div>

                      {/* Action buttons — stop propagation so row click isn't double-fired */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const dinNotes = stopNotes.filter((n) => n.dining_id === d.id)
                          return (
                            <button
                              onClick={() => setEntityNoteModal({ entityType: 'dining', entityId: d.id, entityTitle: d.name, note: dinNotes[0] ?? null })}
                              title={dinNotes.length > 0 ? `${dinNotes.length} notat` : 'Legg til notat'}
                              className={`relative transition-colors ${dinNotes.length > 0 ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'}`}>
                              <FileText className="w-3 h-3" />
                              {dinNotes.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[7px] text-white flex items-center justify-center font-bold leading-none">
                                  {dinNotes.length}
                                </span>
                              )}
                            </button>
                          )
                        })()}
                        {d.url && (
                          <a href={d.url} target="_blank" rel="noopener noreferrer"
                            className="text-slate-600 hover:text-blue-400">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button onClick={() => startEditDining(d)}
                          title="Rediger"
                          className="text-slate-500 hover:text-red-400 transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setPinningDiningId(d.id)}
                          title={isPinned ? 'Endre kartplassering' : 'Fest på kart'}
                          className={`transition-colors ${isPinned ? 'text-red-400 hover:text-red-300' : 'text-slate-500 hover:text-red-400'}`}>
                          <MapPin className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setConfirm({
                            message: `Slett spisestedet "${d.name}"?`,
                            action: () => onRemoveDining(d.id),
                          })}
                          className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="px-1.5" onClick={(e) => e.stopPropagation()}>
                      <AttachmentSection
                        entityType="dining"
                        entityId={d.id}
                        attachments={attachmentsByEntity.get(d.id) ?? []}
                        onAdd={addAttachment}
                        onRemove={removeAttachment}
                      />
                    </div>
                    </div>
                  )
                })}
              </div>
            )}

            {showAddDining ? (
              <form onSubmit={handleAddDining} className="space-y-1.5 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                <Input value={newDiningName} onChange={(e) => setNewDiningName(e.target.value)}
                  placeholder="Navn på spisested"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" autoFocus />
                <Input value={newDiningUrl} onChange={(e) => setNewDiningUrl(e.target.value)} placeholder="https://..."
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                <textarea value={newDiningNotes} onChange={(e) => setNewDiningNotes(e.target.value)}
                  placeholder="Kommentar (valgfritt)"
                  rows={2}
                  className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 placeholder:text-slate-600 outline-none focus:border-red-500 transition-colors resize-none" />
                <div className="flex items-center gap-1.5">
                  <Input type="time" value={newDiningTime} onChange={(e) => setNewDiningTime(e.target.value)}
                    className="h-7 text-xs w-28 bg-slate-800 border-slate-700 text-slate-100" />
                  <span className="text-[10px] text-slate-500">Bookingklokkeslett</span>
                </div>
                {stopDates.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Dato</p>
                    <div className="flex flex-wrap gap-1">
                      {stopDates.map((sd) => (
                        <button key={sd} type="button" onClick={() => setNewDiningDate(sd)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            sd === newDiningDate ? 'bg-red-700 border-red-600 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                          }`}>
                          {new Date(sd + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <InlineLocationPicker
                  selected={newDiningLocation}
                  onSelect={(lat, lng, name) => setNewDiningLocation({ lat, lng, name })}
                  onClear={() => setNewDiningLocation(null)}
                  accentColor="red"
                />

                <div className="flex gap-1.5">
                  <button type="submit" disabled={!newDiningName.trim()}
                    className="flex-1 h-7 rounded-md bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-medium transition-colors">
                    Legg til
                  </button>
                  <button type="button" onClick={() => { setShowAddDining(false); setNewDiningName(''); setNewDiningUrl(''); setNewDiningNotes(''); setNewDiningTime(''); setNewDiningDate(selectedDate || tripDateFrom); setNewDiningLocation(null) }}
                    className="px-3 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                    Avbryt
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowAddDining(true)}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-xs transition-colors">
                <Plus className="w-3 h-3" /> Legg til spisested
              </button>
            )}
          </section>

          {/* ── Mulige aktiviteter ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Mulige aktiviteter
                {possibleActivities.length > 0 && (
                  <span className="text-slate-600 normal-case font-normal">({possibleActivities.length})</span>
                )}
              </h3>
            </div>

            {possibleActivities.length > 0 && (
              <div className="space-y-1 mb-2">
                {possibleActivities.map((a) => {
                  const isEditing = editingPossibleId === a.id
                  if (isEditing) {
                    return (
                      <div key={a.id} className="bg-slate-800/80 rounded-lg border border-teal-600/40 p-2.5 space-y-1.5">
                        <input
                          value={editPossibleDesc}
                          onChange={(e) => setEditPossibleDesc(e.target.value)}
                          placeholder="Beskrivelse"
                          autoFocus
                          className="w-full h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-teal-500 transition-colors"
                        />
                        <input
                          value={editPossibleUrl}
                          onChange={(e) => setEditPossibleUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full h-7 text-xs bg-slate-700 border border-slate-600 rounded px-2 text-slate-100 placeholder:text-slate-500 outline-none focus:border-teal-500 transition-colors"
                        />
                        <textarea value={editPossibleNotes} onChange={(e) => setEditPossibleNotes(e.target.value)}
                          placeholder="Kommentar (valgfritt)"
                          rows={2}
                          className="w-full text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-teal-500 transition-colors resize-none" />
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Kategori</p>
                          <div className="flex flex-wrap gap-1">
                            {ACTIVITY_TYPE_PRESETS.map((p) => (
                              <button key={p.value} type="button"
                                onClick={() => setEditPossibleCategory(editPossibleCategory === p.value ? null : p.value)}
                                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                  editPossibleCategory === p.value
                                    ? 'bg-teal-700 border-teal-600 text-white'
                                    : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                }`}>
                                <ActivityTypeIcon type={p.value} size={11} />
                                <span>{p.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        {stopDates.length > 0 && (
                          <div>
                            <p className="text-[10px] text-slate-500 mb-1">Dag</p>
                            <div className="flex flex-wrap gap-1">
                              {stopDates.map((sd) => (
                                <button key={sd} type="button"
                                  onClick={() => setEditPossibleDates((prev) =>
                                    prev.includes(sd) ? prev.filter((d) => d !== sd) : [...prev, sd]
                                  )}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                    editPossibleDates.includes(sd)
                                      ? 'bg-teal-700 border-teal-600 text-white'
                                      : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                  }`}>
                                  {new Date(sd + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <InlineLocationPicker
                          selected={editPossibleLocation}
                          onSelect={(lat, lng, name) => setEditPossibleLocation({ lat, lng, name })}
                          onClear={() => setEditPossibleLocation(null)}
                          accentColor="teal"
                        />
                        <div className="flex gap-1.5">
                          <button onClick={saveEditPossible} disabled={!editPossibleDesc.trim()}
                            className="flex-1 h-7 rounded bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                            <Check className="w-3 h-3" /> Lagre
                          </button>
                          <button onClick={() => { setEditingPossibleId(null); setEditPossibleLocation(null) }}
                            className="px-3 h-7 rounded border border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                            Avbryt
                          </button>
                        </div>
                      </div>
                    )
                  }
                  const isPossibleSelected = selectedPossibleId === a.id
                  const hasPin = a.map_lat != null && a.map_lng != null
                  return (
                    <div key={a.id}>
                      <div
                        onClick={() => {
                          const newId = isPossibleSelected ? null : a.id
                          onSelectPossible?.(newId)
                        }}
                        className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border group transition-colors cursor-pointer ${
                          isPossibleSelected
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80'
                        }`}>
                        <span className="flex-shrink-0 mt-0.5" style={{ lineHeight: 1 }}>
                          <ActivityTypeIcon type={a.category} size={14} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-slate-200 leading-relaxed break-words block">
                            {a.description}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {a.category && (
                              <span className="text-[10px] text-slate-500">
                                {getActivityTypeConfig(a.category).label}
                              </span>
                            )}
                            {(a.activity_dates?.length
                              ? a.activity_dates
                              : a.activity_date
                                ? [a.activity_date]
                                : []
                            ).map((d) => (
                              <span key={d} className="text-[10px] text-teal-500/80">
                                {new Date(d + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </span>
                            ))}
                          </div>
                          {a.notes && <p className="text-[10px] text-slate-400 mt-0.5 break-words leading-relaxed">{a.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const posNotes = stopNotes.filter((n) => n.possible_activity_id === a.id)
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEntityNoteModal({ entityType: 'possible', entityId: a.id, entityTitle: a.description, note: posNotes[0] ?? null }) }}
                                title={posNotes.length > 0 ? `${posNotes.length} notat` : 'Legg til notat'}
                                className={`relative flex-shrink-0 transition-colors ${posNotes.length > 0 ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'}`}>
                                <FileText className="w-3 h-3" />
                                {posNotes.length > 0 && (
                                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[7px] text-white flex items-center justify-center font-bold leading-none">
                                    {posNotes.length}
                                  </span>
                                )}
                              </button>
                            )
                          })()}
                          {a.url && (
                            <a href={a.url} target="_blank" rel="noopener noreferrer"
                              title={a.url}
                              className="text-slate-600 hover:text-teal-400 transition-colors">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); startEditPossible(a) }} title="Rediger"
                            className="text-slate-500 hover:text-teal-400 flex-shrink-0 transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPinningPossibleId(pinningPossibleId === a.id ? null : a.id); setConvertingPossibleId(null) }}
                            title={hasPin ? 'Endre kartplassering' : 'Fest på kart'}
                            className={`flex-shrink-0 transition-colors ${hasPin ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'}`}>
                            <MapPin className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConvertingPossibleId(convertingPossibleId === a.id ? null : a.id); setPinningPossibleId(null) }}
                            title="Gjør om til aktivitet eller spisested"
                            className={`flex-shrink-0 transition-colors ${convertingPossibleId === a.id ? 'text-blue-400' : 'text-slate-500 hover:text-blue-400'}`}>
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirm({
                              message: `Slett "${a.description}"?`,
                              action: () => onRemovePossibleActivity(a.id),
                            }) }}
                            className="text-slate-500 hover:text-red-400 flex-shrink-0 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {pinningPossibleId === a.id && (
                        <div className="mt-1 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <InlineLocationPicker
                            selected={a.map_lat != null ? { lat: a.map_lat, lng: a.map_lng!, name: a.description } : null}
                            onSelect={(lat, lng) => {
                              onUpdatePossibleActivity(a.id, { map_lat: lat, map_lng: lng })
                              setPinningPossibleId(null)
                            }}
                            onClear={() => {
                              onUpdatePossibleActivity(a.id, { map_lat: null, map_lng: null })
                              setPinningPossibleId(null)
                            }}
                            accentColor="teal"
                          />
                        </div>
                      )}
                      {convertingPossibleId === a.id && (
                        <div className="mt-1 px-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/80 border border-slate-700/50">
                            <span className="text-[10px] text-slate-400 mr-1">Gjør om til:</span>
                            <button
                              onClick={() => {
                                onAddActivity({
                                  name: a.description,
                                  url: a.url ?? undefined,
                                  notes: a.notes ?? undefined,
                                  activity_type: a.category ?? undefined,
                                  activity_date: a.activity_date ?? undefined,
                                  map_lat: a.map_lat ?? undefined,
                                  map_lng: a.map_lng ?? undefined,
                                })
                                onRemovePossibleActivity(a.id)
                                setConvertingPossibleId(null)
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-600/20 border border-violet-600/40 text-violet-300 hover:bg-violet-600/30 text-xs font-medium transition-colors"
                            >
                              <Ticket className="w-3 h-3" />
                              Aktivitet
                            </button>
                            <button
                              onClick={() => {
                                onAddDining({
                                  name: a.description,
                                  url: a.url ?? undefined,
                                  notes: a.notes ?? undefined,
                                  booking_date: a.activity_date ?? undefined,
                                  map_lat: a.map_lat ?? undefined,
                                  map_lng: a.map_lng ?? undefined,
                                })
                                onRemovePossibleActivity(a.id)
                                setConvertingPossibleId(null)
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-600/20 border border-purple-600/40 text-purple-300 hover:bg-purple-600/30 text-xs font-medium transition-colors"
                            >
                              <UtensilsCrossed className="w-3 h-3" />
                              Spisested
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-1 px-2.5" onClick={(e) => e.stopPropagation()}>
                        <AttachmentSection
                          entityType="possible_activity"
                          entityId={a.id}
                          attachments={attachmentsByEntity.get(a.id) ?? []}
                          onAdd={addAttachment}
                          onRemove={removeAttachment}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {showAddPossible ? (
              <form onSubmit={handleAddPossible} className="space-y-1.5 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                <Input
                  value={newPossibleDesc}
                  onChange={(e) => setNewPossibleDesc(e.target.value)}
                  placeholder="Beskrivelse av aktivitet"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                  autoFocus
                />
                <Input
                  value={newPossibleUrl}
                  onChange={(e) => setNewPossibleUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
                <textarea value={newPossibleNotes} onChange={(e) => setNewPossibleNotes(e.target.value)}
                  placeholder="Kommentar (valgfritt)"
                  rows={2}
                  className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 placeholder:text-slate-600 outline-none focus:border-teal-500 transition-colors resize-none" />
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Kategori</p>
                  <div className="flex flex-wrap gap-1">
                    {ACTIVITY_TYPE_PRESETS.map((p) => (
                      <button key={p.value} type="button"
                        onClick={() => setNewPossibleCategory(newPossibleCategory === p.value ? null : p.value)}
                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          newPossibleCategory === p.value
                            ? 'bg-teal-700 border-teal-600 text-white'
                            : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}>
                        <ActivityTypeIcon type={p.value} size={11} />
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {stopDates.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Dag</p>
                    <div className="flex flex-wrap gap-1">
                      {stopDates.map((sd) => (
                        <button key={sd} type="button"
                          onClick={() => setNewPossibleDates((prev) =>
                            prev.includes(sd) ? prev.filter((d) => d !== sd) : [...prev, sd]
                          )}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            newPossibleDates.includes(sd)
                              ? 'bg-teal-700 border-teal-600 text-white'
                              : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                          }`}>
                          {new Date(sd + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <InlineLocationPicker
                  selected={newPossibleLocation}
                  onSelect={(lat, lng, name) => setNewPossibleLocation({ lat, lng, name })}
                  onClear={() => setNewPossibleLocation(null)}
                  accentColor="teal"
                />
                <div className="flex gap-1.5">
                  <button type="submit" disabled={!newPossibleDesc.trim()}
                    className="flex-1 h-7 rounded-md bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-xs font-medium transition-colors">
                    Legg til
                  </button>
                  <button type="button"
                    onClick={() => { setShowAddPossible(false); setNewPossibleDesc(''); setNewPossibleUrl(''); setNewPossibleNotes(''); setNewPossibleCategory(null); setNewPossibleDates(() => { const d = selectedDate || stop.arrival_date || ''; return d ? [d] : [] }); setNewPossibleLocation(null) }}
                    className="px-3 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors">
                    Avbryt
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowAddPossible(true)}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-xs transition-colors">
                <Plus className="w-3 h-3" /> Legg til mulig aktivitet
              </button>
            )}
          </section>

          {/* ── Vedlegg (stoppested) ────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
              <span>📎</span> Vedlegg
            </h3>
            <AttachmentSection
              entityType="stop"
              entityId={stop.id}
              attachments={attachmentsByEntity.get(stop.id) ?? []}
              onAdd={addAttachment}
              onRemove={removeAttachment}
            />
          </section>

          {/* ── Notater ─────────────────────────────────────────────────── */}
          {(() => {
            const generalNotes = stopNotes.filter((n) => !n.activity_id && !n.dining_id && !n.possible_activity_id)
            if (generalNotes.length === 0) return null
            return (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                  <FileText className="w-3 h-3" /> Notater
                  <span className="text-slate-600 normal-case font-normal">({generalNotes.length})</span>
                </h3>
                <div className="space-y-1">
                  {generalNotes.map((note) => (
                    <button key={note.id} type="button" onClick={() => setEditingNote(note)}
                      className="w-full text-left px-2.5 py-2 bg-slate-800/60 rounded-lg border border-slate-700/50 hover:border-amber-700/50 hover:bg-slate-800 transition-colors group">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <FileText className="w-3 h-3 text-slate-500 group-hover:text-amber-500 flex-shrink-0 mt-0.5 transition-colors" />
                        <div className="flex-1 min-w-0">
                          {note.title && (
                            <p className="text-xs font-medium text-slate-200 truncate mb-0.5">
                              {note.title}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
                            {note.content}
                          </p>
                          {note.note_date && (
                            <p className="text-[10px] text-slate-600 mt-1">
                              {new Date(note.note_date + 'T12:00:00').toLocaleDateString('nb-NO', {
                                weekday: 'short', day: 'numeric', month: 'short',
                              })}
                            </p>
                          )}
                        </div>
                        <Pencil className="w-3 h-3 text-slate-600 group-hover:text-amber-500 flex-shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )
          })()}
        </div>
      </div>

      {/* Activity location search modal */}
      {pinningActivity && (
        <ActivityLocationSearch
          activityName={pinningActivity.name}
          onConfirm={(lat, lng) => { onUpdateActivity(pinningActivity.id, { map_lat: lat, map_lng: lng }); setPinningActivityId(null) }}
          onClose={() => setPinningActivityId(null)}
        />
      )}

      {/* Dining location search modal */}
      {pinningDining && (
        <ActivityLocationSearch
          activityName={pinningDining.name}
          onConfirm={(lat, lng) => { onUpdateDining(pinningDining.id, { map_lat: lat, map_lng: lng }); setPinningDiningId(null) }}
          onClose={() => setPinningDiningId(null)}
        />
      )}

      {/* Stop location edit modal */}
      {editingStopLocation && (
        <ActivityLocationSearch
          activityName={`${stop.city}${stop.state ? `, ${stop.state}` : ''}`}
          confirmLabel="Oppdater kartplassering"
          onConfirm={(lat, lng) => { onUpdateStop({ lat, lng }); setEditingStopLocation(false) }}
          onClose={() => setEditingStopLocation(false)}
        />
      )}

      {/* Note modal */}
      {editingNote && (
        <NoteModal
          mode="edit"
          note={editingNote}
          stops={[stop]}
          onSave={(data) => {
            onUpdateNote(editingNote.id, {
              title: data.title,
              content: data.content,
              note_date: data.note_date,
            })
            setEditingNote(null)
          }}
          onDelete={() => {
            onDeleteNote(editingNote.id)
            setEditingNote(null)
          }}
          onClose={() => setEditingNote(null)}
        />
      )}

      {/* Entity note modal (activity / dining / possible) */}
      {entityNoteModal && (
        <NoteModal
          mode={entityNoteModal.note ? 'edit' : 'new'}
          note={entityNoteModal.note ?? undefined}
          stops={[stop]}
          entityTitle={entityNoteModal.entityTitle}
          entityType={entityNoteModal.entityType}
          onSave={async (data) => {
            if (entityNoteModal.note) {
              onUpdateNote(entityNoteModal.note.id, { title: data.title, content: data.content })
            } else {
              await onAddNote({
                title: data.title,
                content: data.content,
                stop_id: stop.id,
                note_date: null,
                activity_id: entityNoteModal.entityType === 'activity' ? entityNoteModal.entityId : null,
                dining_id: entityNoteModal.entityType === 'dining' ? entityNoteModal.entityId : null,
                possible_activity_id: entityNoteModal.entityType === 'possible' ? entityNoteModal.entityId : null,
              })
            }
            setEntityNoteModal(null)
          }}
          onDelete={entityNoteModal.note ? () => {
            onDeleteNote(entityNoteModal.note!.id)
            setEntityNoteModal(null)
          } : undefined}
          onClose={() => setEntityNoteModal(null)}
        />
      )}

      {/* Confirm-dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => { confirm.action(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  )
}

// ─── Inline custom type input ─────────────────────────────────────────────────

function CustomTypeInput({ onSave }: { onSave: (value: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="flex gap-1 px-1 mb-1">
      <input value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) onSave(val.trim()) }}
        placeholder="Skriv inn type…"
        className="flex-1 h-6 text-[10px] bg-slate-700 border border-slate-600 rounded px-1.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-purple-500" />
      <button onClick={() => val.trim() && onSave(val.trim())}
        className="text-[10px] px-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white transition-colors h-6">
        OK
      </button>
    </div>
  )
}
