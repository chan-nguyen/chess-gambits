import { useEffect, useState } from 'react'
import type { Evaluation, EvaluationSource } from './evaluation.ts'

export type AnalysisState =
  /** Nothing to analyse: the game is over, and the rules engine has already said how. */
  | { readonly status: 'idle' }
  /**
   * Searching, with whatever the engine has said about this position so far. `loaded` is
   * false until the engine has answered anything at all, which is the 1.2 MB download the
   * first position waits on and no later one does.
   */
  | {
      readonly status: 'thinking'
      readonly evaluation: Evaluation | null
      readonly loaded: boolean
    }
  | { readonly status: 'failed' }

type Received = {
  readonly fen: string
  readonly evaluation: Evaluation | null
  readonly failed: boolean
}

/**
 * What the engine currently says about `fen`, restarted whenever `fen` changes and stopped
 * when it does or the component unmounts.
 *
 * What arrived is kept **with the position it is about**, and read back only while that is
 * still the position on screen. The render after a move therefore shows "thinking" at once,
 * rather than the previous position's figures until the first new line arrives — and no
 * effect has to set state synchronously to clear them.
 */
export const useAnalysis = (source: EvaluationSource, fen: string | null): AnalysisState => {
  const [received, setReceived] = useState<Received | null>(null)

  useEffect(() => {
    if (fen === null) return
    return source.analyse(fen, {
      onUpdate: (evaluation) => setReceived({ fen, evaluation, failed: false }),
      onFailure: () => setReceived({ fen, evaluation: null, failed: true }),
    })
  }, [source, fen])

  if (fen === null) return { status: 'idle' }
  if (received === null) return { status: 'thinking', evaluation: null, loaded: false }
  if (received.fen !== fen) return { status: 'thinking', evaluation: null, loaded: true }
  if (received.failed) return { status: 'failed' }
  return { status: 'thinking', evaluation: received.evaluation, loaded: true }
}
