'use client'

import { useEffect, useRef } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'

export interface RouteInfo {
  distance: string
  drivingTime: string
  walkingTime: string
}

interface Props {
  fromLat: number
  fromLng: number
  /** Hotel address string (preferred). If null, falls back to toLat/toLng. */
  toAddress: string | null
  /** Stop lat – fallback destination if no hotel address */
  toLat: number
  /** Stop lng – fallback destination if no hotel address */
  toLng: number
  onRouteInfo?: (info: RouteInfo) => void
}

export default function ActivityRoutePolyline({
  fromLat,
  fromLng,
  toAddress,
  toLat,
  toLng,
  onRouteInfo,
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

    let drivingDistance = ''
    let drivingTime = ''
    let walkingTime = ''

    function tryEmitRouteInfo() {
      if (drivingDistance && drivingTime && walkingTime && onRouteInfo) {
        onRouteInfo({ distance: drivingDistance, drivingTime, walkingTime })
      }
    }

    // Driving route (also draws the polyline)
    function fetchDriving(dest: string | google.maps.LatLng) {
      service.route(
        { origin, destination: dest, travelMode: google.maps.TravelMode.DRIVING },
        (result, status) => {
          if (status === 'OK' && result) {
            renderer.setDirections(result)
            const leg = result.routes[0]?.legs[0]
            drivingDistance = leg?.distance?.text ?? ''
            drivingTime = leg?.duration?.text ?? ''
            tryEmitRouteInfo()
          } else if (toAddress) {
            // Fallback: try with stop coordinates
            fetchDriving(new google.maps.LatLng(toLat, toLng))
          }
        }
      )
    }

    // Walking route (info only)
    service.route(
      { origin, destination, travelMode: google.maps.TravelMode.WALKING },
      (result, status) => {
        if (status === 'OK' && result) {
          const leg = result.routes[0]?.legs[0]
          walkingTime = leg?.duration?.text ?? ''
        } else {
          walkingTime = '–'
        }
        tryEmitRouteInfo()
      }
    )

    fetchDriving(destination)

    return () => {
      renderer.setMap(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLib, fromLat, fromLng, toAddress, toLat, toLng])

  return null
}
