import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countableBranches } from '../../src/components/progress/branches.ts'
import { compileEntry } from '../content/compile.ts'
import { loadContent } from '../content/entries.ts'
import { build } from './build.ts'
import { makeWorkspace } from './fixture-workspace.ts'
import type { CatalogueEntryPayload, CataloguePayload } from './types.ts'

/**
 * The branch count the catalogue bakes in, and the one thing that must be true of it: it
 * is the number the gambit page would compute, not a second answer to the same question.
 *
 * The catalogue deliberately downloads no entry tree — that is why 1,003 entries cost under
 * 17KB gzipped — so a card cannot count branches itself, and a card that showed a
 * different total from the page it links to would be worse than a card that showed none.
 * The guarantee is structural rather than asserted: the build calls `countableBranches`
 * from `src/components/progress/branches.ts`. These tests are what keeps that structure
 * from being quietly replaced by a copy.
 */

const entriesOf = (payload: CataloguePayload): readonly CatalogueEntryPayload[] =>
  payload.families.flatMap((family) => family.entries)

const findEntry = (payload: CataloguePayload, id: string): CatalogueEntryPayload => {
  const found = entriesOf(payload).find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`no entry ${id} in the payload`)
  return found
}

const buildFixture = () => {
  const workspace = makeWorkspace()
  const result = build({
    datasetDir: workspace.datasetDir,
    sourceDir: workspace.sourceDir,
    contentDir: workspace.contentDir,
  })
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.where}: ${issue.message}`).join('\n'))
  }
  return { workspace, output: result.value }
}

describe('the baked branch count', () => {
  const { workspace, output } = buildFixture()
  const payload = output.payloads[0]?.payload
  if (payload === undefined) throw new Error('no payload')

  /**
   * The fixture's one authored entry is the Evans, whose tree has a single modelled reply
   * ending in an assessment. One root-to-leaf line, so one branch — and the number is
   * recomputed here from the content rather than written down, so a change to the fixture
   * cannot make this test assert a stale constant.
   */
  it('is what `countableBranches` returns for the compiled tree', () => {
    const content = loadContent(workspace.contentDir)
    expect(content.ok).toBe(true)
    if (!content.ok) return

    for (const { entry } of content.entries) {
      const expected = countableBranches(compileEntry(entry).tree).length
      expect(findEntry(payload, entry.id).branches).toBe(expected)
    }
  })

  it('counts the fixture Evans as one branch, not zero and not two', () => {
    expect(findEntry(payload, 'italian-game-evans-gambit').branches).toBe(1)
  })

  /**
   * The rule this ticket was told to import rather than fork: an `unexplored` leaf is not
   * a branch (docs/design-system.md, *Progress is a count, not a percentage*). Every entry
   * with no authored file is Tier 0, whose whole tree is one unexplored root, so a build
   * that had forked the rule — or counted leaves instead of lines — would show a one here
   * on all 699 of them.
   */
  it('is zero for an entry with no authored tree', () => {
    const listed = entriesOf(payload).filter((entry) => entry.tier === 'listed')

    expect(listed.length).toBeGreaterThan(0)
    for (const entry of listed) expect(entry.branches).toBe(0)
  })

  it('is on every entry of every locale, so no locale shows a card without a total', () => {
    for (const { payload: localised } of output.payloads) {
      for (const entry of entriesOf(localised)) {
        expect(Number.isInteger(entry.branches)).toBe(true)
        expect(entry.branches).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('the catalogue this repository ships', () => {
  const result = build({
    datasetDir: join('tools', 'catalogue', 'dataset'),
    sourceDir: join('tools', 'catalogue', 'source'),
    contentDir: 'content',
  })
  if (!result.ok) throw new Error('the real catalogue does not build')

  /**
   * Three entries are authored (#15) and the other 1,000 are Tier 0. Each of the three is
   * named here with the number of root-to-leaf lines its tree actually has, rather than
   * the whole set being loosened to "at least zero" — which would assert nothing and would
   * keep passing if every tree in the repository disappeared.
   *
   * This is the assertion the previous version of this test was written to force: the day
   * a mapped entry landed, the number that appeared here had to appear because content
   * changed. It did, so these four lines changed with it, deliberately and by name.
   */
  const AUTHORED: ReadonlyMap<string, number> = new Map([
    ['italian-game-evans-gambit', 6],
    ['benko-gambit', 9],
    ['legals-mate', 7],
  ])

  it('bakes a count on all 1003 entries, and only the authored three are non-zero', () => {
    expect(result.value.records).toHaveLength(1003)
    for (const record of result.value.records) {
      expect(record.branches).toBe(AUTHORED.get(record.id) ?? 0)
    }
    // Every named entry is actually in the catalogue, so a typo in an id above cannot
    // quietly turn this into a test that only checks 1,003 zeroes.
    expect(result.value.records.filter((record) => AUTHORED.has(record.id))).toHaveLength(
      AUTHORED.size,
    )
  })
})
