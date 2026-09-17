import { Link } from 'react-router'
import './GambitCard.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import type { CatalogueEntry } from '../../lib/catalogue.ts'
import type { Category, Side } from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'
import { learnedCount } from '../progress/branches.ts'
import { SoundnessBadge, TierBadge } from './Badges.tsx'

/**
 * One catalogue entry: name, ECO, side, kind, soundness, tier and progress (§3).
 *
 * **The card is not one big link.** The two badges have to link to the About page's
 * explanation (AC 9) and a link inside a link is not markup a browser can represent — but
 * the better reason is that a card-sized link would take all six of these facts into its
 * accessible name, and a screen-reader user tabbing the catalogue would hear the entire
 * card read out for each one. The name is the link; everything else is text beside it.
 *
 * Nothing on this card is carried by colour (§2). Side and kind are words, and so is every
 * badge.
 */
export type GambitCardProps = {
  readonly locale: Locale
  /** Family and variation already folded together, as `fullName` does it. */
  readonly name: string
  readonly entry: CatalogueEntry
  /**
   * The branch keys this browser has stored against this entry — **as stored**, stale ones
   * included. Not a count, and not a list anyone has filtered on the way in.
   *
   * Raw on purpose. The filtering is the part that has to match the gambit page, so it
   * happens here, with `learnedCount`, against the keys the build baked into the entry. A
   * caller that pre-counted would be a second answer to the question this card and that
   * page have to answer identically.
   *
   * This was a number until issue #48, clamped to the total with `Math.min`. The clamp
   * stopped the visibly impossible "21 of 20" that a mark outliving its branch would print,
   * and the cost it never named is what it printed instead: one stale key against one real
   * branch, and the card read "1 of 1" where the page read "0 of 1" — wrong, and with
   * nothing about it to notice. Intersecting cannot exceed the total either, and it is the
   * page's arithmetic rather than an approximation of it.
   */
  readonly marked: readonly string[]
}

const sideKeys: Readonly<Record<Side, TranslationKey>> = {
  white: 'catalogue.white',
  black: 'catalogue.black',
}

const categoryKeys: Readonly<Record<Category, TranslationKey>> = {
  gambit: 'catalogue.gambit',
  trap: 'catalogue.trap',
}

export const GambitCard = ({ locale, name, entry, marked }: GambitCardProps) => (
  <li className="gambit-card">
    <Link className="gambit-card__name" to={routePath(locale, routeSegments.catalogue, entry.id)}>
      {name}
    </Link>

    <p className="gambit-card__facts">
      {/*
       * "C51" alone is four characters of context-free text. The prefix is hidden because
       * a sighted reader already knows what a code in that column is, and spoken because
       * a screen-reader user does not.
       */}
      <span className="gambit-card__eco">
        <span className="visually-hidden">
          <Translated id="catalogue.eco" />{' '}
        </span>
        {entry.eco}
      </span>
      <span>
        <Translated id={sideKeys[entry.side]} />
      </span>
      <span>
        <Translated id={categoryKeys[entry.category]} />
      </span>
    </p>

    <p className="gambit-card__badges">
      <SoundnessBadge locale={locale} soundness={entry.soundness} />
      <TierBadge locale={locale} tier={entry.tier} />
    </p>

    {/*
     * A count, never a percentage (§3), and the same sentence the gambit page shows —
     * `progress.count` is one string used in both places, so a card and the page it links
     * to cannot word the same fact differently.
     *
     * Suppressed entirely at zero branches, which is 1,000 of the 1,003 entries: a Tier 0
     * entry's whole tree is one `unexplored` root and "0 of 0 branches learned" reads as a
     * defect. The tier badge beside it already says why there is nothing to count.
     *
     * `learnedCount` is the gambit page's own numerator, run here over the keys the build
     * baked in — which is what makes "the same sentence" true of the numbers and not only
     * of the wording (`card-and-page-agree.test.tsx`).
     */}
    {entry.branchKeys.length > 0 && (
      <p className="gambit-card__progress">
        <Translated
          id="progress.count"
          values={{
            learned: learnedCount(entry.branchKeys, new Set(marked)),
            total: entry.branchKeys.length,
          }}
        />
      </p>
    )}
  </li>
)
