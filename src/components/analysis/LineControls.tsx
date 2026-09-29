import { useId } from 'react'
import { Link, useLocation } from 'react-router'
import './LineControls.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { FlipButton } from '../learn/FlipButton.tsx'
import { analysisSearch, type LinePosition } from './analysis-line.ts'

/**
 * Start, previous, next and last move, and the flip control beside them.
 *
 * **Links, not buttons**, for the reason `MoveNavigator` gives (docs/design-system.md §4):
 * every position is a URL, so it can be opened in a new tab or copied. At an edge a control
 * becomes a `role="link"` with `aria-disabled` and a sentence that says why, rather than
 * disappearing or merely turning grey.
 */
export type LineControlsProps = {
  readonly position: LinePosition
  readonly flipped: boolean
  readonly onFlip: () => void
}

type Control = {
  readonly kind: string
  readonly label: TranslationKey
  readonly ply: number | null
}

export const LineControls = ({ position, flipped, onFlip }: LineControlsProps) => {
  const { pathname } = useLocation()
  const translated = useTranslated()
  const edgeId = useId()
  const { line, ply } = position
  const atStart = ply === 0
  const atEnd = ply === line.length

  const controls: readonly Control[] = [
    { kind: 'start', label: 'analysis.toStart', ply: atStart ? null : 0 },
    { kind: 'previous', label: 'analysis.previous', ply: atStart ? null : ply - 1 },
    { kind: 'next', label: 'analysis.next', ply: atEnd ? null : ply + 1 },
    { kind: 'end', label: 'analysis.toEnd', ply: atEnd ? null : line.length },
  ]

  return (
    <div className="line-controls">
      <nav className="line-controls__nav" aria-label={translated('analysis.navigation').text}>
        <div className="line-controls__row">
          {controls.map(({ kind, label, ply: target }) =>
            target === null ? (
              <span
                key={kind}
                className="line-controls__control line-controls__control--unavailable"
                role="link"
                aria-disabled="true"
                aria-describedby={edgeId}
              >
                <Translated id={label} />
              </span>
            ) : (
              <Link
                key={kind}
                className={`line-controls__control line-controls__control--${kind}`}
                to={{ pathname, search: analysisSearch({ ...position, ply: target }, flipped) }}
                preventScrollReset
              >
                <Translated id={label} />
              </Link>
            ),
          )}
        </div>
        {(atStart || atEnd) && (
          <p className="line-controls__edge" id={edgeId}>
            {/* An empty line is at both edges; its start is the one worth saying. */}
            <Translated id={atStart ? 'analysis.atStart' : 'analysis.atEnd'} />
          </p>
        )}
      </nav>
      <FlipButton flipped={flipped} onFlip={onFlip} />
    </div>
  )
}
