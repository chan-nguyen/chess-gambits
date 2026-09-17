import { useId } from 'react'
import './PlanChoices.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { Orientation } from '../board/board-model.ts'
import { ChoiceLink } from './ChoiceLink.tsx'
import { maxShortcutBranches, type ShortcutSetting } from './shortcuts.ts'
import type { BranchChoice } from './tree-path.ts'

/**
 * A learner node that genuinely offers a choice of plans (acceptance criterion 7).
 *
 * The Evans after `5...Ba5` is the fixture: `6.d4` and `6.O-O` are both main lines, and
 * neither is the answer the other is a mistake for. Modelling a learner node with several
 * children is allowed and is a deliberate act (docs/CONTEXT.md, *The central asymmetry*) —
 * so it renders, and it renders as its own thing.
 *
 * **Distinct from `BranchChoices`, and the distinction is the point.** These are the
 * learner's options; those are the opponent's threats. So there is no reply quality here —
 * a prescribed move is not graded and the content validator refuses a `replyQuality` on one
 * — no frequency, since the learner decides how often they play it, and no dismissals,
 * because nothing is being left unanswered: the learner simply picks. What is left is the
 * moves themselves, under a heading that says the gambit branches here on purpose.
 */
export type PlanChoicesProps = {
  readonly choices: readonly BranchChoice[]
  /** The position every plan below is played from, so each preview can mark its own ply. */
  readonly fen: string
  readonly orientation: Orientation
  readonly shortcuts: ShortcutSetting
}

export const PlanChoices = ({ choices, fen, orientation, shortcuts }: PlanChoicesProps) => {
  const headingId = useId()
  const noteId = useId()

  return (
    <section className="plan-choices" aria-labelledby={headingId} aria-describedby={noteId}>
      <h3 className="plan-choices__heading" id={headingId}>
        <Translated id="learn.planHeading" />
      </h3>
      <p className="plan-choices__note" id={noteId}>
        <Translated id="learn.planNote" />
      </p>

      <ol className="plan-choices__list">
        {choices.map((choice, index) => (
          <li className="plan-choices__item" key={choice.ply}>
            <ChoiceLink
              path={choice.path}
              ply={choice.ply}
              fen={choice.node.fen}
              playedFrom={fen}
              orientation={orientation}
              variant="plan"
              shortcut={shortcuts === 'on' && index < maxShortcutBranches ? index + 1 : null}
              isNext={index === 0}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}
