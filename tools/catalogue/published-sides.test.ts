import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { proveOffer } from './sacrifice.ts'

/**
 * The orientation debt, measured on the bytes a learner actually downloads.
 *
 * `review.test.ts` counts this over the vendored dataset, which is where the wrong sides were
 * authored. This counts it over `public/catalogue/catalogue.vi.json`, which is where they are
 * *served* — and the two are not the same claim. The dataset count would stay green through a
 * change in `tools/catalogue/build.ts` that wrote a rule's asserted `side` over the proved one,
 * or that fell back to a default: the side a rule declares and the side a card prints would have
 * come apart, and only this file would notice. #36's whole method is that the side is derived
 * rather than asserted, so the place to hold that is the output.
 *
 * The **set** is pinned and not just its size. A count alone stays green while one entry is
 * repaired and another breaks, which is the failure mode that makes a number feel like progress
 * while nothing improves.
 *
 * Every id below is a gambit whose declared side no board supports. `bird-opening-hobbs-gambit`
 * is `f4 g5` filed as White's: it is Black who puts the pawn on g5 and White who may take it.
 * `bishops-opening-khan-gambit` is `e4 e5 Bc4 d5`, the same shape. The learner is sat on the
 * wrong side of the board — which #36 itself calls worse than a missing entry — and the fix is a
 * sacrifice ply named for each, one at a time, as a review of live entries rather than a side
 * effect of this one.
 */

const DEBT: readonly string[] = [
  'bird-opening-hobbs-gambit',
  'bird-opening-hobbs-zilbermints-gambit',
  'bird-opening-lasker-gambit',
  'bird-opening-platz-gambit',
  'bird-opening-schlechter-gambit',
  'bird-opening-thomas-gambit',
  'bishops-opening-anderssen-gambit',
  'bishops-opening-horwitz-gambit',
  'bishops-opening-khan-gambit',
  'bishops-opening-thorold-gambit',
  'blackmar-diemer-gambit-lemberger-countergambit',
  'blackmar-diemer-gambit-lemberger-countergambit-endgame-variation',
  'blackmar-diemer-gambit-lemberger-countergambit-lange-gambit',
  'blackmar-diemer-gambit-lemberger-countergambit-rasmussen-attack',
  'blackmar-diemer-gambit-lemberger-countergambit-sneiders-attack',
  'blackmar-diemer-gambit-lemberger-countergambit-soller-attack',
  'four-knights-game-scotch-variation-krause-gambit',
  'french-defense-marshall-gambit',
  'grob-opening-alessi-gambit',
  'grob-opening-romford-countergambit',
  'kings-gambit-declined-classical-svenonius-variation',
  'kings-gambit-declined-mafia-defense',
  'philidor-defense-lopez-countergambit',
  'ponziani-opening-caro-gambit',
  'ruy-lopez-marshall-attack',
  'scotch-variation-krause-gambit-leonhardt-defense',
  'sicilian-defense-smith-morra-gambit',
  'van-geet-opening-billockus-johansen-gambit',
  'van-geet-opening-damhaug-gambit',
  'van-geet-opening-hergert-gambit',
  'van-geet-opening-hulsemann-gambit',
  'van-geet-opening-laroche-gambit',
  'van-geet-opening-liebig-gambit',
  'van-geet-opening-melleby-gambit',
  'van-geet-opening-pfeiffer-gambit',
  'van-geet-opening-sleipnir-gambit',
  'van-geet-opening-warsteiner-gambit',
  'vienna-game-mieses-variation-erben-gambit',
  'vienna-game-paulsen-variation-mariotti-gambit',
  'vienna-game-paulsen-variation-pollock-gambit',
  'vienna-game-stanley-variation-eifel-gambit',
  'zukertort-opening-herrstrom-gambit',
  'zukertort-opening-ross-gambit',
  'zukertort-opening-shabalov-gambit',
  'zukertort-opening-vos-gambit',
]

type Published = { readonly id: string; readonly side: string; readonly line: string }

const published = (): readonly Published[] => {
  const parsed: unknown = JSON.parse(
    readFileSync(join('public', 'catalogue', 'catalogue.vi.json'), 'utf8'),
  )
  if (typeof parsed !== 'object' || parsed === null || !('families' in parsed)) {
    throw new Error('the published catalogue has no families; run `npm run catalogue`')
  }
  const families = parsed.families
  if (!Array.isArray(families)) throw new Error('families is not a list')

  const rows: Published[] = []
  for (const family of families) {
    if (typeof family !== 'object' || family === null || !('entries' in family)) continue
    const entries = family.entries
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null) continue
      const { id, side, line, category } = entry
      if (typeof id !== 'string' || typeof side !== 'string' || typeof line !== 'string') continue
      // A trap is not a material offer, so `proveOffer` has nothing to say about its side.
      if (category === 'trap') continue
      rows.push({ id, side, line })
    }
  }
  return rows
}

/**
 * Whether any ply of the entry's own published line gives material away for the declared side.
 *
 * Only that side's own moves are tried. White cannot give a pawn away on Black's turn, and
 * `proveOffer` replays the line from the start for every ply it is asked about, so checking the
 * other half would double a thousand entries' worth of chess.js for answers that cannot match.
 */
const sideIsProvable = ({ side, line }: Published): boolean => {
  const plies = line.split(' ').filter((san) => san !== '')
  return plies.some((san, index) => {
    if ((index % 2 === 0) !== (side === 'white')) return false
    const proof = proveOffer(plies, index + 1, san)
    return proof.ok && proof.side === side
  })
}

describe('every published gambit, checked against its own line', () => {
  const rows = published()

  /*
   * Replayed once and shared. Proving an offer walks the line again for every ply, so running
   * it per test put a thousand entries through chess.js twice and took half the suite's timeout
   * on its own — which is how a correct test becomes a flaky one.
   */
  const unprovable = new Set(rows.filter((row) => !sideIsProvable(row)).map((row) => row.id))

  it('has a catalogue to check', () => {
    expect(rows.length).toBeGreaterThan(900)
  })

  it('proves the side it prints, except for the debt this review measured and did not create', () => {
    expect([...unprovable].sort()).toStrictEqual([...DEBT].sort())
  })

  /**
   * The other direction, and the one that makes the list above a debt rather than a shrug: for
   * every entry not on it, the side really is derivable from the moves. Without this the
   * assertion could be satisfied by a prover that had stopped proving anything.
   */
  it('derives a side for every entry that is not on the list', () => {
    const outstanding = new Set(DEBT)
    const clean = rows.filter((row) => !outstanding.has(row.id))

    expect(clean.length).toBeGreaterThan(900)
    expect(clean.filter((row) => unprovable.has(row.id))).toStrictEqual([])
  })
})
