'use client'

import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const WORLD_CENTER = { lat: 20, lng: 10 }

// Common name aliases → lowercase GeoJSON ADMIN name
const COUNTRY_ALIASES: Record<string, string> = {
  'usa':                           'united states of america',
  'u.s.a.':                        'united states of america',
  'united states':                 'united states of america',
  'us':                            'united states of america',
  'uk':                            'united kingdom',
  'england':                       'united kingdom',
  'great britain':                 'united kingdom',
  'norge':                         'norway',
  'sverige':                       'sweden',
  'danmark':                       'denmark',
  'finnland':                      'finland',
  'suomi':                         'finland',
  'españa':                        'spain',
  'deutschland':                   'germany',
  'frankrike':                     'france',
  'italia':                        'italy',
  'nederland':                     'netherlands',
  'østerrike':                     'austria',
  'sveits':                        'switzerland',
  'hellas':                        'greece',
  'kroatia':                       'croatia',
  'tyrkia':                        'turkey',
  'japan':                         'japan',
  'kina':                          'china',
  'australia':                     'australia',
  'new zealand':                   'new zealand',
  'canada':                        'canada',
  'mexico':                        'mexico',
}

function normalize(s: string): string {
  const lower = s.toLowerCase().trim()
  return COUNTRY_ALIASES[lower] ?? lower
}

// ── Data-layer component (must be inside APIProvider + GoogleMap) ──────────────

function WorldDataLayer({ visitedCountries }: { visitedCountries: globalThis.Set<string> }) {
  const map = useMap()

  useEffect(() => {
    if (!map || visitedCountries.size === 0) return

    const normalizedVisited = new globalThis.Set(
      [...visitedCountries].map(normalize),
    )

    let active = true

    fetch(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
    )
      .then(r => r.json())
      .then((geojson: unknown) => {
        if (!active) return

        map.data.addGeoJson(geojson as object)

        map.data.setStyle(feature => {
          const name = normalize((feature.getProperty('NAME')   as string) ?? '')
          const iso3 = normalize((feature.getProperty('ISO_A3') as string) ?? '').toLowerCase()
          const iso2 = normalize((feature.getProperty('ISO_A2') as string) ?? '').toLowerCase()

          const isVisited =
            normalizedVisited.has(name) ||
            normalizedVisited.has(iso3) ||
            normalizedVisited.has(iso2)

          return {
            fillColor:    isVisited ? '#f59e0b' : '#1e3a5f',
            fillOpacity:  isVisited ? 0.75 : 0.2,
            strokeColor:  isVisited ? '#fbbf24' : '#334155',
            strokeWeight: isVisited ? 1.5 : 0.4,
          }
        })

        // Click → show country name
        map.data.addListener('click', (e: google.maps.Data.MouseEvent) => {
          const name = (e.feature.getProperty('NAME') as string) ?? ''
          if (!name) return
          const iv = new google.maps.InfoWindow({
            content: `<div style="font-family:system-ui,sans-serif;font-size:13px;color:#1e293b;padding:2px 4px">${name}</div>`,
            position: e.latLng,
          })
          iv.open(map)
          setTimeout(() => iv.close(), 2500)
        })
      })
      .catch(err => console.error('Failed to load world GeoJSON', err))

    return () => {
      active = false
      map.data.forEach(f => map.data.remove(f))
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

export default function VerdenKartPage() {
  const [trips, setTrips] = useState<TripRow[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])
  const apiKey   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trips')
        .select('id, name, destination_country')
        .order('created_at', { ascending: false })
      setTrips((data ?? []) as TripRow[])
      setLoading(false)
    }
    load()
  }, [supabase])

  // Unique, non-empty country strings
  const visitedCountries = useMemo(() => {
    const s = new globalThis.Set<string>()
    trips.forEach(t => {
      if (t.destination_country?.trim()) s.add(t.destination_country.trim())
    })
    return s
  }, [trips])

  // Sorted display list with original casing
  const visitedList = useMemo(
    () => [...visitedCountries].sort((a, b) => a.localeCompare(b, 'no')),
    [visitedCountries],
  )

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#0f172a' }}>

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div
        style={{
          position:      'absolute',
          top:           0,
          left:          0,
          right:         0,
          height:        44,
          background:    'rgba(15,23,42,0.88)',
          backdropFilter:'blur(8px)',
          borderBottom:  '1px solid rgba(51,65,85,0.5)',
          display:       'flex',
          alignItems:    'center',
          paddingLeft:   16,
          paddingRight:  16,
          zIndex:        15,
          gap:           8,
        }}
      >
        <span style={{ fontSize: 18 }}>🌍</span>
        <span
          style={{
            color:      '#e2e8f0',
            fontSize:   13,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            flexShrink: 0,
          }}
        >
          Verdenskart
        </span>

        {!loading && (
          <span
            style={{
              color:      '#475569',
              fontSize:   11,
              fontFamily: 'system-ui, sans-serif',
              flexShrink: 0,
            }}
          >
            · {visitedCountries.size} land besøkt
          </span>
        )}

        {/* Country chips */}
        {!loading && visitedList.length > 0 && (
          <div
            style={{
              display:    'flex',
              gap:        6,
              overflowX:  'auto',
              flexShrink: 1,
              minWidth:   0,
              marginLeft: 8,
              paddingBottom: 2,
            }}
          >
            {visitedList.map(country => (
              <span
                key={country}
                style={{
                  padding:      '1px 8px',
                  borderRadius: 999,
                  background:   'rgba(120,53,15,0.35)',
                  border:       '1px solid rgba(217,119,6,0.4)',
                  color:        '#fcd34d',
                  fontSize:     11,
                  fontFamily:   'system-ui, sans-serif',
                  whiteSpace:   'nowrap',
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
        <div
          style={{
            position:   'absolute',
            inset:      0,
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color:      '#94a3b8',
            fontSize:   15,
            fontFamily: 'system-ui, sans-serif',
            zIndex:     10,
          }}
        >
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
        <div
          style={{
            position:   'absolute',
            bottom:     24,
            left:       16,
            background: 'rgba(15,23,42,0.85)',
            border:     '1px solid rgba(51,65,85,0.6)',
            borderRadius: 8,
            padding:    '8px 12px',
            display:    'flex',
            flexDirection: 'column',
            gap:        6,
            zIndex:     10,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 16, height: 16,
                borderRadius: 3,
                background: '#f59e0b',
                opacity: 0.75,
                border: '1.5px solid #fbbf24',
              }}
            />
            <span style={{ color: '#e2e8f0', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>
              Besøkt land
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 16, height: 16,
                borderRadius: 3,
                background: '#1e3a5f',
                opacity: 0.5,
                border: '0.5px solid #334155',
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>
              Ikke besøkt
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
