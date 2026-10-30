import { z } from 'astro/zod'
import { locales } from './i18n.ts'

const dataUrl = 'https://raw.githubusercontent.com/richard-unterberg/astro-maplibre/refs/heads/main/public/data/'
const overviewUrl = `${dataUrl}markers/overview.json`

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

type PlaceOverview = z.infer<typeof placeOverviewSchema>
type Place = z.infer<typeof placeSchema> & { categories: z.infer<typeof categorySchema>[] }

async function loadData<T>(url: string, schema: z.ZodType<T>, fetcher: typeof fetch): Promise<T> {
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

export function createPlacesLoader(fetcher: typeof fetch = fetch) {
  let snapshot: Promise<PlaceOverview[]> | undefined

  // Alle Seiten dieses Builds verwenden denselben validierten Datenstand.
  return () => {
    snapshot ??= loadData(overviewUrl, overviewSchema, fetcher)
    return snapshot
  }
}

export function createPlaceDetailsLoader(fetcher: typeof fetch = fetch) {
  const snapshots = new Map<string, Promise<Place>>()
  let categoriesSnapshot: Promise<z.infer<typeof categoriesSchema>> | undefined

  async function loadPlace(id: string): Promise<Place> {
    const url = `${dataUrl}markers/${id}.json`
    categoriesSnapshot ??= loadData(`${dataUrl}categories.json`, categoriesSchema, fetcher)
    const [place, categories] = await Promise.all([
      loadData(
        url,
        placeSchema.refine((place) => place.id === id, { message: `Expected place ID: ${id}` }),
        fetcher,
      ),
      categoriesSnapshot,
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

export const getPlaces = createPlacesLoader()
export const getPlace = createPlaceDetailsLoader()
