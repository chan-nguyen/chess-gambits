import { spawn } from 'node:child_process'

/**
 * Stockfish, spoken to over UCI, used as an **oracle and nothing else** (ADR-0005, step 2).
 *
 * All it is asked for is a number: how many moves the mate might be, so the generator knows
 * what depth to expand. Nothing it says is believed. If it answers "mate in 3" and our own
 * search cannot force one, the claim is refused; if it answers nothing at all, the generator
 * searches to the configured maximum by itself and reaches the same certificates, only
 * slower. That is what "the trust chain ends at our own replay" means in code: this file can
 * be deleted and the proofs are unaffected.
 *
 * **It is never shipped and never on a merge path.** GPL-3.0 binds *conveying*; installing
 * Stockfish on a runner and speaking UCI to it is use, not distribution, and no Stockfish
 * code enters the bundle. Only `prove-cli.ts` imports this module, and `prove:mates` runs on
 * a schedule — `verify:mates`, which is the required CI step, cannot reach this file at all,
 * and `no-engine.test.ts` asserts that by walking the import graph.
 */

export type OracleAnswer =
  /** The engine believes the side to move mates in this many moves. Believed by nobody. */
  | { readonly kind: 'mate'; readonly inMoves: number }
  /** The engine saw no mate in the time it was given. */
  | { readonly kind: 'none' }
  /** No engine to ask. The caller falls back to searching to its own maximum depth. */
  | { readonly kind: 'unavailable'; readonly reason: string }

export type OracleOptions = {
  readonly binary?: string | undefined
  readonly movetimeMs?: number | undefined
}

const DEFAULT_BINARY = 'stockfish'
const DEFAULT_MOVETIME = 3000

/** `info … score mate N` — positive N counts moves for the side to move. */
const MATE_SCORE = /\bscore mate (-?\d+)\b/

export const askOracle = async (
  fen: string,
  options: OracleOptions = {},
): Promise<OracleAnswer> => {
  const binary = options.binary ?? DEFAULT_BINARY
  const movetime = options.movetimeMs ?? DEFAULT_MOVETIME

  return new Promise<OracleAnswer>((resolve) => {
    let engine
    try {
      engine = spawn(binary, [], { stdio: ['pipe', 'pipe', 'ignore'] })
    } catch (error) {
      resolve({
        kind: 'unavailable',
        reason: error instanceof Error ? error.message : 'spawn failed',
      })
      return
    }

    let best: number | undefined
    let buffer = ''
    let settled = false

    const finish = (answer: OracleAnswer): void => {
      if (settled) return
      settled = true
      engine.kill()
      resolve(answer)
    }

    engine.on('error', (error: Error) => {
      finish({ kind: 'unavailable', reason: `\`${binary}\` could not be run: ${error.message}` })
    })

    engine.stdout.setEncoding('utf8')
    engine.stdout.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const score = MATE_SCORE.exec(line)
        // A negative score means the side to move is the one getting mated, which is not a
        // claim this pipeline has any use for.
        if (score?.[1] !== undefined) {
          const moves = Number(score[1])
          if (moves > 0) best = best === undefined ? moves : Math.min(best, moves)
        }
        if (line.startsWith('bestmove')) {
          finish(best === undefined ? { kind: 'none' } : { kind: 'mate', inMoves: best })
        }
      }
    })

    engine.stdin.write(`uci\nisready\nposition fen ${fen}\ngo movetime ${movetime}\n`)

    // The engine is on a schedule, not on a merge path, but a hung process still has to end.
    const timer = setTimeout(
      () => finish(best === undefined ? { kind: 'none' } : { kind: 'mate', inMoves: best }),
      movetime * 3 + 5000,
    )
    timer.unref()
  })
}
