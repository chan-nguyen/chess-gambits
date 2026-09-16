import { defaultLocale, locales, type Locale } from '../../src/lib/locale.ts'
import { routePath, routeSegments } from '../../src/lib/routes.ts'
import { siteName } from '../../src/lib/site.ts'

/**
 * The head of every pre-built route shell (#17), as data and as markup.
 *
 * ADR-0009 emits one `index.html` per route. Copying the same bytes to all of them would
 * publish `<html lang="vi">` on every French and English route until JavaScript runs —
 * a WCAG 3.1.1 *Language of Page* failure at **Level A** — and would give two thousand
 * distinct pages the same `<title>`, so browser history, bookmarks and every link pasted
 * into Slack would say nothing about which gambit the link points at. On a product whose
 * headline feature is "copy this URL", that is the whole feature failing quietly.
 *
 * Everything here is **derived from the compiled catalogue** (AC 5). There are 700 entries
 * and there will be more; a committed copy of their names would be wrong within a week.
 * The names are read per locale, because `catalogue.fr.json` calls an entry
 * `Partie italienne: Evans Gambit` and `catalogue.vi.json` calls it `Khai cuộc Ý: Evans
 * Gambit` — taking all three from `vi` would put the wrong language in the French title.
 *
 * Pure, and free of the filesystem, so it can be tested on the shapes a catalogue can
 * actually have — including the ones it must refuse. `scripts/generate-shells.ts` does the
 * reading and the writing.
 */

/** What the catalogue knows about one entry that belongs in a head. */
export type EntryFacts = {
  /** The family name and the variation folded together, as the catalogue page spells it. */
  readonly name: string
  readonly eco: string
  /** Space-joined SAN from the standard start position. */
  readonly line: string
}

export type CatalogueEntries =
  | { readonly ok: true; readonly entries: ReadonlyMap<string, EntryFacts> }
  | { readonly ok: false; readonly reason: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every entry in one locale's published catalogue, by id.
 *
 * A second reader of the same file as `tools/catalogue/published-ids.ts`, on purpose and
 * not by oversight: that one answers *which URLs exist* and validates every id as a slug
 * because each one becomes a path under `dist/`. This one answers *what each is called*,
 * is never used to build a path, and needs the fields that one deliberately ignores. The
 * generator keeps them honest by looking every published id up here and refusing a
 * catalogue that has no name for one.
 */
export const catalogueEntries = (json: string): CatalogueEntries => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'is not JSON' }
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.families)) {
    return { ok: false, reason: 'has no `families` array' }
  }

  const entries = new Map<string, EntryFacts>()
  for (const family of parsed.families) {
    if (!isRecord(family) || typeof family.name !== 'string' || !Array.isArray(family.entries)) {
      return { ok: false, reason: 'has a family with no string `name` or no `entries` array' }
    }
    const familyName = family.name
    for (const entry of family.entries) {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.variation !== 'string' ||
        typeof entry.eco !== 'string' ||
        typeof entry.line !== 'string'
      ) {
        return { ok: false, reason: 'has an entry missing `id`, `variation`, `eco` or `line`' }
      }
      // `fullName` in `src/lib/catalogue.ts`, which is what the catalogue page shows. An
      // empty variation means the entry *is* the family's root line.
      const name = entry.variation === '' ? familyName : `${familyName}: ${entry.variation}`
      entries.set(entry.id, { name, eco: entry.eco, line: entry.line })
    }
  }

  return { ok: true, entries }
}

/**
 * The translated strings a head needs, resolved for one locale.
 *
 * Existing keys, never new ones. `en.ts` and `fr.ts` are subsets of `vi.ts` (ADR-0006), so
 * the caller resolves the fallback; this module is handed strings that already exist.
 */
export type LocaleCopy = {
  /** `catalogue.heading` — the catalogue page's own h1. */
  readonly catalogue: string
  /** `catalogue.intro`. */
  readonly catalogueIntro: string
  /** `nav.about`. */
  readonly about: string
  /** `home.tagline`. */
  readonly tagline: string
}

export type Alternate = { readonly hreflang: string; readonly href: string }

export type ShellMetadata = {
  readonly lang: Locale
  /** The page's own name, without the site name. This is `og:title`. */
  readonly name: string
  /** The whole `<title>`, which is the name plus the site name. */
  readonly title: string
  readonly description: string
  /** Absolute, because `og:url` resolved by an unfurler has no page to resolve against. */
  readonly canonical: string
  readonly alternates: readonly Alternate[]
}

export type MetadataInput = {
  readonly gambitIds: readonly string[]
  /** One map per locale, from `catalogueEntries` on that locale's published file. */
  readonly entries: Readonly<Record<Locale, ReadonlyMap<string, EntryFacts>>>
  readonly copy: Readonly<Record<Locale, LocaleCopy>>
  /** Where the site is published under the origin. `/chess-gambits/` or `/`. */
  readonly basePath: string
  /** Scheme and host, without a trailing slash. */
  readonly origin: string
}

export type ShellSet =
  | {
      readonly ok: true
      /** The site root, which Vite writes itself and the generator rewrites in place. */
      readonly root: ShellMetadata
      /** Keyed by the same paths `shellPaths` returns, so the two can be compared. */
      readonly shells: ReadonlyMap<string, ShellMetadata>
    }
  | { readonly ok: false; readonly reason: string }

/** `withBasePath`, without `src/lib/base-path.ts`'s `import.meta.env` read. */
const url = (origin: string, basePath: string, route: string): string =>
  `${origin}${basePath.replace(/\/$/, '')}${route}`

const titled = (name: string): string => `${name} · ${siteName}`

/**
 * The three locales of one route, plus `x-default` for the locale-less root — which is the
 * URL that resolves a visitor's language rather than asserting one.
 */
const alternatesFor = (
  origin: string,
  basePath: string,
  route: (locale: Locale) => string,
): readonly Alternate[] => [
  ...locales.map((locale) => ({ hreflang: locale, href: url(origin, basePath, route(locale)) })),
  { hreflang: 'x-default', href: url(origin, basePath, '/') },
]

export const shellMetadata = (input: MetadataInput): ShellSet => {
  const { basePath, origin, copy, entries } = input
  const alternates = (route: (locale: Locale) => string): readonly Alternate[] =>
    alternatesFor(origin, basePath, route)

  const shells = new Map<string, ShellMetadata>()

  for (const locale of locales) {
    const words = copy[locale]
    const at = (...segments: readonly string[]): string => routePath(locale, ...segments)

    shells.set(locale, {
      lang: locale,
      name: siteName,
      // The one page whose name *is* the site name, so the usual suffix would say it twice.
      title: `${siteName} — ${words.tagline}`,
      description: words.tagline,
      canonical: url(origin, basePath, at()),
      alternates: alternates((other) => routePath(other)),
    })

    shells.set(`${locale}/${routeSegments.catalogue}`, {
      lang: locale,
      name: words.catalogue,
      title: titled(words.catalogue),
      description: words.catalogueIntro,
      canonical: url(origin, basePath, at(routeSegments.catalogue)),
      alternates: alternates((other) => routePath(other, routeSegments.catalogue)),
    })

    shells.set(`${locale}/${routeSegments.about}`, {
      lang: locale,
      name: words.about,
      title: titled(words.about),
      // The about page's own copy is #7 and is still a placeholder, so the site's tagline
      // stands in rather than a sentence invented here for a page nobody has written yet.
      description: words.tagline,
      canonical: url(origin, basePath, at(routeSegments.about)),
      alternates: alternates((other) => routePath(other, routeSegments.about)),
    })

    for (const id of input.gambitIds) {
      const facts = entries[locale].get(id)
      if (facts === undefined) {
        return {
          ok: false,
          reason:
            `catalogue.${locale}.json has no entry for \`${id}\`, which the published ` +
            'catalogue lists. A shell would be emitted at that URL with no name in that ' +
            'language, so the whole build stops rather than publishing one.',
        }
      }

      shells.set(`${locale}/${routeSegments.catalogue}/${id}`, {
        lang: locale,
        name: facts.name,
        title: titled(facts.name),
        /**
         * Proper nouns and SAN, not a sentence assembled from translated fragments.
         * Chess notation is never localised (docs/design-system.md §7), and a sentence
         * glued together from pieces is only grammatical in the language it was glued in
         * — which is why `src/locales/vi.ts` keeps whole sentences rather than fragments.
         */
        description: `${facts.name} — ECO ${facts.eco}. ${facts.line}`,
        canonical: url(origin, basePath, at(routeSegments.catalogue, id)),
        alternates: alternates((other) => routePath(other, routeSegments.catalogue, id)),
      })
    }
  }

  const words = copy[defaultLocale]

  return {
    ok: true,
    /**
     * `/` carries no locale and redirects to the visitor's own (`LocaleRedirect`). Until
     * that runs there is a document, and it has to claim *some* language: the source
     * locale, which is the same answer `AppShell` gives a path with no locale segment.
     */
    root: {
      lang: defaultLocale,
      name: siteName,
      title: `${siteName} — ${words.tagline}`,
      description: words.tagline,
      canonical: url(origin, basePath, '/'),
      alternates: alternates((other) => routePath(other)),
    },
    shells,
  }
}

/**
 * Attribute and text escaping. The names come from a vendored dataset (ADR-0008), which
 * makes them untrusted input to a document this build writes, whatever their provenance.
 * `&` first, or it would re-escape the entities the later replacements introduce.
 */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const meta = (attribute: string, key: string, value: string): string =>
  `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`

/** The head this ticket adds, in the order a reader of the built file would want it. */
const headTags = (data: ShellMetadata): readonly string[] => [
  `<title>${escapeHtml(data.title)}</title>`,
  meta('name', 'description', data.description),
  `<link rel="canonical" href="${escapeHtml(data.canonical)}" />`,
  ...data.alternates.map(
    (alternate) =>
      `<link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeHtml(alternate.href)}" />`,
  ),
  // No `og:image`. Every one this site could offer is either off-site — which requirement
  // N8 forbids — or the SVG favicon, which no unfurler renders. An unfurl with a real
  // title and description and no picture is the honest version of the same card.
  meta('property', 'og:type', 'website'),
  meta('property', 'og:site_name', siteName),
  meta('property', 'og:title', data.name),
  meta('property', 'og:description', data.description),
  meta('property', 'og:url', data.canonical),
]

export type ShellRender =
  { readonly ok: true; readonly html: string } | { readonly ok: false; readonly reason: string }

const HTML_OPEN = /<html lang="[^"]*">/g
const TITLE = /<title>[^<]*<\/title>/g

const occurrences = (pattern: RegExp, html: string): number => [...html.matchAll(pattern)].length

/**
 * One shell's bytes: the built `index.html` with its `lang` corrected and its placeholder
 * title replaced by a real head.
 *
 * Both anchors are required to appear exactly once. A template that stopped carrying one
 * would otherwise be copied 2,109 times with the substitution silently doing nothing,
 * which is precisely the failure this ticket closes.
 */
export const shellHtml = (template: string, data: ShellMetadata): ShellRender => {
  const langs = occurrences(HTML_OPEN, template)
  if (langs !== 1) {
    return { ok: false, reason: `has ${langs} \`<html lang="…">\` openings, and needs exactly 1` }
  }

  const titles = occurrences(TITLE, template)
  if (titles !== 1) {
    return { ok: false, reason: `has ${titles} \`<title>\` elements, and needs exactly 1` }
  }

  // Replacer functions, not replacement strings: a name containing `$&` or `$1` would
  // otherwise be interpreted rather than written.
  const html = template
    .replace(HTML_OPEN, () => `<html lang="${data.lang}">`)
    .replace(TITLE, () => headTags(data).join('\n    '))

  return { ok: true, html }
}

/**
 * Which pieces of `data` are **not** in `html`, named.
 *
 * AC 6's build assertion. Run against the bytes read back off disk rather than against the
 * string that was written, so it covers the write as well as the rendering: with 2,109
 * shells a spot check proves almost nothing, and "we meant to" is not a coverage claim.
 */
export const metadataGaps = (html: string, data: ShellMetadata): readonly string[] => {
  const required: readonly (readonly [string, string])[] = [
    ['lang', `<html lang="${data.lang}">`],
    ['title', `<title>${escapeHtml(data.title)}</title>`],
    ['description', meta('name', 'description', data.description)],
    ['canonical', `<link rel="canonical" href="${escapeHtml(data.canonical)}" />`],
    ...data.alternates.map((alternate): readonly [string, string] => [
      `hreflang ${alternate.hreflang}`,
      `hreflang="${alternate.hreflang}" href="${escapeHtml(alternate.href)}"`,
    ]),
    ['og:title', meta('property', 'og:title', data.name)],
    ['og:description', meta('property', 'og:description', data.description)],
    ['og:url', meta('property', 'og:url', data.canonical)],
    ['og:site_name', meta('property', 'og:site_name', siteName)],
    ['og:type', meta('property', 'og:type', 'website')],
  ]

  return required.filter(([, needle]) => !html.includes(needle)).map(([what]) => what)
}
