import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyCamera, BOUNDS_MAX_ZOOM, CAMERA_GAP, measurePadding } from '../map/camera.ts'

const place = { id: 'wirkbau', coordinates: [12.9018, 50.8207], detailZoom: 17 }
const other = { id: 'schlossteich', coordinates: [12.9139, 50.8413], detailZoom: 14 }
const fallbackBounds = [
  [12, 50],
  [13, 51],
]
const detail = { mode: 'detail', selectedId: place.id, places: [place] }
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height })
const padding = { top: 32, bottom: 332, left: 32, right: 32 }

function setup() {
  const calls = []
  const map = Object.fromEntries(
    ['stop', 'setPadding', 'easeTo', 'fitBounds'].map((name) => [name, (...args) => calls.push({ name, args })]),
  )
  map.getZoom = () => 16
  return { map, calls, cameraCalls: () => calls.filter(({ name }) => ['easeTo', 'fitBounds'].includes(name)) }
}

test('padding measures map intersections, excluding the header and combining overlays once', () => {
  const map = rect(0, 110, 1000, 800)
  assert.deepEqual(measurePadding(map, []), { top: 32, bottom: 32, left: 32, right: 32 })
  const overlays = [rect(0, 0, 1000, 110), rect(0, 610, 1000, 300), rect(0, 700, 1000, 210), rect(1100, 110, 100, 800)]
  assert.deepEqual(measurePadding(map, overlays), padding)
  assert.equal(measurePadding(map, [rect(0, 814, 1000, 64)]).bottom, 96 + CAMERA_GAP)
})

test('a short viewport retains positive camera space even if a panel covers it', () => {
  const result = measurePadding(rect(0, 0, 100, 50), [rect(0, -10, 100, 100)])
  assert.ok(result.top + result.bottom < 50)
  assert.ok(result.left + result.right < 100)
})

test('detail camera uses measured padding once and retains user zoom on layout changes', () => {
  const { map, calls, cameraCalls } = setup()
  applyCamera(map, detail, padding, false)
  applyCamera(map, detail, { ...padding, bottom: 180 }, false, true)
  assert.deepEqual(
    cameraCalls().map(({ args }) => args[0]),
    [
      { center: place.coordinates, zoom: 17, padding, duration: 0, bearing: 0, pitch: 0 },
      { center: place.coordinates, zoom: 16, padding: { ...padding, bottom: 180 }, duration: 0, bearing: 0, pitch: 0 },
    ],
  )
  assert.equal(calls.filter(({ name }) => name === 'stop').length, 2)
  assert.ok(cameraCalls().every(({ args }) => !('offset' in args[0])))
})

test('detail to overview resets padding and fits actual coordinate extrema', () => {
  const { map, calls, cameraCalls } = setup()
  applyCamera(map, detail, padding, false)
  applyCamera(map, { mode: 'bounds', places: [place, other], fallbackBounds }, { ...padding, bottom: 32 }, true)
  const fit = cameraCalls()[1]
  assert.equal(fit.name, 'fitBounds')
  assert.deepEqual(fit.args[0], [
    [12.9018, 50.8207],
    [12.9139, 50.8413],
  ])
  assert.equal(fit.args[1].padding.bottom, 32)
  assert.equal(fit.args[1].duration, 450)
  assert.equal(fit.args[1].maxZoom, BOUNDS_MAX_ZOOM)
  assert.deepEqual(calls[4], { name: 'setPadding', args: [{ top: 0, bottom: 0, left: 0, right: 0 }] })
})

test('single and coincident points get bounded zoom; empty categories use overview bounds', () => {
  for (const places of [[place], [place, { ...other, coordinates: place.coordinates }], []]) {
    const { map, cameraCalls } = setup()
    applyCamera(map, { mode: 'bounds', places, fallbackBounds }, padding, false)
    const camera = cameraCalls()[0]
    if (places.length) {
      assert.equal(camera.name, 'easeTo')
      assert.equal(camera.args[0].zoom, BOUNDS_MAX_ZOOM)
    } else {
      assert.equal(camera.name, 'fitBounds')
      assert.deepEqual(camera.args[0], fallbackBounds)
    }
  }
})
