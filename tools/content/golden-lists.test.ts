import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { build } from '../catalogue/build.ts'
import { loadContent } from './entries.ts'
import type { GoldenInputs } from './golden-lists.ts'
import {
  listedTaughtIds,
  mentionsOf,
  numberWords,
  regenerateBranches,
  regenerateContentCli,
  regenerateTaughtEntries,
  sortedIds,
} from './golden-lists.ts'

/**
 * `golden-lists.ts` rewrites three fixtures that other tests read, so the two ways it can go
 * wrong are the two this file tries to make loud: writing a list in the wrong order, and no
 * longer recognising a fixture that someone has reformatted.
 *
 * The last test is the one with teeth. It runs the tool over the real repository and insists it
 * changes nothing, which proves in one assertion that the committed lists are current *and* that
 * the patterns still match the real files. A content change that forgot to regenerate fails here
 * with the command to run, before the lists' own assertions fail with a diff.
 */

describe('numberWords', () => {
  it.each([
    [0, 'zero'],
    [7, 'seven'],
    [13, 'thirteen'],
    [20, 'twenty'],
    [21, 'twenty-one'],
    [99, 'ninety-nine'],
    [100, 'one hundred'],
    [101, 'one hundred and one'],
    [458, 'four hundred and fifty-eight'],
    [560, 'five hundred and sixty'],
    [561, 'five hundred and sixty-one'],
    [860, 'eight hundred and sixty'],
    [1000, 'one thousand'],
    [1024, 'one thousand and twenty-four'],
  ])('writes %i as %s', (value, words) => {
    expect(numberWords(value)).toBe(words)
  })

  it('returns the digits rather than a wrong word outside its range', () => {
    expect(numberWords(10_000)).toBe('10000')
    expect(numberWords(-1)).toBe('-1')
    expect(numberWords(1.5)).toBe('1.5')
  })

  it('never writes two different counts as the same words', () => {
    const words = Array.from({ length: 1100 }, (_, value) => numberWords(value))
    expect(new Set(words).size).toBe(words.length)
  })
})

describe('ordering', () => {
  it('sorts bare ids with the hyphen first, and the .json names with the dot after it', () => {
    const ids = ['benko-gambit', 'benko-gambit-accepted']
    expect(sortedIds(ids)).toStrictEqual(['benko-gambit', 'benko-gambit-accepted'])

    const inputs: GoldenInputs = {
      contentIds: ids,
      taughtIds: ids,
      branchCounts: new Map(),
      totalEntries: 2,
    }
    const fixture = [
      '    expect([...readdirSync(out)].sort()).toStrictEqual([',
      "      'stale.json',",
      '    ])',
      "'Known ids: stale.'",
    ].join('\n')
    const result = regenerateContentCli(fixture, inputs)
    if (!result.ok) throw new Error(result.message)
    // `-` sorts before `.`, so the longer id's file comes first: the opposite of the ids.
    expect(result.text).toContain(
      "      'benko-gambit-accepted.json',\n      'benko-gambit.json',\n    ])",
    )
    expect(result.text).toContain("'Known ids: benko-gambit, benko-gambit-accepted.'")
  })
})

describe('what it regenerates', () => {
  const inputs: GoldenInputs = {
    contentIds: ['alpha', 'bravo', 'charlie'],
    taughtIds: ['alpha', 'charlie'],
    branchCounts: new Map([
      ['alpha', 1],
      ['bravo', 0],
      ['charlie', 3],
    ]),
    totalEntries: 10,
  }

  it('rewrites the AUTHORED map, the counts in words and the Tier 0 number', () => {
    const fixture = [
      '   * Seventy entries are authored — three from #15,',
      '   * and the',
      '   * other 900',
      '   * are Tier 0, with no content file at all.',
      '  const AUTHORED: ReadonlyMap<string, number> = new Map([',
      "    ['stale', 1],",
      '  ])',
      "  it('bakes keys on all 1024 entries, and only the authored seventy have any', () => {",
    ].join('\n')
    const result = regenerateBranches(fixture, inputs)
    if (!result.ok) throw new Error(result.message)
    expect(result.text).toContain('* Three entries are authored')
    expect(result.text).toContain('and the\n   * other 7\n   * are Tier 0')
    expect(result.text).toContain('only the authored three have any')
    expect(result.text).toContain("    ['alpha', 1],\n    ['bravo', 0],\n    ['charlie', 3],\n  ])")
    expect(result.text).not.toContain('stale')
  })

  it('rewrites the taught title and list from the taught ids only', () => {
    const fixture = [
      "  test('there are ninety of them, and they are the ones the content tickets authored', () => {",
      '    expect(taught.map((entry) => entry.id).sort()).toEqual([',
      "      'stale',",
      '    ])',
    ].join('\n')
    const result = regenerateTaughtEntries(fixture, inputs)
    if (!result.ok) throw new Error(result.message)
    expect(result.text).toContain('there are two of them')
    expect(result.text).toContain("      'alpha',\n      'charlie',\n    ])")
    expect(result.text).not.toContain("'bravo'")
  })

  it('reads back the taught ids a spec lists now', () => {
    const fixture = [
      '    expect(taught.map((entry) => entry.id).sort()).toEqual([',
      "      'alpha',",
      "      'charlie',",
      '    ])',
    ].join('\n')
    expect(listedTaughtIds(fixture)).toStrictEqual(['alpha', 'charlie'])
    expect(listedTaughtIds('nothing here')).toStrictEqual([])
  })

  it('refuses a fixture it no longer recognises, and says which anchor is missing', () => {
    const result = regenerateTaughtEntries('const unrelated = 1', inputs)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('taught-entries title')
    expect(result.message).toContain('expected exactly one match')
  })
})

describe('mentionsOf', () => {
  const texts = new Map([
    ['e2e/a.spec.ts', "await page.goto('/vi/gambits/van-geet-opening-damhaug-gambit')"],
    ['e2e/b.spec.ts', 'expect(named("Bird Opening: From\'s Gambit, Langheld Gambit"))'],
    ['e2e/c.spec.ts', 'href$="/benko-gambit-accepted-king-walk-variation"'],
    ['e2e/d.spec.ts', "'benko-gambit-accepted'"],
  ])

  it('finds an entry by the id in a path or quote, and by its quoted full name', () => {
    expect(
      mentionsOf(texts, [
        { id: 'van-geet-opening-damhaug-gambit', name: 'Van Geet Opening: Damhaug Gambit' },
        {
          id: 'bird-opening-froms-gambit-langheld-gambit',
          name: "Bird Opening: From's Gambit, Langheld Gambit",
        },
      ]),
    ).toStrictEqual([
      'e2e/a.spec.ts names van-geet-opening-damhaug-gambit',
      'e2e/b.spec.ts names bird-opening-froms-gambit-langheld-gambit',
    ])
  })

  it('does not take an id for a longer id that merely starts with it', () => {
    expect(mentionsOf(texts, [{ id: 'benko-gambit', name: 'Benko Gambit' }])).toStrictEqual([])
    expect(
      mentionsOf(texts, [{ id: 'benko-gambit-accepted', name: 'Benko Gambit Accepted' }]),
    ).toStrictEqual(['e2e/d.spec.ts names benko-gambit-accepted'])
  })
})

describe('the real repository', () => {
  it('is already up to date: regenerating the three golden lists changes nothing', () => {
    const content = loadContent('content')
    if (!content.ok) throw new Error('the real content does not validate')
    const catalogue = build({
      datasetDir: join('tools', 'catalogue', 'dataset'),
      sourceDir: join('tools', 'catalogue', 'source'),
      contentDir: 'content',
    })
    if (!catalogue.ok) throw new Error('the real catalogue does not build')

    const records = catalogue.value.records
    const inputs: GoldenInputs = {
      contentIds: content.entries.map(({ entry }) => entry.id),
      taughtIds: records.filter((record) => record.tier === 'taught').map((record) => record.id),
      branchCounts: new Map(records.map((record) => [record.id, record.branchKeys.length])),
      totalEntries: records.length,
    }

    const stale = [
      ['tools/content/content-cli.test.ts', regenerateContentCli],
      ['tools/catalogue/branches.test.ts', regenerateBranches],
      ['e2e/taught-entries.spec.ts', regenerateTaughtEntries],
    ].flatMap(([file, regenerate]) => {
      if (typeof file !== 'string' || typeof regenerate !== 'function') return []
      const current = readFileSync(file, 'utf8')
      const next = regenerate(current, inputs)
      return next.ok && next.text === current ? [] : [file]
    })

    expect(stale, 'run `npm run fixtures:golden` and commit the result').toStrictEqual([])
  }, 240_000)
})
