import type { FrozenEntry, FrozenIds } from './source.ts'
import type { CatalogueIssue } from './types.ts'

/**
 * Frozen ids — invariant 9, and the one check in this tool whose absence would be
 * invisible.
 *
 * An id appears in a URL. The dataset revises opening names between releases, so an id
 * regenerated from the current name changes when upstream renames an entry, and **every
 * shared link to that gambit 404s in a build that passes every other check** — no test
 * fails, no page looks wrong, and nobody finds out except the person whose link broke.
 *
 * So ids are not derived at build time at all. `ids.json` maps `id -> (name, eco,
 * definingLine)` and the build only ever *reads* it, keyed on the **defining line**: the
 * moves are what identifies an opening, and they are the part upstream does not rewrite
 * for style. A renamed entry keeps its id because the line still matches; the new name
 * becomes its display name and nothing else changes.
 *
 * Two gates follow, and both fail the build:
 *
 * 1. An entry with no frozen id is refused rather than given one. `catalogue:freeze` mints
 *    ids, in its own commit, where the diff is a list of additions a human reads.
 * 2. A frozen id that no longer appears in the catalogue is refused. That is a dataset
 *    rename that this scheme failed to absorb, or a row upstream deleted, and either way
 *    it is a decision a person makes and records — not a silent 404.
 *
 * Build-time only.
 */

const MAX_ID_LENGTH = 64

const COMBINING_MARKS = /\p{M}/gu

/** Dropped rather than replaced: `King's Gambit` reads better as `kings-gambit`. */
const APOSTROPHES = /['\u2018\u2019]/g

/**
 * Letters NFD does not decompose, because they are letters in their own right rather than
 * a base plus a mark. Without these, `Hjørring` slugs to `hj-rring`.
 */
const TRANSLITERATIONS: readonly (readonly [RegExp, string])[] = [
  [/ø/g, 'o'],
  [/æ/g, 'ae'],
  [/œ/g, 'oe'],
  [/ß/g, 'ss'],
  [/ł/g, 'l'],
  [/đ/g, 'd'],
  [/ð/g, 'd'],
  [/þ/g, 'th'],
]

const transliterate = (value: string): string =>
  TRANSLITERATIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  )

/** The line is the identity. Spelling is canonical SAN, so this is stable. */
export const lineKey = (line: readonly string[]): string => line.join(' ')

/** Cut at a word boundary where possible, so a truncated id still reads as a name. */
const truncate = (slug: string, limit: number): string => {
  if (slug.length <= limit) return slug
  const cut = slug.slice(0, limit)
  const lastDash = cut.lastIndexOf('-')
  return lastDash > 0 ? cut.slice(0, lastDash) : cut
}

const rawSlug = (name: string): string =>
  transliterate(name.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase())
    .replace(APOSTROPHES, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const slugify = (name: string): string => truncate(rawSlug(name), MAX_ID_LENGTH)

/**
 * The id a name would be minted as.
 *
 * A slug of the whole name is preferred, because `italian-game-evans-gambit` says where it
 * sits. Dataset names run long, though — "King's Gambit Declined: Falkbeer Countergambit,
 * Charousek Gambit, Keres Variation" is 80 characters slugged, past the bound the runtime
 * loader enforces on an id before it goes in a request path. Cutting the tail would delete
 * the part that distinguishes it and collide six names onto one id, so the **opening head
 * is dropped instead**: the distinguishing words are on the right. Only if that still does
 * not fit is the tail cut.
 */
export const mintedId = (name: string): string => {
  const whole = rawSlug(name)
  if (whole.length <= MAX_ID_LENGTH) return whole
  const colon = name.indexOf(':')
  const tail = colon === -1 ? '' : rawSlug(name.slice(colon + 1))
  if (tail.length > 0 && tail.length <= MAX_ID_LENGTH) return tail
  // Still too long: cut the tail rather than the whole, because the words that tell two
  // sub-variations apart are on the right and the opening head is the part already gone.
  return truncate(tail.length > 0 ? tail : whole, MAX_ID_LENGTH)
}

/** What the freeze step is asked to mint an id for. */
export type Mintable = {
  readonly name: string
  readonly eco: string
  readonly definingLine: readonly string[]
  /** Hand-curated entries name their own id; imported ones are slugged from the name. */
  readonly id?: string | undefined
}

export type FrozenIndex = {
  readonly byLine: ReadonlyMap<string, string>
  readonly entries: Readonly<Record<string, FrozenEntry>>
}

export const indexFrozen = (
  frozen: FrozenIds,
  file: string,
): { readonly index: FrozenIndex; readonly issues: readonly CatalogueIssue[] } => {
  const byLine = new Map<string, string>()
  const issues: CatalogueIssue[] = []

  for (const [id, entry] of Object.entries(frozen.entries).sort(([a], [b]) => a.localeCompare(b))) {
    const key = lineKey(entry.definingLine)
    const existing = byLine.get(key)
    if (existing !== undefined) {
      issues.push({
        where: `${file} entries.${id}`,
        message:
          `shares its defining line with \`${existing}\`. The line is what an id is looked up ` +
          'by, so two ids on one line makes the lookup a coin toss and one of the two URLs ' +
          'stops resolving.',
      })
      continue
    }
    byLine.set(key, id)
  }

  return { index: { byLine, entries: frozen.entries }, issues }
}

export type Resolved = { readonly id: string; readonly mintable: Mintable }

export const resolveIds = (
  index: FrozenIndex,
  mintables: readonly Mintable[],
  file: string,
): { readonly resolved: readonly Resolved[]; readonly issues: readonly CatalogueIssue[] } => {
  const resolved: Resolved[] = []
  const unfrozen: string[] = []

  for (const mintable of mintables) {
    const id = index.byLine.get(lineKey(mintable.definingLine))
    if (id === undefined) {
      unfrozen.push(`${mintable.name}  (${lineKey(mintable.definingLine)})`)
      continue
    }
    resolved.push({ id, mintable })
  }

  const issues: CatalogueIssue[] =
    unfrozen.length === 0
      ? []
      : [
          {
            where: file,
            message:
              `${unfrozen.length} entries have no frozen id. The build does not mint ids — ` +
              'run `npm run catalogue:freeze` and commit the result, so that every id this site ' +
              'has ever published is a line in a reviewed diff (docs/CONTEXT.md, invariant 9).' +
              unfrozen
                .slice(0, 12)
                .map((name) => `\n    ${name}`)
                .join('') +
              (unfrozen.length > 12 ? `\n    … and ${unfrozen.length - 12} more` : ''),
          },
        ]

  return { resolved, issues }
}

/**
 * ADR-0004 check 13. Every id the map has ever published must still be in the catalogue.
 */
export const missingPublishedIds = (
  index: FrozenIndex,
  publishedIds: readonly string[],
  file: string,
): readonly CatalogueIssue[] => {
  const present = new Set(publishedIds)
  const missing = Object.keys(index.entries)
    .filter((id) => !present.has(id))
    .sort()
  if (missing.length === 0) return []

  return [
    {
      where: file,
      message:
        `${missing.length} previously published ids are not in the catalogue this build ` +
        'produced. A published id is never reused and never renamed (docs/CONTEXT.md, ' +
        'invariant 9): every shared URL to one of these would now 404, in a build that passes ' +
        'every other check. Either restore the entry or record the removal deliberately.' +
        missing
          .slice(0, 12)
          .map((id) => `\n    ${id}`)
          .join('') +
        (missing.length > 12 ? `\n    … and ${missing.length - 12} more` : ''),
    },
  ]
}

/** Upstream renamed an entry and the id absorbed it. Reported, never a failure. */
export type Rename = { readonly id: string; readonly was: string; readonly now: string }

export const renames = (index: FrozenIndex, resolved: readonly Resolved[]): readonly Rename[] =>
  resolved.flatMap((entry) => {
    const frozen = index.entries[entry.id]
    if (frozen === undefined || frozen.name === entry.mintable.name) return []
    return [{ id: entry.id, was: frozen.name, now: entry.mintable.name }]
  })

/**
 * Minting, for `catalogue:freeze` only. Append-only: an id already in the map keeps its
 * recorded name, so the diff of `ids.json` is a list of additions and an id can never
 * change in a commit that looks like a rename.
 */
export const freeze = (frozen: FrozenIds, mintables: readonly Mintable[]): FrozenIds => {
  const entries: Record<string, FrozenEntry> = { ...frozen.entries }
  const byLine = new Map<string, string>(
    Object.entries(frozen.entries).map(([id, entry]) => [lineKey(entry.definingLine), id]),
  )
  const taken = new Set(Object.keys(frozen.entries))

  const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
  // Codepoint order, not locale order: which of two colliding names gets the bare id and
  // which gets the suffix must not depend on the ICU data the machine happens to ship.
  const ordered = [...mintables].sort(
    (a, b) => order(a.name, b.name) || order(lineKey(a.definingLine), lineKey(b.definingLine)),
  )

  for (const mintable of ordered) {
    const key = lineKey(mintable.definingLine)
    if (byLine.has(key)) continue

    const base = mintable.id ?? mintedId(mintable.name)
    let id = base
    for (let suffix = 2; taken.has(id); suffix += 1) {
      const tail = `-${suffix}`
      id = `${truncate(base, MAX_ID_LENGTH - tail.length)}${tail}`
    }

    taken.add(id)
    byLine.set(key, id)
    entries[id] = {
      name: mintable.name,
      eco: mintable.eco,
      definingLine: [...mintable.definingLine],
    }
  }

  return { note: frozen.note, entries }
}
