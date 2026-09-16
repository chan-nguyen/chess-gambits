import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { locales, type Locale } from '../../src/lib/locale.ts'
import { shellPaths } from '../../src/lib/routes.ts'
import { siteName } from '../../src/lib/site.ts'
import {
  catalogueEntries,
  escapeHtml,
  metadataGaps,
  shellHtml,
  shellMetadata,
  type EntryFacts,
  type LocaleCopy,
  type MetadataInput,
  type ShellMetadata,
} from './metadata.ts'

/**
 * The head of 3,018 published documents.
 *
 * Nothing here is cosmetic. A shell that keeps the template's `lang` serves French and
 * English routes as Vietnamese until JavaScript runs — WCAG 3.1.1 at Level A — and a shell
 * that keeps the template's `<title>` makes two thousand URLs indistinguishable in a
 * history list, a bookmark bar and every link preview. So the refusals below matter as
 * much as the happy paths: each one is a way the build could emit the byte-identical
 * shells this ticket exists to replace, while printing a cheerful success line.
 */

const ORIGIN = 'https://example.test'

const copy = (word: string): LocaleCopy => ({
  catalogue: `${word} catalogue`,
  catalogueIntro: `${word} intro`,
  about: `${word} about`,
  tagline: `${word} tagline`,
})

const facts = (name: string): EntryFacts => ({ name, eco: 'C51', line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4' })

const NAMES: Readonly<Record<Locale, string>> = {
  vi: 'Khai cuộc Ý: Evans Gambit',
  en: 'Italian Game: Evans Gambit',
  fr: 'Partie italienne: Evans Gambit',
}

const input = (overrides: Partial<MetadataInput> = {}): MetadataInput => ({
  gambitIds: ['evans-gambit'],
  entries: {
    vi: new Map([['evans-gambit', facts(NAMES.vi)]]),
    en: new Map([['evans-gambit', facts(NAMES.en)]]),
    fr: new Map([['evans-gambit', facts(NAMES.fr)]]),
  },
  copy: { vi: copy('vi'), en: copy('en'), fr: copy('fr') },
  basePath: '/chess-gambits/',
  origin: ORIGIN,
  ...overrides,
})

const built = (overrides: Partial<MetadataInput> = {}) => {
  const result = shellMetadata(input(overrides))
  if (!result.ok) throw new Error(result.reason)
  return result
}

const shellAt = (path: string, overrides: Partial<MetadataInput> = {}): ShellMetadata => {
  const data = built(overrides).shells.get(path)
  if (data === undefined) throw new Error(`no metadata at ${path}`)
  return data
}

describe('reading the names out of a published catalogue', () => {
  const payload = (families: readonly unknown[]): string => JSON.stringify({ families })
  const entry = (id: string, variation: string): unknown => ({
    id,
    variation,
    eco: 'C51',
    line: 'e4 e5',
  })

  it('folds the family name and the variation into the name the catalogue page shows', () => {
    const result = catalogueEntries(
      payload([{ name: 'Italian Game', entries: [entry('evans', 'Evans Gambit')] }]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entries.get('evans')?.name).toBe('Italian Game: Evans Gambit')
  })

  it("uses the family name alone where the entry is the family's own root line", () => {
    const result = catalogueEntries(
      payload([{ name: "King's Gambit", entries: [entry('kg', '')] }]),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entries.get('kg')?.name).toBe("King's Gambit")
  })

  /**
   * A static host answering a missing file with an HTML 404 page, and a half-written file
   * from an interrupted build, both arrive here as a string.
   */
  it.each([
    ['an HTML page', '<!doctype html><title>404</title>', 'not JSON'],
    ['JSON with no families', '{"locale":"vi"}', 'families'],
    ['a family with no name', '{"families":[{"entries":[]}]}', 'name'],
    [
      'an entry with no line',
      '{"families":[{"name":"F","entries":[{"id":"a","variation":"","eco":"C51"}]}]}',
      'line',
    ],
  ])('refuses %s', (_what, json, reason) => {
    const result = catalogueEntries(json)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain(reason)
  })
})

describe('which shells get metadata', () => {
  /**
   * AC 6, at the unit level. `routes.ts` decides which shells a build owes and this module
   * enumerates them again, independently; if the two ever disagree, a route ships with the
   * placeholder head at a URL nobody looked at. The build asserts the same equality.
   */
  it('covers every path the route inventory owes, and no others', () => {
    const ids = ['evans-gambit']
    expect([...built().shells.keys()].sort()).toStrictEqual([...shellPaths(ids)].sort())
  })

  it('scales to the whole catalogue: three locales times every published id', () => {
    const ids = Array.from({ length: 1003 }, (_, index) => `gambit-${index}`)
    const entries = new Map(ids.map((id) => [id, facts(id)]))

    const result = built({ gambitIds: ids, entries: { vi: entries, en: entries, fr: entries } })

    expect(result.shells.size).toBe(locales.length * (3 + ids.length))
  })

  it('refuses to publish a URL a locale has no name for, naming the id and the file', () => {
    const result = shellMetadata(input({ entries: { ...input().entries, fr: new Map() } }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('catalogue.fr.json')
    expect(result.reason).toContain('evans-gambit')
  })
})

describe('the language of the page (AC 1)', () => {
  /**
   * WCAG 3.1.1 at Level A. Serving `lang="vi"` on a French route until JavaScript runs is
   * the failure, and it is invisible to every test that only looks at the rendered page.
   */
  it.each([...locales])('gives every %s shell that locale, not the source locale', (locale) => {
    const paths = [...built().shells].filter(([path]) => path.split('/')[0] === locale)

    expect(paths).toHaveLength(4)
    for (const [path, data] of paths) expect(data.lang, path).toBe(locale)
  })

  it('claims the source locale on the root, which has no locale in its path', () => {
    expect(built().root.lang).toBe('vi')
  })
})

describe('titles that distinguish two thousand pages (AC 2)', () => {
  it('names the gambit in the shell own language, never in the source locale', () => {
    expect(shellAt('fr/gambits/evans-gambit').title).toBe(`${NAMES.fr} · ${siteName}`)
    expect(shellAt('en/gambits/evans-gambit').title).toBe(`${NAMES.en} · ${siteName}`)
    expect(shellAt('vi/gambits/evans-gambit').title).toBe(`${NAMES.vi} · ${siteName}`)
  })

  it('gives every shell a title and a description of its own', () => {
    const shells = [...built().shells.values()]

    expect(new Set(shells.map((data) => data.title)).size).toBe(shells.length)
    for (const data of shells) expect(data.description).not.toBe('')
  })

  it('says the site name once on the home page, not twice', () => {
    expect(shellAt('vi').title).toBe(`${siteName} — vi tagline`)
  })

  /**
   * The description is proper nouns and SAN, not a sentence assembled from translated
   * fragments — chess notation is never localised (docs/design-system.md §7), and a glued
   * sentence is only grammatical in the language it was glued in.
   */
  it('describes a gambit by its name, its ECO code and its opening moves', () => {
    expect(shellAt('en/gambits/evans-gambit').description).toBe(
      `${NAMES.en} — ECO C51. e4 e5 Nf3 Nc6 Bc4 Bc5 b4`,
    )
  })
})

describe('canonical and alternates (AC 4)', () => {
  it('carries the base path the site is published under', () => {
    expect(shellAt('fr/gambits/evans-gambit').canonical).toBe(
      `${ORIGIN}/chess-gambits/fr/gambits/evans-gambit`,
    )
  })

  /** CI runs the end-to-end suite at both, so a canonical that hard-codes one is a bug. */
  it('works at the root base path a custom domain would use', () => {
    const data = shellAt('fr/gambits/evans-gambit', { basePath: '/' })

    expect(data.canonical).toBe(`${ORIGIN}/fr/gambits/evans-gambit`)
    expect(data.canonical).not.toContain('//fr')
  })

  it('gives the locale home a trailing slash, matching the directory it is served from', () => {
    expect(shellAt('vi').canonical).toBe(`${ORIGIN}/chess-gambits/vi/`)
  })

  it('links the same route in all three locales, plus a locale-less default', () => {
    expect(shellAt('en/gambits/evans-gambit').alternates).toStrictEqual([
      { hreflang: 'vi', href: `${ORIGIN}/chess-gambits/vi/gambits/evans-gambit` },
      { hreflang: 'en', href: `${ORIGIN}/chess-gambits/en/gambits/evans-gambit` },
      { hreflang: 'fr', href: `${ORIGIN}/chess-gambits/fr/gambits/evans-gambit` },
      { hreflang: 'x-default', href: `${ORIGIN}/chess-gambits/` },
    ])
  })

  it('points x-default at the root, which resolves a language rather than asserting one', () => {
    for (const data of built().shells.values()) {
      expect(data.alternates.at(-1)).toStrictEqual({
        hreflang: 'x-default',
        href: `${ORIGIN}/chess-gambits/`,
      })
    }
  })
})

const TEMPLATE =
  '<!doctype html>\n<html lang="en">\n  <head>\n    <title>app</title>\n  </head>\n</html>\n'

const render = (data: ShellMetadata, template = TEMPLATE): string => {
  const result = shellHtml(template, data)
  if (!result.ok) throw new Error(result.reason)
  return result.html
}

describe('rendering a shell', () => {
  it('replaces the template language and the placeholder title', () => {
    const html = render(shellAt('fr/gambits/evans-gambit'))

    expect(html).toContain('<html lang="fr">')
    expect(html).not.toContain('<html lang="en">')
    expect(html).not.toContain('<title>app</title>')
    expect(html).toContain(`<title>${NAMES.fr} · ${siteName}</title>`)
  })

  it('emits the og:* tags a link preview reads (AC 3)', () => {
    const html = render(shellAt('fr/gambits/evans-gambit'))

    expect(html).toContain(`<meta property="og:title" content="${NAMES.fr}" />`)
    expect(html).toContain(`<meta property="og:site_name" content="${siteName}" />`)
    expect(html).toContain('<meta property="og:url" content="https://example.test/')
  })

  /**
   * Requirement N8: nothing may reach a third party at runtime. Every image this site
   * could offer an unfurler is either off-site or the SVG favicon, which none of them
   * render, so there is no `og:image` at all — and nothing here may quietly add one.
   */
  it('points at no image, on-site or off', () => {
    expect(render(shellAt('vi'))).not.toContain('og:image')
  })

  /**
   * The substitution is the whole ticket. A template that stopped carrying an anchor would
   * otherwise be copied 3,018 times with the replacement silently doing nothing.
   */
  it.each([
    ['no title', '<html lang="en"><head></head></html>', '<title>'],
    ['no html lang', '<!doctype html><head><title>app</title></head>', '<html lang'],
    [
      'two titles',
      '<html lang="en"><head><title>a</title><title>b</title></head></html>',
      '<title>',
    ],
  ])('refuses a template with %s', (_what, template, reason) => {
    const result = shellHtml(template, shellAt('vi'))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain(reason)
  })
})

describe('names that are not safe to paste into a document', () => {
  /**
   * The names come from a vendored dataset (ADR-0008), which makes them untrusted input to
   * a document this build writes, whatever their provenance. A name carrying a quote would
   * otherwise close the attribute it sits in.
   */
  it('escapes the characters that would end an attribute or open a tag', () => {
    expect(escapeHtml('A & B "C" <script>')).toBe('A &amp; B &quot;C&quot; &lt;script&gt;')
  })

  it('escapes them in a rendered head rather than emitting them raw', () => {
    const hostile = facts('Evil" onload="alert(1)')
    const entries = new Map([['evans-gambit', hostile]])
    const html = render(
      shellAt('en/gambits/evans-gambit', {
        entries: { vi: entries, en: entries, fr: entries },
      }),
    )

    expect(html).not.toContain('onload="alert(1)"')
    expect(html).toContain('&quot; onload=&quot;alert(1)')
  })

  /** `$&` in a name would otherwise be read as a replacement pattern, not as text. */
  it('writes a dollar-sign pattern as the text it is', () => {
    const odd = facts('Gambit $& $1 Variation')
    const entries = new Map([['evans-gambit', odd]])
    const html = render(
      shellAt('vi/gambits/evans-gambit', { entries: { vi: entries, en: entries, fr: entries } }),
    )

    expect(html).toContain('<title>Gambit $&amp; $1 Variation · Chess Gambit Trainer</title>')
  })
})

describe('the coverage assertion the build runs (AC 6)', () => {
  it('finds nothing missing in a document this module rendered', () => {
    const data = shellAt('fr/gambits/evans-gambit')

    expect(metadataGaps(render(data), data)).toStrictEqual([])
  })

  it.each([
    ['lang', '<html lang="fr">', '<html lang="vi">'],
    ['title', `<title>${NAMES.fr} · ${siteName}</title>`, '<title>app</title>'],
    ['og:url', 'property="og:url"', 'property="og:nothing"'],
    ['hreflang en', 'hreflang="en"', 'hreflang="de"'],
  ])('reports a missing %s', (what, present, replacement) => {
    const data = shellAt('fr/gambits/evans-gambit')
    const damaged = render(data).replace(present, () => replacement)

    expect(metadataGaps(damaged, data)).toContain(what)
  })

  /**
   * The control. Without it every assertion above could pass on a checker that reports
   * everything as missing.
   */
  it('reports every piece as missing on a document with no head at all', () => {
    const data = shellAt('fr/gambits/evans-gambit')

    expect(metadataGaps('<html></html>', data).length).toBeGreaterThan(9)
  })
})

describe('the catalogue this repository builds', () => {
  /**
   * Run against the real generated files rather than fixtures, because the claim is that
   * *this* build's three payloads name the same 1,003 entries in three languages. It is
   * generated, so a missing file means `npm run catalogue` has not run.
   */
  const read = (locale: Locale): string => {
    const path = join('public', 'catalogue', `catalogue.${locale}.json`)
    try {
      return readFileSync(path, 'utf8')
    } catch {
      throw new Error(`${path} is missing. Run \`npm run catalogue\` first.`)
    }
  }

  const parsed = (locale: Locale): ReadonlyMap<string, EntryFacts> => {
    const result = catalogueEntries(read(locale))
    if (!result.ok) throw new Error(`catalogue.${locale}.json ${result.reason}`)
    return result.entries
  }

  it.each([...locales])('reads back 1003 named entries from %s', (locale) => {
    expect(parsed(locale).size).toBe(1003)
  })

  it('names the same entry differently in each language, which is why it is read per locale', () => {
    const id = 'italian-game-evans-gambit'
    const names = locales.map((locale) => parsed(locale).get(id)?.name)

    expect(names.every((name) => name !== undefined)).toBe(true)
    expect(new Set(names).size).toBe(locales.length)
  })

  it('builds a complete set of shells from the real catalogue', () => {
    const entries = { vi: parsed('vi'), en: parsed('en'), fr: parsed('fr') }
    const ids = [...entries.vi.keys()]
    const result = shellMetadata(input({ gambitIds: ids, entries }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.shells.keys()].sort()).toStrictEqual([...shellPaths(ids)].sort())
  })
})
