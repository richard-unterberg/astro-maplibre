import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { type MapView, markerData } from './view.ts'

export const MARKER_HIT_LAYER = 'places-hit'
const sourceId = 'places'

export function syncMarkers(map: MapLibreMap, view: MapView) {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: markerData(view) })
  } else {
    ;(map.getSource(sourceId) as GeoJSONSource).setData(markerData(view))
  }
  if (map.getLayer(MARKER_HIT_LAYER)) return
  map.addLayer({
    id: 'places-selection',
    type: 'circle',
    source: sourceId,
    filter: ['==', ['get', 'selected'], true],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.22,
      'circle-radius': 18,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-opacity': 0.45,
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'places-dot',
    type: 'circle',
    source: sourceId,
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['case', ['get', 'selected'], 9, 7],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'places-core',
    type: 'circle',
    source: sourceId,
    paint: { 'circle-color': '#ffffff', 'circle-radius': ['case', ['get', 'selected'], 3.5, 2.5] },
  })
  map.addLayer({
    id: MARKER_HIT_LAYER,
    type: 'circle',
    source: sourceId,
    paint: { 'circle-radius': 22, 'circle-opacity': 0 },
  })
}
