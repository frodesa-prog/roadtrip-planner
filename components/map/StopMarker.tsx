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
  showHotelIcon?: boolean
}

export default function StopMarker({ stop, index, isSelected, onClick, isPending, hotelName, showHotelIcon }: StopMarkerProps) {
  const map = useMap()
  const markerRef = useRef<google.maps.Marker | null>(null)

  useEffect(() => {
    if (!map) return

    // Lag et SVG-ikon som ser bra ut
    const bgColor = isPending ? '#94a3b8' : isSelected ? '#f97316' : '#2563eb'
    const label = isPending ? '?' : String(index + 1)

    // Inner content: hotel bed icon or number label
    const innerContent = showHotelIcon
      ? `
        <rect x="8" y="10" width="20" height="5" rx="2.5" fill="white"/>
        <rect x="7" y="15" width="22" height="8" rx="2" fill="white"/>
        <rect x="9.5" y="16" width="7" height="4.5" rx="1.5" fill="${bgColor}"/>
        <rect x="9" y="23" width="2" height="3" rx="1" fill="white"/>
        <rect x="25" y="23" width="2" height="3" rx="1" fill="white"/>
      `
      : `<text x="18" y="23" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="system-ui, sans-serif">${label}</text>`

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
        <circle cx="18" cy="18" r="16" fill="${bgColor}" stroke="white" stroke-width="2.5"/>
        ${innerContent}
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
  }, [map, stop.lat, stop.lng, isSelected, index, isPending, stop.city, hotelName, showHotelIcon])

  return null
}
