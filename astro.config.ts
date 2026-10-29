import tailwindcss from '@tailwindcss/vite'
import { astroBeastiesOutput } from '@unterberg/vite-beasties-output/astro'
import { defineConfig } from 'astro/config'
import { defaultLocale, locales } from './lib/i18n'

export default defineConfig({
  site: 'https://richard-unterberg.github.io',
  base: '/astro-maplibre/',
  trailingSlash: 'always',
  srcDir: '.',
  i18n: {
    locales: [...locales],
    defaultLocale,
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    astroBeastiesOutput({
      outputDirectory: 'dist',
      include: ['dist/**/*.html'],
      beastiesOptions: {
        // Astro references these from separate inline styles; keep them available during head swaps.
        keyframes: 'all',
        allowRules: [
          /data-theme=.*dark/,
          /data-theme=.*light/,
          /^:root:has\(input\.theme-controller/,
          /^:where\(:root\)$/,
          // Transition states and pseudo-elements are absent from the static HTML.
          /::view-transition-|data-astro-transition/,
          // Match base and variant-prefixed Tailwind sizing utilities, e.g.
          // `.h-*`, `.min-h-*`, `.sm\:w-*`, and `.lg\:min-h-*`.
          /(?:^\.|\\:)(?:h|min-h|max-h|w|min-w|max-w|basis)-/,
          /(?:^\.|\\:)prose-container/,
        ],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
