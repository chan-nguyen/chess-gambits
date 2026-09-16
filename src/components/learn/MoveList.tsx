import { Link, useLocation } from 'react-router'
import './MoveList.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { lineSearch } from '../../lib/line.ts'
import { plyLabel, type PathStep } from './tree-path.ts'

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
 */
export type MoveListProps = {
  readonly steps: readonly PathStep[]
}

export const MoveList = ({ steps }: MoveListProps) => {
  const { pathname } = useLocation()
  const translated = useTranslated()
  const lastIndex = steps.length - 1

  return (
    <nav className="move-list" aria-label={translated('learn.plyList').text}>
      <ol className="move-list__plies">
        <li className="move-list__item">
          <Link
            className="move-list__ply move-list__ply--start"
            to={{ pathname, search: lineSearch([]) }}
            aria-current={steps.length === 0 ? 'true' : undefined}
          >
            <Translated id="learn.startingPosition" />
          </Link>
        </li>

        {steps.map((step, index) => (
          <li className="move-list__item" key={step.path.join('_')}>
            <Link
              className="move-list__ply"
              to={{ pathname, search: lineSearch(step.path) }}
              aria-current={index === lastIndex ? 'true' : undefined}
            >
              {plyLabel(step.ply, step.node.fen)}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
