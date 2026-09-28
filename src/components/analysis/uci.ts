/**
 * Reading what Stockfish says (ADR-0012).
 *
 * UCI is line-oriented text, and the engine is a separate program: nothing here imports it,
 * and this module is the whole of what the site knows about its output. Pure, so the shapes
 * the engine really sends can be tested without starting one — the fixtures in `uci.test.ts`
 * are lines captured from `stockfish-19-lite-single`, not lines written to fit the parser.
 *
 * Scores and WDL figures are **from the side to move**, as UCI defines them. Turning them
 * into White's point of view is `evaluation.ts`'s job, which knows whose move it is.
 */

export type UciScore =
  | { readonly kind: 'cp'; readonly value: number }
  /** Mate in `value` moves for the side to move; negative when the side to move is mated. */
  | { readonly kind: 'mate'; readonly value: number }

/** Win, draw and loss for the side to move, in per mille. */
export type UciWdl = readonly [win: number, draw: number, loss: number]

export type UciInfo = {
  readonly depth: number
  /** Which of the MultiPV lines this is, from 1. */
  readonly multipv: number
  readonly score: UciScore
  readonly wdl: UciWdl | null
  /** The principal variation, in UCI long algebraic (`e2e4`, `e7e8q`). */
  readonly pv: readonly string[]
}

export type UciMessage =
  | { readonly kind: 'uciok' }
  | { readonly kind: 'readyok' }
  | { readonly kind: 'info'; readonly info: UciInfo }
  /** The search is over. `move` is null in a position with no legal move (`bestmove (none)`). */
  | { readonly kind: 'bestmove'; readonly move: string | null }
  /** Everything else: option lists, `info string`, `currmove` progress, bounded scores. */
  | { readonly kind: 'other' }

const OTHER: UciMessage = { kind: 'other' }

const integer = (token: string | undefined): number | null =>
  token !== undefined && /^-?\d+$/.test(token) ? Number(token) : null

const readInfo = (tokens: readonly string[]): UciMessage => {
  let depth: number | null = null
  let multipv = 1
  let score: UciScore | null = null
  let wdl: UciWdl | null = null
  let pv: readonly string[] = []

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === 'depth') depth = integer(tokens[index + 1])
    if (token === 'multipv') multipv = integer(tokens[index + 1]) ?? multipv
    if (token === 'score') {
      const kind = tokens[index + 1]
      const value = integer(tokens[index + 2])
      /*
       * A bound is the engine saying "at least" or "at most" mid-iteration, before the
       * window resolves. Drawing it would make the figure on screen jump to a number the
       * same depth is about to take back, so the whole line is ignored.
       */
      const bound = tokens[index + 3]
      if (bound === 'lowerbound' || bound === 'upperbound') return OTHER
      if ((kind === 'cp' || kind === 'mate') && value !== null) score = { kind, value }
    }
    if (token === 'wdl') {
      const win = integer(tokens[index + 1])
      const draw = integer(tokens[index + 2])
      const loss = integer(tokens[index + 3])
      if (win !== null && draw !== null && loss !== null) wdl = [win, draw, loss]
    }
    // `pv` is always last: everything after it is the line.
    if (token === 'pv') {
      pv = tokens.slice(index + 1)
      break
    }
  }

  // `info depth 0 score mate 0` in a mated position carries no line: nothing to show.
  if (depth === null || score === null || pv.length === 0) return OTHER
  return { kind: 'info', info: { depth, multipv, score, wdl, pv } }
}

/** One line of engine output, read. Never throws: the engine is a program we did not write. */
export const parseUciLine = (line: string): UciMessage => {
  const tokens = line.trim().split(/\s+/)
  switch (tokens[0]) {
    case 'uciok':
      return { kind: 'uciok' }
    case 'readyok':
      return { kind: 'readyok' }
    case 'bestmove': {
      const move = tokens[1]
      return { kind: 'bestmove', move: move === undefined || move === '(none)' ? null : move }
    }
    case 'info':
      return tokens[1] === 'string' ? OTHER : readInfo(tokens)
    default:
      return OTHER
  }
}
