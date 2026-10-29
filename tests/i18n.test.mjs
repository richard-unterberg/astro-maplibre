import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createTranslator, getLocaleStaticPaths, resolveLocale, useTranslations } from '../lib/i18n.ts'

test('generates the default language without a prefix and German with a prefix', () => {
  assert.deepEqual(getLocaleStaticPaths(), [{ params: { locale: undefined } }, { params: { locale: 'de' } }])
})

test('resolves supported Astro locales and falls back to English', () => {
  assert.equal(resolveLocale('de'), 'de')
  assert.equal(resolveLocale('en'), 'en')
  assert.equal(resolveLocale(undefined), 'en')
  assert.equal(resolveLocale('fr'), 'en')
})

test('translates flat and nested keys in both languages', () => {
  const en = useTranslations('en')
  const de = useTranslations('de')

  assert.equal(en('map'), 'Map')
  assert.equal(de('map'), 'Karte')
  assert.equal(en('startPage.title'), 'Welcome to astro-maplibre')
  assert.equal(de('startPage.title'), 'Willkommen zu astro-maplibre')
  assert.equal(en('startPage.description'), '')
  assert.equal(de('startPage.description'), '')
  assert.equal(en('mapPage.title'), 'Interactive map of Chemnitz')
  assert.equal(de('mapPage.title'), 'Interaktive Karte von Chemnitz')
  assert.match(en('mapPage.description'), /^Discover the interactive map/)
  assert.match(de('mapPage.description'), /^Entdecke die interaktive Karte/)
})

test('falls back per missing value while keeping translated siblings and empty strings', () => {
  const fallback = {
    map: 'Map',
    startPage: { title: 'English title', description: 'English description' },
    otherPage: { title: 'Other title' },
  }
  const t = createTranslator(fallback, { map: '', startPage: { title: 'Deutscher Titel' } })

  assert.equal(t('map'), '')
  assert.equal(t('startPage.title'), 'Deutscher Titel')
  assert.equal(t('startPage.description'), 'English description')
  assert.equal(t('otherPage.title'), 'Other title')
})

test('reports invalid keys and object-valued keys at runtime', () => {
  const t = useTranslations('en')

  for (const key of ['missing', 'startPage.missing', 'startPage', 'toString', '__proto__']) {
    assert.throws(() => t(key), { message: `Missing translation: ${key}` })
  }
})

test('accepts string-valued keys and rejects invalid keys in TypeScript', () => {
  const probePath = fileURLToPath(new URL('../__i18n_type_test__.ts', import.meta.url))
  const probeSource = `
    import { createTranslator, useTranslations } from './lib/i18n';
    const t = useTranslations('de');
    const flat: string = t('map');
    const title: string = t('startPage.title');
    const description: string = t('startPage.description');
    // @ts-expect-error Objects are not translation strings.
    t('startPage');
    // @ts-expect-error Nested keys must exist.
    t('startPage.missing');
    // @ts-expect-error Top-level keys must exist.
    t('missing');
    // @ts-expect-error Locales must be supported.
    useTranslations('fr');
    const nested = createTranslator({ page: { section: { title: 'Title' } } }, { page: {} });
    const deep: string = nested('page.section.title');
    // @ts-expect-error Nested objects are not translation strings.
    nested('page.section');
  `
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) =>
    file === probePath
      ? ts.createSourceFile(file, probeSource, languageVersion, true)
      : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile)

  const program = ts.createProgram([probePath], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
    [],
  )
})
