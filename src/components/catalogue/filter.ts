import type { Category, Side, SoundnessValue, Tier } from '../../lib/content-types.ts'
import type { Catalogue, CatalogueEntry, CatalogueFamily } from '../../lib/catalogue.ts'
import { fullName } from '../../lib/catalogue.ts'

/**
 * Searching and filtering seven hundred entries, as pure functions over plain data.
 *
 * Kept out of the components for two reasons. The filter has to answer in under 100ms over
 * the **whole** catalogue rather than a sample (AC 3), and a budget that is only measurable
 * by driving a browser is a budget nobody measures; here it is a function a test can call a
 * thousand times. And the matching rules — what "Taught" includes, what a search term is
 * allowed to match — are decisions, not rendering, so they belong somewhere a reader can
 * find all of them at once.
 */

/**
 * How deep an entry has to be to show. A **floor**, not an exact tier: a learner asking for
 * mapped entries wants the taught ones too, because those are mapped and more.
 *
 * `all` is the "show everything listed" toggle. It is a separate value rather than the
 * absence of a filter so that the default — `taught` — can be the absence of one, which is
 * what keeps `/vi/gambits` meaning the depth-first view rather than the raw index
 * (docs/design-system.md, *The catalogue defaults to depth, not to breadth*).
 */
export type TierFloor = 'taught' | 'mapped' | 'all'

export const tierFloors: readonly TierFloor[] = ['taught', 'mapped', 'all']

export type CatalogueFilter = {
  /** Matched against the entry's full name and its ECO code, diacritics folded. */
  readonly q: string
  readonly side: Side | null
  readonly category: Category | null
  readonly soundness: SoundnessValue | null
  readonly tier: TierFloor
  /**
   * A played-move prefix, as ordered SAN plies, matched against `entry.line.split(' ')`'s
   * own leading tokens by deep equality — not a substring or text match, which is what the
   * `q` search above does. `undefined` (the field's absence, which every existing caller
   * gets for free) means this dimension does not narrow anything.
   *
   * The home page (issue #129) is the only caller today. It is a separate field from `q`
   * rather than something folded into it because the two answer different questions: `q`
   * is what a visitor typed, this is what a visitor *played* on a board, and the matching
   * rule for the second is exact-position equality, not text containment.
   */
  readonly movesPrefix?: readonly string[] | undefined
}

/**
 * **The tier filter defaults to Taught.** On day one this site is a handful of taught
 * entries inside seven hundred listed ones, and a visitor who searches three gambits they
 * know, gets three "not yet taught in depth" pages and leaves was told the truth three
 * times and given a false impression once.
 */
export const defaultFilter: CatalogueFilter = {
  q: '',
  side: null,
  category: null,
  soundness: null,
  tier: 'taught',
}

/**
 * Fold a string down to what a person typed into a filter box.
 *
 * **Vietnamese is the source locale and nobody types diacritics into a filter box** (AC 2,
 * docs/CONTEXT.md, *Catalogue*). Someone looking for "Phòng thủ Sicily" types "phong thu
 * sicily", and a filter that answers "no results" to that is a filter that does not work in
 * the language this site is written in.
 *
 * NFD splits a letter into its base and its combining marks, and the marks are then
 * dropped. That covers every Vietnamese vowel, including the horn on ơ and ư, which is a
 * combining character (U+031B) inside the range below.
 *
 * `đ` is the exception and it is why this is not a one-liner: it is a letter in its own
 * right rather than a d with a mark, so NFD leaves it alone and a fold that stopped at
 * combining marks would never match "dong" against "Đông". It is rewritten explicitly, and
 * `toLowerCase` runs first so that only the lowercase form has to be named.
 */
export const fold = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

/**
 * One entry, with everything a filter needs precomputed.
 *
 * Folding seven hundred names on every keystroke is the difference between a filter that
 * answers instantly and one that does not, and the names do not change between keystrokes.
 * This is the whole of the performance work: there is no virtualisation, no debounce and no
 * worker, because measurement said none was needed (`filter.test.ts`, `e2e/catalogue.spec.ts`).
 */
export type IndexedEntry = {
  readonly entry: CatalogueEntry
  /** The name a learner reads, family and variation folded back together. */
  readonly name: string
  /** Folded name and ECO, joined, so a match is one `includes` call. */
  readonly haystack: string
}

export type IndexedFamily = {
  readonly family: CatalogueFamily
  readonly entries: readonly IndexedEntry[]
}

export const indexCatalogue = (catalogue: Catalogue): readonly IndexedFamily[] =>
  catalogue.families.map((family) => ({
    family,
    entries: family.entries.map((entry) => {
      const name = fullName(family, entry)
      return { entry, name, haystack: `${fold(name)} ${fold(entry.eco)}` }
    }),
  }))

const tierOrder: Readonly<Record<Tier, number>> = { listed: 0, mapped: 1, taught: 2 }

const floors: Readonly<Record<TierFloor, number>> = {
  all: tierOrder.listed,
  mapped: tierOrder.mapped,
  taught: tierOrder.taught,
}

export const meetsTier = (tier: Tier, floor: TierFloor): boolean => tierOrder[tier] >= floors[floor]

/**
 * Every filter composes: each one narrows what the others left (AC 1). None of them is a
 * mode that turns the others off, which is what lets a shared URL reproduce a view exactly.
 */
const matches = (indexed: IndexedEntry, filter: CatalogueFilter, needle: string): boolean => {
  const { entry } = indexed
  if (!meetsTier(entry.tier, filter.tier)) return false
  if (filter.side !== null && entry.side !== filter.side) return false
  if (filter.category !== null && entry.category !== filter.category) return false
  if (filter.soundness !== null && entry.soundness !== filter.soundness) return false
  if (filter.movesPrefix !== undefined) {
    const tokens = entry.line.split(' ')
    if (filter.movesPrefix.some((ply, index) => tokens[index] !== ply)) return false
  }
  return needle === '' || indexed.haystack.includes(needle)
}

export type FilterResult = {
  /** Families with at least one match, in catalogue order, each holding only its matches. */
  readonly families: readonly IndexedFamily[]
  readonly entries: number
}

export const applyFilter = (
  index: readonly IndexedFamily[],
  filter: CatalogueFilter,
): FilterResult => {
  const needle = fold(filter.q.trim())

  const families: IndexedFamily[] = []
  let entries = 0

  for (const family of index) {
    const kept = family.entries.filter((indexed) => matches(indexed, filter, needle))
    if (kept.length > 0) {
      families.push({ family: family.family, entries: kept })
      entries += kept.length
    }
  }

  return { families, entries }
}

/**
 * How many matches a narrowing filter may auto-expand before the families stay collapsed.
 *
 * **This number is measured, not chosen.** `docs/design-system.md` says to virtualise the
 * list only if measurement shows it is needed, so the page was built without any cap and
 * then measured in Chrome against the real seven-hundred-entry catalogue. From a term that
 * matched nothing, one keystroke to a term matching the whole catalogue took 91, 95 and
 * 105ms to repaint — at or over AC 3's 100ms budget on a developer machine, and this
 * product's target device is a mid-tier phone. Twenty-two matches took 5ms; the cost is
 * the cards, and it is close to linear in them.
 *
 * The fix is not virtualisation. A search that returns six hundred results has not narrowed
 * anything, and nobody scans six hundred cards — the grouped index is the better answer to
 * it, and it is one click from being opened, with every family's match count on the button.
 * A hundred is where "show me what I searched for" stops being what a visitor means; it
 * repaints in about fifteen milliseconds, which leaves room for a phone.
 */
export const autoExpandLimit = 100

/** True when anything at all is narrowing the list, so the UI can offer to stop. */
export const isNarrowed = (filter: CatalogueFilter): boolean =>
  filter.q.trim() !== '' ||
  filter.side !== null ||
  filter.category !== null ||
  filter.soundness !== null ||
  filter.tier !== 'all' ||
  (filter.movesPrefix?.length ?? 0) > 0
