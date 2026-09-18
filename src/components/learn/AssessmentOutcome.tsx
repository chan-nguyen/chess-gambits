import { useId } from 'react'
import './AssessmentOutcome.css'
import { UntranslatedNotice } from '../../i18n/UntranslatedNotice.tsx'
import { Translated } from '../../i18n/Translated.tsx'
import type { CompiledAnnotation, CompiledJudgement } from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import { localiseAnnotation, type LocalisedProse } from './annotation.ts'

/**
 * Where a line leaves the learner when the opponent defended (docs/design-system.md §3,
 * acceptance criterion 4).
 *
 * **This is the normal outcome for a gambit and it is not a consolation prize.** Most
 * branches of a sound gambit end here and that is the gambit working: a pawn for the
 * initiative, a half-open file, a plan. Nothing in this component's copy or its layout says
 * "no mate": it has the same weight as `MateOutcome`, the heading is about the position
 * rather than about what the position failed to be, and the word "mate" appears nowhere in
 * it — because a position that is merely winning is not a mate and this site never says it
 * is (docs/design-system.md §7, acceptance criterion 7). `outcome-distinction.test.ts` reads all
 * three catalogues and holds that to the shipped strings.
 *
 * **It is a separate component from `MateOutcome`, not a mode of one.** It takes different
 * props — two blocks of localised prose against a move count and a proved line — renders a
 * different structure, and attributes what it says to a person rather than to a certificate.
 * A single component with a `kind` flag would make a proof and an opinion the same object
 * with a different fill, and a proof beside an unlabelled opinion does not make the opinion
 * true, only convincing.
 *
 * **No colour says which way the position goes.** §2 names `--color-advantage`,
 * `--color-equal` and `--color-worse`, and `CompiledOutcome`'s `position` arm carries no
 * field that chooses between them — `evaluation` is prose. Picking one would be the UI
 * asserting a direction the content never stated, which is the exact failure this ticket
 * exists to prevent, so the card is drawn in the neutral text colours and the evaluation
 * says which way it goes in words.
 */
export type AssessmentOutcomeProps = {
  /** Material and position, in the author's words. */
  readonly evaluation: CompiledAnnotation
  /** What to aim at, which pieces matter, what the pawn structure implies. */
  readonly plan: CompiledAnnotation
  /**
   * A judgement and never a proof. `CompiledProved` names a mate certificate (ADR-0005), and
   * there is no certificate for "Black is a pawn down with the initiative" — so the type
   * refuses one here (#45).
   *
   * **Kept in the type and not rendered, as of 2026-09-18.** This component used to render
   * `JudgementNote` — "Nhận định của người viết", the author and the date — under every
   * evaluation; the product owner asked for it gone from the page. The type still narrows
   * `basis` to `CompiledJudgement` rather than widening it back to the full provenance
   * union, because `outcome-distinction.test.ts` holds a compile-time guarantee on exactly
   * this narrowing (a mate is still unable to reach this component's props), and because the
   * data itself — who judged this, and when — is still worth compiling even though nothing
   * on the page shows it today. `docs/CONTEXT.md`, *Provenance*, records the removal and
   * why it is a real trade-off rather than a free one.
   */
  readonly basis: CompiledJudgement
  readonly locale: Locale
}

/** A balance beam — a horizontal bar on a stem, which is not a seal at any size. */
const AssessmentMark = () => (
  <svg
    className="assessment-outcome__mark"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M2.5 4.5h11M8 4.5v9M5 13.5h6" />
    <path d="M2.5 4.5 4.5 9h-4ZM13.5 4.5 15.5 9h-4Z" />
  </svg>
)

/**
 * One labelled block of the assessment.
 *
 * `lang` is set only on fallback, for the reason `AnnotationPanel` gives: a French screen
 * reader pronouncing Vietnamese with French phonetics produces noise, not an accent.
 */
const Block = ({
  label,
  prose,
}: {
  readonly label: 'outcome.evaluation' | 'outcome.plan'
  readonly prose: LocalisedProse
}) => (
  <div className="assessment-outcome__block">
    <h4 className="assessment-outcome__label">
      <Translated id={label} />
    </h4>
    <p className="assessment-outcome__prose" lang={prose.untranslated ? prose.locale : undefined}>
      {prose.text}
      {prose.untranslated && (
        <>
          {' '}
          <UntranslatedNotice />
        </>
      )}
    </p>
  </div>
)

export const AssessmentOutcome = ({ evaluation, plan, locale }: AssessmentOutcomeProps) => {
  const headingId = useId()

  return (
    <section className="assessment-outcome" aria-labelledby={headingId}>
      <h3 className="assessment-outcome__heading" id={headingId}>
        <AssessmentMark />
        <Translated id="outcome.assessmentHeading" />
      </h3>

      <Block label="outcome.evaluation" prose={localiseAnnotation(evaluation, locale)} />
      <Block label="outcome.plan" prose={localiseAnnotation(plan, locale)} />
    </section>
  )
}
