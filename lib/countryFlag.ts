// Maps country long names (as returned by Google Maps Geocoder) to ISO 3166-1 alpha-2 codes.
// Used to generate flag emoji for international road trips.

const COUNTRY_ISO: Record<string, string> = {
  // Nordic
  Norway: 'NO', Norge: 'NO',
  Sweden: 'SE', Sverige: 'SE',
  Denmark: 'DK', Danmark: 'DK',
  Finland: 'FI',
  Iceland: 'IS', Island: 'IS',
  // Western Europe
  Germany: 'DE', Deutschland: 'DE', Tyskland: 'DE',
  France: 'FR', Frankrike: 'FR',
  Spain: 'ES', España: 'ES', Spania: 'ES',
  Italy: 'IT', Italia: 'IT',
  Portugal: 'PT',
  Netherlands: 'NL', Nederland: 'NL',
  Belgium: 'BE', Belgia: 'BE',
  Switzerland: 'CH', Sveits: 'CH',
  Austria: 'AT', Østerrike: 'AT',
  'United Kingdom': 'GB', Storbritannia: 'GB',
  Ireland: 'IE', Irland: 'IE',
  Luxembourg: 'LU',
  'San Marino': 'SM',
  Monaco: 'MC',
  Andorra: 'AD',
  Liechtenstein: 'LI',
  Malta: 'MT',
  Cyprus: 'CY', Kypros: 'CY',
  // Central/Eastern Europe
  Poland: 'PL', Polen: 'PL',
  'Czech Republic': 'CZ', Czechia: 'CZ', Tsjekkia: 'CZ',
  Slovakia: 'SK',
  Hungary: 'HU', Ungarn: 'HU',
  Romania: 'RO',
  Bulgaria: 'BG',
  Croatia: 'HR', Kroatia: 'HR',
  Slovenia: 'SI',
  Serbia: 'RS',
  Greece: 'GR', Hellas: 'GR',
  Albania: 'AL',
  'Bosnia and Herzegovina': 'BA',
  Montenegro: 'ME',
  'North Macedonia': 'MK',
  Kosovo: 'XK',
  Estonia: 'EE', Estland: 'EE',
  Latvia: 'LV',
  Lithuania: 'LT', Litauen: 'LT',
  Belarus: 'BY', Hviterussland: 'BY',
  Ukraine: 'UA', Ukraina: 'UA',
  Moldova: 'MD',
  Russia: 'RU', Russland: 'RU',
  // Americas
  'United States': 'US', USA: 'US',
  Canada: 'CA',
  Mexico: 'MX',
  Brazil: 'BR', Brasil: 'BR',
  Argentina: 'AR',
  Chile: 'CL',
  Colombia: 'CO',
  Peru: 'PE',
  // Asia
  Japan: 'JP',
  China: 'CN', Kina: 'CN',
  'South Korea': 'KR', 'Sør-Korea': 'KR',
  Thailand: 'TH',
  Vietnam: 'VN',
  Indonesia: 'ID',
  India: 'IN',
  Turkey: 'TR', Tyrkia: 'TR',
  Israel: 'IL',
  Jordan: 'JO', Jordan: 'JO',
  'Saudi Arabia': 'SA',
  'United Arab Emirates': 'AE',
  // Africa
  Morocco: 'MA', Marokko: 'MA',
  'South Africa': 'ZA', 'Sør-Afrika': 'ZA',
  Egypt: 'EG',
  Kenya: 'KE',
  Tanzania: 'TZ',
  // Oceania
  Australia: 'AU',
  'New Zealand': 'NZ',
}

function isoToFlagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

/** Returns a flag emoji for the given country name, or '' if not found. */
export function countryFlag(countryName: string | null | undefined): string {
  if (!countryName) return ''
  const iso = COUNTRY_ISO[countryName]
  return iso ? isoToFlagEmoji(iso) : ''
}
