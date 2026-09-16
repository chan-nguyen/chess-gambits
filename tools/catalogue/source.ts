import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import type { CatalogueIssue, CatalogueResult, Locale } from './types.ts'

/**
 * The curated source files — everything about the catalogue that is a decision rather
 * than a fact read out of the dataset.
 *
 * Four files, four different reasons to exist:
 *
 * - `classification.yaml` decides what counts as a gambit. Classification is a reviewed
 *   decision and never a substring match on the word "Gambit" (ADR-0008): the dataset
 *   calls the Queen's Gambit a gambit and it is the most famous misnomer in chess, and it
 *   does not call the Marshall Attack one although it is a pawn sacrifice.
 * - `traps.yaml` holds `category: trap` entries, which are **not in the dataset at all**.
 *   "Légal's Mate" and "the Fishing Pole" are not opening names, so there is nothing to
 *   import and every one of them is hand-entered, ECO code included.
 * - `ids.json` is the frozen `id -> (name, eco, definingLine)` map (invariant 9). It is
 *   the authority for ids; the dataset feeds display names only.
 * - `names.<locale>.yaml` carries localised display names. Absent a curated translation an
 *   entry shows its canonical English name, which is what that field means.
 *
 * Every schema is strict, so a misspelt key is a failure rather than a silently ignored
 * decision. Build-time only.
 */

const reason = z
  .string()
  .min(20, 'must say why, in a sentence a reviewer can disagree with')
  .refine(
    (value) => !/\b(?:todo|tbd|fixme|xxx|placeholder)\b/i.test(value),
    'looks like placeholder text. A rule without a real reason is not a reviewed decision.',
  )

const side = z.enum(['white', 'black'])
const soundness = z.enum(['sound', 'dubious', 'unsound'])
const eco = z.string().regex(/^[A-E]\d{2}$/, 'must be an ECO code, e.g. C51')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date, e.g. 2026-09-16')
const san = z.string().regex(/^[a-zA-Z0-9x=+#-]{2,10}$/, 'is not a SAN move')
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a kebab-case slug')

/**
 * The ply at which a rule says material is offered, 1-based into the defining line.
 *
 * Naming it is the judgement, and it is the **only** judgement about side this file makes.
 * Which ply is the sacrifice cannot be derived: the King's Gambit Declined contains two
 * proven offers, White's 2.f4 and Black's 2...d5, and taking the first of them labels
 * every Falkbeer row `white`. Choosing between them is a person's job.
 *
 * Everything after that is the build's job and `verifySacrifice` in `classify.ts` does it
 * on a real board: the ply has to exist in every row the rule admits, the move played
 * there has to be the move named, the position after it has to leave the mover materially
 * worse off, and `side` comes out of whose turn it was. `side` is therefore never written
 * beside a `sacrifice` — there is nothing left for an author to get wrong.
 */
const sacrifice = z.strictObject({
  ply: z.int().min(1).max(60),
  move: san,
})

/**
 * A soundness label carrying the provenance the content model already demands of one
 * (`Soundness` in `tools/content/types.ts`): who judged it, when, and — where the label
 * was checked against something published — what.
 *
 * Soundness is not derived and this shape refuses to let it look derived. The bare
 * `soundness: dubious` form is the pre-#36 spelling and inherits the file header's
 * reviewer and date; rules reviewed since carry their own, because a file-level date that
 * moved whenever one rule was touched would claim a re-review of all of them that never
 * happened.
 */
const soundnessJudgement = z.strictObject({
  value: soundness,
  by: z.string().min(1),
  at: isoDate,
  /** A published assessment the label was checked against (issue #36, criterion 4). */
  source: z.string().min(8).optional(),
})

/**
 * `match` is a prefix of a dataset name, taken at a name-segment boundary, and the
 * longest matching rule wins. That is what lets `Queen's Gambit` be excluded wholesale
 * while `Queen's Gambit Declined: Albin Countergambit` — a genuine pawn offer by Black —
 * is included by a longer rule sitting beside it.
 */
const includeRule = z
  .strictObject({
    match: z.string().min(3),
    include: z.literal(true),
    /** Asserted. Allowed only where no `sacrifice` proves it; see `sacrifice` above. */
    side: side.optional(),
    sacrifice: sacrifice.optional(),
    soundness: z.union([soundness, soundnessJudgement]),
    reason,
    /**
     * Admit rows whose name never says "Gambit". Off by default, so a broad rule such as
     * `Italian Game` sweeps in the Evans and the Scotch Gambit but not the Giuoco Piano.
     * A rule that sets it is claiming the dataset simply does not use the word here, which
     * is true of the Marshall Attack and the Traxler, and it must name the line exactly.
     */
    unnamed: z.boolean().optional(),
  })
  .refine(
    (rule) => (rule.side === undefined) !== (rule.sacrifice === undefined),
    'must carry either `sacrifice` — the ply that offers material, from which the build ' +
      'derives the side — or `side`, which only asserts one. Never both: a rule that names ' +
      'the sacrifice has nothing left to assert, and one carrying both invites the two to ' +
      'disagree. Never neither: an entry whose board orientation nobody established is worse ' +
      'than a missing entry.',
  )

/**
 * Why a gambit-named row is kept out.
 *
 * `code` groups the reasons so the build can print a distribution instead of 340
 * sentences (issue #36, criterion 5); `reason` is the sentence, and it is the part a
 * reviewer argues with. A code without a sentence would be a category nobody justified,
 * and a sentence without a code is a decision that cannot be counted.
 */
const exclusionCode = z.enum([
  /** The name says gambit and the defining line gives nothing away. */
  'no-sacrifice',
  /** Something is offered, but not inside the defining line this entry would publish. */
  'sacrifice-outside-line',
  /** Both sides offer inside the line, so which side the learner plays is a coin toss. */
  'ambiguous-side',
  /** The offer is plain and no honest soundness label is available for it. */
  'unassessable',
  /** The word "Gambit" is in the name and nothing under it is ever sacrificed. */
  'misnomer',
  /** Already carried by `traps.yaml`, under its own id and its own ECO code. */
  'duplicate-trap',
])

export type ExclusionCode = z.infer<typeof exclusionCode>

export const EXCLUSION_CODES: readonly ExclusionCode[] = exclusionCode.options

const excludeRule = z.strictObject({
  match: z.string().min(3),
  include: z.literal(false),
  code: exclusionCode,
  reason,
})

const classificationSchema = z.strictObject({
  reviewedBy: z.string().min(1),
  reviewedAt: isoDate,
  basis: reason,
  rules: z.array(z.discriminatedUnion('include', [includeRule, excludeRule])).min(1),
})

export type ClassificationRule = z.infer<typeof includeRule> | z.infer<typeof excludeRule>
export type Classification = z.infer<typeof classificationSchema>

/**
 * A trap carries its own ECO code, hand-entered, and is exempt from the check that an
 * entry's ECO agrees with the dataset row its line resolves to. A trap line resolves to
 * whatever opening it sits inside — Légal's Mate resolves to the Philidor — so that check
 * would compare a trap against an opening and be satisfied by the wrong answer (ADR-0008).
 */
const trapSchema = z.strictObject({
  id: slug.max(64),
  name: z.string().min(1),
  family: z.string().min(1),
  eco,
  side,
  soundness,
  line: z.array(san).min(1),
  reason,
})

const trapsSchema = z.strictObject({
  reviewedBy: z.string().min(1),
  reviewedAt: isoDate,
  basis: reason,
  traps: z.array(trapSchema),
})

export type CuratedTrap = z.infer<typeof trapSchema>
export type CuratedTraps = z.infer<typeof trapsSchema>

const namesSchema = z.strictObject({
  families: z.record(z.string().min(1), z.string().min(1)).optional(),
  entries: z.record(slug, z.string().min(1)).optional(),
})

export type CuratedNames = z.infer<typeof namesSchema>

const frozenEntrySchema = z.strictObject({
  name: z.string().min(1),
  eco,
  definingLine: z.array(san).min(1),
})

const frozenIdsSchema = z.strictObject({
  note: z.string().min(1),
  entries: z.record(slug.max(64), frozenEntrySchema),
})

export type FrozenEntry = z.infer<typeof frozenEntrySchema>
export type FrozenIds = z.infer<typeof frozenIdsSchema>

const zodIssues = (file: string, error: z.ZodError): readonly CatalogueIssue[] =>
  error.issues.map((problem) => ({
    where: `${file} ${problem.path.length === 0 ? '(root)' : problem.path.join('.')}`,
    message: problem.message,
  }))

const readParsed = <T>(
  file: string,
  parseText: (text: string) => unknown,
  schema: z.ZodType<T>,
): CatalogueResult<T> => {
  let raw: unknown
  try {
    raw = parseText(readFileSync(file, 'utf8'))
  } catch (error) {
    return {
      ok: false,
      issues: [{ where: file, message: error instanceof Error ? error.message : String(error) }],
    }
  }
  const result = schema.safeParse(raw)
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: zodIssues(file, result.error) }
}

const readYaml = <T>(file: string, schema: z.ZodType<T>): CatalogueResult<T> =>
  readParsed(file, (text) => parse(text), schema)

const readJson = <T>(file: string, schema: z.ZodType<T>): CatalogueResult<T> =>
  readParsed(file, (text) => JSON.parse(text), schema)

export const readClassification = (dir: string): CatalogueResult<Classification> =>
  readYaml(join(dir, 'classification.yaml'), classificationSchema)

export const readTraps = (dir: string): CatalogueResult<CuratedTraps> =>
  readYaml(join(dir, 'traps.yaml'), trapsSchema)

export const readFrozenIds = (dir: string): CatalogueResult<FrozenIds> =>
  readJson(join(dir, 'ids.json'), frozenIdsSchema)

/**
 * A missing `names.<locale>.yaml` is not a failure: it means no name in that locale has a
 * curated translation yet, and every entry falls back to its canonical English name.
 */
export const readNames = (dir: string, locale: Locale): CatalogueResult<CuratedNames> => {
  const file = join(dir, `names.${locale}.yaml`)
  try {
    readFileSync(file, 'utf8')
  } catch {
    return { ok: true, value: {} }
  }
  return readYaml(file, namesSchema)
}

export const frozenIdsPath = (dir: string): string => join(dir, 'ids.json')

/** Written by `catalogue:freeze` only, and sorted so a diff shows what was added. */
export const serialiseFrozenIds = (frozen: FrozenIds): string => {
  const ids = Object.keys(frozen.entries).sort()
  const entries = ids.map((id) => {
    const entry = frozen.entries[id]
    if (entry === undefined) return ''
    return (
      `    ${JSON.stringify(id)}: { "name": ${JSON.stringify(entry.name)}, ` +
      `"eco": ${JSON.stringify(entry.eco)}, ` +
      `"definingLine": ${JSON.stringify(entry.definingLine)} }`
    )
  })
  return `{\n  "note": ${JSON.stringify(frozen.note)},\n  "entries": {\n${entries.join(',\n')}\n  }\n}\n`
}
