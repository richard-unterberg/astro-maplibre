import { ThemePreference, type ThemePreference as ThemePreferenceValue } from '@styles/themeAppearance'

const MAPTILER_API_KEY = import.meta.env.MAPTILER_API_KEY || 'nonono'

const mapStyleIds = {
  [ThemePreference.light]: import.meta.env.MAPTILER_LIGHT_THEME,
  [ThemePreference.dark]: import.meta.env.MAPTILER_DARK_THEME,
} as const satisfies Record<ThemePreferenceValue, string>

export const getMapStyleUrl = (themePreference: ThemePreferenceValue) => {
  const styleId = mapStyleIds[themePreference]

  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MAPTILER_API_KEY}`
}
