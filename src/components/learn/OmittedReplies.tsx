import { useId } from 'react'
import './OmittedReplies.css'
import { Translated } from '../../i18n/Translated.tsx'
import { UntranslatedNotice } from '../../i18n/UntranslatedNotice.tsx'
import type { CompiledDismissRest, CompiledDismissal } from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import { localiseAnnotation } from './annotation.ts'

/**
 * The affordance that says a disclosure opens.
 *
 * `<summary>` draws its own triangle, and `display: flex` on the summary removes it — which
 * is how "28 other replies" came to look like a sentence nobody could open. A screen reader
 * is told either way, because `<details>` reports its expanded state; this is for everyone
 * else, and it rotates rather than swapping glyph, so the shape is one thing in two states
 * rather than two things to learn.
 */
const Chevron = () => (
  <svg className="omitted__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M6 3 11 8 6 13" />
  </svg>
)

/**
 * The replies this gambit answers without modelling them (acceptance criteria 3 and 4).
 *
 * This is the half of the honesty argument the learner actually sees. At the Evans after
 * `4.b4` thirty-five replies are legal and one is modelled; the other thirty-four are
 * answered by a single catch-all, and that is a defensible answer **only** if the learner
 * is shown that it covers thirty-four. So the count is rendered, and expanding it lists the
 * exact SAN the build derived — not a summary of them, the list, because "34 other replies"
 * with nothing behind it is the same silence in a shorter sentence.
 *
 * Collapsed, because at a node the learner is working through, the modelled replies are the
 * thing and this is the footnote. Collapsed is not hidden: `<details>` is in the tab order,
 * its state is announced, and it is found by the browser's own find-in-page.
 *
 * The two are not the same object and are not presented as one.
 * `dismissRest` is **the site's answer** to those moves, localised, because a learner reads
 * it. `dismissed` is a **maintainer's note** read in a diff, in whatever language the
 * maintainer thinks in (docs/CONTEXT.md, *Dismissal*) — so it is shown under a sentence
 * that says as much, rather than being dressed up as copy that was written for the reader.
 */
export type OmittedRepliesProps = {
  readonly dismissed: readonly CompiledDismissal[]
  readonly dismissRest: CompiledDismissRest | undefined
  readonly locale: Locale
}

export const OmittedReplies = ({ dismissed, dismissRest, locale }: OmittedRepliesProps) => {
  const coveredId = useId()
  const noteId = useId()

  const reason = dismissRest === undefined ? null : localiseAnnotation(dismissRest.reason, locale)
  const covers = dismissRest?.covers ?? []

  return (
    <>
      {dismissRest !== undefined && reason !== null && (
        <details className="omitted omitted--rest">
          <summary className="omitted__summary">
            <Chevron />
            {/* The count and the phrase are one element so that "28 other replies" is one
                string a reader — and a test — can take hold of, rather than three text
                nodes whose only common parent is the whole summary. */}
            <span className="omitted__label">
              <span className="omitted__count">{covers.length}</span>{' '}
              <Translated id={covers.length === 1 ? 'learn.otherReply' : 'learn.otherReplies'} />
            </span>
            {' — '}
            {/* Only on fallback, for the reason `AnnotationPanel` gives: a French reader
                hearing Vietnamese read with French phonetics hears noise, not an accent. */}
            <span lang={reason.untranslated ? reason.locale : undefined}>{reason.text}</span>
            {reason.untranslated && (
              <>
                {' '}
                <UntranslatedNotice />
              </>
            )}
          </summary>

          <p className="omitted__note" id={coveredId}>
            <Translated id="learn.coveredReplies" />
          </p>
          <ul className="omitted__plies" aria-describedby={coveredId}>
            {covers.map((ply) => (
              <li className="omitted__ply" key={ply}>
                {ply}
              </li>
            ))}
          </ul>
        </details>
      )}

      {dismissed.length > 0 && (
        <details className="omitted omitted--dismissed">
          <summary className="omitted__summary">
            <Chevron />
            <span className="omitted__label">
              <span className="omitted__count">{dismissed.length}</span>{' '}
              <Translated
                id={dismissed.length === 1 ? 'learn.dismissedReply' : 'learn.dismissedReplies'}
              />
            </span>
          </summary>

          <p className="omitted__note" id={noteId}>
            <Translated id="learn.maintainerNote" />
          </p>
          <ul className="omitted__reasons" aria-describedby={noteId}>
            {dismissed.map((dismissal) => (
              <li key={dismissal.ply}>
                <span className="omitted__ply">{dismissal.ply}</span>
                {' — '}
                {dismissal.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
