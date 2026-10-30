export const locales = ['en', 'de'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale = 'en' satisfies Locale

export function resolveLocale(locale: string | undefined): Locale {
  return locales.find((supportedLocale) => supportedLocale === locale) ?? defaultLocale
}

export function getLocaleStaticPaths() {
  return locales.map((locale) => ({
    params: { locale: locale === defaultLocale ? undefined : locale },
  }))
}

type Page = {
  description: string
  title: string
}

interface Dictionary {
  all: string
  back: string
  categories: string
  chemnitzLocation: string
  chemnitzMap: string
  closeCategoryMenu: string
  coordinates: string
  darkTheme: string
  dock: string
  explorePlaces: string
  lightTheme: string
  map: string
  mapZoom: string
  open: string
  openCategoryMenu: string
  overview: string
  theme: string
  startPage: Page
  mapPage: Page
}

type TranslationKey<T> = {
  [Key in keyof T & string]: T[Key] extends string ? Key : `${Key}.${TranslationKey<T[Key]>}`
}[keyof T & string]

type PartialDictionary<T> = {
  [Key in keyof T]?: T[Key] extends string ? T[Key] : PartialDictionary<T[Key]>
}

type Dictionaries = Record<Locale, PartialDictionary<Dictionary>> & Record<typeof defaultLocale, Dictionary>

const dictionary: Dictionaries = {
  de: {
    all: 'Alle',
    back: 'Zurueck',
    categories: 'Kategorien',
    chemnitzLocation: 'Chemnitzer Ort',
    chemnitzMap: 'Chemnitz-Karte',
    closeCategoryMenu: 'Kategorienmenue schliessen',
    coordinates: 'Koordinaten',
    darkTheme: 'Dunkel',
    dock: 'Andocken',
    explorePlaces: 'Orte erkunden',
    lightTheme: 'Hell',
    map: 'Karte',
    mapZoom: 'Kartenzoom',
    open: 'Öffne',
    openCategoryMenu: 'Kategorienmenue öffnen',
    overview: 'Übersicht',
    theme: 'Farbschema',
    mapPage: {
      title: 'Interaktive Karte von Chemnitz',
      description:
        'Entdecke die interaktive Karte von Chemnitz mit vielfältigen Orten, übersichtlich kategorisiert und detailliert beschrieben. Erkunde die Stadt auf eine neue Art und Weise!',
    },
    startPage: {
      title: 'Willkommen zu astro-maplibre',
      description: '',
    },
  },
  en: {
    all: 'All',
    back: 'Back',
    categories: 'Categories',
    chemnitzLocation: 'Chemnitz location',
    chemnitzMap: 'Chemnitz map',
    closeCategoryMenu: 'Close category menu',
    coordinates: 'Coordinates',
    darkTheme: 'Dark',
    dock: 'Dock',
    explorePlaces: 'Explore places',
    lightTheme: 'Light',
    map: 'Map',
    mapZoom: 'Map zoom',
    open: 'Open',
    openCategoryMenu: 'Open category menu',
    overview: 'Overview',
    theme: 'Theme',
    mapPage: {
      title: 'Interactive map of Chemnitz',
      description:
        'Discover the interactive map of Chemnitz with diverse locations, clearly categorized and described in detail. Explore the city in a new way!',
    },
    startPage: {
      title: 'Welcome to astro-maplibre',
      description: '',
    },
  },
}

function readTranslation(source: object, key: string): string | undefined {
  let value: unknown = source

  for (const segment of key.split('.')) {
    if (typeof value !== 'object' || value === null || !Object.hasOwn(value, segment)) return undefined
    value = (value as Record<string, unknown>)[segment]
  }

  return typeof value === 'string' ? value : undefined
}

export function createTranslator<T extends object>(fallback: T, localized: PartialDictionary<T>) {
  return function t(key: TranslationKey<T>): string {
    const translation = readTranslation(localized, key) ?? readTranslation(fallback, key)
    if (translation === undefined) throw new Error(`Missing translation: ${key}`)
    return translation
  }
}

export function useTranslations(locale: Locale) {
  return createTranslator<Dictionary>(dictionary[defaultLocale], dictionary[locale])
}
