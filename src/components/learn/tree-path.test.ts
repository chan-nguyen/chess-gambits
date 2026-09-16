import { describe, expect, it } from 'vitest'
import type { CompiledNode } from '../../lib/content-types.ts'
import {
  EVANS_ENTRY,
  MAIN_LINE,
  MAPPED_ENTRY,
  MATE_ENTRY,
  MATE_LINE,
  PLAN_LINE,
  WIDE_ENTRY,
} from './learn-fixtures.ts'
import {
  branchChoices,
  moveNumberOf,
  nextPath,
  plyLabel,
  previousPath,
  resolvePath,
} from './tree-path.ts'

const root = MAPPED_ENTRY.tree

/** Twenty-four defender replies, which is the number §3 names as "not a design". */
const DEFENDER_REPLIES: readonly string[] = [
  'Kd8',
  'Kd7',
  'Kf8',
  'Ke8',
  'Qe7',
  'Qf6',
  'Qg5',
  'Qh4',
  'Nd4',
  'Nb4',
  'Na5',
  'Nb8',
  'Nge7',
  'Nf6',
  'Nh6',
  'a6',
  'a5',
  'b6',
  'b5',
  'g6',
  'g5',
  'h6',
  'h5',
  'd5',
]

describe('following a path', () => {
  it('lands on the root when nothing is asked for', () => {
    const resolved = resolvePath(root, [])

    expect(resolved.node).toBe(root)
    expect(resolved.path).toStrictEqual([])
    expect(resolved.steps).toStrictEqual([])
    expect(resolved.strayedAt).toBeNull()
  })

  it('follows every ply of a full line', () => {
    const resolved = resolvePath(root, MAIN_LINE)

    expect(resolved.path).toStrictEqual(MAIN_LINE)
    expect(resolved.node.ply).toBe('Bc4+')
    expect(resolved.strayedAt).toBeNull()
  })

  it('gives each step the path that reaches it, so every step is its own URL', () => {
    const { steps } = resolvePath(root, MAIN_LINE)

    expect(steps.map((step) => step.path)).toStrictEqual([
      ['fxe5'],
      ['fxe5', 'Qh5+'],
      ['fxe5', 'Qh5+', 'Ke7'],
      ['fxe5', 'Qh5+', 'Ke7', 'Qxe5+'],
      ['fxe5', 'Qh5+', 'Ke7', 'Qxe5+', 'Kf7'],
      MAIN_LINE,
    ])
  })

  it('matches on SAN, so a reordered sibling does not redirect an old link', () => {
    // `Qe7` is the *second* child of the root; following it must not depend on that.
    const resolved = resolvePath(root, ['Qe7'])

    expect(resolved.node.ply).toBe('Qe7')
    expect(resolved.strayedAt).toBeNull()
  })
})

describe('recovering from a path that is not there', () => {
  it('stops at the nearest valid node and names the ply it could not follow', () => {
    const resolved = resolvePath(root, ['fxe5', 'Qh4+', 'Ke7'])

    expect(resolved.path).toStrictEqual(['fxe5'])
    expect(resolved.node.ply).toBe('fxe5')
    expect(resolved.strayedAt).toBe('Qh4+')
  })

  it('recovers to the root when the very first ply is wrong', () => {
    const resolved = resolvePath(root, ['e4'])

    expect(resolved.path).toStrictEqual([])
    expect(resolved.node).toBe(root)
    expect(resolved.strayedAt).toBe('e4')
  })

  it('reports only the first stray, because everything after it is unreachable anyway', () => {
    const resolved = resolvePath(root, ['nope', 'also-nope'])

    expect(resolved.strayedAt).toBe('nope')
  })

  it('stops at a leaf rather than walking past it', () => {
    const resolved = resolvePath(root, [...MAIN_LINE, 'Kg6'])

    expect(resolved.path).toStrictEqual(MAIN_LINE)
    expect(resolved.strayedAt).toBe('Kg6')
  })
})

describe('where previous and next go', () => {
  it('has no previous at the root (AC 1)', () => {
    expect(previousPath([])).toBeNull()
  })

  it('drops one ply, never one move', () => {
    expect(previousPath(['fxe5', 'Qh5+'])).toStrictEqual(['fxe5'])
  })

  it('has no next at a leaf (AC 1)', () => {
    const leaf = resolvePath(root, MAIN_LINE)

    expect(nextPath(leaf.node, leaf.path)).toBeNull()
  })

  it('adds one ply', () => {
    expect(nextPath(root, [])).toStrictEqual(['fxe5'])
  })

  it('follows the first modelled reply at a branch point, and says which one that is', () => {
    expect(root.children).toHaveLength(2)
    // Still the first child — but now read through `branchChoices`, so the other reply is
    // a thing the page can render rather than a thing this function threw away (#9).
    expect(nextPath(root, [])).toStrictEqual(['fxe5'])
    expect(branchChoices(root, []).map((choice) => choice.ply)).toStrictEqual(['fxe5', 'Qe7'])
    expect(branchChoices(root, [])[0]?.path).toStrictEqual(nextPath(root, []))
  })

  it('walks a whole line one ply at a time and then stops', () => {
    const walked: string[] = []
    let path: readonly string[] = []
    let step = nextPath(resolvePath(root, path).node, path)

    while (step !== null) {
      path = step
      walked.push(path[path.length - 1] ?? '')
      step = nextPath(resolvePath(root, path).node, path)
    }

    expect(walked).toStrictEqual(MAIN_LINE)
  })

  it('has no next on a node whose only child carries no ply, rather than a broken URL', () => {
    const malformed: CompiledNode = {
      kind: 'opponent',
      fen: MAPPED_ENTRY.tree.fen,
      children: [{ kind: 'learner', fen: MAPPED_ENTRY.tree.fen, outcome: { kind: 'unexplored' } }],
    }

    expect(nextPath(malformed, [])).toBeNull()
  })
})

describe('reading a move number off a position', () => {
  it('numbers a White ply by the counter that has not advanced yet', () => {
    expect(
      moveNumberOf('rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3'),
    ).toStrictEqual({ moves: 3, bySide: 'white' })
  })

  it('numbers a Black ply by the counter minus the move it completed', () => {
    expect(
      moveNumberOf('rnbqkbnr/pppp2pp/8/4p3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4'),
    ).toStrictEqual({ moves: 3, bySide: 'black' })
  })

  it('refuses the start position, where no ply has been played', () => {
    expect(moveNumberOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull()
  })

  it.each([
    ['not a fen at all', 'hello'],
    ['a truncated fen', 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b'],
    ['a non-numeric counter', 'rnbqkbnr/8/8/8/8/8/8/RNBQKBNR b KQkq - 0 three'],
    ['an unknown side to move', 'rnbqkbnr/8/8/8/8/8/8/RNBQKBNR x KQkq - 0 3'],
  ])('returns null for %s rather than rendering NaN', (_what, fen) => {
    expect(moveNumberOf(fen)).toBeNull()
  })
})

describe('the label a ply is shown under', () => {
  it('writes a White ply with a full stop', () => {
    const { node } = resolvePath(root, ['fxe5', 'Qh5+'])

    expect(plyLabel('Qh5+', node.fen)).toBe('4.Qh5+')
  })

  it('writes a Black ply with the ellipsis chess notation uses', () => {
    const { node } = resolvePath(root, ['fxe5'])

    expect(plyLabel('fxe5', node.fen)).toBe('3...fxe5')
  })

  it('numbers a whole line the way a scoresheet does', () => {
    const { steps } = resolvePath(root, MAIN_LINE)

    expect(steps.map((step) => plyLabel(step.ply, step.node.fen))).toStrictEqual([
      '3...fxe5',
      '4.Qh5+',
      '4...Ke7',
      '5.Qxe5+',
      '5...Kf7',
      '6.Bc4+',
    ])
  })

  it('falls back to the bare SAN rather than inventing a number', () => {
    expect(plyLabel('Nf3', 'not a fen')).toBe('Nf3')
  })

  it('never localises the notation itself', () => {
    const { steps } = resolvePath(MATE_ENTRY.tree, MATE_LINE)

    expect(steps.map((step) => step.ply)).toStrictEqual(MATE_LINE)
    expect(plyLabel('Nd5#', steps[5]?.node.fen ?? '')).toBe('8.Nd5#')
  })
})

/**
 * The seam #8 left and #9 replaces. Everything ahead of the learner comes through here, so
 * these are the tests that decide what the page is allowed to offer.
 */
describe('the branches ahead', () => {
  it('lists every modelled reply, in the order the author wrote them', () => {
    expect(branchChoices(EVANS_ENTRY.tree, []).map((choice) => choice.ply)).toStrictEqual([
      'Ba5',
      'Bc5',
      'Be7',
      'Bd6',
    ])
  })

  it('gives each one the URL that reaches it, from wherever the learner is standing', () => {
    const { node, path } = resolvePath(EVANS_ENTRY.tree, PLAN_LINE)

    expect(branchChoices(node, path).map((choice) => choice.path)).toStrictEqual([
      ['Ba5', 'd4'],
      ['Ba5', 'O-O'],
    ])
  })

  it('carries the node, so a choice can render its own position and quality', () => {
    const [first] = branchChoices(EVANS_ENTRY.tree, [])

    expect(first?.node.fen).toContain('b3p3')
    expect(first?.node.replyQuality).toBe('best')
    expect(first?.node.frequency).toBe('common')
  })

  it('offers nothing at a leaf', () => {
    const leaf = resolvePath(MAPPED_ENTRY.tree, MAIN_LINE)

    expect(branchChoices(leaf.node, leaf.path)).toStrictEqual([])
  })

  it('drops a child with no ply rather than building a URL that names nothing', () => {
    const malformed: CompiledNode = {
      kind: 'opponent',
      fen: MAPPED_ENTRY.tree.fen,
      children: [
        { kind: 'learner', fen: MAPPED_ENTRY.tree.fen, outcome: { kind: 'unexplored' } },
        {
          ply: 'Qe7',
          kind: 'learner',
          fen: MAPPED_ENTRY.tree.fen,
          outcome: { kind: 'unexplored' },
        },
      ],
    }

    expect(branchChoices(malformed, []).map((choice) => choice.ply)).toStrictEqual(['Qe7'])
  })

  it('offers more than the nine a digit can reach, so tab and click have somewhere to go', () => {
    expect(branchChoices(WIDE_ENTRY.tree, [])).toHaveLength(12)
  })
})

/**
 * **A mate net is never rendered as branch choices** (docs/design-system.md §3, and #9's
 * technical notes). A defender node inside a net can have 24 legal replies, and 24 preview
 * boards on a 360px phone is not a design.
 *
 * In well-formed content this cannot arise: a net lives in its certificate and is not
 * expanded into `children` at all, which the first test here reads off the real compiled
 * fixture rather than off a belief about it. The rest is the guard for content that is
 * *not* well formed, and it is tested by building exactly the node invariant 3 forbids —
 * because a guard that has never met the thing it guards against is a comment.
 */
describe('a proved mate', () => {
  it('reaches the browser as a leaf: its net is in the certificate, not in children', () => {
    const mate = resolvePath(MATE_ENTRY.tree, MATE_LINE)

    expect(mate.node.outcome?.kind).toBe('mate')
    expect(mate.node.children).toBeUndefined()
    expect(branchChoices(mate.node, mate.path)).toStrictEqual([])
  })

  it('is refused its children even when a malformed node carries both', () => {
    const net: CompiledNode = {
      kind: 'opponent',
      fen: MATE_ENTRY.tree.fen,
      outcome: {
        kind: 'mate',
        inMoves: 3,
        sequence: ['Nd5#'],
        provedBy: 'modelled-net',
        basis: {
          basis: 'proved',
          by: 'certificate',
          certificate: 'fixture-legal-trap.Bxd1.mate.json',
        },
      },
      children: DEFENDER_REPLIES.map((ply) => ({
        ply,
        kind: 'learner',
        fen: MATE_ENTRY.tree.fen,
        outcome: { kind: 'unexplored' },
      })),
    }

    // The guard can fail: without it this is 24 choices and therefore 24 preview boards.
    expect(net.children).toHaveLength(24)
    expect(branchChoices(net, [])).toStrictEqual([])
    expect(nextPath(net, [])).toBeNull()
  })

  it('and the same node without the outcome really would offer all 24', () => {
    const withoutOutcome: CompiledNode = {
      kind: 'opponent',
      fen: MATE_ENTRY.tree.fen,
      children: DEFENDER_REPLIES.map((ply) => ({
        ply,
        kind: 'learner',
        fen: MATE_ENTRY.tree.fen,
        outcome: { kind: 'unexplored' },
      })),
    }

    expect(branchChoices(withoutOutcome, [])).toHaveLength(24)
  })
})

describe('a transposition', () => {
  it('is a leaf of its own subtree and offers no choices', () => {
    const transposing: CompiledNode = {
      kind: 'opponent',
      fen: MAPPED_ENTRY.tree.fen,
      transposesTo: ['fxe5', 'Qh5+'],
    }

    expect(branchChoices(transposing, [])).toStrictEqual([])
    expect(nextPath(transposing, [])).toBeNull()
  })
})
