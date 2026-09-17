import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import type { CompiledEntry, CompiledNode, CompiledOutcome } from '../../lib/content-types.ts'
import { isCompiledEntry } from '../../lib/content.ts'
import * as learnFixtures from './learn-fixtures.ts'
import * as treeFixtures from './tree-fixtures.ts'

/**
 * **The fixtures are checked against the rules, not against a belief about them** (issue #46).
 *
 * `MATE_ENTRY` shipped for three tickets with its outcome hung on the final `Nd5#` node, its
 * `sequence` holding the moves that *led there*, and `inMoves: 3` stated at a position where
 * the game was already over. Nothing rendered an outcome, so nothing noticed; then #11 drew a
 * `MateNet` from it and the fixture began teaching the renderer the wrong shape. A fixture
 * that is wrong is worse than one that is missing, because every test written against it
 * passes.
 *
 * Note what would *not* have caught it: the arithmetic was self-consistent. Three moves and
 * five plies satisfies `2N - 1` exactly. Only replaying the line against a board says that the
 * position it starts from is one where the game has already ended — which is why this file
 * replays rather than counts, and why counting is here as well but not on its own.
 *
 * What `docs/CONTEXT.md` (*Outcome*) requires of a mate leaf, and what this asserts:
 *
 * - `sequence` is the longest line in the net **in plies from this leaf**, so a mate in `N`
 *   runs to `2N - 1` plies and the leaf's own position is *before* the mate, never after it;
 * - every ply is legal in the position the ply before it produced; and
 * - the last ply, and only the last ply, is checkmate.
 *
 * `chess.js` is a devDependency and this is a test, which is the arrangement ADR-0003's
 * tripwire allows and `last-ply.test.ts` already relies on: the engine runs in CI and reaches
 * no browser. `src/components/board/board-tripwire.test.ts` holds the other half.
 *
 * The walk is over **every `CompiledEntry` this folder's fixture modules export**, found with
 * `isCompiledEntry` rather than from a list written here, so a fixture added tomorrow is covered
 * by having been exported — and a fixture *file* added tomorrow is caught by the glob below
 * rather than quietly going unchecked. That pairing is what stops #46 recurring; the assertions
 * are only what it checks.
 */

type MateOutcome = Extract<CompiledOutcome, { kind: 'mate' }>

type MateLeaf = {
  /** The exported name, so a failure names the fixture without anyone going to look. */
  readonly fixture: string
  /** The path from the entry root, spelled the way the move list reads. */
  readonly line: string
  readonly node: CompiledNode
  readonly outcome: MateOutcome
}

const EXPORTED: readonly [string, unknown][] = [
  ...Object.entries(learnFixtures),
  ...Object.entries(treeFixtures),
]

/**
 * Sorted by name on purpose. A module namespace object's key order is the specification's
 * (sorted), a bundler's is whatever it emits, and a test whose expected list depends on which
 * of those it got is a test that fails on somebody else's machine.
 */
const ENTRIES: readonly { readonly name: string; readonly entry: CompiledEntry }[] =
  EXPORTED.flatMap(([name, value]) =>
    isCompiledEntry(value) ? [{ name, entry: value }] : [],
  ).sort((left, right) => (left.name < right.name ? -1 : 1))

const mateLeaves = (
  fixture: string,
  node: CompiledNode,
  path: readonly string[],
): readonly MateLeaf[] => {
  const { outcome } = node
  const here =
    outcome?.kind === 'mate' ? [{ fixture, line: path.join(' ') || '(root)', node, outcome }] : []

  return [
    ...here,
    ...(node.children ?? []).flatMap((child) =>
      mateLeaves(fixture, child, child.ply === undefined ? path : [...path, child.ply]),
    ),
  ]
}

const MATE_LEAVES: readonly MateLeaf[] = ENTRIES.flatMap(({ name, entry }) =>
  mateLeaves(name, entry.tree, []),
)

/** Every node of every fixture, flattened, for the one check that is about spelling alone. */
const allNodes = (node: CompiledNode): readonly CompiledNode[] => [
  node,
  ...(node.children ?? []).flatMap(allNodes),
]

/** The board at `fen`, or null where the FEN is not one. `Chess` throws; callers here do not. */
const boardAt = (fen: string): Chess | null => {
  try {
    return new Chess(fen)
  } catch {
    return null
  }
}

/**
 * What is wrong with a mate claim, in words a reader can act on, and an empty list when
 * nothing is. A list rather than a throw so that one broken fixture reports everything wrong
 * with it in a single run — and so this function can itself be handed a wrong claim below.
 */
const mateProblems = (fen: string, { inMoves, sequence }: MateOutcome): readonly string[] => {
  const expected = 2 * inMoves - 1
  const counting =
    sequence.length === expected
      ? []
      : [
          `inMoves ${inMoves} needs ${expected} plies by the 2N-1 rule, ` +
            `and sequence has ${sequence.length}`,
        ]

  const board = boardAt(fen)
  if (board === null) return [...counting, `the leaf FEN does not parse: ${fen}`]
  if (board.isGameOver()) {
    return [...counting, 'the game is already over at the leaf, so no line runs from it']
  }

  const played: string[] = []
  for (const [index, ply] of sequence.entries()) {
    try {
      board.move(ply)
    } catch {
      return [...counting, `${ply} is not legal after ${played.join(' ') || 'the leaf position'}`]
    }
    played.push(ply)

    const last = index === sequence.length - 1
    if (board.isCheckmate() !== last) {
      return [
        ...counting,
        last
          ? `the sequence ends on ${ply} without checkmate`
          : `${ply} is already checkmate, and the sequence carries on past it`,
      ]
    }
  }

  return counting
}

describe('the fixtures this folder tests against', () => {
  /**
   * The half the walk cannot do for itself: a fixture module added next door is invisible to a
   * file that never imports it. The glob is **lazy** — keys only, nothing loaded through it —
   * because an eager one importing a module mid-flight is exactly what made fourteen tests
   * vanish in #50 (`tools/test/floor.ts`).
   */
  it('imports every fixture module in this folder', () => {
    expect(Object.keys(import.meta.glob('./*fixtures.ts')).sort()).toStrictEqual([
      './learn-fixtures.ts',
      './tree-fixtures.ts',
    ])
  })

  it('exports the entries the walk below is over', () => {
    expect(ENTRIES.map(({ name }) => name)).toStrictEqual([
      'BRANCHING_ENTRY',
      'EVANS_ENTRY',
      'MAPPED_ENTRY',
      'MATE_ENTRY',
      'OUTCOMES_ENTRY',
      'WIDE_ENTRY',
    ])
  })

  it('carries the proved mates, or the replay would be asserting over nothing', () => {
    expect(MATE_LEAVES.map((leaf) => `${leaf.fixture} ${leaf.line}`)).toStrictEqual([
      'BRANCHING_ENTRY Bxd1',
      'MATE_ENTRY Bh5 Nxe5 Bxd1',
      'OUTCOMES_ENTRY Bh5 Nxe5 Bxd1',
    ])
  })
})

describe('a mate leaf states a line that can be played from it', () => {
  it.each(MATE_LEAVES)('$fixture, after $line', ({ node, outcome }) => {
    expect(mateProblems(node.fen, outcome)).toStrictEqual([])
  })

  it.each(MATE_LEAVES)('$fixture, after $line, is a leaf with no net under it', ({ node }) => {
    expect(node.children).toBeUndefined()
  })

  /**
   * The shape defect, stated positively. A ply spelled `#` is checkmate (invariant 6), a
   * checkmate node is a leaf and must carry an outcome (invariant 3), and there is no outcome
   * a finished game can carry — so a `#` in a *tree* is always the mistake #46 fixed. It
   * belongs in the `sequence`, which is the proof, and the replay above is what reads it.
   */
  it('never spells the mating move as a node in the tree', () => {
    const mating = ENTRIES.flatMap(({ name, entry }) =>
      allNodes(entry.tree)
        .filter((node) => node.ply?.endsWith('#') === true)
        .map((node) => `${name}: ${node.ply ?? ''}`),
    )

    expect(mating).toStrictEqual([])
  })
})

/**
 * **And the boards themselves** (review addition).
 *
 * Everything above reads a mate leaf's `sequence`, which is the *proof*. Nothing reads the
 * *tree*: a node's `fen` is the position the board component draws, and no test anywhere
 * checks that it is the position that node's own `ply` actually produces. A FEN pasted from
 * the wrong line renders a wrong board in every test that uses the fixture, and every one of
 * them passes — which is #46's defect exactly, one level above where #46 fixed it.
 *
 * Real content cannot drift this way. `tools/content/validate.ts` derives every FEN by
 * replaying the authored SAN, so a file and its boards cannot disagree. Fixtures are written
 * by hand and skip that pipeline entirely, which is the reason this file exists at all — so
 * the pipeline's guarantee is restated here as an assertion instead of being absent.
 */
const boardProblems = (entry: CompiledEntry): readonly string[] => {
  const opening = new Chess()
  /**
   * The prelude (#70), checked against the same replay rather than against itself. These are
   * the boards a learner now walks on the way to the root, and a fixture writes them by hand
   * — so without this they could draw any position at all and every test using the fixture
   * would still pass, which is exactly the hole this file was written to close one level up.
   */
  const prelude: string[] = []
  if (entry.prelude.length !== entry.definingLine.length + 1) {
    prelude.push(
      `the prelude has ${entry.prelude.length} positions for ${entry.definingLine.length} plies`,
    )
  }
  if (entry.prelude[0]?.fen !== opening.fen()) {
    prelude.push('the prelude does not begin at the initial position')
  }
  if (entry.prelude[0]?.ply !== undefined) {
    prelude.push('the prelude s first position claims a ply reached it')
  }

  for (const [index, ply] of entry.definingLine.entries()) {
    try {
      opening.move(ply)
    } catch {
      return [...prelude, `the defining line stops being legal at ${ply}`]
    }

    const step = entry.prelude[index + 1]
    if (step?.ply !== ply) prelude.push(`the prelude names ${step?.ply ?? '(nothing)'} for ${ply}`)
    if (step?.fen !== opening.fen()) {
      prelude.push(`the prelude s board after ${ply} is not the position ${ply} produces`)
    }
  }

  const problems: string[] =
    opening.fen() === entry.tree.fen
      ? [...prelude]
      : [...prelude, 'the root is not the position the defining line reaches']

  if (boardAt(entry.tree.fen) === null) {
    return [...problems, `the root fen does not parse: ${entry.tree.fen}`]
  }

  const walk = (node: CompiledNode, fen: string, path: readonly string[]): void => {
    for (const child of node.children ?? []) {
      const { ply } = child
      if (ply === undefined) {
        problems.push(`${path.join(' ') || '(root)'}: a child below the root states no ply`)
        continue
      }

      const here = [...path, ply]
      const board = boardAt(fen)
      if (board === null) continue

      try {
        board.move(ply)
      } catch {
        problems.push(`${here.join(' ')}: ${ply} is not legal in the position above it`)
        continue
      }

      if (board.fen() !== child.fen) {
        problems.push(`${here.join(' ')}: the fen is not the position ${ply} produces`)
      }

      walk(child, board.fen(), here)
    }
  }

  walk(entry.tree, entry.tree.fen, [])
  return problems
}

describe('every board in a fixture is the board its own moves produce', () => {
  it.each(ENTRIES)('$name', ({ entry }) => {
    expect(boardProblems(entry)).toStrictEqual([])
  })
})

/**
 * The same control the replay gets, for the same reason: these assertions pass on an empty
 * list, and so would a walk that had stopped walking.
 */
describe('the board walk fails on a fixture that is wrong', () => {
  const START = new Chess().fen()
  const { MATE_ENTRY } = learnFixtures

  /** Both messages, because the walk carries on past the root rather than bailing at it. */
  it('reports a root that is not where the defining line ends', () => {
    expect(
      boardProblems({ ...MATE_ENTRY, tree: { ...MATE_ENTRY.tree, fen: START } }),
    ).toStrictEqual([
      'the root is not the position the defining line reaches',
      'Bh5: Bh5 is not legal in the position above it',
    ])
  })

  it('reports a defining line that stops being legal', () => {
    expect(
      boardProblems({ ...MATE_ENTRY, definingLine: [...MATE_ENTRY.definingLine, 'Qxh8'] }),
    ).toStrictEqual([
      `the prelude has ${MATE_ENTRY.prelude.length} positions for ${MATE_ENTRY.definingLine.length + 1} plies`,
      'the defining line stops being legal at Qxh8',
    ])
  })

  /** And the prelude's own boards, which nothing else in the suite looks at (#70). */
  it('reports a prelude board that is not the position its own ply produces', () => {
    const [first, second, ...rest] = MATE_ENTRY.prelude
    if (first === undefined || second === undefined) throw new Error('MATE_ENTRY has no prelude')

    expect(
      boardProblems({ ...MATE_ENTRY, prelude: [first, { ...second, fen: START }, ...rest] }),
    ).toStrictEqual([
      `the prelude s board after ${second.ply ?? ''} is not the position ${second.ply ?? ''} produces`,
    ])
  })

  it('reports a prelude that does not begin at the initial position', () => {
    const [, ...rest] = MATE_ENTRY.prelude

    expect(
      boardProblems({ ...MATE_ENTRY, prelude: [{ fen: MATE_ENTRY.tree.fen }, ...rest] }),
    ).toStrictEqual(['the prelude does not begin at the initial position'])
  })

  it('reports a prelude that is the wrong length for its defining line', () => {
    expect(
      boardProblems({ ...MATE_ENTRY, prelude: MATE_ENTRY.prelude.slice(0, -1) }),
    ).toStrictEqual([
      `the prelude has ${MATE_ENTRY.prelude.length - 1} positions for ${MATE_ENTRY.definingLine.length} plies`,
      `the prelude names (nothing) for ${MATE_ENTRY.definingLine[MATE_ENTRY.definingLine.length - 1] ?? ''}`,
      `the prelude s board after ${MATE_ENTRY.definingLine[MATE_ENTRY.definingLine.length - 1] ?? ''} is not the position ${MATE_ENTRY.definingLine[MATE_ENTRY.definingLine.length - 1] ?? ''} produces`,
    ])
  })

  it('reports a node whose board is not what its own ply produces', () => {
    const [first, ...rest] = MATE_ENTRY.tree.children ?? []
    if (first === undefined) throw new Error('MATE_ENTRY has no branch to corrupt')

    expect(
      boardProblems({
        ...MATE_ENTRY,
        tree: { ...MATE_ENTRY.tree, children: [{ ...first, fen: START }, ...rest] },
      }),
    ).toStrictEqual([`${first.ply ?? ''}: the fen is not the position ${first.ply ?? ''} produces`])
  })
})

/**
 * **The control.** Every assertion above expects an empty list, and an empty list is also what
 * a check that has quietly stopped checking returns. So the same function is handed the exact
 * claim `MATE_ENTRY` carried before #46, and then each separate way a mate claim can be wrong.
 */
describe('the replay fails on a claim that is wrong', () => {
  const claim = (inMoves: number, sequence: readonly string[]): MateOutcome => ({
    kind: 'mate',
    inMoves,
    sequence,
    provedBy: 'modelled-net',
    basis: {
      basis: 'proved',
      by: 'certificate',
      certificate: 'fixture-legal-trap.Bxd1.mate.json',
    },
  })

  /** Where `MATE_ENTRY`'s outcome used to sit: the position after `8.Nd5#`. */
  const AFTER_MATE = 'r2q1bnr/ppp1kBpp/2np4/3NN3/4P3/7P/PPPP1PP1/R1BbK2R b KQ - 2 8'
  /** Where it sits now: `6...Bxd1`, White to move, mate in two. */
  const AT_LEAF = 'r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N4P/PPPP1PP1/R1BbK2R w KQkq - 0 7'

  it('reports the pre-#46 claim, whose ply count alone looked right', () => {
    const before = claim(3, ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'])

    expect(2 * before.inMoves - 1).toBe(before.sequence.length)
    expect(mateProblems(AFTER_MATE, before)).toStrictEqual([
      'the game is already over at the leaf, so no line runs from it',
    ])
  })

  it('reports a move count that does not match the plies', () => {
    expect(mateProblems(AT_LEAF, claim(3, ['Bxf7+', 'Ke7', 'Nd5#']))).toStrictEqual([
      'inMoves 3 needs 5 plies by the 2N-1 rule, and sequence has 3',
    ])
  })

  it('reports a ply that is not legal in the position before it', () => {
    expect(mateProblems(AT_LEAF, claim(2, ['Bxf7+', 'Kd8', 'Nd5#']))).toStrictEqual([
      'Kd8 is not legal after Bxf7+',
    ])
  })

  it('reports a line that stops short of mate', () => {
    expect(mateProblems(AT_LEAF, claim(2, ['Bxf7+', 'Ke7', 'Nf3']))).toStrictEqual([
      'the sequence ends on Nf3 without checkmate',
    ])
  })

  it('reports a mate that arrives before the line ends', () => {
    expect(mateProblems(AT_LEAF, claim(2, ['Bxf7+', 'Ke7', 'Nd5#', 'Kd8']))).toStrictEqual([
      'inMoves 2 needs 3 plies by the 2N-1 rule, and sequence has 4',
      'Nd5# is already checkmate, and the sequence carries on past it',
    ])
  })

  it('reports a leaf FEN nothing can be played from', () => {
    expect(mateProblems('not a fen', claim(2, ['Bxf7+', 'Ke7', 'Nd5#']))).toStrictEqual([
      'the leaf FEN does not parse: not a fen',
    ])
  })
})
