import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { build } from './build.ts'
import { BUDGET_BYTES, BUDGET_ENTRIES, kb } from './budget.ts'
import { familyOf, variationOf } from './classify.ts'
import { foldByName, readDataset } from './dataset.ts'
import { mintedId } from './ids.ts'
import { readFrozenIds } from './source.ts'
import type { CataloguePayload } from './types.ts'

/**
 * The catalogue this repository actually ships, checked against the acceptance criteria
 * on the real seven hundred entries rather than on a fixture.
 */

const DATASET = join('tools', 'catalogue', 'dataset')
const SOURCE = join('tools', 'catalogue', 'source')

const result = build({ datasetDir: DATASET, sourceDir: SOURCE, contentDir: 'content' })
if (!result.ok) {
  throw new Error(result.issues.map((issue) => `${issue.where}: ${issue.message}`).join('\n'))
}
const catalogue = result.value

/**
 * The payload objects the build assembled, not a re-parse of its own JSON. The runtime
 * guard that refuses to trust these bytes lives in `src/lib/catalogue.ts`, where they have
 * crossed a network and could be anything.
 */
const payload = (locale: string): CataloguePayload => {
  const found = catalogue.payloads.find((entry) => entry.locale === locale)
  if (found === undefined) throw new Error(`no ${locale} payload`)
  return found.payload
}

const named = (name: string) => catalogue.records.find((entry) => entry.name === name)

describe('AC 1 — the catalogue is built from the dataset', () => {
  it('carries name, ECO, side, defining line and family for an imported entry', () => {
    expect(named('Italian Game: Evans Gambit')).toMatchObject({
      id: 'italian-game-evans-gambit',
      eco: 'C51',
      side: 'white',
      family: 'Italian Game',
      definingLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'],
    })
  })

  it('is several hundred entries, which is the point of importing at all', () => {
    expect(catalogue.records.length).toBeGreaterThan(500)
  })

  it('populates all five fields on every entry (requirement F3)', () => {
    for (const entry of catalogue.records) {
      expect(entry.name).not.toBe('')
      expect(entry.eco).toMatch(/^[A-E]\d{2}$/)
      expect(['white', 'black']).toContain(entry.side)
      expect(entry.definingLine.length).toBeGreaterThan(0)
      expect(['sound', 'dubious', 'unsound']).toContain(entry.soundness)
    }
  })

  /**
   * F3's own verification: a fixed list of gambits a learner would go looking for, each
   * asserted to resolve. A count can grow while the Evans quietly falls out of it.
   */
  it('resolves every gambit on a fixed spot-check list', () => {
    const wanted = [
      'italian-game-evans-gambit',
      'italian-game-scotch-gambit',
      'italian-game-jerome-gambit',
      'kings-gambit',
      'kings-gambit-accepted',
      'kings-gambit-declined-falkbeer-countergambit',
      'blackmar-diemer-gambit',
      'benko-gambit',
      'latvian-gambit',
      'englund-gambit',
      'danish-gambit',
      'elephant-gambit',
      'vienna-game-vienna-gambit',
      'sicilian-defense-smith-morra-gambit',
      'sicilian-defense-wing-gambit',
      'scotch-game-goring-gambit',
      'indian-defense-budapest-gambit',
      'dutch-defense-staunton-gambit',
      'scandinavian-defense-portuguese-gambit',
      'four-knights-game-halloween-gambit',
      'petrovs-defense-stafford-gambit',
      'petrovs-defense-cochrane-gambit',
      'philidor-defense-philidor-countergambit',
      'ruy-lopez-marshall-attack',
      'blumenfeld-countergambit',
      'bird-opening-froms-gambit',
      'legals-mate',
      'fishing-pole-trap',
      'elephant-trap',
      'lasker-trap',
      'damiano-defence-refutation',
    ]
    const published = new Set(catalogue.records.map((entry) => entry.id))
    expect(wanted.filter((id) => !published.has(id))).toEqual([])
  })
})

describe('AC 2 — classification is a reviewed decision', () => {
  it('keeps the Queen’s Gambit out, because it is not a sacrifice', () => {
    const queens = catalogue.records.filter(
      (entry) =>
        entry.name.startsWith("Queen's Gambit") && !entry.name.includes('Albin Countergambit'),
    )
    expect(queens).toEqual([])
  })

  it('keeps the Albin Countergambit in, which the same head would have excluded', () => {
    expect(named("Queen's Gambit Declined: Albin Countergambit")?.side).toBe('black')
  })

  it('admits the Marshall Attack, which the dataset never calls a gambit', () => {
    expect(named('Ruy Lopez: Marshall Attack')?.side).toBe('black')
  })

  it('admits the Fried Liver and the Traxler for the same reason', () => {
    expect(named('Italian Game: Two Knights Defense, Fried Liver Attack')?.side).toBe('white')
    expect(named('Italian Game: Two Knights Defense, Traxler Counterattack')?.side).toBe('black')
  })

  it('flips the side where the gambiteer inside a family is the other player', () => {
    expect(named("King's Gambit Accepted")?.side).toBe('white')
    expect(named("King's Gambit Declined: Falkbeer Countergambit")?.side).toBe('black')
  })
})

describe('AC 3 — ids are frozen', () => {
  const frozen = readFrozenIds(SOURCE)

  it('publishes exactly the ids the committed map holds', () => {
    expect(frozen.ok).toBe(true)
    if (!frozen.ok) return
    expect([...catalogue.records.map((entry) => entry.id)].sort()).toEqual(
      Object.keys(frozen.value.entries).sort(),
    )
  })

  it('records the name, ECO and defining line each id was minted from', () => {
    expect(frozen.ok).toBe(true)
    if (!frozen.ok) return
    expect(frozen.value.entries['italian-game-evans-gambit']).toEqual({
      name: 'Italian Game: Evans Gambit',
      eco: 'C51',
      definingLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'],
    })
  })

  it('keeps every id inside the bound the runtime loader enforces', () => {
    for (const entry of catalogue.records) {
      expect(entry.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(entry.id.length).toBeLessThanOrEqual(64)
    }
  })
})

describe('AC 4 — traps are hand-curated and not imported', () => {
  it('carries the named traps, with their own ECO codes', () => {
    const traps = catalogue.records.filter((entry) => entry.category === 'trap')
    expect(traps.map((entry) => entry.id)).toContain('legals-mate')
    expect(traps.length).toBeGreaterThanOrEqual(10)
  })

  /**
   * The honest number. Breadth is free for gambits and is not free for traps, and the
   * catalogue must not imply otherwise — so this test asserts the gap rather than hiding
   * it: hundreds of gambits arrived from a file, every trap was typed out.
   */
  it('has far fewer traps than gambits, and that is the shape of the work', () => {
    const traps = catalogue.records.filter((entry) => entry.category === 'trap').length
    const gambits = catalogue.records.filter((entry) => entry.category === 'gambit').length
    expect(gambits).toBeGreaterThan(traps * 20)
  })

  it('leaves every trap line ending on the learner’s own ply (invariant 5)', () => {
    // Proved by the build refusing anything else; see `adversarial.test.ts`. Here the
    // assertion is simply that the real file passes it.
    expect(catalogue.records.filter((entry) => entry.category === 'trap').length).toBeGreaterThan(0)
  })
})

describe('AC 5 — entries are grouped into families', () => {
  it('groups the scores of near-identical rows one search term returns', () => {
    const italian = payload('en').families.find((family) => family.name === 'Italian Game')
    expect(italian?.entries.length).toBeGreaterThan(20)
    expect(italian?.entries.map((entry) => entry.variation)).toContain('Evans Gambit')
  })

  it('names the family from the dataset head, and the entry relative to it', () => {
    expect(familyOf('Italian Game: Evans Gambit, Main Line')).toBe('Italian Game')
    expect(variationOf('Italian Game: Evans Gambit, Main Line')).toBe('Evans Gambit, Main Line')
  })

  it('puts a hand-curated trap in the same family as the gambits it sits among', () => {
    const ruyLopez = payload('en').families.find((family) => family.name === 'Ruy Lopez')
    expect(ruyLopez?.entries.some((entry) => entry.id === 'fishing-pole-trap')).toBe(true)
  })
})

describe('AC 6 — one file per locale', () => {
  it('emits all three', () => {
    expect(catalogue.payloads.map((entry) => entry.locale)).toEqual(['vi', 'en', 'fr'])
  })

  it('agrees on everything that is not a name', () => {
    const strip = (locale: string) =>
      payload(locale).families.flatMap((family) =>
        family.entries.map(({ id, eco, category, side, soundness, tier, line }) => ({
          id,
          eco,
          category,
          side,
          soundness,
          tier,
          line,
        })),
      )
    expect(strip('vi')).toEqual(strip('en'))
    expect(strip('fr')).toEqual(strip('en'))
  })

  it('carries one language of names, so a visitor downloads one rather than three', () => {
    const familyName = (locale: string, id: string) =>
      payload(locale).families.find((family) => family.id === id)?.name

    expect(familyName('en', 'kings-gambit-accepted')).toBe("King's Gambit Accepted")
    expect(familyName('fr', 'kings-gambit-accepted')).toBe('Gambit du Roi accepté')
    expect(familyName('vi', 'kings-gambit-accepted')).toBe('Gambit Vua được chấp nhận')
  })

  it('falls back to the canonical English name where no translation is curated', () => {
    const family = (locale: string) =>
      payload(locale).families.find((entry) => entry.id === 'benko-gambit')?.name
    expect(family('fr')).toBe('Gambit Benko')
    // No Vietnamese name for this one is curated yet, and the canonical name is what that
    // field *is* rather than a blank to apologise for (docs/CONTEXT.md, Gambit).
    expect(family('vi')).toBe('Benko Gambit')

    const variation = (locale: string) =>
      payload(locale)
        .families.find((entry) => entry.id === 'italian-game')
        ?.entries.find((entry) => entry.id === 'italian-game-evans-gambit')?.variation
    expect([variation('vi'), variation('en'), variation('fr')]).toEqual([
      'Evans Gambit',
      'Evans Gambit',
      'Evans Gambit',
    ])
  })
})

describe('AC 7 — tier is derived from content and absent from every source file', () => {
  it('is never written in a catalogue source file', () => {
    const files = [
      'classification.yaml',
      'traps.yaml',
      'ids.json',
      'names.vi.yaml',
      'names.fr.yaml',
    ]
    for (const file of files) {
      expect(readFileSync(join(SOURCE, file), 'utf8')).not.toMatch(/^\s*tier:/m)
    }
  })

  /**
   * The Evans was the example here until it was authored (#15), and it is kept as the
   * first half rather than swapped out: a tier follows the content and nothing else, so
   * the entry with a file reads `taught` and its sibling without one still reads `listed`.
   */
  it('defaults an imported entry to listed, which is all the dataset can support', () => {
    expect(named('Italian Game: Evans Gambit')?.tier).toBe('taught')
    expect(named('Italian Game: Evans Gambit Accepted')?.tier).toBe('listed')
  })

  it('takes the tier from the authored entry where one exists', () => {
    // damiano-defence-refutation was the example of a file present with no tree mapped
    // (`outcome: { type: unexplored }`) until #102 gave it one, so it now reads `taught`
    // like any other entry with a real, resolved tree.
    const withContent = catalogue.records.find((entry) => entry.id === 'damiano-defence-refutation')
    expect(withContent?.tier).toBe('taught')

    const withoutContent = build({ datasetDir: DATASET, sourceDir: SOURCE })
    expect(withoutContent.ok).toBe(true)
    if (!withoutContent.ok) return
    expect(withoutContent.value.records.every((entry) => entry.tier === 'listed')).toBe(true)
  })
})

describe('AC 8 — the payload budget', () => {
  it('measures every locale over the whole generated file', () => {
    for (const size of catalogue.sizes) {
      expect(size.entries).toBe(catalogue.records.length)
      expect(size.gzippedBytes).toBeLessThanOrEqual(BUDGET_BYTES)
    }
  })

  /**
   * The ticket states the budget "up to 1,500 entries", and the catalogue is not there
   * yet. So the claim is measured at 1,500 rather than asserted: real dataset names, real
   * ECO codes and real lines, which have the redundancy a synthetic payload would not.
   */
  it('holds at 1,500 entries, measured on real names rather than estimated', () => {
    const dataset = readDataset(DATASET)
    expect(dataset.ok).toBe(true)
    if (!dataset.ok) return

    const rows = foldByName(dataset.value).slice(0, BUDGET_ENTRIES)
    expect(rows).toHaveLength(BUDGET_ENTRIES)

    const families = new Map<string, unknown[]>()
    for (const row of rows) {
      const family = familyOf(row.name)
      families.set(family, [
        ...(families.get(family) ?? []),
        {
          id: mintedId(row.name),
          variation: variationOf(row.name),
          eco: row.eco,
          category: 'gambit',
          side: 'white',
          soundness: 'dubious',
          tier: 'listed',
          line: row.line.join(' '),
        },
      ])
    }

    const json = JSON.stringify({
      locale: 'vi',
      source: catalogue.source,
      counts: {
        entries: rows.length,
        gambits: rows.length,
        traps: 0,
        families: families.size,
        listed: rows.length,
        mapped: 0,
        taught: 0,
      },
      families: [...families].map(([name, entries]) => ({ id: name, name, entries })),
    })

    const gzipped = gzipSync(Buffer.from(json, 'utf8')).byteLength
    expect(
      gzipped,
      `1,500 entries measured ${kb(gzipped)} gzipped, budget ${kb(BUDGET_BYTES)}`,
    ).toBeLessThanOrEqual(BUDGET_BYTES)
  })
})
