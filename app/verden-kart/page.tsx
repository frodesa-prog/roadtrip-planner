'use client'

import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const WORLD_CENTER = { lat: 20, lng: 10 }

// Mirrors VacationStats: same USA detection logic
const USA_COUNTRY_NAMES = ['usa', 'us', 'united states', 'united states of america', 'amerika']
const US_STATES_LC = new globalThis.Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in',
  'ia','ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv',
  'nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn',
  'tx','ut','vt','va','wa','wv','wi','wy','dc',
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new hampshire','new jersey','new mexico','new york','north carolina',
  'north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island',
  'south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming',
])

// Additional aliases so stored values like "Norge", "UK" etc. map to GeoJSON names
const ALIASES: Record<string, string> = {
  'usa':                       'united states of america',
  'u.s.a.':                    'united states of america',
  'united states':             'united states of america',
  'us':                        'united states of america',
  'uk':                        'united kingdom',
  'england':                   'united kingdom',
  'great britain':             'united kingdom',
  'norge':                     'norway',
  'sverige':                   'sweden',
  'danmark':                   'denmark',
  'suomi':                     'finland',
  'españa':                    'spain',
  'deutschland':               'germany',
  'frankrike':                 'france',
  'italia':                    'italy',
  'nederland':                 'netherlands',
  'østerrike':                 'austria',
  'sveits':                    'switzerland',
  'hellas':                    'greece',
  'kroatia':                   'croatia',
  'tyrkia':                    'turkey',
  'kina':                      'china',
}

function alias(s: string): string {
  const low = s.toLowerCase().trim()
  return ALIASES[low] ?? low
}

// ── GeoJSON data-layer ────────────────────────────────────────────────────────

// Stable, well-known URL (~310 KB). Properties: { name: "United States of America" }
// Also try secondary URL if needed (Natural Earth has ADMIN + ISO_A3)
const GEOJSON_URLS = [
  'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geojson',
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
]

function fStr(f: google.maps.Data.Feature, key: string): string {
  return ((f.getProperty(key) as string) ?? '').toLowerCase().trim()
}

function WorldDataLayer({ visitedCountries }: { visitedCountries: globalThis.Set<string> }) {
  const map = useMap()

  useEffect(() => {
    if (!map || visitedCountries.size === 0) return
    const m = map // capture non-null reference for async callbacks

    // Build two lookup sets:
    // 1. aliased: "USA" → "united states of america"
    const aliasedSet = new globalThis.Set([...visitedCountries].map(alias))
    // 2. raw lowercase: "USA" → "usa" (for direct ISO_A3 / short-name matching)
    const rawSet = new globalThis.Set([...visitedCountries].map(c => c.toLowerCase().trim()))

    function isVisited(f: google.maps.Data.Feature): boolean {
      // Try all property names used across different GeoJSON sources
      const candidates = [
        fStr(f, 'name'),   // world.geo.json
        fStr(f, 'NAME'),   // Natural Earth short
        fStr(f, 'ADMIN'),  // Natural Earth full
        fStr(f, 'ISO_A3'), // iso3 code
        fStr(f, 'ISO_A2'), // iso2 code
        fStr(f, 'iso_a3'),
        fStr(f, 'iso_a2'),
      ].filter(Boolean)

      return candidates.some(
        v => aliasedSet.has(v) || rawSet.has(v) || aliasedSet.has(alias(v))
      )
    }

    const styleLayer = () =>
      m.data.setStyle(f => ({
        fillColor:    isVisited(f) ? '#f59e0b' : '#1e3a5f',
        fillOpacity:  isVisited(f) ? 0.75 : 0.2,
        strokeColor:  isVisited(f) ? '#fbbf24' : '#334155',
        strokeWeight: isVisited(f) ? 1.5 : 0.4,
      }))

    let active = true
    let urlIndex = 0

    async function tryLoad() {
      while (urlIndex < GEOJSON_URLS.length) {
        try {
          const r = await fetch(GEOJSON_URLS[urlIndex])
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const geojson = await r.json()
          if (!active) return
          m.data.addGeoJson(geojson as object)
          styleLayer()

          // Click → tooltip with country name
          m.data.addListener('click', (e: google.maps.Data.MouseEvent) => {
            const label =
              (e.feature.getProperty('name')  as string) ??
              (e.feature.getProperty('ADMIN') as string) ??
              (e.feature.getProperty('NAME')  as string) ?? ''
            if (!label) return
            const iv = new google.maps.InfoWindow({
              content:  `<div style="font-family:system-ui,sans-serif;font-size:13px;color:#1e293b;padding:2px 6px">${label}</div>`,
              position: e.latLng,
            })
            iv.open(m)
            setTimeout(() => iv.close(), 2500)
          })
          return // success
        } catch (err) {
          console.warn(`[verden-kart] URL ${urlIndex} failed:`, err)
          urlIndex++
        }
      }
      console.error('[verden-kart] All GeoJSON sources failed')
    }

    tryLoad()

    return () => {
      active = false
      m.data.forEach(f => m.data.remove(f))
    }
  }, [map, visitedCountries])

  return null
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface TripRow {
  id: string
  name: string
  destination_country: string | null
}
interface StopRow {
  id: string
  trip_id: string
  state: string | null
}

export default function VerdenKartPage() {
  const [trips, setTrips] = useState<TripRow[]>([])
  const [stops, setStops] = useState<StopRow[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])
  const apiKey   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

  useEffect(() => {
    async function load() {
      const [{ data: tripsData }, { data: stopsData }] = await Promise.all([
        supabase.from('trips').select('id, name, destination_country').order('created_at', { ascending: false }),
        supabase.from('stops').select('id, trip_id, state'),
      ])
      setTrips((tripsData ?? []) as TripRow[])
      setStops((stopsData ?? []) as StopRow[])
      setLoading(false)
    }
    load()
  }, [supabase])

  // Mirrors VacationStats.countryList exactly
  const visitedCountries = useMemo(() => {
    const s = new globalThis.Set<string>()
    trips.forEach(t => { if (t.destination_country?.trim()) s.add(t.destination_country.trim()) })

    // Add "USA" if there are stops with US state abbreviations (same as VacationStats)
    const hasUsaStops = stops.some(st => st.state && US_STATES_LC.has(st.state.toLowerCase().trim()))
    const alreadyHasUsa = [...s].some(c => USA_COUNTRY_NAMES.includes(c.toLowerCase()))
    if (hasUsaStops && !alreadyHasUsa) s.add('USA')

    return s
  }, [trips, stops])

  const visitedList = useMemo(
    () => [...visitedCountries].sort((a, b) => a.localeCompare(b, 'no')),
    [visitedCountries],
  )

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0f172a' }}>

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div
        style={{
          position:       'absolute',
          top:            0, left: 0, right: 0,
          height:         44,
          background:     'rgba(15,23,42,0.88)',
          backdropFilter: 'blur(8px)',
          borderBottom:   '1px solid rgba(51,65,85,0.5)',
          display:        'flex',
          alignItems:     'center',
          paddingLeft:    16,
          paddingRight:   16,
          zIndex:         15,
          gap:            8,
        }}
      >
        <span style={{ fontSize: 18 }}>🌍</span>
        <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, sans-serif', flexShrink: 0 }}>
          Verdenskart
        </span>

        {!loading && (
          <span style={{ color: '#475569', fontSize: 11, fontFamily: 'system-ui, sans-serif', flexShrink: 0 }}>
            · {visitedCountries.size} land besøkt
          </span>
        )}

        {!loading && visitedList.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 1, minWidth: 0, marginLeft: 8, paddingBottom: 2 }}>
            {visitedList.map(country => (
              <span
                key={country}
                style={{
                  padding: '1px 8px', borderRadius: 999,
                  background: 'rgba(120,53,15,0.35)',
                  border: '1px solid rgba(217,119,6,0.4)',
                  color: '#fcd34d', fontSize: 11,
                  fontFamily: 'system-ui, sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >
                {country}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94a3b8', fontSize: 15, fontFamily: 'system-ui, sans-serif', zIndex: 10,
        }}>
          Laster kart…
        </div>
      )}

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      {!loading && (
        <div style={{ position: 'absolute', inset: 0, paddingTop: 44 }}>
          <APIProvider apiKey={apiKey}>
            <GoogleMap
              defaultCenter={WORLD_CENTER}
              defaultZoom={2}
              style={{ width: '100%', height: '100%' }}
              gestureHandling="greedy"
              zoomControl
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl
              rotateControl={false}
            >
              <WorldDataLayer visitedCountries={visitedCountries} />
            </GoogleMap>
          </APIProvider>
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      {!loading && (
        <div style={{
          position: 'absolute', bottom: 24, left: 16,
          background: 'rgba(15,23,42,0.85)',
          border: '1px solid rgba(51,65,85,0.6)',
          borderRadius: 8, padding: '8px 12px',
          display: 'flex', flexDirection: 'column', gap: 6,
          zIndex: 10, backdropFilter: 'blur(6px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: '#f59e0b', opacity: 0.75, border: '1.5px solid #fbbf24' }} />
            <span style={{ color: '#e2e8f0', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>Besøkt land</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: '#1e3a5f', opacity: 0.5, border: '0.5px solid #334155' }} />
            <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>Ikke besøkt</span>
          </div>
        </div>
      )}
    </div>
  )
}
