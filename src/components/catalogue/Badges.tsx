import { Link } from 'react-router'
import './Badges.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import type { SoundnessValue, Tier } from '../../lib/content-types.ts'
import type { Locale } from '../../lib/locale.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'
import { aboutAnchors } from './about-anchors.ts'

/**
 * The two labels that make a page honest about itself, and the reason they are links.
 *
 * `TierBadge` **always links to the About page's explanation** (docs/design-system.md §3,
 * AC 9), and `SoundnessBadge` does the same. A one-word label is not an explanation: a
 * visitor reading "Dubious" on a gambit they were about to learn deserves a sentence about
 * what that is a claim about and who made it, and the only honest place to put a sentence
 * that long is a page. A badge that carried the word and no route to the sentence would be
 * jargon with a border around it.
 *
 * They are therefore real links — middle-clickable and copyable (§4) — rather than
 * tooltips, which are "never the only place information exists" (§3) and do not exist at
 * all on a touch device.
 *
 * Neither badge is distinguished by colour alone (§2): each one carries its own word, and
 * that word is the whole of the signal. The tints below are redundant with the text.
 */

const tierKeys: Readonly<Record<Tier, TranslationKey>> = {
  listed: 'tier.listed',
  mapped: 'tier.mapped',
  taught: 'tier.taught',
}

const soundnessKeys: Readonly<Record<SoundnessValue, TranslationKey>> = {
  sound: 'soundness.sound',
  dubious: 'soundness.dubious',
  unsound: 'soundness.unsound',
}

type BadgeProps = {
  readonly locale: Locale
  /** The fragment on the About page that explains this vocabulary. */
  readonly anchor: string
  /** What kind of claim this is, read only by assistive technology. */
  readonly labelKey: TranslationKey
  readonly valueKey: TranslationKey
  /** Modifier suffix, so the tint can differ per value while the wording carries it. */
  readonly variant: string
  readonly kind: 'tier' | 'soundness'
}

/**
 * The visible text is the value alone — "Listed" — because that is what a reader scanning
 * a list of cards needs. The kind of claim is supplied to assistive technology instead, so
 * the link's accessible name is "Coverage: Listed" rather than a bare adjective repeated
 * seven hundred times with no indication of what it describes.
 */
const Badge = ({ locale, anchor, labelKey, valueKey, variant, kind }: BadgeProps) => (
  <Link
    className={`badge badge--${kind} badge--${variant}`}
    to={{ pathname: routePath(locale, routeSegments.about), hash: `#${anchor}` }}
  >
    <span className="visually-hidden">
      <Translated id={labelKey} />{' '}
    </span>
    <Translated id={valueKey} />
  </Link>
)

export type TierBadgeProps = { readonly locale: Locale; readonly tier: Tier }

export const TierBadge = ({ locale, tier }: TierBadgeProps) => (
  <Badge
    locale={locale}
    anchor={aboutAnchors.tiers}
    labelKey="tier.label"
    valueKey={tierKeys[tier]}
    variant={tier}
    kind="tier"
  />
)

export type SoundnessBadgeProps = {
  readonly locale: Locale
  readonly soundness: SoundnessValue
}

export const SoundnessBadge = ({ locale, soundness }: SoundnessBadgeProps) => (
  <Badge
    locale={locale}
    anchor={aboutAnchors.soundness}
    labelKey="soundness.label"
    valueKey={soundnessKeys[soundness]}
    variant={soundness}
    kind="soundness"
  />
)
