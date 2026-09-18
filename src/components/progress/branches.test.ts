import { describe, expect, it } from 'vitest'
import { MAPPED_ENTRY, MATE_ENTRY, MATE_LINE } from '../learn/learn-fixtures.ts'
import type { CompiledNode, CompiledOutcome } from '../../lib/content-types.ts'
import { branchKey, countableBranches, learnedCount } from './branches.ts'

/**
 * What the denominator is made of.
 *
 * Positions are placeholders here and nothing reads them: this file is about tree *shape*,
 * and a real FEN would suggest these trees are chess claims when they are counting
 * fixtures. Where a real tree is wanted, the learning surface's fixtures are used, because
 * those carry positions produced by replaying real moves.
 */
const FEN = 'placeholder - this file never reads a position'

const MATE: CompiledOutcome = {
  kind: 'mate',
  inMoves: 3,
  sequence: ['Nd5#'],
  sequenceFens: [FEN],
  provedBy: 'modelled-net',
  basis: { basis: 'proved', by: 'certificate', certificate: 'fixture.mate.json' },
}

const POSITION: CompiledOutcome = {
  kind: 'position',
  evaluation: { vi: 'Trắng hơn quân.' },
  plan: { vi: 'Đổi hậu.' },
  basis: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
}

const UNEXPLORED: CompiledOutcome = { kind: 'unexplored' }

const leaf = (ply: string, outcome: CompiledOutcome): CompiledNode => ({
  ply,
  kind: 'learner',
  fen: FEN,
  outcome,
})

const root = (children: readonly CompiledNode[]): CompiledNode => ({
  kind: 'opponent',
  fen: FEN,
  children,
})

describe('a branch is a root-to-leaf line', () => {
  it('counts one branch per leaf, keyed by the path that reaches it', () => {
    const tree = root([
      {
        ply: 'fxe5',
        kind: 'learner',
        fen: FEN,
        children: [leaf('Qh5+', POSITION), leaf('Nc3', POSITION)],
      },
      leaf('Qe7', POSITION),
    ])

    expect(countableBranches(tree)).toStrictEqual([
      branchKey(['fxe5', 'Qh5+']),
      branchKey(['fxe5', 'Nc3']),
      branchKey(['Qe7']),
    ])
  })

  it('counts a proved mate, which is the branch this product exists to teach', () => {
    expect(countableBranches(root([leaf('Nd5#', MATE)]))).toStrictEqual([branchKey(['Nd5#'])])
  })

  it('counts a transposing leaf, which carries no outcome at all', () => {
    const transposing: CompiledNode = {
      ply: 'd4',
      kind: 'learner',
      fen: FEN,
      transposesTo: ['scotch-gambit'],
    }

    expect(countableBranches(root([transposing]))).toStrictEqual([branchKey(['d4'])])
  })

  it('keys a real entry by the path that reaches its one countable branch', () => {
    expect(countableBranches(MATE_ENTRY.tree)).toStrictEqual([branchKey(MATE_LINE)])
    expect(branchKey(MATE_LINE)).toBe('Bh5_Nxe5_Bxd1')
  })

  /**
   * The literal is the whole test: `branchKey` on both sides of an assertion agrees with
   * itself whatever it does. `+` is the character that makes a key and a URL disagree when the
   * encoding is dropped — raw, it is the form encoding for a space — and since #46 it cannot
   * come from a mate leaf's own path, because the mating move lives in the proof rather than
   * in the tree. So it comes from a check played on the way to the leaf, which is ordinary
   * content and is what `MAPPED_ENTRY` and `e2e/line-parameter.spec.ts` navigate.
   */
  it('percent-encodes a check in the path, so a key stays a link', () => {
    const tree = root([
      { ply: 'Qh5+', kind: 'opponent', fen: FEN, children: [leaf('Ke7', POSITION)] },
    ])

    expect(countableBranches(tree)).toStrictEqual(['Qh5%2B_Ke7'])
  })

  it('has no branch at the root of a tree that is only a root', () => {
    expect(countableBranches({ kind: 'opponent', fen: FEN, outcome: UNEXPLORED })).toStrictEqual([])
  })

  it('skips a child with no ply, because nothing could address it', () => {
    const unaddressable: CompiledNode = { kind: 'learner', fen: FEN, outcome: POSITION }

    expect(countableBranches(root([unaddressable, leaf('Qe7', POSITION)]))).toStrictEqual([
      branchKey(['Qe7']),
    ])
  })
})

/**
 * AC 6, and the rule is a `return` rather than a comment, so here is the tree that walks
 * into it. A net cannot reach the browser through today's pipeline — a certificate is a
 * build input — but `isCompiledEntry` accepts a node carrying an outcome *and* children, so
 * this is a shape the application can be handed.
 */
describe('a generated mate net is excluded from the denominator', () => {
  const NET_SIZE = 300

  const defences = Array.from({ length: NET_SIZE }, (_, index) => leaf(`Ng${index + 1}`, POSITION))

  const withNet = (outcome: CompiledOutcome | undefined): CompiledNode =>
    root([
      outcome === undefined
        ? { ply: 'Nd5#', kind: 'opponent', fen: FEN, children: defences }
        : { ply: 'Nd5#', kind: 'opponent', fen: FEN, outcome, children: defences },
    ])

  it('counts a mate leaf carrying a spliced net as one branch, not three hundred', () => {
    expect(countableBranches(withNet(MATE))).toStrictEqual([branchKey(['Nd5#'])])
  })

  /**
   * The control. Without it the assertion above would pass just as well on a walker that
   * had stopped counting altogether, and this project has already shipped one gate that
   * could not fail. The same tree with the outcome taken off is walked all the way down, so
   * the difference between 1 and 300 is caused by the exclusion and by nothing else.
   */
  it('walks exactly that tree when the outcome is not there to stop it', () => {
    expect(countableBranches(withNet(undefined))).toHaveLength(NET_SIZE)
  })

  it('leaves every other branch of the entry counted', () => {
    const tree = root([
      { ply: 'Nd5#', kind: 'opponent', fen: FEN, outcome: MATE, children: defences },
      leaf('Qe7', POSITION),
    ])

    expect(countableBranches(tree)).toStrictEqual([branchKey(['Nd5#']), branchKey(['Qe7'])])
  })
})

/**
 * The second exclusion, which this brief did not ask for. An `unexplored` leaf is the
 * placeholder that lets half-finished work be committed; counting it would make the
 * denominator a measure of content nobody has written.
 */
describe('an unexplored stub is not a branch', () => {
  it('is left out of the count', () => {
    expect(countableBranches(root([leaf('Qe7', UNEXPLORED)]))).toStrictEqual([])
  })

  it('leaves its siblings counted', () => {
    const tree = root([leaf('Qe7', UNEXPLORED), leaf('fxe5', POSITION)])

    expect(countableBranches(tree)).toStrictEqual([branchKey(['fxe5'])])
  })

  /**
   * The published catalogue today is entirely Tier 0, and the learning surface's own mapped
   * fixture ends in two unexplored stubs. So this is not a hypothetical state: it is the
   * state of every entry on the site, and the empty count is what it must produce.
   */
  it('leaves a mapped-but-unfinished entry with nothing to mark', () => {
    expect(countableBranches(MAPPED_ENTRY.tree)).toStrictEqual([])
  })
})

describe('the numerator', () => {
  const branches = [branchKey(['a4']), branchKey(['b4']), branchKey(['c4'])]

  it('counts the marked branches that exist', () => {
    expect(learnedCount(branches, new Set([branchKey(['a4']), branchKey(['c4'])]))).toBe(2)
  })

  it('is zero when nothing is marked', () => {
    expect(learnedCount(branches, new Set())).toBe(0)
  })

  /**
   * The reason it is an intersection. A mark made against a branch that has since been
   * renamed or removed must not be counted, or a learner reads "4 of 3" — a number that is
   * not merely wrong but impossible, on the one display whose whole job is to be believed.
   */
  it('never exceeds the denominator when marks outlive the content', () => {
    const stale = new Set([...branches, branchKey(['d4']), branchKey(['e4'])])

    expect(learnedCount(branches, stale)).toBe(branches.length)
  })

  it('drops a mark whose branch no longer exists rather than counting it', () => {
    expect(learnedCount(branches, new Set([branchKey(['d4'])]))).toBe(0)
  })
})
