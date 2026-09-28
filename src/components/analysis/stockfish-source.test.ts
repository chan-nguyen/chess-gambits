import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Evaluation } from './evaluation.ts'
import { createStockfishSource, lineCount, searchDepth } from './stockfish-source.ts'

/**
 * The conversation with the engine, against a worker that records what it is sent and says
 * what the test tells it to. The real engine is exercised in a real browser by
 * `e2e/analysis.spec.ts`; what is asserted here is the part a browser run would only catch by
 * luck — the order of commands, and that a stale search can never paint over a new one.
 */

class FakeWorker {
  static made: FakeWorker[] = []
  readonly url: string
  readonly sent: string[] = []
  terminated = false
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWorker.made.push(this)
  }

  postMessage(message: string): void {
    this.sent.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  /** Say something as the engine. */
  say(...lines: readonly string[]): void {
    for (const line of lines) this.onmessage?.({ data: line })
  }
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const latest = (): FakeWorker => {
  const worker = FakeWorker.made.at(-1)
  if (worker === undefined) throw new Error('no worker was started')
  return worker
}

/** Start a source, ask about `fen`, and walk the worker through the handshake. */
const ready = (fen = START) => {
  const source = createStockfishSource('/engine/stockfish.js')
  const updates: Evaluation[] = []
  const onFailure = vi.fn()
  const stop = source.analyse(fen, { onUpdate: (update) => updates.push(update), onFailure })
  latest().say('uciok', 'readyok')
  return { source, updates, onFailure, stop, worker: latest() }
}

beforeEach(() => {
  FakeWorker.made = []
  vi.stubGlobal('Worker', FakeWorker)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('starting the engine', () => {
  it('starts no worker until something is asked', () => {
    createStockfishSource('/engine/stockfish.js')
    expect(FakeWorker.made).toHaveLength(0)
  })

  it('shakes hands, asks for three lines with WDL, then searches the position', () => {
    const { worker } = ready()

    expect(worker.url).toBe('/engine/stockfish.js')
    expect(worker.sent).toStrictEqual([
      'uci',
      `setoption name MultiPV value ${lineCount}`,
      'setoption name UCI_ShowWDL value true',
      'isready',
      `position fen ${START}`,
      `go depth ${searchDepth}`,
    ])
  })
})

describe('reporting a search', () => {
  it('reports each line from White, in SAN, best first, as the search deepens', () => {
    const { worker, updates } = ready(AFTER_E4)
    worker.say(
      'info depth 12 seldepth 14 multipv 1 score cp -25 wdl 7 945 48 nodes 1 pv e7e6 b1c3',
      'info depth 12 seldepth 15 multipv 2 score cp -34 wdl 5 927 68 nodes 1 pv c7c5 g1f3',
    )

    const last = updates.at(-1)
    expect(last?.depth).toBe(12)
    expect(last?.complete).toBe(false)
    expect(last?.lines.map((line) => line.moves[0]?.san)).toStrictEqual(['e6', 'c5'])
    expect(last?.lines[0]?.score).toStrictEqual({ kind: 'cp', value: 25 })
  })

  it('marks the evaluation complete when the engine names its best move', () => {
    const { worker, updates } = ready()
    worker.say('info depth 20 multipv 1 score cp 30 pv e2e4', 'bestmove e2e4 ponder e7e5')

    expect(updates.at(-1)?.complete).toBe(true)
  })

  it('ignores what it cannot read', () => {
    const { worker, updates } = ready()
    worker.say('info string NNUE evaluation using nn-61e7af4bb97d.nnue', 'nonsense')

    expect(updates).toHaveLength(0)
  })
})

describe('moving on to another position', () => {
  it('stops the running search and waits for it to finish before starting the next', () => {
    const { source, worker, updates } = ready()
    const next: Evaluation[] = []
    source.analyse(AFTER_E4, { onUpdate: (update) => next.push(update), onFailure: vi.fn() })

    expect(worker.sent.at(-1)).toBe('stop')

    // Still the old search talking, until its bestmove: none of it may reach anyone.
    worker.say('info depth 9 multipv 1 score cp 40 pv e2e4')
    expect(updates).toHaveLength(0)
    expect(next).toHaveLength(0)

    worker.say('bestmove e2e4')
    expect(worker.sent.slice(-2)).toStrictEqual([
      `position fen ${AFTER_E4}`,
      `go depth ${searchDepth}`,
    ])

    worker.say('info depth 1 multipv 1 score cp -20 pv e7e5')
    expect(next.at(-1)?.lines[0]?.moves[0]?.san).toBe('e5')
    expect(updates).toHaveLength(0)
  })

  it('searches only the last of several positions asked for in quick succession', () => {
    const { source, worker } = ready()
    const first = vi.fn()
    source.analyse(AFTER_E4, { onUpdate: first, onFailure: vi.fn() })
    source.analyse(START, { onUpdate: vi.fn(), onFailure: vi.fn() })
    worker.say('bestmove e2e4')

    expect(worker.sent.filter((command) => command.startsWith('position'))).toStrictEqual([
      `position fen ${START}`,
      `position fen ${START}`,
    ])
    expect(first).not.toHaveBeenCalled()
  })
})

describe('stopping', () => {
  it('stops the search and reports nothing more once the caller has stopped it', () => {
    const { worker, updates, stop } = ready()
    stop()

    expect(worker.sent.at(-1)).toBe('stop')
    worker.say('info depth 3 multipv 1 score cp 10 pv e2e4', 'bestmove e2e4')
    expect(updates).toHaveLength(0)
  })

  it('terminates the worker on dispose, and a later question starts a fresh one', () => {
    const { source, worker } = ready()
    source.dispose()
    expect(worker.terminated).toBe(true)

    source.analyse(START, { onUpdate: vi.fn(), onFailure: vi.fn() })
    expect(FakeWorker.made).toHaveLength(2)
  })
})

describe('when the engine fails', () => {
  it('tells the caller, once, and starts over on the next question', () => {
    const { source, worker, onFailure } = ready()
    worker.onerror?.()

    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(worker.terminated).toBe(true)

    source.analyse(START, { onUpdate: vi.fn(), onFailure: vi.fn() })
    expect(FakeWorker.made).toHaveLength(2)
  })
})
