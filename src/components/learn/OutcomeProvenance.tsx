import { Link } from 'react-router'
import './OutcomeProvenance.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { CompiledProvenance } from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'

/**
 * Where a claim came from — and the argument this whole ticket implements.
 *
 * A proved forced mate and an author's opinion about a middlegame are not the same kind of
 * statement. If they sit in the same panel with the same weight, the proof machinery does
 * not make the opinion trustworthy: it makes it *look* trustworthy, which is worse than
 * proving nothing at all (docs/CONTEXT.md, *Provenance*). So these are **two components**,
 * not one with a flag, for the same reason `MateOutcome` and `AssessmentOutcome` are — and
 * `MateOutcome` imports only `ProvedNote`, because its `basis` is typed `CompiledProved`
 * and a hand-judged mate is not expressible.
 *
 * Four signals separate them, and **none of them is the hue**:
 *
 * - a different word (`Máy chứng minh` / `Nhận định của người viết`),
 * - a different icon silhouette — a sealed disc against an open nib,
 * - a different **border style**, solid against dashed, which is geometry and survives a
 *   greyscale screenshot exactly as an icon does,
 * - a different structure: a proof names a certificate and links to how it was checked; a
 *   judgement names a person and a date and can never do either.
 *
 * That last one is the one that cannot be faked. `greyscale` in
 * `e2e/outcomes.spec.ts` desaturates the real page and reads all four back.
 */

/** A sealed disc: closed, stamped, and nothing like a nib. */
const ProvedMark = () => (
  <svg
    className="provenance__icon provenance__icon--proved"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M5 8 7.2 10.2 11 5.8" />
  </svg>
)

/** An open nib, drawn with a gap in it, so it is not a disc at any size. */
const JudgementMark = () => (
  <svg
    className="provenance__icon provenance__icon--judgement"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M11.5 2.5 13.5 4.5 5.5 12.5 2.5 13.5 3.5 10.5Z" />
    <path d="M9.5 4.5 11.5 6.5" />
  </svg>
)

/** A dotted ring: an outline where the other two have a body. */
const NoClaimMark = () => (
  <svg
    className="provenance__icon provenance__icon--none"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 2.5 A5.5 5.5 0 0 1 8 13.5 A5.5 5.5 0 0 1 8 2.5" strokeDasharray="2 2.4" />
  </svg>
)

/**
 * A machine proof, naming the certificate a reader can fetch and replay (ADR-0005).
 *
 * The link is the second half of the claim and not decoration: "proved" is a word anyone
 * can type, and what makes it checkable is that the reader can go and read how. The About
 * page is linked without a fragment, deliberately — the explanation there is #7's and #17's
 * copy, and a link into an `id` that ticket has not written yet is a link that lands
 * nowhere. The footer links the same explanation the same way.
 */
export const ProvedNote = ({
  certificate,
  locale,
}: {
  readonly certificate: string
  readonly locale: Locale
}) => (
  <p className="provenance provenance--proved">
    <span className="provenance__label">
      <ProvedMark />
      <Translated id="outcome.proved" />
    </span>{' '}
    <Translated id="outcome.provedNote" />{' '}
    <span className="provenance__certificate">{certificate}</span>
    {'. '}
    <Link to={routePath(locale, routeSegments.about)}>
      <Translated id="outcome.howProved" />
    </Link>
  </p>
)

/**
 * A human's opinion, attributed to the human who holds it.
 *
 * Unverified is stated rather than implied. An evaluation and a plan have no oracle behind
 * them — this project has no engine at runtime and no opening explorer at all — so the note
 * says so in as many words and then names who wrote it and when. `source` is the author's
 * own sentence and gets the full stop that keeps it off the end of the date.
 */
export const JudgementNote = ({
  by,
  at,
  source,
}: {
  readonly by: string
  readonly at: string
  readonly source: string | undefined
}) => (
  <p className="provenance provenance--judgement">
    <span className="provenance__label">
      <JudgementMark />
      <Translated id="outcome.judgement" />
    </span>{' '}
    <Translated id="outcome.judgementNote" /> <span className="provenance__author">{by}</span>
    {', '}
    <time dateTime={at}>{at}</time>
    {source !== undefined && <>. {source}</>}
  </p>
)

/**
 * The provenance of a branch nobody has assessed.
 *
 * `Unexplored` carries no `basis`, because there is no claim to attribute — and the honest
 * rendering of that is to say so, not to leave the slot empty. An outcome with nothing
 * where every other outcome states its source reads as an oversight; this reads as what it
 * is (acceptance criterion 6).
 */
export const NoClaimNote = () => (
  <p className="provenance provenance--none">
    <span className="provenance__label">
      <NoClaimMark />
      <Translated id="outcome.noClaim" />
    </span>{' '}
    <Translated id="outcome.noClaimNote" />
  </p>
)

/**
 * The two arms of `CompiledProvenance`, for the one outcome whose basis is the full union.
 *
 * `AssessmentOutcome` is the only caller. The `proved` arm is not dead code kept for
 * symmetry: the type admits it, and a component that refused to render half of its own
 * input type would be a blank line on the page whose entire argument is that it never hides
 * where a claim came from. Today's build only ever emits the judgement arm for an
 * assessment (`tools/content/validate.ts`), which is a narrowing `CompiledOutcome` could
 * express and does not.
 */
export const AssessmentProvenance = ({
  provenance,
  locale,
}: {
  readonly provenance: CompiledProvenance
  readonly locale: Locale
}) =>
  provenance.basis === 'proved' ? (
    <ProvedNote certificate={provenance.certificate} locale={locale} />
  ) : (
    <JudgementNote by={provenance.by} at={provenance.at} source={provenance.source} />
  )
