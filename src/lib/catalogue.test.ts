import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogueUrl, fullName, isCatalogue, loadCatalogue } from './catalogue'

/**
 * AC 6 and AC 8, at the level a unit test can reach: one file per locale is fetched by
 * URL, and every way that fetch can go wrong comes back as a value the UI can render.
 *
 * Nothing here throws, for the same reason nothing in `content.ts` does: a rejected promise
 * inside a lazy boundary is a blank screen, and this site sends no telemetry, so a blank
 * screen is a failure nobody ever learns about.
 */

const CATALOGUE = {
  locale: 'vi',
  source: { repository: 'https://example.invalid/openings', commit: 'abc' },
  counts: { entries: 2, gambits: 1, traps: 1, families: 1, listed: 2, mapped: 0, taught: 0 },
  families: [
    {
      id: 'italian-game',
      name: 'Khai cuộc Ý',
      entries: [
        {
          id: 'italian-game-evans-gambit',
          variation: 'Evans Gambit',
          eco: 'C51',
          category: 'gambit',
          side: 'white',
          soundness: 'sound',
          tier: 'listed',
          line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4',
          branches: 0,
        },
      ],
    },
  ],
}

const respond = (body: unknown, status = 200): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('where a catalogue is fetched from', () => {
  it('is one static file per locale, so a visitor downloads one language of names', () => {
    expect(catalogueUrl('vi')).toContain('catalogue/catalogue.vi.json')
    expect(catalogueUrl('en')).toContain('catalogue/catalogue.en.json')
    expect(catalogueUrl('fr')).toContain('catalogue/catalogue.fr.json')
  })

  it('carries the base path, so a project-site deploy resolves it', () => {
    expect(catalogueUrl('fr').startsWith('/')).toBe(true)
  })
})

describe('reading a name out of the catalogue', () => {
  const family = { id: 'italian-game', name: 'Italian Game', entries: [] }
  const entry = {
    id: 'x',
    variation: 'Evans Gambit',
    eco: 'C51',
    category: 'gambit',
    side: 'white',
    soundness: 'sound',
    tier: 'listed',
    line: 'e4',
    branches: 0,
  } as const

  it('folds the family and the variation back together', () => {
    expect(fullName(family, entry)).toBe('Italian Game: Evans Gambit')
  })

  it('shows the family name where the entry is the family root line', () => {
    expect(fullName(family, { ...entry, variation: '' })).toBe('Italian Game')
  })
})

describe('a catalogue that arrives', () => {
  it('is returned when every field is what it claims to be', async () => {
    respond(CATALOGUE)
    const result = await loadCatalogue('vi')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.catalogue.counts.entries).toBe(2)
    expect(result.catalogue.families[0]?.name).toBe('Khai cuộc Ý')
  })
})

describe('a catalogue that does not', () => {
  it('reports a missing file rather than an empty catalogue', async () => {
    respond('<!doctype html><title>404</title>', 404)
    const result = await loadCatalogue('vi')
    expect(result).toEqual({ ok: false, failure: { reason: 'missing' } })
  })

  it('reports the status when the host answers with an error', async () => {
    respond('', 503)
    const result = await loadCatalogue('vi')
    expect(result).toEqual({ ok: false, failure: { reason: 'unavailable', status: 503 } })
  })

  it('reports being offline rather than rejecting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network'))),
    )
    await expect(loadCatalogue('vi')).resolves.toEqual({
      ok: false,
      failure: { reason: 'offline' },
    })
  })

  /**
   * A static host answering a deploy-time 404 with an HTML page, a truncated response on a
   * flaky connection and a stale service worker all produce something; none of them
   * produces a catalogue, and only a field-by-field check tells the difference.
   */
  it('reports malformed when the body is not JSON', async () => {
    respond('<!doctype html><title>Not found</title>')
    const result = await loadCatalogue('vi')
    expect(result).toEqual({ ok: false, failure: { reason: 'malformed' } })
  })

  it('reports malformed when an entry is missing a field', async () => {
    const [family] = CATALOGUE.families
    const [entry] = family?.entries ?? []
    const { soundness: _dropped, ...withoutSoundness } = entry ?? {}
    respond({ ...CATALOGUE, families: [{ ...family, entries: [withoutSoundness] }] })

    const result = await loadCatalogue('vi')
    expect(result).toEqual({ ok: false, failure: { reason: 'malformed' } })
  })

  it('reports malformed when a closed set carries a value outside it', async () => {
    const [family] = CATALOGUE.families
    const [entry] = family?.entries ?? []
    respond({
      ...CATALOGUE,
      families: [{ ...family, entries: [{ ...entry, tier: 'legendary' }] }],
    })

    const result = await loadCatalogue('vi')
    expect(result).toEqual({ ok: false, failure: { reason: 'malformed' } })
  })

  it('refuses a file built for another locale, which would show the wrong names', async () => {
    respond({ ...CATALOGUE, locale: 'fr' })
    const result = await loadCatalogue('vi')
    expect(result).toEqual({ ok: false, failure: { reason: 'malformed' } })
  })
})

describe('the guard itself', () => {
  it.each([null, undefined, 42, 'catalogue', [], {}])('rejects %p', (value) => {
    expect(isCatalogue(value)).toBe(false)
  })

  it('accepts the shape the build emits', () => {
    expect(isCatalogue(CATALOGUE)).toBe(true)
  })
})

/**
 * The baked branch count is the one field a card *divides by*, so it is checked harder
 * than the strings around it. A card that read "3 of -1 branches" would be a visible
 * defect on the one display whose whole purpose is to be believed, and the catalogue is
 * fetched from a static host that can answer with something other than what we built.
 */
describe('the baked branch count', () => {
  const withBranches = (branches: unknown): unknown => {
    const [family] = CATALOGUE.families
    const [entry] = family?.entries ?? []
    return { ...CATALOGUE, families: [{ ...family, entries: [{ ...entry, branches }] }] }
  }

  it('is read back when it is a count', async () => {
    respond(withBranches(12))
    const result = await loadCatalogue('vi')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.catalogue.families[0]?.entries[0]?.branches).toBe(12)
  })

  it('accepts zero, which is every entry today', async () => {
    respond(withBranches(0))
    await expect(loadCatalogue('vi')).resolves.toMatchObject({ ok: true })
  })

  it.each([-1, 1.5, Number.NaN, '12', null, undefined])('rejects %p', async (branches) => {
    respond(withBranches(branches))
    await expect(loadCatalogue('vi')).resolves.toEqual({
      ok: false,
      failure: { reason: 'malformed' },
    })
  })
})
