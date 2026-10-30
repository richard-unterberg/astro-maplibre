import type { Map as MapLibreMap, Marker } from 'maplibre-gl'

export type PlaceTarget = {
  coordinates: [number, number]
  detailZoom: number
  title: string
}

type FocusMap = Pick<MapLibreMap, 'getContainer' | 'getZoom' | 'flyTo' | 'stop' | 'on' | 'off'>

export function createPlaceFocus(map: FocusMap, addMarker: (place: PlaceTarget) => Pick<Marker, 'remove'>) {
  let place: PlaceTarget | undefined
  let marker: Pick<Marker, 'remove'> | undefined

  function focus(animate: boolean, zoom = place?.detailZoom) {
    if (!place) return

    map.flyTo({
      center: place.coordinates,
      zoom,
      // Das Panel verdeckt 50 % der Karte: Mittelpunkt der freien oberen Hälfte.
      offset: [0, -map.getContainer().clientHeight / 4],
      animate,
      duration: 800,
    })
  }

  function onResize() {
    focus(false, map.getZoom())
  }

  map.on('resize', onResize)

  return {
    setPlace(nextPlace: PlaceTarget | undefined, animate = true) {
      map.stop()
      marker?.remove()
      marker = undefined
      place = nextPlace
      if (!place) return

      marker = addMarker(place)
      focus(animate)
    },
    destroy() {
      map.off('resize', onResize)
      marker?.remove()
      marker = undefined
      place = undefined
    },
  }
}
