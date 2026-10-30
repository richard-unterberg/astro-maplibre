import { z } from 'astro/zod'
import { locales } from './i18n.ts'

const overviewUrl =
  'https://raw.githubusercontent.com/richard-unterberg/astro-maplibre/refs/heads/main/public/data/markers/overview.json'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a URL-safe ID')
const placeSchema = z.object({
  id: slug,
  title: z.record(z.enum(locales), z.string().trim().min(1)),
  // Die Overview verwendet die MapLibre-Reihenfolge: [longitude, latitude].
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  categoryIds: z.array(slug).min(1),
  detailZoom: z.number().min(0).max(24),
})

const overviewSchema = z
  .array(placeSchema)
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

export type Place = z.infer<typeof placeSchema>

export function createPlacesLoader(fetcher: typeof fetch = fetch) {
  let snapshot: Promise<Place[]> | undefined

  async function loadOverview(): Promise<Place[]> {
    try {
      const response = await fetcher(overviewUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)

      // Remote-Daten sind erst nach der Laufzeitvalidierung ein Place[].
      return overviewSchema.parse(await response.json())
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`Could not load place overview from ${overviewUrl}: ${reason}`, { cause })
    }
  }

  // Alle Seiten dieses Builds verwenden denselben validierten Datenstand.
  return () => {
    snapshot ??= loadOverview()
    return snapshot
  }
}

export const getPlaces = createPlacesLoader()
