import { Stop, Activity, Dining, PossibleActivity, Flight, Note } from '@/types'
import { LegInfo } from '@/hooks/useDrivingInfo'

interface ExportOptions {
  tripName: string
  stops: Stop[]
  activities: Activity[]
  dining: Dining[]
  possibleActivities: PossibleActivity[]
  outbound: Flight | null
  returnFlight: Flight | null
  notes: Note[]
  hotels: Array<{
    stop_id: string
    name: string
    has_washer: boolean | null
    has_kitchen: boolean | null
    has_breakfast: boolean | null
  }>
  drivingLegs: (LegInfo | null)[]
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function amenityText(hotel: ExportOptions['hotels'][0]): string {
  const amenities: string[] = []
  if (hotel.has_washer)    amenities.push('Vaskemaskin')
  if (hotel.has_kitchen)   amenities.push('Kjøkken')
  if (hotel.has_breakfast) amenities.push('Frokost inkludert')
  return amenities.join(', ')
}

function csvEscape(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes(';')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

function buildRow(fields: string[]): string {
  return fields.map(csvEscape).join(';')
}

export function exportCalendarToExcel(options: ExportOptions) {
  const { tripName, stops, activities, dining, possibleActivities, outbound, returnFlight, notes, hotels, drivingLegs } = options

  const regularStops = stops.filter((s) => s.stop_type === 'stop')
  const dated = regularStops.filter((s) => s.arrival_date)
  if (dated.length === 0) return

  const startDate = new Date(dated[0].arrival_date! + 'T12:00:00')
  const lastStop = dated[dated.length - 1]
  const endDate = new Date(lastStop.arrival_date! + 'T12:00:00')
  endDate.setDate(endDate.getDate() + lastStop.nights)

  // Build lookup maps
  const stopsByDate: Record<string, Stop> = {}
  regularStops.forEach((stop) => {
    if (!stop.arrival_date) return
    for (let n = 0; n < Math.max(1, stop.nights); n++) {
      const d = new Date(stop.arrival_date + 'T12:00:00')
      d.setDate(d.getDate() + n)
      stopsByDate[toISO(d)] = stop
    }
  })

  const activitiesByDate: Record<string, Activity[]> = {}
  activities.forEach((act) => {
    const date = act.activity_date ?? regularStops.find((s) => s.id === act.stop_id)?.arrival_date ?? null
    if (!date) return
    if (!activitiesByDate[date]) activitiesByDate[date] = []
    activitiesByDate[date].push(act)
  })

  const diningByDate: Record<string, Dining[]> = {}
  dining.forEach((d) => {
    const date = d.booking_date ?? regularStops.find((s) => s.id === d.stop_id)?.arrival_date ?? null
    if (!date) return
    if (!diningByDate[date]) diningByDate[date] = []
    diningByDate[date].push(d)
  })

  const possibleByDate: Record<string, PossibleActivity[]> = {}
  possibleActivities.forEach((pa) => {
    const dates: string[] = pa.activity_dates?.length
      ? pa.activity_dates
      : pa.activity_date ? [pa.activity_date] : []
    const resolved = dates.length ? dates : [regularStops.find((s) => s.id === pa.stop_id)?.arrival_date ?? null].filter(Boolean) as string[]
    resolved.forEach((date) => {
      if (!possibleByDate[date]) possibleByDate[date] = []
      possibleByDate[date].push(pa)
    })
  })

  const flightsByDate: Record<string, Flight> = {}
  if (outbound?.flight_date) flightsByDate[outbound.flight_date] = outbound
  if (returnFlight?.flight_date) flightsByDate[returnFlight.flight_date] = returnFlight

  const notesByDate: Record<string, Note[]> = {}
  notes.filter((n) => n.stop_id && !n.activity_id && !n.dining_id && !n.possible_activity_id).forEach((note) => {
    const date = note.note_date ?? regularStops.find((s) => s.id === note.stop_id)?.arrival_date ?? null
    if (!date) return
    if (!notesByDate[date]) notesByDate[date] = []
    notesByDate[date].push(note)
  })

  const hotelByStopId: Record<string, ExportOptions['hotels'][0]> = {}
  hotels.forEach((h) => { hotelByStopId[h.stop_id] = h })

  const arrivalDates = new Set(regularStops.filter((s) => s.arrival_date).map((s) => s.arrival_date!))
  const legByArrivalDate: Record<string, LegInfo | null> = {}
  stops.forEach((stop, i) => {
    if (stop.arrival_date && i > 0) legByArrivalDate[stop.arrival_date] = drivingLegs[i - 1] ?? null
  })

  // ── Build CSV ───────────────────────────────────────────────────────────────
  const headers = ['Dato', 'By', 'Land', 'Kjøring', 'Fly', 'Hotell', 'Aktiviteter', 'Spisesteder', 'Mulige aktiviteter', 'Notater']
  const csvLines: string[] = [buildRow(headers)]

  const cur = new Date(startDate)
  while (toISO(cur) <= toISO(endDate)) {
    const dateStr = toISO(cur)
    const stop = stopsByDate[dateStr] ?? null
    const flight = flightsByDate[dateStr] ?? null
    const dayActivities = activitiesByDate[dateStr] ?? []
    const dayDining = diningByDate[dateStr] ?? []
    const dayPossible = possibleByDate[dateStr] ?? []
    const dayNotes = notesByDate[dateStr] ?? []

    const isArrival = arrivalDates.has(dateStr)
    const leg = isArrival ? (legByArrivalDate[dateStr] ?? null) : null
    const hotel = stop ? hotelByStopId[stop.id] : null

    const driving = leg ? [leg.distanceText, leg.durationText].filter(Boolean).join(' – ') : ''

    let flyStr = ''
    if (flight) {
      const legs: string[] = []
      if (flight.leg1_from && flight.leg1_to) {
        legs.push([flight.leg1_flight_nr, flight.leg1_from, '→', flight.leg1_to, flight.leg1_departure ? `(${flight.leg1_departure})` : ''].filter(Boolean).join(' '))
      }
      if (flight.has_stopover && flight.leg2_to) {
        legs.push([flight.leg2_flight_nr, '→', flight.leg2_to, flight.leg2_departure ? `(${flight.leg2_departure})` : ''].filter(Boolean).join(' '))
      }
      flyStr = legs.join(' | ')
    }

    let hotelStr = ''
    if (hotel) {
      hotelStr = hotel.name
      const a = amenityText(hotel)
      if (a) hotelStr += ` (${a})`
    }

    const aktiviteter = dayActivities
      .sort((a, b) => (a.activity_time ?? '').localeCompare(b.activity_time ?? ''))
      .map((a) => [a.activity_time ? a.activity_time.slice(0, 5) : '', a.name].filter(Boolean).join(' '))
      .join('\n')

    const spiser = dayDining
      .sort((a, b) => (a.booking_time ?? '').localeCompare(b.booking_time ?? ''))
      .map((d) => [d.booking_time ? d.booking_time.slice(0, 5) : '', d.name].filter(Boolean).join(' '))
      .join('\n')

    const mulige = dayPossible.map((p) => p.description).join('\n')

    const notater = dayNotes
      .map((n) => (n.content ?? '').replace(/<[^>]*>/g, '').trim())
      .filter(Boolean)
      .join('\n')

    csvLines.push(buildRow([
      formatDate(dateStr),
      stop?.city ?? '',
      stop?.state ?? '',
      driving,
      flyStr,
      hotelStr,
      aktiviteter,
      spiser,
      mulige,
      notater,
    ]))

    cur.setDate(cur.getDate() + 1)
  }

  // BOM for Excel to detect UTF-8
  const bom = '﻿'
  const csvContent = bom + csvLines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tripName.replace(/[^a-zA-ZæøåÆØÅ0-9 ]/g, '').trim() || 'Reise'}_reiseplan.csv`
  a.click()
  URL.revokeObjectURL(url)
}
