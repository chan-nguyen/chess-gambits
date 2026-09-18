import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { branchKey, countableBranches } from '../../src/components/progress/branches.ts'
import { compileEntry } from '../content/compile.ts'
import { loadContent } from '../content/entries.ts'
import { build } from './build.ts'
import { makeWorkspace } from './fixture-workspace.ts'
import type { CatalogueEntryPayload, CataloguePayload } from './types.ts'

/**
 * The branch keys the catalogue bakes in, and the one thing that must be true of them: they
 * are the keys the gambit page would compute, not a second answer to the same question.
 *
 * The catalogue deliberately downloads no entry tree — that is why 1,003 entries cost 26.3KB
 * gzipped, keys included — so a card cannot walk one itself, and a card that showed a
 * different total from the page it links to would be worse than a card that showed none.
 * The guarantee is structural rather than asserted: the build calls `countableBranches`
 * from `src/components/progress/branches.ts`. These tests are what keeps that structure
 * from being quietly replaced by a copy.
 *
 * **Keys rather than a count** since issue #48. A count is enough for the denominator and
 * not for the numerator: a card holding only a total can clamp the marks it finds in storage
 * against it, where the page intersects them with the keys its tree has, and the two part
 * company the moment a mark outlives its branch. So what is pinned here is the list, in
 * order, and not merely its length.
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
      const expected = countableBranches(compileEntry(entry).tree)
      expect(findEntry(payload, entry.id).branchKeys).toStrictEqual(expected)
    }
  })

  it('counts the fixture Evans as one branch, not zero and not two', () => {
    expect(findEntry(payload, 'italian-game-evans-gambit').branchKeys).toHaveLength(1)
  })

  /**
   * The keys are the ones a learner's marks are written in, so they have to be the strings
   * `?line=` carries rather than any other spelling of the same path (`branchKey`). A card
   * intersecting against a differently-spelled list would count every mark as stale and
   * print a taught entry as untouched.
   */
  it('bakes the key the URL carries, not some other spelling of the path', () => {
    expect(findEntry(payload, 'italian-game-evans-gambit').branchKeys).toStrictEqual([
      branchKey(['Bxb4']),
    ])
  })

  /**
   * The rule this ticket was told to import rather than fork: an `unexplored` leaf is not
   * a branch (docs/design-system.md, *Progress is a count, not a percentage*). Every entry
   * with no authored file is Tier 0, whose whole tree is one unexplored root, so a build
   * that had forked the rule — or counted leaves instead of lines — would show a one here
   * on all 699 of them.
   */
  it('is empty for an entry with no authored tree', () => {
    const listed = entriesOf(payload).filter((entry) => entry.tier === 'listed')

    expect(listed.length).toBeGreaterThan(0)
    for (const entry of listed) expect(entry.branchKeys).toStrictEqual([])
  })

  it('is on every entry of every locale, so no locale shows a card without a total', () => {
    for (const { payload: localised } of output.payloads) {
      for (const entry of entriesOf(localised)) {
        expect(Array.isArray(entry.branchKeys)).toBe(true)
        for (const key of entry.branchKeys) expect(typeof key).toBe('string')
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
   * One hundred and thirty-two entries are authored — three from #15, eleven from #73, ten
   * from #93, ten from #94's group B, ten from #95, twenty-five from #102 (group D,
   * including damiano-defence-refutation's tree), twenty-four from #103 (group E), fifteen
   * from #109 (group F, seven remaining family heads and eight Sicilian short lines),
   * seventeen from #110 (group G, King's Gambit Accepted sub-variations), and six from #118
   * (five new named traps plus the Fajarowicz Defense, upgraded in place from the Tier 0
   * entry the dataset import already gave its exact defining line) — and the other 876 are
   * Tier 0, with no content file at all. Each authored entry is named here with the
   * number of root-to-leaf lines its tree actually has, rather than the whole set being
   * loosened to "at least zero", which would assert nothing and would keep passing if every
   * tree in the repository disappeared.
   *
   * Seven of #110's seventeen (Bishop's Gambit, Carrera, Dodo, Gaga, King's Knight's
   * Gambit, Paris and Stamma) genuinely level out — real analysis, pushed as far as it
   * honestly goes, finds no decisive advantage for either side — and say so plainly in a
   * `position` leaf rather than stopping at `unexplored`, which would teach a learner
   * nothing (docs/CONTEXT.md: `unexplored` means "not mapped yet", not "mapped and level").
   * Each still has exactly one root-to-leaf line, so each is named here with `1` the same
   * as every other single-branch entry.
   *
   * This is the assertion the test was written to force: the day a mapped entry lands, the
   * number that appears here has to appear because content changed. It did five times, and
   * every time these lines changed with it, deliberately and by name — including once,
   * #109, where the count itself was updated correctly but this paragraph's number was
   * not, which is why the paragraph is worth re-deriving from the map rather than trusted
   * on sight the next time it changes.
   */
  const AUTHORED: ReadonlyMap<string, number> = new Map([
    ['alekhine-defense-krejcik-variation-krejcik-gambit', 1],
    ['amar-opening-paris-gambit-gent-gambit', 1],
    ['barnes-opening-gedult-gambit', 1],
    ['benko-gambit', 9],
    ['benko-gambit-accepted', 1],
    ['benko-gambit-declined-bishop-attack', 1],
    ['benoni-defense-benoni-gambit-accepted', 1],
    ['bird-opening-froms-gambit', 2],
    ['bishops-opening-calabrese-countergambit', 3],
    ['blackmar-diemer-gambit', 5],
    ['blackmar-diemer-gambit-accepted', 1],
    ['blackmar-diemer-gambit-declined-brombacher-countergambit', 1],
    ['blumenfeld-countergambit', 1],
    ['blumenfeld-countergambit-accepted', 1],
    ['borg-defense-borg-gambit', 1],
    ['caro-kann-defense-labahn-attack-double-gambit', 2],
    ['carr-defense-zilbermints-gambit', 1],
    ['catalan-opening-hungarian-gambit', 1],
    ['center-game-halasz-mcdonnell-gambit', 1],
    ['damiano-defence-refutation', 2],
    ['danish-gambit', 4],
    ['danish-gambit-accepted', 1],
    ['danish-gambit-declined-sorensen-defense', 1],
    ['duras-gambit', 1],
    ['dutch-defense-krejcik-gambit', 1],
    ['elephant-gambit', 1],
    ['elephant-trap', 1],
    ['english-defense-eastbourne-gambit', 1],
    ['english-opening-jaenisch-gambit', 1],
    ['englund-gambit', 5],
    ['englund-gambit-declined', 1],
    ['englund-gambit-trap', 6],
    ['fishing-pole-trap', 3],
    ['four-knights-game-halloween-gambit', 1],
    ['french-defense-banzai-leong-gambit', 3],
    ['grob-opening-alessi-gambit', 1],
    ['grunfeld-defense-gibbon-gambit', 1],
    ['halosar-trap', 3],
    ['horwitz-defense-zilbermints-gambit', 1],
    ['hungarian-opening-van-kuijk-gambit', 1],
    ['indian-defense-budapest-gambit', 5],
    ['indian-defense-budapest-gambit-accepted-fajarowicz-defense', 1],
    ['indian-defense-gibbins-weidenhagen-gambit', 3],
    ['irish-gambit', 1],
    ['italian-game-blackburne-kostic-gambit', 2],
    ['italian-game-evans-gambit', 6],
    ['kadas-opening-schneider-gambit', 1],
    ['kieninger-trap', 4],
    ['kings-gambit', 5],
    ['kings-gambit-accepted', 1],
    ['kings-gambit-accepted-basman-gambit', 1],
    ['kings-gambit-accepted-bishops-gambit', 1],
    ['kings-gambit-accepted-breyer-gambit', 1],
    ['kings-gambit-accepted-carrera-gambit', 1],
    ['kings-gambit-accepted-dodo-variation', 1],
    ['kings-gambit-accepted-eisenberg-variation', 1],
    ['kings-gambit-accepted-gaga-gambit', 1],
    ['kings-gambit-accepted-kings-knights-gambit', 1],
    ['kings-gambit-accepted-mason-keres-gambit', 1],
    ['kings-gambit-accepted-orsini-gambit', 1],
    ['kings-gambit-accepted-paris-gambit', 1],
    ['kings-gambit-accepted-schurig-gambit-with-bb5', 1],
    ['kings-gambit-accepted-schurig-gambit-with-bd3', 1],
    ['kings-gambit-accepted-stamma-gambit', 1],
    ['kings-gambit-accepted-tartakower-gambit', 1],
    ['kings-gambit-accepted-tumbleweed', 1],
    ['kings-gambit-accepted-villemson-gambit', 1],
    ['kings-gambit-declined-classical-variation', 1],
    ['kings-indian-attack-omega-delta-gambit', 1],
    ['kings-indian-defense-samisch-variation-samisch-gambit', 1],
    ['kings-pawn-game-bavarian-gambit', 2],
    ['kings-pawn-opening-van-hooydoon-gambit', 1],
    ['lasker-trap', 1],
    ['latvian-gambit', 5],
    ['latvian-gambit-accepted', 1],
    ['legals-mate', 7],
    ['lion-defense-anti-philidor-lions-cave-lion-claw-gambit', 1],
    ['mexican-defense-horsefly-gambit', 1],
    ['mikenas-defense-pozarek-gambit', 1],
    ['modern-defense-lizard-defense-pirc-diemer-gambit', 1],
    ['monticelli-trap', 1],
    ['mortimer-trap', 1],
    ['nimzo-indian-defense-dilworth-gambit', 1],
    ['nimzo-larsen-attack-norfolk-gambit', 1],
    ['nimzowitsch-defense-wheeler-gambit', 2],
    ['noahs-ark-trap', 1],
    ['old-indian-defense-aged-gibbon-gambit', 1],
    ['owen-defense-naselwaus-gambit', 1],
    ['petrovs-defense-stafford-gambit', 1],
    ['philidor-defense-lopez-countergambit', 2],
    ['pirc-defense-roscher-gambit', 1],
    ['polish-defense-spassky-gambit-accepted', 1],
    ['polish-opening-birmingham-gambit', 1],
    ['ponziani-opening-ponziani-countergambit', 1],
    ['portuguese-opening-miguel-gambit', 1],
    ['queens-gambit-declined-albin-countergambit', 1],
    ['queens-indian-defense-classical-variation-polugaevsky-gambit', 1],
    ['queens-pawn-game-zurich-gambit', 1],
    ['rat-defense-english-rat-lisbon-gambit', 1],
    ['reti-opening-zilbermints-gambit', 1],
    ['richter-veresov-attack-malich-gambit', 2],
    ['rubinstein-trap', 1],
    ['ruy-lopez-schliemann-defense', 1],
    ['scandinavian-defense-kiel-variation-trap', 1],
    ['scandinavian-defense-zilbermints-gambit', 2],
    ['scotch-game-goring-gambit', 2],
    ['scotch-game-scotch-gambit', 4],
    ['semi-slav-defense-marshall-gambit', 1],
    ['siberian-trap', 1],
    ['sicilian-defense-brussels-gambit', 1],
    ['sicilian-defense-euwe-attack-prins-gambit', 1],
    ['sicilian-defense-halasz-gambit', 1],
    ['sicilian-defense-morphy-gambit', 1],
    ['sicilian-defense-okelly-variation-wing-gambit', 1],
    ['sicilian-defense-polish-gambit', 1],
    ['sicilian-defense-portsmouth-gambit', 1],
    ['sicilian-defense-smith-morra-gambit', 4],
    ['sicilian-defense-wing-gambit', 1],
    ['slav-defense-diemer-gambit', 1],
    ['sodium-attack-durkin-gambit', 1],
    ['st-george-defense-zilbermints-gambit', 1],
    ['tarrasch-defense-schara-gambit', 1],
    ['tarrasch-trap', 1],
    ['torre-attack-wagner-gambit', 1],
    ['trompowsky-attack-raptor-variation-hergert-gambit', 1],
    ['van-geet-opening-laroche-gambit', 2],
    ['vant-kruijs-opening-keoni-hiva-gambit-akahi-variation', 1],
    ['vienna-gambit-with-max-lange-defense', 2],
    ['vienna-game-fyfe-gambit', 3],
    ['vienna-game-wurzburger-trap', 1],
    ['ware-opening-wing-gambit', 1],
    ['zukertort-opening-herrstrom-gambit', 1],
  ])

  it('bakes keys on all 1008 entries, and only the authored one hundred and thirty-two have any', () => {
    expect(result.value.records).toHaveLength(1008)
    for (const record of result.value.records) {
      expect(record.branchKeys).toHaveLength(AUTHORED.get(record.id) ?? 0)
      // Distinct, because a card counts them into a set: a duplicate would make the
      // denominator larger than the number of branches a learner can ever mark.
      expect(new Set(record.branchKeys).size).toBe(record.branchKeys.length)
    }
    // Every named entry is actually in the catalogue, so a typo in an id above cannot
    // quietly turn this into a test that only checks 1,008 zeroes.
    expect(result.value.records.filter((record) => AUTHORED.has(record.id))).toHaveLength(
      AUTHORED.size,
    )
  })
})
