import { z } from 'astro/zod'
import { locales } from './i18n.ts'

const repository = 'richard-unterberg/astro-maplibre'
const rawRepositoryUrl = `https://raw.githubusercontent.com/${repository}/`
const dataUrl = `${rawRepositoryUrl}refs/heads/main/public/data/`
const overviewUrl = `${dataUrl}markers/overview.json`
const revisionUrl = `https://api.github.com/repos/${repository}/git/ref/heads/main`

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a URL-safe ID')
const localizedText = z.record(z.enum(locales), z.string().trim().min(1))
const placeOverviewSchema = z.object({
  id: slug,
  title: localizedText,
  // Die Overview verwendet die MapLibre-Reihenfolge: [longitude, latitude].
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  categoryIds: z.array(slug).min(1),
  detailZoom: z.number().min(0).max(24),
})

const overviewSchema = z
  .array(placeOverviewSchema)
  .min(1)
  .superRefine((places, context) => {
    const ids = new Set<string>()

    for (const [index, place] of places.entries()) {
      if (ids.has(place.id)) {
        context.addIssue({ code: 'custom', path: [index, 'id'], message: `Duplicate place ID: ${place.id}` })
      }
      ids.add(place.id)
    }
  })

const placeSchema = placeOverviewSchema.extend({ description: localizedText })
const categorySchema = z.object({ id: slug, title: localizedText, description: localizedText })
const categoriesSchema = z
  .array(categorySchema)
  .min(1)
  .refine((categories) => new Set(categories.map(({ id }) => id)).size === categories.length, {
    message: 'Duplicate category ID',
  })

export type PlaceOverview = z.infer<typeof placeOverviewSchema>
export type Category = z.infer<typeof categorySchema>
type Place = z.infer<typeof placeSchema> & { categories: Category[] }

const loadData = async <T>(url: string, schema: z.ZodType<T>, fetcher: typeof fetch): Promise<T> => {
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)

    return schema.parse(await response.json())
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not load place data from ${url}: ${reason}`, { cause })
  }
}

const createPlacesLoader = (fetcher: typeof fetch = fetch) => {
  let snapshot: Promise<PlaceOverview[]> | undefined

  // Alle Seiten dieses Builds verwenden denselben validierten Datenstand.
  return () => {
    snapshot ??= loadData(overviewUrl, overviewSchema, fetcher)
    return snapshot
  }
}

const createCategoriesLoader = (fetcher: typeof fetch = fetch) => {
  let snapshot: Promise<Category[]> | undefined
  return () => {
    snapshot ??= loadData(`${dataUrl}categories.json`, categoriesSchema, fetcher)
    return snapshot
  }
}

const createPlaceDetailsLoader = (fetcher: typeof fetch = fetch, loadCategories = createCategoriesLoader(fetcher)) => {
  const snapshots = new Map<string, Promise<Place>>()

  async function loadPlace(id: string): Promise<Place> {
    const url = `${dataUrl}markers/${id}.json`
    const [place, categories] = await Promise.all([
      loadData(
        url,
        placeSchema.refine((place) => place.id === id, { message: `Expected place ID: ${id}` }),
        fetcher,
      ),
      loadCategories(),
    ])

    return {
      ...place,
      categories: place.categoryIds.map((categoryId) => {
        const category = categories.find(({ id }) => id === categoryId)
        if (!category) throw new Error(`Unknown category ID "${categoryId}" in ${url}`)
        return category
      }),
    }
  }

  return (id: string) => {
    const validId = slug.parse(id)
    let snapshot = snapshots.get(validId)
    if (!snapshot) {
      snapshot = loadPlace(validId)
      snapshots.set(validId, snapshot)
    }
    return snapshot
  }
}

const createPlaceDataFetcher = (fetcher: typeof fetch = fetch): typeof fetch => {
  let revision: Promise<string> | undefined

  return async (input, options) => {
    const request = new Request(input, options)
    if (!request.url.startsWith(dataUrl)) return fetcher(request)

    // Resolve main once so cached categories and later detail requests use the same commit.
    revision ??= loadData(
      revisionUrl,
      z.object({ object: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }) }),
      fetcher,
    ).then(({ object }) => object.sha)

    const url = `${rawRepositoryUrl}${await revision}/public/data/${request.url.slice(dataUrl.length)}`
    return fetcher(new Request(url, request))
  }
}

const fetchPlaceData = createPlaceDataFetcher()
export const getPlaces = createPlacesLoader(fetchPlaceData)
export const getCategories = createCategoriesLoader(fetchPlaceData)
export const getPlace = createPlaceDetailsLoader(fetchPlaceData, getCategories)
