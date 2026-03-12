export type TripStatus = 'planning' | 'archived'
export type BookingStatus = 'not_booked' | 'confirmed'

export interface Trip {
  id: string
  name: string
  year: number
  status: TripStatus
  owner_id: string
  created_at: string
  updated_at: string
}

export interface Stop {
  id: string
  trip_id: string
  city: string
  state: string
  lat: number
  lng: number
  order: number
  arrival_date: string | null
  nights: number
  notes: string | null
  created_at: string
}

export interface Hotel {
  id: string
  stop_id: string
  name: string
  url: string | null
  status: BookingStatus
  cost: number | null
  confirmation_number: string | null
}

export interface Activity {
  id: string
  stop_id: string
  name: string
  url: string | null
  cost: number | null
  notes: string | null
  activity_date: string | null   // ISO date – which day the activity takes place
}

export interface Photo {
  id: string
  trip_id: string
  stop_id: string | null
  storage_path: string
  lat: number | null
  lng: number | null
  taken_at: string | null
  caption: string | null
}

export interface BudgetItem {
  id: string
  trip_id: string
  category: 'gas' | 'car' | 'flight' | 'hotel' | 'other'
  amount: number
  notes: string | null
}

export interface Note {
  id: string
  trip_id: string
  title: string | null
  content: string
  created_at: string
  updated_at: string
}
