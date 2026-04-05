'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { Stop, StopType } from '@/types'

interface StopMarkerProps {
  stop: Stop
  index: number
  isSelected: boolean
  onClick: () => void
  isPending?: boolean
  hotelName?: string
  showHotelIcon?: boolean
  /** For home_start / home_end stops */
  stopType?: StopType
  pinLabel?: string
}

export default function StopMarker({ stop, index, isSelected, onClick, isPending, hotelName, showHotelIcon, stopType = 'stop', pinLabel }: StopMarkerProps) {
  const map = useMap()
  const markerRef = useRef<google.maps.Marker | null>(null)

  useEffect(() => {
    if (!map) return

    // Determine pin color and label based on stop type
    let bgColor: string
    let label: string

    if (stopType === 'home_start') {
      bgColor = '#16a34a'  // green-600
      label = pinLabel ?? '0'
    } else if (stopType === 'home_end') {
      bgColor = '#0d9488'  // teal-600
      label = pinLabel ?? '↩'
    } else if (isPending) {
      bgColor = '#94a3b8'
      label = '?'
    } else {
      bgColor = isSelected ? '#f97316' : '#2563eb'
      label = String(index + 1)
    }

    // Inner content: hotel "H" label or stop number label
    const innerContent = (showHotelIcon && stopType === 'stop')
      ? `<text x="18" y="23" text-anchor="middle" fill="white" font-size="15" font-weight="bold" font-family="system-ui, sans-serif">H</text>`
      : `<text x="18" y="23" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="system-ui, sans-serif">${label}</text>`

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
        <circle cx="18" cy="18" r="16" fill="${bgColor}" stroke="white" stroke-width="2.5"/>
        ${innerContent}
        <polygon points="18,40 11,28 25,28" fill="${bgColor}"/>
      </svg>
    `

    const titleLabel = stopType === 'home_start'
      ? `Start: ${stop.city}`
      : stopType === 'home_end'
      ? `Slutt: ${stop.city}`
      : isPending
      ? 'Nytt stopp...'
      : `${index + 1}. ${stop.city}${hotelName ? ` — ${hotelName}` : ''}`

    const marker = new google.maps.Marker({
      position: { lat: stop.lat, lng: stop.lng },
      map,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(36, 44),
        anchor: new google.maps.Point(18, 44),
      },
      title: titleLabel,
      zIndex: isSelected ? 100 : (stopType === 'home_start' ? 200 : stopType === 'home_end' ? 199 : index + 1),
    })

    marker.addListener('click', onClick)
    markerRef.current = marker

    return () => {
      marker.setMap(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, stop.lat, stop.lng, isSelected, index, isPending, stop.city, hotelName, showHotelIcon, stopType, pinLabel])

  return null
}
