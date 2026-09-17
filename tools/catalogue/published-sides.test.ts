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
 * Issue #56 took this list from 45 to 6. Thirty-nine entries had a provable offer by the side
 * opposite the one they printed — every Van Geet line under a head rule that said "Every one is
 * White's", the six Lemberger rows, `bird-opening-hobbs-gambit`, `bishops-opening-khan-gambit`
 * and the rest — and each of those now names the ply that gives the material away and has its
 * side read off a board.
 *
 * What is left is a different kind of debt, and the difference is the reason this list still
 * exists rather than being emptied. **None of these six prints a side the board contradicts.**
 * No ply of their published lines gives anything away *for either side*, so there is nothing to
 * name and nothing to prove — the material in each of them changes hands past the end of the
 * line the entry publishes:
 *
 * - `sicilian-defense-smith-morra-gambit` — `1.e4 c5 2.d4`. 2...cxd4 3.Qxd4 takes the pawn
 *   straight back; the Morra pawn is offered by 3.c3, one ply past this line. Every deeper
 *   Smith-Morra row does prove White on its own moves.
 * - `ruy-lopez-marshall-attack` — the pawn does not change hands until 11.Rxe5, five plies past
 *   8...d5. The one offer inside the line is White's 5.O-O, which belongs to the Open Ruy;
 *   naming it would prove a side and print the wrong one.
 * - `philidor-defense-lopez-countergambit` — 3...f5 is answered by 4.exf5 Bxf5 and 4.Nxe5 dxe5,
 *   both level. The pawn goes after 4.d4.
 * - `french-defense-marshall-gambit` — 4.exd5 exd5 and 4.dxc5 Bxc5 are both even; nothing is on
 *   offer inside the six plies.
 * - `bird-opening-thomas-gambit` — 5.e3 dxe3 6.dxe3 recovers the pawn. A gambit name over an
 *   even trade.
 * - `kings-gambit-declined-classical-svenonius-variation` — a declined line where c1 always
 *   recaptures on f4. Sixteen plies and nothing given.
 *
 * Emptying the list from here would mean removing six published entries, and every one of their
 * ids is frozen in `ids.json`: `missingPublishedIds` in `tools/catalogue/ids.ts` fails the build
 * on a published id that leaves the catalogue, and deleting those ids to silence it is exactly
 * the broken URL invariant 9 exists to prevent. Two of the six are the Smith-Morra and the
 * Marshall Attack. The honest state is this list, short and argued, and the rules in
 * `classification.yaml` say beside each of them why `side` is still only asserted.
 */

/**
 * Both sides really do give something away inside this line, and the **name** settles which
 * gambit the entry is about. That is not a defect and it is not the silent case either — it is
 * the third possibility, and #36 met it already: the Falkbeer holds White's 2.f4 and Black's
 * 2...d5, both real, and no rule of the form "take the first, or the largest, or the earliest"
 * picks correctly between them.
 *
 * `ruy-lopez-marshall-attack` is the one published entry in that position. Its line runs to
 * `c3 d5`, and 5.O-O is a provable White offer — it invites `...Nxe4`, which is the Open Ruy and
 * a different opening. The Marshall's own pawn does not go until 11.Rxe5, five plies past where
 * the dataset stops. Naming 5.O-O would prove a side and print **white** for the best-known
 * Black gambit in the game, which is why it is asserted instead.
 *
 * Entries earn a place here by really having both offers, which the test below checks. The list
 * is short on purpose: every addition is a judgement that the board could not make.
 */
const NAME_DECIDES: readonly string[] = ['ruy-lopez-marshall-attack']

const SILENT: readonly string[] = [
  'bird-opening-thomas-gambit',
  'french-defense-marshall-gambit',
  'kings-gambit-declined-classical-svenonius-variation',
  'philidor-defense-lopez-countergambit',
  'sicilian-defense-smith-morra-gambit',
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
const offerExistsFor = (side: string, line: string): boolean => {
  const plies = line.split(' ').filter((san) => san !== '')
  return plies.some((san, index) => {
    if ((index % 2 === 0) !== (side === 'white')) return false
    const proof = proveOffer(plies, index + 1, san)
    return proof.ok && proof.side === side
  })
}

const sideIsProvable = ({ side, line }: Published): boolean => offerExistsFor(side, line)

const other = (side: string): string => (side === 'white' ? 'black' : 'white')

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

  /**
   * **The dangerous class, and it must stay empty.**
   *
   * An entry whose declared side cannot be proved is not automatically wrong. There are two
   * quite different reasons for it, and collapsing them into one list is what would send the
   * next reader at the wrong fix. Either the board proves the *other* side — the entry is
   * facing backwards, the card names the wrong player, and a taught version of it would sit
   * the learner on the wrong side — or neither side gives anything away inside the published
   * line, which says only that the line stops before the sacrifice and names nobody wrongly.
   *
   * Thirty-nine of the forty-five this review started from were the first kind. All of them
   * were corrected. Nothing may join them: this list is asserted empty rather than pinned,
   * because there is no acceptable number of entries pointing at the wrong player.
   */
  it('never prints a side the board contradicts', () => {
    const contradicted = rows
      .filter(
        (row) =>
          unprovable.has(row.id) &&
          !NAME_DECIDES.includes(row.id) &&
          offerExistsFor(other(row.side), row.line),
      )
      .map((row) => `${row.id} says ${row.side}, the board says ${other(row.side)}: ${row.line}`)

    expect(contradicted).toStrictEqual([])
  })

  /**
   * The milder class, pinned as an exact set.
   *
   * In each of these the material changes hands *past the end* of the defining line the
   * vendored dataset publishes — the Smith-Morra's pawn goes at 3.c3 and the line stops at
   * 2.d4; the Marshall Attack's at 11.Rxe5, five plies later. So the prover has nothing to say
   * and the asserted side stands on the name instead.
   *
   * **The fix is not to remove them.** These ids are published: dropping one fails the build
   * with `missingPublishedIds`, and forcing it through would 404 a live URL for two of the
   * best-known gambits in the game. Either the defining line grows to reach the sacrifice, or
   * the side stays asserted with its reason written beside it in `classification.yaml`. Both
   * are decisions; neither is a deletion.
   */
  it('names the entries whose line stops before anybody gives anything away', () => {
    const silent = rows
      .filter((row) => unprovable.has(row.id) && !offerExistsFor(other(row.side), row.line))
      .map((row) => row.id)

    expect(silent.sort()).toStrictEqual([...SILENT].sort())
  })

  /** The exception has to be earned: an entry on that list must really have both offers. */
  it('keeps the name-decides list honest', () => {
    for (const id of NAME_DECIDES) {
      const row = rows.find((candidate) => candidate.id === id)
      expect(row, `${id} is not published any more`).toBeDefined()
      if (row === undefined) continue

      expect(unprovable.has(id), `${id} proves its own side and needs no exception`).toBe(true)
      expect(offerExistsFor(other(row.side), row.line), `${id} has no competing offer`).toBe(true)
    }
  })

  /**
   * The other direction, and the one that makes the list above a debt rather than a shrug: for
   * every entry not on it, the side really is derivable from the moves. Without this the
   * assertion could be satisfied by a prover that had stopped proving anything.
   */
  it('derives a side for every entry that is not on the list', () => {
    const outstanding = new Set([...SILENT, ...NAME_DECIDES])
    const clean = rows.filter((row) => !outstanding.has(row.id))

    expect(clean.length).toBeGreaterThan(900)
    expect(clean.filter((row) => unprovable.has(row.id))).toStrictEqual([])
  })
})
