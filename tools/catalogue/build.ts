import { loadContent } from '../content/entries.ts'
import type { Entry } from '../content/types.ts'
import type { PayloadSize } from './budget.ts'
import { checkBudget, measure } from './budget.ts'
import { classify } from './classify.ts'
import type { DatasetSource } from './dataset.ts'
import { foldByName, readDataset, readDatasetSource, replayLine } from './dataset.ts'
import type { Mintable, Rename } from './ids.ts'
import { indexFrozen, lineKey, missingPublishedIds, renames, resolveIds, slugify } from './ids.ts'
import type { CuratedNames, CuratedTrap } from './source.ts'
import { readClassification, readFrozenIds, readNames, readTraps } from './source.ts'
import type {
  CatalogueIssue,
  CataloguePayload,
  CatalogueRecord,
  CatalogueResult,
  Locale,
} from './types.ts'
import { LOCALES } from './types.ts'

/**
 * Assembling the catalogue.
 *
 * Three sources meet here and each contributes a different thing:
 *
 * - the vendored dataset contributes **gambits** — names, ECO codes and defining lines,
 *   in bulk, at essentially no cost;
 * - `traps.yaml` contributes **traps**, one at a time, by hand. "Breadth is free" is true
 *   of the first and false of the second (ADR-0008), and the counts this build prints keep
 *   that visible rather than letting one number imply the other;
 * - `content/` contributes **tiers**. A tier is derived from the content itself and never
 *   written anywhere (invariant 8), so an entry with no authored file is `listed` and one
 *   with a mapped or fully annotated tree says so because its tree says so.
 *
 * Build-time only. The output is a static JSON file per locale.
 */

export type BuildOptions = {
  readonly datasetDir: string
  readonly sourceDir: string
  /** Omitted by fixtures, which have no authored content to join against. */
  readonly contentDir?: string | undefined
}

export type BuildOutput = {
  readonly records: readonly CatalogueRecord[]
  readonly payloads: readonly {
    readonly locale: Locale
    readonly payload: CataloguePayload
    readonly json: string
  }[]
  readonly sizes: readonly PayloadSize[]
  readonly source: DatasetSource
  readonly datasetRows: number
  readonly foldedRows: number
  readonly excludedGambitRows: number
  readonly renamed: readonly Rename[]
}

const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Codepoint order, not locale order. The emitted files are a build artefact compared byte
 * for byte between runs, and locale collation varies with the ICU data a machine ships.
 * Presentation order is the catalogue page's decision, not this one's.
 */
const compareRecords = (a: CatalogueRecord, b: CatalogueRecord): number =>
  order(a.family, b.family) || order(a.variation, b.variation) || order(a.id, b.id)

/**
 * The ECO cross-check, and the exemption that has to come with it.
 *
 * An authored gambit's ECO code must agree with the dataset row its defining line
 * resolves to; drift between the two is how a catalogue and a gambit page come to show
 * different codes for the same opening. `category: trap` is exempt, because a trap line
 * resolves to whatever opening it sits inside — Légal's Mate is a Philidor, the Elephant
 * Trap is a Queen's Gambit Declined — so the check would compare a trap against an
 * opening and pass on the wrong answer (ADR-0008, ADR-0004 check 11).
 */
const contentIssues = (
  entries: readonly { readonly file: string; readonly entry: Entry }[],
  byId: ReadonlyMap<string, CatalogueRecord>,
): readonly CatalogueIssue[] =>
  entries.flatMap(({ file, entry }) => {
    const record = byId.get(entry.id)
    if (record === undefined) {
      return [
        {
          where: file,
          message:
            `\`${entry.id}\` is not in the catalogue. An authored entry that appears in no ` +
            'catalogue source file is unreachable: nothing links to it and nothing lists it. ' +
            'Imported gambits arrive from the dataset; a trap has to be added to ' +
            '`tools/catalogue/source/traps.yaml` by hand.',
        },
      ]
    }

    const issues: CatalogueIssue[] = []

    if (record.category !== entry.category) {
      issues.push({
        where: file,
        message:
          `is \`category: ${entry.category}\` and the catalogue has \`${record.category}\`. ` +
          'The two decide different things — the ECO check and the trap source file — and they ' +
          'cannot disagree.',
      })
    }

    if (entry.category !== 'trap' && record.eco !== entry.eco) {
      issues.push({
        where: file,
        message:
          `has ECO \`${entry.eco}\` and the dataset gives \`${record.eco}\` for this line ` +
          '(ADR-0004 check 11). Traps are exempt from this check and this entry is not one.',
      })
    }

    const authored = lineKey(entry.definingLine)
    const catalogued = lineKey(record.definingLine)
    if (!authored.startsWith(catalogued) && !catalogued.startsWith(authored)) {
      issues.push({
        where: file,
        message:
          `has defining line \`${authored}\` and the catalogue has \`${catalogued}\`. One must ` +
          'be a prefix of the other: a defining line may run one ply further than the dataset ' +
          "row so that it ends with the learner's own ply (invariant 5), but it may not be a " +
          'different line under the same id.',
      })
    }

    return issues
  })

/**
 * A hand-entered trap line is checked the way an imported one is, and for one more thing.
 *
 * Every line is replayed from the starting position, so a typo is a build failure rather
 * than a page showing moves that cannot be played. And the line must end with the
 * **learner's own ply**: invariant 5 needs the opponent's mistake to be a modelled reply
 * carrying a quality, and a trap whose defining line already contains the losing move
 * leaves nowhere to put that quality. Getting this wrong is not detectable later — the
 * entry validates, and the one thing the trap exists to teach cannot be expressed.
 */
const trapIssues = (trap: CuratedTrap, file: string): readonly CatalogueIssue[] => {
  const replayed = replayLine(trap.line)
  if (replayed === undefined) {
    return [
      {
        where: `${file} ${trap.id}`,
        message: `\`${trap.line.join(' ')}\` is not a legal sequence from the starting position.`,
      },
    ]
  }

  const issues: CatalogueIssue[] = []
  if (replayed.line.join(' ') !== trap.line.join(' ')) {
    issues.push({
      where: `${file} ${trap.id}`,
      message:
        `is spelt \`${trap.line.join(' ')}\` and canonical SAN for it is ` +
        `\`${replayed.line.join(' ')}\`. One spelling per move, or a URL built from a line ` +
        'stops matching the content it names.',
    })
  }
  if (replayed.sideToMove === trap.side) {
    issues.push({
      where: `${file} ${trap.id}`,
      message:
        `has \`side: ${trap.side}\` and its defining line leaves ${trap.side} to move. A ` +
        "defining line ends with the learner's own ply, so that the opponent's mistake is a " +
        'modelled reply that can carry a quality (docs/CONTEXT.md, invariant 5). Drop or add ' +
        'one ply.',
    })
  }
  return issues
}

const localisedPayload = (
  locale: Locale,
  records: readonly CatalogueRecord[],
  names: CuratedNames,
  source: DatasetSource,
): CataloguePayload => {
  const families = new Map<string, CatalogueRecord[]>()
  for (const record of records) {
    families.set(record.family, [...(families.get(record.family) ?? []), record])
  }

  return {
    locale,
    source,
    counts: {
      entries: records.length,
      gambits: records.filter((record) => record.category === 'gambit').length,
      traps: records.filter((record) => record.category === 'trap').length,
      families: families.size,
      listed: records.filter((record) => record.tier === 'listed').length,
      mapped: records.filter((record) => record.tier === 'mapped').length,
      taught: records.filter((record) => record.tier === 'taught').length,
    },
    families: [...families].map(([family, members]) => ({
      id: slugify(family),
      name: names.families?.[family] ?? family,
      entries: members.map((record) => ({
        id: record.id,
        variation: names.entries?.[record.id] ?? record.variation,
        eco: record.eco,
        category: record.category,
        side: record.side,
        soundness: record.soundness,
        tier: record.tier,
        line: lineKey(record.definingLine),
      })),
    })),
  }
}

/**
 * Everything the catalogue wants an id for, in one list: imported gambits first, then the
 * hand-curated traps. `catalogue:freeze` mints ids for whatever is not in the map yet, and
 * the build refuses to proceed until they are committed.
 */
export const collectMintables = (options: BuildOptions): CatalogueResult<readonly Mintable[]> => {
  const dataset = readDataset(options.datasetDir)
  const classification = readClassification(options.sourceDir)
  const traps = readTraps(options.sourceDir)

  const issues: CatalogueIssue[] = []
  for (const result of [dataset, classification, traps]) {
    if (!result.ok) issues.push(...result.issues)
  }
  if (!dataset.ok || !classification.ok || !traps.ok) return { ok: false, issues }

  const { classified, issues: classifyIssues } = classify(
    foldByName(dataset.value),
    classification.value,
    `${options.sourceDir}/classification.yaml`,
  )
  if (classifyIssues.length > 0) return { ok: false, issues: classifyIssues }

  return {
    ok: true,
    value: [
      ...classified.included.map((row) => ({
        name: row.row.name,
        eco: row.row.eco,
        definingLine: row.row.line,
      })),
      ...traps.value.traps.map((trap) => ({
        id: trap.id,
        name: trap.name,
        eco: trap.eco,
        definingLine: trap.line,
      })),
    ],
  }
}

export const build = (options: BuildOptions): CatalogueResult<BuildOutput> => {
  const issues: CatalogueIssue[] = []

  const source = readDatasetSource(options.datasetDir)
  const dataset = readDataset(options.datasetDir)
  const classification = readClassification(options.sourceDir)
  const traps = readTraps(options.sourceDir)
  const frozen = readFrozenIds(options.sourceDir)

  for (const result of [source, dataset, classification, traps, frozen]) {
    if (!result.ok) issues.push(...result.issues)
  }
  if (!source.ok || !dataset.ok || !classification.ok || !traps.ok || !frozen.ok) {
    return { ok: false, issues }
  }

  const classificationFile = `${options.sourceDir}/classification.yaml`
  const trapsFile = `${options.sourceDir}/traps.yaml`
  const idsFile = `${options.sourceDir}/ids.json`

  const folded = foldByName(dataset.value)
  const { classified, issues: classifyIssues } = classify(
    folded,
    classification.value,
    classificationFile,
  )
  issues.push(...classifyIssues)

  const gambits: readonly Mintable[] = classified.included.map((row) => ({
    name: row.row.name,
    eco: row.row.eco,
    definingLine: row.row.line,
  }))
  for (const trap of traps.value.traps) issues.push(...trapIssues(trap, trapsFile))

  const trapMintables: readonly Mintable[] = traps.value.traps.map((trap) => ({
    id: trap.id,
    name: trap.name,
    eco: trap.eco,
    definingLine: trap.line,
  }))

  const { index, issues: indexIssues } = indexFrozen(frozen.value, idsFile)
  issues.push(...indexIssues)

  const gambitIds = resolveIds(index, gambits, classificationFile)
  const trapIds = resolveIds(index, trapMintables, trapsFile)
  issues.push(...gambitIds.issues, ...trapIds.issues)

  const byLine = new Map(classified.included.map((row) => [lineKey(row.row.line), row]))
  const gambitRecords: readonly CatalogueRecord[] = gambitIds.resolved.flatMap(
    ({ id, mintable }) => {
      const row = byLine.get(lineKey(mintable.definingLine))
      if (row === undefined) return []
      return [
        {
          id,
          name: row.row.name,
          family: row.family,
          variation: row.variation,
          eco: row.row.eco,
          category: 'gambit',
          side: row.side,
          soundness: row.soundness,
          tier: 'listed',
          definingLine: row.row.line,
        },
      ]
    },
  )

  const trapsByLine = new Map(traps.value.traps.map((trap) => [lineKey(trap.line), trap]))
  const trapRecords: readonly CatalogueRecord[] = trapIds.resolved.flatMap(({ id, mintable }) => {
    const trap = trapsByLine.get(lineKey(mintable.definingLine))
    if (trap === undefined) return []
    if (trap.id !== id) {
      issues.push({
        where: `${trapsFile} ${trap.id}`,
        message:
          `is frozen as \`${id}\`. A hand-curated id may not be edited after it is published ` +
          '(docs/CONTEXT.md, invariant 9); the frozen map is the authority.',
      })
      return []
    }
    return [
      {
        id,
        name: trap.name,
        family: trap.family,
        variation: trap.name,
        eco: trap.eco,
        category: 'trap',
        side: trap.side,
        soundness: trap.soundness,
        tier: 'listed',
        definingLine: trap.line,
      },
    ]
  })

  const untiered = [...gambitRecords, ...trapRecords].sort(compareRecords)

  /**
   * Two entries on one defining line. An id is looked up by the line, so this is always
   * what a duplicate id means — and it is easy to reach by accident: the hand-curated
   * Blackburne Shilling Trap has exactly the line the dataset calls the Blackburne-Kostić
   * Gambit. Two entries there would be two URLs for one opening, and the loser is whichever
   * one nobody links to.
   */
  const byId = new Map<string, CatalogueRecord[]>()
  for (const record of untiered) {
    byId.set(record.id, [...(byId.get(record.id) ?? []), record])
  }
  for (const [id, sharing] of byId) {
    if (sharing.length > 1) {
      issues.push({
        where: idsFile,
        message:
          `\`${id}\` names ${sharing.length} entries — ${sharing
            .map((record) => `\`${record.name}\``)
            .join(' and ')} — because they share the defining line ` +
          `\`${lineKey(sharing[0]?.definingLine ?? [])}\`. An id is looked up by its line, so one ` +
          'position is one entry. Drop one, or give it a line of its own.',
      })
    }
  }

  let records = untiered
  if (options.contentDir !== undefined) {
    const content = loadContent(options.contentDir)
    if (!content.ok) {
      issues.push(
        ...content.issues.map((issue) => ({
          where: issue.file,
          message: `${issue.message} The catalogue is not built from content that fails the gate.`,
        })),
      )
    } else {
      const byId = new Map(untiered.map((record) => [record.id, record]))
      issues.push(...contentIssues(content.entries, byId))
      const tiers = new Map(content.entries.map(({ entry }) => [entry.id, entry.tier]))
      records = untiered.map((record) => ({ ...record, tier: tiers.get(record.id) ?? record.tier }))
    }
  }

  issues.push(
    ...missingPublishedIds(
      index,
      records.map((record) => record.id),
      idsFile,
    ),
  )

  const familySlugs = new Map<string, string>()
  for (const record of records) {
    const slug = slugify(record.family)
    const existing = familySlugs.get(slug)
    if (existing !== undefined && existing !== record.family) {
      issues.push({
        where: idsFile,
        message:
          `families \`${existing}\` and \`${record.family}\` both slug to \`${slug}\`, so one ` +
          'family would swallow the other in the emitted catalogue.',
      })
    }
    familySlugs.set(slug, record.family)
  }

  const payloads = LOCALES.map((locale) => {
    const names = readNames(options.sourceDir, locale)
    if (!names.ok) issues.push(...names.issues)
    const payload = localisedPayload(locale, records, names.ok ? names.value : {}, source.value)
    return { locale, payload, json: JSON.stringify(payload) }
  })

  const sizes = payloads.map(({ locale, json }) => measure(locale, records.length, json))
  issues.push(...checkBudget(sizes))

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    value: {
      records,
      payloads,
      sizes,
      source: source.value,
      datasetRows: dataset.value.length,
      foldedRows: folded.length,
      excludedGambitRows: classified.excluded,
      renamed: renames(index, [...gambitIds.resolved, ...trapIds.resolved]),
    },
  }
}
