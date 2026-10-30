import { getRelativeLocaleUrl } from 'astro:i18n'
import { getBounds, type MapPlace } from '../map/view.ts'
import type { Locale } from './i18n.ts'
import type { PlaceOverview } from './places.ts'

export const localizeMapPlaces = (places: PlaceOverview[], locale: Locale): MapPlace[] => {
  return places.map(({ id, title, coordinates, categoryIds, detailZoom }) => ({
    id,
    title: title[locale],
    coordinates,
    categoryIds,
    detailZoom,
    url: getRelativeLocaleUrl(locale, `place/${id}`),
  }))
}

export const overviewBounds = (places: PlaceOverview[]) => {
  const bounds = getBounds(places)
  if (!bounds) throw new Error('Expected a non-empty places overview')
  return bounds
}
