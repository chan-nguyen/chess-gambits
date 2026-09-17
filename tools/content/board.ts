import { Chess } from 'chess.js'
import type { Side } from './types.ts'

/**
 * `chess.js` as a rules engine and nothing else: legality, SAN canonicalisation, checkmate
 * and stalemate. It is never used to parse a PGN tree — verified by experiment, its
 * `loadPgn()` silently discards variations (ADR-0004).
 *
 * Build-time only. Nothing here ships to the browser.
 */

export type Position = {
  readonly fen: string
  /**
   * The first four FEN fields, which is what transposition comparison uses (invariant 12):
   * piece placement, side to move, castling rights and the en-passant square. The halfmove
   * clock and fullmove number are dropped because they differ between transposed paths, so
   * full-FEN equality would miss real transpositions.
   *
   * Measured, because `docs/CONTEXT.md` invariant 12 and ADR-0004 check 9 both record the
   * opposite: `chess.js` 1.4.0 writes the en-passant square **only when an en-passant
   * capture is actually available** (after 1.e4 the field is `-`, not `e3`). Keeping field
   * four is therefore safe rather than noisy — but two positions that differ only by a live
   * en-passant right are correctly treated as different.
   */
  readonly key: string
  readonly turn: Side
  readonly legalMoves: readonly string[]
  /**
   * The side to move is in check. Distinct from `isCheckmate`, and needed separately: a
   * leaf may not stop here either, because every legal reply is answering a check rather
   * than following a plan (docs/CONTEXT.md, invariant 14).
   */
  readonly isCheck: boolean
  readonly isCheckmate: boolean
  readonly isStalemate: boolean
}

export type PlyResult =
  | { readonly ok: true; readonly canonical: string; readonly position: Position }
  | { readonly ok: false; readonly suggestions: readonly string[] }

/** The first four FEN fields. See `Position.key`. */
export const positionKey = (fen: string): string => fen.split(' ').slice(0, 4).join(' ')

const describe = (chess: Chess): Position => ({
  fen: chess.fen(),
  key: positionKey(chess.fen()),
  turn: chess.turn() === 'w' ? 'white' : 'black',
  legalMoves: chess.moves(),
  isCheck: chess.isCheck(),
  isCheckmate: chess.isCheckmate(),
  isStalemate: chess.isStalemate(),
})

export const startPosition = (): Position => describe(new Chess())

/** Destination square of a SAN move, used to suggest what the author probably meant. */
const destinationOf = (san: string): string | undefined =>
  /([a-h][1-8])(?:=[QRBN])?[+#]?$/.exec(san)?.[1]

/** The moving piece's letter, or the empty string for a pawn move. */
const pieceOf = (san: string): string => (/^[KQRBN]/.test(san) ? san.slice(0, 1) : '')

/**
 * Play one SAN move. `canonical` is what `chess.js` re-serialises the move as, which is
 * how ADR-0004 check 3 catches `Nf3` where `Ngf3` was required, `e2e4` written as
 * long algebraic, and a missing `+` or `#`.
 */
export const applyPly = (from: Position, san: string): PlyResult => {
  const chess = new Chess(from.fen)
  try {
    const move = chess.move(san)
    return { ok: true, canonical: move.san, position: describe(chess) }
  } catch {
    // Same piece to the same square: that is the disambiguation the author left out.
    // Matching on the square alone would offer a pawn move as a fix for a knight move.
    const destination = destinationOf(san)
    const piece = pieceOf(san)
    const suggestions =
      destination === undefined
        ? []
        : from.legalMoves.filter(
            (legal) => destinationOf(legal) === destination && pieceOf(legal) === piece,
          )
    return { ok: false, suggestions }
  }
}

/** Replay a sequence of plies from the standard start position (invariant 1). */
export type ReplayResult =
  | {
      readonly ok: true
      readonly position: Position
      readonly canonical: readonly string[]
      /**
       * Every position the replay passed through, start included, so `positions` is one
       * longer than `canonical` and `positions[i]` is the position after `i` plies.
       *
       * Kept here rather than re-derived by a caller that wants the intermediate boards.
       * A second replay is a second chance to replay something slightly different, and the
       * prelude of a gambit page (#70) draws those boards: a board derived by a different
       * walk from the one that validated the line is exactly the drift invariant 1 exists
       * to prevent.
       */
      readonly positions: readonly Position[]
    }
  | { readonly ok: false; readonly index: number; readonly suggestions: readonly string[] }

export const replay = (plies: readonly string[]): ReplayResult => {
  const canonical: string[] = []
  let position = startPosition()
  const positions: Position[] = [position]
  for (const [index, ply] of plies.entries()) {
    const result = applyPly(position, ply)
    if (!result.ok) return { ok: false, index, suggestions: result.suggestions }
    canonical.push(result.canonical)
    position = result.position
    positions.push(position)
  }
  return { ok: true, position, canonical, positions }
}
