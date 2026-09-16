import { Chess } from 'chess.js'
import type { Side } from './types.ts'

/**
 * Proving, on a board, that a named ply gives material away — and reading the side off it.
 *
 * Issue #12 excluded 347 gambit-named rows because `side` could not be derived, and three
 * heuristics were tried before that conclusion. Every one of them failed on the same
 * shape: a line containing **two** offers. The King's Gambit Declined holds White's 2.f4
 * and Black's 2...d5, the Halloween holds 4.Nxe5 and nothing before it, and any rule of
 * the form "the first sacrifice wins" labels every Falkbeer row `white`.
 *
 * So this module does not look for the sacrifice. A person names the ply and this proves
 * it: the position after that ply has to leave the mover materially worse off. That splits
 * the work where it actually splits — the choice is a judgement, the consequence is a
 * fact — and it is why `side` is derived here and never written in `classification.yaml`.
 *
 * Build-time only.
 */

const VALUES: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

const valueOf = (piece: string): number => VALUES[piece] ?? 0

/**
 * Static exchange evaluation on one square: both sides recapture with their least valuable
 * piece and either may stop, which is what makes the result the value actually winnable
 * rather than the value of playing every capture to the end.
 */
const exchangeOn = (board: Chess, square: string): number => {
  const captures = board
    .moves({ verbose: true })
    .filter((move) => move.to === square && move.captured !== undefined)
  if (captures.length === 0) return 0
  const cheapest = captures.reduce((best, move) =>
    valueOf(move.piece) < valueOf(best.piece) ? move : best,
  )
  const captured = cheapest.captured
  if (captured === undefined) return 0
  board.move(cheapest)
  const net = Math.max(0, valueOf(captured) - exchangeOn(board, square))
  board.undo()
  return net
}

/** The most the side to move can win by a capture sequence on a single square. */
const winnableMaterial = (board: Chess): number => {
  const squares = new Set(
    board
      .moves({ verbose: true })
      .filter((move) => move.captured !== undefined)
      .map((move) => move.to),
  )
  let best = 0
  for (const square of squares) best = Math.max(best, exchangeOn(board, square))
  return best
}

/** Material on the board, in pawns, from White's point of view. Kings are not counted. */
const material = (board: Chess): number => {
  let balance = 0
  for (const rank of board.board()) {
    for (const piece of rank) {
      if (piece === null) continue
      balance += piece.color === 'w' ? valueOf(piece.type) : -valueOf(piece.type)
    }
  }
  return balance
}

export type OfferProof =
  | { readonly ok: true; readonly side: Side; readonly deficit: number }
  | { readonly ok: false; readonly why: string }

/**
 * Whether ply `ply` of `line` (1-based) is a material offer, and by whom.
 *
 * "Worse off" is the material on the board **minus what the opponent can now win**, from
 * the mover's side. Both halves are needed and neither alone is enough:
 *
 * - counting only the board misses 2.f4 in the King's Gambit, where nothing has been taken
 *   yet and the pawn is simply there for the taking;
 * - counting only what hangs misses 3.c3 in the Smith-Morra, where the pawn went two plies
 *   ago and this move is the decision not to take it back.
 *
 * A move that keeps the mover level or ahead is not a sacrifice, whatever it is called —
 * which is how `Ruy Lopez: Brentano Gambit` fails: after 3...g5 the pawn cannot be taken,
 * because 4.Nxg5 hangs the knight to 4...Qxg5.
 */
export const proveOffer = (line: readonly string[], ply: number, move: string): OfferProof => {
  if (ply > line.length) {
    return {
      ok: false,
      why: `the line is ${line.length} ${line.length === 1 ? 'ply' : 'plies'} long, so ply ${ply} is not in it`,
    }
  }
  const board = new Chess()
  for (const san of line.slice(0, ply)) {
    try {
      board.move(san)
    } catch {
      return { ok: false, why: `\`${san}\` is not legal in this line` }
    }
  }
  const played = line[ply - 1]
  if (played !== move) {
    return { ok: false, why: `ply ${ply} is \`${played}\`, not \`${move}\`` }
  }
  // The mover is the side that is *not* to move now.
  const side: Side = board.turn() === 'w' ? 'black' : 'white'
  const fromMover = side === 'white' ? material(board) : -material(board)
  const effective = fromMover - winnableMaterial(board)
  if (effective >= 0) {
    return {
      ok: false,
      why:
        `after \`${move}\` the mover is ${effective === 0 ? 'level' : `${effective} ahead`} once ` +
        'every capture available to the opponent is played out, so nothing was offered',
    }
  }
  return { ok: true, side, deficit: -effective }
}
