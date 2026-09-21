import { describe, expect, it } from 'vitest'
import {
  encodeMoves,
  maxMovesPlies,
  movesParam,
  movesSearch,
  parseMovesShape,
} from './moves-param.ts'

/**
 * The `moves` parameter's shape-level encode/decode (issue #129), tested the way
 * `line.test.ts` tests its own sibling module: round-tripping, and the characters that
 * break an unencoded URL — `+` (check) decodes to a space and `#` (mate) starts the
 * fragment, so a move sequence ending in either is exactly the case that would silently
 * truncate if this were built by hand rather than through `encodeURIComponent`.
 */

describe('encodeMoves / movesSearch', () => {
  it('joins plies with an underscore and percent-encodes the whole value', () => {
    expect(encodeMoves(['e4', 'e5'])).toBe('e4_e5')
  })

  it('percent-encodes a check and a mate so the query string is not truncated', () => {
    expect(encodeMoves(['Qxf7+'])).toBe('Qxf7%2B')
    expect(encodeMoves(['Qxf7#'])).toBe('Qxf7%23')
  })

  it('the empty sequence has no query string at all', () => {
    expect(movesSearch([])).toBe('')
  })

  it('a non-empty sequence is a real query string under the documented parameter name', () => {
    expect(movesSearch(['e4', 'e5'])).toBe(`?${movesParam}=e4_e5`)
  })
})

describe('parseMovesShape', () => {
  it('the empty string parses to no plies', () => {
    expect(parseMovesShape('')).toStrictEqual([])
  })

  it('splits on the underscore separator', () => {
    expect(parseMovesShape('e4_e5_Nf3')).toStrictEqual(['e4', 'e5', 'Nf3'])
  })

  it('round-trips through encode and decode (as a URL would decode it)', () => {
    const plies = ['e4', 'e5', 'Qxf7+', 'Kxf7']
    const encoded = encodeMoves(plies)
    // `decodeURIComponent` is what every caller that reads a URL applies before this
    // parser ever sees the value — `URL.searchParams`, `useSearchParams` — the same
    // asymmetry `line.ts` documents for itself.
    expect(parseMovesShape(decodeURIComponent(encoded))).toStrictEqual(plies)
  })

  it('caps the number of plies read, rather than growing without bound', () => {
    const long = Array.from({ length: maxMovesPlies + 50 }, () => 'e4').join('_')
    expect(parseMovesShape(long)).toHaveLength(maxMovesPlies)
  })

  it('is shape-only: a token that is not a real move still comes back as a string', () => {
    // Legality is `replay`'s job (`chess-engine.ts`), not this parser's — see the module
    // doc for why that split exists.
    expect(parseMovesShape('not-a-move')).toStrictEqual(['not-a-move'])
  })
})
