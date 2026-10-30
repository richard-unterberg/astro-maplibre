import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPlaceFocus } from '../map/placeFocus.ts'

function setup() {
  const container = { clientHeight: 800 }
  const flights = []
  const markers = []
  const listeners = new Set()
  let zoom = 12
  let stops = 0
  const map = {
    getContainer: () => container,
    getZoom: () => zoom,
    flyTo: (options) => {
      flights.push(options)
      zoom = options.zoom
    },
    stop: () => {
      stops++
    },
    on: (event, listener) => {
      assert.equal(event, 'resize')
      listeners.add(listener)
    },
    off: (event, listener) => {
      assert.equal(event, 'resize')
      listeners.delete(listener)
    },
  }
  const focus = createPlaceFocus(map, (place) => {
    const marker = {
      place,
      removed: false,
      remove() {
        this.removed = true
      },
    }
    markers.push(marker)
    return marker
  })
  return {
    focus,
    container,
    flights,
    markers,
    listeners,
    resize: () => {
      for (const listener of listeners) listener()
    },
    setZoom: (value) => {
      zoom = value
    },
    getStops: () => stops,
  }
}

const wirkbau = { title: 'Wirkbau', coordinates: [12.9018, 50.8207], detailZoom: 15 }
const schlossteich = { title: 'Schlossteich', coordinates: [12.9139, 50.8413], detailZoom: 14 }

test('direct place loads use the detail zoom and center the marker above the half-height panel', () => {
  const { focus, flights, markers } = setup()
  focus.setPlace(wirkbau, false)

  assert.equal(markers.length, 1)
  assert.strictEqual(markers[0].place, wirkbau)
  assert.deepEqual(flights[0].center, wirkbau.coordinates)
  assert.equal(flights[0].zoom, 15)
  assert.equal(flights[0].animate, false)
  assert.deepEqual(flights[0].offset, [0, -200])
})

test('persistent map navigation replaces the marker and animates to the next detail entry', () => {
  const { focus, flights, markers, getStops } = setup()
  focus.setPlace(wirkbau, false)
  focus.setPlace(schlossteich)

  assert.equal(getStops(), 2)
  assert.equal(markers[0].removed, true)
  assert.equal(markers[1].removed, false)
  assert.strictEqual(markers[1].place, schlossteich)
  assert.deepEqual(flights[1].center, schlossteich.coordinates)
  assert.equal(flights[1].zoom, 14)
  assert.equal(flights[1].animate, true)
})

test('resizing recomputes the offset for the active place and keeps the current user zoom', () => {
  const { focus, flights, container, resize, setZoom } = setup()
  focus.setPlace(wirkbau)
  setZoom(16)
  container.clientHeight = 400
  resize()

  assert.deepEqual(flights[1].center, wirkbau.coordinates)
  assert.deepEqual(flights[1].offset, [0, -100])
  assert.equal(flights[1].zoom, 16)
  assert.equal(flights[1].animate, false)
})

test('overview navigation removes the detail marker and stops focusing on resize', () => {
  const { focus, flights, markers, resize, getStops } = setup()
  focus.setPlace(undefined)
  assert.equal(flights.length, 0)
  assert.equal(markers.length, 0)
  focus.setPlace(wirkbau)
  focus.setPlace(undefined)
  resize()

  assert.equal(getStops(), 3)
  assert.equal(markers[0].removed, true)
  assert.equal(flights.length, 1)
})

test('destroying a map removes the marker and resize subscription', () => {
  const { focus, markers, listeners, flights, resize } = setup()
  focus.setPlace(wirkbau)
  focus.destroy()
  resize()

  assert.equal(markers[0].removed, true)
  assert.equal(listeners.size, 0)
  assert.equal(flights.length, 1)
})
