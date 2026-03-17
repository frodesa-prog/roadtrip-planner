export type TripStatus = 'planning' | 'archived'
export type TripType = 'road_trip' | 'storbytur' | 'resort'
export type BookingStatus = 'not_booked' | 'confirmed'

export interface Trip {
  id: string
  name: string
  year: number
  status: TripStatus
  owner_id: string
  created_at: string
  updated_at: string
  group_description: string | null  // generell beskrivelse av turfølget, brukes av Ferietips-chat
  // Trip type + extended fields (added in migration 024)
  trip_type: TripType
  has_flight: boolean
  has_car_rental: boolean
  date_from: string | null       // ISO date "YYYY-MM-DD"
  date_to: string | null
  destination_city: string | null
  destination_country: string | null
  description: string | null
}

export interface NewTripData {
  name: string
  year: number
  trip_type: TripType
  has_flight: boolean
  has_car_rental: boolean
  date_from: string | null
  date_to: string | null
  destination_city: string | null
  destination_country: string | null
  description: string | null
  city_lat?: number | null
  city_lng?: number | null
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
  category: 'gas' | 'car' | 'flight' | 'hotel' | 'other' | 'transport'
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
  archived_at: string | null
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
  // Billett + sete (etappe 1 / direktefly)
  ticket_class: string | null     // f.eks. 'Economy', 'Premium', 'Business'
  seat_row: string | null         // radnummer
  seat_number: string | null      // setenummer/bokstav
  // Billett + sete etappe 2 (kun mellomlanding)
  leg2_ticket_class: string | null
  leg2_seat_row: string | null
  leg2_seat_number: string | null
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
  gender: string | null          // 'mann' | 'kvinne' | 'annet'
  interests: string | null       // kommaseparert liste (vises som badges i UI)
  description: string | null     // interests_extra – vises som fritekst i UI
  ai_context: string | null      // mat/mobilitet/annet – sendes til AI, vises ikke i UI
  linked_user_id: string | null  // koblet til registrert bruker
  cabin_bags: number | null              // utreise: antall håndbagasjer
  cabin_bag_weight: number | null        // utreise: maks vekt per håndbagasje (kg)
  checked_bags: number | null            // utreise: antall innsjekket bagasje
  checked_bag_weight: number | null      // utreise: maks vekt per innsjekket kolli (kg)
  cabin_bags_home: number | null         // hjemreise: antall håndbagasjer
  cabin_bag_weight_home: number | null   // hjemreise: maks vekt per håndbagasje (kg)
  checked_bags_home: number | null       // hjemreise: antall innsjekket bagasje
  checked_bag_weight_home: number | null // hjemreise: maks vekt per innsjekket kolli (kg)
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

// ── Min Side ───────────────────────────────────────────────────────────────────

export interface UserPreferences {
  id: string
  user_id: string
  interests: string | null        // kommaseparert liste med kategorier
  interests_extra: string | null  // fritekst-tillegg
  food_preferences: string | null
  mobility_notes: string | null
  other_info: string | null
  created_at: string
  updated_at: string
}

export interface UserProfile {
  user_id: string
  display_name: string | null
  email: string
  birth_date: string | null   // ISO date 'YYYY-MM-DD'
  gender: string | null        // 'mann' | 'kvinne' | 'annet'
  created_at: string
  updated_at: string
}

export interface PreferenceAccess {
  id: string
  user_id: string
  granted_to_email: string
  created_at: string
}

export type PackingCategory = 'documents' | 'electronics' | 'clothes' | 'hygiene' | 'handbaggage' | 'other'

export interface DefaultPackingItem {
  id: string
  user_id: string
  item: string
  category: PackingCategory
  created_at: string
}

export type DocumentType = 'passport' | 'drivers_license' | 'insurance' | 'esta' | 'other'

export interface UserDocument {
  id: string
  user_id: string
  name: string
  document_type: DocumentType
  storage_path: string
  file_type: string | null
  created_at: string
  publicUrl?: string  // beregnet fra Supabase Storage
}

export interface TripShare {
  id: string
  trip_id: string
  owner_id: string
  shared_with_email: string
  access_level: 'read' | 'write'
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

export interface TodoItem {
  id: string
  trip_id: string
  description: string
  link: string | null
  responsible: string  // 'felles' eller traveler-id
  completed: boolean
  completed_at: string | null
  sort_order: number
  reminder_date: string | null  // ISO date (YYYY-MM-DD)
  is_critical: boolean
  created_at: string
}

export interface TripPackingItem {
  id: string
  trip_id: string
  traveler_id: string | null  // null = felles
  item: string
  category: PackingCategory
  packed: boolean
  sort_order: number
  created_at: string
}

export type LogType = 'functional' | 'database'

export interface ActivityLogEntry {
  id: string
  user_id: string
  trip_id: string | null
  log_type: LogType
  action: string
  entity_type: string | null
  entity_name: string | null
  details: Record<string, unknown> | null
  created_at: string
}
