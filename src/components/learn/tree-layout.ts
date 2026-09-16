import type { TranslationKey } from '../../i18n/translations.ts'
import type { CompiledNode } from '../../lib/content-types.ts'

/**
 * The shape of a gambit, worked out as data before anything is drawn.
 *
 * Hand-rolled rather than reached for from a graph library, for the reason the ticket
 * gives: the bundle has about 75KB left for this ticket and four others, and the only
 * thing a layout library would compute here is an indent.
 *
 * The one piece of arithmetic that earns its place is **chain collapsing**. A gambit is
 * mostly forced: node, one child, node, one child, for fifteen plies. Drawn as a plain
 * nested list, each of those plies costs an indent, and a fifteen-ply line is fifteen
 * indents wide before it has branched even once — which does not fit in 360px and is not
 * what the shape of the gambit looks like anyway. So a run of single-child nodes is one
 * **chain**, laid out along a row, and only a real branch point starts a new level.
 * Indentation then measures branching, which is the thing the view exists to show.
 *
 * Pure, free of React and of the DOM, because the ordering it produces is also the order
 * the arrow keys walk (AC 7) and both halves have to agree exactly.
 */

/** Which of the three outcome shapes a leaf carries, or the fourth ending a node can have. */
export type LeafKind = 'mate' | 'assessment' | 'unexplored' | 'transposition'

/** One node, at the place the layout puts it. */
export type TreeItem = {
  readonly node: CompiledNode
  /** The plies from the gambit root — a `line` parameter, and this node's address. */
  readonly path: readonly string[]
  /** `path` joined, so it can key a React list and a focus map. `''` at the root. */
  readonly key: string
  /**
   * The node's true depth in plies, 1-based, for `aria-level`.
   *
   * Deliberately the *tree's* depth and not the drawn indent: collapsing a chain is a
   * decision about where to put a box, and telling a screen-reader user that fifteen
   * forced plies are all at level one would be a decision about what is true.
   */
  readonly level: number
  readonly setSize: number
  readonly posInSet: number
  /** Null when this node has children — that is, when it is not an ending at all. */
  readonly leaf: LeafKind | null
}

/** A run of nodes drawn along one row, and the branches that open at the end of it. */
export type TreeChain = {
  readonly items: readonly TreeItem[]
  readonly branches: readonly TreeChain[]
}

/**
 * §1's two breakpoints, as numbers, because `matchMedia` takes a string and CSS custom
 * properties are not valid in a media condition. `tree-layout.test.ts` reads
 * `GambitTree.css` and fails if these two stop being the lengths that stylesheet uses,
 * so the breakpoint cannot be changed in one of the two places.
 */
export const treeBreakpoints: Readonly<Record<'medium' | 'wide', number>> = {
  medium: 768,
  wide: 1024,
}

export const minWidthQuery = (width: number): string => `(min-width: ${width}px)`

/**
 * How the tree is presented at the current width (§1, AC 3).
 *
 * `full` below the board at full width, `collapsible` as a disclosure, `overlay` as a
 * summary that opens a full-screen dialogue.
 */
export type TreeMode = 'full' | 'collapsible' | 'overlay'

const leafKindOf = (node: CompiledNode): LeafKind | null => {
  // A transposing node is a leaf of its own subtree and carries no outcome
  // (docs/CONTEXT.md, invariant 3), so it is asked about first.
  if (node.transposesTo !== undefined) return 'transposition'

  const { outcome } = node
  if (outcome === undefined) return null

  switch (outcome.kind) {
    case 'mate':
      return 'mate'
    case 'position':
      return 'assessment'
    case 'unexplored':
      return 'unexplored'
  }
}

type Child = { readonly node: CompiledNode; readonly path: readonly string[] }

/**
 * The children a URL can name.
 *
 * A child without a `ply` has no address — there is no `line` that reaches it — and
 * `nextPath` in `tree-path.ts` already declines to navigate to one. Drawing it as a node
 * would draw a box nothing can open, so the two agree instead.
 */
const childrenOf = (node: CompiledNode, path: readonly string[]): readonly Child[] =>
  (node.children ?? []).flatMap((child) =>
    child.ply === undefined ? [] : [{ node: child, path: [...path, child.ply] }],
  )

const onlyChildOf = (node: CompiledNode, path: readonly string[]): Child | undefined => {
  const children = childrenOf(node, path)
  return children.length === 1 ? children[0] : undefined
}

const itemOf = (
  node: CompiledNode,
  path: readonly string[],
  level: number,
  setSize: number,
  posInSet: number,
): TreeItem => ({
  node,
  path,
  key: path.join('_'),
  level,
  setSize,
  posInSet,
  leaf: leafKindOf(node),
})

const chainFrom = (
  node: CompiledNode,
  path: readonly string[],
  level: number,
  setSize: number,
  posInSet: number,
): TreeChain => {
  const items = [itemOf(node, path, level, setSize, posInSet)]
  let current = node
  let currentPath = path
  let currentLevel = level

  // A single child continues the row. Its set is one, because there was no choice here.
  for (
    let only = onlyChildOf(current, currentPath);
    only !== undefined;
    only = onlyChildOf(current, currentPath)
  ) {
    current = only.node
    currentPath = only.path
    currentLevel += 1
    items.push(itemOf(current, currentPath, currentLevel, 1, 1))
  }

  const branches = childrenOf(current, currentPath)

  return {
    items,
    branches: branches.map((child, index) =>
      chainFrom(child.node, child.path, currentLevel + 1, branches.length, index + 1),
    ),
  }
}

/** The whole tree, from the root — the position after the defining line. */
export const layoutTree = (root: CompiledNode): TreeChain => chainFrom(root, [], 1, 1, 1)

/**
 * Every item in the order it is drawn, which is also the order the arrow keys walk. Depth
 * first, because that is what puts a chain's own continuation next to it rather than
 * putting the next branch there.
 */
export const flattenChain = (chain: TreeChain): readonly TreeItem[] => [
  ...chain.items,
  ...chain.branches.flatMap(flattenChain),
]

/** Root-to-leaf paths — *lines*, in this project's vocabulary (docs/CONTEXT.md). */
export const countLines = (chain: TreeChain): number =>
  chain.branches.length === 0
    ? 1
    : chain.branches.reduce((total, branch) => total + countLines(branch), 0)

/**
 * Where an arrow key goes from `index`, or nowhere.
 *
 * The tree view's own movement (AC 7), following the APG tree pattern: down and up walk
 * the drawn order, right goes to the first child, left goes to the parent. Nothing here
 * collapses or expands a node — the whole tree is drawn — so right and left are the
 * pattern's end-node behaviour, which is to move rather than to open.
 *
 * Parent and child are read off `level` rather than off a stored pointer, because the
 * drawn order is depth first: the first child is simply the next item if it is deeper,
 * and the parent is the nearest earlier item one level up.
 */
export const arrowTarget = (
  key: string,
  items: readonly TreeItem[],
  index: number,
): TreeItem | undefined => {
  const current = items[index]
  if (current === undefined) return undefined

  switch (key) {
    case 'ArrowDown':
      return items[index + 1]
    case 'ArrowUp':
      return index === 0 ? undefined : items[index - 1]
    case 'Home':
      return items[0]
    case 'End':
      return items.at(-1)
    case 'ArrowRight': {
      const next = items[index + 1]
      return next !== undefined && next.level > current.level ? next : undefined
    }
    case 'ArrowLeft':
      return items.slice(0, index).findLast((item) => item.level === current.level - 1)
    default:
      return undefined
  }
}

/** The keys the tree answers to, and therefore the keys it takes away from the page. */
export const treeNavigationKeys: ReadonlySet<string> = new Set([
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
])

/**
 * How each ending is marked (AC 6).
 *
 * A symbol **and** a word, never a colour on its own: the symbols are the ones chess
 * notation already uses, so `#` on a leaf reads as mate to anyone who reads SAN, and the
 * word beside it reads as mate to everyone else. `tree-layout.test.ts` holds both halves
 * to being distinct, and shows that check failing on a table where two endings differ
 * only in their colour token.
 */
export type LeafMarker = {
  /** Decorative, and `aria-hidden` where it is drawn: the label is what is spoken. */
  readonly symbol: string
  readonly label: TranslationKey
}

export const leafMarkers: Readonly<Record<LeafKind, LeafMarker>> = {
  mate: { symbol: '#', label: 'tree.mateIn' },
  assessment: { symbol: '=', label: 'tree.assessment' },
  unexplored: { symbol: '?', label: 'tree.unexplored' },
  transposition: { symbol: '→', label: 'tree.transposes' },
}
