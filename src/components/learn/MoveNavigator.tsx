import { useId } from 'react'
import { Link, useLocation } from 'react-router'
import './MoveNavigator.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { lineSearch } from '../../lib/line.ts'

/**
 * Previous, next, and back to the start (docs/design-system.md §3).
 *
 * **These are links, not buttons** (§4). Every position in this product is a URL, so a
 * learner must be able to middle-click the next position into a new tab, copy its address
 * out of the context menu, and land on it again from their history. A button can do none of
 * those, and the state it would move is state the URL already holds.
 *
 * At an edge the control becomes a `role="link"` with `aria-disabled`, rather than
 * disappearing or turning grey. AC 1 asks for the state to be *announced*: greying it out
 * says nothing to a screen reader and nothing to anyone who cannot separate those two
 * greys, so the state is in the accessibility tree and the reason is a visible sentence the
 * control points at with `aria-describedby`.
 */
export type MoveNavigatorProps = {
  /** Where previous goes, or null at the root. */
  readonly previous: readonly string[] | null
  /** Where next goes, or null at a leaf. */
  readonly next: readonly string[] | null
}

type ControlKind = 'start' | 'previous' | 'next'

const LABELS: Readonly<Record<ControlKind, TranslationKey>> = {
  start: 'learn.toStart',
  previous: 'learn.previousPly',
  next: 'learn.nextPly',
}

/** `prev` and `next` are real link relations; browsers and readers use them to prefetch
 * and to offer "next page" gestures, and they cost nothing to be right about. */
const RELATIONS: Readonly<Record<ControlKind, string | undefined>> = {
  start: undefined,
  previous: 'prev',
  next: 'next',
}

export const MoveNavigator = ({ previous, next }: MoveNavigatorProps) => {
  const { pathname } = useLocation()
  const translated = useTranslated()
  const edgeId = useId()

  const atStart = previous === null
  const atEnd = next === null
  const atEdge = atStart || atEnd

  const control = (kind: ControlKind, target: readonly string[] | null) => {
    const className = `move-navigator__control move-navigator__control--${kind}`

    if (target === null)
      return (
        <span
          className={`${className} move-navigator__control--unavailable`}
          role="link"
          aria-disabled="true"
          aria-describedby={edgeId}
        >
          <Translated id={LABELS[kind]} />
        </span>
      )

    return (
      <Link
        className={className}
        to={{ pathname, search: lineSearch(target) }}
        rel={RELATIONS[kind]}
      >
        <Translated id={LABELS[kind]} />
      </Link>
    )
  }

  return (
    <nav className="move-navigator" aria-label={translated('learn.navigation').text}>
      <div className="move-navigator__controls">
        {/* Jump to start is the same condition as previous: both are the root. */}
        {control('start', atStart ? null : [])}
        {control('previous', previous)}
        {control('next', next)}
      </div>

      {atEdge && (
        <p className="move-navigator__edge" id={edgeId}>
          {atStart && <Translated id="learn.atStart" />}
          {atStart && atEnd && ' '}
          {atEnd && <Translated id="learn.atEnd" />}
        </p>
      )}
    </nav>
  )
}
