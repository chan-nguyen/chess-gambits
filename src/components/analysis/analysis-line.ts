import { Chess } from 'chess.js'
import { withFlip } from '../../lib/flip.ts'
import { encodeMoves, movesParam, parseMovesShape } from '../home/moves-param.ts'

/**
 * The analysis page's address (#154): which line is on the board, and how far into it.
 *
 * `moves` is the **whole** line, in the same encoding the home board uses, and `ply` is
 * how many of its moves are on the board. Stepping back is therefore not undoing: the rest
 * of the line stays in the URL, so a visitor can walk back to the move that went wrong and
 * forward again, which is most of what analysis is. `ply` is absent at the end of the line,
 * so a link that names no position lands on the last one, and every home-board URL is
 * already a valid analysis URL.
 *
 * Shape only, like every URL parser here: the moves are replayed by `replay` in
 * `chess-engine.ts`, which stops at the first one that is not legal.
 */

export const plyParam = 'ply'

/**
 * Longer than the home board's cap: a pasted game is routinely past 128 plies, and the
 * longest decisive games on record are past 500. Still a bound, because a URL is
 * attacker-controlled (docs/security.md, B4) and every ply is replayed.
 */
export const maxAnalysisPlies = 600

/** Where on a line the board stands. `ply` runs from 0 (the start) to `line.length`. */
export type LinePosition = { readonly line: readonly string[]; readonly ply: number }

export const parseLine = (raw: string | null): readonly string[] =>
  parseMovesShape(raw ?? '', maxAnalysisPlies)

/**
 * The `ply` parameter against a line that has already been replayed. Digits only, and
 * clamped to the line: a hand-edited `ply=999` shows the end rather than nothing.
 */
export const parsePly = (raw: string | null, length: number): number => {
  if (raw === null || !/^\d{1,4}$/.test(raw)) return length
  return Math.min(Number(raw), length)
}

/** The query string for a position on a line: no `ply` at the end, no `moves` when empty. */
export const analysisSearch = ({ line, ply }: LinePosition, flipped: boolean): string => {
  const parts = [
    ...(line.length === 0 ? [] : [`${movesParam}=${encodeMoves(line)}`]),
    ...(ply >= line.length ? [] : [`${plyParam}=${ply}`]),
  ]
  return withFlip(parts.length === 0 ? '' : `?${parts.join('&')}`, flipped)
}

/**
 * Playing `san` with the board at `ply`. If it is the move the line already has there, the
 * board steps onto it and the rest of the line is kept; any other move starts a new line
 * from here, which is what chess.com and lichess do with a move off the main line when they
 * are not keeping variations.
 */
export const playAt = ({ line, ply }: LinePosition, san: string): LinePosition =>
  line[ply] === san ? { line, ply: ply + 1 } : { line: [...line.slice(0, ply), san], ply: ply + 1 }

/** Why a pasted PGN was refused. */
export type PgnProblem = 'empty' | 'invalid' | 'custom-start' | 'too-long'

export type PgnImport =
  | { readonly ok: true; readonly moves: readonly string[] }
  | { readonly ok: false; readonly problem: PgnProblem }

/** A paste this long is not a game; refusing it before parsing keeps a paste from hanging the tab. */
const maxPgnCharacters = 50_000

/**
 * A pasted PGN, as the main line's moves from the initial position.
 *
 * A game that starts from a set-up position (a `FEN` tag) is refused rather than silently
 * replayed from the wrong board: this page's address is moves from the start, and a line
 * that only makes sense from somewhere else would put wrong moves on the board.
 */
export const importPgn = (text: string): PgnImport => {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, problem: 'empty' }
  if (trimmed.length > maxPgnCharacters) return { ok: false, problem: 'too-long' }
  if (/\[\s*FEN\s+"/i.test(trimmed)) return { ok: false, problem: 'custom-start' }

  const chess = new Chess()
  try {
    chess.loadPgn(trimmed)
  } catch {
    return { ok: false, problem: 'invalid' }
  }
  const moves = chess.history()
  if (moves.length === 0) return { ok: false, problem: 'invalid' }
  if (moves.length > maxAnalysisPlies) return { ok: false, problem: 'too-long' }
  return { ok: true, moves }
}
