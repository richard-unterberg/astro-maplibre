import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPlacesLoader } from '../lib/places.ts'

const overviewUrl =
  'https://raw.githubusercontent.com/richard-unterberg/astro-maplibre/refs/heads/main/public/data/markers/overview.json'

function place(overrides = {}) {
  return {
    id: 'karl-marx-monument',
    title: { de: 'Karl-Marx-Monument', en: 'Karl Marx Monument' },
    coordinates: [12.9252, 50.8342],
    categoryIds: ['history', 'culture'],
    detailZoom: 15,
    ...overrides,
  }
}

test('fetches the raw GitHub overview once and shares the snapshot across consumers', async () => {
  const data = [place(), place({ id: 'theaterplatz' })]
  const requests = []
  const load = createPlacesLoader(async (url, options) => {
    requests.push({ url, options })
    return Response.json(data)
  })

  const [first, second] = await Promise.all([load(), load()])

  assert.deepEqual(first, data)
  assert.strictEqual(second, first)
  assert.strictEqual(await load(), first)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, overviewUrl)
  assert.equal(requests[0].options.headers.Accept, 'application/json')
  assert.ok(requests[0].options.signal instanceof AbortSignal)
})

test('rejects HTTP failures with the source URL and status', async () => {
  const load = createPlacesLoader(async () => new Response('Unavailable', { status: 503 }))

  await assert.rejects(load, (error) => {
    assert.ok(error.message.includes(overviewUrl))
    assert.match(error.cause.message, /HTTP 503/)
    return true
  })
})

test('preserves network and timeout errors as the cause', async () => {
  for (const cause of [new TypeError('Network unavailable'), new DOMException('Timed out', 'TimeoutError')]) {
    const load = createPlacesLoader(async () => {
      throw cause
    })

    await assert.rejects(load, (error) => {
      assert.ok(error.message.includes(overviewUrl))
      assert.strictEqual(error.cause, cause)
      return true
    })
  }
})

test('rejects malformed JSON', async () => {
  const load = createPlacesLoader(async () => new Response('{broken'))

  await assert.rejects(load, (error) => {
    assert.ok(error.message.includes(overviewUrl))
    assert.ok(error.cause instanceof SyntaxError)
    return true
  })
})

test('rejects duplicate IDs instead of generating conflicting routes', async () => {
  const load = createPlacesLoader(async () => Response.json([place(), place()]))

  await assert.rejects(load, (error) => {
    assert.match(error.cause.message, /Duplicate place ID: karl-marx-monument/)
    return true
  })
})

test('rejects invalid overview data instead of silently dropping places', async (t) => {
  const invalid = {
    'non-array response': {},
    'empty overview': [],
    'missing ID': [place({ id: undefined })],
    'path traversal ID': [place({ id: '../escape' })],
    'nested path ID': [place({ id: 'nested/place' })],
    'empty title': [place({ title: { en: ' ', de: 'Ort' } })],
    'missing translation': [place({ title: { en: 'Place' } })],
    'invalid longitude': [place({ coordinates: [181, 50] })],
    'invalid latitude': [place({ coordinates: [12, -91] })],
    'missing coordinate': [place({ coordinates: [12] })],
    'empty categories': [place({ categoryIds: [] })],
    'invalid zoom': [place({ detailZoom: -1 })],
  }

  for (const [name, data] of Object.entries(invalid)) {
    await t.test(name, async () => {
      const load = createPlacesLoader(async () => Response.json(data))
      await assert.rejects(load, (error) => {
        assert.ok(error.message.includes(overviewUrl))
        assert.equal(error.cause.name, 'ZodError')
        return true
      })
    })
  }
})
