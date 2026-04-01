'use client'

import { Stop } from '@/types'
import { APIProvider, Map as GoogleMap, useMapsLibrary, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

const USA_CENTER = { lat: 39.8, lng: -98.5 }

interface ReplayInnerProps {
  stops: Stop[]
  color?: string
}

function ReplayInner({ stops, color = '#f59e0b' }: ReplayInnerProps) {
  const map       = useMap()
  const routesLib = useMapsLibrary('routes')

  const pathRef         = useRef<google.maps.LatLng[]>([])
  const markerRef       = useRef<google.maps.Marker | null>(null)
  const polylineRef     = useRef<google.maps.Polyline | null>(null)
  const trailRef        = useRef<google.maps.Polyline | null>(null)
  const animFrameRef    = useRef<number | null>(null)
  const progressRef     = useRef(0)

  const [playing, setPlaying]   = useState(false)
  const [progress, setProgress] = useState(0)   // 0–1
  const [ready, setReady]       = useState(false)
  const [currentStop, setCurrentStop] = useState<string>('')

  // ── Hent rute ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!map || !routesLib || stops.length < 2) return

    const waypoints: google.maps.DirectionsWaypoint[] = stops.slice(1, -1).map((s) => ({
      location: new google.maps.LatLng(s.lat, s.lng),
      stopover: true,
    }))

    const service = new routesLib.DirectionsService()
    service.route(
      {
        origin:      { lat: stops[0].lat, lng: stops[0].lng },
        destination: { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng },
        waypoints,
        travelMode:  google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status !== 'OK' || !result) return

        // Bygg detaljert sti
        const raw: google.maps.LatLng[] = []
        for (const leg of result.routes[0].legs) {
          for (const step of leg.steps) raw.push(...step.path)
        }
        pathRef.current = raw

        // Trekk opp "ghost"-rute i bakgrunnen
        polylineRef.current?.setMap(null)
        polylineRef.current = new google.maps.Polyline({
          path:          raw,
          strokeColor:   color,
          strokeOpacity: 0.2,
          strokeWeight:  4,
          map,
        })

        // Opprett markør
        markerRef.current?.setMap(null)
        markerRef.current = new google.maps.Marker({
          position: raw[0],
          map,
          icon: {
            path:          google.maps.SymbolPath.CIRCLE,
            scale:         10,
            fillColor:     color,
            fillOpacity:   1,
            strokeColor:   '#ffffff',
            strokeWeight:  2,
          },
          zIndex: 10,
        })

        // Opprett "kjørt"-trail
        trailRef.current?.setMap(null)
        trailRef.current = new google.maps.Polyline({
          path:          [],
          strokeColor:   color,
          strokeOpacity: 0.9,
          strokeWeight:  4,
          map,
        })

        setReady(true)
        setCurrentStop(stops[0].city)
      }
    )

    return () => {
      polylineRef.current?.setMap(null)
      markerRef.current?.setMap(null)
      trailRef.current?.setMap(null)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib])

  // ── Animasjonsloop ────────────────────────────────────────────────────────

  function animate() {
    const path  = pathRef.current
    if (!path.length) return

    const SPEED = 0.0008  // fremgang per animasjonsramme

    progressRef.current = Math.min(1, progressRef.current + SPEED)
    const prog = progressRef.current

    const idx = Math.floor(prog * (path.length - 1))
    const pos = path[idx]

    markerRef.current?.setPosition(pos)
    trailRef.current?.setPath(path.slice(0, idx + 1))
    setProgress(prog)

    // Finn nærmeste stopp
    const stopsDist = stops.map((s) => ({
      city: s.city,
      dist: Math.sqrt((s.lat - pos.lat()) ** 2 + (s.lng - pos.lng()) ** 2),
    }))
    const nearest = stopsDist.sort((a, b) => a.dist - b.dist)[0]
    setCurrentStop(nearest.city)

    if (prog < 1) {
      animFrameRef.current = requestAnimationFrame(animate)
    } else {
      setPlaying(false)
    }
  }

  function handlePlay() {
    if (!ready) return
    setPlaying(true)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(animate)
  }

  function handlePause() {
    setPlaying(false)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }

  function handleRestart() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    progressRef.current = 0
    setProgress(0)
    setPlaying(false)

    const path = pathRef.current
    if (path.length) {
      markerRef.current?.setPosition(path[0])
      trailRef.current?.setPath([])
    }
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/60 backdrop-blur">
      <button
        onClick={handleRestart}
        disabled={!ready}
        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={playing ? handlePause : handlePlay}
        disabled={!ready}
        className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-colors"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* Fremdriftslinje */}
      <div className="w-32 h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-500 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Gjeldende sted */}
      <span className="text-xs text-slate-300 min-w-24 truncate">
        {ready ? currentStop : 'Laster rute…'}
      </span>
    </div>
  )
}

// ── Eksportert komponent ──────────────────────────────────────────────────────

interface Props {
  stops: Stop[]
  color?: string
}

export default function MapReplay({ stops, color }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey || stops.length < 2) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-500 text-sm">
        {stops.length < 2 ? 'Minst 2 stoppesteder kreves for kartreplay.' : 'Google Maps API-nøkkel mangler.'}
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700" style={{ height: 420 }}>
      <APIProvider apiKey={apiKey}>
        <GoogleMap
          defaultCenter={USA_CENTER}
          defaultZoom={4}
          style={{ width: '100%', height: '100%' }}
          gestureHandling="cooperative"
          zoomControl
          mapTypeControl={false}
          streetViewControl={false}
        >
          <ReplayInner stops={stops} color={color} />
        </GoogleMap>
      </APIProvider>
    </div>
  )
}
