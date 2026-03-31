/** Flyplassdata – by, navn, IATA-kode og tidsforskjell fra Norge (timer). */
export interface Airport {
  city: string
  name: string
  code: string
  /** Timer foran (+) eller bak (−) norsk tid. 0 = samme sone som Norge. */
  offsetFromNorway: number
}

export const AIRPORTS: Airport[] = [
  // ── USA – Eastern (UTC-5 / -4 DST → −6 / −5 fra Norge UTC+1) ─────────────
  { city: 'New York',        name: 'John F. Kennedy International', code: 'JFK', offsetFromNorway: -6 },
  { city: 'New York',        name: 'Newark Liberty International',  code: 'EWR', offsetFromNorway: -6 },
  { city: 'New York',        name: 'LaGuardia Airport',             code: 'LGA', offsetFromNorway: -6 },
  { city: 'Atlanta',         name: 'Hartsfield–Jackson Atlanta',    code: 'ATL', offsetFromNorway: -6 },
  { city: 'Miami',           name: 'Miami International',           code: 'MIA', offsetFromNorway: -6 },
  { city: 'Fort Lauderdale', name: 'Fort Lauderdale-Hollywood Intl', code: 'FLL', offsetFromNorway: -6 },
  { city: 'Orlando',         name: 'Orlando International',         code: 'MCO', offsetFromNorway: -6 },
  { city: 'Washington D.C.', name: 'Dulles International',          code: 'IAD', offsetFromNorway: -6 },
  { city: 'Washington D.C.', name: 'Ronald Reagan National',        code: 'DCA', offsetFromNorway: -6 },
  { city: 'Boston',          name: 'Logan International',           code: 'BOS', offsetFromNorway: -6 },
  // ── USA – Central ────────────────────────────────────────────────────────
  { city: 'Chicago',         name: "O'Hare International",          code: 'ORD', offsetFromNorway: -7 },
  { city: 'Dallas',          name: 'Dallas/Fort Worth International',code: 'DFW', offsetFromNorway: -7 },
  { city: 'Houston',         name: 'George Bush Intercontinental',  code: 'IAH', offsetFromNorway: -7 },
  { city: 'Minneapolis',     name: 'Minneapolis–Saint Paul',        code: 'MSP', offsetFromNorway: -7 },
  { city: 'New Orleans',     name: 'Louis Armstrong New Orleans',   code: 'MSY', offsetFromNorway: -7 },
  // ── USA – Mountain ───────────────────────────────────────────────────────
  { city: 'Denver',          name: 'Denver International',          code: 'DEN', offsetFromNorway: -8 },
  // ── USA – Pacific ────────────────────────────────────────────────────────
  { city: 'Los Angeles',     name: 'Los Angeles International',     code: 'LAX', offsetFromNorway: -9 },
  { city: 'San Francisco',   name: 'San Francisco International',   code: 'SFO', offsetFromNorway: -9 },
  { city: 'Seattle',         name: 'Seattle–Tacoma International',  code: 'SEA', offsetFromNorway: -9 },
  { city: 'Las Vegas',       name: 'Harry Reid International',      code: 'LAS', offsetFromNorway: -9 },
  { city: 'Phoenix',         name: 'Phoenix Sky Harbor',            code: 'PHX', offsetFromNorway: -9 },
  { city: 'San Diego',       name: 'San Diego International',       code: 'SAN', offsetFromNorway: -9 },
  // ── USA – Alaska / Hawaii ─────────────────────────────────────────────────
  { city: 'Anchorage',       name: 'Ted Stevens Anchorage',         code: 'ANC', offsetFromNorway: -10 },
  { city: 'Honolulu',        name: 'Daniel K. Inouye International',code: 'HNL', offsetFromNorway: -11 },
  // ── Europa ───────────────────────────────────────────────────────────────
  { city: 'London',          name: 'Heathrow',                      code: 'LHR', offsetFromNorway: -1 },
  { city: 'London',          name: 'Gatwick',                       code: 'LGW', offsetFromNorway: -1 },
  { city: 'Manchester',      name: 'Manchester Airport',            code: 'MAN', offsetFromNorway: -1 },
  { city: 'Dublin',          name: 'Dublin Airport',                code: 'DUB', offsetFromNorway: -1 },
  { city: 'Lisboa',          name: 'Humberto Delgado',              code: 'LIS', offsetFromNorway: -1 },
  { city: 'Paris',           name: 'Charles de Gaulle',             code: 'CDG', offsetFromNorway: 0 },
  { city: 'Paris',           name: 'Orly',                          code: 'ORY', offsetFromNorway: 0 },
  { city: 'Amsterdam',       name: 'Schiphol',                      code: 'AMS', offsetFromNorway: 0 },
  { city: 'Madrid',          name: 'Madrid–Barajas',                code: 'MAD', offsetFromNorway: 0 },
  { city: 'Frankfurt',       name: 'Frankfurt Airport',             code: 'FRA', offsetFromNorway: 0 },
  { city: 'Barcelona',       name: 'Barcelona–El Prat',             code: 'BCN', offsetFromNorway: 0 },
  { city: 'Roma',            name: 'Fiumicino',                     code: 'FCO', offsetFromNorway: 0 },
  { city: 'München',         name: 'Munich Airport',                code: 'MUC', offsetFromNorway: 0 },
  { city: 'Zürich',          name: 'Zurich Airport',                code: 'ZRH', offsetFromNorway: 0 },
  { city: 'Wien',            name: 'Vienna Airport',                code: 'VIE', offsetFromNorway: 0 },
  { city: 'København',       name: 'Kastrup',                       code: 'CPH', offsetFromNorway: 0 },
  { city: 'Palma',           name: 'Son Sant Joan',                 code: 'PMI', offsetFromNorway: 0 },
  { city: 'Athen',           name: 'Eleftherios Venizelos',         code: 'ATH', offsetFromNorway: 1 },
  { city: 'Chania',          name: 'Ioannis Daskalogiannis',        code: 'CHQ', offsetFromNorway: 1 },
  { city: 'Istanbul',        name: 'Istanbul Airport',              code: 'IST', offsetFromNorway: 2 },
  { city: 'Moskva',          name: 'Sheremetyevo',                  code: 'SVO', offsetFromNorway: 2 },
  // ── Midtøsten ─────────────────────────────────────────────────────────────
  { city: 'Dubai',           name: 'Dubai International',           code: 'DXB', offsetFromNorway: 3 },
  { city: 'Doha',            name: 'Hamad International',           code: 'DOH', offsetFromNorway: 2 },
  { city: 'Jeddah',          name: 'King Abdulaziz',                code: 'JED', offsetFromNorway: 2 },
  // ── Asia ─────────────────────────────────────────────────────────────────
  { city: 'Delhi',           name: 'Indira Gandhi',                 code: 'DEL', offsetFromNorway: 5 },
  { city: 'Mumbai',          name: 'Chhatrapati Shivaji Maharaj',   code: 'BOM', offsetFromNorway: 5 },
  { city: 'Bangkok',         name: 'Suvarnabhumi',                  code: 'BKK', offsetFromNorway: 6 },
  { city: 'Jakarta',         name: 'Soekarno–Hatta',               code: 'CGK', offsetFromNorway: 6 },
  { city: 'Singapore',       name: 'Changi Airport',                code: 'SIN', offsetFromNorway: 7 },
  { city: 'Kuala Lumpur',    name: 'KL International',              code: 'KUL', offsetFromNorway: 7 },
  { city: 'Hong Kong',       name: 'Hong Kong International',       code: 'HKG', offsetFromNorway: 7 },
  { city: 'Shanghai',        name: 'Pudong International',          code: 'PVG', offsetFromNorway: 7 },
  { city: 'Guangzhou',       name: 'Baiyun International',          code: 'CAN', offsetFromNorway: 7 },
  { city: 'Beijing',         name: 'Capital International',         code: 'PEK', offsetFromNorway: 7 },
  { city: 'Shenzhen',        name: "Bao'an International",          code: 'SZX', offsetFromNorway: 7 },
  { city: 'Chengdu',         name: 'Tianfu International',          code: 'TFU', offsetFromNorway: 7 },
  { city: 'Chongqing',       name: 'Jiangbei International',        code: 'CKG', offsetFromNorway: 7 },
  { city: 'Kunming',         name: 'Changshui International',       code: 'KMG', offsetFromNorway: 7 },
  { city: 'Manila',          name: 'Ninoy Aquino',                  code: 'MNL', offsetFromNorway: 7 },
  { city: 'Seoul',           name: 'Incheon International',         code: 'ICN', offsetFromNorway: 8 },
  { city: 'Tokyo',           name: 'Haneda',                        code: 'HND', offsetFromNorway: 8 },
  // ── Norge ────────────────────────────────────────────────────────────────
  { city: 'Oslo',            name: 'Oslo Lufthavn, Gardermoen',     code: 'OSL', offsetFromNorway: 0 },
  { city: 'Bergen',          name: 'Bergen lufthavn, Flesland',     code: 'BGO', offsetFromNorway: 0 },
  { city: 'Trondheim',       name: 'Trondheim lufthavn, Værnes',    code: 'TRD', offsetFromNorway: 0 },
  { city: 'Stavanger',       name: 'Stavanger lufthavn, Sola',      code: 'SVG', offsetFromNorway: 0 },
  { city: 'Tromsø',          name: 'Tromsø lufthavn, Langnes',      code: 'TOS', offsetFromNorway: 0 },
  { city: 'Bodø',            name: 'Bodø lufthavn',                 code: 'BOO', offsetFromNorway: 0 },
  { city: 'Ålesund',         name: 'Ålesund lufthavn, Vigra',       code: 'AES', offsetFromNorway: 0 },
  { city: 'Sandefjord',      name: 'Sandefjord lufthavn, Torp',     code: 'TRF', offsetFromNorway: 0 },
  { city: 'Haugesund',       name: 'Haugesund lufthavn, Karmøy',    code: 'HAU', offsetFromNorway: 0 },
  { city: 'Harstad/Narvik',  name: 'Harstad/Narvik lufthavn, Evenes', code: 'EVE', offsetFromNorway: 0 },
  { city: 'Kristiansand',    name: 'Kristiansand lufthavn, Kjevik', code: 'KRS', offsetFromNorway: 0 },
  { city: 'Molde',           name: 'Molde lufthavn, Årø',           code: 'MOL', offsetFromNorway: 0 },
  { city: 'Alta',            name: 'Alta lufthavn',                 code: 'ALF', offsetFromNorway: 0 },
  { city: 'Kirkenes',        name: 'Kirkenes lufthavn, Høybuktmoen',code: 'KKN', offsetFromNorway: 0 },
  { city: 'Bardufoss',       name: 'Bardufoss lufthavn',            code: 'BDU', offsetFromNorway: 0 },
  { city: 'Kristiansund',    name: 'Kristiansund lufthavn, Kvernberget', code: 'KSU', offsetFromNorway: 0 },
  { city: 'Hammerfest',      name: 'Hammerfest lufthavn',           code: 'HFT', offsetFromNorway: 0 },
  { city: 'Florø',           name: 'Florø lufthavn',                code: 'FRO', offsetFromNorway: 0 },
  { city: 'Svalbard',        name: 'Svalbard lufthavn, Longyear',   code: 'LYR', offsetFromNorway: 0 },
  { city: 'Lakselv',         name: 'Lakselv lufthavn, Banak',       code: 'LKL', offsetFromNorway: 0 },
  // ── Sverige ───────────────────────────────────────────────────────────────
  { city: 'Stockholm',       name: 'Arlanda Airport',               code: 'ARN', offsetFromNorway: 0 },
  { city: 'Stockholm',       name: 'Bromma Airport',                code: 'BMA', offsetFromNorway: 0 },
  { city: 'Gøteborg',        name: 'Landvetter Airport',            code: 'GOT', offsetFromNorway: 0 },
  { city: 'Malmø',           name: 'Malmö Airport',                 code: 'MMX', offsetFromNorway: 0 },
  { city: 'Luleå',           name: 'Luleå Airport',                 code: 'LLA', offsetFromNorway: 0 },
  { city: 'Umeå',            name: 'Umeå Airport',                  code: 'UME', offsetFromNorway: 0 },
  { city: 'Ängelholm',       name: 'Ängelholm–Helsingborg Airport', code: 'AGH', offsetFromNorway: 0 },
  { city: 'Åre/Östersund',   name: 'Åre Östersund Airport',        code: 'OSD', offsetFromNorway: 0 },
  { city: 'Visby',           name: 'Visby Airport',                 code: 'VBY', offsetFromNorway: 0 },
  { city: 'Skellefteå',      name: 'Skellefteå Airport',            code: 'SFT', offsetFromNorway: 0 },
  { city: 'Sundsvall',       name: 'Sundsvall-Timrå Airport',       code: 'SDL', offsetFromNorway: 0 },
  { city: 'Kiruna',          name: 'Kiruna Airport',                code: 'KRN', offsetFromNorway: 0 },
  { city: 'Karlstad',        name: 'Karlstad Airport',              code: 'KSD', offsetFromNorway: 0 },
  { city: 'Växjö',           name: 'Växjö Småland Airport',         code: 'VXO', offsetFromNorway: 0 },
  { city: 'Linköping',       name: 'Linköping City Airport',        code: 'LPI', offsetFromNorway: 0 },
  { city: 'Jönköping',       name: 'Jönköping Airport',             code: 'JKG', offsetFromNorway: 0 },
  { city: 'Kalmar',          name: 'Kalmar Airport',                code: 'KLR', offsetFromNorway: 0 },
  { city: 'Örebro',          name: 'Örebro Airport',                code: 'ORB', offsetFromNorway: 0 },
  { city: 'Norrköping',      name: 'Norrköping Airport',            code: 'NRK', offsetFromNorway: 0 },
  { city: 'Ronneby',         name: 'Ronneby Airport',               code: 'RNB', offsetFromNorway: 0 },
]

// ── Hjelpefunksjoner ─────────────────────────────────────────────────────────

/** Filtrer flyplasser på kode, by eller navn. Returnerer maks 7 treff. */
export function filterAirports(query: string): Airport[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return AIRPORTS
    .filter(a =>
      a.code.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      // Eksakt kode-treff først
      const aExact = a.code.toLowerCase() === q ? 0 : a.code.toLowerCase().startsWith(q) ? 1 : 2
      const bExact = b.code.toLowerCase() === q ? 0 : b.code.toLowerCase().startsWith(q) ? 1 : 2
      return aExact - bExact
    })
    .slice(0, 7)
}

/** Finn offset (timer fra Norge) for en verdi som kan være kode, "KOD – By", eller bynavn. */
export function getOffset(value: string | null | undefined): number {
  if (!value) return 0
  const v = value.trim()
  // Forsøk: hent første ord/token som IATA-kode (f.eks. "JFK" eller "JFK – New York")
  const token = v.split(/[\s–\-(,]/)[0].toUpperCase()
  const byCode = AIRPORTS.find(a => a.code === token)
  if (byCode) return byCode.offsetFromNorway
  // Forsøk: by-navn finnes i strengen
  const vLow = v.toLowerCase()
  const byCity = AIRPORTS.find(a => vLow.includes(a.city.toLowerCase()))
  if (byCity) return byCity.offsetFromNorway
  return 0
}

/** Beregn flytid i minutter basert på lokal avgang/ankomst og offsets. */
export function calcFlightMinutes(
  depTime: string | null | undefined,
  depOffset: number,
  arrTime: string | null | undefined,
  arrOffset: number,
): number | null {
  if (!depTime || !arrTime) return null
  const [dh, dm] = depTime.split(':').map(Number)
  const [ah, am] = arrTime.split(':').map(Number)
  if (isNaN(dh) || isNaN(dm) || isNaN(ah) || isNaN(am)) return null
  // Konverter til "Norge-tid"-minutter
  const depNorway = dh * 60 + dm - depOffset * 60
  const arrNorway = ah * 60 + am - arrOffset * 60
  let dur = arrNorway - depNorway
  if (dur <= 0) dur += 24 * 60   // nattpassing
  if (dur > 24 * 60) dur -= 24 * 60
  return dur
}

/** Beregn ventetid på mellomlandingsflyplass (begge tider er lokal tid samme flyplass). */
export function calcStopoverMinutes(
  leg1Arrival: string | null | undefined,
  leg2Departure: string | null | undefined,
): number | null {
  if (!leg1Arrival || !leg2Departure) return null
  const [ah, am] = leg1Arrival.split(':').map(Number)
  const [dh, dm] = leg2Departure.split(':').map(Number)
  if (isNaN(ah) || isNaN(dh)) return null
  let diff = (dh * 60 + dm) - (ah * 60 + am)
  if (diff < 0) diff += 24 * 60
  return diff
}

/** Formater minutter til f.eks. "8t 30min" eller "2t". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}t ${m}min` : `${h}t`
}
