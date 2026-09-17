import { FILES, RANKS, colourOf, parseFen, squareAt } from '../board/board-model.ts'
import type { PieceKey, Square } from '../board/board-model.ts'

/**
 * Which pieces a ply moved, and which piece it took, read off the two positions it sits
 * between.
 *
 * This is `last-ply.ts` asked a wider question. That module answers "which two squares does
 * the highlight mark", which is one pair and, at a castle, deliberately the king's — the
 * convention every chess interface uses for *naming* the move. An animation cannot use that
 * answer: a castle moves two pieces and a learner watching only the king slide sees a move
 * the position did not make. So this reads the whole diff instead, and `last-ply.ts` keeps
 * its narrower one rather than being widened underneath the highlight that depends on it.
 *
 * It lives here for the reason `last-ply.ts` gives at length and does not repeat: the pair
 * is **derived at the point of use** rather than shipped on the wire, where it could drift
 * out of sync with the positions beside it and nothing would notice; and it lives under
 * `learn/` rather than under `board/` because ADR-0003 bounds the board to a renderer that
 * does not know chess, and `board-tripwire.test.ts` measures that directory to enforce it.
 *
 * **This is not rules logic.** There is no move generation, no legality test and no check
 * detection. Two positions one legal ply apart determine which pieces changed square, and
 * this reads that back by comparing two maps.
 */

const ALL_SQUARES: readonly Square[] = RANKS.flatMap((rank) =>
  FILES.map((file) => squareAt(file, rank)),
)

/** A piece that was on a square in the first position and is not on it in the second. */
type Departure = { readonly square: Square; readonly piece: PieceKey }

export type PlyMotion = {
  /**
   * For each square a piece arrived on, the square it came from. Keyed by destination
   * because that is the square the board draws the piece on: the answer it needs is "where
   * did the piece I am about to draw come from", not the other way round.
   */
  readonly arrivedFrom: ReadonlyMap<Square, Square>
  /**
   * The pieces the ply removed, still at the squares they stood on. A capture leaves one;
   * an *en passant* capture leaves one on a square neither of the mover's two squares is.
   */
  readonly captured: ReadonlyMap<Square, PieceKey>
}

const NOTHING: PlyMotion = { arrivedFrom: new Map(), captured: new Map() }

/**
 * The first departure that fits and has not already been spoken for, marked as taken.
 *
 * Pairing is by piece first and by colour second, and the order is what makes promotion
 * fall out rather than need a branch: a queen that arrives where no queen left is a pawn
 * that changed shape on the way, and the only unclaimed departure of its colour is that
 * pawn. Everything else pairs exactly — a capture leaves the taken piece unclaimed, an
 * *en passant* capture leaves it unclaimed on a third square, and castling pairs king with
 * king and rook with rook because each is asked for by name.
 */
const claim = (
  departures: readonly Departure[],
  taken: Set<number>,
  fits: (departure: Departure) => boolean,
): Departure | undefined => {
  const index = departures.findIndex((departure, at) => !taken.has(at) && fits(departure))
  const found = departures[index]
  if (found === undefined) return undefined
  taken.add(index)
  return found
}

/**
 * What moved between two adjacent positions.
 *
 * Empty rather than a guess when the input is not two positions a ply apart — a malformed
 * FEN, or the same position twice. An empty motion draws the position and animates nothing,
 * which is the recoverable failure `docs/design-system.md` §4 asks for: a board that does
 * not slide, rather than a piece sliding in from a square nothing was on.
 *
 * It is **not** given the two positions the screen went between, which for a jump down the
 * move list or across to another branch would be many plies apart and would pair arrivals
 * with departures that have nothing to do with each other. It is given the one ply that
 * produced the position, exactly as `lastMove` is, and `Board` animates only what that ply
 * accounts for.
 */
export const plyMotionBetween = (before: string, after: string): PlyMotion => {
  const start = parseFen(before)
  const end = parseFen(after)
  // `parseFen` answers an empty board for a FEN it cannot read; a real position has kings.
  if (start.size === 0 || end.size === 0) return NOTHING

  const departures: Departure[] = []
  const arrivals: Departure[] = []
  for (const square of ALL_SQUARES) {
    const was = start.get(square)
    const now = end.get(square)
    if (was === now) continue
    if (was !== undefined) departures.push({ square, piece: was })
    if (now !== undefined) arrivals.push({ square, piece: now })
  }

  const taken = new Set<number>()
  const arrivedFrom = new Map<Square, Square>()
  for (const arrival of arrivals) {
    const origin =
      claim(departures, taken, (departure) => departure.piece === arrival.piece) ??
      claim(departures, taken, (departure) => colourOf(departure.piece) === colourOf(arrival.piece))
    if (origin !== undefined) arrivedFrom.set(arrival.square, origin.square)
  }

  const captured = new Map<Square, PieceKey>()
  for (const [index, departure] of departures.entries()) {
    if (!taken.has(index)) captured.set(departure.square, departure.piece)
  }

  return { arrivedFrom, captured }
}
