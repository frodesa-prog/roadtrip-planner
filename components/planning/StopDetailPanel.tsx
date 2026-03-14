'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, Calendar, Moon, Hotel, ExternalLink,
  Ticket, Plus, Trash2, MapPin, Car
} from 'lucide-react'
import { Stop, Hotel as HotelType, Activity } from '@/types'
import { AddActivityData, UpdateActivityData } from '@/hooks/useActivities'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LegInfo } from '@/hooks/useDrivingInfo'
import {
  ACTIVITY_TYPE_PRESETS,
  getActivityTypeConfig,
  ActivityTypeIcon,
} from '@/lib/activityTypes'
import ActivityLocationSearch from '@/components/map/ActivityLocationSearch'

interface StopDetailPanelProps {
  stop: Stop
  hotel: HotelType | null
  activities: Activity[]
  leg: LegInfo | null
  selectedDate: string
  stopIndex?: number
  onUpdateStop: (updates: Partial<Pick<Stop, 'nights' | 'arrival_date'>>) => void
  onSaveHotel: (updates: Partial<Pick<HotelType, 'name' | 'address' | 'url' | 'status' | 'cost'>>) => void
  onAddActivity: (data: AddActivityData) => void
  onRemoveActivity: (id: string) => void
  onUpdateActivity: (id: string, updates: UpdateActivityData) => void
  onClose: () => void
}

function getStopDates(stop: Stop): string[] {
  if (!stop.arrival_date) return []
  const dates: string[] = []
  for (let n = 0; n < Math.max(1, stop.nights); n++) {
    const d = new Date(stop.arrival_date + 'T12:00:00')
    d.setDate(d.getDate() + n)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

export default function StopDetailPanel({
  stop, hotel, activities, leg, selectedDate,
  onUpdateStop, onSaveHotel, onAddActivity, onRemoveActivity, onUpdateActivity, onClose,
}: StopDetailPanelProps) {
  const [hotelName, setHotelName]       = useState(hotel?.name ?? '')
  const [hotelAddress, setHotelAddress] = useState(hotel?.address ?? '')
  const [hotelUrl, setHotelUrl]         = useState(hotel?.url ?? '')
  const [hotelCost, setHotelCost]       = useState(hotel?.cost != null ? String(hotel.cost) : '')
  const [hotelBooked, setHotelBooked]   = useState(hotel?.status === 'confirmed')
  const [nights, setNights]             = useState(stop.nights)
  const [arrivalDate, setArrivalDate]   = useState(stop.arrival_date ?? '')

  const [showAddActivity, setShowAddActivity] = useState(false)
  const [newActName, setNewActName]     = useState('')
  const [newActUrl, setNewActUrl]       = useState('')
  const [newActCost, setNewActCost]     = useState('')
  const [newActDate, setNewActDate]     = useState(selectedDate)
  const [newActTime, setNewActTime]     = useState('')
  const [newActType, setNewActType]     = useState<string | null>(null)
  const [customTypeInput, setCustomTypeInput] = useState('')
  const [showCustomType, setShowCustomType]   = useState(false)

  const [typePickerForId, setTypePickerForId]     = useState<string | null>(null)
  const [pinningActivityId, setPinningActivityId] = useState<string | null>(null)

  const stopDates = getStopDates(stop)
  const prevHotelId = useRef<string | null>(null)

  useEffect(() => {
    if (hotel && hotel.id !== prevHotelId.current) {
      setHotelName(hotel.name ?? '')
      setHotelAddress(hotel.address ?? '')
      setHotelUrl(hotel.url ?? '')
      setHotelCost(hotel.cost != null ? String(hotel.cost) : '')
      setHotelBooked(hotel.status === 'confirmed')
      prevHotelId.current = hotel.id
    }
  }, [hotel])

  useEffect(() => { setNights(stop.nights) }, [stop.nights])
  useEffect(() => { setArrivalDate(stop.arrival_date ?? '') }, [stop.arrival_date])
  useEffect(() => { setNewActDate(selectedDate) }, [selectedDate])

  function handleBookedToggle() {
    const newStatus = hotelBooked ? 'not_booked' : 'confirmed'
    setHotelBooked(!hotelBooked)
    onSaveHotel({ status: newStatus as 'not_booked' | 'confirmed' })
  }

  function handleAddActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!newActName.trim()) return
    onAddActivity({
      name: newActName.trim(),
      url: newActUrl.trim() || undefined,
      cost: newActCost ? Number(newActCost) : undefined,
      activity_date: newActDate || undefined,
      activity_time: newActTime.trim() || undefined,
      activity_type: newActType || undefined,
    })
    setNewActName(''); setNewActUrl(''); setNewActCost('')
    setNewActDate(selectedDate); setNewActTime('')
    setNewActType(null); setCustomTypeInput(''); setShowCustomType(false); setShowAddActivity(false)
  }

  function handleCancelAddActivity() {
    setShowAddActivity(false)
    setNewActName(''); setNewActUrl(''); setNewActCost('')
    setNewActDate(selectedDate); setNewActTime('')
    setNewActType(null); setCustomTypeInput(''); setShowCustomType(false)
  }

  const totalActivityCost = activities.reduce((s, a) => s + (a.cost ?? 0), 0)
  const dayLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const pinningActivity = pinningActivityId
    ? activities.find((a) => a.id === pinningActivityId) ?? null
    : null

  return (
    <>
      <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <p className="text-sm font-bold text-slate-100 truncate">
                  {stop.city}
                  {stop.state && <span className="text-slate-400 font-normal">, {stop.state}</span>}
                </p>
              </div>
              <p className="text-xs text-slate-500 capitalize ml-5">{dayLabel}</p>
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {leg && (
            <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-blue-950/40 border border-blue-800/40 rounded-lg">
              <Car className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-blue-300 font-medium">{leg.durationText} kjøring · {leg.distanceText}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

          {/* ── Opphold ─────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Opphold</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3" /> Ankomstdato
                </label>
                <Input type="date" value={arrivalDate}
                  onChange={(e) => { setArrivalDate(e.target.value); onUpdateStop({ arrival_date: e.target.value || null }) }}
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <Moon className="w-3 h-3" /> Netter
                </label>
                <Input type="number" min={1} value={nights}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    if (!isNaN(val) && val >= 1) { setNights(val); onUpdateStop({ nights: val }) }
                  }}
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100" />
              </div>
            </div>
          </section>

          {/* ── Hotell ──────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Hotel className="w-3 h-3" /> Hotell
            </h3>
            <div className="space-y-1.5">
              <Input value={hotelName} onChange={(e) => setHotelName(e.target.value)}
                onBlur={() => { if (hotelName.trim() !== (hotel?.name ?? '')) onSaveHotel({ name: hotelName.trim() }) }}
                placeholder="Hotellnavn"
                className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
              <div className="flex gap-1.5">
                <Input value={hotelAddress} onChange={(e) => setHotelAddress(e.target.value)}
                  onBlur={() => { if (hotelAddress !== (hotel?.address ?? '')) onSaveHotel({ address: hotelAddress.trim() || null }) }}
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
                  onBlur={() => { if (hotelUrl !== (hotel?.url ?? '')) onSaveHotel({ url: hotelUrl || null }) }}
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
                  onBlur={() => {
                    const cost = hotelCost ? Number(hotelCost) : null
                    if (cost !== (hotel?.cost ?? null)) onSaveHotel({ cost })
                  }}
                  placeholder="Pris"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" />
                <span className="text-xs text-slate-500 flex-shrink-0">kr</span>
              </div>
              <button onClick={handleBookedToggle} className="flex items-center">
                <Badge variant={hotelBooked ? 'default' : 'secondary'}
                  className={`text-xs cursor-pointer ${
                    hotelBooked
                      ? 'bg-green-900/50 text-green-400 border border-green-700/50 hover:bg-green-900/70'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}>
                  {hotelBooked ? '✓ Bekreftet' : '○ Ikke booket'}
                </Badge>
              </button>
            </div>
          </section>

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
                {activities.map((act) => {
                  const isPinned = !!(act.map_lat && act.map_lng)
                  return (
                    <div key={act.id}
                      className="flex items-center gap-2 px-2.5 py-2 bg-slate-800/60 rounded-lg border border-slate-700/50 group relative">
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

                      {/* Name + date */}
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs text-slate-200 truncate">{act.name}</span>
                        {(act.activity_date || act.activity_time) && (
                          <span className="text-[10px] text-slate-500">
                            {act.activity_date && new Date(act.activity_date + 'T12:00:00').toLocaleDateString('nb-NO', {
                              weekday: 'short', day: 'numeric', month: 'short',
                            })}
                            {act.activity_time && ` · ${act.activity_time}`}
                          </span>
                        )}
                      </div>

                      {act.cost != null && (
                        <span className="text-xs text-slate-500 flex-shrink-0">{act.cost.toLocaleString('nb-NO')} kr</span>
                      )}
                      {act.url && (
                        <a href={act.url} target="_blank" rel="noopener noreferrer"
                          className="text-slate-600 hover:text-blue-400 flex-shrink-0">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Map pin button */}
                      <button
                        onClick={() => setPinningActivityId(act.id)}
                        title={isPinned ? 'Endre kartplassering' : 'Fest på kart'}
                        className={`flex-shrink-0 transition-all ${
                          isPinned ? 'text-blue-400 hover:text-blue-300' : 'text-slate-700 hover:text-blue-400 opacity-0 group-hover:opacity-100'
                        }`}>
                        <MapPin className="w-3 h-3" />
                      </button>

                      {/* Delete */}
                      <button onClick={() => onRemoveActivity(act.id)}
                        className="text-slate-700 hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
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
        </div>
      </div>

      {/* Location search modal */}
      {pinningActivity && (
        <ActivityLocationSearch
          activityName={pinningActivity.name}
          onConfirm={(lat, lng) => { onUpdateActivity(pinningActivity.id, { map_lat: lat, map_lng: lng }); setPinningActivityId(null) }}
          onClose={() => setPinningActivityId(null)}
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
