import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PartialTranslations } from '../src/i18n/translations.ts'
import { defaultLocale, locales, type Locale } from '../src/lib/locale.ts'
import { shellPaths } from '../src/lib/routes.ts'
import en from '../src/locales/en.ts'
import fr from '../src/locales/fr.ts'
import vi from '../src/locales/vi.ts'
import { publishedGambitIds } from '../tools/catalogue/published-ids.ts'
import {
  catalogueEntries,
  metadataGaps,
  shellHtml,
  shellMetadata,
  type EntryFacts,
  type LocaleCopy,
  type ShellMetadata,
} from '../tools/shells/metadata.ts'

/**
 * Post-build step for ADR-0009: emit a real `index.html` at every route path so GitHub
 * Pages answers a deep link with a genuine HTTP 200 instead of the `404.html` trick's
 * 404, and without a hash in the URL.
 *
 * The route set is finite and known at build time, but the shells are **not** copies of
 * each other (#17). Each one gets its own `lang`, `<title>`, description, `og:*` tags,
 * `hreflang` alternates and canonical, built from the compiled catalogue in that shell's
 * own language. `tools/shells/metadata.ts` decides what each head says; this script does
 * the reading, the writing, and the assertion that every shell got one.
 *
 * **The gambit ids come from the built catalogue.** Until #13 nothing linked to a gambit,
 * so no shell for one had to exist and none was emitted. The catalogue page links to
 * every published entry, and on a static host a link to a path with no file behind it is
 * an HTTP 404 — so the moment that page shipped, 700 links would have become 700 broken
 * ones. Reading the ids back off `dist/catalogue/` rather than from a committed list is
 * what makes the shells and the links the same set by construction.
 */

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

/** Both must match `vite.config.ts`, which is what actually rewrote the asset URLs. */
const basePath = process.env.BASE_PATH ?? '/chess-gambits/'

/**
 * Where the site answers, for the one thing a relative URL cannot express: an unfurler
 * reading `og:url` out of a crawled document has no page to resolve it against. It is
 * configuration for the same reason the base path is (ADR-0009) — a custom domain later
 * moves both — and defaults to the published site in `docs/PROJECT-PLAN.md`.
 */
const origin = process.env.SITE_ORIGIN ?? 'https://chan-nguyen.github.io'

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const writeShell = async (target: string, html: string): Promise<void> => {
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, html, 'utf8')
}

/**
 * One locale's published catalogue, read from `dist/` rather than from `public/` because
 * `dist/` is what was published: a stale `public/catalogue/` that Vite had not copied
 * would otherwise produce shells for a catalogue nobody downloads.
 */
const readCatalogue = async (locale: Locale): Promise<string> => {
  const path = join(distDir, 'catalogue', `catalogue.${locale}.json`)

  if (!(await exists(path))) {
    throw new Error(
      `No ${path}. Run \`npm run catalogue\` and \`vite build\` before this script — ` +
        'without it every gambit link on the catalogue page would 404 on the host.',
    )
  }

  return readFile(path, 'utf8')
}

/**
 * Entry ids are locale-independent — the three payloads differ only in names — so one
 * file answers for all three. Which file is checked against the other two below, by
 * looking every id up in each locale's names.
 */
const gambitIds = (json: string): readonly string[] => {
  const result = publishedGambitIds(json)
  if (!result.ok) throw new Error(`catalogue.${defaultLocale}.json ${result.reason}.`)

  if (result.ids.length === 0) {
    throw new Error(
      `catalogue.${defaultLocale}.json published no entries. The catalogue page links to ` +
        'whatever is in that file, so an empty one means either the catalogue build failed ' +
        'silently or this script is reading the wrong file.',
    )
  }

  return result.ids
}

const entryFacts = (locale: Locale, json: string): ReadonlyMap<string, EntryFacts> => {
  const result = catalogueEntries(json)
  if (!result.ok) throw new Error(`catalogue.${locale}.json ${result.reason}.`)
  return result.entries
}

/**
 * The head's words, from the translation catalogues rather than from strings invented
 * here. `en.ts` and `fr.ts` are subsets of `vi.ts` by design (ADR-0006), so a key either
 * of them has not been given yet falls back to the source locale — the same rule the
 * interface itself follows.
 */
const bundles: Readonly<Record<Locale, PartialTranslations>> = { vi, en, fr }

const copyFor = (locale: Locale): LocaleCopy => {
  const bundle = bundles[locale]

  return {
    catalogue: bundle.catalogue?.heading ?? vi.catalogue.heading,
    catalogueIntro: bundle.catalogue?.intro ?? vi.catalogue.intro,
    about: bundle.nav?.about ?? vi.nav.about,
    tagline: bundle.home?.tagline ?? vi.home.tagline,
  }
}

const byLocale = <T>(value: (locale: Locale) => T): Readonly<Record<Locale, T>> => ({
  vi: value('vi'),
  en: value('en'),
  fr: value('fr'),
})

/**
 * AC 6, and the only check here that scales: 2,109 shells make a spot check meaningless,
 * so every emitted file is read back off disk and every piece of its metadata is looked
 * for by value. Reading, not trusting the string that was written — that is what makes
 * this cover the write step too.
 */
const verify = async (files: ReadonlyMap<string, ShellMetadata>): Promise<void> => {
  const checked = await Promise.all(
    [...files].map(async ([file, data]) => ({
      file,
      gaps: metadataGaps(await readFile(join(distDir, file), 'utf8'), data),
    })),
  )

  const incomplete = checked.filter(({ gaps }) => gaps.length > 0)
  if (incomplete.length > 0) {
    const named = incomplete
      .slice(0, 5)
      .map(({ file, gaps }) => `  ${file} is missing ${gaps.join(', ')}`)
      .join('\n')

    throw new Error(
      `${incomplete.length} of ${files.size} emitted documents are missing metadata:\n${named}\n` +
        'Every published route needs its own language, title and link preview (#17); a ' +
        'document without them is the byte-identical shell this ticket replaced.',
    )
  }
}

const main = async (): Promise<void> => {
  const startedAt = performance.now()
  const indexHtml = join(distDir, 'index.html')

  if (!(await exists(indexHtml))) {
    throw new Error(`No ${indexHtml} to copy. Run \`vite build\` before this script.`)
  }

  if (!/^\/(?:[^/]+\/)*$/.test(basePath)) {
    throw new Error(`BASE_PATH \`${basePath}\` must start and end with a slash.`)
  }
  if (!/^https?:\/\/[^/]+$/.test(origin)) {
    throw new Error(`SITE_ORIGIN \`${origin}\` must be a scheme and host with no trailing slash.`)
  }

  // Asset URLs in the built index.html are absolute and already carry the base path, so
  // the same bytes work at any depth. Assert it rather than trust it: a relative asset
  // URL would load on `/vi/about` and 404 on `/vi/gambits/evans-gambit`.
  const template = await readFile(indexHtml, 'utf8')
  const relativeAsset = /(?:src|href)="(?!https?:|\/|data:|#)/.exec(template)
  if (relativeAsset !== null) {
    throw new Error(
      `dist/index.html contains a relative asset URL (${relativeAsset[0]}), which would ` +
        `break in a shell at a deeper path. Check the Vite \`base\` setting.`,
    )
  }

  const [viJson, enJson, frJson] = await Promise.all([
    readCatalogue('vi'),
    readCatalogue('en'),
    readCatalogue('fr'),
  ])
  const json: Readonly<Record<Locale, string>> = { vi: viJson, en: enJson, fr: frJson }
  const ids = gambitIds(json[defaultLocale])

  const metadata = shellMetadata({
    gambitIds: ids,
    entries: byLocale((locale) => entryFacts(locale, json[locale])),
    copy: byLocale(copyFor),
    basePath,
    origin,
  })
  if (!metadata.ok) throw new Error(metadata.reason)

  /**
   * The coverage assertion (AC 6). `routes.ts` says which shells a build owes and the
   * metadata is enumerated independently of it, so this is the one place the two have to
   * agree: a route added there and forgotten here would otherwise publish a shell with
   * the placeholder head, silently, at a URL nobody checked.
   */
  const paths = shellPaths(ids)
  const owed = new Set(paths)
  const given = new Set(metadata.shells.keys())
  const missing = [...owed].filter((path) => !given.has(path))
  const extra = [...given].filter((path) => !owed.has(path))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Metadata covers ${given.size} of the ${owed.size} shells this build owes. ` +
        `Missing: ${missing.slice(0, 3).join(', ') || 'none'}. ` +
        `Unexpected: ${extra.slice(0, 3).join(', ') || 'none'}.`,
    )
  }

  const render = (data: ShellMetadata): string => {
    const result = shellHtml(template, data)
    if (!result.ok) throw new Error(`dist/index.html ${result.reason}.`)
    return result.html
  }

  /**
   * Written concurrently rather than one at a time. At 700 entries this is 2,100 gambit
   * shells, and serially that is seconds of wall clock on every build, nearly all of it
   * spent waiting on the filesystem rather than doing anything.
   */
  const written = new Map<string, ShellMetadata>()
  let bytes = 0
  await Promise.all(
    paths.map(async (path) => {
      const data = metadata.shells.get(path)
      if (data === undefined) throw new Error(`No metadata for ${path}, after asserting there is.`)
      const html = render(data)
      bytes += Buffer.byteLength(html, 'utf8')
      written.set(join(path, 'index.html'), data)
      await writeShell(join(distDir, path, 'index.html'), html)
    }),
  )

  /**
   * The site root last, because it was the template every shell above was cut from. `/`
   * is a shareable URL like any other and Vite leaves it with the placeholder head, so it
   * gets the same treatment — and `404.html`, which a genuinely unknown path is served
   * with, is that document rather than a page titled `app`.
   */
  const rootHtml = render(metadata.root)
  bytes += Buffer.byteLength(rootHtml, 'utf8') * 2
  await writeShell(indexHtml, rootHtml)
  await writeShell(join(distDir, '404.html'), rootHtml)
  written.set('index.html', metadata.root)
  written.set('404.html', metadata.root)

  await verify(written)

  // Ships from `public/`. Without it GitHub Pages runs Jekyll over the output and drops
  // Vite's underscore-prefixed chunk filenames.
  if (!(await exists(join(distDir, '.nojekyll')))) {
    throw new Error('dist/.nojekyll is missing. It should be copied from public/.nojekyll.')
  }

  const seconds = ((performance.now() - startedAt) / 1000).toFixed(2)

  process.stdout.write(
    `Emitted ${paths.length} route shells for ${ids.length} published gambits, plus the site ` +
      `root and 404.html, and verified .nojekyll — ${written.size} documents, each with its ` +
      `own lang, title, description, og:* and ${locales.length + 1} hreflang alternates, all ` +
      `canonical under ${origin}${basePath} — ${(bytes / 1024 / 1024).toFixed(2)}MB of HTML ` +
      `in ${seconds}s\n`,
  )
}

await main()
