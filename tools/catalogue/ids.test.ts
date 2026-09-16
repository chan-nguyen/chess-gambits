import { describe, expect, it } from 'vitest'
import {
  freeze,
  indexFrozen,
  lineKey,
  mintedId,
  missingPublishedIds,
  renames,
  resolveIds,
  slugify,
} from './ids.ts'
import type { FrozenIds } from './source.ts'

/**
 * AC 3. Ids are frozen.
 *
 * The failure this prevents is silent: a dataset rename changes a regenerated slug, every
 * shared URL to that gambit 404s, and the build passes every other check. So the id is
 * looked up by the **defining line**, which upstream does not rewrite for style, and the
 * map is the authority.
 */

const map = (entries: FrozenIds['entries']): FrozenIds => ({ note: 'fixture', entries })

const EVANS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4']

describe('minting an id from a name', () => {
  it('drops apostrophes rather than turning them into a segment', () => {
    expect(slugify("King's Gambit")).toBe('kings-gambit')
  })

  it('folds accents, and transliterates the letters that are not accents', () => {
    expect(slugify('Grünfeld Defense')).toBe('grunfeld-defense')
    expect(slugify('Réti Opening')).toBe('reti-opening')
    expect(slugify('Benko Gambit Declined: Hjørring Countergambit')).toContain('hjorring')
  })

  /** The runtime loader bounds an id at 64 characters before it goes in a request path. */
  it('keeps a long name inside the id bound by dropping the opening head', () => {
    const name = "King's Gambit Declined: Falkbeer Countergambit, Charousek Gambit, Keres Variation"
    expect(mintedId(name).length).toBeLessThanOrEqual(64)
    expect(mintedId(name)).toBe('falkbeer-countergambit-charousek-gambit-keres-variation')
  })

  it('keeps the head when the whole name already fits', () => {
    expect(mintedId('Italian Game: Evans Gambit')).toBe('italian-game-evans-gambit')
  })
})

describe('the frozen map', () => {
  it('refuses two ids on one defining line, which would make the lookup a coin toss', () => {
    const { issues } = indexFrozen(
      map({
        'evans-gambit': { name: 'Evans', eco: 'C51', definingLine: EVANS },
        'evans-gambit-again': { name: 'Evans again', eco: 'C51', definingLine: EVANS },
      }),
      'ids.json',
    )
    expect(issues[0]?.message).toContain('shares its defining line')
  })

  it('refuses to invent an id for an entry that has none', () => {
    const { index } = indexFrozen(map({}), 'ids.json')
    const { resolved, issues } = resolveIds(
      index,
      [{ name: 'Italian Game: Evans Gambit', eco: 'C51', definingLine: EVANS }],
      'fixture',
    )
    expect(resolved).toEqual([])
    expect(issues[0]?.message).toContain('catalogue:freeze')
  })
})

describe('a dataset rename', () => {
  const frozen = map({
    'italian-game-evans-gambit': {
      name: 'Italian Game: Evans Gambit',
      eco: 'C51',
      definingLine: EVANS,
    },
  })

  it('keeps the id, because the line is the identity and the name is display', () => {
    const { index } = indexFrozen(frozen, 'ids.json')
    const { resolved } = resolveIds(
      index,
      [{ name: 'Italian Game: Evans Gambit (renamed upstream)', eco: 'C51', definingLine: EVANS }],
      'fixture',
    )
    expect(resolved[0]?.id).toBe('italian-game-evans-gambit')
  })

  /**
   * The half that proves the freeze is doing work rather than agreeing with a slug.
   * A build that regenerated the id from the new name would publish a different URL, and
   * the gate below is what catches it.
   */
  it('would change the id if it were regenerated, and the gate catches that', () => {
    const renamed = 'Italian Game: Evans Gambit (renamed upstream)'
    expect(mintedId(renamed)).not.toBe('italian-game-evans-gambit')

    const { index } = indexFrozen(frozen, 'ids.json')
    const issues = missingPublishedIds(index, [mintedId(renamed)], 'ids.json')
    expect(issues[0]?.message).toContain('italian-game-evans-gambit')
    expect(issues[0]?.message).toContain('would now 404')
  })

  it('is reported, so a name changing upstream is visible rather than merely absorbed', () => {
    const { index } = indexFrozen(frozen, 'ids.json')
    const { resolved } = resolveIds(
      index,
      [{ name: 'Evans Gambit, renamed', eco: 'C51', definingLine: EVANS }],
      'fixture',
    )
    expect(renames(index, resolved)).toEqual([
      {
        id: 'italian-game-evans-gambit',
        was: 'Italian Game: Evans Gambit',
        now: 'Evans Gambit, renamed',
      },
    ])
  })
})

describe('freezing', () => {
  it('appends, and never rewrites an id or the name it was minted from', () => {
    const before = map({
      'italian-game-evans-gambit': {
        name: 'Italian Game: Evans Gambit',
        eco: 'C51',
        definingLine: EVANS,
      },
    })
    const after = freeze(before, [
      { name: 'Italian Game: Evans Gambit, renamed upstream', eco: 'C52', definingLine: EVANS },
      { name: 'Benko Gambit', eco: 'A57', definingLine: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'] },
    ])

    expect(after.entries['italian-game-evans-gambit']).toEqual(
      before.entries['italian-game-evans-gambit'],
    )
    expect(Object.keys(after.entries).sort()).toEqual(['benko-gambit', 'italian-game-evans-gambit'])
  })

  it('takes a hand-curated id as given, because a trap names its own', () => {
    const after = freeze(map({}), [
      { id: 'legals-mate', name: "Légal's Mate", eco: 'C41', definingLine: ['e4', 'e5'] },
    ])
    expect(Object.keys(after.entries)).toEqual(['legals-mate'])
  })

  it('separates two names that slug the same, deterministically', () => {
    const mintables = [
      { name: 'Same Name', eco: 'A00', definingLine: ['e4'] },
      { name: 'Same Name', eco: 'A00', definingLine: ['d4'] },
    ]
    const forwards = Object.keys(freeze(map({}), mintables)).sort()
    const backwards = Object.keys(freeze(map({}), [...mintables].reverse())).sort()
    expect(forwards).toEqual(backwards)
    expect(Object.keys(freeze(map({}), mintables).entries).sort()).toEqual([
      'same-name',
      'same-name-2',
    ])
  })
})

describe('lineKey', () => {
  it('is the moves, which is what makes the lookup survive a rename', () => {
    expect(lineKey(EVANS)).toBe('e4 e5 Nf3 Nc6 Bc4 Bc5 b4')
  })
})
