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
   * Six hundred and sixty-one entries are authored — three from #15, eleven from #73, ten
   * from #93, ten from #94's group B, ten from #95, twenty-five from #102 (group D,
   * including damiano-defence-refutation's tree), twenty-four from #103 (group E), fifteen
   * from #109 (group F, seven remaining family heads and eight Sicilian short lines),
   * seventeen from #110 (group G, King's Gambit Accepted sub-variations), eighteen from
   * #111 (group H, King's Gambit Accepted sub-variations and the Rousseau Gambit), six
   * from #118 (five new named traps plus the Fajarowicz Defense, upgraded in place from
   * the Tier 0 entry the dataset import already gave its exact defining line), three
   * from #125 (the Lazard Gambit, upgraded in place from its own Tier 0 entry, plus two
   * new named traps: the Smith-Morra Gambit Accepted's Open d-File Trap and the Vienna
   * Game's Frankenstein-Dracula Qd5 Trap), and one from #127 (the Ruy Lopez Exchange
   * Variation's Alapin Gambit, upgraded in place from its own Tier 0 entry — #127 also
   * deepened two already-authored trees, bird-opening-froms-gambit and
   * scandinavian-defense-kiel-variation-trap, without adding new ids), two new named traps
   * from #137 batch a (the Stafford Gambit's Rosen Trap and the Traxler Counterattack's Ke2
   * Trap), two more new named traps from #137 batch b (Petrov's Defense's Marshall Trap and
   * the Tennison Gambit's Brigg's Trap), one more new named trap from #137 batch c (the
   * Milner-Barry Trap), thirteen from #136 batch B (elephant-gambit-maroczy-gambit,
   * elephant-gambit-paulsen-countergambit, english-opening-wing-gambit,
   * englund-gambit-felbecker-gambit, englund-gambit-hartlaub-charlick-gambit,
   * englund-gambit-main-line, englund-gambit-mosquito-gambit, englund-gambit-soller-gambit,
   * englund-gambit-soller-gambit-deferred, englund-gambit-zilbermints-gambit,
   * french-defense-wing-gambit, grob-opening-grob-gambit-declined and
   * hungarian-opening-asten-gambit, each a single root-to-leaf line), and twenty more from
   * #136 batch a (twenty short, single-line entries deepened straight from `listed` to
   * `taught` — a modelled reply to the defining line's sacrifice, ending in a `position`
   * leaf, one branch each), twenty more from #136 batch C (family heads and King's
   * Gambit Declined sub-variations, each a single root-to-leaf line), twenty more from
   * #136 batch d (single-line entries across King's Pawn Game, Latvian Gambit, Modern
   * Defense, Nimzo-Larsen Attack, Nimzowitsch Defense, Owen Defense, Polish Opening,
   * Portuguese Opening, the Queen's Gambit Declined Albin Countergambit, Queen's Pawn Game
   * and Scandinavian Defense families, each a single root-to-leaf line), and twenty more
   * from #136 batch e (scotch-game-alekhine-gambit,
   * scotch-game-goring-gambit-double-pawn-sacrifice, scotch-game-scotch-gambit-advance-variation,
   * sicilian-defense-alapin-variation-anti-alapin-gambit, sicilian-defense-kotov-gambit,
   * sicilian-defense-mcdonnell-attack-tal-gambit, sicilian-defense-morphy-gambit-andreaschek-gambit,
   * sicilian-defense-smith-morra-gambit-deferred, sicilian-defense-wing-gambit-abrahams-variation,
   * sicilian-defense-wing-gambit-marshall-variation, slav-defense-geller-gambit,
   * slav-defense-slav-gambit-alekhine-attack, slav-defense-winawer-countergambit,
   * tarrasch-defense-tarrasch-gambit, vienna-game-frankenstein-dracula-variation,
   * vienna-game-philidor-countergambit, vienna-game-vienna-gambit,
   * vienna-game-vienna-gambit-steinitz-variation, zukertort-opening-lemberger-gambit and
   * zukertort-opening-tennison-gambit, each a single root-to-leaf line except the three
   * (sicilian-defense-alapin-variation-anti-alapin-gambit, sicilian-defense-kotov-gambit and
   * sicilian-defense-mcdonnell-attack-tal-gambit) that model a forced reply to an
   * intermediate check before their leaf, still one branch each), and three more from #136
   * batch f (danish-gambit-accepted-classical-defense, italian-game-two-knights-defense-fried-liver-attack
   * and petrovs-defense-cochrane-gambit, each a single root-to-leaf line ending on the
   * forced recapture after the gambit's own knight sacrifice), one new named trap from
   * #137 batch c (the Milner-Barry Trap, French Defense Advance Variation), fifty more
   * from #148 batch h (eight King's Gambit Accepted Bishop's Gambit sub-variations, nine
   * Evans Gambit sub-variations, four Falkbeer Countergambit sub-variations, three Four
   * Knights Game sub-variations, seven French Defense family entries, five Grob Opening
   * family entries, one Grünfeld Gambit Accepted, one Gunderam Defense sub-variation, two
   * Hamppe-Allgaier Gambit sub-variations, three Hungarian Opening family entries, five
   * Indian Defense family entries, the Two Knights Defense Traxler Counterattack and the
   * Scotch Gambit family head, each a single root-to-leaf line), fifty-three more
   * from #148 batch j (a broad, diverse spread of family heads and named sub-variations
   * across dozens of opening families — Ruy Lopez, Scandinavian, Scotch, Sicilian,
   * Semi-Slav, Tarrasch, Torre/Trompowsky, Two Knights, Van Geet, Vant Kruijs, Vienna,
   * Ware and Zukertort among them, authored by five parallel sub-agents against a shared,
   * pre-verified move/material spec — each a single root-to-leaf line, listed individually
   * in the PR rather than here), fifty more from #148 batch g (Accelerated London
   * System, Benko Gambit Declined sub-variations, Benoni Defense family entries, Bird
   * Opening, Bishop's Opening, Blackmar-Diemer Gambit sub-variations, Budapest Gambit
   * Accepted sub-variations, Caro-Kann Defense, Center Game, Danish Gambit Accepted
   * sub-variations, Dutch Defense, English Opening, Englund Gambit Declined sub-variations
   * and other family heads and named sub-variations, each a single root-to-leaf line,
   * listed individually in the PR rather than here), and fifty more from #148 batch i
   * (kings-gambit-accepted-ghulam-kassim-gambit, kings-gambit-accepted-hanstein-gambit,
   * kings-gambit-accepted-kieseritzky-gambit and its Berlin, Brentano and Kolisch Defenses,
   * kings-gambit-accepted-mayet-gambit, kings-gambit-accepted-mcdonnell-gambit,
   * kings-gambit-accepted-muzio-gambit-wild-muzio-gambit, kings-gambit-accepted-philidor-gambit
   * and its Schultz Variation, kings-gambit-accepted-rosentreter-gambit and its Sörensen
   * Gambit, kings-gambit-accepted-salvio-gambit,
   * kings-gambit-accepted-schallopp-defense-tashkent-attack,
   * kings-gambit-accepted-sorensen-gambit, kings-gambit-accepted-tartakower-gambit-weiss-defense,
   * kings-gambit-accepted-traditional-variation,
   * kings-gambit-declined-classical-soldatenkov-variation, the Falkbeer Countergambit's
   * Modern Transfer and Staunton Line, kings-gambit-declined-hobbs-zilbermints-gambit, the
   * Norwalde Variation's Bücker and Schubert Gambits, the Panteldakis Countergambit's
   * Shirazi Line, kings-pawn-game-busch-gass-gambit-chiodini-gambit,
   * kings-pawn-game-philidor-gambit, kings-pawn-game-schulze-muller-gambit,
   * kings-pawn-game-tayler-opening-basman-gambit, kings-pawn-game-weber-gambit, the Latvian
   * Gambit's Leonhardt Variation, Behting Variation and both Corkscrew lines,
   * modern-defense-masur-gambit, nimzo-indian-defense-classical-variation-belyavsky-gambit,
   * the Nimzowitsch Defense Kennedy Variation's Bielefelder, de Smet, Hammer and Herford
   * Gambits, panov-attack-fianchetto-defense-fianchetto-gambit,
   * petrovs-defense-moody-gambit, petrovs-defense-stafford-gambit-accepted, the Philidor
   * Defense's Bird Gambit, Morphy Gambit, Philidor Countergambit and Philidor Gambit, and
   * the Albin Countergambit's Modern Line, Spassky Variation and Tartakower Defense — each a
   * single root-to-leaf line), fifty more from #162 batch k (nine Blackmar-Diemer Gambit
   * Accepted defenses — Bogoljubow, Gunderam, Holwell, Kaulich, Pietrowsky, Ritter, Schlutter,
   * Teichmann and Ziegler — seven Blackmar-Diemer Gambit Declined defenses — Elbert
   * Countergambit, Gedult, Lamb, Langeheinicke, O'Kelly, Vienna and Weinsbach — the
   * Blackmar-Diemer Gambit's own Netherlands Variation, eleven Benko Gambit Accepted
   * sub-variations and systems (Dlugy, Fully Accepted, Modern, Pawn Return, Zaitsev System,
   * Central Storming, Yugoslav, Zaitsev/Nescafe Frappe, Nd2, Nescafe Frappe Attack and
   * Fianchetto), and twenty-three further family heads and named sub-variations spread across
   * the Bishop's Opening, Bird Opening, English Opening, English Defense, Englund Gambit
   * Declined, Dutch Defense Staunton Gambit, Blumenfeld Countergambit and Italian Game
   * families, each a single root-to-leaf line), and fifty-two more from #162 batch n (Ruy
   * Lopez Marshall Attack and Schliemann Defense sub-variations, the Scandinavian Portuguese
   * Gambit's Banker and Jadoul Variations, seven Scotch Game/Scotch Gambit sub-variations, the
   * Belgrade Gambit's Modern Defense, the Semi-Slav Marshall Gambit's Tolush Variation, the
   * Delayed Alapin Basman-Palatnik Gambit, sixteen Sicilian Smith-Morra Gambit
   * Accepted/Declined sub-variations, the Sicilian Wing Gambit's Romanian Defense, the Slav
   * Winawer Countergambit's Anti-Winawer Gambit, three Steinitz Gambit defenses, four Two
   * Knights Traxler Counterattack lines (bishop-sacrifice, knight-sacrifice, king-march and the
   * Trenčianske Teplice Gambit), the Modern Defense Suttles/Tal Gambit, two Vienna Gambit with
   * Max Lange Defense entries (Cunningham and Quelle), the Vienna Game's Paulsen Pollock
   * Gambit and Vienna Gambit Bardeleben/Breyer/Main-Line variations, and the French Winawer
   * Alekhine Gambit's Alatortsev Variation — each a single root-to-leaf line), and fifty more from
   * #162 batch l (the
   * Falkbeer Countergambit's Charousek Gambit Keres Variation; the Four Knights Game
   * Halloween Gambit's Oldtimer and Plasma Variations; a French Defense spread — the
   * Alekhine-Chatard Gambit, the la Bourdonnais Variation's Reuter Gambit, the Winawer
   * Variation's Alekhine Gambit Accepted and Kan Variation, and the Baeuerle Gambit; the Grob
   * Opening's Coca-Cola Gambit, Fritz Gambit Romford Countergambit and Zilbermints Gambit
   * Schiller Defense; the Hungarian Opening Wiedenhagen-Beta Gambit; the Indian Defense's
   * Maddigan and Pyrenees Gambits; the Italian Game's Classical Variation Greco Gambit (Greco
   * Variation and Main Line) and a broad sweep of Evans Gambit named sub-variations —
   * Alapin-Steinitz, Anderssen Defense, Cordel Line, Bronstein Defense, Compromised Defense,
   * Lange Variation, Dufresne Defense, Johner Defense, Laroche Variation, Lasker Defense,
   * Leonhardt Countergambit, McDonnell Defense Main Line, Mieses Defense, Mortimer-Evans
   * Gambit, Pierce Defense and Sanders-Alapin Variation — plus Scotch Gambit sub-variations
   * (de Riviere Defense, Double Gambit Accepted, Janowski Defense, Max Lange Attack and its
   * Spielmann Defense); the Kieseritzky Gambit's Berlin Defense De Riviere Variation and
   * Paulsen Defense Deferred; and a King's Gambit Accepted spread — Abbazia Defense and its
   * Main Line, Allgaier Gambit's Horny and Schlechter Defenses, Bishop's Gambit's Bogoljubow
   * Defense, Boren-Svenonius Variation, Bryan Countergambit and Classical Defense, the
   * Blachly Gambit, Cunningham Defense's McCormick Defense and the Double Muzio Gambit's
   * Young Gambit — twelve of the fifty ending one ply further, on the learner's own forced
   * recapture after the modelled reply answers a check or leaves a piece en prise, each
   * still a single root-to-leaf line), and fifty more from #162 batch m (a
   * family-diverse spread across the King's Gambit Accepted Kieseritzky, Muzio and Salvio
   * Gambit sub-variations, King's Gambit Declined sub-variations including the Falkbeer
   * Countergambit and Panteldakis Countergambit families, the whole Latvian Gambit Accepted
   * family, the Philidor Countergambit family, and single entries from the King's Indian
   * Defense, Nimzowitsch Defense, Ponziani Opening, the Portuguese Gambit, the Queen's
   * Gambit Declined Albin Countergambit and the Ruy Lopez — each a single root-to-leaf line,
   * listed individually in the PR rather than here) — and the
   * other 363
   * are Tier 0, with no content file at all. Each authored entry is named here
   * with the number of root-to-leaf lines its tree actually has, rather than the whole set
   * being loosened to "at least zero", which would assert nothing and would keep passing
   * if every tree in the repository disappeared.
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
    ['accelerated-london-system-steinitz-countergambit', 1],
    ['accelerated-london-system-steinitz-countergambit-accepted', 1],
    ['accelerated-london-system-steinitz-countergambit-morris-2', 1],
    ['alekhine-defense-krejcik-variation-krejcik-gambit', 1],
    ['alekhine-defense-osullivan-gambit', 1],
    ['alekhine-defense-scandinavian-variation-geschev-gambit', 1],
    ['alekhine-defense-spielmann-gambit', 1],
    ['amar-opening-paris-gambit-gent-gambit', 1],
    ['barnes-opening-gedult-gambit', 1],
    ['benko-gambit', 9],
    ['benko-gambit-accepted', 1],
    ['benko-gambit-accepted-central-storming-variation', 1],
    ['benko-gambit-accepted-dlugy-variation', 1],
    ['benko-gambit-accepted-fianchetto-variation', 1],
    ['benko-gambit-accepted-fully-accepted-variation', 1],
    ['benko-gambit-accepted-modern-variation', 1],
    ['benko-gambit-accepted-pawn-return-variation', 1],
    ['benko-gambit-accepted-yugoslav', 1],
    ['benko-gambit-declined-bishop-attack', 1],
    ['benko-gambit-declined-hjorring-countergambit', 1],
    ['benko-gambit-declined-main-line', 1],
    ['benko-gambit-declined-pseudo-samisch', 1],
    ['benko-gambit-declined-quiet-line', 1],
    ['benko-gambit-declined-sosonko-variation', 1],
    ['benko-gambit-fianchetto-variation', 0],
    ['benko-gambit-mutkin-countergambit', 1],
    ['benko-gambit-nd2-variation', 1],
    ['benko-gambit-nescafe-frappe-attack', 1],
    ['benko-gambit-zaitsev-system', 1],
    ['benko-gambit-zaitsev-variation-nescafe-frappe-attack', 1],
    ['benoni-defense-benoni-gambit-accepted', 1],
    ['benoni-defense-benoni-gambit-schlenker-defense', 1],
    ['benoni-defense-cormorant-gambit', 1],
    ['benoni-defense-zilbermints-benoni-gambit', 1],
    ['bird-opening-dutch-variation-batavo-gambit', 1],
    ['bird-opening-dutch-variation-dudweiler-gambit', 1],
    ['bird-opening-froms-gambit', 3],
    ['bird-opening-froms-gambit-bahr-gambit', 1],
    ['bird-opening-froms-gambit-lipke-variation', 1],
    ['bird-opening-hobbs-gambit', 1],
    ['bird-opening-hobbs-zilbermints-gambit', 1],
    ['bird-opening-lasker-gambit', 1],
    ['bird-opening-platz-gambit', 1],
    ['bird-opening-schlechter-gambit', 1],
    ['bird-opening-sturm-gambit', 1],
    ['bird-opening-wagner-zwitersch-gambit', 1],
    ['bird-opening-williams-gambit', 1],
    ['bishops-opening-anderssen-gambit', 1],
    ['bishops-opening-boden-kieseritzky-gambit-lichtenhein-defense', 1],
    ['bishops-opening-calabrese-countergambit', 3],
    ['bishops-opening-calabrese-countergambit-jaenisch-variation', 1],
    ['bishops-opening-khan-gambit', 1],
    ['bishops-opening-lewis-countergambit', 1],
    ['bishops-opening-lewis-countergambit-walker-variation', 1],
    ['bishops-opening-lewis-gambit', 1],
    ['bishops-opening-mcdonnell-gambit', 1],
    ['bishops-opening-mcdonnell-gambit-la-bourdonnais-denker-gambit', 1],
    ['bishops-opening-mcdonnell-gambit-mcdonnell-double-gambit', 1],
    ['bishops-opening-ponziani-gambit', 1],
    ['bishops-opening-stein-gambit', 1],
    ['bishops-opening-urusov-gambit', 1],
    ['bishops-opening-urusov-gambit-panov-variation', 1],
    ['bishops-opening-warsaw-gambit', 1],
    ['blackmar-diemer-gambit', 5],
    ['blackmar-diemer-gambit-accepted', 1],
    ['blackmar-diemer-gambit-accepted-bogoljubow-defense', 1],
    ['blackmar-diemer-gambit-accepted-euwe-defense', 1],
    ['blackmar-diemer-gambit-accepted-gunderam-defense', 1],
    ['blackmar-diemer-gambit-accepted-holwell-defense', 1],
    ['blackmar-diemer-gambit-accepted-kaulich-defense', 1],
    ['blackmar-diemer-gambit-accepted-pietrowsky-defense', 1],
    ['blackmar-diemer-gambit-accepted-ritter-defense', 1],
    ['blackmar-diemer-gambit-accepted-ryder-gambit', 1],
    ['blackmar-diemer-gambit-accepted-schlutter-defense', 1],
    ['blackmar-diemer-gambit-accepted-teichmann-defense', 1],
    ['blackmar-diemer-gambit-accepted-ziegler-defense', 1],
    ['blackmar-diemer-gambit-blackmar-gambit', 1],
    ['blackmar-diemer-gambit-declined-brombacher-countergambit', 1],
    ['blackmar-diemer-gambit-declined-elbert-countergambit', 1],
    ['blackmar-diemer-gambit-declined-gedult-defense', 1],
    ['blackmar-diemer-gambit-declined-lamb-defense', 1],
    ['blackmar-diemer-gambit-declined-langeheinicke-defense', 1],
    ['blackmar-diemer-gambit-declined-okelly-defense', 1],
    ['blackmar-diemer-gambit-declined-vienna-defense', 1],
    ['blackmar-diemer-gambit-declined-weinsbach-defense', 1],
    ['blackmar-diemer-gambit-diemer-rosenberg-attack', 1],
    ['blackmar-diemer-gambit-fritz-attack', 1],
    ['blackmar-diemer-gambit-lemberger-countergambit', 1],
    ['blackmar-diemer-gambit-netherlands-variation', 1],
    ['blackmar-diemer-gambit-reversed-albin-countergambit', 1],
    ['blackmar-diemer-gambit-zeller-defense', 1],
    ['blumenfeld-countergambit', 1],
    ['blumenfeld-countergambit-accepted', 1],
    ['blumenfeld-countergambit-duz-khotimirsky-variation', 1],
    ['borg-defense-borg-gambit', 1],
    ['borg-defense-troon-gambit', 1],
    ['borg-defense-zilbermints-gambit', 1],
    ['budapest-gambit-accepted-fajarowicz-defense-bonsdorf-variation', 1],
    ['budapest-gambit-accepted-fajarowicz-defense-steiner-variation', 1],
    ['budapest-gambit-accepted-main-line-adler-variation', 1],
    ['budapest-gambit-accepted-main-line-alekhine-variation', 1],
    ['budapest-gambit-accepted-main-line-rubinstein-variation', 1],
    ['caro-kann-defense-alekhine-gambit', 1],
    ['caro-kann-defense-labahn-attack-double-gambit', 2],
    ['caro-kann-defense-mieses-gambit', 1],
    ['caro-kann-defense-von-hennig-gambit', 1],
    ['carr-defense-zilbermints-gambit', 1],
    ['catalan-opening-hungarian-gambit', 1],
    ['center-game-halasz-mcdonnell-gambit', 1],
    ['center-game-lanc-arnold-gambit', 1],
    ['center-game-ross-gambit', 1],
    ['center-game-von-der-lasa-gambit', 1],
    ['classical-variation-greco-gambit-anderssen-variation', 1],
    ['classical-variation-rubinstein-countergambit', 1],
    ['damiano-defence-refutation', 2],
    ['danish-gambit', 4],
    ['danish-gambit-accepted', 1],
    ['danish-gambit-accepted-chigorin-defense', 1],
    ['danish-gambit-accepted-classical-defense', 1],
    ['danish-gambit-accepted-copenhagen-defense', 1],
    ['danish-gambit-accepted-schlechter-defense', 1],
    ['danish-gambit-accepted-svenonius-defense', 1],
    ['danish-gambit-declined-sorensen-defense', 1],
    ['duras-gambit', 1],
    ['dutch-defense-bellon-gambit', 1],
    ['dutch-defense-krejcik-gambit', 1],
    ['dutch-defense-omega-isis-gambit', 1],
    ['dutch-defense-staunton-gambit', 1],
    ['dutch-defense-staunton-gambit-accepted', 1],
    ['dutch-defense-staunton-gambit-american-attack', 1],
    ['dutch-defense-staunton-gambit-chigorin-variation', 1],
    ['dutch-defense-staunton-gambit-nimzowitsch-variation', 1],
    ['dutch-defense-staunton-gambit-tartakower-variation', 1],
    ['elephant-gambit', 1],
    ['elephant-gambit-maroczy-gambit', 1],
    ['elephant-gambit-paulsen-countergambit', 1],
    ['elephant-trap', 1],
    ['english-defense-eastbourne-gambit', 1],
    ['english-opening-achilles-omega-gambit', 1],
    ['english-opening-anglo-dutch-defense-hickmann-gambit', 1],
    ['english-opening-anglo-scandinavian-defense-lohn-gambit', 1],
    ['english-opening-anglo-scandinavian-defense-schulz-gambit', 1],
    ['english-opening-jaenisch-gambit', 1],
    ['english-opening-myers-gambit', 1],
    ['english-opening-wade-gambit', 1],
    ['english-opening-wing-gambit', 1],
    ['english-opening-zilbermints-gambit', 1],
    ['englund-gambit', 5],
    ['englund-gambit-declined', 1],
    ['englund-gambit-declined-reversed-alekhine', 1],
    ['englund-gambit-declined-reversed-brooklyn', 1],
    ['englund-gambit-declined-reversed-french', 1],
    ['englund-gambit-declined-reversed-krebs', 1],
    ['englund-gambit-declined-reversed-mokele-mbembe', 1],
    ['englund-gambit-felbecker-gambit', 1],
    ['englund-gambit-hartlaub-charlick-gambit', 1],
    ['englund-gambit-main-line', 1],
    ['englund-gambit-mosquito-gambit', 1],
    ['englund-gambit-soller-gambit', 1],
    ['englund-gambit-soller-gambit-deferred', 1],
    ['englund-gambit-stockholm-variation', 1],
    ['englund-gambit-trap', 6],
    ['englund-gambit-zilbermints-gambit', 1],
    ['falkbeer-countergambit-charousek-gambit-accepted', 1],
    ['falkbeer-countergambit-charousek-gambit-keres-variation', 1],
    ['falkbeer-countergambit-charousek-gambit-old-line', 1],
    ['falkbeer-countergambit-milner-barry-variation', 1],
    ['falkbeer-countergambit-nimzowitsch-marshall-countergambit', 1],
    ['falkbeer-countergambit-rubinstein-variation', 1],
    ['fishing-pole-trap', 3],
    ['four-knights-game-halloween-gambit', 1],
    ['four-knights-game-halloween-gambit-oldtimer-variation', 1],
    ['four-knights-game-halloween-gambit-plasma-variation', 1],
    ['four-knights-game-italian-variation-noa-gambit', 1],
    ['four-knights-game-scotch-variation-belgrade-gambit', 1],
    ['four-knights-game-scotch-variation-krause-gambit', 1],
    ['french-defense-advance-variation-milner-barry-gambit', 1],
    ['french-defense-alapin-gambit', 1],
    ['french-defense-alekhine-chatard-attack-albin-chatard-gambit', 1],
    ['french-defense-baeuerle-gambit', 1],
    ['french-defense-banzai-leong-gambit', 3],
    ['french-defense-carlson-gambit', 1],
    ['french-defense-diemer-duhm-gambit', 1],
    ['french-defense-diemer-duhm-gambit-accepted', 1],
    ['french-defense-la-bourdonnais-variation-reuter-gambit', 1],
    ['french-defense-marshall-gambit', 1],
    ['french-defense-morphy-gambit', 1],
    ['french-defense-winawer-variation-alekhine-gambit-accepted', 1],
    ['french-defense-winawer-variation-alekhine-gambit-kan-variation', 1],
    ['french-defense-wing-gambit', 1],
    ['grob-opening-alessi-gambit', 1],
    ['grob-opening-double-grob-coca-cola-gambit', 1],
    ['grob-opening-grob-gambit', 1],
    ['grob-opening-grob-gambit-basman-gambit', 1],
    ['grob-opening-grob-gambit-declined', 1],
    ['grob-opening-grob-gambit-fritz-gambit', 1],
    ['grob-opening-grob-gambit-fritz-gambit-romford-countergambit', 1],
    ['grob-opening-grob-gambit-richter-grob-gambit', 1],
    ['grob-opening-romford-countergambit', 1],
    ['grob-opening-zilbermints-gambit-schiller-defense', 1],
    ['grunfeld-defense-brinckmann-attack-grunfeld-gambit-accepted', 1],
    ['grunfeld-defense-gibbon-gambit', 1],
    ['gunderam-defense-stader-variation', 1],
    ['halosar-trap', 3],
    ['hamppe-allgaier-gambit-alapin-variation', 1],
    ['hamppe-allgaier-gambit-thorold-variation', 1],
    ['horwitz-defense-zilbermints-gambit', 1],
    ['hungarian-opening-asten-gambit', 1],
    ['hungarian-opening-bucker-gambit', 1],
    ['hungarian-opening-pachman-gambit', 1],
    ['hungarian-opening-van-kuijk-gambit', 1],
    ['hungarian-opening-wiedenhagen-beta-gambit', 1],
    ['hungarian-opening-winterberg-gambit', 1],
    ['indian-defense-anti-grunfeld-adorjan-gambit', 1],
    ['indian-defense-budapest-gambit', 5],
    ['indian-defense-budapest-gambit-accepted', 1],
    ['indian-defense-budapest-gambit-accepted-fajarowicz-defense', 1],
    ['indian-defense-gibbins-weidenhagen-gambit', 3],
    ['indian-defense-gibbins-weidenhagen-gambit-accepted', 1],
    ['indian-defense-gibbins-weidenhagen-gambit-oshima-defense', 1],
    ['indian-defense-lazard-gambit', 2],
    ['indian-defense-maddigan-gambit', 1],
    ['indian-defense-omega-gambit', 1],
    ['indian-defense-pyrenees-gambit', 1],
    ['irish-gambit', 1],
    ['italian-game-blackburne-kostic-gambit', 2],
    ['italian-game-classical-variation-greco-gambit-greco-variation', 1],
    ['italian-game-classical-variation-greco-gambit-main-line', 1],
    ['italian-game-evans-gambit', 6],
    ['italian-game-evans-gambit-accepted', 1],
    ['italian-game-evans-gambit-alapin-steinitz-variation', 1],
    ['italian-game-evans-gambit-anderssen-defense', 1],
    ['italian-game-evans-gambit-anderssen-variation', 1],
    ['italian-game-evans-gambit-anderssen-variation-cordel-line', 1],
    ['italian-game-evans-gambit-bronstein-defense', 1],
    ['italian-game-evans-gambit-compromised-defense', 1],
    ['italian-game-evans-gambit-declined', 1],
    ['italian-game-evans-gambit-declined-lange-variation', 1],
    ['italian-game-evans-gambit-dufresne-defense', 1],
    ['italian-game-evans-gambit-fontaine-countergambit', 1],
    ['italian-game-evans-gambit-hein-countergambit', 1],
    ['italian-game-evans-gambit-johner-defense', 1],
    ['italian-game-evans-gambit-laroche-variation', 1],
    ['italian-game-evans-gambit-lasker-defense', 1],
    ['italian-game-evans-gambit-leonhardt-countergambit', 1],
    ['italian-game-evans-gambit-main-line', 1],
    ['italian-game-evans-gambit-mayet-defense', 1],
    ['italian-game-evans-gambit-mcdonnell-defense', 1],
    ['italian-game-evans-gambit-mcdonnell-defense-main-line', 1],
    ['italian-game-evans-gambit-mieses-defense', 1],
    ['italian-game-evans-gambit-mortimer-evans-gambit', 1],
    ['italian-game-evans-gambit-pierce-defense', 1],
    ['italian-game-evans-gambit-sanders-alapin-variation', 1],
    ['italian-game-evans-gambit-stone-ware-variation', 1],
    ['italian-game-jerome-gambit', 1],
    ['italian-game-rosentreter-gambit', 1],
    ['italian-game-rousseau-gambit', 1],
    ['italian-game-scotch-gambit', 1],
    ['italian-game-scotch-gambit-de-riviere-defense', 1],
    ['italian-game-scotch-gambit-double-gambit-accepted', 1],
    ['italian-game-scotch-gambit-janowski-defense', 1],
    ['italian-game-scotch-gambit-max-lange-attack', 1],
    ['italian-game-scotch-gambit-max-lange-attack-spielmann-defense', 1],
    ['italian-game-two-knights-defense-fried-liver-attack', 1],
    ['italian-game-two-knights-defense-traxler-counterattack', 1],
    ['kadas-opening-kadas-gambit', 1],
    ['kadas-opening-schneider-gambit', 1],
    ['kadas-opening-steinbok-gambit', 1],
    ['kieninger-trap', 4],
    ['kieseritzky-gambit-berlin-defense-de-riviere-variation', 1],
    ['kieseritzky-gambit-paulsen-defense-deferred', 1],
    ['kings-gambit', 5],
    ['kings-gambit-accepted', 1],
    ['kings-gambit-accepted-abbazia-defense', 1],
    ['kings-gambit-accepted-abbazia-defense-main-line', 1],
    ['kings-gambit-accepted-allgaier-horny-defense', 1],
    ['kings-gambit-accepted-allgaier-schlechter-defense', 1],
    ['kings-gambit-accepted-basman-gambit', 1],
    ['kings-gambit-accepted-becker-defense', 1],
    ['kings-gambit-accepted-bishops-gambit', 1],
    ['kings-gambit-accepted-bishops-gambit-anderssen-defense', 1],
    ['kings-gambit-accepted-bishops-gambit-anderssen-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-bledow-countergambit', 1],
    ['kings-gambit-accepted-bishops-gambit-bledow-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-boden-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-bogoljubow-defense', 1],
    ['kings-gambit-accepted-bishops-gambit-bogoljubow-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-boren-svenonius-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-bryan-countergambit', 1],
    ['kings-gambit-accepted-bishops-gambit-classical-defense', 1],
    ['kings-gambit-accepted-bishops-gambit-cozio-defense', 1],
    ['kings-gambit-accepted-bishops-gambit-cozio-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-first-jaenisch-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-gianutio-gambit', 1],
    ['kings-gambit-accepted-bishops-gambit-greco-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-kieseritzky-gambit', 1],
    ['kings-gambit-accepted-bishops-gambit-lopez-defense', 1],
    ['kings-gambit-accepted-bishops-gambit-lopez-variation', 1],
    ['kings-gambit-accepted-bishops-gambit-maurian-defense', 1],
    ['kings-gambit-accepted-bishops-gambit-steinitz-defense', 1],
    ['kings-gambit-accepted-blachly-gambit', 1],
    ['kings-gambit-accepted-bonsch-osmolovsky-variation', 1],
    ['kings-gambit-accepted-breyer-gambit', 1],
    ['kings-gambit-accepted-carrera-gambit', 1],
    ['kings-gambit-accepted-cunningham-defense', 1],
    ['kings-gambit-accepted-cunningham-defense-mccormick-defense', 1],
    ['kings-gambit-accepted-dodo-variation', 1],
    ['kings-gambit-accepted-double-muzio-gambit-young-gambit', 1],
    ['kings-gambit-accepted-eisenberg-variation', 1],
    ['kings-gambit-accepted-fischer-defense', 1],
    ['kings-gambit-accepted-gaga-gambit', 1],
    ['kings-gambit-accepted-ghulam-kassim-gambit', 1],
    ['kings-gambit-accepted-gianutio-countergambit', 1],
    ['kings-gambit-accepted-greco-gambit', 1],
    ['kings-gambit-accepted-hanstein-gambit', 1],
    ['kings-gambit-accepted-kieseritzky-gambit', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-anderssen-cordel-gambit', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-anderssen-defense', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-berlin-defense', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-brentano-defense', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-kolisch-defense', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-long-whip', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-neumann-defense', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-paulsen-defense', 1],
    ['kings-gambit-accepted-kieseritzky-gambit-rice-gambit', 1],
    ['kings-gambit-accepted-kieseritzky-polerio-defense', 1],
    ['kings-gambit-accepted-kings-knights-gambit', 1],
    ['kings-gambit-accepted-macleod-defense', 1],
    ['kings-gambit-accepted-mason-keres-gambit', 1],
    ['kings-gambit-accepted-mayet-gambit', 1],
    ['kings-gambit-accepted-mcdonnell-gambit', 1],
    ['kings-gambit-accepted-middleton-countergambit', 1],
    ['kings-gambit-accepted-modern-defense', 1],
    ['kings-gambit-accepted-muzio-gambit-accepted-froms-defense', 1],
    ['kings-gambit-accepted-muzio-gambit-brentano-defense', 1],
    ['kings-gambit-accepted-muzio-gambit-holloway-defense', 1],
    ['kings-gambit-accepted-muzio-gambit-sarratt-defense', 1],
    ['kings-gambit-accepted-muzio-gambit-wild-muzio-gambit', 1],
    ['kings-gambit-accepted-orsini-gambit', 1],
    ['kings-gambit-accepted-paris-gambit', 1],
    ['kings-gambit-accepted-philidor-gambit', 1],
    ['kings-gambit-accepted-philidor-gambit-schultz-variation', 1],
    ['kings-gambit-accepted-quaade-gambit', 1],
    ['kings-gambit-accepted-rosentreter-gambit', 1],
    ['kings-gambit-accepted-rosentreter-gambit-sorensen-gambit', 1],
    ['kings-gambit-accepted-salvio-gambit', 1],
    ['kings-gambit-accepted-salvio-gambit-anderssen-counterattack', 1],
    ['kings-gambit-accepted-salvio-gambit-cochrane-gambit', 1],
    ['kings-gambit-accepted-salvio-gambit-silberschmidt-defense', 1],
    ['kings-gambit-accepted-salvio-gambit-viennese-variation', 1],
    ['kings-gambit-accepted-schallopp-defense', 1],
    ['kings-gambit-accepted-schallopp-defense-tashkent-attack', 1],
    ['kings-gambit-accepted-schurig-gambit-with-bb5', 1],
    ['kings-gambit-accepted-schurig-gambit-with-bd3', 1],
    ['kings-gambit-accepted-silberschmidt-gambit', 1],
    ['kings-gambit-accepted-sorensen-gambit', 1],
    ['kings-gambit-accepted-stamma-gambit', 1],
    ['kings-gambit-accepted-tartakower-gambit', 1],
    ['kings-gambit-accepted-tartakower-gambit-weiss-defense', 1],
    ['kings-gambit-accepted-traditional-variation', 1],
    ['kings-gambit-accepted-tumbleweed', 1],
    ['kings-gambit-accepted-villemson-gambit', 1],
    ['kings-gambit-accepted-wagenbach-defense', 1],
    ['kings-gambit-declined-classical-hanham-variation', 1],
    ['kings-gambit-declined-classical-soldatenkov-variation', 1],
    ['kings-gambit-declined-classical-variation', 1],
    ['kings-gambit-declined-falkbeer-countergambit', 1],
    ['kings-gambit-declined-falkbeer-countergambit-accepted', 1],
    ['kings-gambit-declined-falkbeer-countergambit-alapin-variation', 1],
    ['kings-gambit-declined-falkbeer-countergambit-charousek-gambit', 1],
    ['kings-gambit-declined-falkbeer-countergambit-charousek-variation', 1],
    ['kings-gambit-declined-falkbeer-countergambit-hinrichsen-gambit', 1],
    ['kings-gambit-declined-falkbeer-countergambit-modern-transfer', 1],
    ['kings-gambit-declined-falkbeer-countergambit-staunton-line', 1],
    ['kings-gambit-declined-hobbs-zilbermints-gambit', 1],
    ['kings-gambit-declined-keene-defense', 1],
    ['kings-gambit-declined-keenes-defense', 1],
    ['kings-gambit-declined-mafia-defense', 1],
    ['kings-gambit-declined-miles-defense', 1],
    ['kings-gambit-declined-norwalde-variation', 1],
    ['kings-gambit-declined-norwalde-variation-bucker-gambit', 1],
    ['kings-gambit-declined-norwalde-variation-schubert-variation', 1],
    ['kings-gambit-declined-panteldakis-countergambit', 1],
    ['kings-gambit-declined-panteldakis-countergambit-shirazi-line', 1],
    ['kings-gambit-declined-petrovs-defense', 1],
    ['kings-gambit-declined-queens-knight-defense', 1],
    ['kings-gambit-declined-soller-zilbermints-gambit', 1],
    ['kings-gambit-declined-zilbermints-double-countergambit', 1],
    ['kings-gambit-declined-zilbermints-double-gambit', 1],
    ['kings-indian-attack-omega-delta-gambit', 1],
    ['kings-indian-defense-samisch-variation-samisch-gambit', 1],
    ['kings-indian-defense-samisch-variation-samisch-gambit-accepted', 1],
    ['kings-pawn-game-bavarian-gambit', 2],
    ['kings-pawn-game-beyer-gambit', 1],
    ['kings-pawn-game-busch-gass-gambit', 1],
    ['kings-pawn-game-busch-gass-gambit-chiodini-gambit', 1],
    ['kings-pawn-game-clam-variation-kings-gambit-reversed', 1],
    ['kings-pawn-game-gunderam-defense-gunderam-gambit', 1],
    ['kings-pawn-game-gunderam-gambit', 1],
    ['kings-pawn-game-macleod-attack-norwalde-gambit', 1],
    ['kings-pawn-game-pachman-wing-gambit', 1],
    ['kings-pawn-game-philidor-gambit', 1],
    ['kings-pawn-game-schulze-muller-gambit', 1],
    ['kings-pawn-game-tayler-opening-basman-gambit', 1],
    ['kings-pawn-game-wayward-queen-attack-kiddie-countergambit', 1],
    ['kings-pawn-game-weber-gambit', 1],
    ['kings-pawn-opening-van-hooydoon-gambit', 1],
    ['lasker-trap', 1],
    ['latvian-gambit', 5],
    ['latvian-gambit-accepted', 1],
    ['latvian-gambit-accepted-bilguer-variation', 1],
    ['latvian-gambit-accepted-bronstein-attack', 1],
    ['latvian-gambit-accepted-bronstein-gambit', 1],
    ['latvian-gambit-accepted-foltys-leonhardt-variation', 1],
    ['latvian-gambit-accepted-foltys-variation', 1],
    ['latvian-gambit-accepted-leonhardt-variation', 1],
    ['latvian-gambit-accepted-main-line', 1],
    ['latvian-gambit-accepted-nimzowitsch-attack', 1],
    ['latvian-gambit-behting-variation', 1],
    ['latvian-gambit-clam-gambit', 1],
    ['latvian-gambit-corkscrew-countergambit', 1],
    ['latvian-gambit-corkscrew-gambit', 1],
    ['latvian-gambit-diepstraten-countergambit', 1],
    ['latvian-gambit-lobster-gambit', 1],
    ['latvian-gambit-mason-countergambit', 1],
    ['latvian-gambit-mayet-attack', 1],
    ['latvian-gambit-mlotkowski-variation', 1],
    ['legals-mate', 7],
    ['lion-defense-anti-philidor-lions-cave-lion-claw-gambit', 1],
    ['mexican-defense-horsefly-gambit', 1],
    ['mikenas-defense-pozarek-gambit', 1],
    ['milner-barry-trap', 1],
    ['modern-defense-lizard-defense-pirc-diemer-gambit', 1],
    ['modern-defense-masur-gambit', 1],
    ['modern-defense-westermann-gambit', 1],
    ['modern-defense-wind-gambit', 1],
    ['monticelli-trap', 1],
    ['morphy-defense-schliemann-defense-deferred-jaenisch-gambit', 1],
    ['mortimer-trap', 1],
    ['muzio-gambit-kling-and-horwitz-counterattack', 1],
    ['nimzo-indian-defense-classical-variation-belyavsky-gambit', 1],
    ['nimzo-indian-defense-dilworth-gambit', 1],
    ['nimzo-larsen-attack-norfolk-gambit', 1],
    ['nimzo-larsen-attack-pachman-gambit', 1],
    ['nimzo-larsen-attack-ringelbach-gambit', 1],
    ['nimzowitsch-defense-colorado-countergambit', 1],
    ['nimzowitsch-defense-colorado-countergambit-accepted', 1],
    ['nimzowitsch-defense-hornung-gambit', 1],
    ['nimzowitsch-defense-kennedy-variation-bielefelder-gambit', 1],
    ['nimzowitsch-defense-kennedy-variation-de-smet-gambit', 1],
    ['nimzowitsch-defense-kennedy-variation-hammer-gambit', 1],
    ['nimzowitsch-defense-kennedy-variation-herford-gambit', 1],
    ['nimzowitsch-defense-wheeler-gambit', 2],
    ['noahs-ark-trap', 1],
    ['old-indian-defense-aged-gibbon-gambit', 1],
    ['owen-defense-naselwaus-gambit', 1],
    ['owen-defense-smith-gambit', 1],
    ['owen-defense-wind-gambit', 1],
    ['panov-attack-fianchetto-defense-fianchetto-gambit', 1],
    ['panteldakis-countergambit-pawn-sacrifice-line', 1],
    ['panteldakis-countergambit-symmetrical-variation', 1],
    ['petrovs-defense-cochrane-gambit', 1],
    ['petrovs-defense-marshall-trap', 1],
    ['petrovs-defense-moody-gambit', 1],
    ['petrovs-defense-stafford-gambit', 1],
    ['petrovs-defense-stafford-gambit-accepted', 1],
    ['philidor-defense-bird-gambit', 1],
    ['philidor-defense-lopez-countergambit', 2],
    ['philidor-defense-morphy-gambit', 1],
    ['philidor-defense-philidor-countergambit', 1],
    ['philidor-defense-philidor-countergambit-berger-variation', 1],
    ['philidor-defense-philidor-countergambit-del-rio-attack', 1],
    ['philidor-defense-philidor-countergambit-zukertort-variation', 1],
    ['philidor-defense-philidor-gambit', 1],
    ['pirc-defense-roscher-gambit', 1],
    ['polish-defense-spassky-gambit-accepted', 1],
    ['polish-opening-birmingham-gambit', 1],
    ['polish-opening-tartakower-gambit', 1],
    ['ponziani-opening-ponziani-countergambit', 1],
    ['ponziani-opening-ponziani-countergambit-schmidt-attack', 1],
    ['ponziani-opening-vukovic-gambit', 1],
    ['portuguese-gambit-melbourne-shuffle-variation', 1],
    ['portuguese-opening-miguel-gambit', 1],
    ['portuguese-opening-portuguese-gambit', 1],
    ['queens-gambit-declined-albin-countergambit', 1],
    ['queens-gambit-declined-albin-countergambit-fianchetto-variation', 1],
    ['queens-gambit-declined-albin-countergambit-modern-line', 1],
    ['queens-gambit-declined-albin-countergambit-normal-line', 1],
    ['queens-gambit-declined-albin-countergambit-spassky-variation', 1],
    ['queens-gambit-declined-albin-countergambit-tartakower-defense', 1],
    ['queens-indian-defense-classical-variation-polugaevsky-gambit', 1],
    ['queens-pawn-game-chigorin-variation-irish-gambit', 1],
    ['queens-pawn-game-hubsch-gambit', 1],
    ['queens-pawn-game-zurich-gambit', 1],
    ['rat-defense-english-rat-lisbon-gambit', 1],
    ['reti-opening-zilbermints-gambit', 1],
    ['richter-veresov-attack-malich-gambit', 2],
    ['rubinstein-trap', 1],
    ['ruy-lopez-berlin-defense-rio-gambit-accepted', 1],
    ['ruy-lopez-closed-center-attack-basque-gambit', 1],
    ['ruy-lopez-closed-chigorin-defense-gajewski-gambit', 1],
    ['ruy-lopez-exchange-variation-alapin-gambit', 3],
    ['ruy-lopez-halloween-attack', 1],
    ['ruy-lopez-marshall-attack', 1],
    ['ruy-lopez-marshall-attack-main-line', 1],
    ['ruy-lopez-marshall-attack-re3-variation', 1],
    ['ruy-lopez-marshall-attack-steiner-variation', 1],
    ['ruy-lopez-morphy-defense-jaffe-gambit', 1],
    ['ruy-lopez-morphy-defense-norwegian-variation-nightingale-gambit', 1],
    ['ruy-lopez-open-karpov-gambit', 1],
    ['ruy-lopez-open-skipworth-gambit', 1],
    ['ruy-lopez-schliemann-defense', 1],
    ['ruy-lopez-schliemann-defense-dyckhoff-variation', 1],
    ['ruy-lopez-schliemann-defense-jaenisch-gambit-accepted', 1],
    ['ruy-lopez-spanish-countergambit', 1],
    ['ruy-lopez-steinitz-defense-center-gambit', 1],
    ['scandinavian-defense-blackburne-gambit', 1],
    ['scandinavian-defense-blackburne-kloosterboer-gambit', 1],
    ['scandinavian-defense-boehnke-gambit', 1],
    ['scandinavian-defense-icelandic-palme-gambit', 1],
    ['scandinavian-defense-kadas-gambit', 1],
    ['scandinavian-defense-kiel-variation-trap', 3],
    ['scandinavian-defense-main-line-leonhardt-gambit', 1],
    ['scandinavian-defense-portuguese-gambit', 1],
    ['scandinavian-defense-portuguese-gambit-banker-variation', 1],
    ['scandinavian-defense-portuguese-gambit-jadoul-variation', 1],
    ['scandinavian-defense-zilbermints-gambit', 2],
    ['scandinavian-variation-bogoljubow-variation-richter-gambit', 1],
    ['scotch-game-alekhine-gambit', 1],
    ['scotch-game-goring-gambit', 2],
    ['scotch-game-goring-gambit-bardeleben-variation', 1],
    ['scotch-game-goring-gambit-double-pawn-sacrifice', 1],
    ['scotch-game-goring-gambit-main-line', 1],
    ['scotch-game-haxo-gambit', 1],
    ['scotch-game-napoleon-gambit', 1],
    ['scotch-game-relfsson-gambit', 1],
    ['scotch-game-scotch-gambit', 4],
    ['scotch-game-scotch-gambit-advance-variation', 1],
    ['scotch-game-scotch-gambit-cochrane-anderssen-variation', 1],
    ['scotch-game-scotch-gambit-dubois-reti-defense', 1],
    ['scotch-game-scotch-gambit-goring-gambit-declined', 1],
    ['scotch-game-scotch-gambit-kingside-variation', 1],
    ['scotch-game-scotch-gambit-london-defense', 1],
    ['scotch-game-scotch-gambit-sarratt-variation', 1],
    ['scotch-variation-belgrade-gambit-modern-defense', 1],
    ['scotch-variation-krause-gambit-leonhardt-defense', 1],
    ['semi-slav-defense-anti-moscow-gambit', 1],
    ['semi-slav-defense-gunderam-gambit', 1],
    ['semi-slav-defense-marshall-gambit', 1],
    ['semi-slav-defense-marshall-gambit-main-line', 1],
    ['semi-slav-defense-marshall-gambit-tolush-variation', 1],
    ['semi-slav-defense-noteboom-variation-anti-noteboom-gambit', 1],
    ['siberian-trap', 1],
    ['sicilian-defense-alapin-variation-anti-alapin-gambit', 1],
    ['sicilian-defense-brussels-gambit', 1],
    ['sicilian-defense-coles-sicilian-gambit', 1],
    ['sicilian-defense-delayed-alapin-variation-basman-palatnik-gambit', 1],
    ['sicilian-defense-double-dutch-gambit', 1],
    ['sicilian-defense-euwe-attack-prins-gambit', 1],
    ['sicilian-defense-halasz-gambit', 1],
    ['sicilian-defense-kotov-gambit', 1],
    ['sicilian-defense-kronberger-variation-nemeth-gambit', 1],
    ['sicilian-defense-mcdonnell-attack-tal-gambit', 1],
    ['sicilian-defense-modern-variations-ginsberg-gambit', 1],
    ['sicilian-defense-morphy-gambit', 1],
    ['sicilian-defense-morphy-gambit-andreaschek-gambit', 1],
    ['sicilian-defense-moscow-variation-haag-gambit', 1],
    ['sicilian-defense-najdorf-variation-dekker-gambit', 1],
    ['sicilian-defense-okelly-variation-normal-system-cortlever-gambit', 1],
    ['sicilian-defense-okelly-variation-wing-gambit', 1],
    ['sicilian-defense-polish-gambit', 1],
    ['sicilian-defense-portsmouth-gambit', 1],
    ['sicilian-defense-smith-morra-gambit', 4],
    ['sicilian-defense-smith-morra-gambit-accepted', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-chicago-defense', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-classical-formation', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-danish-variation', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-fianchetto-defense', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-finegold-defense', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-kan-formation', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-larsen-defense', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-morphy-defense', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-paulsen-formation', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-pin-defense', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-siberian-variation', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-sozin-formation', 1],
    ['sicilian-defense-smith-morra-gambit-accepted-taimanov-formation', 1],
    ['sicilian-defense-smith-morra-gambit-declined-center-formation', 1],
    ['sicilian-defense-smith-morra-gambit-deferred', 1],
    ['sicilian-defense-wing-gambit', 1],
    ['sicilian-defense-wing-gambit-abrahams-variation', 1],
    ['sicilian-defense-wing-gambit-marshall-variation', 1],
    ['sicilian-defense-wing-gambit-romanian-defense', 1],
    ['slav-defense-diemer-gambit', 1],
    ['slav-defense-geller-gambit', 1],
    ['slav-defense-slav-gambit-alekhine-attack', 1],
    ['slav-defense-winawer-countergambit', 1],
    ['slav-defense-winawer-countergambit-anti-winawer-gambit', 1],
    ['smith-morra-gambit-accepted-morphy-defense-deferred', 1],
    ['smith-morra-gambit-accepted-open-d-file-trap', 1],
    ['smith-morra-gambit-accepted-scheveningen-formation', 1],
    ['sodium-attack-durkin-gambit', 1],
    ['st-george-defense-zilbermints-gambit', 1],
    ['stafford-gambit-rosen-trap', 2],
    ['steinitz-gambit-fraser-minckwitz-defense', 1],
    ['steinitz-gambit-paulsen-defense', 1],
    ['steinitz-gambit-sorensen-defense', 1],
    ['tarrasch-defense-classical-variation-classical-tarrasch-gambit', 1],
    ['tarrasch-defense-grunfeld-gambit', 1],
    ['tarrasch-defense-schara-gambit', 1],
    ['tarrasch-defense-tarrasch-gambit', 1],
    ['tarrasch-defense-von-hennig-gambit', 1],
    ['tarrasch-trap', 1],
    ['tarrasch-variation-open-system-shaposhnikov-gambit', 1],
    ['torre-attack-classical-defense-petrosian-gambit', 1],
    ['torre-attack-wagner-gambit', 1],
    ['traxler-counterattack-ke2-trap', 1],
    ['trompowsky-attack-edge-variation-hergert-gambit', 1],
    ['trompowsky-attack-raptor-variation-hergert-gambit', 1],
    ['two-knights-defense-traxler-counterattack-bishop-sacrifice-line', 1],
    ['two-knights-defense-traxler-counterattack-king-march-line', 1],
    ['two-knights-defense-traxler-counterattack-knight-sacrifice-line', 1],
    ['two-knights-defense-traxler-variation-trencianske-teplice-gambit', 1],
    ['two-knights-defense-ulvestad-variation-kurkin-gambit', 1],
    ['two-knights-variation-suttles-variation-tal-gambit', 1],
    ['van-geet-opening-berlin-gambit', 1],
    ['van-geet-opening-dougherty-gambit', 1],
    ['van-geet-opening-hector-gambit', 1],
    ['van-geet-opening-laroche-gambit', 2],
    ['van-geet-opening-sleipnir-gambit', 1],
    ['vant-kruijs-opening-keoni-hiva-gambit-akahi-variation', 1],
    ['vant-kruijs-opening-keoni-hiva-gambit-alua-variation', 1],
    ['vienna-gambit-with-max-lange-defense', 2],
    ['vienna-gambit-with-max-lange-defense-cunningham-defense', 1],
    ['vienna-gambit-with-max-lange-defense-knight-variation', 1],
    ['vienna-gambit-with-max-lange-defense-pierce-gambit', 1],
    ['vienna-gambit-with-max-lange-defense-quelle-gambit', 1],
    ['vienna-game-adams-gambit', 1],
    ['vienna-game-frankenstein-dracula-qd5-trap', 3],
    ['vienna-game-frankenstein-dracula-variation', 1],
    ['vienna-game-fyfe-gambit', 3],
    ['vienna-game-omaha-gambit', 1],
    ['vienna-game-paulsen-variation-pollock-gambit', 1],
    ['vienna-game-philidor-countergambit', 1],
    ['vienna-game-vienna-gambit', 1],
    ['vienna-game-vienna-gambit-bardeleben-variation', 1],
    ['vienna-game-vienna-gambit-breyer-variation', 1],
    ['vienna-game-vienna-gambit-main-line', 1],
    ['vienna-game-vienna-gambit-steinitz-variation', 1],
    ['vienna-game-wurzburger-trap', 1],
    ['ware-opening-ware-gambit', 1],
    ['ware-opening-wing-gambit', 1],
    ['winawer-variation-alekhine-gambit-alatortsev-variation', 1],
    ['zukertort-opening-herrstrom-gambit', 1],
    ['zukertort-opening-lemberger-gambit', 1],
    ['zukertort-opening-lisitsyn-gambit', 1],
    ['zukertort-opening-ross-gambit', 1],
    ['zukertort-opening-shabalov-gambit', 1],
    ['zukertort-opening-tennison-gambit', 1],
    ['zukertort-opening-tennison-gambit-briggs-trap', 1],
    ['zukertort-opening-vos-gambit', 1],
  ])

  it('bakes keys on all 1024 entries, and only the authored six hundred and sixty-one have any', () => {
    expect(result.value.records).toHaveLength(1024)
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
