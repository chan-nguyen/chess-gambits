import { useId } from 'react'
import './BranchChoices.css'
import { Translated } from '../../i18n/Translated.tsx'
import type {
  CompiledDismissRest,
  CompiledDismissal,
  CompiledProvenance,
  Frequency,
  ReplyQuality,
} from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import type { Orientation } from '../board/board-model.ts'
import { ChoiceLink } from './ChoiceLink.tsx'
import { OmittedReplies } from './OmittedReplies.tsx'
import { FREQUENCY_LABELS, QUALITY_LABELS, QUALITY_SHAPES } from './quality.ts'
import { maxShortcutBranches, type ShortcutSetting } from './shortcuts.ts'
import type { BranchChoice } from './tree-path.ts'

/**
 * Every reply the opponent might actually play (requirement F5, acceptance criterion 1).
 *
 * This is the screen the product exists for. At an opponent node the learner controls
 * nothing, so "what if my opponent plays something else?" is not an edge case — it is the
 * question, and the only honest answer is the whole list: the replies that are modelled,
 * the ones a maintainer set aside, and the catch-all that answers the rest.
 *
 * Three things are asserted here rather than assumed.
 *
 * - **Quality is never colour alone** (§2). Every quality carries an icon with its own
 *   silhouette and a text label; see `quality.ts` for the two palette pairs that are
 *   literally the same grey, which is why this is arithmetic and not taste.
 * - **Provenance is stated once, and every choice points at it.** A reply's quality and
 *   frequency are unverified human judgement — `frequency` especially, since opening
 *   statistics are out of scope by design (docs/CONTEXT.md, *Provenance*) — and invariant
 *   7b records that judgement per entry rather than per child, because per-child provenance
 *   is unauthorable. So the note is rendered once and each choice carries it through
 *   `aria-describedby`: the attribution is in every choice's accessible description without
 *   the same sentence being printed under every board.
 * - **An omission the learner can see is honest.** `OmittedReplies` below is not an extra;
 *   it is the half of invariant 7a a learner ever meets.
 */
export type BranchChoicesProps = {
  readonly choices: readonly BranchChoice[]
  readonly dismissed: readonly CompiledDismissal[]
  readonly dismissRest: CompiledDismissRest | undefined
  /** The learner's side sits at the bottom of every preview, as on the main board. */
  readonly orientation: Orientation
  readonly locale: Locale
  /** The entry-level judgement every quality and frequency below is attributed to. */
  readonly judgement: CompiledProvenance
  /** Off means no key caps are drawn: see `ChoiceLink`. */
  readonly shortcuts: ShortcutSetting
}

/**
 * A quality, twice over: a shape and a word. Neither is the colour, and either one alone
 * would still identify it (acceptance criterion 2).
 */
const QualityBadge = ({ quality }: { readonly quality: ReplyQuality | undefined }) => (
  <span className={`quality-badge quality-badge--${quality ?? 'unstated'}`}>
    {quality !== undefined && (
      <svg className="quality-badge__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d={QUALITY_SHAPES[quality]} />
      </svg>
    )}
    <span className="visually-hidden">
      <Translated id="learn.replyQuality" />
      {': '}
    </span>
    <Translated id={quality === undefined ? 'learn.notStated' : QUALITY_LABELS[quality]} />
  </span>
)

/**
 * How often a reply turns up — and a reminder, in the accessible name, of *what* the word
 * is measuring. "Rare" on its own beside a move is ambiguous in a way "Frequency: rare" is
 * not, and the prefix costs nothing on screen.
 */
const FrequencyTag = ({ frequency }: { readonly frequency: Frequency | undefined }) => (
  <span className="frequency-tag">
    <span className="visually-hidden">
      <Translated id="learn.frequency" />
      {': '}
    </span>
    <Translated id={frequency === undefined ? 'learn.notStated' : FREQUENCY_LABELS[frequency]} />
  </span>
)

/**
 * Where a judgement came from, in the two shapes provenance has.
 *
 * The `proved` branch is not dead code kept for symmetry: `CompiledProvenance` is a union
 * and an entry whose judgement arrived as a certificate is expressible, so refusing to
 * render it would be a blank line on a page whose whole argument is that it does not hide
 * where a claim came from.
 */
const ProvenanceNote = ({
  provenance,
  id,
}: {
  readonly provenance: CompiledProvenance
  readonly id: string
}) => (
  <p className="branch-choices__provenance" id={id}>
    {provenance.basis === 'proved' ? (
      <>
        <Translated id="learn.provedBy" />{' '}
        <span className="branch-choices__certificate">{provenance.certificate}</span>
      </>
    ) : (
      <>
        <Translated id="learn.judgementNote" />{' '}
        <span className="branch-choices__author">{provenance.by}</span>
        {', '}
        <time dateTime={provenance.at}>{provenance.at}</time>
        {/* A full stop, because `source` is the author's own sentence and without one it
            runs into the date: "chan, 2026-09-16 No engine and no opening explorer". */}
        {provenance.source !== undefined && <>. {provenance.source}</>}
      </>
    )}
  </p>
)

export const BranchChoices = ({
  choices,
  dismissed,
  dismissRest,
  orientation,
  locale,
  judgement,
  shortcuts,
}: BranchChoicesProps) => {
  const headingId = useId()
  const provenanceId = useId()

  return (
    <section className="branch-choices" aria-labelledby={headingId}>
      <h3 className="branch-choices__heading" id={headingId}>
        <Translated id="learn.branchHeading" />
      </h3>

      {choices.length === 0 ? (
        <p className="branch-choices__empty">
          <Translated id="learn.noRepliesModelled" />
        </p>
      ) : (
        <ol className="branch-choices__list">
          {choices.map((choice, index) => (
            <li className="branch-choices__item" key={choice.ply}>
              <ChoiceLink
                path={choice.path}
                ply={choice.ply}
                fen={choice.node.fen}
                orientation={orientation}
                variant="reply"
                shortcut={shortcuts === 'on' && index < maxShortcutBranches ? index + 1 : null}
                isNext={index === 0}
                describedBy={provenanceId}
              >
                <span className="branch-choices__meta">
                  <QualityBadge quality={choice.node.replyQuality} />
                  <FrequencyTag frequency={choice.node.frequency} />
                </span>
              </ChoiceLink>
            </li>
          ))}
        </ol>
      )}

      {choices.length > 0 && <ProvenanceNote provenance={judgement} id={provenanceId} />}

      <OmittedReplies dismissed={dismissed} dismissRest={dismissRest} locale={locale} />
    </section>
  )
}
