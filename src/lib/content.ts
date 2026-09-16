import { withBasePath } from './base-path.ts'
import type {
  Category,
  CompiledAnnotation,
  CompiledDismissal,
  CompiledDismissRest,
  CompiledEntry,
  CompiledNode,
  CompiledOutcome,
  CompiledProvenance,
  CompiledSoundness,
  Frequency,
  NodeKind,
  ReplyQuality,
  Side,
  SoundnessValue,
  Tier,
} from './content-types.ts'

/**
 * Fetching one compiled entry.
 *
 * Content is a **static file addressed by a URL**, not a module in the graph (ADR-0004).
 * An `import.meta.glob` over the catalogue would put several hundred entries into the
 * module graph and make build time grow with coverage, and it would bundle trees nobody
 * opened. One `fetch` per gambit downloads exactly what was asked for and costs the build
 * nothing.
 *
 * The id arrives from the URL, so it is attacker-controlled (docs/security.md, B4). It is
 * checked against the same closed slug shape the content schema enforces *before* it is
 * put in a request path — no dot, no slash, no percent, bounded length — so it can address
 * nothing but a file in the content directory. Nothing here chooses a module to load and
 * nothing is interpolated into HTML.
 *
 * Every failure is a value. Nothing in this module throws, because a thrown promise in a
 * lazy boundary is a blank screen, and this project has no error reporting to notice one.
 */

/** The schema's slug shape (`schema.ts`), bounded: a URL segment, never a path. */
const GAMBIT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_ID_LENGTH = 64

export const isGambitId = (value: string): boolean =>
  value.length > 0 && value.length <= MAX_ID_LENGTH && GAMBIT_ID.test(value)

export const entryUrl = (id: string): string => withBasePath(`content/${id}.json`)

export type EntryLoadFailure =
  /** The address is not a gambit id at all, so no request was made. */
  | { readonly reason: 'unknown-id' }
  /** The request never completed: no connection, or the request was blocked. */
  | { readonly reason: 'offline' }
  /** The site answered, and has no file for this entry. */
  | { readonly reason: 'missing' }
  /** The site answered with an error status. */
  | { readonly reason: 'unavailable'; readonly status: number }
  /** Something arrived, and it was not a compiled entry. */
  | { readonly reason: 'malformed' }

export type EntryLoad =
  | { readonly ok: true; readonly entry: CompiledEntry }
  | { readonly ok: false; readonly failure: EntryLoadFailure }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string'

const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): value is T =>
    allowed.some((candidate) => candidate === value)

const arrayOf =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is readonly T[] =>
    Array.isArray(value) && value.every((item: unknown) => guard(item))

const optional =
  <T>(guard: (value: unknown) => value is T) =>
  (value: unknown): value is T | undefined =>
    value === undefined || guard(value)

const isSide = oneOf<Side>(['white', 'black'])
const isCategory = oneOf<Category>(['gambit', 'trap'])
const isSoundnessValue = oneOf<SoundnessValue>(['sound', 'dubious', 'unsound'])
const isReplyQuality = oneOf<ReplyQuality>(['best', 'good', 'inaccuracy', 'mistake', 'blunder'])
const isFrequency = oneOf<Frequency>(['common', 'occasional', 'rare'])
const isNodeKind = oneOf<NodeKind>(['learner', 'opponent'])
const isTier = oneOf<Tier>(['listed', 'mapped', 'taught'])
const isStrings = arrayOf(isString)

const isAnnotation = (value: unknown): value is CompiledAnnotation =>
  isRecord(value) && isString(value.vi) && isOptionalString(value.en) && isOptionalString(value.fr)

const isProvenance = (value: unknown): value is CompiledProvenance => {
  if (!isRecord(value)) return false
  if (value.basis === 'proved') return value.by === 'certificate' && isString(value.certificate)
  return (
    value.basis === 'judgement' &&
    isString(value.by) &&
    isString(value.at) &&
    isOptionalString(value.source)
  )
}

const isOutcome = (value: unknown): value is CompiledOutcome => {
  if (!isRecord(value)) return false
  switch (value.kind) {
    case 'mate':
      return (
        typeof value.inMoves === 'number' &&
        isStrings(value.sequence) &&
        (value.provedBy === 'search' || value.provedBy === 'modelled-net')
      )
    case 'position':
      return isAnnotation(value.evaluation) && isAnnotation(value.plan) && isProvenance(value.basis)
    case 'unexplored':
      return true
    default:
      return false
  }
}

const isDismissal = (value: unknown): value is CompiledDismissal =>
  isRecord(value) && isString(value.ply) && isString(value.reason)

const isDismissRest = (value: unknown): value is CompiledDismissRest =>
  isRecord(value) && isAnnotation(value.reason) && isStrings(value.covers)

const isNode = (value: unknown): value is CompiledNode =>
  isRecord(value) &&
  isOptionalString(value.ply) &&
  isNodeKind(value.kind) &&
  isString(value.fen) &&
  optional(isAnnotation)(value.annotation) &&
  optional(isReplyQuality)(value.replyQuality) &&
  optional(isFrequency)(value.frequency) &&
  optional(arrayOf(isDismissal))(value.dismissed) &&
  optional(isDismissRest)(value.dismissRest) &&
  optional(arrayOf(isNode))(value.children) &&
  optional(isOutcome)(value.outcome) &&
  optional(isStrings)(value.transposesTo)

const isSoundness = (value: unknown): value is CompiledSoundness =>
  isRecord(value) &&
  isSoundnessValue(value.value) &&
  isString(value.reviewedAt) &&
  isProvenance(value.basis)

/**
 * Checked field by field rather than trusted because it came from our own build. A static
 * host answering a deploy-time 404 with an HTML page, a truncated response on a flaky
 * mobile connection, or a stale service worker all produce *something* that parses; none
 * of them produce an entry, and only this tells the difference between the two.
 */
export const isCompiledEntry = (value: unknown): value is CompiledEntry =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.eco) &&
  isCategory(value.category) &&
  isSide(value.side) &&
  isStrings(value.definingLine) &&
  isSoundness(value.soundness) &&
  isProvenance(value.judgement) &&
  isNode(value.tree) &&
  isTier(value.tier)

export const loadEntry = async (id: string): Promise<EntryLoad> => {
  if (!isGambitId(id)) return { ok: false, failure: { reason: 'unknown-id' } }

  let response: Response
  try {
    response = await fetch(entryUrl(id), { headers: { accept: 'application/json' } })
  } catch {
    return { ok: false, failure: { reason: 'offline' } }
  }

  if (response.status === 404) return { ok: false, failure: { reason: 'missing' } }
  if (!response.ok) {
    return { ok: false, failure: { reason: 'unavailable', status: response.status } }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, failure: { reason: 'malformed' } }
  }

  if (!isCompiledEntry(body)) return { ok: false, failure: { reason: 'malformed' } }
  // A file that names a different entry is a misconfigured host, not this gambit.
  if (body.id !== id) return { ok: false, failure: { reason: 'malformed' } }

  return { ok: true, entry: body }
}
