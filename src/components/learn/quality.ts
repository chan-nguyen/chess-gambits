import type { TranslationKey } from '../../i18n/translations.ts'
import type { Frequency, ReplyQuality } from '../../lib/content-types.ts'

/**
 * What a reply's quality and frequency look like when the colour is taken away.
 *
 * **Quality is never conveyed by colour alone** (docs/design-system.md §2, acceptance
 * criterion 2), and that is not a stylistic preference here — it is arithmetic. The five
 * `--color-quality-*` tokens are chosen for hue, and two of them are the *same grey*:
 * `good` and `mistake` sit at a WCAG relative luminance ratio of 1.001 in the light theme,
 * and `best` and `inaccuracy` at 1.004 in the dark one. A learner who cannot separate those
 * hues is not told a good reply from a mistake by the colour at all.
 * `greyscale.test.ts` asserts that collapse against the shipped palette, so the rule stops
 * being a claim about intent and becomes a claim about the pixels.
 *
 * So each quality carries two signals that survive greyscale: a **text label**, and an
 * **icon with its own silhouette**. The silhouettes are deliberately more different than
 * they need to be — a cross is not a chevron with an extra stroke — because the two
 * qualities most likely to be confused are the two a learner most needs to tell apart.
 *
 * Geometry is in an unitless 16-unit viewBox, so nothing here is a length the design
 * system would have to name (§2, and `no-raw-values.test.ts`).
 */

export const QUALITY_LABELS: Readonly<Record<ReplyQuality, TranslationKey>> = {
  best: 'learn.qualityBest',
  good: 'learn.qualityGood',
  inaccuracy: 'learn.qualityInaccuracy',
  mistake: 'learn.qualityMistake',
  blunder: 'learn.qualityBlunder',
}

export const FREQUENCY_LABELS: Readonly<Record<Frequency, TranslationKey>> = {
  common: 'learn.frequencyCommon',
  occasional: 'learn.frequencyOccasional',
  rare: 'learn.frequencyRare',
}

/**
 * One path per quality, stroked rather than filled so the shape reads at icon size.
 *
 * - `best` — two chevrons up, `good` — one. The count is the difference, and it is a count
 *   rather than a size so it survives being drawn small.
 * - `inaccuracy` — a flat bar. Neither up nor down: the reply is playable and gains nothing.
 * - `mistake` — one chevron down, the mirror of `good`.
 * - `blunder` — a cross, which is not a chevron at all. This is the one a trap branch runs
 *   through (docs/CONTEXT.md, invariant 5), so it is the one that must never be mistaken
 *   for a neighbour.
 */
export const QUALITY_SHAPES: Readonly<Record<ReplyQuality, string>> = {
  best: 'M3 8.5 8 3.5 13 8.5 M3 13 8 8 13 13',
  good: 'M3 10.5 8 5.5 13 10.5',
  inaccuracy: 'M3 8 13 8',
  mistake: 'M3 5.5 8 10.5 13 5.5',
  blunder: 'M4 4 12 12 M12 4 4 12',
}
