import type { Map as MapLibreMap, PaddingOptions } from 'maplibre-gl'
import { getBounds, type MapView } from './view.ts'

export const CAMERA_GAP = 32
export const BOUNDS_MAX_ZOOM = 15

type Rect = Pick<DOMRectReadOnly, 'top' | 'bottom' | 'left' | 'right' | 'height' | 'width'>

export function measurePadding(map: Rect, occluders: Rect[]): PaddingOptions {
  let covered = 0
  for (const rect of occluders) {
    if (rect.width <= 0 || rect.height <= 0 || rect.right <= map.left || rect.left >= map.right) continue
    const overlap = Math.min(map.bottom, rect.bottom) - Math.max(map.top, rect.top)
    if (overlap > 0) covered = Math.max(covered, map.bottom - Math.max(map.top, rect.top))
  }
  // Even a very short viewport must leave MapLibre a positive fitting area.
  const gap = Math.min(CAMERA_GAP, map.height / 8, map.width / 8)
  return { top: gap, bottom: Math.min(covered + gap, map.height - gap - 1), left: gap, right: gap }
}

type CameraMap = Pick<MapLibreMap, 'getZoom' | 'stop' | 'easeTo' | 'fitBounds'>

export function applyCamera(map: CameraMap, view: MapView, padding: PaddingOptions, animate: boolean, resize = false) {
  const options = { padding, duration: animate ? 450 : 0, bearing: 0, pitch: 0 }
  map.stop()
  // Preserve the visible camera padding so transitions start without a jump.
  if (view.mode === 'detail') {
    const place = view.places.find(({ id }) => id === view.selectedId)
    if (place) map.easeTo({ ...options, center: place.coordinates, zoom: resize ? map.getZoom() : place.detailZoom })
    return
  }
  const bounds = getBounds(view.places) ?? view.fallbackBounds
  if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
    map.easeTo({ ...options, center: bounds[0], zoom: BOUNDS_MAX_ZOOM })
  } else {
    // Replace retained padding rather than adding the new panel's padding to it.
    map.fitBounds(bounds, { ...options, maxZoom: BOUNDS_MAX_ZOOM, absolutePadding: true })
  }
}
