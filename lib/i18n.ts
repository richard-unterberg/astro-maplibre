export const languages = {
  en: 'English',
  de: 'Deutsch',
}

export const defaultLang = 'en'

export const locales = ['en', 'de'] as const
export type Locale = (typeof locales)[number]

export const localeDefault = 'en' satisfies Locale

export type LocaleString = {
  [localeDefault]: string
} & Partial<Record<Exclude<Locale, typeof localeDefault>, string>>

interface Dictionary {
  all: string
  back: string
  categories: string
  chemnitzLocation: string
  chemnitzMap: string
  closeCategoryMenu: string
  coordinates: string
  dock: string
  explorePlaces: string
  map: string
  mapZoom: string
  open: string
  openCategoryMenu: string
  overview: string
  startPage: {
    description: string
    title: string
  }
}

export type DictionaryKey = {
  [Key in keyof Dictionary]: Dictionary[Key] extends string ? Key : never
}[keyof Dictionary]

const dictionary = {
  de: {
    all: 'Alle',
    back: 'Zurueck',
    categories: 'Kategorien',
    chemnitzLocation: 'Chemnitzer Ort',
    chemnitzMap: 'Chemnitz-Karte',
    closeCategoryMenu: 'Kategorienmenue schliessen',
    coordinates: 'Koordinaten',
    dock: 'Andocken',
    explorePlaces: 'Orte erkunden',
    map: 'Karte',
    mapZoom: 'Kartenzoom',
    open: 'Oeffne',
    openCategoryMenu: 'Kategorienmenue oeffnen',
    overview: 'Uebersicht',
    startPage: {
      title: 'Interaktive Karte von Chemnitz',
      description:
        'Entdecke die interaktive Karte von Chemnitz mit vielfältigen Orten, übersichtlich kategorisiert und detailliert beschrieben. Erkunde die Stadt auf eine neue Art und Weise!',
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
    dock: 'Dock',
    explorePlaces: 'Explore places',
    map: 'Map',
    mapZoom: 'Map zoom',
    open: 'Open',
    openCategoryMenu: 'Open category menu',
    overview: 'Overview',
    startPage: {
      title: 'Interactive map of Chemnitz',
      description:
        'Discover the interactive map of Chemnitz with diverse locations, clearly categorized and described in detail. Explore the city in a new way!',
    },
  },
} satisfies Record<Locale, Dictionary>

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/')
  if (lang in dictionary) return lang as keyof typeof dictionary
  return defaultLang
}

export function useTranslations(lang: keyof typeof dictionary) {
  const localizedUI = dictionary[lang]
  return function t(key: keyof (typeof dictionary)[typeof defaultLang]) {
    return key in localizedUI ? localizedUI[key] : dictionary[defaultLang][key]
  }
}
