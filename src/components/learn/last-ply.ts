import { FILES, RANKS, colourOf, parseFen, roleOf, squareAt } from '../board/board-model.ts'
import type { PieceColour, Position, Square } from '../board/board-model.ts'
import type { LastMove } from '../board/Board.tsx'

/**
 * Which two squares a ply used, read off the two positions it sits between.
 *
 * `Board` draws a last-played-move highlight from a `{ from, to }` pair and nothing on the
 * wire carries one: a `CompiledNode` has the ply in SAN and the position it reached, and
 * SAN names a destination but not an origin. Something has to supply the pair, and there
 * were two places it could come from — the build, which replays every ply through a real
 * rules engine and knows the answer exactly, or here, from the two FENs either side.
 *
 * **Here, and for the reason `tools/content/derived-fields.ts` already gives about FENs:**
 * "a stored FEN is one more thing that can silently drift out of sync with the moves beside
 * it". A stored origin square is one more thing that can drift out of sync with the two
 * positions beside it, and unlike a FEN it would be invisible when it did — a highlight on
 * the wrong square is not a claim anything validates. Derived at the point of use it cannot
 * drift, it adds nothing to a payload the learner downloads, and `last-ply.test.ts` holds it
 * against `chess.js` over every move of several thousand games rather than trusting it.
 *
 * This is **not** rules logic and does not reopen ADR-0003. There is no move generation, no
 * legality test and no check detection; two positions one legal ply apart determine the ply
 * that separates them, and this reads it back. It lives under `learn/` rather than under
 * `board/` deliberately: ADR-0003 bounds the board to a renderer that does not know chess,
 * and `board-tripwire.test.ts` enforces that by measuring what is in that directory.
 */

const ALL_SQUARES: readonly Square[] = RANKS.flatMap((rank) =>
  FILES.map((file) => squareAt(file, rank)),
)

/** Whose ply it was: the side to move in the position *before* it. */
const moverOf = (fen: string): PieceColour | undefined => {
  const field = fen.split(' ')[1]
  if (field === 'w') return 'white'
  if (field === 'b') return 'black'
  return undefined
}

const kingAmong = (squares: readonly Square[], position: Position): Square | undefined =>
  squares.find((square) => {
    const piece = position.get(square)
    return piece !== undefined && roleOf(piece) === 'king'
  })

const pair = (origin: Square | undefined, destination: Square | undefined): LastMove | undefined =>
  origin === undefined || destination === undefined ? undefined : { from: origin, to: destination }

/**
 * The ply between two adjacent positions, or undefined when there is not exactly one.
 *
 * Only the mover's own pieces are compared, which is what makes the awkward moves fall out
 * rather than need handling. A capture leaves the opponent's piece off the board and the
 * mover still shows one square left and one reached; an *en passant* capture takes a pawn
 * from a third square, which is the opponent's and therefore not counted; a promotion
 * arrives as a different piece from the one that left, and neither side of the comparison
 * asks what kind of piece it is.
 *
 * Castling is the one move that shifts two of the mover's pieces at once, so it is the one
 * case with a branch. The convention every chess interface uses is that the move is the
 * king's, so the king's two squares are what the highlight names.
 *
 * Undefined rather than a guess when the input is not two positions a single ply apart:
 * a malformed FEN, the same position twice, or anything else. `Board` treats an absent
 * `lastMove` as "nothing to highlight", so the failure is a board without a highlight
 * rather than a highlight on the wrong square — recovery over erroring
 * (docs/design-system.md §4).
 */
export const lastPlyBetween = (before: string, after: string): LastMove | undefined => {
  const mover = moverOf(before)
  if (mover === undefined) return undefined

  const start = parseFen(before)
  const end = parseFen(after)
  // `parseFen` answers an empty board for a FEN it cannot read; a real position has kings.
  if (start.size === 0 || end.size === 0) return undefined

  const left: Square[] = []
  const reached: Square[] = []
  for (const square of ALL_SQUARES) {
    const was = start.get(square)
    const now = end.get(square)
    if (was === now) continue
    if (was !== undefined && colourOf(was) === mover) left.push(square)
    if (now !== undefined && colourOf(now) === mover) reached.push(square)
  }

  if (left.length === 1 && reached.length === 1) return pair(left[0], reached[0])
  if (left.length === 2 && reached.length === 2) {
    return pair(kingAmong(left, start), kingAmong(reached, end))
  }
  return undefined
}
