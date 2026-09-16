import './CoverageSummary.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { CatalogueCounts } from '../../lib/catalogue.ts'

/**
 * "1000 listed · 0 mapped · 3 taught", at the top of the catalogue (AC 6).
 *
 * **Per-entry badges make each page honest; only this makes the composition honest**
 * (docs/design-system.md §3). Every gambit page here tells the truth about itself, and a
 * visitor can still leave with a false impression of the whole — seven hundred entries
 * looks like seven hundred lessons until something on the page says how many of them are
 * lessons. This is that sentence, and it is shown unconditionally rather than when the
 * numbers are flattering.
 *
 * One interpolated string rather than three glued fragments, for the reason
 * `useTranslated` gives: the separator and the order are part of the sentence, and a
 * sentence assembled from pieces is only right in the language it was assembled in.
 *
 * The numbers come from the catalogue's own `counts`, which the build computes over every
 * record — so this cannot disagree with the list below it by counting something different.
 */
export type CoverageSummaryProps = { readonly counts: CatalogueCounts }

export const CoverageSummary = ({ counts }: CoverageSummaryProps) => (
  <p className="coverage-summary">
    <span className="visually-hidden">
      <Translated id="catalogue.coverage" />{' '}
    </span>
    <Translated
      id="catalogue.counts"
      values={{ listed: counts.listed, mapped: counts.mapped, taught: counts.taught }}
    />
  </p>
)
