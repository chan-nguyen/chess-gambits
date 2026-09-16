import { useId } from 'react'
import './UnexploredOutcome.css'
import { Translated } from '../../i18n/Translated.tsx'
import { NoClaimNote } from './OutcomeProvenance.tsx'

/**
 * A branch nobody has mapped yet — a **designed state**, and never a spinner or an error
 * (acceptance criterion 5, requirement F15).
 *
 * That distinction is the whole reason this outcome shape exists. `Unexplored` is what lets
 * half-finished content be committed at all: without it every stopping point in a partly
 * modelled tree would demand a full assessment before the schema accepted it, the smallest
 * unit of content work would be enormous, and a solo maintainer with an enormous minimum
 * unit writes nothing (docs/CONTEXT.md, *Outcome*). Nothing is loading and nothing has gone
 * wrong: the line simply stops, and saying so plainly is the honest rendering.
 *
 * So there is no `aria-busy` here, no `role="alert"`, no `role="status"` and no skeleton.
 * Each of those would tell a screen-reader user that something is in flight or has failed,
 * and both are untrue. `OutcomeCard.test.tsx` asserts their absence, because "it is not a
 * spinner" is a claim to check rather than one to write in a comment.
 *
 * It renders its provenance like every other outcome, and its provenance is that there is
 * no claim to attribute. The slot is filled rather than left blank: an outcome with nothing
 * where the other two state a source reads as an oversight, and this reads as what it is.
 */
/** A dashed outline of a branch that stops: a stem and a gap where the rest would be. */
const UnexploredMark = () => (
  <svg
    className="unexplored-outcome__mark"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 14V9.5C8 7 9.5 5.5 12 5.5" />
    <path d="M8 9.5C8 7 6.5 5.5 4 5.5" strokeDasharray="1.8 2.2" />
    <path d="M12 3.5v4M10 5.5h4" strokeDasharray="1.8 2.2" />
  </svg>
)

export const UnexploredOutcome = () => {
  const headingId = useId()

  return (
    <section className="unexplored-outcome" aria-labelledby={headingId}>
      <h3 className="unexplored-outcome__heading" id={headingId}>
        <UnexploredMark />
        <Translated id="outcome.unexploredHeading" />
      </h3>

      <p className="unexplored-outcome__body">
        <Translated id="outcome.unexploredBody" />
      </p>

      <NoClaimNote />
    </section>
  )
}
