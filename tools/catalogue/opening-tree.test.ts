import { Chess } from 'chess.js'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkOpeningTreeBudget, measureOpeningTree, OPENING_TREE_BUDGET_BYTES } from './budget.ts'
import { build } from './build.ts'
import { buildOpeningTree, type OpeningTreeNode } from './opening-tree.ts'

/**
 * The opening tree, checked against real play and against the catalogue this repository
 * actually ships — the same convention `catalogue.test.ts` sets for the payload it builds.
 */

const DATASET = join('tools', 'catalogue', 'dataset')
const SOURCE = join('tools', 'catalogue', 'source')

const real = build({ datasetDir: DATASET, sourceDir: SOURCE, contentDir: 'content' })
if (!real.ok) {
  throw new Error(real.issues.map((issue) => `${issue.where}: ${issue.message}`).join('\n'))
}
const catalogue = real.value

const walk = (tree: OpeningTreeNode, plies: readonly string[]): OpeningTreeNode =>
  plies.reduce<OpeningTreeNode>((node, ply) => {
    const child = node.children.find((candidate) => candidate.san === ply)
    if (child === undefined) throw new Error(`no child \`${ply}\` under this node`)
    return child.node
  }, tree)

describe('buildOpeningTree — correctness against real play', () => {
  it('the root is the standard starting position, with nothing in check', () => {
    const tree = buildOpeningTree([['e4', 'e5']])
    expect(tree.fen).toBe(new Chess().fen())
    expect(tree.check).toBeNull()
  })

  it('one line produces a straight chain, each node the FEN chess.js gives for it', () => {
    const line = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4']
    const tree = buildOpeningTree([line])

    const chess = new Chess()
    let node = tree
    for (const san of line) {
      chess.move(san)
      node = walk(node, [san])
      expect(node.fen).toBe(chess.fen())
    }
  })

  it('records from/to squares matching chess.js for the same move', () => {
    const tree = buildOpeningTree([['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'Bxf7']])
    const capture = walk(tree, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']).children.find(
      (child) => child.san === 'Bxf7+',
    )
    expect(capture).toMatchObject({ san: 'Bxf7+', from: 'c4', to: 'f7' })
  })

  it('names the checked king when the position is check, and only then', () => {
    // Scholar's mate: Qxf7# leaves the black king on e8 in (check)mate.
    const tree = buildOpeningTree([['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7']])
    const node = walk(tree, ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])
    expect(node.check).toBe('e8')

    expect(tree.check).toBeNull()
  })

  it('merges a shared prefix into one path rather than duplicating it', () => {
    const tree = buildOpeningTree([
      ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    ])
    expect(tree.children).toHaveLength(1)
    const afterE4 = tree.children[0]
    if (afterE4 === undefined) throw new Error('expected a child')
    expect(afterE4.san).toBe('e4')

    const afterNc6 = walk(tree, ['e4', 'e5', 'Nf3', 'Nc6'])
    expect(afterNc6.children.map((child) => child.san).sort()).toStrictEqual(['Bb5', 'Bc4'])
  })

  it('a line that cannot be replayed contributes nothing rather than throwing', () => {
    expect(() => buildOpeningTree([['e4', 'not-a-move']])).not.toThrow()
    const tree = buildOpeningTree([['e4', 'not-a-move']])
    expect(tree.children.map((child) => child.san)).toStrictEqual(['e4'])
    expect(walk(tree, ['e4']).children).toStrictEqual([])
  })

  it('children are sorted by SAN, so the emitted JSON is stable across runs', () => {
    const tree = buildOpeningTree([['e4'], ['d4'], ['c4'], ['Nf3']])
    expect(tree.children.map((child) => child.san)).toStrictEqual(['Nf3', 'c4', 'd4', 'e4'])
  })
})

describe('the real catalogue this repository ships', () => {
  const tree = buildOpeningTree(catalogue.records.map((record) => record.definingLine))

  it('walking every published defining line lands on a real node with the right FEN', () => {
    for (const record of catalogue.records) {
      const chess = new Chess()
      for (const san of record.definingLine) chess.move(san)

      const node = walk(tree, record.definingLine)
      expect(node.fen).toBe(chess.fen())
    }
  })

  it('every node the build actually emits agrees with this test’s own build', () => {
    expect(catalogue.openingTree).toStrictEqual(tree)
  })

  it('a node with no children is exactly a full defining line, never a dead end mid-line', () => {
    const lines = new Set(catalogue.records.map((record) => record.definingLine.join(' ')))

    const leaves: string[] = []
    const visit = (node: OpeningTreeNode, path: readonly string[]): void => {
      if (node.children.length === 0) leaves.push(path.join(' '))
      for (const child of node.children) visit(child.node, [...path, child.san])
    }
    visit(tree, [])

    // Multiple entries may share one leaf (identical defining lines), so every leaf is a
    // real line, but not every line need be a leaf (a shorter line can be a prefix of a
    // longer sibling's).
    for (const leaf of leaves) expect(lines.has(leaf)).toBe(true)
  })

  it('stays under the opening-tree payload budget (payload budget test)', () => {
    const json = JSON.stringify(tree)
    const size = measureOpeningTree(json)
    expect(checkOpeningTreeBudget(size)).toStrictEqual([])
    expect(size.gzippedBytes).toBeLessThan(OPENING_TREE_BUDGET_BYTES)
  })

  it('the budget check actually fires on an oversized payload', () => {
    // Random digits, not a repeated character: gzip compresses a run of one byte to almost
    // nothing, which would make this probe pass by accident rather than by measurement.
    const random = Array.from({ length: OPENING_TREE_BUDGET_BYTES * 4 }, () =>
      Math.floor(Math.random() * 10),
    ).join('')
    const oversized = measureOpeningTree(random)
    expect(checkOpeningTreeBudget(oversized)).not.toStrictEqual([])
  })
})
