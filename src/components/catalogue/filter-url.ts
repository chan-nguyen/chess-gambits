import type { Category, Side, SoundnessValue } from '../../lib/content-types.ts'
import { defaultFilter, type CatalogueFilter, type TierFloor } from './filter.ts'

/**
 * The filter, in the URL and nowhere else.
 *
 * **Every piece of view state is in the URL** (docs/design-system.md §1), and for a filter
 * that is not a stylistic preference: a catalogue of seven hundred entries is only useful
 * if "here, look at this" is a link. So this module is the whole of the filter's state —
 * there is no `useState` behind it that could disagree with the address bar, and the back
 * button steps through filters because it steps through URLs.
 *
 * A URL is attacker-controlled (docs/security.md, B4). Every value is checked against its
 * closed set on the way in, and anything else is read as "not filtered" rather than as an
 * error: a person who edits `?side=wihte` by hand wants the catalogue, not a diagnostic.
 */

export const filterParams = {
  q: 'q',
  side: 'side',
  category: 'category',
  soundness: 'soundness',
  tier: 'tier',
} as const

const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: string | null): T | null =>
    allowed.find((candidate) => candidate === value) ?? null

const readSide = oneOf<Side>(['white', 'black'])
const readCategory = oneOf<Category>(['gambit', 'trap'])
const readSoundness = oneOf<SoundnessValue>(['sound', 'dubious', 'unsound'])
const readTierFloor = oneOf<TierFloor>(['taught', 'mapped', 'all'])

/**
 * A query long enough to be a payload rather than a search term is truncated rather than
 * refused. Nothing legitimate approaches it — the longest name in the catalogue is 75
 * characters — and the value is rendered back into the search box, so it is bounded before
 * it is put anywhere.
 */
export const maxQueryLength = 120

export const readFilter = (params: URLSearchParams): CatalogueFilter => ({
  q: (params.get(filterParams.q) ?? '').slice(0, maxQueryLength),
  side: readSide(params.get(filterParams.side)),
  category: readCategory(params.get(filterParams.category)),
  soundness: readSoundness(params.get(filterParams.soundness)),
  /**
   * The default when the parameter is absent **or unreadable**, and it is `taught` rather
   * than `all` on purpose (`filter.ts`, `defaultFilter`). A bare `/vi/gambits` is the
   * depth-first view; the breadth of the index is something a visitor asks for.
   */
  tier: readTierFloor(params.get(filterParams.tier)) ?? defaultFilter.tier,
})

/**
 * The parameters for a filter, with the defaults left out.
 *
 * Omitting them is what keeps the shared link short and, more importantly, what keeps
 * `/vi/gambits` and `/vi/gambits?tier=taught` the same view rather than two spellings that
 * could drift apart. Round-tripping is asserted in `filter-url.test.ts`.
 */
export const writeFilter = (filter: CatalogueFilter): URLSearchParams => {
  const params = new URLSearchParams()

  /**
   * Written **exactly as typed**, and only the decision to write it at all looks at the
   * trimmed form. The URL is the search box's only state, so every keystroke goes out
   * through here and comes back through `readFilter`; a trim on the way out would delete
   * the space in "evans gambit" the instant it was typed and leave the next letter stuck
   * to the previous word. Trimming belongs where the term is *matched* — `applyFilter`
   * does it — not where it is stored.
   */
  if (filter.q.trim() !== '') params.set(filterParams.q, filter.q)
  if (filter.side !== null) params.set(filterParams.side, filter.side)
  if (filter.category !== null) params.set(filterParams.category, filter.category)
  if (filter.soundness !== null) params.set(filterParams.soundness, filter.soundness)
  if (filter.tier !== defaultFilter.tier) params.set(filterParams.tier, filter.tier)

  return params
}
