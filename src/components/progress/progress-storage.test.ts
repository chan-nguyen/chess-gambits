import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  progressSchemaVersion,
  progressStorageKey,
  readProgress,
  writeProgress,
} from './progress-storage.ts'

/**
 * AC 2, 3 and 4. Three claims that are only worth anything if the failure paths are the
 * ones exercised, so almost everything here is a failure path.
 */

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

/** Put a blob in storage by hand, which is exactly what this module must not trust. */
const store = (value: string): void => window.localStorage.setItem(progressStorageKey, value)

const storedVersion = (): unknown => {
  const raw = window.localStorage.getItem(progressStorageKey)
  if (raw === null) return null
  const parsed: unknown = JSON.parse(raw)
  return typeof parsed === 'object' && parsed !== null && 'version' in parsed
    ? parsed.version
    : null
}

describe('progress survives a reload (AC 2)', () => {
  it('reads back what it wrote', () => {
    writeProgress({ 'legal-mate': ['Bh5_Nxe5'], 'evans-gambit': [] })

    expect(readProgress()).toStrictEqual({
      status: 'ready',
      progress: { 'legal-mate': ['Bh5_Nxe5'], 'evans-gambit': [] },
    })
  })

  it('stamps what it writes with the current schema version', () => {
    writeProgress({ 'legal-mate': [] })

    expect(storedVersion()).toBe(progressSchemaVersion)
  })

  it('reads no saved progress when nothing was ever stored', () => {
    expect(readProgress()).toStrictEqual({ status: 'none' })
  })
})

/**
 * AC 3. Every one of these is a normal condition rather than an exceptional one — a private
 * window, storage disabled by policy, a full quota, a blob somebody edited — and every one
 * of them degrades to "no saved progress" without breaking the page.
 */
describe('every failure degrades to no saved progress (AC 3)', () => {
  it('discards a blob that is not JSON at all', () => {
    store('not json {{{')

    expect(readProgress()).toStrictEqual({ status: 'none' })
  })

  it('discards JSON that is not an object', () => {
    store('["Bh5_Nxe5"]')

    expect(readProgress()).toStrictEqual({ status: 'none' })
  })

  it('discards an envelope with no version, because it is not one of ours', () => {
    store(JSON.stringify({ entries: { 'legal-mate': ['Bh5'] } }))

    expect(readProgress()).toStrictEqual({ status: 'none' })
  })

  it('discards a version that is not a whole number', () => {
    store(JSON.stringify({ version: '1', entries: {} }))
    expect(readProgress()).toStrictEqual({ status: 'none' })

    store(JSON.stringify({ version: 1.5, entries: {} }))
    expect(readProgress()).toStrictEqual({ status: 'none' })
  })

  it('discards a payload at our own version that has been edited into something else', () => {
    store(JSON.stringify({ version: progressSchemaVersion, entries: { 'legal-mate': 'Bh5' } }))

    expect(readProgress()).toStrictEqual({ status: 'none' })
  })

  it('discards a payload whose branch list holds something other than keys', () => {
    store(JSON.stringify({ version: progressSchemaVersion, entries: { 'legal-mate': [1, 2] } }))

    expect(readProgress()).toStrictEqual({ status: 'none' })
  })

  it('degrades when reading throws, as it does in a private window', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })

    expect(() => readProgress()).not.toThrow()
    expect(readProgress()).toStrictEqual({ status: 'none' })
  })

  it('degrades silently when writing throws on quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => writeProgress({ 'legal-mate': ['Bh5'] })).not.toThrow()
  })

  it('degrades when localStorage itself is unreachable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('Access is denied for this document.')
      },
    })

    try {
      expect(readProgress()).toStrictEqual({ status: 'none' })
      expect(() => writeProgress({ 'legal-mate': [] })).not.toThrow()
    } finally {
      if (descriptor !== undefined) Object.defineProperty(window, 'localStorage', descriptor)
    }
  })
})

/**
 * AC 4, and the criterion turns on one word: *not silently*. Discarding unrecognised data is
 * the easy half and every one of the tests above already does it. The half that matters is
 * that this case is distinguishable from "nothing stored", because only a distinguishable
 * case can be reported to the learner.
 */
describe('an unrecognised version is discarded with a notice (AC 4)', () => {
  const foreign = (version: number): void =>
    store(JSON.stringify({ version, entries: { 'legal-mate': ['Bh5_Nxe5'] } }))

  it('reports the discard, rather than reporting nothing stored', () => {
    foreign(progressSchemaVersion + 1)

    const read = readProgress()

    expect(read).toStrictEqual({
      status: 'discarded',
      storedVersion: progressSchemaVersion + 1,
    })
    // Named because the assertion above would still pass if `discarded` and `none` were the
    // same value, and then nothing could be said to anybody.
    expect(read.status).not.toBe('none')
  })

  it('reports it for a version behind as well as a version ahead', () => {
    foreign(progressSchemaVersion - 1)

    expect(readProgress()).toStrictEqual({
      status: 'discarded',
      storedVersion: progressSchemaVersion - 1,
    })
  })

  it('hands back none of the foreign payload', () => {
    foreign(progressSchemaVersion + 1)

    expect(JSON.stringify(readProgress())).not.toContain('Bh5')
  })

  /**
   * The control, and the reason the whole block above is not a tautology: at the version
   * this code writes, the very same payload is accepted and nothing is discarded. Without
   * it, a `readProgress` that returned `discarded` unconditionally would pass every
   * assertion here.
   */
  it('accepts the same payload at the version this code writes', () => {
    foreign(progressSchemaVersion)

    expect(readProgress()).toStrictEqual({
      status: 'ready',
      progress: { 'legal-mate': ['Bh5_Nxe5'] },
    })
  })

  /**
   * The failure this version exists to prevent, written out as a test so the next person to
   * change the schema can see what would otherwise happen. A payload that is valid *for its
   * own version* but not for ours must not fall through to the silent path: `entries` here
   * is a shape version 1 rejects, and the read still says `discarded` rather than `none`.
   */
  it('reports a discard even when the foreign payload is not readable as ours', () => {
    store(
      JSON.stringify({
        version: progressSchemaVersion + 1,
        entries: { 'legal-mate': { marked: ['Bh5'], at: '2026-09-16' } },
      }),
    )

    expect(readProgress()).toStrictEqual({
      status: 'discarded',
      storedVersion: progressSchemaVersion + 1,
    })
  })
})
