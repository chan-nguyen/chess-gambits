import { z } from 'zod'
import type { ContentIssue } from './issue.ts'
import { joinDataPath } from './issue.ts'
import type { YamlSource } from './yaml-source.ts'

/**
 * The shape of an *authored* content file.
 *
 * Deliberately narrower than the domain model in `types.ts`: there is no `kind`, no `tier`,
 * no FEN and no mate outcome, because those are derived or proved. Every object is strict,
 * so a misspelt field is an error rather than silently ignored content.
 *
 * Build-time only (ADR-0004): a schema library is appropriate here because nothing in this
 * file reaches the browser and the bundle budget does not apply.
 */

const PLACEHOLDER = /\b(?:todo|tbd|fixme|xxx|placeholder|lorem ipsum)\b/i
const FILLER = /^[.\-?_*]+$/

/** Prose a learner will read. Empty and placeholder text are failures, not warnings (AC 9). */
const prose = z
  .string()
  .refine((value) => value.trim().length > 0, 'must not be empty or only whitespace')
  .refine(
    (value) => !PLACEHOLDER.test(value) && !FILLER.test(value.trim()),
    'looks like placeholder text (TODO, TBD, FIXME, …). Write it or leave the field out.',
  )

/**
 * Loose on purpose. `chess.js` decides what is legal and what the canonical spelling is;
 * duplicating that here would create a second, weaker source of truth for move syntax.
 */
const san = z
  .string()
  .min(2)
  .max(10)
  .regex(/^[a-zA-Z0-9x=+#-]+$/, 'is not a SAN move')

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date, e.g. 2026-09-16')

/**
 * Vietnamese is the source locale, so an annotation without it has nothing to fall back to.
 * An `en`-only annotation would render blank or as a raw key, which the model forbids.
 */
const annotation = z.strictObject({
  vi: prose,
  en: prose.optional(),
  fr: prose.optional(),
})

/**
 * Authored provenance is always a judgement. `basis: 'proved'` is not expressible here,
 * because a proof is produced by the build and carries a certificate id (ADR-0005).
 */
const judgement = z.strictObject({
  by: z.string().min(1),
  at: isoDate,
  source: prose.optional(),
})

/**
 * The three outcomes an author may write, and the one they may not.
 *
 * `trap` is how a leaf is *claimed* as a forced mate (ADR-0005, step 1): it is a bare
 * marker with no move count, no line and no certificate name, because every one of those is
 * a thing the build derives and a thing a file that could state it could lie about. The
 * validator either replaces it with a proved `mate` outcome, having replayed a committed
 * certificate move by move, or refuses the file. `type: mate` is rejected earlier still, by
 * `derived-fields.ts`, with its own explanation.
 */
const outcome = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('unexplored') }),
  z.strictObject({ type: z.literal('trap') }),
  z.strictObject({
    type: z.literal('position'),
    evaluation: annotation,
    plan: annotation,
    basis: judgement,
  }),
])

const dismissed = z.strictObject({
  ply: san,
  reason: prose,
})

/**
 * The catch-all for every remaining legal reply. Its reason is an `annotation` rather than
 * a bare string because a learner reads it, so it is localised and falls back to Vietnamese
 * like all other learner-facing prose — where `dismissed.reason` is a maintainer's note.
 *
 * `prose` is what makes an empty or placeholder reason a schema failure: a catch-all with
 * a vacuous reason is the one shape that would genuinely weaken invariant 7a.
 */
const dismissRest = z.strictObject({
  reason: annotation,
})

const replyQuality = z.enum(['best', 'good', 'inaccuracy', 'mistake', 'blunder'])
const frequency = z.enum(['common', 'occasional', 'rare'])

/**
 * A counted claim about this node's position (ADR-0011).
 *
 * `count` names the question, `expect` is the author's answer to it, and the build replays
 * the position to settle it. The number the *learner* sees is never this one: the prose
 * carries a `{name}` placeholder and the build fills it with the figure it derived, so a
 * count cannot be stated in one place and contradicted in another.
 *
 * `expect` is still required, and is the only part of this a person writes. It is what turns
 * a wrong belief into a failed build: an author who has counted 25 and writes 25 is told the
 * answer is 23, which is exactly the conversation that did not happen in #76.
 */
const countKind = z.discriminatedUnion('count', [
  z.strictObject({
    count: z.literal('legalReplies'),
    expect: z.number().int().min(0),
  }),
  z.strictObject({
    count: z.literal('matedBy'),
    ply: san,
    expect: z.number().int().min(0),
  }),
  z.strictObject({
    count: z.literal('notMatedBy'),
    ply: san,
    expect: z.number().int().min(0),
  }),
])

/**
 * Names are lower camel case because `{Name}` is the capitalised spelling of `{name}` — a
 * count that opens a sentence. An author writing `{Mated}` and a count called `Mated` would
 * be two different things that look like one.
 */
const counts = z.record(
  z
    .string()
    .regex(
      /^[a-z][A-Za-z0-9]*$/,
      'must be a lower camel case name, e.g. `mated`. `{Mated}` in prose is this count capitalised.',
    ),
  countKind,
)

const childNode = z.strictObject({
  ply: san,
  annotation: annotation.optional(),
  counts: counts.optional(),
  replyQuality: replyQuality.optional(),
  frequency: frequency.optional(),
  dismissed: z.array(dismissed).min(1).optional(),
  dismissRest: dismissRest.optional(),
  outcome: outcome.optional(),
  transposesTo: z.array(san).min(1).optional(),
  get children() {
    return z.array(childNode).min(1).optional()
  },
})

/**
 * The root is the position after the defining line, so it has no `ply` of its own and is
 * nobody's reply — `replyQuality` and `frequency` are therefore not expressible on it.
 */
const rootNode = z.strictObject({
  annotation: annotation.optional(),
  counts: counts.optional(),
  dismissed: z.array(dismissed).min(1).optional(),
  dismissRest: dismissRest.optional(),
  outcome: outcome.optional(),
  transposesTo: z.array(san).min(1).optional(),
  get children() {
    return z.array(childNode).min(1).optional()
  },
})

export const entrySchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a kebab-case slug, e.g. evans-gambit'),
  name: z.string().min(1),
  eco: z.string().regex(/^[A-E]\d{2}(?:-[A-E]\d{2})?$/, 'must be an ECO code or range, e.g. C51'),
  category: z.enum(['gambit', 'trap']),
  side: z.enum(['white', 'black']),
  definingLine: z.array(san).min(1),
  soundness: z.strictObject({
    value: z.enum(['sound', 'dubious', 'unsound']),
    reviewedAt: isoDate,
    basis: judgement,
  }),
  /**
   * One provenance for every judgement in the entry that is not a leaf assessment: reply
   * qualities, frequencies and annotations. They come from one author on one review date,
   * and invariant 7b requires them to say so (docs/CONTEXT.md, Provenance).
   */
  judgement,
  tree: rootNode,
})

export type AuthoredEntry = z.infer<typeof entrySchema>
export type AuthoredNode = z.infer<typeof childNode>
export type AuthoredRoot = z.infer<typeof rootNode>
export type AuthoredOutcome = z.infer<typeof outcome>
export type AuthoredAnnotation = z.infer<typeof annotation>
export type AuthoredJudgement = z.infer<typeof judgement>
export type AuthoredDismissal = z.infer<typeof dismissed>
export type AuthoredDismissRest = z.infer<typeof dismissRest>
export type AuthoredCounts = z.infer<typeof counts>
export type AuthoredCount = z.infer<typeof countKind>

export type ParseResult =
  | { readonly ok: true; readonly entry: AuthoredEntry }
  | { readonly ok: false; readonly issues: readonly ContentIssue[] }

const segmentOf = (key: PropertyKey): string | number =>
  typeof key === 'number' ? key : String(key)

export const parseEntry = (source: YamlSource): ParseResult => {
  const result = entrySchema.safeParse(source.data)
  if (result.success) return { ok: true, entry: result.data }

  return {
    ok: false,
    issues: result.error.issues.map((problem) => {
      const path = problem.path.map(segmentOf)
      return {
        file: source.file,
        code: 'schema',
        dataPath: joinDataPath(path),
        nodePath: undefined,
        at: source.locate(path),
        message: problem.message,
      }
    }),
  }
}
