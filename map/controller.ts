import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import { applyCamera, measurePadding } from './camera.ts'
import { MARKER_HIT_LAYER, syncMarkers } from './markers.ts'
import type { MapView } from './view.ts'

export function createMapController(map: MapLibreMap, navigate: (url: string) => Promise<void>) {
  let view: MapView | undefined
  let wrapper: HTMLElement | undefined
  let frame = 0
  let changed = false
  let animate = false
  let destroyed = false
  let navigating = false
  let revision = 0
  let lastLayout = ''
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

  function schedule() {
    if (!frame && !destroyed) frame = requestAnimationFrame(updateLayout)
  }

  function updateLayout() {
    frame = 0
    if (destroyed || !view || !wrapper?.isConnected) return
    const rect = map.getContainer().getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const occluders = [...wrapper.querySelectorAll<HTMLElement>('[data-map-occluder]')]
    const padding = measurePadding(
      rect,
      occluders.map((element) => element.getBoundingClientRect()),
    )
    const layout = JSON.stringify([rect.width, rect.height, padding])
    if (!changed && layout === lastLayout) return
    map.resize()
    applyCamera(map, view, padding, changed && animate && !reducedMotion.matches, !changed)
    lastLayout = layout
    changed = false
  }

  const observer = new ResizeObserver(schedule)
  function restoreMarkers() {
    // Read the current view, never a configuration captured by a previous load callback.
    if (!destroyed && view) syncMarkers(map, view)
  }
  function hit(event: MapMouseEvent) {
    if (!view || !map.getLayer(MARKER_HIT_LAYER)) return
    const features = map.queryRenderedFeatures(event.point, { layers: [MARKER_HIT_LAYER] })
    return view.places.find(({ id }) => id === features[0]?.properties?.id)
  }
  function click(event: MapMouseEvent) {
    const place = hit(event)
    if (!place || navigating || (view?.mode === 'detail' && place.id === view.selectedId)) return
    navigating = true
    const startedAt = revision
    const unlock = () => {
      if (!destroyed && revision === startedAt) navigating = false
    }
    void navigate(place.url).then(unlock, (error: unknown) => {
      unlock()
      if (!destroyed && revision === startedAt) console.error('Place navigation failed', error)
    })
  }
  function pointer(event: MapMouseEvent) {
    map.getCanvas().style.cursor = hit(event) ? 'pointer' : ''
  }
  function clearPointer() {
    map.getCanvas().style.cursor = ''
  }

  map.on('style.load', restoreMarkers)
  map.on('click', click)
  map.on('mousemove', pointer)
  map.on('mouseout', clearPointer)

  return {
    setView(nextView: MapView, nextWrapper: HTMLElement, shouldAnimate = true) {
      map.stop()
      revision++
      if (nextView.mode === 'detail') {
        // Retain the preceding overview/category, using place data from the current locale.
        const visibleIds = new Set(view?.places.map(({ id }) => id))
        view = {
          ...nextView,
          places: nextView.places.filter(({ id }) => id === nextView.selectedId || visibleIds.has(id)),
        }
      } else {
        view = nextView
      }
      wrapper = nextWrapper
      changed = true
      animate = shouldAnimate
      navigating = false
      clearPointer()
      observer.disconnect()
      observer.observe(map.getContainer())
      for (const element of wrapper.querySelectorAll('[data-map-occluder]')) observer.observe(element)
      if (map.isStyleLoaded() || map.getLayer(MARKER_HIT_LAYER)) restoreMarkers()
      schedule()
    },
    destroy() {
      destroyed = true
      revision++
      observer.disconnect()
      cancelAnimationFrame(frame)
      map.stop()
      map.off('style.load', restoreMarkers)
      map.off('click', click)
      map.off('mousemove', pointer)
      map.off('mouseout', clearPointer)
      clearPointer()
      view = undefined
      wrapper = undefined
    },
  }
}
