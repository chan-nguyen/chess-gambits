import { Link } from 'react-router'
import './GambitCard.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import type { CatalogueEntry } from '../../lib/catalogue.ts'
import type { Category, Side } from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'
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
   * How many branches of this entry this browser has marked learned.
   *
   * Clamped to the total by the caller's own arithmetic below rather than intersected with
   * the real branch keys, because the catalogue downloads no tree and therefore has no
   * keys to intersect with. The clamp is what stops a mark left behind by renamed content
   * from rendering "21 of 20" — a number that is not merely wrong but visibly impossible.
   * The gambit page does the exact intersection, against the tree it has.
   */
  readonly marked: number
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
     * Suppressed entirely at zero branches, which is every entry today: a Tier 0 entry's
     * whole tree is one `unexplored` root and "0 of 0 branches learned" reads as a defect.
     * The tier badge beside it already says why there is nothing to count.
     */}
    {entry.branches > 0 && (
      <p className="gambit-card__progress">
        <Translated
          id="progress.count"
          values={{ learned: Math.min(marked, entry.branches), total: entry.branches }}
        />
      </p>
    )}
  </li>
)
