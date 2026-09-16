import { describe, expect, it } from 'vitest'
import { describeLineProblem, encodeLine, lineSearch, maxLinePlies, parseLine } from './line'

/**
 * SAN plies drawn from real gambit lines. The pool deliberately over-represents the
 * characters that break an unencoded URL: `+` (check) decodes to a space and `#` (mate)
 * starts the fragment, so the links that break are exactly the links to proved
 * checkmates — see docs/CONTEXT.md, *Path*.
 */
const sanPool: readonly string[] = [
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bc4',
  'Bc5',
  'b4',
  'Bxb4',
  'c3',
  'Ba5',
  'd4',
  'exd4',
  'O-O',
  'O-O-O',
  'Nxe5',
  'Bxd1',
  'Bxf7+',
  'Ke7',
  'Nd5#',
  'Qh4+',
  'Qxf7#',
  'Nbd7',
  'R1e2',
  'Qa6xb7#',
  'exd8=Q+',
  'e8=Q',
  'axb8=N#',
  'Rd8+',
  'Kf8',
  'Bh6#',
]

/** Deterministic PRNG: a property test that fails must fail the same way twice. */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(items: readonly T[], random: () => number): T => {
  const index = Math.floor(random() * items.length)
  const item = items[index]
  if (item === undefined) throw new Error(`empty pool at index ${index}`)
  return item
}

const generatePaths = (count: number, seed: number): readonly (readonly string[])[] => {
  const random = mulberry32(seed)
  return Array.from({ length: count }, () => {
    const length = 1 + Math.floor(random() * 12)
    return Array.from({ length }, () => pick(sanPool, random))
  })
}

/** The whole point: go through a real URL, not a string that looks like one. */
const roundTrip = (plies: readonly string[]): readonly string[] => {
  const url = new URL(`https://example.test/vi/gambits/evans-gambit${lineSearch(plies)}`)
  const raw = url.searchParams.get('line')
  const result = parseLine(raw ?? '')
  expect(result.problem).toBeNull()
  return result.plies
}

describe('line encoding', () => {
  it('matches the encoding documented in CONTEXT.md exactly', () => {
    const plies = ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#']
    expect(encodeLine(plies)).toBe('Nxe5_Bxd1_Bxf7%2B_Ke7_Nd5%23')
    expect(lineSearch(plies)).toBe('?line=Nxe5_Bxd1_Bxf7%2B_Ke7_Nd5%23')
  })

  it('round-trips 200 generated SAN paths through a real URL', () => {
    const paths = generatePaths(200, 0x5eed)
    expect(paths.length).toBeGreaterThanOrEqual(20)
    for (const plies of paths) {
      expect(roundTrip(plies)).toEqual(plies)
    }
  })

  it('round-trips every path that contains a check or a mate', () => {
    const risky = generatePaths(200, 0xc4ec).filter((plies) =>
      plies.some((ply) => ply.includes('+') || ply.includes('#')),
    )
    expect(risky.length).toBeGreaterThanOrEqual(20)
    for (const plies of risky) {
      expect(roundTrip(plies)).toEqual(plies)
    }
  })

  it('round-trips every single ply in the pool on its own', () => {
    for (const ply of sanPool) {
      expect(roundTrip([ply])).toEqual([ply])
    }
  })

  it('omits the parameter entirely for the root of the tree', () => {
    expect(lineSearch([])).toBe('')
    expect(encodeLine([])).toBe('')
  })

  it('agrees with the encoding URLSearchParams produces', () => {
    const plies = ['Bxf7+', 'Nd5#', 'exd8=Q+']
    const search = new URLSearchParams({ line: plies.join('_') })
    expect(search.toString()).toBe(`line=${encodeLine(plies)}`)
    expect(parseLine(search.get('line') ?? '').plies).toEqual(plies)
  })
})

describe('line parsing of untrusted input', () => {
  it('reads the root for a missing or empty parameter', () => {
    expect(parseLine('')).toEqual({ plies: [], problem: null })
  })

  it('never throws, whatever it is handed', () => {
    const hostile = [
      '_',
      '__',
      'e4_',
      '_e4',
      'e4__e5',
      '<script>alert(1)</script>',
      '../../etc/passwd',
      '%%%',
      'e4_'.repeat(5000),
      String.fromCharCode(0),
      'null',
      '[object Object]',
    ]
    for (const raw of hostile) {
      expect(() => parseLine(raw)).not.toThrow()
    }
  })

  it('recovers to the nearest valid node and says which ply was wrong', () => {
    const result = parseLine('e4_e5_not-a-move_Nf3')
    expect(result.plies).toEqual(['e4', 'e5'])
    expect(result.problem).toEqual({ kind: 'malformed-ply', index: 2, ply: 'not-a-move' })
    const problem = result.problem
    if (problem === null) throw new Error('expected a problem')
    expect(describeLineProblem(problem)).toContain('not-a-move')
    expect(describeLineProblem(problem)).toContain('3')
  })

  it('recovers from the exact corruption an unencoded link produces', () => {
    // ?line=Nxe5_Bxd1_Bxf7+_Ke7_Nd5#  arrives decoded as one ply containing a space.
    const corrupted = new URL('https://example.test/?line=Nxe5_Bxd1_Bxf7+_Ke7_Nd5#')
    const raw = corrupted.searchParams.get('line')
    expect(raw).toBe('Nxe5_Bxd1_Bxf7 _Ke7_Nd5')
    const result = parseLine(raw ?? '')
    expect(result.plies).toEqual(['Nxe5', 'Bxd1'])
    expect(result.problem).toEqual({ kind: 'malformed-ply', index: 2, ply: 'Bxf7 ' })
  })

  it('reports an empty ply rather than silently dropping it', () => {
    expect(parseLine('e4__e5').problem).toEqual({ kind: 'empty-ply', index: 1 })
    expect(parseLine('e4__e5').plies).toEqual(['e4'])
  })

  it('caps an absurdly long line instead of walking it', () => {
    const result = parseLine(Array.from({ length: maxLinePlies + 5 }, () => 'e4').join('_'))
    expect(result.plies).toHaveLength(maxLinePlies)
    expect(result.problem).toEqual({ kind: 'too-many-plies', limit: maxLinePlies })
    const problem = result.problem
    if (problem === null) throw new Error('expected a problem')
    expect(describeLineProblem(problem)).toContain(String(maxLinePlies))
  })

  it('accepts the SAN shapes real content uses', () => {
    for (const ply of sanPool) {
      expect(parseLine(ply)).toEqual({ plies: [ply], problem: null })
    }
  })

  it('rejects shapes that are not SAN', () => {
    const notSan = ['e9', 'i4', 'Xf3', 'e4e5', '0-0', 'Nf3??', 'Bxf7++', '1.e4']
    for (const ply of notSan) {
      expect(parseLine(ply).plies).toEqual([])
      expect(parseLine(ply).problem).not.toBeNull()
    }
  })
})
