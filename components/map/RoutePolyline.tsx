'use client'

import { useEffect, useRef } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { Stop } from '@/types'

interface RoutePolylineProps {
  stops: Stop[]
}

export default function RoutePolyline({ stops }: RoutePolylineProps) {
  const map = useMap()
  const routesLib = useMapsLibrary('routes')
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null)

  // Tegn en enkel rett-linje polyline mellom stoppene (fungerer alltid)
  useEffect(() => {
    if (!map || stops.length < 2) {
      polylineRef.current?.setMap(null)
      return
    }

    polylineRef.current?.setMap(null)

    const path = stops.map((s) => ({ lat: s.lat, lng: s.lng }))

    polylineRef.current = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.6,
      strokeWeight: 3,
      map,
    })

    return () => {
      polylineRef.current?.setMap(null)
    }
  }, [map, stops])

  // Forsøk å tegne vegbasert rute via Directions API (erstatter polyline hvis vellykket)
  useEffect(() => {
    if (!map || !routesLib || stops.length < 2) return

    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#2563eb',
        strokeWeight: 4,
        strokeOpacity: 0.85,
      },
    })
    rendererRef.current = renderer

    const service = new routesLib.DirectionsService()
    const origin = { lat: stops[0].lat, lng: stops[0].lng }
    const destination = { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng }
    const waypoints = stops.slice(1, -1).map((s) => ({
      location: new google.maps.LatLng(s.lat, s.lng),
      stopover: true,
    }))

    service.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          renderer.setDirections(result)
          // Skjul den enkle polyline når vegbasert rute er klar
          polylineRef.current?.setMap(null)
        } else {
          console.warn('Directions API ikke tilgjengelig, bruker enkel linje. Status:', status)
        }
      }
    )

    return () => {
      renderer.setMap(null)
    }
  }, [map, routesLib, stops])

  return null
}
