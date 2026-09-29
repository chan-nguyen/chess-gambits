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
 * `fen` is the position the line starts from when it is not the initial one (2026-09-29):
 * a position set up by hand, and absent otherwise, so every address that existed before it
 * means what it meant. `setup` is present while that position is being set up, and holds
 * the editor's board; the rest of the address is kept beside it, so leaving the editor
 * without analysing goes back to exactly what was on screen.
 *
 * Shape only, like every URL parser here: the moves are replayed by `replay` in
 * `chess-engine.ts`, which stops at the first one that is not legal, and `fen` is read by
 * `readStart`, which refuses a position the engine should not be given.
 */

export const plyParam = 'ply'
export const startParam = 'fen'
export const setupParam = 'setup'

/**
 * Longer than the home board's cap: a pasted game is routinely past 128 plies, and the
 * longest decisive games on record are past 500. Still a bound, because a URL is
 * attacker-controlled (docs/security.md, B4) and every ply is replayed.
 */
export const maxAnalysisPlies = 600

/**
 * Where on a line the board stands. `ply` runs from 0 (the start) to `line.length`, and
 * `start` is the FEN the line is played from, or null for the initial position.
 */
export type LinePosition = {
  readonly start: string | null
  readonly line: readonly string[]
  readonly ply: number
}

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
export const analysisSearch = ({ start, line, ply }: LinePosition, flipped: boolean): string => {
  const parts = [
    ...(start === null ? [] : [`${startParam}=${encodeURIComponent(start)}`]),
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
export const playAt = (position: LinePosition, san: string): LinePosition => {
  const { line, ply } = position
  return line[ply] === san
    ? { ...position, ply: ply + 1 }
    : { ...position, line: [...line.slice(0, ply), san], ply: ply + 1 }
}

const isSetupPart = (part: string): boolean =>
  part === setupParam || part.startsWith(`${setupParam}=`)

/**
 * `search` with the editor's board set to `fen`, or the editor closed when it is null, and
 * every other parameter left byte for byte as it was — `withFlip`'s rule, for its reason.
 */
export const withSetup = (search: string, fen: string | null): string => {
  const kept = search
    .replace(/^\?/, '')
    .split('&')
    .filter((part) => part !== '' && !isSetupPart(part))
  const parts = fen === null ? kept : [...kept, `${setupParam}=${encodeURIComponent(fen)}`]
  return parts.length === 0 ? '' : `?${parts.join('&')}`
}

/** One row of a scoresheet: its move number, and the index into the line of each side's ply. */
export type ScoresheetRow = {
  readonly number: number
  readonly white: number | null
  readonly black: number | null
}

/**
 * A line laid out as a scoresheet, from the position it starts in. From the initial
 * position that is `1. e4 e5`; from a set-up position with Black to move at move 14, the
 * first row is `14. … Rxe7`, as every scoresheet writes it.
 */
export const scoresheet = (start: string | null, length: number): readonly ScoresheetRow[] => {
  const fields = (start ?? '').split(' ')
  // With Black to move, the first ply is the second half of the first row.
  const offset = fields[1] === 'b' ? 1 : 0
  const firstMove = Number(fields[5] ?? '1') || 1
  const rows = length === 0 ? 0 : Math.ceil((length + offset) / 2)
  return Array.from({ length: rows }, (_, row) => {
    const white = row * 2 - offset
    return {
      number: firstMove + row,
      white: white >= 0 ? white : null,
      black: white + 1 < length ? white + 1 : null,
    }
  })
}

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
