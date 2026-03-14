'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { Stop } from '@/types'

interface StopMarkerProps {
  stop: Stop
  index: number
  isSelected: boolean
  onClick: () => void
  isPending?: boolean
  hotelName?: string
}

export default function StopMarker({ stop, index, isSelected, onClick, isPending, hotelName }: StopMarkerProps) {
  const map = useMap()
  const markerRef = useRef<google.maps.Marker | null>(null)

  useEffect(() => {
    if (!map) return

    // Lag et SVG-ikon som ser bra ut
    const bgColor = isPending ? '#94a3b8' : isSelected ? '#f97316' : '#2563eb'
    const label = isPending ? '?' : String(index + 1)

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
        <circle cx="18" cy="18" r="16" fill="${bgColor}" stroke="white" stroke-width="2.5"/>
        <text x="18" y="23" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="system-ui, sans-serif">${label}</text>
        <polygon points="18,40 11,28 25,28" fill="${bgColor}"/>
      </svg>
    `

    const marker = new google.maps.Marker({
      position: { lat: stop.lat, lng: stop.lng },
      map,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44),
      },
      title: isPending ? 'Nytt stopp...' : `${index + 1}. ${stop.city}${hotelName ? ` — ${hotelName}` : ''}`,
      zIndex: isSelected ? 100 : index + 1,
    })

    marker.addListener('click', onClick)
    markerRef.current = marker

    return () => {
      marker.setMap(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, stop.lat, stop.lng, isSelected, index, isPending, stop.city, hotelName])

  return null
}
