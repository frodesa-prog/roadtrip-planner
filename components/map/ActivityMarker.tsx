'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { Activity } from '@/types'
import { buildActivityMarkerSvg } from '@/lib/activityTypes'

interface ActivityMarkerProps {
  activity: Activity
  isSelected?: boolean
  onClick?: () => void
}

export default function ActivityMarker({
  activity,
  isSelected = false,
  onClick,
}: ActivityMarkerProps) {
  const map = useMap()
  const markerRef = useRef<google.maps.Marker | null>(null)

  useEffect(() => {
    if (!map || !activity.map_lat || !activity.map_lng) return

    const size = 36
    const iconUrl = buildActivityMarkerSvg(activity.activity_type, size, isSelected)

    const marker = new google.maps.Marker({
      position: { lat: activity.map_lat, lng: activity.map_lng },
      map,
      icon: {
        url: iconUrl,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
      },
      title: [activity.name, activity.activity_time].filter(Boolean).join(' · '),
      zIndex: isSelected ? 200 : 50,
    })

    if (onClick) marker.addListener('click', onClick)
    markerRef.current = marker

    return () => {
      marker.setMap(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activity.map_lat, activity.map_lng, activity.activity_type, activity.name, isSelected])

  return null
}
