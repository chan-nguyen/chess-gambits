import { describe, expect, it } from 'vitest'
import type { CompiledNode } from '../../lib/content-types.ts'
import { MAIN_LINE, MAPPED_ENTRY, MATE_ENTRY, MATE_LINE } from './learn-fixtures.ts'
import { moveNumberOf, nextPath, plyLabel, previousPath, resolvePath } from './tree-path.ts'

const root = MAPPED_ENTRY.tree

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

  it('takes the first child at a branch point, which is the seam #9 replaces', () => {
    expect(root.children).toHaveLength(2)
    expect(nextPath(root, [])).toStrictEqual(['fxe5'])
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
