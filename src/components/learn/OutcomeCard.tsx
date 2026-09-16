import type { CompiledOutcome } from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import type { Orientation } from '../board/board-model.ts'
import { AssessmentOutcome } from './AssessmentOutcome.tsx'
import { MateOutcome } from './MateOutcome.tsx'
import { UnexploredOutcome } from './UnexploredOutcome.tsx'

/**
 * What a leaf claims (docs/design-system.md §3, `OutcomeCard`).
 *
 * **This renders no element of its own.** It is a switch over the three-arm union and
 * nothing else — no wrapper, no heading, no shared stylesheet, no props that both arms
 * happen to take. That is deliberate and it is the point of the ticket: the moment this
 * grows a `<section>` around its arms, a proved mate and an author's opinion are one card
 * with a variant, and "two distinct components, not one with a flag" has become a comment.
 * `outcome-distinction.test.ts` holds the line from the source side; the rendering tests
 * hold it from the DOM side.
 *
 * The switch is exhaustive over `CompiledOutcome`. A fourth outcome shape added to
 * `src/lib/content-types.ts` is a compile error here rather than a leaf that renders as
 * nothing — which is exactly the failure that would be invisible in review and silent in
 * production, since the surface simply would not draw the card.
 */
export type OutcomeCardProps = {
  readonly outcome: CompiledOutcome
  /** The leaf's position: the mate arm plays its proved line from it. */
  readonly fen: string
  /** The learner's side at the bottom of any board drawn below. */
  readonly orientation: Orientation
  readonly locale: Locale
}

export const OutcomeCard = ({ outcome, fen, orientation, locale }: OutcomeCardProps) => {
  switch (outcome.kind) {
    case 'mate':
      return (
        <MateOutcome
          inMoves={outcome.inMoves}
          sequence={outcome.sequence}
          provedBy={outcome.provedBy}
          basis={outcome.basis}
          fen={fen}
          orientation={orientation}
          locale={locale}
        />
      )
    case 'position':
      return (
        <AssessmentOutcome
          evaluation={outcome.evaluation}
          plan={outcome.plan}
          basis={outcome.basis}
          locale={locale}
        />
      )
    case 'unexplored':
      return <UnexploredOutcome />
  }
}
