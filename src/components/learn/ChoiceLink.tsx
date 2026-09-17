import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import './ChoiceLink.css'
import { Translated } from '../../i18n/Translated.tsx'
import { lineSearch } from '../../lib/line.ts'
import type { Orientation } from '../board/board-model.ts'
import { BoardPreview } from './BoardPreview.tsx'
import { lastPlyBetween } from './last-ply.ts'
import { plyLabel } from './tree-path.ts'

/**
 * One continuation, as a control a learner can press (acceptance criteria 5, 8 and 9).
 *
 * **A link, not a button** (docs/design-system.md §4). Selecting a reply is a navigation to
 * a position that already has a URL, so it must be middle-clickable and copyable like every
 * other move in this product; a button would be a state change pretending to be one.
 *
 * Shared by `BranchChoices` and `PlanChoices` because the *mechanics* are the same — a
 * preview, a SAN label, a numeric shortcut and a 44px target. What is not shared is what the
 * two mean, which is why the metadata comes in as `children` and the variant is in the class
 * name: an opponent's reply is a threat to be ready for and a learner's plan is a choice to
 * make, and they must not read as the same thing.
 */
export type ChoiceLinkProps = {
  readonly path: readonly string[]
  readonly ply: string
  readonly fen: string
  /**
   * The position this continuation is played *from* — the node the learner is standing on.
   *
   * Two positions are what name a ply's two squares, so the preview needs the one behind it
   * as well as its own (`last-ply.ts`). It is the same value for every choice in a list,
   * which is why it arrives as one prop from the surface rather than being carried per
   * choice: a list where one preview could be drawn against a different origin than its
   * neighbours would be a bug with no symptom.
   */
  readonly playedFrom: string
  readonly orientation: Orientation
  readonly variant: 'reply' | 'plan'
  /**
   * The `1`-`9` key that reaches this choice, or null past the ninth and whenever the
   * shortcuts are switched off. Null renders no badge at all: a key cap printed on a
   * control that no longer responds is worse than no key cap (WCAG 2.2 2.1.4).
   */
  readonly shortcut: number | null
  /**
   * True for the choice `next` also leads to, so the two controls do not disagree.
   *
   * Its wording deliberately avoids containing the navigator's own label: this text joins
   * the choice's accessible name, and a name that contains "next position" makes every
   * query for the next *control* match a reply as well.
   */
  readonly isNext: boolean
  /** The provenance note this choice's judgements are attributed to. */
  readonly describedBy?: string | undefined
  /** Quality, frequency and anything else the variant wants under the SAN. */
  readonly children?: ReactNode
}

export const ChoiceLink = ({
  path,
  ply,
  fen,
  playedFrom,
  orientation,
  variant,
  shortcut,
  isNext,
  describedBy,
  children,
}: ChoiceLinkProps) => {
  const { pathname } = useLocation()

  return (
    <Link
      className={`choice-link choice-link--${variant}`}
      to={{ pathname, search: lineSearch(path) }}
      aria-describedby={describedBy}
    >
      {/*
       * Each preview marks its own candidate reply (issue #54, AC 3).
       *
       * The alternative was to leave every preview unmarked on the grounds that eight or
       * twelve highlighted boards at once are noise. They are not, because the noise
       * argument counts highlights per *screen* and a learner reads these one board at a
       * time: each preview carries exactly one move's mark, which is the fewest a board
       * showing a move can carry. What is genuinely hard here is the opposite problem —
       * every reply to the same position differs from its siblings by one piece, so an
       * unmarked column of previews is the worst find-the-difference task on the site, and
       * it is repeated once per reply.
       *
       * The mark means the same thing on every board on this page: the ply that produced
       * the position you are looking at. On the main board that position is the current
       * one and on a preview it is a candidate one, and nothing about the mark has to
       * carry that difference — the SAN beside it, the heading above it and the fact that
       * it is inside a link already do.
       */}
      <BoardPreview
        fen={fen}
        orientation={orientation}
        lastMove={lastPlyBetween(playedFrom, fen)}
      />

      <span className="choice-link__detail">
        <span className="choice-link__ply">
          {/*
           * Numbered the way a scoresheet is, and never localised (§7). The badge beside it
           * is decoration for the keyboard: the number is not part of the move's name, so
           * a screen reader reading "1 3...Ba5" would be reading a move that does not exist.
           */}
          {shortcut !== null && (
            <kbd className="choice-link__shortcut" aria-hidden="true">
              {shortcut}
            </kbd>
          )}
          {plyLabel(ply, fen)}
        </span>

        {children}

        {isNext && (
          <span className="choice-link__is-next">
            <Translated id="learn.nextGoesHere" />
          </span>
        )}
      </span>
    </Link>
  )
}
