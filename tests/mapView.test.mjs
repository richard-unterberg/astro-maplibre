import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterPlaces, getBounds, markerData } from '../map/view.ts'

const place = { id: 'a', title: 'A', coordinates: [12, 50], categoryIds: ['culture', 'history'], url: '/a/' }
const other = { ...place, id: 'b', categoryIds: ['nature'], coordinates: [10, 54] }

test('category membership includes secondary categories and deduplicates IDs', () => {
  assert.deepEqual(filterPlaces([place, other, place], 'history'), [place])
  assert.deepEqual(filterPlaces([place, other], 'nature'), [other])
  assert.deepEqual(filterPlaces([place, other], 'new-category'), [])
})

test('bounds use independent longitude and latitude extrema, including degenerate and empty sets', () => {
  assert.deepEqual(getBounds([place, other, { coordinates: [15, 48] }]), [
    [10, 48],
    [15, 54],
  ])
  assert.deepEqual(getBounds([place, place]), [
    [12, 50],
    [12, 50],
  ])
  assert.equal(getBounds([]), undefined)
})

test('marker colors use the primary category, with a neutral fallback; selection clears between views', () => {
  const selected = markerData({ mode: 'detail', places: [place], selectedId: place.id })
  assert.equal(selected.features[0].properties.selected, true)
  assert.equal(selected.features[0].properties.color, '#7c3aed')
  const filtered = markerData({ mode: 'bounds', places: filterPlaces([place], 'history') })
  assert.equal(filtered.features[0].properties.selected, false)
  assert.equal(filtered.features[0].properties.color, '#7c3aed')
  assert.equal(
    markerData({ mode: 'bounds', places: [{ ...place, categoryIds: ['new-id'] }] }).features[0].properties.color,
    '#64748b',
  )
  assert.deepEqual(markerData({ mode: 'bounds', places: [] }).features, [])
})
