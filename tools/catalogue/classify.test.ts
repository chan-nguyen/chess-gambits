import { describe, expect, it } from 'vitest'
import { classify, familyOf, namesAGambit, ruleFor, variationOf } from './classify.ts'
import type { DatasetRow } from './dataset.ts'
import type { Classification, ClassificationRule } from './source.ts'

/**
 * AC 2 and AC 5. Classification is a curated decision; grouping is mechanical.
 *
 * The two are separated on purpose. A family is the dataset name's head and needs no
 * review to be right. Whether an entry belongs in a gambit catalogue at all is a judgement,
 * and the dataset is wrong about it in both directions.
 */

type IncludeRule = Extract<ClassificationRule, { include: true }>

const rule = (match: string, extra: Partial<IncludeRule> = {}): ClassificationRule => ({
  match,
  include: true,
  side: 'white',
  soundness: 'dubious',
  reason: 'a fixture rule, long enough to be a reason',
  ...extra,
})

const exclude = (match: string): ClassificationRule => ({
  match,
  include: false,
  code: 'unassessable',
  reason: 'a fixture rule, long enough to be a reason',
})

const row = (name: string, line: readonly string[] = ['e4']): DatasetRow => ({
  eco: 'C51',
  name,
  line,
  where: 'fixture',
})

const classification = (rules: readonly ClassificationRule[]): Classification => ({
  reviewedBy: 'fixture',
  reviewedAt: '2026-01-01',
  basis: 'a fixture, long enough to be a reason',
  rules: [...rules],
})

const run = (rows: readonly DatasetRow[], rules: readonly ClassificationRule[]) =>
  classify(rows, classification(rules), 'fixture.yaml')

describe('what the dataset calls a gambit', () => {
  it('sees the word in any name segment, including Countergambit', () => {
    expect(namesAGambit('Italian Game: Evans Gambit')).toBe(true)
    expect(namesAGambit("Queen's Gambit Declined: Albin Countergambit")).toBe(true)
    expect(namesAGambit('Italian Game: Giuoco Piano')).toBe(false)
  })

  /** The whole point of the curated list: the word decides nothing on its own. */
  it('says nothing about whether it is one', () => {
    expect(namesAGambit("Queen's Gambit Declined: Orthodox Defense")).toBe(true)
    expect(namesAGambit('Ruy Lopez: Marshall Attack')).toBe(false)
  })
})

describe('grouping into families', () => {
  it('takes the family from the name head and the variation from the rest', () => {
    expect(familyOf('Italian Game: Evans Gambit, Main Line')).toBe('Italian Game')
    expect(variationOf('Italian Game: Evans Gambit, Main Line')).toBe('Evans Gambit, Main Line')
  })

  it('leaves an entry that is its own family with an empty variation', () => {
    expect(familyOf('Benko Gambit')).toBe('Benko Gambit')
    expect(variationOf('Benko Gambit')).toBe('')
  })
})

describe('matching a rule to a name', () => {
  it('lets the longest rule win, so a narrow exception beats a blanket exclusion', () => {
    const rules = [exclude("Queen's Gambit"), rule("Queen's Gambit Declined: Albin Countergambit")]
    expect(ruleFor(rules, "Queen's Gambit Declined: Orthodox Defense")?.include).toBe(false)
    expect(
      ruleFor(rules, "Queen's Gambit Declined: Albin Countergambit, Lasker Variation")?.include,
    ).toBe(true)
  })

  it('matches only at a segment boundary', () => {
    expect(ruleFor([rule('Vienna Game')], 'Vienna Gambit')).toBeUndefined()
    expect(ruleFor([rule('Vienna Game')], 'Vienna Game: Vienna Gambit')?.match).toBe('Vienna Game')
  })
})

describe('the gate on unreviewed rows', () => {
  it('fails on a gambit-named row no rule covers, and names it', () => {
    const { issues } = run([row("Queen's Gambit Accepted")], [rule('Benko Gambit')])
    expect(issues.map((issue) => issue.message).join('\n')).toContain("Queen's Gambit Accepted")
    expect(issues.some((issue) => issue.message.includes('Silence is not a decision'))).toBe(true)
  })

  it('says nothing about a row the dataset does not call a gambit', () => {
    const { issues } = run(
      [row('Italian Game: Evans Gambit'), row('Italian Game: Giuoco Piano')],
      [rule('Italian Game')],
    )
    expect(issues).toEqual([])
  })
})

describe('the gate on rules that stopped matching', () => {
  it('fails when an include rule contributes no entry', () => {
    const { issues } = run([row('Italian Game: Giuoco Piano')], [rule('Italian Game')])
    expect(issues.some((issue) => issue.message.includes('contribute no entry'))).toBe(true)
  })

  it('fails when an exclude rule matches nothing, since it has stopped excluding', () => {
    const { issues } = run([row('Benko Gambit')], [rule('Benko Gambit'), exclude("Queen's Gambit")])
    expect(issues.some((issue) => issue.message.includes('match no row'))).toBe(true)
  })
})

describe('admitting a gambit the dataset never names one', () => {
  it('keeps a broad include rule to the rows whose names say Gambit', () => {
    const { classified } = run(
      [row('Italian Game: Evans Gambit'), row('Italian Game: Giuoco Piano')],
      [rule('Italian Game')],
    )
    expect(classified.included.map((entry) => entry.row.name)).toEqual([
      'Italian Game: Evans Gambit',
    ])
  })

  it('admits a pawn sacrifice the dataset calls an Attack when the rule says so', () => {
    const { classified } = run(
      [row('Ruy Lopez: Marshall Attack')],
      [rule('Ruy Lopez: Marshall Attack', { unnamed: true })],
    )
    expect(classified.included).toHaveLength(1)
  })
})

describe('what a rule carries', () => {
  it('gives the entry the reviewed side and soundness, not a guess from the line', () => {
    const { classified } = run(
      [row("King's Gambit Declined: Falkbeer Countergambit")],
      [
        rule("King's Gambit", { side: 'white', soundness: 'dubious' }),
        rule("King's Gambit Declined: Falkbeer Countergambit", {
          side: 'black',
          soundness: 'unsound',
        }),
      ],
    )
    expect(classified.included[0]?.side).toBe('black')
    expect(classified.included[0]?.soundness).toBe('unsound')
  })

  it('counts the gambit-named rows a decision deliberately keeps out', () => {
    const { classified } = run(
      [row("Queen's Gambit Declined: Orthodox Defense"), row('Benko Gambit')],
      [exclude("Queen's Gambit"), rule('Benko Gambit')],
    )
    expect(classified.excluded).toBe(1)
  })
})

/**
 * Issue #36. A rule may prove its side instead of asserting one, and where it does the
 * proof runs against **every** row the rule admits rather than a representative.
 */
describe('a rule that names the sacrifice instead of the side', () => {
  const kgd = ['e4', 'e5', 'f4', 'd5']
  const kga = ['e4', 'e5', 'f4', 'exf4']

  const proved = (match: string, ply: number, move: string): ClassificationRule => ({
    match,
    include: true,
    sacrifice: { ply, move },
    soundness: 'dubious',
    reason: 'a fixture rule, long enough to be a reason',
  })

  it('derives the side from whose turn it is at the named ply', () => {
    const { classified, issues } = run(
      [row("King's Gambit Declined: Falkbeer Countergambit", kgd)],
      [proved("King's Gambit Declined: Falkbeer Countergambit", 4, 'd5')],
    )

    expect(issues).toEqual([])
    expect(classified.included[0]?.side).toBe('black')
  })

  /** The same line, the other offer, and therefore the other side. */
  it('derives the other side from the other offer in the same line', () => {
    const { classified } = run(
      [row("King's Gambit Declined: Falkbeer Countergambit", kgd)],
      [proved("King's Gambit Declined: Falkbeer Countergambit", 3, 'f4')],
    )

    expect(classified.included[0]?.side).toBe('white')
  })

  it('fails when the named ply is not a sacrifice, and says so on the row', () => {
    const { issues, classified } = run(
      [row('Italian Game: Giuoco Piano Gambit', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'])],
      [proved('Italian Game: Giuoco Piano Gambit', 6, 'Bc5')],
    )

    expect(classified.included).toEqual([])
    expect(issues.map((issue) => issue.message).join('\n')).toContain('nothing was offered')
  })

  /**
   * The failure a broad rule exists to risk. `King's Gambit` admits both rows; ply 4 is
   * `d5` in one and `exf4` in the other, and without this the second row would be published
   * with a side nobody proved.
   */
  it('fails when the ply holds for one admitted row and not another', () => {
    const { issues } = run(
      [
        row("King's Gambit Declined: Falkbeer Countergambit", kgd),
        row("King's Gambit Accepted", kga),
      ],
      [proved("King's Gambit", 4, 'd5')],
    )

    expect(issues.map((issue) => issue.message).join('\n')).toContain('is `exf4`, not `d5`')
  })

  it('publishes no entry at all when the ply proves out for none of the rows', () => {
    const { issues, classified } = run(
      [row('Alpha Gambit', ['e4', 'e5', 'Nf3'])],
      [proved('Alpha Gambit', 3, 'f4')],
    )

    expect(classified.included).toEqual([])
    expect(issues).toHaveLength(1)
  })
})

describe('where a soundness label comes from', () => {
  it('inherits the file header when the rule states the value alone', () => {
    const { classified } = run([row('Benko Gambit')], [rule('Benko Gambit')])

    expect(classified.included[0]?.judgement).toStrictEqual({
      value: 'dubious',
      by: 'fixture',
      at: '2026-01-01',
    })
  })

  it('keeps the rule&apos;s own reviewer, date and source when it carries them', () => {
    const { classified } = run(
      [row('Benko Gambit')],
      [
        rule('Benko Gambit', {
          soundness: { value: 'sound', by: 'chan', at: '2026-09-17', source: 'a published book' },
        }),
      ],
    )

    expect(classified.included[0]?.judgement.at).toBe('2026-09-17')
    expect(classified.included[0]?.judgement.source).toBe('a published book')
    expect(classified.included[0]?.soundness).toBe('sound')
  })
})

/** Issue #36, AC 5. The exclusion list has to be countable, not just present. */
describe('the exclusion list the build prints', () => {
  it('groups the rows kept out by the rule that kept them out', () => {
    const { classified } = run(
      [
        row("Queen's Gambit Declined: Orthodox Defense"),
        row("Queen's Gambit Accepted"),
        row('Benko Gambit'),
      ],
      [exclude("Queen's Gambit"), rule('Benko Gambit')],
    )

    expect(classified.exclusions).toStrictEqual([
      { code: 'unassessable', match: "Queen's Gambit", rows: 2 },
    ])
  })

  it('counts only the rows the dataset names a gambit, as the total does', () => {
    const { classified } = run(
      [row('Italian Game: Evans Gambit'), row('Italian Game: Giuoco Piano'), row('Benko Gambit')],
      [exclude('Italian Game'), rule('Benko Gambit')],
    )

    expect(classified.exclusions).toStrictEqual([
      { code: 'unassessable', match: 'Italian Game', rows: 1 },
    ])
    expect(classified.excluded).toBe(1)
  })
})
