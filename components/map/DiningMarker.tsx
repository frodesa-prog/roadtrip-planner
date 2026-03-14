'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { Dining } from '@/types'

interface DiningMarkerProps {
  dining: Dining
  isSelected?: boolean
  onClick?: () => void
}

function buildDiningMarkerSvg(size: number, isSelected: boolean): string {
  const c = size / 2
  const borderColor = isSelected ? '#ffffff' : 'rgba(255,255,255,0.75)'
  const fs = Math.round(size * 0.42)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${c}" cy="${c}" r="${c - 1}" fill="#dc2626" stroke="${borderColor}" stroke-width="2.5"/>` +
    `<text x="${c}" y="${c + fs * 0.36}" text-anchor="middle" font-size="${fs}" ` +
    `font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">🍽️</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export default function DiningMarker({
  dining,
  isSelected = false,
  onClick,
}: DiningMarkerProps) {
  const map = useMap()
  const markerRef = useRef<google.maps.Marker | null>(null)

  useEffect(() => {
    if (!map || !dining.map_lat || !dining.map_lng) return

    const size = 36
    const iconUrl = buildDiningMarkerSvg(size, isSelected)

    const marker = new google.maps.Marker({
      position: { lat: dining.map_lat, lng: dining.map_lng },
      map,
      icon: {
        url: iconUrl,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
      },
      title: [dining.name, dining.booking_time].filter(Boolean).join(' · '),
      zIndex: isSelected ? 200 : 50,
    })

    if (onClick) marker.addListener('click', onClick)
    markerRef.current = marker

    return () => {
      marker.setMap(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dining.map_lat, dining.map_lng, dining.name, isSelected])

  return null
}
