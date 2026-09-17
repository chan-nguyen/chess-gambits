import { describe, expect, it } from 'vitest'
import type { CompiledEntry } from '../../lib/content-types.ts'
import { MAPPED_ENTRY, MAIN_LINE } from './learn-fixtures.ts'
import { addressKey, addressSearch, inPreludeAt, rootAddress, walkEntry } from './walk.ts'

/**
 * The join, on its own, away from React and away from the router.
 *
 * `tree-path.test.ts` owns the tree half and is unchanged by #70, which is itself part of
 * the claim: `line` still means what it meant, so the function that reads it did not need
 * touching. What is asserted here is everything the prelude added — where each half starts
 * and stops, that next and previous cross between them without a gap or a repeat, and that
 * nothing inside the defining line is a branch point.
 */

/** Five plies of defining line: `e4 e5 Nf3 f6 Nxe5`, so the root is prelude index 5. */
const ENTRY = MAPPED_ENTRY
const ROOT_INDEX = ENTRY.definingLine.length

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('the shape the build has to ship for a walk to exist at all', () => {
  it('carries one position per ply of the defining line, plus the initial one', () => {
    expect(ENTRY.prelude).toHaveLength(ROOT_INDEX + 1)
  })

  it('starts at the initial position, reached by no ply', () => {
    expect(ENTRY.prelude[0]).toStrictEqual({ fen: START_FEN })
  })

  /** The join: the last prelude position *is* the root, or the two halves do not meet. */
  it('ends exactly where the tree begins', () => {
    expect(ENTRY.prelude[ROOT_INDEX]?.fen).toBe(ENTRY.tree.fen)
    expect(ENTRY.prelude[ROOT_INDEX]?.ply).toBe(ENTRY.definingLine[ROOT_INDEX - 1])
  })
})

describe('where the walk stands', () => {
  it('stands on the initial position at prelude zero', () => {
    const walk = walkEntry(ENTRY, 0, [])

    expect(walk.fen).toBe(START_FEN)
    expect(walk.ply).toBeNull()
    expect(walk.previousFen).toBeNull()
    expect(walk.atStart).toBe(true)
    expect(walk.atRoot).toBe(false)
    expect(walk.inPrelude).toBe(true)
  })

  it('stands inside the defining line at a count below the root', () => {
    const walk = walkEntry(ENTRY, 2, [])

    expect(walk.fen).toBe(ENTRY.prelude[2]?.fen)
    expect(walk.ply).toBe('e5')
    expect(walk.previousFen).toBe(ENTRY.prelude[1]?.fen)
    expect(walk.inPrelude).toBe(true)
  })

  it('stands on the gambit root when no parameter asks for anything', () => {
    const walk = walkEntry(ENTRY, null, [])

    expect(walk.fen).toBe(ENTRY.tree.fen)
    expect(walk.atRoot).toBe(true)
    expect(walk.inPrelude).toBe(false)
    expect(walk.node).toBe(ENTRY.tree)
  })

  it('stands on the gambit root when the count reaches or passes the defining line', () => {
    for (const count of [ROOT_INDEX, ROOT_INDEX + 1, 400]) {
      const walk = walkEntry(ENTRY, count, [])

      expect(walk.fen).toBe(ENTRY.tree.fen)
      expect(walk.atRoot).toBe(true)
      expect(walk.inPrelude).toBe(false)
    }
  })

  it('names the root after the defining line s last ply, which is now a ply it has shown', () => {
    expect(walkEntry(ENTRY, null, []).ply).toBe('Nxe5')
    expect(walkEntry(ENTRY, null, []).previousFen).toBe(ENTRY.prelude[ROOT_INDEX - 1]?.fen)
  })
})

describe('previous and next are continuous across the join (AC 1)', () => {
  /** One walk, start to leaf, with no gap, no repeat and no mode change. */
  it('walks from the initial position to the end of the main line by pressing next', () => {
    const visited: string[] = []
    let prelude: number | null = 0
    let line: readonly string[] = []

    for (let step = 0; step < 20; step += 1) {
      const walk = walkEntry(ENTRY, prelude, line)
      visited.push(walk.fen)
      const { next } = walk
      if (next === null) break
      if (next.at === 'prelude') {
        prelude = next.plies
        line = []
      } else {
        prelude = null
        line = next.path
      }
    }

    expect(visited).toStrictEqual([
      ...ENTRY.prelude.map((step) => step.fen),
      ...MAIN_LINE.map((_, index) => {
        const walk = walkEntry(ENTRY, null, MAIN_LINE.slice(0, index + 1))
        return walk.fen
      }),
    ])
  })

  it('steps back out of the tree into the defining line', () => {
    expect(walkEntry(ENTRY, null, []).previous).toStrictEqual({
      at: 'prelude',
      plies: ROOT_INDEX - 1,
    })
  })

  it('steps forward out of the defining line into the tree', () => {
    expect(walkEntry(ENTRY, ROOT_INDEX - 1, []).next).toStrictEqual(rootAddress)
  })

  it('has no previous at the initial position and no next at a leaf', () => {
    expect(walkEntry(ENTRY, 0, []).previous).toBeNull()
    expect(walkEntry(ENTRY, null, MAIN_LINE).next).toBeNull()
  })

  it('offers the initial position from everywhere, and the root from everywhere', () => {
    for (const walk of [
      walkEntry(ENTRY, 0, []),
      walkEntry(ENTRY, 3, []),
      walkEntry(ENTRY, null, []),
      walkEntry(ENTRY, null, MAIN_LINE),
    ]) {
      expect(walk.start).toStrictEqual({ at: 'prelude', plies: 0 })
    }

    // AC 2: the root is still reachable in one press from inside the defining line.
    expect(walkEntry(ENTRY, 2, []).atRoot).toBe(false)
  })
})

describe('the defining line is not a branch point (AC 4)', () => {
  it('has no node at all inside the prelude, so there are no children to render', () => {
    for (let count = 0; count < ROOT_INDEX; count += 1) {
      expect(walkEntry(ENTRY, count, []).node).toBeNull()
    }
  })

  it('has a node from the root down, which is where the first branch is', () => {
    expect(walkEntry(ENTRY, null, []).node).not.toBeNull()
    expect(walkEntry(ENTRY, null, []).node?.children ?? []).not.toHaveLength(0)
  })
})

describe('what the move list is given', () => {
  it('lists the defining line up to where the learner stands, and no further', () => {
    expect(walkEntry(ENTRY, 2, []).steps.map((step) => step.ply)).toStrictEqual(['e4', 'e5'])
  })

  it('lists the whole defining line and then the path, at a node in the tree', () => {
    expect(walkEntry(ENTRY, null, ['fxe5']).steps.map((step) => step.ply)).toStrictEqual([
      ...ENTRY.definingLine,
      'fxe5',
    ])
  })

  /**
   * The addresses under those labels, which is where AC 3 could be broken quietly: the last
   * defining-line ply is the root and must be addressed as the root, with no parameter.
   */
  it('addresses the defining line by count and the root by nothing', () => {
    expect(
      walkEntry(ENTRY, null, ['fxe5']).steps.map((step) => addressSearch(step.address)),
    ).toStrictEqual(['?prelude=1', '?prelude=2', '?prelude=3', '?prelude=4', '', '?line=fxe5'])
  })

  it('marks which steps belong to the defining line', () => {
    expect(walkEntry(ENTRY, null, ['fxe5']).steps.map((step) => step.inPrelude)).toStrictEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ])
  })
})

describe('`line` wins over `prelude`, which is what makes AC 3 structural', () => {
  it('ignores a prelude count beside a requested path', () => {
    const withBoth = walkEntry(ENTRY, 1, ['fxe5'])
    const withLineOnly = walkEntry(ENTRY, null, ['fxe5'])

    expect(withBoth.fen).toBe(withLineOnly.fen)
    expect(withBoth.inPrelude).toBe(false)
  })

  /**
   * And a stale link to a branch that no longer exists still recovers to the nearest tree
   * node rather than falling into the opening. "That branch is gone, here is move one" is a
   * different answer from the one this page has always given.
   */
  it('ignores a prelude count beside a path that strayed', () => {
    const walk = walkEntry(ENTRY, 1, ['not-a-branch'])

    expect(walk.fen).toBe(ENTRY.tree.fen)
    expect(walk.inPrelude).toBe(false)
    expect(walk.resolved.strayedAt).toBe('not-a-branch')
  })

  it('agrees with the predicate the tree reads', () => {
    for (const [prelude, requested] of [
      [0, []],
      [2, []],
      [ROOT_INDEX, []],
      [null, []],
      [1, ['fxe5']],
      [null, MAIN_LINE],
    ] as const) {
      expect(inPreludeAt(ENTRY, prelude, requested)).toBe(
        walkEntry(ENTRY, prelude, requested).inPrelude,
      )
    }
  })
})

describe('an entry whose wire shape has no prelude', () => {
  /**
   * The build always emits one, so this is a truncated or doctored response. It costs the
   * walk and never the page: everything degrades to exactly what this surface did before the
   * prelude existed.
   */
  const stripped: CompiledEntry = { ...ENTRY, prelude: [] }

  it('behaves as the page did before the defining line was walkable', () => {
    const walk = walkEntry(stripped, 3, [])

    expect(walk.fen).toBe(ENTRY.tree.fen)
    expect(walk.inPrelude).toBe(false)
    expect(walk.previous).toBeNull()
    expect(walk.steps).toStrictEqual([])
    expect(walk.start).toStrictEqual(rootAddress)
  })
})

describe('addresses', () => {
  it('writes the root as no query string at all', () => {
    expect(addressSearch(rootAddress)).toBe('')
  })

  it('tells the initial position apart from the root, which are both empty-ish', () => {
    expect(addressKey({ at: 'prelude', plies: 0 })).not.toBe(addressKey(rootAddress))
  })

  it('keys every position of a full walk distinctly', () => {
    const keys = [
      ...ENTRY.prelude.map((_, index) =>
        addressKey(index === ROOT_INDEX ? rootAddress : { at: 'prelude', plies: index }),
      ),
      ...MAIN_LINE.map((_, index) =>
        addressKey({ at: 'line', path: MAIN_LINE.slice(0, index + 1) }),
      ),
    ]

    expect(new Set(keys).size).toBe(keys.length)
  })
})
