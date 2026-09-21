import { describe, expect, it } from 'vitest'
import type { OpeningTreeNode } from '../../lib/opening-tree.ts'
import {
  childSan,
  destinationsFrom,
  resolveActivation,
  selectableOrigins,
} from './board-interaction.ts'

/**
 * The home page's move-selection logic (issue #129's own "done" checklist), tested as pure
 * functions over a small hand-built tree rather than a mounted component.
 */

const leaf = (fen: string): OpeningTreeNode => ({ fen, check: null, children: [] })

const NODE: OpeningTreeNode = {
  fen: 'start',
  check: null,
  children: [
    { san: 'e4', from: 'e2', to: 'e4', node: leaf('after-e4') },
    { san: 'd4', from: 'd2', to: 'd4', node: leaf('after-d4') },
    // Two different pieces this test never expects to collide: a second move from e2
    // (a bishop fianchetto is not legal from the start, but nothing here depends on real
    // legality — the opening tree is the authority, not a rules check).
    { san: 'e3', from: 'e2', to: 'e3', node: leaf('after-e3') },
  ],
}

describe('selectableOrigins', () => {
  it('lists every distinct square a child move starts from', () => {
    expect(selectableOrigins(NODE).slice().sort()).toStrictEqual(['d2', 'e2'])
  })

  it('is empty at a leaf', () => {
    expect(selectableOrigins(leaf('x'))).toStrictEqual([])
  })

  it('drops a from/to that is not a real square rather than throwing', () => {
    const malformed: OpeningTreeNode = {
      fen: 'x',
      check: null,
      children: [{ san: 'e4', from: 'nope', to: 'e4', node: leaf('y') }],
    }
    expect(selectableOrigins(malformed)).toStrictEqual([])
  })
})

describe('destinationsFrom', () => {
  it('lists every destination for pieces starting on that square', () => {
    expect(destinationsFrom(NODE, 'e2').slice().sort()).toStrictEqual(['e3', 'e4'])
  })

  it('is empty for a square with no outgoing child', () => {
    expect(destinationsFrom(NODE, 'a1')).toStrictEqual([])
  })
})

describe('childSan', () => {
  it('finds the move for a real from/to pair', () => {
    expect(childSan(NODE, 'e2', 'e4')).toBe('e4')
    expect(childSan(NODE, 'e2', 'e3')).toBe('e3')
  })

  it('is null for a pair with no child', () => {
    expect(childSan(NODE, 'e2', 'e5')).toBeNull()
    expect(childSan(NODE, 'a1', 'a2')).toBeNull()
  })
})

describe('resolveActivation', () => {
  it('selects a square with at least one legal move, when nothing is selected', () => {
    expect(resolveActivation(NODE, null, 'e2')).toStrictEqual({ kind: 'select', square: 'e2' })
  })

  it('does nothing for a square with no legal move, when nothing is selected', () => {
    expect(resolveActivation(NODE, null, 'a1')).toStrictEqual({ kind: 'none' })
  })

  it('commits the move when the activated square is a destination of the selection', () => {
    expect(resolveActivation(NODE, 'e2', 'e4')).toStrictEqual({ kind: 'commit', san: 'e4' })
  })

  it('deselects when the activated square is the one already selected', () => {
    expect(resolveActivation(NODE, 'e2', 'e2')).toStrictEqual({ kind: 'deselect' })
  })

  it('switches selection to a different selectable origin, while one is already selected', () => {
    expect(resolveActivation(NODE, 'e2', 'd2')).toStrictEqual({ kind: 'select', square: 'd2' })
  })

  it('does nothing for a square that is neither a destination nor a selectable origin', () => {
    expect(resolveActivation(NODE, 'e2', 'a1')).toStrictEqual({ kind: 'none' })
  })
})
