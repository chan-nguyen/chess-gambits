import type { Square } from '../board/board-model.ts'
import type { OpeningTreeNode } from '../../lib/opening-tree.ts'
import { isSquare } from './board-square.ts'

/**
 * The home board's move-selection logic, as pure functions over the opening tree — kept
 * out of the component for the same reason `filter.ts` is kept out of `CatalogueRoute`
 * (issue #129's own "done" checklist asks for unit tests on this specifically, and a pure
 * function is what a test can call without mounting anything).
 *
 * Every square this module hands back has already been checked against `board-model.ts`'s
 * closed `Square` union (`isSquare`), because everything here starts life as a plain
 * `string` that crossed a JSON boundary (the opening tree payload).
 */

/** Every square a piece could be picked up from at this node, deduplicated. */
export const selectableOrigins = (node: OpeningTreeNode): readonly Square[] => [
  ...new Set(node.children.map((child) => child.from).filter(isSquare)),
]

/** Every square a piece picked up from `origin` could be moved to. */
export const destinationsFrom = (node: OpeningTreeNode, origin: Square): readonly Square[] =>
  node.children
    .filter((child) => child.from === origin)
    .map((child) => child.to)
    .filter(isSquare)

/** The SAN for the move from `from` to `to` at this node, or null if there is none. */
export const childSan = (node: OpeningTreeNode, from: Square, to: Square): string | null => {
  const child = node.children.find((candidate) => candidate.from === from && candidate.to === to)
  return child?.san ?? null
}

/** What clicking or activating `square` should do, given what is currently selected. */
export type Activation =
  /** Select this square: it has at least one legal move from it. */
  | { readonly kind: 'select'; readonly square: Square }
  /** Deselect: this is the square already selected. */
  | { readonly kind: 'deselect' }
  /** Commit this move: `square` is a highlighted destination of the current selection. */
  | { readonly kind: 'commit'; readonly san: string }
  /** Nothing to do: neither a selectable origin nor a destination of the current one. */
  | { readonly kind: 'none' }

export const resolveActivation = (
  node: OpeningTreeNode,
  selected: Square | null,
  square: Square,
): Activation => {
  if (selected !== null) {
    const san = childSan(node, selected, square)
    if (san !== null) return { kind: 'commit', san }
    if (selected === square) return { kind: 'deselect' }
  }
  return selectableOrigins(node).includes(square) ? { kind: 'select', square } : { kind: 'none' }
}
