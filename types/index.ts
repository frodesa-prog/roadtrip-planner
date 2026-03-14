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
}

export interface Activity {
  id: string
  stop_id: string
  name: string
  url: string | null
  cost: number | null
  remaining_amount: number | null
  notes: string | null
  activity_date: string | null   // ISO date – which day the activity takes place
  activity_time: string | null   // HH:MM – what time the activity starts
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
