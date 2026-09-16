import { describe, expect, it } from 'vitest'
import designSystem from '../../../docs/design-system.md?raw'
import type { CompiledNode } from '../../lib/content-types.ts'
import treeCss from './GambitTree.css?raw'
import { BRANCHING_ENTRY, BRANCHING_ORDER } from './tree-fixtures.ts'
import {
  arrowTarget,
  countLines,
  flattenChain,
  layoutTree,
  leafMarkers,
  minWidthQuery,
  treeBreakpoints,
} from './tree-layout.ts'

const CHAIN = layoutTree(BRANCHING_ENTRY.tree)
const ITEMS = flattenChain(CHAIN)
const keyed = (key: string) => ITEMS.find((item) => item.key === key)

describe('chains', () => {
  /**
   * The reason the arithmetic exists at all. A gambit is mostly forced, and a nested list
   * that indents once per ply is a fifteen-indent picture of a line that never branched.
   */
  it('draws a run of forced plies along one row, and indents only at a branch point', () => {
    expect(CHAIN.items.map((item) => item.key)).toStrictEqual([''])
    expect(CHAIN.branches.map((branch) => branch.items.map((item) => item.key))).toStrictEqual([
      ['Bxd1'],
      ['Nxe5', 'Nxe5_Qxh5'],
    ])
  })

  it('keeps aria-level on the real depth in plies, not on the drawn indent', () => {
    expect(ITEMS.map((item) => item.level)).toStrictEqual([1, 2, 2, 3, 4, 4])
  })

  it('numbers each node within its own set of siblings', () => {
    expect(keyed('Bxd1')).toMatchObject({ setSize: 2, posInSet: 1 })
    expect(keyed('Nxe5')).toMatchObject({ setSize: 2, posInSet: 2 })
    // Inside a chain there was no choice to make, so the set is one.
    expect(keyed('Nxe5_Qxh5')).toMatchObject({ setSize: 1, posInSet: 1 })
    expect(keyed('Nxe5_Qxh5_Ng6')).toMatchObject({ setSize: 2, posInSet: 2 })
  })

  it('walks depth first, so a chain continues before the next branch starts', () => {
    expect(ITEMS.map((item) => item.key)).toStrictEqual(BRANCHING_ORDER)
  })

  it('counts root-to-leaf lines rather than nodes', () => {
    expect(countLines(CHAIN)).toBe(3)
    expect(ITEMS).toHaveLength(6)
  })

  /**
   * `nextPath` in `tree-path.ts` declines to navigate to a child with no `ply`, because
   * there is no `line` that names one. Drawing it would draw a box nothing opens, so the
   * two agree. Only the root is legitimately without a ply.
   */
  it('leaves out a child no URL can name', () => {
    const tree: CompiledNode = {
      kind: 'opponent',
      fen: BRANCHING_ENTRY.tree.fen,
      children: [{ kind: 'learner', fen: BRANCHING_ENTRY.tree.fen }],
    }

    expect(flattenChain(layoutTree(tree)).map((item) => item.key)).toStrictEqual([''])
  })
})

describe('endings', () => {
  it('names the three outcome shapes apart', () => {
    expect(keyed('Bxd1')?.leaf).toBe('mate')
    expect(keyed('Nxe5_Qxh5_Nxc4')?.leaf).toBe('assessment')
    expect(keyed('Nxe5_Qxh5_Ng6')?.leaf).toBe('unexplored')
  })

  it('is not an ending where a node has children', () => {
    expect(keyed('')?.leaf).toBeNull()
    expect(keyed('Nxe5')?.leaf).toBeNull()
  })

  /**
   * A transposing node is a leaf of its own subtree and carries no outcome
   * (docs/CONTEXT.md, invariant 3), so "no outcome" cannot mean "not an ending".
   */
  it('marks a transposing node, which has no outcome to read', () => {
    const tree: CompiledNode = {
      kind: 'opponent',
      fen: BRANCHING_ENTRY.tree.fen,
      children: [
        {
          ply: 'Bg6',
          kind: 'learner',
          fen: BRANCHING_ENTRY.tree.fen,
          transposesTo: ['Nxe5', 'Qxh5'],
        },
      ],
    }

    expect(flattenChain(layoutTree(tree)).map((item) => item.leaf)).toStrictEqual([
      null,
      'transposition',
    ])
  })
})

describe('arrow keys', () => {
  const at = (key: string): number => ITEMS.findIndex((item) => item.key === key)
  const from = (key: string, press: string): string | undefined =>
    arrowTarget(press, ITEMS, at(key))?.key

  it('walks the drawn order with up and down', () => {
    expect(from('Bxd1', 'ArrowDown')).toBe('Nxe5')
    expect(from('Nxe5', 'ArrowUp')).toBe('Bxd1')
  })

  it('stops at the ends rather than wrapping', () => {
    expect(from('', 'ArrowUp')).toBeUndefined()
    expect(from('Nxe5_Qxh5_Ng6', 'ArrowDown')).toBeUndefined()
  })

  it('goes to the first child on right, and nowhere from a leaf', () => {
    expect(from('Nxe5_Qxh5', 'ArrowRight')).toBe('Nxe5_Qxh5_Nxc4')
    expect(from('Nxe5_Qxh5_Nxc4', 'ArrowRight')).toBeUndefined()
  })

  it('goes to the parent on left, across a chain and across a branch', () => {
    expect(from('Nxe5_Qxh5_Ng6', 'ArrowLeft')).toBe('Nxe5_Qxh5')
    expect(from('Nxe5_Qxh5', 'ArrowLeft')).toBe('Nxe5')
    expect(from('Bxd1', 'ArrowLeft')).toBe('')
    expect(from('', 'ArrowLeft')).toBeUndefined()
  })

  it('jumps to the ends with Home and End', () => {
    expect(from('Nxe5_Qxh5', 'Home')).toBe('')
    expect(from('Nxe5_Qxh5', 'End')).toBe('Nxe5_Qxh5_Ng6')
  })

  it('answers nothing for a key it does not own, and for an index off the end', () => {
    expect(from('Nxe5', 'a')).toBeUndefined()
    expect(arrowTarget('ArrowDown', ITEMS, ITEMS.length)).toBeUndefined()
  })
})

describe('the breakpoints', () => {
  /**
   * `matchMedia` takes a string and a CSS custom property is not valid in a media
   * condition, so §1's two breakpoints are spelled out twice — once in `GambitTree.css`
   * and once as numbers the component can ask about. This is what stops the two drifting:
   * both are held to the design system, which is the document that says there are only two.
   */
  const documented = [
    ...(/\*\*Breakpoints\*\* are[^.]*/.exec(designSystem)?.[0] ?? '').matchAll(/(\d+)px/g),
  ].map((found) => Number(found[1]))

  it('are the two the design system documents, and no others', () => {
    expect(documented).toStrictEqual([768, 1024])
    expect([treeBreakpoints.medium, treeBreakpoints.wide]).toStrictEqual(documented)
  })

  it('build a query a browser would answer', () => {
    expect(minWidthQuery(treeBreakpoints.wide)).toBe('(min-width: 1024px)')
  })
})

/**
 * AC 6, as a gate rather than as an intention: no two endings may be told apart by their
 * colour alone. Each has to differ in its symbol, in its word, or in the shape its rule
 * draws — and the check below is shown failing on a table where two of them do not.
 */
describe('endings are told apart without colour', () => {
  type Marker = { readonly symbol: string; readonly label: string }
  type Named = readonly [string, Marker]

  const COLOUR_PROPERTIES: ReadonlySet<string> = new Set([
    'color',
    'background-color',
    'border-color',
    'accent-color',
    'outline-color',
  ])

  /** Everything a rule declares that is not a colour, normalised so two can be compared. */
  const shapeOf = (css: string, kind: string): readonly string[] => {
    const selector = `.gambit-tree__marker--${kind}`
    const start = css.indexOf(`${selector} {`)
    if (start === -1) throw new Error(`no rule for ${selector}`)

    const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))

    return body
      .split(';')
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration !== '')
      .filter(
        (declaration) =>
          !COLOUR_PROPERTIES.has(declaration.slice(0, declaration.indexOf(':')).trim()),
      )
      .sort()
  }

  const pairsOf = (
    markers: Readonly<Record<string, Marker>>,
  ): readonly (readonly [Named, Named])[] => {
    const entries: readonly Named[] = Object.entries(markers)
    return entries.flatMap((one, index) =>
      entries.slice(index + 1).map((other): readonly [Named, Named] => [one, other]),
    )
  }

  const colourOnly = (markers: Readonly<Record<string, Marker>>, css: string): readonly string[] =>
    pairsOf(markers).flatMap(([[oneName, one], [otherName, other]]) =>
      one.symbol !== other.symbol ||
      one.label !== other.label ||
      shapeOf(css, oneName).join(';') !== shapeOf(css, otherName).join(';')
        ? []
        : [`${oneName} and ${otherName} differ only in colour`],
    )

  it('finds none in the shipped markers', () => {
    expect(colourOnly(leafMarkers, treeCss)).toStrictEqual([])
  })

  it('gives every ending a symbol and a word of its own', () => {
    const markers = Object.values(leafMarkers)

    expect(new Set(markers.map((marker) => marker.symbol)).size).toBe(markers.length)
    expect(new Set(markers.map((marker) => marker.label)).size).toBe(markers.length)
  })

  /** The probe. A gate nobody has seen fail is a comment. */
  it('reports two endings whose rules differ only in their colour', () => {
    const markers = {
      one: { symbol: '#', label: 'tree.mateIn' },
      other: { symbol: '#', label: 'tree.mateIn' },
    }
    const css = [
      '.gambit-tree__marker--one { border-radius: var(--radius-sm); color: var(--color-mate); }',
      '.gambit-tree__marker--other { border-radius: var(--radius-sm); color: var(--color-worse); }',
    ].join('\n')

    expect(colourOnly(markers, css)).toStrictEqual(['one and other differ only in colour'])
  })

  it('accepts the same two once one of them changes shape', () => {
    const markers = {
      one: { symbol: '#', label: 'tree.mateIn' },
      other: { symbol: '#', label: 'tree.mateIn' },
    }
    const css = [
      '.gambit-tree__marker--one { border-radius: var(--radius-sm); color: var(--color-mate); }',
      '.gambit-tree__marker--other { border-style: dashed; color: var(--color-worse); }',
    ].join('\n')

    expect(colourOnly(markers, css)).toStrictEqual([])
  })
})
