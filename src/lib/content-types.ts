/**
 * The shape of a compiled entry, as the browser receives it.
 *
 * This is deliberately a second declaration of the domain model rather than a re-use of
 * `tools/content/types.ts`, for one concrete reason: JSON has no `undefined`. The build's
 * `Entry` says `ply: string | undefined` and every node carries a `dismissed` array even
 * when it is empty; what arrives over the wire has those keys absent. Under
 * `exactOptionalPropertyTypes` those are different types, and pretending otherwise would
 * mean the browser reading a field that is never there.
 *
 * The two cannot drift: `tools/content/compile.ts` imports this type and is the only thing
 * that produces the JSON, so a field added to the build's model and not to this one — or
 * the reverse — is a compile error rather than a runtime surprise.
 *
 * Types only. Nothing in this file emits a byte.
 */

export type Side = 'white' | 'black'
export type Category = 'gambit' | 'trap'
export type SoundnessValue = 'sound' | 'dubious' | 'unsound'
export type ReplyQuality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
export type Frequency = 'common' | 'occasional' | 'rare'
/** Derived from side to move; never authored (docs/CONTEXT.md, invariant 2). */
export type NodeKind = 'learner' | 'opponent'
/** Derived by the build from the content itself (docs/CONTEXT.md, invariant 8). */
export type Tier = 'listed' | 'mapped' | 'taught'

export type CompiledAnnotation = {
  readonly vi: string
  readonly en?: string
  readonly fr?: string
}

/** A machine proof, naming the certificate a reader can fetch and replay (ADR-0005). */
export type CompiledProved = {
  readonly basis: 'proved'
  readonly by: 'certificate'
  readonly certificate: string
}

export type CompiledProvenance =
  | CompiledProved
  | {
      readonly basis: 'judgement'
      readonly by: string
      readonly at: string
      readonly source?: string
    }

export type CompiledOutcome =
  | {
      readonly kind: 'mate'
      readonly inMoves: number
      readonly sequence: readonly string[]
      readonly provedBy: 'search' | 'modelled-net'
      /**
       * Narrow on purpose: a mate that arrived over the wire carrying a *judgement* is not a
       * mate this project will render, so the type cannot express one. This is what lets the
       * UI show a proof and an opinion differently without asking which it has.
       */
      readonly basis: CompiledProved
    }
  | {
      readonly kind: 'position'
      readonly evaluation: CompiledAnnotation
      readonly plan: CompiledAnnotation
      readonly basis: CompiledProvenance
    }
  | { readonly kind: 'unexplored' }

export type CompiledDismissal = { readonly ply: string; readonly reason: string }

/**
 * The catch-all answering every legal reply that is neither modelled nor individually
 * dismissed. Its reason is localised, unlike an individual dismissal's, because this one
 * is shown to the learner rather than read in a diff — and `covers` is what lets the UI
 * say "34 other replies" rather than hiding the omission behind one line.
 */
export type CompiledDismissRest = {
  readonly reason: CompiledAnnotation
  readonly covers: readonly string[]
}

export type CompiledNode = {
  /** Absent on the root, which is the position after the defining line. */
  readonly ply?: string
  readonly kind: NodeKind
  /** Derived by replaying from the standard start position (docs/CONTEXT.md, invariant 1). */
  readonly fen: string
  readonly annotation?: CompiledAnnotation
  readonly replyQuality?: ReplyQuality
  readonly frequency?: Frequency
  readonly dismissed?: readonly CompiledDismissal[]
  readonly dismissRest?: CompiledDismissRest
  readonly children?: readonly CompiledNode[]
  readonly outcome?: CompiledOutcome
  readonly transposesTo?: readonly string[]
}

export type CompiledSoundness = {
  readonly value: SoundnessValue
  readonly reviewedAt: string
  readonly basis: CompiledProvenance
}

export type CompiledEntry = {
  readonly id: string
  readonly name: string
  readonly eco: string
  readonly category: Category
  readonly side: Side
  readonly definingLine: readonly string[]
  readonly soundness: CompiledSoundness
  readonly judgement: CompiledProvenance
  readonly tree: CompiledNode
  readonly tier: Tier
}
