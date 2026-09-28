import { Chess } from 'chess.js'
import type { Square } from '../board/board-model.ts'
import { isSquare } from '../home/board-square.ts'
import type { PlayedMove } from '../home/chess-engine.ts'
import type { UciInfo } from './uci.ts'

/**
 * What an evaluation is, and the seam every consumer asks for one through (ADR-0010, as
 * amended by ADR-0012).
 *
 * Everything below is **from White's point of view**, which is how a board is read and how
 * chess.com and lichess print an evaluation: `+0.34` is White better, `-M2` is Black mating
 * in two. The engine speaks from the side to move; `fromEngine` is the one place that turns
 * one into the other, so no component ever has to ask whose move it is.
 */

export type Score =
  /** Centipawns, White positive. */
  | { readonly kind: 'cp'; readonly value: number }
  /** Mate in `value` moves: positive when White mates, negative when Black does. */
  | { readonly kind: 'mate'; readonly value: number }

/** Stockfish's own win/draw/loss model, per mille, summing to 1000. */
export type Chances = { readonly white: number; readonly draw: number; readonly black: number }

export type EngineLine = {
  readonly score: Score
  readonly chances: Chances | null
  /** The line, replayed into SAN from the analysed position. Never empty. */
  readonly moves: readonly PlayedMove[]
}

export type Evaluation = {
  /** The depth of the best line: the figure the page reports. */
  readonly depth: number
  /** Best first, as the engine ranks them. */
  readonly lines: readonly EngineLine[]
  /** True once the search has stopped at its depth limit, rather than still deepening. */
  readonly complete: boolean
}

export type AnalysisListener = {
  readonly onUpdate: (evaluation: Evaluation) => void
  /** The engine could not start, or stopped answering. Nothing further will arrive. */
  readonly onFailure: () => void
}

/**
 * ADR-0010's seam, streaming. `analyse` starts a search and reports as it deepens; the
 * function it returns stops it. A component holds one of these and renders what arrives —
 * `stockfish-source.ts` is the real one, and tests pass a fake.
 */
export type EvaluationSource = {
  readonly analyse: (fen: string, listener: AnalysisListener) => () => void
}

const whiteToMove = (fen: string): boolean => fen.split(' ')[1] !== 'b'

/**
 * The PV as moves a person can read, stopping at the first one that is not legal. That
 * should never happen, and the engine is a separate program: a line that suddenly made no
 * sense is shortened rather than trusted.
 */
const replayed = (fen: string, pv: readonly string[]): readonly PlayedMove[] => {
  const chess = new Chess(fen)
  const moves: PlayedMove[] = []
  for (const uci of pv) {
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.slice(4, 5)
    if (!isSquare(from) || !isSquare(to)) break
    try {
      const move = chess.move(promotion === '' ? { from, to } : { from, to, promotion })
      moves.push({ san: move.san, from, to })
    } catch {
      break
    }
  }
  return moves
}

/** One engine line, turned to White's point of view and into SAN. Null if it replays to nothing. */
export const fromEngine = (fen: string, info: UciInfo): EngineLine | null => {
  const moves = replayed(fen, info.pv)
  if (moves.length === 0) return null

  const sign = whiteToMove(fen) ? 1 : -1
  const score: Score = { kind: info.score.kind, value: sign * info.score.value }
  const chances =
    info.wdl === null
      ? null
      : sign === 1
        ? { white: info.wdl[0], draw: info.wdl[1], black: info.wdl[2] }
        : { white: info.wdl[2], draw: info.wdl[1], black: info.wdl[0] }
  return { score, chances, moves }
}

/** `+0.34`, `-1.20`, `0.00`, `M3`, `-M2` — the way every chess site prints one. */
export const formatScore = (score: Score): string => {
  if (score.kind === 'mate') return score.value < 0 ? `-M${-score.value}` : `M${score.value}`
  const pawns = (score.value / 100).toFixed(2)
  return score.value > 0 ? `+${pawns}` : score.value === 0 ? '0.00' : pawns
}

/**
 * White's share of the evaluation bar, from 0 to 1: White's expected score, win plus half a
 * draw, under Stockfish's WDL model.
 *
 * Without WDL — which the source always asks for, so this is only ever a fallback — it is
 * the logistic lichess publishes for turning centipawns into a winning chance. A mate fills
 * the bar for whoever is mating.
 */
export const whiteShare = (line: EngineLine): number => {
  if (line.chances !== null) return (line.chances.white + line.chances.draw / 2) / 1000
  if (line.score.kind === 'mate') return line.score.value > 0 ? 1 : 0
  return 1 / (1 + Math.exp(-0.00368208 * line.score.value))
}

/** The first move of a line as an arrow for the board: the engine's best move. */
export const bestMoveArrow = (
  evaluation: Evaluation | null,
): { readonly from: Square; readonly to: Square } | null => {
  const first = evaluation?.lines[0]?.moves[0]
  return first === undefined ? null : { from: first.from, to: first.to }
}

/**
 * A line as a scoresheet writes it, from the position it starts in: `1...e5 2.Nf3 Nc6`, in
 * the same spelling `plyLabel` gives the gambit page. The number and side come from the FEN,
 * so a line from move 14 reads `14.Rxe7`, not `1.Rxe7`.
 */
export const numberedLine = (fen: string, sans: readonly string[]): string => {
  const fields = fen.split(' ')
  const startMove = Number(fields[5] ?? '1') || 1
  const blackFirst = fields[1] === 'b'
  return sans
    .map((san, index) => {
      const half = index + (blackFirst ? 1 : 0)
      const number = startMove + Math.floor(half / 2)
      if (half % 2 === 0) return `${number}.${san}`
      return index === 0 ? `${number}...${san}` : san
    })
    .join(' ')
}
