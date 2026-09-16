import { afterEach, describe, expect, it, vi } from 'vitest'
import manifestSource from '../../package.json?raw'
import compiledEntry from '../../tools/content/fixtures/compiled/taught-entry.json?raw'
import provedMate from '../../tools/content/fixtures/compiled/proved-mate.json?raw'
import { entryUrl, isCompiledEntry, isGambitId, loadEntry } from './content'

/**
 * AC 4 and AC 6, at the level a unit test can reach: one entry is fetched by URL, and every
 * way that fetch can go wrong comes back as a value the UI can render.
 *
 * Nothing here is allowed to throw. A rejected promise inside a lazy boundary is a blank
 * screen, and this project sends no telemetry, so a blank screen is a failure nobody ever
 * learns about (docs/design-system.md §3).
 */

const ENTRY: unknown = JSON.parse(compiledEntry)

const respond = (body: unknown, status = 200): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the id, which arrives from the URL and is therefore hostile (security.md B4)', () => {
  it.each(['evans-gambit', 'damiano-defence-refutation', 'c40'])('accepts %s', (id) => {
    expect(isGambitId(id)).toBe(true)
  })

  it.each([
    ['..', 'a path segment that climbs'],
    ['../../etc/passwd', 'a traversal'],
    ['a/b', 'a slash'],
    ['evans.json', 'an extension'],
    ['%2e%2e', 'percent encoding'],
    ['Evans-Gambit', 'upper case, which no id has'],
    ['', 'nothing at all'],
    ['-leading', 'a leading dash'],
    ['a'.repeat(65), 'an unbounded length'],
  ])('rejects %s (%s)', (id) => {
    expect(isGambitId(id)).toBe(false)
  })

  it('makes no request at all for an id it refuses', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)

    const result = await loadEntry('../../secret')

    expect(fetcher).not.toHaveBeenCalled()
    expect(result).toStrictEqual({ ok: false, failure: { reason: 'unknown-id' } })
  })
})

describe('the URL it builds (AC 6)', () => {
  it('addresses a static file under the base path, not a module', () => {
    expect(entryUrl('evans-gambit')).toBe('/content/evans-gambit.json')
  })

  it('asks for exactly one entry', async () => {
    respond(ENTRY)

    await loadEntry('fixture-taught-entry')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/content/fixture-taught-entry.json', {
      headers: { accept: 'application/json' },
    })
  })
})

describe('a successful load', () => {
  it('returns the compiled entry, with its derived tier and FENs', async () => {
    respond(ENTRY)

    const result = await loadEntry('fixture-taught-entry')
    if (!result.ok) throw new Error(`expected a load, got ${result.failure.reason}`)

    expect(result.entry.id).toBe('fixture-taught-entry')
    expect(result.entry.tier).toBe('taught')
    expect(result.entry.tree.fen).toContain('/')
    expect(result.entry.tree.children?.[0]?.kind).toBe('learner')
  })
})

describe('every way it can fail is a value, never a throw', () => {
  it('reports a dropped connection as offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )

    await expect(loadEntry('evans-gambit')).resolves.toStrictEqual({
      ok: false,
      failure: { reason: 'offline' },
    })
  })

  it('reports a 404 as missing, which is a stale link rather than a broken site', async () => {
    respond('not found', 404)

    await expect(loadEntry('evans-gambit')).resolves.toStrictEqual({
      ok: false,
      failure: { reason: 'missing' },
    })
  })

  it('reports another error status with the status, so it can be told apart', async () => {
    respond('oops', 503)

    await expect(loadEntry('evans-gambit')).resolves.toStrictEqual({
      ok: false,
      failure: { reason: 'unavailable', status: 503 },
    })
  })

  it('reports a body that is not JSON as malformed', async () => {
    respond('<!doctype html><title>404</title>')

    await expect(loadEntry('evans-gambit')).resolves.toStrictEqual({
      ok: false,
      failure: { reason: 'malformed' },
    })
  })

  it('reports JSON that is not an entry as malformed', async () => {
    respond({ id: 'evans-gambit', name: 'Evans Gambit' })

    await expect(loadEntry('evans-gambit')).resolves.toStrictEqual({
      ok: false,
      failure: { reason: 'malformed' },
    })
  })

  /**
   * A truncated response on a flaky mobile connection parses as far as it got. Half a tree
   * is worse than no tree: the learner would be shown a gambit with branches missing and no
   * sign that anything was lost.
   */
  it('reports a truncated tree as malformed rather than showing part of a gambit', async () => {
    const damaged: unknown = JSON.parse(compiledEntry)
    if (typeof damaged !== 'object' || damaged === null) throw new Error('not an object')
    respond({ ...damaged, tree: { kind: 'learner' } })

    await expect(loadEntry('fixture-taught-entry')).resolves.toStrictEqual({
      ok: false,
      failure: { reason: 'malformed' },
    })
  })

  it('reports a file that names a different entry as malformed', async () => {
    respond(ENTRY)

    const result = await loadEntry('evans-gambit')

    expect(result).toStrictEqual({ ok: false, failure: { reason: 'malformed' } })
  })
})

describe('the runtime guard', () => {
  /**
   * The fixture is the compile step's own output, pinned byte for byte by
   * `tools/content/compile.test.ts`. Between the two, the compiler and this guard are held
   * to one shape without `src/` ever importing the build pipeline.
   */
  it('accepts the real compiled output', () => {
    expect(isCompiledEntry(ENTRY)).toBe(true)
  })

  it.each([null, undefined, 'e4', 42, [], {}])('rejects %s', (value) => {
    expect(isCompiledEntry(value)).toBe(false)
  })

  /**
   * It has to be able to say no to something entry-shaped, or the test above proves only
   * that it returns true. Each mutation is a shape a real failure produces: a field the
   * compiler stopped emitting, a value outside its closed set, and a tree replaced by a
   * scalar.
   */
  it.each([
    ['a missing derived tier', (value: Record<string, unknown>) => delete value.tier],
    ['a tier outside the closed set', (value: Record<string, unknown>) => (value.tier = 'gold')],
    ['a side outside the closed set', (value: Record<string, unknown>) => (value.side = 'green')],
    ['a tree that is not a node', (value: Record<string, unknown>) => (value.tree = 'e4')],
    ['a missing id', (value: Record<string, unknown>) => delete value.id],
    ['a missing soundness', (value: Record<string, unknown>) => delete value.soundness],
  ])('rejects %s', (_name, damage) => {
    const parsed: unknown = JSON.parse(compiledEntry)
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object')
    const record: Record<string, unknown> = { ...parsed }
    damage(record)

    expect(isCompiledEntry(record)).toBe(false)
  })
})

/**
 * ADR-0004: the PGN parser and the rules engine run in the build only. Their licences never
 * touch the shipped bundle and their bytes never touch the runtime budget. The board has its
 * own tripwire for `chess.js`; this one covers the content pipeline, including the parser
 * that arrived with it, and it looks at every source file rather than at a chosen few.
 */
describe('the content pipeline never reaches the browser (ADR-0004)', () => {
  const sources = Object.entries(
    import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
  ).filter(([path]) => !path.includes('.test.'))

  it('finds the application source to check', () => {
    expect(sources.length).toBeGreaterThan(10)
  })

  it.each(['chess.js', '@mliebelt/pgn-parser'])(
    'keeps %s out of the runtime dependencies',
    (name) => {
      const manifest: unknown = JSON.parse(manifestSource)
      if (typeof manifest !== 'object' || manifest === null || !('dependencies' in manifest)) {
        throw new Error('package.json has no dependencies')
      }
      const { dependencies } = manifest

      expect(Object.keys(dependencies ?? {})).not.toContain(name)
    },
  )

  it('imports neither the parser nor the engine from anywhere under src/', () => {
    const offenders = sources
      .filter(([, text]) => typeof text === 'string' && /['"](?:chess\.js|@mliebelt\/)/.test(text))
      .map(([path]) => path)

    expect(offenders).toStrictEqual([])
  })

  /**
   * The strongest form of the rule: nothing the browser loads may reach into `tools/` at
   * all. A type-only import would be free today and a value import tomorrow, and the
   * difference is one keyword nobody would notice in review.
   */
  it('imports nothing from tools/ under src/', () => {
    const offenders = sources
      .filter(([, text]) => typeof text === 'string' && /from\s+['"][^'"]*tools\//.test(text))
      .map(([path]) => path)

    expect(offenders).toStrictEqual([])
  })
})

/**
 * A proved mate, as the browser receives it (ADR-0005).
 *
 * The payload below is byte for byte what the compiler emits from a content file whose leaf
 * claimed a trap and whose certificate verified — `tools/content/mate-claims.test.ts` pins
 * it. What matters here is the other end of that pipe: the guard must accept a mate that
 * names the certificate proving it, and reject one that does not, because a mate with
 * nothing to point at is exactly the assertion this project refuses to make.
 */
describe('a proved mate over the wire', () => {
  const PROVED: unknown = JSON.parse(provedMate)

  const mateOutcome = (entry: unknown): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(JSON.stringify(entry))
    if (!isCompiledEntry(parsed)) throw new Error('the fixture is not a compiled entry')
    const outcome = parsed.tree.children?.[0]?.outcome
    if (outcome?.kind !== 'mate') throw new Error('the fixture no longer carries a mate')
    return { ...outcome }
  }

  const withOutcome = (outcome: unknown): unknown => {
    const parsed: unknown = JSON.parse(JSON.stringify(PROVED))
    if (!isCompiledEntry(parsed)) throw new Error('the fixture is not a compiled entry')
    const [child] = parsed.tree.children ?? []
    return { ...parsed, tree: { ...parsed.tree, children: [{ ...child, outcome }] } }
  }

  it('arrives with its move count, its line and the certificate that proves it', async () => {
    respond(PROVED)

    const result = await loadEntry('fixture-legal-trap')
    if (!result.ok) throw new Error(`expected a load, got ${result.failure.reason}`)

    const outcome = result.entry.tree.children?.[0]?.outcome
    expect(outcome).toEqual({
      kind: 'mate',
      inMoves: 2,
      sequence: ['Bxf7+', 'Ke7', 'Nd5#'],
      provedBy: 'modelled-net',
      basis: {
        basis: 'proved',
        by: 'certificate',
        certificate: 'fixture-legal-trap.Bxd1.mate.json',
      },
    })
  })

  it('is refused when the mate names no certificate at all', () => {
    const { basis: _basis, ...unproved } = mateOutcome(PROVED)

    expect(isCompiledEntry(withOutcome(unproved))).toBe(false)
  })

  it('is refused when the mate carries a judgement where a proof belongs', () => {
    const opinion = {
      ...mateOutcome(PROVED),
      basis: { basis: 'judgement', by: 'someone', at: '2026-09-16' },
    }

    expect(isCompiledEntry(withOutcome(opinion))).toBe(false)
  })
})
