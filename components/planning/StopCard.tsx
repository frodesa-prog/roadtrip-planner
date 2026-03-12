'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Trash2, ChevronUp, ChevronDown,
  Hotel, Calendar, Moon, ChevronRight,
  ExternalLink, Clock, LogOut, Ticket, Plus, X
} from 'lucide-react'
import { Stop, Hotel as HotelType, Activity } from '@/types'
import { AddActivityData } from '@/hooks/useActivities'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LegInfo } from '@/hooks/useDrivingInfo'

interface StopCardProps {
  stop: Stop
  index: number
  totalStops: number
  isSelected: boolean
  legFromPrev?: LegInfo | null
  arrivalTime?: string
  hotel: HotelType | null
  activities: Activity[]
  onDepartureChange?: (time: string) => void
  onSaveHotel: (updates: Partial<Pick<HotelType, 'name' | 'url' | 'status' | 'cost'>>) => void
  onUpdateStop: (updates: Partial<Pick<Stop, 'nights' | 'arrival_date'>>) => void
  onAddActivity: (data: AddActivityData) => void
  onRemoveActivity: (id: string) => void
  onSelect: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export default function StopCard({
  stop,
  index,
  totalStops,
  isSelected,
  legFromPrev,
  arrivalTime,
  hotel,
  activities,
  onDepartureChange,
  onSaveHotel,
  onUpdateStop,
  onAddActivity,
  onRemoveActivity,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StopCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [departureTime, setDepartureTime] = useState('')

  // Hotel local state – synced from prop when it loads from DB
  const [hotelName, setHotelName] = useState(hotel?.name ?? '')
  const [hotelUrl, setHotelUrl] = useState(hotel?.url ?? '')
  const [hotelCost, setHotelCost] = useState(hotel?.cost != null ? String(hotel.cost) : '')
  const [hotelBooked, setHotelBooked] = useState(hotel?.status === 'confirmed')

  // Stop local state
  const [nights, setNights] = useState(stop.nights)
  const [arrivalDate, setArrivalDate] = useState(stop.arrival_date ?? '')

  // Activity add-form state
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [newActName, setNewActName] = useState('')
  const [newActUrl, setNewActUrl] = useState('')
  const [newActCost, setNewActCost] = useState('')

  // Sync hotel state when prop arrives from DB
  const prevHotelId = useRef<string | null>(null)
  useEffect(() => {
    if (hotel && hotel.id !== prevHotelId.current) {
      setHotelName(hotel.name ?? '')
      setHotelUrl(hotel.url ?? '')
      setHotelCost(hotel.cost != null ? String(hotel.cost) : '')
      setHotelBooked(hotel.status === 'confirmed')
      prevHotelId.current = hotel.id
    }
  }, [hotel])

  // Sync stop fields when cascade updates from parent
  useEffect(() => { setNights(stop.nights) }, [stop.nights])
  useEffect(() => { setArrivalDate(stop.arrival_date ?? '') }, [stop.arrival_date])

  function handleDepartureChange(val: string) {
    setDepartureTime(val)
    onDepartureChange?.(val)
  }

  function handleNightsChange(val: number) {
    if (isNaN(val) || val < 1) return
    setNights(val)
    onUpdateStop({ nights: val })
  }

  function handleArrivalDateChange(val: string) {
    setArrivalDate(val)
    onUpdateStop({ arrival_date: val || null })
  }

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
    })
    setNewActName('')
    setNewActUrl('')
    setNewActCost('')
    setShowAddActivity(false)
  }

  const displayDate = arrivalDate
    ? new Date(arrivalDate + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
    : null

  const totalActivityCost = activities.reduce((s, a) => s + (a.cost ?? 0), 0)

  return (
    <div className={`rounded-xl border transition-all duration-150 ${
      isSelected
        ? 'border-blue-500 bg-blue-950/40 shadow-md shadow-blue-900/30'
        : 'border-slate-700 bg-slate-800/80 hover:border-slate-600 hover:bg-slate-800'
    }`}>
      {/* Hoved-rad */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={() => { onSelect(); setExpanded(!expanded) }}
      >
        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
          isSelected ? 'bg-orange-500' : 'bg-blue-600'
        }`}>
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 text-sm truncate">
            {stop.city}
            {stop.state && <span className="text-slate-500 font-normal">, {stop.state}</span>}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {arrivalTime && (
              <span className="text-xs text-blue-400 font-medium">Ankomst {arrivalTime}</span>
            )}
            {departureTime && (
              <span className="text-xs text-slate-500">· Avreise {departureTime}</span>
            )}
            {displayDate && (
              <span className="text-xs text-slate-500">{displayDate}</span>
            )}
            {!arrivalTime && !departureTime && !displayDate && (
              <span className="text-xs text-slate-500">
                {nights} {nights === 1 ? 'natt' : 'netter'}
              </span>
            )}
            {activities.length > 0 && (
              <span className="text-xs text-purple-400">· {activities.length} aktivitet{activities.length !== 1 ? 'er' : ''}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={index === 0}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-20 text-slate-500">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} disabled={index === totalStops - 1}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-20 text-slate-500">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove}
            className="p-1 rounded hover:bg-red-900/30 text-slate-600 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className={`w-3.5 h-3.5 text-slate-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {/* Utvidet seksjon */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 pt-3">

          {/* Tider */}
          <div className="grid grid-cols-2 gap-2">
            {index > 0 && (
              <div>
                <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-blue-400" /> Ankomst
                </label>
                <div className="h-7 px-2 flex items-center bg-blue-950/40 border border-blue-800/50 rounded-md">
                  <span className="text-xs font-medium text-blue-400">
                    {arrivalTime ?? (legFromPrev === null ? '⏳' : '–')}
                  </span>
                </div>
              </div>
            )}
            <div className={index === 0 ? 'col-span-2' : ''}>
              <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <LogOut className="w-3 h-3 text-slate-500" />
                {index === 0 ? 'Avreisetid (start)' : 'Avreise herfra'}
              </label>
              <Input
                type="time"
                value={departureTime}
                onChange={(e) => handleDepartureChange(e.target.value)}
                className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          {/* Dato og netter */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3" /> Ankomstdato
              </label>
              <Input
                type="date"
                value={arrivalDate}
                onChange={(e) => handleArrivalDateChange(e.target.value)}
                className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <Moon className="w-3 h-3" /> Netter
              </label>
              <Input
                type="number"
                min={1}
                value={nights}
                onChange={(e) => handleNightsChange(Number(e.target.value))}
                className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          {/* Hotell */}
          <div>
            <label className="text-xs text-slate-500 flex items-center gap-1 mb-1.5">
              <Hotel className="w-3 h-3" /> Hotell
            </label>
            <div className="space-y-1.5">
              <Input
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                onBlur={() => {
                  if (hotelName.trim() !== (hotel?.name ?? ''))
                    onSaveHotel({ name: hotelName.trim() })
                }}
                placeholder="Hotellnavn"
                className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
              />
              <div className="flex gap-1.5">
                <Input
                  value={hotelUrl}
                  onChange={(e) => setHotelUrl(e.target.value)}
                  onBlur={() => {
                    if (hotelUrl !== (hotel?.url ?? ''))
                      onSaveHotel({ url: hotelUrl || null })
                  }}
                  placeholder="https://booking.com/..."
                  className="h-7 text-xs flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
                {hotelUrl && (
                  <a href={hotelUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center px-2 rounded border border-slate-700 hover:bg-slate-700">
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  value={hotelCost}
                  onChange={(e) => setHotelCost(e.target.value)}
                  onBlur={() => {
                    const cost = hotelCost ? Number(hotelCost) : null
                    if (cost !== (hotel?.cost ?? null)) onSaveHotel({ cost })
                  }}
                  placeholder="Pris"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                />
                <span className="text-xs text-slate-500 flex-shrink-0">kr</span>
              </div>
              <button onClick={handleBookedToggle} className="flex items-center gap-1.5">
                <Badge
                  variant={hotelBooked ? 'default' : 'secondary'}
                  className={`text-xs cursor-pointer ${
                    hotelBooked
                      ? 'bg-green-900/50 text-green-400 border border-green-700/50 hover:bg-green-900/70'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}>
                  {hotelBooked ? '✓ Bekreftet' : '○ Ikke booket'}
                </Badge>
              </button>
            </div>
          </div>

          {/* ── Aktiviteter ───────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-500 flex items-center gap-1">
                <Ticket className="w-3 h-3" /> Aktiviteter
                {activities.length > 0 && (
                  <span className="ml-1 text-slate-600">({activities.length})</span>
                )}
              </label>
              {totalActivityCost > 0 && (
                <span className="text-xs text-slate-500">
                  {totalActivityCost.toLocaleString('nb-NO')} kr
                </span>
              )}
            </div>

            {/* Aktivitetsliste */}
            {activities.length > 0 && (
              <div className="space-y-1 mb-2">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/60 rounded-lg border border-slate-700/50 group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                    <span className="flex-1 text-xs text-slate-200 truncate">{act.name}</span>
                    {act.cost != null && (
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {act.cost.toLocaleString('nb-NO')} kr
                      </span>
                    )}
                    {act.url && (
                      <a
                        href={act.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-blue-400 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => onRemoveActivity(act.id)}
                      className="text-slate-700 hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Legg til aktivitet */}
            {showAddActivity ? (
              <form onSubmit={handleAddActivity} className="space-y-1.5 bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
                <Input
                  value={newActName}
                  onChange={(e) => setNewActName(e.target.value)}
                  placeholder="Aktivitetsnavn (f.eks. Grand Canyon tour)"
                  className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <Input
                    value={newActUrl}
                    onChange={(e) => setNewActUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-7 text-xs flex-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={newActCost}
                    onChange={(e) => setNewActCost(e.target.value)}
                    placeholder="Pris"
                    className="h-7 text-xs w-20 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600"
                  />
                  <span className="text-xs text-slate-500 self-center flex-shrink-0">kr</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={!newActName.trim()}
                    className="flex-1 h-7 rounded-md bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                  >
                    Legg til
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddActivity(false); setNewActName(''); setNewActUrl(''); setNewActCost('') }}
                    className="px-3 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition-colors"
                  >
                    Avbryt
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddActivity(true)}
                className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 text-xs transition-colors"
              >
                <Plus className="w-3 h-3" />
                Legg til aktivitet
              </button>
            )}
          </div>
          {/* ─────────────────────────────────────────────────────────── */}

        </div>
      )}
    </div>
  )
}
