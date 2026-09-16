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
 * eighty-fifth cannot be added without this number changing in a diff somebody reviewed.
 *
 * The count is not zero and pretending otherwise would be the dishonest version of this
 * test. Converting them means splitting broad heads — `King's Gambit` alone admits 151 rows
 * whose sacrifice sits at different plies — and that is a separate piece of work on entries
 * that are already published, not a side effect of reviewing the excluded ones.
 */
const ASSERTED_SIDES = 84

describe('how the catalogue establishes which side a gambit belongs to', () => {
  it('proves the side of every rule the #36 review added, and asserts none of them', () => {
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
 * published — which is not this ticket's job to fix, and is very much its job to count.
 *
 * A rule that asserts `side` was never checked against a board. Run `proveOffer` over every
 * ply of every row those rules admit and 45 of them turn out to have **no** provable offer
 * by the side they claim; 41 of those have one by the other side. `Van Geet Opening` says
 * "Every one is White's" over ten rows that are Black's, and the Lemberger Countergambit is
 * filed as Black's over six rows where only White gives anything up.
 *
 * Fixing them means naming a sacrifice ply for each, one at a time, exactly as the 303 rows
 * below were done — a second review, on entries that are already live, not a side effect of
 * this one. Pinned here so the number can only move in a diff somebody read, and so it
 * cannot quietly grow the next time the dataset is refreshed.
 */
describe('the orientation debt left in the entries published before this review', () => {
  const UNPROVABLE = 45

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
