import { useId } from 'react'
import { Link, useLocation } from 'react-router'
import './AnalysisMoveList.css'
import { Translated } from '../../i18n/Translated.tsx'
import { analysisSearch, scoresheet, type LinePosition } from './analysis-line.ts'

/**
 * The whole line as a scoresheet, each move a link to the position after it, and the one on
 * the board marked `aria-current` — the moves after it are still here, which is the point of
 * keeping the whole line in the URL (`analysis-line.ts`). Numbered from the position the
 * line starts in, so a set-up position with Black to move opens on `14. …`.
 */
export type AnalysisMoveListProps = {
  readonly position: LinePosition
  readonly flipped: boolean
}

export const AnalysisMoveList = ({ position, flipped }: AnalysisMoveListProps) => {
  const { pathname } = useLocation()
  const headingId = useId()
  const { start, line, ply } = position

  const move = (index: number | null) => {
    if (index === null)
      return (
        <span className="analysis-moves__gap" aria-hidden="true">
          …
        </span>
      )
    const san = line[index]
    if (san === undefined) return null
    return (
      <Link
        className="analysis-moves__move"
        to={{ pathname, search: analysisSearch({ ...position, ply: index + 1 }, flipped) }}
        aria-current={index + 1 === ply ? 'step' : undefined}
        preventScrollReset
      >
        {san}
      </Link>
    )
  }

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
          {scoresheet(start, line.length).map((row) => (
            <li key={row.number} className="analysis-moves__pair">
              <span className="analysis-moves__number">{row.number}.</span>
              {move(row.white)}
              {row.black !== null && move(row.black)}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
