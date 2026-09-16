import { withBasePath } from './base-path.ts'
import type { Category, Side, SoundnessValue, Tier } from './content-types.ts'
import type { Locale } from './locale.ts'

/**
 * Fetching the catalogue.
 *
 * One static file per locale — `catalogue.vi.json`, `.en`, `.fr` — so a visitor downloads
 * one language's names rather than three (`docs/design-system.md`, *Catalogue chunking*).
 * The locale-independent fields are identical across the three files, which is accepted
 * duplication: it costs a few kilobytes and saves a second request and a join on the
 * critical path.
 *
 * Everything here mirrors `content.ts` deliberately, for the same reasons. Every failure
 * is a value and nothing throws, because a thrown promise in a lazy boundary is a blank
 * screen and this project has no error reporting to notice one. And the response is
 * checked field by field rather than trusted because our own build wrote it: a static host
 * answering with an HTML 404 page, a truncated response on a flaky mobile connection or a
 * stale service worker all produce something that parses, and none of them produce a
 * catalogue.
 *
 * This module is the data seam only. The catalogue *page* — searching, filtering,
 * expanding a family — is #13.
 */

/**
 * `variation` is a name **relative to its family**: the dataset name with the opening head
 * removed. An empty string means the entry is the family's own root line, and the family
 * name is what the UI shows for it. A name search has to fold the two back together, which
 * is what `fullName` is for.
 */
export type CatalogueEntry = {
  readonly id: string
  readonly variation: string
  readonly eco: string
  readonly category: Category
  readonly side: Side
  readonly soundness: SoundnessValue
  readonly tier: Tier
  /** Space-joined SAN from the standard start position. */
  readonly line: string
}

export type CatalogueFamily = {
  readonly id: string
  readonly name: string
  readonly entries: readonly CatalogueEntry[]
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

export type Catalogue = {
  readonly locale: Locale
  readonly source: { readonly repository: string; readonly commit: string }
  readonly counts: CatalogueCounts
  readonly families: readonly CatalogueFamily[]
}

export const catalogueUrl = (locale: Locale): string =>
  withBasePath(`catalogue/catalogue.${locale}.json`)

/** What a learner reads, and what a name filter matches against. */
export const fullName = (family: CatalogueFamily, entry: CatalogueEntry): string =>
  entry.variation === '' ? family.name : `${family.name}: ${entry.variation}`

export type CatalogueLoadFailure =
  /** The request never completed: no connection, or the request was blocked. */
  | { readonly reason: 'offline' }
  /** The site answered, and has no catalogue for this locale. */
  | { readonly reason: 'missing' }
  /** The site answered with an error status. */
  | { readonly reason: 'unavailable'; readonly status: number }
  /** Something arrived, and it was not a catalogue. */
  | { readonly reason: 'malformed' }

export type CatalogueLoad =
  | { readonly ok: true; readonly catalogue: Catalogue }
  | { readonly ok: false; readonly failure: CatalogueLoadFailure }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number'

const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    allowed.some((candidate) => candidate === value)

const arrayOf =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is readonly T[] =>
    Array.isArray(value) && value.every((item: unknown) => guard(item))

const isSide = oneOf<Side>(['white', 'black'])
const isCategory = oneOf<Category>(['gambit', 'trap'])
const isSoundnessValue = oneOf<SoundnessValue>(['sound', 'dubious', 'unsound'])
const isTier = oneOf<Tier>(['listed', 'mapped', 'taught'])

const isEntry = (value: unknown): value is CatalogueEntry =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.variation) &&
  isString(value.eco) &&
  isCategory(value.category) &&
  isSide(value.side) &&
  isSoundnessValue(value.soundness) &&
  isTier(value.tier) &&
  isString(value.line)

const isFamily = (value: unknown): value is CatalogueFamily =>
  isRecord(value) && isString(value.id) && isString(value.name) && arrayOf(isEntry)(value.entries)

const isCounts = (value: unknown): value is CatalogueCounts =>
  isRecord(value) &&
  isNumber(value.entries) &&
  isNumber(value.gambits) &&
  isNumber(value.traps) &&
  isNumber(value.families) &&
  isNumber(value.listed) &&
  isNumber(value.mapped) &&
  isNumber(value.taught)

const isSource = (value: unknown): value is Catalogue['source'] =>
  isRecord(value) && isString(value.repository) && isString(value.commit)

export const isCatalogue = (value: unknown): value is Catalogue =>
  isRecord(value) &&
  oneOf<Locale>(['vi', 'en', 'fr'])(value.locale) &&
  isSource(value.source) &&
  isCounts(value.counts) &&
  arrayOf(isFamily)(value.families)

export const loadCatalogue = async (locale: Locale): Promise<CatalogueLoad> => {
  let response: Response
  try {
    response = await fetch(catalogueUrl(locale), { headers: { accept: 'application/json' } })
  } catch {
    return { ok: false, failure: { reason: 'offline' } }
  }

  if (response.status === 404) return { ok: false, failure: { reason: 'missing' } }
  if (!response.ok) {
    return { ok: false, failure: { reason: 'unavailable', status: response.status } }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, failure: { reason: 'malformed' } }
  }

  if (!isCatalogue(body)) return { ok: false, failure: { reason: 'malformed' } }
  // A file built for a different locale would show the wrong names under the right URL.
  if (body.locale !== locale) return { ok: false, failure: { reason: 'malformed' } }

  return { ok: true, catalogue: body }
}
