import { useId } from 'react'
import { Link, useLocation } from 'react-router'
import './MoveNavigator.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { addressSearch, type Address } from './walk.ts'

/**
 * Previous, next, back to the initial position and back to the gambit root
 * (docs/design-system.md §3).
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
  /** The initial position, or null when the learner is already standing on it. */
  readonly start: Address | null
  /**
   * The gambit root, or null when the learner is already standing on it.
   *
   * A separate control from `start` and not a nicety (#70's AC 2). Before the walk began at
   * move one, "back to the start" *was* the gambit root; now it is the initial position, and
   * the root is the thing almost every published link points at. Folding the two into one
   * control would mean a learner three plies into the defining line has no way back to the
   * position the gambit is actually about, except by pressing next.
   */
  readonly root: Address | null
  /** Where previous goes, or null at the initial position. */
  readonly previous: Address | null
  /** Where next goes, or null at a leaf. */
  readonly next: Address | null
}

type ControlKind = 'start' | 'root' | 'previous' | 'next'

const LABELS: Readonly<Record<ControlKind, TranslationKey>> = {
  start: 'learn.toStart',
  root: 'learn.toRoot',
  previous: 'learn.previousPly',
  next: 'learn.nextPly',
}

/** `prev` and `next` are real link relations; browsers and readers use them to prefetch
 * and to offer "next page" gestures, and they cost nothing to be right about. */
const RELATIONS: Readonly<Record<ControlKind, string | undefined>> = {
  start: undefined,
  root: undefined,
  previous: 'prev',
  next: 'next',
}

export const MoveNavigator = ({ start, root, previous, next }: MoveNavigatorProps) => {
  const { pathname } = useLocation()
  const translated = useTranslated()
  const edgeId = useId()

  const atStart = start === null
  const atRoot = root === null
  const atEnd = next === null
  const atEdge = atStart || atRoot || atEnd

  const control = (kind: ControlKind, target: Address | null) => {
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
        to={{ pathname, search: addressSearch(target) }}
        rel={RELATIONS[kind]}
      >
        <Translated id={LABELS[kind]} />
      </Link>
    )
  }

  return (
    <nav className="move-navigator" aria-label={translated('learn.navigation').text}>
      <div className="move-navigator__controls">
        {control('start', start)}
        {control('root', root)}
        {control('previous', previous)}
        {control('next', next)}
      </div>

      {atEdge && (
        <p className="move-navigator__edge" id={edgeId}>
          {atStart && <Translated id="learn.atStart" />}
          {atStart && (atRoot || atEnd) && ' '}
          {atRoot && <Translated id="learn.atRoot" />}
          {atRoot && atEnd && ' '}
          {atEnd && <Translated id="learn.atEnd" />}
        </p>
      )}
    </nav>
  )
}
