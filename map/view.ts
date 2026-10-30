import type { PlaceOverview } from '../lib/places.ts'

export type MapPlace = Pick<PlaceOverview, 'id' | 'coordinates' | 'categoryIds' | 'detailZoom'> & {
  title: string
  url: string
}
export type Bounds = [[number, number], [number, number]]
export type MapView = { places: MapPlace[] } & (
  | { mode: 'bounds'; fallbackBounds: Bounds }
  | { mode: 'detail'; selectedId: string }
)

export const filterPlaces = <T extends Pick<PlaceOverview, 'id' | 'categoryIds'>>(places: T[], categoryId: string): T[] => {
  const seen = new Set<string>()
  return places.filter((place) => {
    if (!place.categoryIds.includes(categoryId) || seen.has(place.id)) return false
    seen.add(place.id)
    return true
  })
}

export const getBounds = (places: Pick<PlaceOverview, 'coordinates'>[]): Bounds | undefined => {
  if (!places.length) return undefined
  const longitudes = places.map(({ coordinates }) => coordinates[0])
  const latitudes = places.map(({ coordinates }) => coordinates[1])
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ]
}

const colors: Record<string, string> = {
  culture: '#7c3aed',
  nature: '#15803d',
  mobility: '#0369a1',
  citylife: '#be123c',
}

export const markerData = (view: MapView) => {
  return {
    type: 'FeatureCollection' as const,
    features: view.places.map((place) => ({
      type: 'Feature' as const,
      id: place.id,
      geometry: { type: 'Point' as const, coordinates: place.coordinates },
      properties: {
        id: place.id,
        title: place.title,
        color: Object.hasOwn(colors, place.categoryIds[0]) ? colors[place.categoryIds[0]] : '#64748b',
        selected: view.mode === 'detail' && place.id === view.selectedId,
      },
    })),
  }
}
