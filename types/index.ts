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
  address: string | null
  url: string | null
  status: BookingStatus
  cost: number | null
  remaining_amount: number | null
  confirmation_number: string | null
  parking_cost_per_night: number | null
}

export interface Activity {
  id: string
  stop_id: string
  name: string
  url: string | null
  cost: number | null
  remaining_amount: number | null
  notes: string | null
  activity_date: string | null    // ISO date – which day the activity takes place
  activity_time: string | null    // HH:MM – what time the activity starts
  activity_type: string | null    // e.g. 'baseball' | 'trening' | 'hiking' | 'sightseeing' | 'shopping' | custom
  map_lat: number | null          // pinned location latitude
  map_lng: number | null          // pinned location longitude
  // Baseball-spesifikke felt
  stadium:  string | null
  section:  string | null         // felt / seksjon
  seat_row: string | null         // rad
  seat:     string | null         // sete
}

export interface Dining {
  id: string
  stop_id: string
  name: string
  url: string | null
  booking_date: string | null   // ISO date (YYYY-MM-DD)
  booking_time: string | null   // HH:MM
  map_lat: number | null
  map_lng: number | null
}

export interface PossibleActivity {
  id: string
  stop_id: string
  description: string
  url: string | null
  category: string | null   // same values as Activity.activity_type
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
  remaining_amount: number | null
  notes: string | null
}

export interface Note {
  id: string
  trip_id: string
  stop_id: string | null    // koblet til stopp (null = generelt turnotat)
  note_date: string | null  // ISO dato notatet vises på (null = første dag i stopp)
  title: string | null
  content: string
  created_at: string
  updated_at: string
}

export interface Flight {
  id: string
  trip_id: string
  direction: 'outbound' | 'return'
  flight_date: string | null      // ISO dato (YYYY-MM-DD) for avreisedagen
  // Etappe 1
  leg1_from: string | null        // avreiseflyplass / -by
  leg1_departure: string | null   // HH:MM
  leg1_flight_nr: string | null
  leg1_to: string | null          // mellomstasjon ELLER endelig destinasjon
  leg1_arrival: string | null     // HH:MM
  // Mellomlanding
  has_stopover: boolean
  stopover_duration: string | null
  // Etappe 2 (etter mellomlanding)
  leg2_flight_nr: string | null
  leg2_departure: string | null   // HH:MM
  leg2_to: string | null          // endelig destinasjon
  leg2_arrival: string | null     // HH:MM
}

export interface NoteImage {
  id: string
  note_id: string
  storage_path: string
  created_at: string
  publicUrl: string  // beregnet fra Supabase Storage, lagres ikke i DB
}

export interface RouteLeg {
  id: string
  trip_id: string
  from_stop_id: string
  to_stop_id: string
  waypoints: Array<{ lat: number; lng: number }>
  updated_at: string
}

export interface CarRental {
  id: string
  trip_id: string
  company: string | null          // Leiebilfirma
  car_type: string | null         // Type bil
  reference_nr: string | null     // Referansenr.
  confirmation_nr: string | null  // Bekreftelsesnr.
  url: string | null              // Link til bestilling
  notes: string | null            // Tilleggsinfo
}

export interface Traveler {
  id: string
  trip_id: string
  name: string
  age: number | null
  gender: string | null       // 'mann' | 'kvinne' | 'annet'
  interests: string | null    // kommaseparert liste
  description: string | null
  created_at: string
}

export interface ChatSession {
  id: string
  trip_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatDbMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
