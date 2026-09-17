import type { Catalogue, CatalogueEntry, CatalogueFamily } from '../../lib/catalogue.ts'

/**
 * A catalogue small enough to reason about and varied enough to exercise every filter:
 * three families, both sides, both kinds, all three soundness values and all three tiers.
 *
 * Vietnamese names with diacritics on purpose — the source locale is Vietnamese and the
 * search folds them, so a fixture written in ASCII would let that break unnoticed.
 */

/**
 * However many branch keys a fixture needs, spelled as the real ones are — underscore-joined
 * plies, which is what `encodeLine` produces and what `?line=` carries. Generated rather than
 * written out, so a fixture that wants twelve cannot quietly hold eleven; and distinct from
 * each other, because a card counts them into a set.
 */
export const fixtureBranchKeys = (count: number): readonly string[] =>
  Array.from({ length: count }, (_, index) => `e4_e5_Nf3_Nc6_v${index + 1}`)

export const fixtureEntry = (over: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  id: 'italian-game-evans-gambit',
  variation: 'Gambit Evans',
  eco: 'C51',
  category: 'gambit',
  side: 'white',
  soundness: 'sound',
  tier: 'listed',
  line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4',
  branchKeys: [],
  ...over,
})

const families: readonly CatalogueFamily[] = [
  {
    id: 'italian-game',
    name: 'Ván cờ Ý',
    entries: [
      fixtureEntry({
        id: 'italian-game-evans-gambit',
        variation: 'Gambit Evans',
        tier: 'taught',
        branchKeys: fixtureBranchKeys(12),
      }),
      fixtureEntry({
        id: 'italian-game-fried-liver',
        variation: 'Đòn Gan Rán',
        eco: 'C57',
        category: 'trap',
        soundness: 'dubious',
        tier: 'mapped',
        branchKeys: fixtureBranchKeys(4),
      }),
    ],
  },
  {
    id: 'kings-gambit',
    name: 'Gambit Vua',
    entries: [
      fixtureEntry({
        id: 'kings-gambit',
        variation: '',
        eco: 'C30',
        soundness: 'unsound',
        tier: 'listed',
        line: 'e4 e5 f4',
      }),
    ],
  },
  {
    id: 'benko-gambit',
    name: 'Gambit Benko',
    entries: [
      fixtureEntry({
        id: 'benko-gambit',
        variation: '',
        eco: 'A57',
        side: 'black',
        tier: 'listed',
        line: 'd4 Nf6 c4 c5 d5 b5',
      }),
    ],
  },
]

const countsFor = (all: readonly CatalogueFamily[]) => {
  const entries = all.flatMap((family) => family.entries)
  const atTier = (tier: CatalogueEntry['tier']) => entries.filter((e) => e.tier === tier).length

  return {
    entries: entries.length,
    gambits: entries.filter((e) => e.category === 'gambit').length,
    traps: entries.filter((e) => e.category === 'trap').length,
    families: all.length,
    listed: entries.length,
    mapped: atTier('mapped') + atTier('taught'),
    taught: atTier('taught'),
  }
}

/** The whole fixture, or a narrowed version of it for the empty-state cases. */
export const fixtureCatalogue = (
  over: { readonly families?: readonly CatalogueFamily[] } = {},
): Catalogue => {
  const chosen = over.families ?? families
  return {
    locale: 'vi',
    source: { repository: 'lichess-org/chess-openings', commit: 'abc1234' },
    counts: countsFor(chosen),
    families: chosen,
  }
}

/** The site as it actually stands today: everything listed, nothing taught. */
export const nothingTaughtCatalogue = (): Catalogue =>
  fixtureCatalogue({
    families: families.map((family) => ({
      ...family,
      entries: family.entries.map((entry) => ({ ...entry, tier: 'listed', branchKeys: [] })),
    })),
  })

/**
 * One family with however many entries a test needs, for the auto-expansion limit. Names
 * are generated rather than written out, so the fixture cannot quietly stop matching the
 * search term it is built to be found by.
 */
export const oversizedCatalogue = (size: number): Catalogue =>
  fixtureCatalogue({
    families: [
      {
        id: 'many',
        name: 'Nhiều mục',
        entries: Array.from({ length: size }, (_, index) =>
          fixtureEntry({ id: `gambit-${index}`, variation: `Gambit ${index}` }),
        ),
      },
    ],
  })
