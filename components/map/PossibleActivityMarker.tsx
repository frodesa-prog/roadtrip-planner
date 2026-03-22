'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { PossibleActivity } from '@/types'
import { getActivityTypeConfig } from '@/lib/activityTypes'

function buildPossibleMarkerSvg(
  category: string | null,
  size: number,
  isSelected: boolean,
): string {
  const cfg = getActivityTypeConfig(category)
  const c = size / 2
  // Amber/yellow fill with dashed border to indicate "tentative / possible"
  const fill = isSelected ? '#eab308' : '#b45309'
  const borderColor = isSelected ? '#ffffff' : 'rgba(255,255,255,0.65)'
  const fs = Math.round(size * 0.42)
  const emoji = cfg.emoji
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${c}" cy="${c}" r="${c - 1.5}" fill="${fill}" stroke="${borderColor}" stroke-width="2.5" stroke-dasharray="4 2"/>` +
    `<text x="${c}" y="${c + fs * 0.36}" text-anchor="middle" font-size="${fs}" ` +
    `font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

interface PossibleActivityMarkerProps {
  possible: PossibleActivity
  isSelected?: boolean
  onClick?: () => void
}

export default function PossibleActivityMarker({
  possible,
  isSelected = false,
  onClick,
}: PossibleActivityMarkerProps) {
  const map = useMap()
  const markerRef = useRef<google.maps.Marker | null>(null)

  useEffect(() => {
    if (!map || possible.map_lat == null || possible.map_lng == null) return

    const size = 34
    const iconUrl = buildPossibleMarkerSvg(possible.category, size, isSelected)

    const marker = new google.maps.Marker({
      position: { lat: possible.map_lat, lng: possible.map_lng },
      map,
      icon: {
        url: iconUrl,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
      },
      title: possible.description,
      zIndex: isSelected ? 190 : 40,
    })

    if (onClick) marker.addListener('click', onClick)
    markerRef.current = marker

    return () => {
      marker.setMap(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, possible.map_lat, possible.map_lng, possible.category, possible.description, isSelected])

  return null
}
