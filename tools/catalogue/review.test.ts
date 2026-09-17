import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { namesAGambit, ruleFor } from './classify.ts'
import { foldByName, readDataset } from './dataset.ts'
import { proveOffer } from './sacrifice.ts'
import { readClassification } from './source.ts'

/**
 * Issue #36, read back off the file it was written into.
 *
 * Everything here is about the review not being quietly undone. The numbers are pinned
 * rather than bounded: `toBeGreaterThan` would keep passing while somebody deleted half of
 * it, which is the failure mode this project's content gate exists to prevent one level up.
 */

const classification = (() => {
  const result = readClassification(join('tools', 'catalogue', 'source'))
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join('\n'))
  return result.value
})()

const includes = classification.rules.filter((rule) => rule.include === true)

/**
 * The rules that still say `side:` outright rather than naming the ply and letting the
 * build read the side off a board. All of them predate #36, and this is the ratchet: an
 * eighty-second cannot be added without this number changing in a diff somebody reviewed.
 *
 * It was 84 until #56 split the broad heads it had to: `Bird Opening`, `Van Geet Opening`,
 * `Vienna Game`, `Zukertort Opening` and the rest keep their asserted `side` for the rows
 * that are genuinely White's, and thirty-one narrower rules now prove the rows that are
 * not. Three heads went the whole way and were converted outright — the Lemberger
 * Countergambit, the Four Knights Krause Gambit and the Grob Romford Countergambit — which
 * is where the three come from.
 *
 * The count is not zero and pretending otherwise would be the dishonest version of this
 * test. What is left asserts a side over rows whose own lines give nothing away, which is
 * not something a ply can be named for; `published-sides.test.ts` lists the six entries
 * that reach the browser that way, one sentence of chess each.
 */
const ASSERTED_SIDES = 81

describe('how the catalogue establishes which side a gambit belongs to', () => {
  it('proves the side of every rule reviewed on the board, and asserts none of them', () => {
    // #36's 303 rules and #56's 34 share a review date. Both are held to the same property,
    // which is the only thing this asserts about them, so one filter answers for both.
    const reviewed = includes.filter(
      (rule) => typeof rule.soundness !== 'string' && rule.soundness.at === '2026-09-17',
    )

    expect(reviewed.length).toBeGreaterThanOrEqual(281)
    expect(reviewed.filter((rule) => rule.sacrifice === undefined)).toStrictEqual([])
    expect(reviewed.filter((rule) => rule.side !== undefined)).toStrictEqual([])
  })

  it('still asserts exactly the sides it asserted before the review, and no more', () => {
    expect(includes.filter((rule) => rule.side !== undefined)).toHaveLength(ASSERTED_SIDES)
  })
})

describe('the spot-check sample', () => {
  /**
   * AC 4. Thirty included entries checked by hand against a published source, with the
   * source recorded on the entry rather than in a pull-request comment nobody can grep.
   */
  it('records a published source on at least thirty reviewed rules', () => {
    const sourced = includes.filter(
      (rule) => typeof rule.soundness !== 'string' && rule.soundness.source !== undefined,
    )

    expect(sourced.length).toBeGreaterThanOrEqual(30)
  })

  it('names what was consulted, not just that something was', () => {
    for (const rule of includes) {
      if (typeof rule.soundness === 'string') continue
      const source = rule.soundness.source
      if (source === undefined) continue
      expect(source, rule.match).toMatch(/Wikipedia|Wikibooks|Chess\.com/)
      expect(source.length, rule.match).toBeGreaterThan(60)
    }
  })
})

describe('the exclusion list', () => {
  /**
   * The head-level defaults — `French Defense`, `Sicilian Defense`, `Ruy Lopez` and
   * fifty-five more — were deleted rather than reworded, so that a gambit-named row upstream
   * adds tomorrow fails the build instead of inheriting a decision made about other rows.
   * This asserts they stayed deleted.
   */
  it('has no rule that excludes a whole opening by its head', () => {
    const heads = classification.rules
      .filter((rule) => rule.include === false)
      .map((rule) => rule.match)
      .filter((match) => !match.includes(':'))

    expect(heads).toStrictEqual(["Queen's Gambit"])
  })

  it('gives every exclusion a code as well as a sentence', () => {
    for (const rule of classification.rules) {
      if (rule.include) continue
      expect(rule.code, rule.match).toBeDefined()
      expect(rule.reason.length, rule.match).toBeGreaterThan(40)
    }
  })

  /** `unassessable` is what the pre-#36 head rules used. Nothing should be left on it. */
  it('leaves nothing on the code the review existed to empty', () => {
    const unassessable = classification.rules.filter(
      (rule) => rule.include === false && rule.code === 'unassessable',
    )

    expect(unassessable).toStrictEqual([])
  })
})

/**
 * What the #36 machinery finds when it is pointed at the entries that were already
 * published. #36 counted it at 45 and #56 worked through them one at a time.
 *
 * A rule that asserts `side` was never checked against a board. Run `proveOffer` over every
 * ply of every row those rules admit and 6 of them still have **no** provable offer by the
 * side they claim — down from 45, of which 39 had a provable offer by the *other* side and
 * now name the ply that proves it. `Van Geet Opening` no longer says "Every one is White's"
 * over ten rows that are Black's, and the Lemberger Countergambit is no longer filed as
 * Black's over six rows where only White gives anything up.
 *
 * The six that remain are not wrong orientations: no ply of their lines gives anything away
 * for *either* side, because in every one of them the material changes hands past the end of
 * the line the entry publishes. `published-sides.test.ts` names them and says why, and the
 * rules in `classification.yaml` argue it beside each one. Pinned here so the number can
 * only move in a diff somebody read, and so it cannot quietly grow the next time the dataset
 * is refreshed.
 */
describe('the orientation debt left in the entries published before this review', () => {
  const UNPROVABLE = 6

  it('is exactly the size it was measured at, and no larger', () => {
    const rows = readDataset(join('tools', 'catalogue', 'dataset'))
    if (!rows.ok) throw new Error('the vendored dataset does not read')

    const unprovable = foldByName(rows.value).filter((row) => {
      const rule = ruleFor(classification.rules, row.name)
      if (rule === undefined || !rule.include || rule.side === undefined) return false
      if (!namesAGambit(row.name) && rule.unnamed !== true) return false
      return !row.line.some((san, index) => {
        const proof = proveOffer(row.line, index + 1, san)
        return proof.ok && proof.side === rule.side
      })
    })

    expect(unprovable).toHaveLength(UNPROVABLE)
  })
})
