import { useId } from 'react'
import './MateOutcome.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { CompiledProved } from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import { MateNet } from './MateNet.tsx'
import { ProvedNote } from './OutcomeProvenance.tsx'

/**
 * A checkmate this site has proved (docs/design-system.md §3, acceptance criterion 2).
 *
 * **This and `AssessmentOutcome` are two components on purpose**, and the separation is the
 * spine of the product rather than a style preference. They do not share a shell, a
 * stylesheet, a heading or a sentence; they take different props, because a proved mate and
 * an author's opinion are different claims and a component that could render either with a
 * flag flipped would be a component that treats them as the same claim in two colours.
 *
 * The type carries the argument the rest of the way. `basis` here is `CompiledProved`, not
 * the `CompiledProvenance` union — so a mate arriving over the wire with a *judgement* behind
 * it is not merely refused at runtime, it is unconstructable (`src/lib/content-types.ts`),
 * and this component imports only `ProvedNote`. There is no code path from here to the
 * sentence "one author's judgement", which is what it means for the honesty rule to be held
 * by the types rather than by everybody remembering.
 *
 * Three things are stated, in this order, and each is required by acceptance criterion 2:
 * the **count**, in moves; the **forced line**, through `MateNet`; and **how it was proved**,
 * as a certificate name and a link to the About page's explanation of what that certificate
 * had to survive.
 *
 * **Since #123, this also owns the checkmate flag.** #121/#122 put it inside `MateNet`,
 * because `MateNet` was where "which step is the board showing" lived. That is no longer
 * true — the main board and `walk.ts` own the current step now, `MateNet` is a plain list of
 * links into it, and `OutcomeCard` renders no element of its own by design (its own doc
 * comment says why: a fourth arm must stay a compile error, not a wrapper to extend). This
 * component is what is left that (a) renders an element and (b) already receives `sequence`
 * and the current `step`, so it is where "has the walk reached the true end" is answered.
 */
export type MateOutcomeProps = {
  /** Moves, never plies. A mate in N runs to `2N - 1` plies (docs/CONTEXT.md, *Ply*). */
  readonly inMoves: number
  /** The longest line in the proved net, in plies from this leaf. */
  readonly sequence: readonly string[]
  readonly provedBy: 'search' | 'modelled-net'
  readonly basis: CompiledProved
  /** The leaf's position, which is where the proved line starts. */
  readonly fen: string
  /** The leaf's own `line` path, so `MateNet` can link each ply to its own `mate` address. */
  readonly leaf: readonly string[]
  /** How many plies of `sequence` the walk has played: 0 at the leaf's own `line` address. */
  readonly step: number
  readonly locale: Locale
}

/** A stamped seal, closed and heavy. It is the mark a proof carries and nothing else does. */
const MateMark = () => (
  <svg className="mate-outcome__mark" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M8 1.5 14 4.2V8c0 3.4-2.4 5.6-6 6.5C4.4 13.6 2 11.4 2 8V4.2Z" />
    <path d="M5.2 8 7.3 10.1 10.9 6" />
  </svg>
)

export const MateOutcome = ({
  inMoves,
  sequence,
  provedBy,
  basis,
  fen,
  leaf,
  step,
  locale,
}: MateOutcomeProps) => {
  const headingId = useId()
  const atEnd = step === sequence.length

  return (
    <section className="mate-outcome" aria-labelledby={headingId}>
      {/*
       * `h3`, under the annotation panel's `h2` and at the same level as the replies: what
       * a line ends in is a subsection of the position, not of the page
       * (docs/design-system.md §5, no level skipped).
       */}
      <h3 className="mate-outcome__heading" id={headingId}>
        <MateMark />
        <Translated id="outcome.mateHeading" values={{ moves: inMoves }} />
      </h3>

      <p className="mate-outcome__forced">
        <Translated id="outcome.mateForced" />
      </p>

      <MateNet fen={fen} leaf={leaf} sequence={sequence} provedBy={provedBy} step={step} />

      {/*
       * The accessible flag the final frame needs (#121), moved here from `MateNet` by #123:
       * `atEnd` is `step === sequence.length`, which is exactly "the real board on screen
       * right now is the actual checkmated position", regardless of how the learner got here
       * — pressing next repeatedly, jumping straight to the last ply in the list, a bookmark,
       * or browser back/forward. `role="status"` rather than a plain paragraph so a screen
       * reader announces it the moment `next` reaches it, exactly once.
       */}
      {atEnd && (
        <p className="mate-outcome__checkmate" role="status">
          <Translated id="outcome.mateReached" />
        </p>
      )}

      <ProvedNote certificate={basis.certificate} locale={locale} />
    </section>
  )
}
