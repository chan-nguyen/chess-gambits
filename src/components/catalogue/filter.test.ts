import { describe, expect, it } from 'vitest'
import { isCatalogue, type Catalogue, type CatalogueEntry } from '../../lib/catalogue.ts'
import {
  applyFilter,
  defaultFilter,
  fold,
  indexCatalogue,
  isNarrowed,
  meetsTier,
  tierFloors,
  type CatalogueFilter,
} from './filter.ts'

/**
 * The matching rules, and the budget they have to answer inside.
 *
 * The performance claim is measured **over the real generated catalogue** rather than a
 * sample (AC 3), because a sample is exactly what would hide the failure: any filter is
 * fast over twenty entries. The file below is the one the browser downloads.
 */

const entry = (over: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  id: 'evans-gambit',
  variation: 'Evans Gambit',
  eco: 'C51',
  category: 'gambit',
  side: 'white',
  soundness: 'sound',
  tier: 'listed',
  line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4',
  branches: 0,
  ...over,
})

const catalogue = (entries: readonly CatalogueEntry[]): Catalogue => ({
  locale: 'vi',
  source: { repository: 'lichess-org/chess-openings', commit: 'abc' },
  counts: {
    entries: entries.length,
    gambits: entries.length,
    traps: 0,
    families: 1,
    listed: entries.length,
    mapped: 0,
    taught: 0,
  },
  families: [{ id: 'italian-game', name: 'Ván cờ Ý', entries }],
})

const filter = (over: Partial<CatalogueFilter> = {}): CatalogueFilter => ({
  ...defaultFilter,
  tier: 'all',
  ...over,
})

const matchedIds = (entries: readonly CatalogueEntry[], over: Partial<CatalogueFilter> = {}) =>
  applyFilter(indexCatalogue(catalogue(entries)), filter(over)).families.flatMap((family) =>
    family.entries.map((indexed) => indexed.entry.id),
  )

describe('folding a search term', () => {
  /**
   * AC 2, and the reason it is not `normalize('NFD')` alone: `đ` is a letter, not a `d`
   * with a mark on it, so NFD leaves it exactly where it was.
   */
  it.each([
    ['Phòng thủ Sicily', 'phong thu sicily'],
    ['Ván cờ Ý', 'van co y'],
    ['Đông', 'dong'],
    ['Bẫy Lập Đô', 'bay lap do'],
    ['Nước đi mở đầu', 'nuoc di mo dau'],
  ])('folds %p to %p', (input, expected) => {
    expect(fold(input)).toBe(expected)
  })

  it('folds the horn on ơ and ư, which is a combining mark and not a letter', () => {
    expect(fold('Cương Lược')).toBe('cuong luoc')
  })

  it('leaves a term that has nothing to fold alone', () => {
    expect(fold('Evans Gambit')).toBe('evans gambit')
  })
})

describe('searching', () => {
  const entries = [
    entry({ id: 'evans-gambit', variation: 'Gambit Evans', eco: 'C51' }),
    entry({ id: 'danish-gambit', variation: 'Gambit Đan Mạch', eco: 'C21' }),
  ]

  it('matches a name typed without diacritics', () => {
    expect(matchedIds(entries, { q: 'dan mach' })).toEqual(['danish-gambit'])
  })

  it('matches a name typed with them', () => {
    expect(matchedIds(entries, { q: 'Đan Mạch' })).toEqual(['danish-gambit'])
  })

  it('matches an ECO code, in either case', () => {
    expect(matchedIds(entries, { q: 'c51' })).toEqual(['evans-gambit'])
    expect(matchedIds(entries, { q: 'C51' })).toEqual(['evans-gambit'])
  })

  it('searches the family name too, because that is half of what a learner reads', () => {
    expect(matchedIds(entries, { q: 'van co y' })).toHaveLength(2)
  })

  /**
   * The search box's value is the URL's, and the URL keeps what was typed. Trimming has to
   * happen where the term is *matched* or "evans " would find nothing.
   */
  it('ignores surrounding whitespace', () => {
    expect(matchedIds(entries, { q: '  evans  ' })).toEqual(['evans-gambit'])
  })

  it('treats an empty term as no filter at all', () => {
    expect(matchedIds(entries, { q: '' })).toHaveLength(2)
    expect(matchedIds(entries, { q: '   ' })).toHaveLength(2)
  })

  it('returns no family at all when nothing in it matches', () => {
    expect(applyFilter(indexCatalogue(catalogue(entries)), filter({ q: 'zzz' }))).toEqual({
      families: [],
      entries: 0,
    })
  })
})

describe('the depth filter', () => {
  /**
   * A **floor**, not an exact tier. Somebody asking for mapped entries wants the taught
   * ones as well, because those are mapped and more.
   */
  it.each([
    ['listed', 'all', true],
    ['listed', 'mapped', false],
    ['listed', 'taught', false],
    ['mapped', 'all', true],
    ['mapped', 'mapped', true],
    ['mapped', 'taught', false],
    ['taught', 'all', true],
    ['taught', 'mapped', true],
    ['taught', 'taught', true],
  ] as const)('%s meets the %s floor: %p', (tier, floor, expected) => {
    expect(meetsTier(tier, floor)).toBe(expected)
  })

  it('offers exactly three floors, so the radio group and the URL agree', () => {
    expect([...tierFloors]).toEqual(['taught', 'mapped', 'all'])
  })

  /** AC 5, asserted on the constant the whole page derives its default view from. */
  it('defaults to Taught', () => {
    expect(defaultFilter.tier).toBe('taught')
  })
})

describe('the filters compose', () => {
  const entries = [
    entry({ id: 'a', side: 'white', category: 'gambit', soundness: 'sound', tier: 'taught' }),
    entry({ id: 'b', side: 'black', category: 'gambit', soundness: 'unsound', tier: 'listed' }),
    entry({ id: 'c', side: 'white', category: 'trap', soundness: 'dubious', tier: 'mapped' }),
  ]

  it.each([
    [{ side: 'white' }, ['a', 'c']],
    [{ category: 'trap' }, ['c']],
    [{ soundness: 'unsound' }, ['b']],
    [{ tier: 'mapped' }, ['a', 'c']],
  ] as const)('%p narrows to %p', (over, expected) => {
    expect(matchedIds(entries, over)).toEqual(expected)
  })

  /** Each filter narrows what the others left; none of them is a mode (AC 1). */
  it('narrows cumulatively rather than replacing', () => {
    expect(matchedIds(entries, { side: 'white', category: 'gambit' })).toEqual(['a'])
    expect(matchedIds(entries, { side: 'white', category: 'gambit', tier: 'taught' })).toEqual([
      'a',
    ])
    expect(matchedIds(entries, { side: 'black', category: 'trap' })).toEqual([])
  })

  it('counts the entries it kept, not the families', () => {
    expect(applyFilter(indexCatalogue(catalogue(entries)), filter()).entries).toBe(3)
  })
})

describe('knowing whether anything is narrowing the list', () => {
  it('is false only for the unfiltered index', () => {
    expect(isNarrowed({ ...defaultFilter, tier: 'all' })).toBe(false)
  })

  it.each([
    { tier: 'taught' },
    { tier: 'mapped' },
    { q: 'evans' },
    { side: 'white' },
    { category: 'trap' },
    { soundness: 'unsound' },
  ] as const)('is true for %p', (over) => {
    expect(isNarrowed({ ...defaultFilter, tier: 'all', ...over })).toBe(true)
  })

  it('does not count whitespace as a search term', () => {
    expect(isNarrowed({ ...defaultFilter, tier: 'all', q: '   ' })).toBe(false)
  })
})

describe('the catalogue this repository ships', () => {
  /**
   * The real file, not a fixture. A budget measured over a sample is not a budget: any
   * filter answers instantly over twenty rows.
   */
  const path = '/public/catalogue/catalogue.vi.json'

  /**
   * Read through Vite's own glob rather than through `node:fs`, because this suite is the
   * application's and the application project has no Node types — the same reason
   * `no-raw-values.test.ts` reads its sources this way. It is still the shipped bytes.
   */
  const shipped: Readonly<Record<string, string>> = import.meta.glob(
    '/public/catalogue/catalogue.vi.json',
    { query: '?raw', import: 'default', eager: true },
  )
  const json = shipped[path]
  if (json === undefined) throw new Error(`${path} is missing. Run \`npm run catalogue\` first.`)

  const parsed: unknown = JSON.parse(json)
  if (!isCatalogue(parsed))
    throw new Error(`${path} is not a catalogue. Run \`npm run catalogue\`.`)
  const real = parsed
  const index = indexCatalogue(real)

  it('indexes every entry once', () => {
    expect(index.flatMap((family) => family.entries)).toHaveLength(real.counts.entries)
    expect(real.counts.entries).toBeGreaterThan(600)
  })

  /**
   * **AC 3.** The number measured is the one a keystroke costs: the fold of every name
   * happens once when the catalogue arrives, and what runs per character is this.
   *
   * Averaged over many runs rather than timed once, because a single measurement on a
   * shared runner measures the runner. The terms are the expensive ones — a single common
   * letter matches most of the catalogue, so nothing is skipped early.
   */
  it.each(['', 'e', 'a', 'gambit', 'phong thu', 'C5'])(
    'filters the whole catalogue in under 100ms for %p',
    (q) => {
      const runs = 20
      const started = performance.now()
      for (let run = 0; run < runs; run += 1) {
        applyFilter(index, { ...defaultFilter, tier: 'all', q })
      }
      const each = (performance.now() - started) / runs

      expect(
        each,
        `${each.toFixed(2)}ms per filter over ${real.counts.entries} entries`,
      ).toBeLessThan(100)
    },
  )

  /**
   * The one-off cost, measured too. It happens once per visit and it is the only part of
   * this that touches every name, so if anything ever needs a worker it is this — and a
   * budget nobody measured is how that gets noticed too late.
   */
  it('folds the whole catalogue in under 100ms', () => {
    const started = performance.now()
    indexCatalogue(real)
    const took = performance.now() - started

    expect(took, `${took.toFixed(2)}ms to index ${real.counts.entries} entries`).toBeLessThan(100)
  })

  it('finds a real entry by an undiacriticked name', () => {
    const found = applyFilter(index, { ...defaultFilter, tier: 'all', q: 'danh mucxyz' })

    expect(found.entries).toBe(0)
    expect(
      applyFilter(index, { ...defaultFilter, tier: 'all', q: 'evans' }).entries,
    ).toBeGreaterThan(0)
  })

  /** The site today: nothing is taught, so the default view is empty and honestly so. */
  it('matches nothing at the default depth, which is what the page has a state for', () => {
    expect(applyFilter(index, defaultFilter).entries).toBe(real.counts.taught)
  })
})
