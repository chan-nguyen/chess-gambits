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
  /** Countable branches in the compiled tree. See `CatalogueEntryPayload.branches`. */
  readonly branches: number
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
   * How many branches this entry has to learn, so a catalogue card can say "3 of 12"
   * without downloading a tree.
   *
   * The catalogue downloads **no** entry tree — that is why 1,003 entries cost 25.7KB
   * instead of megabytes, and `e2e/content-loading.spec.ts` asserts it — so the only
   * honest way for a card to show a denominator is for the build to put one here.
   *
   * It is counted by `countableBranches` in `src/components/progress/branches.ts`, the
   * same function the gambit page uses, imported rather than reimplemented. A card and a
   * page disagreeing about how much there is to learn would be worse than neither showing
   * a number, and the only way to guarantee they agree is for there to be one rule.
   *
   * Zero is the honest answer for an entry with no authored tree, which is every entry
   * today: a Tier 0 entry's whole tree is one `unexplored` root and there is nothing in it
   * to have learned.
   */
  readonly branches: number
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
