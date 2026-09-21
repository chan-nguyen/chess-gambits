import { Chess } from 'chess.js'
import type { Square } from '../board/board-model.ts'
import { isSquare } from './board-square.ts'

/**
 * The home board's rules engine (#131), reversing #129's "catalogue-only moves" scope
 * decision by product request: any legal move is now offered, not only one some catalogue
 * entry's own line happened to contain.
 *
 * `chess.js` runs here, in `src/components/home/`, and nowhere near
 * `src/components/board/` — `Board` itself still takes nothing but a derived `fen`, a
 * `check` square and background-tint props, exactly as ADR-0003 requires (see its
 * amendment for #131). Every function below is a thin, typed wrapper: chess.js's own
 * `Square` union happens to be the same sixty-four strings as `board-model.ts`'s, but
 * nothing here assumes that without `isSquare` checking it, the same discipline
 * `board-square.ts` already applies to values that cross a different boundary (JSON,
 * there; a library's own type, here).
 *
 * `resolveActivation`, the pure click-selection logic, lives beside this in
 * `board-interaction.ts` rather than here, the same split #129 already drew between "what
 * the engine can tell you" and "what a click should do with the answer".
 */

const PROMOTION_ROLES = ['q', 'r', 'b', 'n'] as const

/**
 * The four pieces a pawn may promote to. Queen is not privileged among them — this
 * catalogue's own content teaches an underpromotion (the Lasker Trap), so a picker that
 * only ever offered a queen would be a real gap, not a minor one.
 */
export type PromotionRole = (typeof PROMOTION_ROLES)[number]

export const promotionRoles: readonly PromotionRole[] = PROMOTION_ROLES

/** One destination a piece on some origin square may move to. */
export type LegalDestination = {
  readonly to: Square
  /** True when reaching this square needs a promotion choice before the move can commit. */
  readonly needsPromotion: boolean
}

/**
 * Every distinct destination square reachable from `from`, for the side to move.
 *
 * chess.js lists one move per promotion choice (four entries for a pawn reaching the back
 * rank), which is exactly one too granular for "is this square a legal destination" — this
 * collapses them back to one entry per square, flagged, so the caller asks about squares
 * the way a click always does.
 */
export const legalDestinationsFrom = (chess: Chess, from: Square): readonly LegalDestination[] => {
  const byDestination = new Map<Square, boolean>()
  for (const move of chess.moves({ square: from, verbose: true })) {
    if (!isSquare(move.to)) continue
    byDestination.set(move.to, byDestination.get(move.to) === true || move.promotion !== undefined)
  }
  return [...byDestination.entries()].map(([to, needsPromotion]) => ({ to, needsPromotion }))
}

/** True when `square` holds a piece with at least one legal move for the side to move. */
export const isSelectable = (chess: Chess, square: Square): boolean =>
  legalDestinationsFrom(chess, square).length > 0

/** The square of the side-to-move's king, when that side is in check; null otherwise. */
export const checkedKingSquare = (chess: Chess): Square | null => {
  if (!chess.isCheck()) return null
  const toMove = chess.turn()
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell !== null && cell.type === 'k' && cell.color === toMove && isSquare(cell.square)) {
        return cell.square
      }
    }
  }
  return null
}

/** How a game that has ended, ended. `null` while play continues. */
export type GameEnd = 'checkmate' | 'stalemate' | 'draw'

export const gameEnd = (chess: Chess): GameEnd | null => {
  if (chess.isCheckmate()) return 'checkmate'
  if (chess.isStalemate()) return 'stalemate'
  if (chess.isDraw()) return 'draw'
  return null
}

/** One played ply, as the board needs it: its SAN and the squares it moved between. */
export type PlayedMove = { readonly san: string; readonly from: Square; readonly to: Square }

export type Replay = {
  readonly chess: Chess
  /**
   * The prefix that actually replayed; shorter than requested if a token was not a legal
   * move here — the same "as far as it makes sense" recovery `line.ts`'s `parseLine` uses
   * for a malformed link.
   */
  readonly plies: readonly string[]
  readonly lastMove: PlayedMove | null
}

/**
 * Replay a decoded `moves` sequence from the start position, stopping at the first token
 * chess.js will not play. Never throws: a URL is attacker-controlled
 * (docs/security.md, B4), and a malformed or truncated value recovers to its longest valid
 * prefix rather than taking the page down.
 */
export const replay = (requested: readonly string[]): Replay => {
  const chess = new Chess()
  const plies: string[] = []
  let lastMove: PlayedMove | null = null

  for (const ply of requested) {
    let move
    try {
      move = chess.move(ply)
    } catch {
      break
    }
    if (!isSquare(move.from) || !isSquare(move.to)) break
    plies.push(move.san)
    lastMove = { san: move.san, from: move.from, to: move.to }
  }

  return { chess, plies, lastMove }
}

/**
 * Commit a move and report its SAN, or `null` if it turns out not to be legal after all —
 * defensive: `resolveActivation` only ever offers moves this same engine already validated.
 */
export const commitMove = (
  chess: Chess,
  from: Square,
  to: Square,
  promotion?: PromotionRole,
): string | null => {
  try {
    const move = promotion === undefined ? { from, to } : { from, to, promotion }
    return chess.move(move).san
  } catch {
    return null
  }
}
