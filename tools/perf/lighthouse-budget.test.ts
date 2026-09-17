import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * The Lighthouse gate is configured the way `docs/performance-budgets.md` says it is.
 *
 * This file exists because of what #57 had to undo. The CLS assertion was lowered to `warn`
 * in #19 — deliberately, with the reasoning written down, and with a named ticket to put it
 * back. That is the good version of a temporary exception, and it still took a ticket and an
 * acceptance criterion to end it. Nothing was comparing the config to the document, so the
 * only thing standing between "reported for now" and "reported forever" was somebody
 * remembering.
 *
 * So the two claims below are the ones a document alone cannot make:
 *
 * - **Every assertion in `lighthouserc.json` blocks.** Not "the CLS one does": an assertion
 *   at `warn` prints a number and fails nothing, which is indistinguishable from not
 *   measuring it, and the next exception will be on whichever metric is inconvenient next.
 * - **The numbers are the documented numbers.** A budget quietly widened to fit the site is
 *   the one move `docs/performance-budgets.md` says a budget may never make.
 *
 * It does not run Lighthouse. What Lighthouse measures is `npm run perf:lighthouse`'s job
 * and CI's; this is about the thresholds it is handed.
 */

const repoRoot = join(import.meta.dirname, '..', '..')

const read = (file: string): string => readFileSync(join(repoRoot, file), 'utf8')

/**
 * The shape this file reads, and no more of it. Deliberately not strict: the config carries
 * plenty that is none of this test's business — URLs, Chrome flags, the server command — and
 * a strict schema here would fail on a change that has nothing to do with budgets. Zod's
 * default is to ignore the keys it was not asked about, which is exactly that.
 */
const configSchema = z.object({
  ci: z.object({
    assert: z.object({
      aggregationMethod: z.string(),
      assertions: z.record(z.string(), z.tuple([z.string(), z.record(z.string(), z.unknown())])),
    }),
  }),
})

const assertionSchema = z.object({ maxNumericValue: z.number() })

/** §6's two Lighthouse budgets, as `docs/performance-budgets.md` states them. */
const DOCUMENTED: ReadonlyMap<string, number> = new Map([
  ['largest-contentful-paint', 2500],
  ['cumulative-layout-shift', 0.1],
])

/**
 * Returns every disagreement rather than throwing on the first, so a failure lists all of
 * them and the fixtures below can be checked for the one they carry.
 */
const problemsIn = (raw: string): readonly string[] => {
  const parsed = configSchema.safeParse(JSON.parse(raw))
  if (!parsed.success)
    return [`lighthouserc.json is not shaped like an LHCI config: ${parsed.error.message}`]

  const { aggregationMethod, assertions } = parsed.data.ci.assert
  const problems: string[] = []

  /*
   * LHCI's default is `optimistic`, which for a `maxNumericValue` assertion takes the
   * *lowest* of the three runs. Under that default the 0.216 this ticket fixed passed,
   * because one run in three happened to be clean. The level and the threshold are both
   * meaningless without this, which is why it is checked alongside them.
   */
  if (aggregationMethod !== 'median') {
    problems.push(`aggregationMethod is "${aggregationMethod}" rather than "median"`)
  }

  for (const [audit, [level, options]] of Object.entries(assertions)) {
    if (level !== 'error') {
      problems.push(
        `${audit} is asserted at "${level}" rather than "error", so it cannot fail a run`,
      )
    }

    const parsedOptions = assertionSchema.safeParse(options)
    if (!parsedOptions.success) {
      problems.push(`${audit} has no maxNumericValue`)
      continue
    }

    const documented = DOCUMENTED.get(audit)
    if (documented === undefined) {
      problems.push(`${audit} is asserted but docs/performance-budgets.md gives it no budget`)
    } else if (parsedOptions.data.maxNumericValue !== documented) {
      problems.push(
        `${audit} is asserted at ${parsedOptions.data.maxNumericValue} rather than the documented ${documented}`,
      )
    }
  }

  for (const audit of DOCUMENTED.keys()) {
    if (!(audit in assertions)) {
      problems.push(`${audit} is documented as blocking but is not asserted at all`)
    }
  }

  return problems
}

describe('lighthouserc.json', () => {
  it('asserts exactly the budgets the documentation states, and every one of them blocks', () => {
    expect(problemsIn(read('lighthouserc.json'))).toStrictEqual([])
  })
})

describe('the gate can fail', () => {
  const config = (assertions: unknown, aggregationMethod = 'median'): string =>
    JSON.stringify({ ci: { assert: { aggregationMethod, assertions } } })

  const blocking = {
    'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
    'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  }

  it('rejects the CLS assertion going back to warn', () => {
    const problems = problemsIn(
      config({ ...blocking, 'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }] }),
    )

    expect(problems.join('\n')).toContain('cumulative-layout-shift is asserted at "warn"')
  })

  it('rejects the CLS budget being widened to fit the site', () => {
    const problems = problemsIn(
      config({ ...blocking, 'cumulative-layout-shift': ['error', { maxNumericValue: 0.25 }] }),
    )

    expect(problems.join('\n')).toContain('asserted at 0.25 rather than the documented 0.1')
  })

  it('rejects a documented budget being dropped from the config entirely', () => {
    const problems = problemsIn(
      config({ 'largest-contentful-paint': blocking['largest-contentful-paint'] }),
    )

    expect(problems.join('\n')).toContain('cumulative-layout-shift is documented as blocking')
  })

  it('rejects the optimistic aggregation that would pass a budget two runs in three breach', () => {
    expect(problemsIn(config(blocking, 'optimistic')).join('\n')).toContain('rather than "median"')
  })

  it('accepts the configuration as it stands, so the rejections above mean something', () => {
    expect(problemsIn(config(blocking))).toStrictEqual([])
  })
})

/**
 * The other direction: the document has to still say what the config does.
 *
 * #57's acceptance criterion 2 is that the exception *and its section* go, not merely that
 * the config changes — an exception that survives in prose is one the next reader believes.
 */
describe('docs/performance-budgets.md', () => {
  const budgets = read('docs/performance-budgets.md')

  it('no longer carries the CLS exception', () => {
    expect(budgets).not.toContain('Why CLS is reported rather than blocking')
    expect(budgets).not.toContain('reported, not blocking')
  })

  it('records CLS as a budget that can fail a pull request', () => {
    const row = budgets.split('\n').find((line) => line.includes('| CLS'))
    expect(row).toBeDefined()
    expect(row).toContain('0.1')
    expect(row).toContain('lighthouserc.json')
    expect(row).toContain('blocking')
    expect(row).not.toContain('not blocking')
  })

  /**
   * The section #61 added, which #57 had no business touching. Written down because the
   * two sections sat next to each other and "remove the CLS one" is one careless regular
   * expression away from removing both.
   */
  it('keeps the section explaining why pressing next is measured twice', () => {
    expect(budgets).toContain('Why pressing next is measured twice')
  })
})
