import type { AnalysisListener, EngineLine, EvaluationSource } from './evaluation.ts'
import { fromEngine } from './evaluation.ts'
import { parseUciLine } from './uci.ts'

/**
 * The one module that talks to Stockfish (ADR-0012): it holds a `Worker` and exchanges UCI
 * text with it. It imports none of Stockfish's code — the worker is a separate program at
 * its own URL — and that separation is the licence argument ADR-0012 rests on, so it is
 * also why nothing else in `src/` may reach the engine except through this.
 *
 * **One search at a time, and never a stale answer.** The engine answers a `stop` with the
 * `bestmove` of the search it was running, and every `info` line before that `bestmove`
 * still belongs to the old position. So a new request while a search is running sends
 * `stop`, marks the old request finished, and waits for the `bestmove` before sending the
 * new position — stepping through a game quickly would otherwise paint one position's
 * evaluation over the next.
 */

/**
 * Where the vendored worker is served, under the base path (ADR-0012). Its `.wasm` sits
 * beside it with the same name, which is where the loader looks for it.
 */
export const stockfishWorkerPath = 'engine/stockfish-19-lite-single.js'

/** How deep each search goes before it stops. A few seconds for the lite build in a browser. */
export const searchDepth = 20

/** How many lines the engine reports, best first. */
export const lineCount = 3

/** What the page needs to make one: where the worker script is served. */
export type StockfishSource = EvaluationSource & {
  /** Stop the worker. A later `analyse` starts a fresh one. */
  readonly dispose: () => void
}

type Request = {
  readonly fen: string
  readonly listener: AnalysisListener
  /** Set once the caller stopped it, or a newer request replaced it: its output is dropped. */
  finished: boolean
}

export const createStockfishSource = (workerUrl: string): StockfishSource => {
  let worker: Worker | null = null
  let ready = false
  let searching: Request | null = null
  let waiting: Request | null = null
  // By MultiPV index. Each line keeps the depth it was last reported at: the three lines of
  // one iteration arrive one after another, so for a moment they are at different depths.
  let lines = new Map<number, { readonly depth: number; readonly line: EngineLine }>()

  const send = (command: string): void => worker?.postMessage(command)

  const start = (request: Request): void => {
    searching = request
    lines = new Map()
    send(`position fen ${request.fen}`)
    send(`go depth ${searchDepth}`)
  }

  const report = (request: Request, complete: boolean): void => {
    const ranked = [...lines.entries()].sort(([one], [other]) => one - other)
    const best = ranked[0]
    if (best === undefined) return
    request.listener.onUpdate({
      depth: best[1].depth,
      lines: ranked.map(([, { line }]) => line),
      complete,
    })
  }

  const fail = (): void => {
    for (const request of [searching, waiting]) {
      if (request !== null && !request.finished) request.listener.onFailure()
    }
    dispose()
  }

  const receive = (text: string): void => {
    const message = parseUciLine(text)
    switch (message.kind) {
      case 'uciok':
        send(`setoption name MultiPV value ${lineCount}`)
        send('setoption name UCI_ShowWDL value true')
        send('isready')
        return
      case 'readyok':
        ready = true
        if (waiting !== null) {
          const next = waiting
          waiting = null
          start(next)
        }
        return
      case 'info': {
        const request = searching
        if (request === null || request.finished) return
        const line = fromEngine(request.fen, message.info)
        if (line === null) return
        lines.set(message.info.multipv, { depth: message.info.depth, line })
        report(request, false)
        return
      }
      case 'bestmove': {
        const request = searching
        searching = null
        if (request !== null && !request.finished) report(request, true)
        if (waiting !== null) {
          const next = waiting
          waiting = null
          start(next)
        }
        return
      }
      case 'other':
        return
    }
  }

  const boot = (): void => {
    const created = new Worker(workerUrl)
    created.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data === 'string') receive(event.data)
    }
    created.onerror = () => fail()
    worker = created
    ready = false
    send('uci')
  }

  const dispose = (): void => {
    worker?.terminate()
    worker = null
    ready = false
    searching = null
    waiting = null
  }

  const analyse = (fen: string, listener: AnalysisListener): (() => void) => {
    const request: Request = { fen, listener, finished: false }
    if (waiting !== null) waiting.finished = true
    waiting = request

    if (worker === null) boot()
    if (ready) {
      if (searching === null) {
        waiting = null
        start(request)
      } else {
        searching.finished = true
        send('stop')
      }
    }

    return () => {
      if (request.finished) return
      request.finished = true
      if (waiting === request) waiting = null
      if (searching === request) send('stop')
    }
  }

  return { analyse, dispose }
}
