import type { Chess } from 'chess.js'
import type { Square } from '../board/board-model.ts'
import { isSelectable, legalDestinationsFrom } from './chess-engine.ts'

/**
 * The home board's move-selection logic, as a pure function over a `chess.js` instance —
 * kept out of the component for the same reason `filter.ts` is kept out of
 * `CatalogueRoute` (issue #131's own "done" checklist asks for unit tests on this
 * specifically, and a pure function is what a test can call without mounting anything).
 *
 * #129 built this same shape over the (now-retired) opening tree; #131 reverses the
 * "catalogue-only moves" scope decision, so the authority for what is legal is now a real
 * `chess.js` position rather than a precomputed trie, but the question a click asks —
 * select, deselect, commit or do nothing — has not changed shape at all.
 */

/** What clicking or activating `square` should do, given what is currently selected. */
export type Activation =
  /** Select this square: it has at least one legal move from it. */
  | { readonly kind: 'select'; readonly square: Square }
  /** Deselect: this is the square already selected. */
  | { readonly kind: 'deselect' }
  /** Commit this move outright: it needs no promotion choice. */
  | { readonly kind: 'commit'; readonly from: Square; readonly to: Square }
  /** Ask which piece to promote to before the move can commit. */
  | { readonly kind: 'promote'; readonly from: Square; readonly to: Square }
  /** Nothing to do: neither a selectable origin nor a destination of the current one. */
  | { readonly kind: 'none' }

export const resolveActivation = (
  chess: Chess,
  selected: Square | null,
  square: Square,
): Activation => {
  if (selected !== null) {
    const destination = legalDestinationsFrom(chess, selected).find(
      (candidate) => candidate.to === square,
    )
    if (destination !== undefined) {
      return destination.needsPromotion
        ? { kind: 'promote', from: selected, to: square }
        : { kind: 'commit', from: selected, to: square }
    }
    if (selected === square) return { kind: 'deselect' }
  }
  return isSelectable(chess, square) ? { kind: 'select', square } : { kind: 'none' }
}
