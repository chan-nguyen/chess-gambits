import { useId } from 'react'
import './EnginePanel.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import type { EngineLine } from './evaluation.ts'
import { formatScore, numberedLine } from './evaluation.ts'
import type { AnalysisState } from './use-analysis.ts'

/**
 * What Stockfish says about the position on the board (#154).
 *
 * **Every figure here is an estimate, and the panel says so first** (ADR-0012). A mate score
 * is worded as what the engine *sees*, at the depth it reached, in the page's ordinary text
 * colour: `--color-mate` and `MateOutcome` belong to certificates the build re-verifies, and
 * a search that could withdraw its answer one ply deeper is not one of those.
 *
 * **Not a live region.** The search deepens several times a second; announcing each depth
 * would bury everything else a screen reader has to say. The text is on the page, in reading
 * order, for whenever the visitor goes to it.
 */
export type EnginePanelProps = {
  readonly state: AnalysisState
  /** The position being analysed, for numbering the lines. */
  readonly fen: string
  /** Play a line's first move. */
  readonly onPlay: (san: string) => void
}

/** How much of each line is written out: enough to see the idea, short enough to scan. */
const shownPlies = 10

const percent = (perMille: number): number => Math.round(perMille / 10)

const Line = ({
  line,
  fen,
  onPlay,
}: {
  readonly line: EngineLine
  readonly fen: string
  readonly onPlay: (san: string) => void
}) => {
  const translated = useTranslated()
  const first = line.moves[0]
  if (first === undefined) return null
  return (
    <li>
      <button type="button" className="engine-panel__line" onClick={() => onPlay(first.san)}>
        <span className="visually-hidden">
          {translated('analysis.playLine', { san: first.san }).text},{' '}
        </span>
        <span className="engine-panel__line-score">{formatScore(line.score)}</span>{' '}
        <span className="engine-panel__line-moves">
          {numberedLine(
            fen,
            line.moves.slice(0, shownPlies).map((move) => move.san),
          )}
        </span>
      </button>
    </li>
  )
}

export const EnginePanel = ({ state, fen, onPlay }: EnginePanelProps) => {
  const headingId = useId()

  const body = () => {
    if (state.status === 'idle')
      return (
        <p className="engine-panel__status">
          <Translated id="analysis.gameOver" />
        </p>
      )
    if (state.status === 'failed')
      return (
        <p className="engine-panel__status" role="alert">
          <Translated id="analysis.failed" />
        </p>
      )

    const best = state.evaluation?.lines[0]
    if (state.evaluation === null || best === undefined)
      return (
        <p className="engine-panel__status">
          <Translated id={state.loaded ? 'analysis.thinking' : 'analysis.loading'} />
        </p>
      )

    const { evaluation } = state
    return (
      <>
        <p className="engine-panel__score">
          <span className="visually-hidden">
            <Translated id="analysis.evaluation" />{' '}
          </span>
          <span className="engine-panel__value">{formatScore(best.score)}</span>{' '}
          <span className="engine-panel__depth">
            <Translated id="analysis.depth" values={{ depth: evaluation.depth }} /> ·{' '}
            <Translated id={evaluation.complete ? 'analysis.complete' : 'analysis.searching'} />
          </span>
        </p>

        {best.score.kind === 'mate' && (
          <p className="engine-panel__mate">
            <Translated
              id={best.score.value > 0 ? 'analysis.whiteMates' : 'analysis.blackMates'}
              values={{ moves: Math.abs(best.score.value) }}
            />
          </p>
        )}

        {best.chances !== null && (
          <>
            <p className="engine-panel__chances">
              <Translated
                id="analysis.chances"
                values={{
                  white: percent(best.chances.white),
                  draw: percent(best.chances.draw),
                  black: percent(best.chances.black),
                }}
              />
            </p>
            <p className="engine-panel__note">
              <Translated id="analysis.chancesNote" />
            </p>
          </>
        )}

        <h3 className="engine-panel__lines-heading">
          <Translated id="analysis.lines" />
        </h3>
        <ol className="engine-panel__lines">
          {evaluation.lines.map((line, index) => (
            <Line key={index} line={line} fen={fen} onPlay={onPlay} />
          ))}
        </ol>
      </>
    )
  }

  return (
    <section className="engine-panel" aria-labelledby={headingId}>
      <h2 className="engine-panel__heading" id={headingId}>
        <Translated id="analysis.engine" />
      </h2>
      <p className="engine-panel__estimate">
        <Translated id="analysis.estimate" />
      </p>
      {body()}
    </section>
  )
}
