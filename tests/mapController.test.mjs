import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMapController } from '../map/controller.ts'

const first = { id: 'a', title: 'A', coordinates: [12, 50], categoryIds: ['history'], detailZoom: 16, url: '/place/a/' }
const second = { ...first, id: 'b', url: '/de/place/b/' }
const boundsView = (places) => ({
  mode: 'bounds',
  places,
  fallbackBounds: [
    [12, 50],
    [13, 51],
  ],
})
const rect = { top: 110, bottom: 910, left: 0, right: 1000, height: 800, width: 1000 }

function setup(t, { ready = true, reduced = false } = {}) {
  const frames = new Map()
  let frameId = 0
  let observer
  t.mock.method(globalThis, 'requestAnimationFrame', (callback) => {
    frames.set(++frameId, callback)
    return frameId
  })
  t.mock.method(globalThis, 'cancelAnimationFrame', (id) => frames.delete(id))
  t.mock.method(globalThis, 'matchMedia', () => ({ matches: reduced }))
  const previousObserver = globalThis.ResizeObserver
  globalThis.ResizeObserver = class {
    elements = new Set()
    constructor(callback) {
      this.callback = callback
      observer = this
    }
    observe(element) {
      this.elements.add(element)
    }
    disconnect() {
      this.elements.clear()
    }
  }
  t.after(() => {
    globalThis.ResizeObserver = previousObserver
  })
  const layers = new Map()
  const listeners = new Map()
  const sources = new Map()
  const cameras = []
  const canvas = { style: {} }
  const container = { getBoundingClientRect: () => rect }
  const wrapper = { isConnected: true, querySelectorAll: () => [] }
  let featureId
  const map = {
    on: (event, callback) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(callback)
    },
    off: (event, callback) => listeners.get(event).delete(callback),
    getContainer: () => container,
    getCanvas: () => canvas,
    getZoom: () => 17,
    resize() {},
    stop() {},
    setPadding() {},
    fitBounds: (...args) => cameras.push({ method: 'fitBounds', args }),
    easeTo: (...args) => cameras.push({ method: 'easeTo', args }),
    isStyleLoaded: () => ready,
    getSource: (id) => sources.get(id),
    addSource: (id, spec) =>
      sources.set(id, {
        data: spec.data,
        setData(data) {
          this.data = data
        },
      }),
    getLayer: (id) => layers.get(id),
    addLayer: (spec) => layers.set(spec.id, spec),
    queryRenderedFeatures: () => (featureId ? [{ properties: { id: featureId } }] : []),
  }
  const navigations = []
  const finishNavigations = []
  const controller = createMapController(map, (url) => {
    navigations.push(url)
    return new Promise((resolve) => finishNavigations.push(resolve))
  })
  return {
    controller,
    map,
    wrapper,
    frames,
    cameras,
    sources,
    layers,
    listeners,
    navigations,
    finishNavigations,
    canvas,
    observer: () => observer,
    emit: (event) => {
      for (const callback of listeners.get(event) ?? []) callback({ point: { x: 100, y: 100 } })
    },
    hit: (id) => {
      featureId = id
    },
    flush: () => {
      const pending = [...frames.values()]
      frames.clear()
      for (const callback of pending) callback()
    },
  }
}

// Browser APIs are absent in Node; temporary stubs let the tests control scheduling deterministically.
for (const name of ['requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'ResizeObserver']) {
  globalThis[name] = () => {}
}

test('rapid navigation before style load applies only the current view and restores it after theme changes', (t) => {
  const s = setup(t, { ready: false })
  s.controller.setView({ mode: 'detail', places: [first], selectedId: 'a' }, s.wrapper, false)
  s.controller.setView(boundsView([second]), s.wrapper)
  assert.equal(s.frames.size, 1)
  s.emit('style.load')
  s.flush()
  assert.deepEqual(
    s.sources.get('places').data.features.map(({ id }) => id),
    ['b'],
  )
  assert.equal(s.sources.get('places').data.features[0].properties.selected, false)
  assert.equal(s.cameras.length, 1)
  s.sources.clear()
  s.layers.clear()
  s.emit('style.load')
  assert.equal(s.layers.size, 4)
  assert.equal(s.sources.get('places').data.features[0].id, 'b')
  assert.equal(s.cameras.length, 1)
  s.controller.destroy()
})

test('clicks navigate once using current localized URLs and ignore stale or empty hits', async (t) => {
  const s = setup(t)
  s.controller.setView(boundsView([first]), s.wrapper)
  s.hit('a')
  s.emit('mousemove')
  s.emit('click')
  s.emit('click')
  assert.equal(s.canvas.style.cursor, 'pointer')
  assert.deepEqual(s.navigations, ['/place/a/'])
  s.map.isStyleLoaded = () => false
  s.controller.setView(boundsView([second]), s.wrapper)
  assert.equal(s.sources.get('places').data.features[0].id, 'b')
  s.emit('click') // Old worker result must not be navigable after a filter change.
  s.hit(undefined)
  s.emit('click')
  s.emit('mousemove')
  assert.equal(s.canvas.style.cursor, '')
  s.hit('b')
  s.emit('click')
  assert.deepEqual(s.navigations, ['/place/a/', '/de/place/b/'])
  s.finishNavigations[0]()
  await Promise.resolve()
  s.emit('click')
  assert.equal(s.navigations.length, 2, 'completion from an old view cannot unlock the current navigation')
  s.controller.destroy()
})

test('detail selection retains the previous marker context and refreshes localized place data', (t) => {
  const s = setup(t)
  const third = { ...first, id: 'c', coordinates: [13, 51], url: '/place/c/' }
  const localized = [first, second, third].map((place) => ({
    ...place,
    title: `DE ${place.id}`,
    url: `/de/place/${place.id}/`,
  }))
  const features = () => s.sources.get('places').data.features
  s.controller.setView(boundsView([first, second]), s.wrapper)
  s.flush()
  s.controller.setView({ mode: 'detail', selectedId: 'a', places: localized }, s.wrapper)
  s.flush()
  assert.deepEqual(
    features().map(({ id, properties }) => [id, properties.selected, properties.title]),
    [
      ['a', true, 'DE a'],
      ['b', false, 'DE b'],
    ],
  )
  assert.equal(s.cameras[1].method, 'easeTo')
  assert.deepEqual(s.cameras[1].args[0].center, first.coordinates)
  assert.equal(s.cameras[1].args[0].zoom, first.detailZoom)
  s.hit('b')
  s.emit('click')
  assert.deepEqual(s.navigations, ['/de/place/b/'])
  s.controller.setView({ mode: 'detail', selectedId: 'b', places: localized }, s.wrapper)
  s.flush()
  assert.deepEqual(
    features().map(({ id, properties }) => [id, properties.selected]),
    [
      ['a', false],
      ['b', true],
    ],
  )
  s.sources.clear()
  s.layers.clear()
  s.emit('style.load')
  assert.deepEqual(
    features().map(({ id, properties }) => [id, properties.selected]),
    [
      ['a', false],
      ['b', true],
    ],
  )
  assert.equal(s.cameras.length, 3, 'restoring the style must not replay the camera animation')
  s.controller.setView(boundsView([third]), s.wrapper)
  s.flush()
  assert.deepEqual(
    features().map(({ id }) => id),
    ['c'],
  )
  assert.equal(features()[0].properties.selected, false)
  s.controller.destroy()
})

test('a direct detail visit shows the selected marker and adds a new selection to the existing context', (t) => {
  const s = setup(t)
  const places = [first, second]
  s.controller.setView({ mode: 'detail', selectedId: 'a', places }, s.wrapper, false)
  s.flush()
  assert.deepEqual(
    s.sources.get('places').data.features.map(({ id }) => id),
    ['a'],
  )
  s.controller.setView({ mode: 'detail', selectedId: 'b', places }, s.wrapper)
  s.flush()
  assert.deepEqual(
    s.sources.get('places').data.features.map(({ id, properties }) => [id, properties.selected]),
    [
      ['a', false],
      ['b', true],
    ],
  )
  s.controller.destroy()
})

test('clicking the selected marker does not navigate or replay the camera, while other markers remain clickable', (t) => {
  const s = setup(t)
  s.controller.setView(boundsView([first, second]), s.wrapper)
  s.flush()
  s.controller.setView({ mode: 'detail', selectedId: 'a', places: [first, second] }, s.wrapper)
  s.flush()
  s.hit('a')
  s.emit('click')
  s.emit('click')
  s.flush()
  assert.deepEqual(s.navigations, [])
  assert.equal(s.frames.size, 0)
  assert.equal(s.cameras.length, 2)
  s.hit('b')
  s.emit('click')
  assert.deepEqual(s.navigations, ['/de/place/b/'])
  s.controller.setView({ mode: 'detail', selectedId: 'b', places: [first, second] }, s.wrapper)
  s.flush()
  s.emit('click')
  s.flush()
  assert.deepEqual(s.navigations, ['/de/place/b/'])
  assert.equal(s.cameras.length, 3)
  s.controller.destroy()
})

test('layout observation batches work, respects reduced motion, and never recenters on map movement', (t) => {
  const s = setup(t, { reduced: true })
  const panel = { getBoundingClientRect: () => ({ ...rect, top: 610, height: 300 }) }
  s.wrapper.querySelectorAll = () => [panel]
  s.controller.setView({ mode: 'detail', selectedId: 'a', places: [first] }, s.wrapper)
  s.flush()
  assert.equal(s.cameras[0].args[0].duration, 0)
  assert.equal(s.cameras[0].args[0].padding.bottom, 332)
  s.observer().callback()
  s.observer().callback()
  s.flush()
  assert.equal(s.cameras.length, 1)
  panel.getBoundingClientRect = () => ({ ...rect, top: 710, height: 200 })
  s.observer().callback()
  s.flush()
  assert.equal(s.cameras[1].args[0].zoom, 17)
  assert.equal(s.cameras[1].args[0].padding.bottom, 232)
  assert.equal(s.listeners.has('move'), false)
  assert.equal(s.listeners.has('render'), false)
  s.controller.setView(boundsView([]), s.wrapper)
  s.controller.destroy()
  assert.equal(s.observer().elements.size, 0)
  assert.equal(s.frames.size, 0)
  assert.ok([...s.listeners.values()].every((callbacks) => callbacks.size === 0))
  s.emit('style.load')
  s.flush()
  assert.equal(s.cameras.length, 2)
})
