import { Link, useLocation } from 'react-router'
import './MoveList.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { plyLabel } from './tree-path.ts'
import { addressKey, addressSearch, type Address, type WalkStep } from './walk.ts'

/**
 * The plies of the current path, in monospace, current one marked, click to jump (AC 8).
 *
 * Every entry is a link for the reason §4 gives, and because each one already *is* a URL:
 * the path to any ancestor is a prefix of the current path, so the list is a row of
 * shareable addresses rather than a row of state changes.
 *
 * It shows the path *to* the current node and no further. What lies ahead at a branch point
 * is `BranchChoices` (#9) and `GambitTree` (#10); a move list that guessed at a
 * continuation would be inventing one of several answers and presenting it as the line.
 *
 * Since #70 the path it shows begins at the **initial position** rather than at the gambit
 * root, so the defining line's plies are the first entries and the first entry is the real
 * starting position. They are not drawn differently from the plies below the root, because
 * they are not a different kind of thing to a learner reading a scoresheet: what differs is
 * that they have no branches, and that is expressed by there being nothing to click at them
 * rather than by a colour.
 */
export type MoveListProps = {
  /** Every ply walked so far, the defining line first (`walk.ts`). */
  readonly steps: readonly WalkStep[]
  /** Where the first entry, the initial position, points. */
  readonly start: Address
}

export const MoveList = ({ steps, start }: MoveListProps) => {
  const { pathname } = useLocation()
  const translated = useTranslated()
  const lastIndex = steps.length - 1

  return (
    <nav className="move-list" aria-label={translated('learn.plyList').text}>
      <ol className="move-list__plies">
        <li className="move-list__item">
          <Link
            className="move-list__ply move-list__ply--start"
            to={{ pathname, search: addressSearch(start) }}
            aria-current={steps.length === 0 ? 'true' : undefined}
          >
            <Translated id="learn.startingPosition" />
          </Link>
        </li>

        {steps.map((step, index) => (
          <li className="move-list__item" key={addressKey(step.address)}>
            <Link
              className="move-list__ply"
              to={{ pathname, search: addressSearch(step.address) }}
              aria-current={index === lastIndex ? 'true' : undefined}
            >
              {plyLabel(step.ply, step.fen)}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
