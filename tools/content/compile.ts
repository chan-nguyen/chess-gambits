import type {
  CompiledAnnotation,
  CompiledEntry,
  CompiledNode,
  CompiledOutcome,
  CompiledProvenance,
} from '../../src/lib/content-types.ts'
import type {
  Annotation,
  Assessment,
  ContentNode,
  Entry,
  ForcedMate,
  Outcome,
  Provenance,
} from './types.ts'
import { assertNever } from './types.ts'

/**
 * The compile step of ADR-0004: validated content becomes one minified JSON file per entry,
 * carrying the derived FEN on every node, the derived `kind`, and the derived tier.
 *
 * Its whole job is to drop what JSON cannot say. The build's `Entry` states every optional
 * field explicitly as `undefined` and gives every node a `dismissed` array whether or not
 * anything was dismissed; `JSON.stringify` would drop the first silently and ship the
 * second as `[]` on every node in the catalogue. Both are handled here, deliberately, so
 * the wire shape is a decision rather than a side effect of a serialiser.
 *
 * Nothing here judges content. The entry arrives already validated, and a file that failed
 * the gate never reaches this module (`compile-cli.ts`).
 */

const annotation = (value: Annotation): CompiledAnnotation => ({
  vi: value.vi,
  ...(value.en === undefined ? {} : { en: value.en }),
  ...(value.fr === undefined ? {} : { fr: value.fr }),
})

const provenance = (value: Provenance): CompiledProvenance => {
  if (value.basis === 'proved') {
    return { basis: 'proved', by: 'certificate', certificate: value.certificate }
  }
  return {
    basis: 'judgement',
    by: value.by,
    at: value.at,
    ...(value.source === undefined ? {} : { source: value.source }),
  }
}

const outcome = (value: Outcome): CompiledOutcome => {
  switch (value.kind) {
    case 'mate':
      return {
        kind: 'mate',
        inMoves: value.inMoves,
        sequence: [...value.sequence],
        provedBy: value.provedBy,
        basis: { basis: 'proved', by: 'certificate', certificate: value.basis.certificate },
      }
    case 'position':
      return {
        kind: 'position',
        evaluation: annotation(value.evaluation),
        plan: annotation(value.plan),
        basis: provenance(value.basis),
      }
    case 'unexplored':
      return { kind: 'unexplored' }
    default:
      return assertNever(value)
  }
}

const node = (value: ContentNode): CompiledNode => ({
  ...(value.ply === undefined ? {} : { ply: value.ply }),
  kind: value.kind,
  fen: value.fen,
  ...(value.annotation === undefined ? {} : { annotation: annotation(value.annotation) }),
  ...(value.replyQuality === undefined ? {} : { replyQuality: value.replyQuality }),
  ...(value.frequency === undefined ? {} : { frequency: value.frequency }),
  ...(value.dismissed.length === 0
    ? {}
    : { dismissed: value.dismissed.map((reply) => ({ ...reply })) }),
  ...(value.dismissRest === undefined
    ? {}
    : {
        dismissRest: {
          reason: annotation(value.dismissRest.reason),
          covers: [...value.dismissRest.covers],
        },
      }),
  ...(value.children.length === 0 ? {} : { children: value.children.map(node) }),
  ...(value.outcome === undefined ? {} : { outcome: outcome(value.outcome) }),
  ...(value.transposesTo === undefined ? {} : { transposesTo: [...value.transposesTo] }),
})

export const compileEntry = (entry: Entry): CompiledEntry => ({
  id: entry.id,
  name: entry.name,
  eco: entry.eco,
  category: entry.category,
  side: entry.side,
  definingLine: [...entry.definingLine],
  soundness: {
    value: entry.soundness.value,
    reviewedAt: entry.soundness.reviewedAt,
    basis: provenance(entry.soundness.basis),
  },
  judgement: provenance(entry.judgement),
  tree: node(entry.tree),
  tier: entry.tier,
})

/** Minified: no indentation and no spacing. This is a payload, not a file anyone reads. */
export const compiledJson = (entry: CompiledEntry): string => JSON.stringify(entry)

/**
 * A compile error on the day the domain model grows a field this mapper does not copy.
 *
 * The mappers above name every field explicitly, which is what lets them drop `undefined`
 * and empty arrays — and it is also how a new field gets silently left out of every
 * published entry, with nothing failing and nobody noticing until a learner is missing
 * something. TypeScript does not object to an unread property, so the check is made here
 * instead: if `Exclude` leaves anything behind, it is not `never` and this stops the build.
 *
 * `tools/content/types.ts` is owned elsewhere (#5, #29). This is the seam that makes a
 * change there arrive here as an error rather than as a quiet omission.
 */
type MustBeNever<T extends never> = T
type Unhandled<T, Handled extends keyof T> = Exclude<keyof T, Handled>

export type EveryNodeFieldIsCompiled = MustBeNever<
  Unhandled<
    ContentNode,
    | 'ply'
    | 'kind'
    | 'fen'
    | 'annotation'
    | 'replyQuality'
    | 'frequency'
    | 'dismissed'
    | 'dismissRest'
    | 'children'
    | 'outcome'
    | 'transposesTo'
  >
>

/**
 * The same guard, for the outcome shapes.
 *
 * `EveryNodeFieldIsCompiled` covers `ContentNode`, so it says nothing about a field added to
 * an *outcome* — and `ForcedMate` grew one (#5). A property nobody reads is not a type error,
 * so without this the field would compile, ship as absent, and reach a learner as a proof
 * with no certificate to look up. Found the hard way; closed here.
 */
export type EveryMateFieldIsCompiled = MustBeNever<
  Unhandled<ForcedMate, 'kind' | 'inMoves' | 'sequence' | 'provedBy' | 'basis'>
>

export type EveryAssessmentFieldIsCompiled = MustBeNever<
  Unhandled<Assessment, 'kind' | 'evaluation' | 'plan' | 'basis'>
>

export type EveryEntryFieldIsCompiled = MustBeNever<
  Unhandled<
    Entry,
    | 'id'
    | 'name'
    | 'eco'
    | 'category'
    | 'side'
    | 'definingLine'
    | 'soundness'
    | 'judgement'
    | 'tree'
    | 'tier'
  >
>
