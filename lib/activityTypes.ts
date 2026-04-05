// ─── Activity type configuration ─────────────────────────────────────────────
// Shared between StopDetailPanel, ActivityMarker, and the Activities page.

export interface ActivityTypeConfig {
  value: string
  label: string
  emoji: string   // used in list UI and non-SoulCycle map markers
  color: string   // hex – marker background / badge color
  isSoulCycle: boolean  // use spinning-wheel SVG instead of emoji
}

export const ACTIVITY_TYPE_PRESETS: ActivityTypeConfig[] = [
  { value: 'baseball',    label: 'Baseball',    emoji: '⚾',  color: '#f97316', isSoulCycle: false },
  { value: 'trening',     label: 'Trening',     emoji: '🚴', color: '#eab308', isSoulCycle: true  },
  { value: 'hiking',      label: 'Hiking',      emoji: '🥾', color: '#22c55e', isSoulCycle: false },
  { value: 'sightseeing', label: 'Sightseeing', emoji: '📸', color: '#3b82f6', isSoulCycle: false },
  { value: 'shopping',    label: 'Shopping',    emoji: '🛍️', color: '#ec4899', isSoulCycle: false },
  { value: 'mat',         label: 'Mat',         emoji: '🍴', color: '#ea580c', isSoulCycle: false },
  { value: 'kjoring',     label: 'Kjøring',     emoji: '🚗', color: '#64748b', isSoulCycle: false },
  { value: 'admin',       label: 'Admin',       emoji: '📋', color: '#6366f1', isSoulCycle: false },
  { value: 'show',        label: 'Show',        emoji: '🎭', color: '#a855f7', isSoulCycle: false },
]

const FALLBACK: ActivityTypeConfig = {
  value: '',
  label: 'Annet',
  emoji: '🎫',
  color: '#8b5cf6',
  isSoulCycle: false,
}

export function getActivityTypeConfig(type: string | null | undefined): ActivityTypeConfig {
  if (!type) return FALLBACK
  return ACTIVITY_TYPE_PRESETS.find((p) => p.value === type) ?? {
    value: type,
    label: type,
    emoji: '⭐',
    color: '#6b7280',
    isSoulCycle: false,
  }
}

// ─── SVG builder for map markers (returns data-URI-ready SVG string) ──────────

/** SoulCycle-inspired spinning wheel (black bg, yellow/gold rim + spokes) */
function buildSoulCycleSvg(size: number, isSelected: boolean): string {
  const c = size / 2
  const borderColor = isSelected ? '#ffffff' : '#EAB308'
  const rimR  = size * 0.33
  const hubR  = size * 0.08
  const sw    = Math.max(1, size * 0.055)

  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180
    const x1 = (c + hubR * Math.cos(a)).toFixed(1)
    const y1 = (c + hubR * Math.sin(a)).toFixed(1)
    const x2 = (c + rimR  * Math.cos(a)).toFixed(1)
    const y2 = (c + rimR  * Math.sin(a)).toFixed(1)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#EAB308" stroke-width="${sw}"/>`
  }).join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${c}" cy="${c}" r="${c - 1}" fill="#1a1a1a" stroke="${borderColor}" stroke-width="2.5"/>` +
    `<circle cx="${c}" cy="${c}" r="${rimR}" stroke="#EAB308" stroke-width="${sw}" fill="none"/>` +
    `<circle cx="${c}" cy="${c}" r="${hubR}" fill="#EAB308"/>` +
    spokes +
    `</svg>`
  )
}

/** Emoji-based marker (colored circle background + emoji centered) */
function buildEmojiSvg(size: number, emoji: string, bgColor: string, isSelected: boolean): string {
  const c = size / 2
  const borderColor = isSelected ? '#ffffff' : 'rgba(255,255,255,0.75)'
  const fs = Math.round(size * 0.42)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${c}" cy="${c}" r="${c - 1}" fill="${bgColor}" stroke="${borderColor}" stroke-width="2.5"/>` +
    `<text x="${c}" y="${c + fs * 0.36}" text-anchor="middle" font-size="${fs}" ` +
    `font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text>` +
    `</svg>`
  )
}

/** Returns an SVG data-URI suitable for google.maps.Marker icon.url */
export function buildActivityMarkerSvg(
  type: string | null | undefined,
  size: number,
  isSelected: boolean
): string {
  const cfg = getActivityTypeConfig(type)
  const svg = cfg.isSoulCycle
    ? buildSoulCycleSvg(size, isSelected)
    : buildEmojiSvg(size, cfg.emoji, cfg.color, isSelected)
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// ─── Inline React icon for UI (not map) ───────────────────────────────────────

import React from 'react'

/** Small SoulCycle spinning-wheel icon for inline UI use */
export function SoulCycleIcon({ size = 16 }: { size?: number }) {
  const c = size / 2
  const rimR = size * 0.33
  const hubR = size * 0.09
  const sw   = Math.max(0.5, size * 0.055)

  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180
    return React.createElement('line', {
      key: i,
      x1: c + hubR * Math.cos(a),
      y1: c + hubR * Math.sin(a),
      x2: c + rimR * Math.cos(a),
      y2: c + rimR * Math.sin(a),
      stroke: '#EAB308',
      strokeWidth: sw,
    })
  })

  return React.createElement(
    'svg',
    { width: size, height: size, viewBox: `0 0 ${size} ${size}`, fill: 'none' },
    React.createElement('circle', { cx: c, cy: c, r: c - 0.5, fill: '#1a1a1a' }),
    React.createElement('circle', { cx: c, cy: c, r: rimR, stroke: '#EAB308', strokeWidth: sw, fill: 'none' }),
    React.createElement('circle', { cx: c, cy: c, r: hubR, fill: '#EAB308' }),
    ...spokes
  )
}

/** Activity type icon for inline UI (SoulCycle SVG or emoji span) */
export function ActivityTypeIcon({ type, size = 16 }: { type: string | null | undefined; size?: number }) {
  const cfg = getActivityTypeConfig(type)
  if (cfg.isSoulCycle) {
    return React.createElement(SoulCycleIcon, { size })
  }
  return React.createElement(
    'span',
    { style: { fontSize: size, lineHeight: 1 } },
    cfg.emoji
  )
}
