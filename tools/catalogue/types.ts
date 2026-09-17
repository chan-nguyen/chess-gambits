import type { Category, Locale, Side, SoundnessValue, Tier } from '../content/types.ts'

/**
 * The catalogue's own types.
 *
 * `Side`, `Category`, `SoundnessValue`, `Tier` and `Locale` are imported from the content
 * model rather than restated: a catalogue that disagreed with a compiled entry about what
 * a side or a tier is would be a second, weaker source of truth for the same words.
 *
 * Build-time only, except for the emitted payload shapes, which are what the browser
 * downloads and are mirrored by a hand-written guard in `src/lib/catalogue.ts`.
 */

export type { Category, Locale, Side, SoundnessValue, Tier }

export const LOCALES: readonly Locale[] = ['vi', 'en', 'fr']

/** Everything this tool refuses, as a value. Nothing here throws on bad input. */
export type CatalogueIssue = {
  /** The file, and the row or rule inside it, so a failure names what to edit. */
  readonly where: string
  readonly message: string
}

export type CatalogueResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly CatalogueIssue[] }

/** One assembled catalogue entry, before it is split per locale. */
export type CatalogueRecord = {
  readonly id: string
  /** The canonical English name, in full. */
  readonly name: string
  /** The opening this entry belongs to — the dataset name's head (docs/CONTEXT.md, Family). */
  readonly family: string
  /** The name relative to the family; empty where the entry is the family's root line. */
  readonly variation: string
  readonly eco: string
  readonly category: Category
  readonly side: Side
  readonly soundness: SoundnessValue
  readonly tier: Tier
  readonly definingLine: readonly string[]
  /** Countable branch keys of the compiled tree. See `CatalogueEntryPayload.branchKeys`. */
  readonly branchKeys: readonly string[]
}

/**
 * The emitted shapes. Deliberately terse: this is the one payload whose budget is stated
 * in absolute terms rather than per route (docs/design-system.md §6).
 */

/**
 * `variation` is the entry's name **relative to its family** — the dataset name with the
 * family head removed. An empty string means the entry is the family's own root line, and
 * the UI renders the family name for it. The full name is `family.name` plus this, which
 * is also how a name search has to fold them back together.
 */
export type CatalogueEntryPayload = {
  readonly id: string
  readonly variation: string
  readonly eco: string
  readonly category: Category
  readonly side: Side
  readonly soundness: SoundnessValue
  readonly tier: Tier
  /** Space-joined SAN, from the standard start position. */
  readonly line: string
  /**
   * **The branch keys themselves, not a count of them** — so a catalogue card can say
   * "3 of 12" without downloading a tree, and reach the 3 by the arithmetic the gambit
   * page uses rather than by an approximation of it.
   *
   * This used to be `branches: number`, and a number is not enough. A card handed a total
   * can only clamp the marks it finds in storage against it (`Math.min`), while the page
   * *intersects* those marks with the keys its tree actually has. One stale key in storage
   * — which is what content churn leaves behind — and the card read "1 of 1" where the
   * page read "0 of 1" (issue #48). Clamping stops the visibly impossible "21 of 20" and
   * replaces it with a wrong number that looks right, on the one display whose whole
   * purpose is to be believed.
   *
   * Keys make both sides run `learnedCount` over the same set, so they agree by
   * construction rather than by two rules that happen to coincide.
   *
   * **What that costs, measured rather than assumed.** Still no tree: no FENs, no
   * annotations, no outcomes — only the line identifiers, which are the same strings
   * `?line=` already carries. Over the 1,003 shipped entries it is **+223 bytes gzipped,
   * 26.0KB → 26.3KB of the 100KB budget** (§6). `budget.ts` measures every build and
   * `e2e/catalogue-payload.spec.ts` measures what ships. The growth axis is real and worth
   * watching: extrapolated to *every* entry taught at seven branches each the payload
   * reads about 62KB, and about 92KB at fifteen — inside the budget, with the headroom
   * the tripwire in `docs/PROJECT-PLAN.md` exists to defend.
   *
   * Counted by `countableBranches` in `src/components/progress/branches.ts`, imported
   * rather than reimplemented: one rule, applied once.
   *
   * The empty array is the honest answer for an entry with no authored tree, which is
   * 1,000 of them today: a Tier 0 entry's whole tree is one `unexplored` root and there is
   * nothing in it to have learned.
   */
  readonly branchKeys: readonly string[]
}

export type CatalogueFamilyPayload = {
  readonly id: string
  readonly name: string
  readonly entries: readonly CatalogueEntryPayload[]
}

export type CatalogueCounts = {
  readonly entries: number
  readonly gambits: number
  readonly traps: number
  readonly families: number
  readonly listed: number
  readonly mapped: number
  readonly taught: number
}

export type CataloguePayload = {
  readonly locale: Locale
  /** The dataset snapshot this was generated from, so a stale deploy is diagnosable. */
  readonly source: { readonly repository: string; readonly commit: string }
  readonly counts: CatalogueCounts
  readonly families: readonly CatalogueFamilyPayload[]
}
