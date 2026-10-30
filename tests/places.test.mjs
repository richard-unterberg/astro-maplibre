import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createCategoriesLoader, createPlaceDetailsLoader, createPlacesLoader } from '../lib/places.ts'
import { markerData } from '../map/view.ts'

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

const dataUrl = overviewUrl.slice(0, -'markers/overview.json'.length)
const categories = ['history', 'culture'].map((id) => ({
  id,
  title: { de: `Kategorie ${id}`, en: `Category ${id}` },
  description: { de: `Beschreibung ${id}`, en: `Description ${id}` },
}))
const description = { de: 'Ausführliche Ortsbeschreibung.', en: 'Full place description.' }

test('loads full entries separately, resolving categories and sharing each snapshot across locales', async () => {
  const requests = []
  const load = createPlaceDetailsLoader(async (url, options) => {
    requests.push({ url, options })
    if (url === `${dataUrl}categories.json`) return Response.json(categories)
    const id = url.split('/').at(-1).replace('.json', '')
    return Response.json(place({ id, description }))
  })

  assert.equal(requests.length, 0)
  const [first, repeated, other] = await Promise.all([
    load('karl-marx-monument'),
    load('karl-marx-monument'),
    load('theaterplatz'),
  ])

  assert.strictEqual(first, repeated)
  assert.strictEqual(await load('karl-marx-monument'), first)
  assert.deepEqual(first.description, description)
  assert.deepEqual(first.categories, categories)
  assert.equal(other.id, 'theaterplatz')
  assert.deepEqual(requests.map(({ url }) => url).sort(), [
    `${dataUrl}categories.json`,
    `${dataUrl}markers/karl-marx-monument.json`,
    `${dataUrl}markers/theaterplatz.json`,
  ])
  for (const { options } of requests) {
    assert.equal(options.headers.Accept, 'application/json')
    assert.ok(options.signal instanceof AbortSignal)
  }
})

test('rejects unsafe detail IDs before making any request', () => {
  let requests = 0
  const load = createPlaceDetailsLoader(async () => {
    requests++
    return Response.json({})
  })
  for (const id of ['../escape', 'nested/place', '', 'place?query']) {
    assert.throws(() => load(id), /Expected a URL-safe ID/)
  }
  assert.equal(requests, 0)
})

test('rejects invalid or inconsistent details and categories', async (t) => {
  const invalid = [
    { name: 'missing description', detail: place(), error: /description/ },
    { name: 'missing description translation', detail: place({ description: { en: 'Text' } }), error: /description/ },
    { name: 'empty description', detail: place({ description: { en: ' ', de: 'Text' } }), error: /description/ },
    { name: 'mismatched ID', detail: place({ id: 'theaterplatz', description }), error: /Expected place ID/ },
    {
      name: 'unknown category',
      detail: place({ description, categoryIds: ['unknown'] }),
      error: /Unknown category ID/,
    },
    { name: 'empty categories', categories: [], error: /Too small/ },
    { name: 'duplicate categories', categories: [categories[0], categories[0]], error: /Duplicate category ID/ },
    {
      name: 'missing category title translation',
      categories: [{ ...categories[0], title: { en: 'History' } }],
      error: /title/,
    },
    {
      name: 'missing category description',
      categories: [{ ...categories[0], description: undefined }],
      error: /description/,
    },
  ]

  for (const sample of invalid) {
    await t.test(sample.name, async () => {
      const load = createPlaceDetailsLoader(async (url) =>
        Response.json(
          url === `${dataUrl}categories.json`
            ? (sample.categories ?? categories)
            : (sample.detail ?? place({ description })),
        ),
      )
      await assert.rejects(
        () => load('karl-marx-monument'),
        (error) => {
          assert.ok(error.message.includes(dataUrl))
          assert.match(error.message, sample.error)
          return true
        },
      )
    })
  }
})

test('reports failed detail and category requests with their source URL', async (t) => {
  for (const failedUrl of [`${dataUrl}categories.json`, `${dataUrl}markers/karl-marx-monument.json`]) {
    await t.test(failedUrl, async () => {
      const load = createPlaceDetailsLoader(async (url) => {
        if (url === failedUrl) return new Response('Unavailable', { status: 503 })
        return Response.json(url.endsWith('categories.json') ? categories : place({ description }))
      })

      await assert.rejects(
        () => load('karl-marx-monument'),
        (error) => {
          assert.ok(error.message.includes(failedUrl))
          assert.match(error.cause.message, /HTTP 503/)
          return true
        },
      )
    })
  }
})

test('repository keeps 22 places in four categories with matching single-category details', async () => {
  const fetcher = async (url) =>
    new Response(await readFile(new URL(`../public/data/${url.slice(dataUrl.length)}`, import.meta.url), 'utf8'))
  const [overview, categories, files] = await Promise.all([
    createPlacesLoader(fetcher)(),
    createCategoriesLoader(fetcher)(),
    readdir(new URL('../public/data/markers/', import.meta.url)),
  ])
  const load = createPlaceDetailsLoader(fetcher)
  const details = await Promise.all(overview.map(({ id }) => load(id)))

  assert.equal(overview.length, 22)
  assert.equal(categories.length, 4)
  assert.deepEqual(
    files.filter((file) => file.endsWith('.json') && file !== 'overview.json').sort(),
    overview.map(({ id }) => `${id}.json`).sort(),
  )
  assert.deepEqual(new Set(overview.flatMap(({ categoryIds }) => categoryIds)), new Set(categories.map(({ id }) => id)))
  assert.equal(details.length, overview.length)
  for (const [index, detail] of details.entries()) {
    assert.equal(overview[index].categoryIds.length, 1)
    assert.equal(detail.id, overview[index].id)
    assert.deepEqual(detail.coordinates, overview[index].coordinates)
    assert.deepEqual(detail.categoryIds, overview[index].categoryIds)
    assert.deepEqual(
      detail.categories.map(({ id }) => id),
      detail.categoryIds,
    )
    for (const locale of ['en', 'de']) {
      assert.ok(detail.description[locale])
      assert.ok(detail.categories.every((category) => category.title[locale] && category.description[locale]))
    }
  }
  const { features } = markerData({ mode: 'bounds', places: overview })
  assert.ok(features.every(({ properties }) => properties.color !== '#64748b'))
})

test('public categories loader shares its promise and snapshot with the detail loader', async () => {
  const { createCategoriesLoader } = await import('../lib/places.ts')
  let categoryRequests = 0
  const fetcher = async (url) => {
    if (url.endsWith('categories.json')) {
      categoryRequests++
      return Response.json(categories)
    }
    return Response.json(place({ description }))
  }
  const loadCategories = createCategoriesLoader(fetcher)
  const loadDetails = createPlaceDetailsLoader(fetcher, loadCategories)
  assert.strictEqual(loadCategories(), loadCategories())
  const [loaded, detail] = await Promise.all([loadCategories(), loadDetails('karl-marx-monument')])
  assert.deepEqual(loaded, categories)
  assert.strictEqual(detail.categories[0], loaded[0])
  assert.equal(categoryRequests, 1)
})

test('public categories loader validates and caches failures with a descriptive source', async () => {
  const { createCategoriesLoader } = await import('../lib/places.ts')
  for (const response of [
    Response.json([categories[0], categories[0]]),
    new Response('{broken'),
    new Response('', { status: 503 }),
  ]) {
    let requests = 0
    const load = createCategoriesLoader(async () => {
      requests++
      return response
    })
    const promise = load()
    await assert.rejects(promise, /Could not load place data from .*categories.json/)
    assert.strictEqual(load(), promise)
    assert.equal(requests, 1)
  }
})
