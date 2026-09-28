import { useId } from 'react'
import { Link, useLocation } from 'react-router'
import './AnalysisMoveList.css'
import { Translated } from '../../i18n/Translated.tsx'
import { analysisSearch, type LinePosition } from './analysis-line.ts'

/**
 * The whole line as a scoresheet, each move a link to the position after it, and the one on
 * the board marked `aria-current` — the moves after it are still here, which is the point of
 * keeping the whole line in the URL (`analysis-line.ts`).
 */
export type AnalysisMoveListProps = {
  readonly position: LinePosition
  readonly flipped: boolean
}

export const AnalysisMoveList = ({ position, flipped }: AnalysisMoveListProps) => {
  const { pathname } = useLocation()
  const headingId = useId()
  const { line, ply } = position

  const move = (index: number) => {
    const san = line[index]
    if (san === undefined) return null
    return (
      <Link
        className="analysis-moves__move"
        to={{ pathname, search: analysisSearch({ line, ply: index + 1 }, flipped) }}
        aria-current={index + 1 === ply ? 'step' : undefined}
        preventScrollReset
      >
        {san}
      </Link>
    )
  }

  const pairs = Array.from({ length: Math.ceil(line.length / 2) }, (_, pair) => pair)

  return (
    <section className="analysis-moves" aria-labelledby={headingId}>
      <h2 className="analysis-moves__heading" id={headingId}>
        <Translated id="analysis.moves" />
      </h2>
      {line.length === 0 ? (
        <p className="analysis-moves__empty">
          <Translated id="analysis.noMoves" />
        </p>
      ) : (
        <ol className="analysis-moves__list">
          {pairs.map((pair) => (
            <li key={pair} className="analysis-moves__pair">
              <span className="analysis-moves__number">{pair + 1}.</span>
              {move(pair * 2)}
              {move(pair * 2 + 1)}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
