'use client'

import { useEffect, useRef } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'

interface Props {
  fromLat: number
  fromLng: number
  /** Hotel address string (preferred). If null, falls back to toLat/toLng. */
  toAddress: string | null
  /** Stop lat – fallback destination if no hotel address */
  toLat: number
  /** Stop lng – fallback destination if no hotel address */
  toLng: number
}

export default function ActivityRoutePolyline({
  fromLat,
  fromLng,
  toAddress,
  toLat,
  toLng,
}: Props) {
  const map = useMap()
  const routesLib = useMapsLibrary('routes')
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null)

  useEffect(() => {
    if (!map || !routesLib) return

    rendererRef.current?.setMap(null)

    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: '#f59e0b',
        strokeWeight: 3,
        strokeOpacity: 0.9,
        zIndex: 10,
      },
    })
    rendererRef.current = renderer

    const service = new routesLib.DirectionsService()
    const origin = { lat: fromLat, lng: fromLng }
    const destination: string | google.maps.LatLng = toAddress
      ? toAddress
      : new google.maps.LatLng(toLat, toLng)

    service.route(
      { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === 'OK' && result) {
          renderer.setDirections(result)
        } else if (toAddress) {
          // Fallback: try with stop coordinates instead
          service.route(
            {
              origin,
              destination: new google.maps.LatLng(toLat, toLng),
              travelMode: google.maps.TravelMode.DRIVING,
            },
            (r2, s2) => {
              if (s2 === 'OK' && r2) renderer.setDirections(r2)
            }
          )
        }
      }
    )

    return () => {
      renderer.setMap(null)
    }
  }, [map, routesLib, fromLat, fromLng, toAddress, toLat, toLng])

  return null
}
