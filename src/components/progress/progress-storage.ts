import { readStored, writeStored } from '../../lib/storage.ts'

/**
 * Where progress is kept: the visitor's own browser, and nowhere else.
 *
 * No account, no server, no sync (requirement F10, ADR-0001). Its loss is an accepted,
 * non-critical event, which is what makes every degradation here silent rather than an error
 * — with the one exception below, which is the opposite and deliberately so.
 *
 * Everything goes through `src/lib/storage.ts` (docs/security.md, B5). Nothing in this file
 * touches `localStorage`, because the wrapped helper is the only thing allowed to: a private
 * window, storage disabled by policy, a quota error and a `localStorage` getter that throws
 * on access are all normal conditions, and none of them may break the page.
 */

export const progressStorageKey = 'chess-gambits.progress'

/**
 * The schema version of what is stored, and the reason there is one.
 *
 * Content ids and SAN paths are the vocabulary progress is written in, and the first change
 * to either would silently invalidate every mark ever made. Without a version, the symptom
 * of that change is a learner's progress quietly reading as zero and no way for anyone to
 * tell that from a learner who has marked nothing. With one, unrecognised data is discarded
 * **and said out loud** (AC 4) — which is the point: the notice is the feature, and the
 * version is only how the notice becomes possible.
 *
 * Bump this when the meaning of a stored key changes. Do not bump it to add a field that
 * older data can be read without.
 */
export const progressSchemaVersion = 1

/** Marked branch keys, per gambit id. One entry per gambit the learner has touched. */
export type StoredProgress = Readonly<Record<string, readonly string[]>>

/**
 * What a read found. Three outcomes, not two, and the third is AC 4.
 *
 * `none` covers everything the learner cannot be told anything useful about: nothing stored,
 * storage unreadable, or data that no longer parses as its own schema. Those are all "no
 * saved progress" and all silent.
 *
 * `discarded` is the one case that is *not* silent, because it is the one case where
 * something was there, was readable, and was thrown away — and where the reason is a change
 * this project made rather than anything the visitor did.
 */
export type ProgressRead =
  | { readonly status: 'none' }
  | { readonly status: 'ready'; readonly progress: StoredProgress }
  | { readonly status: 'discarded'; readonly storedVersion: number }

type Envelope = { readonly version: number; readonly entries: unknown }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The version, and nothing else, read out of a stored blob.
 *
 * Deliberately **version-agnostic**: it validates that something is one of this project's
 * envelopes and refuses to look at the payload. That split is what makes AC 4 expressible at
 * all. If this also checked the payload against the current schema, a stored version 2 would
 * fail the check, come back as "not valid", and be discarded *silently* — which is exactly
 * the failure the version exists to prevent, reintroduced by the validator meant to enforce
 * it. The payload is checked afterwards, once the version says which schema it is in.
 */
const readEnvelope = (raw: string): Envelope | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(parsed)) return null
  const { version } = parsed
  if (typeof version !== 'number' || !Number.isInteger(version)) return null

  return { version, entries: parsed.entries }
}

/**
 * `readStored` takes a predicate rather than a parser, so the check and the value it
 * produces are two steps and the blob is parsed twice. It is a few hundred bytes of JSON and
 * the alternative is a second way to reach `localStorage`, which docs/security.md B5 does not
 * allow and which would be a poor trade at any size.
 */
const isVersionedEnvelope = (value: string): value is string => readEnvelope(value) !== null

const isKeys = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === 'string')

const isEntries = (value: unknown): value is StoredProgress =>
  isRecord(value) && Object.values(value).every(isKeys)

/** Read stored progress. Never throws; every failure is one of the three statuses. */
export const readProgress = (): ProgressRead => {
  const raw = readStored(progressStorageKey, isVersionedEnvelope)
  if (raw === null) return { status: 'none' }

  const envelope = readEnvelope(raw)
  if (envelope === null) return { status: 'none' }

  if (envelope.version !== progressSchemaVersion) {
    return { status: 'discarded', storedVersion: envelope.version }
  }

  /**
   * Our own version, and the payload is still not trusted. Stored data is editable by hand
   * and by any script on the origin (docs/security.md, B5), so it is validated on read
   * against the same schema as on write, and data that fails is discarded rather than
   * trusted. Silently, because a hand-edited blob is not something to explain to the person
   * who edited it.
   */
  return isEntries(envelope.entries)
    ? { status: 'ready', progress: envelope.entries }
    : { status: 'none' }
}

/** Store progress. Failing to store is not an error the learner can do anything about. */
export const writeProgress = (progress: StoredProgress): void =>
  writeStored(
    progressStorageKey,
    JSON.stringify({ version: progressSchemaVersion, entries: progress }),
  )
