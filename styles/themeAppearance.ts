const THEME_STORAGE_KEY = 'maplibre-vike-theme-preference'
const DARK_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export const ThemePreference = {
  light: 'light',
  dark: 'dark',
} as const

export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference]

const themeNames = {
  [ThemePreference.light]: 'maplibre-vike-light',
  [ThemePreference.dark]: 'maplibre-vike-dark',
} as const

export const getCurrentThemePreference = (): ThemePreference => {
  if (typeof document === 'undefined') {
    return ThemePreference.light
  }

  return document.documentElement.getAttribute('data-theme') === themeNames.dark
    ? ThemePreference.dark
    : ThemePreference.light
}

const applyThemePreference = (themePreference: ThemePreference) => {
  document.documentElement.setAttribute('data-theme', themeNames[themePreference])
}

export const setThemePreference = (themePreference: ThemePreference) => {
  applyThemePreference(themePreference)

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
  } catch {
    // The selected theme still applies for this page view if storage is blocked.
  }
}

export const getThemeBootstrapScript = () => {
  return `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const darkThemeMediaQuery = ${JSON.stringify(DARK_THEME_MEDIA_QUERY)};
  const themes = ${JSON.stringify(themeNames)};

  const getSystemThemePreference = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia(darkThemeMediaQuery).matches
      ? 'dark'
      : 'light';

  try {
    const storedThemePreference = window.localStorage.getItem(storageKey);
    const themePreference =
      storedThemePreference === 'light' || storedThemePreference === 'dark'
        ? storedThemePreference
        : getSystemThemePreference();

    document.documentElement.setAttribute('data-theme', themes[themePreference]);
  } catch {
    document.documentElement.setAttribute(
      'data-theme',
      themes[getSystemThemePreference()]
    );
  }
})();`
}
