import { describe, expect, it } from 'vitest'
import { lineParam, lineSearch, parseLine } from './line.ts'
import { describeMateProblem, encodeMate, maxMatePly, mateParam, parseMate } from './mate-step.ts'

/**
 * The `mate` parameter's own half: reading and writing it, in isolation from `line` and from
 * `walk.ts`'s decision about what it means at a given position.
 *
 * `walk.test.ts` owns the half this module cannot: whether a `mate` count actually reaches a
 * proved mate leaf, how it is bound to that leaf's own `sequence.length`, and the precedence
 * this module's own doc comment argues for — `line` and `mate` are never in conflict, since
 * `mate` always names a position forward of the leaf `line` itself names.
 */

describe('the parameter is a second one, not a change to `line`', () => {
  it('has its own name', () => {
    expect(mateParam).toBe('mate')
    expect(mateParam).not.toBe(lineParam)
  })

  /** A URL carrying both parses each one whole, and neither parser reads the other's value. */
  it('parses beside a line without either reading the other', () => {
    const url = new URL(`https://example.test/?${lineParam}=Bh5_Nxe5_Bxd1&${mateParam}=2`)

    expect(parseLine(url.searchParams.get(lineParam) ?? '')).toStrictEqual({
      plies: ['Bh5', 'Nxe5', 'Bxd1'],
      problem: null,
    })
    expect(parseMate(url.searchParams.get(mateParam) ?? '')).toStrictEqual({
      ply: 2,
      problem: null,
    })
  })
})

describe('reading a count', () => {
  it('reads an absent parameter as "not inside a mate sequence"', () => {
    expect(parseMate('')).toStrictEqual({ ply: null, problem: null })
  })

  it('reads zero, the leaf itself and not a distinct step', () => {
    expect(parseMate('0')).toStrictEqual({ ply: 0, problem: null })
  })

  it.each(['1', '2', '9', '512'])('reads %s', (raw) => {
    expect(parseMate(raw)).toStrictEqual({ ply: Number(raw), problem: null })
  })

  /**
   * Everything a number-ish string can be that is not a count, the same list
   * `prelude.test.ts` runs against `parsePrelude` — the two parsers share the same shape of
   * bound, so they share the same adversarial inputs.
   */
  it.each([
    '-1',
    '+1',
    '3.0',
    '3.5',
    ' 3',
    '3 ',
    '0x3',
    '1e2',
    '03',
    'three',
    'NaN',
    'Infinity',
    '../../etc/passwd',
    '<script>',
    '3_4',
  ])('refuses %s rather than coercing it', (raw) => {
    expect(parseMate(raw)).toStrictEqual({
      ply: null,
      problem: { kind: 'not-a-count', value: raw },
    })
  })

  it('refuses a count past the hard bound, since a URL is attacker-controlled', () => {
    expect(parseMate(`${maxMatePly + 1}`)).toStrictEqual({
      ply: null,
      problem: { kind: 'too-many-plies', limit: maxMatePly },
    })
  })

  it('never throws, whatever arrives', () => {
    for (const raw of [' ', '🙂', 'a'.repeat(10_000), '%%%', '[]']) {
      expect(() => parseMate(raw)).not.toThrow()
    }
  })
})

describe('what it writes into a URL', () => {
  it('writes the count under its own name, unprefixed', () => {
    expect(encodeMate(0)).toBe('mate=0')
    expect(encodeMate(2)).toBe('mate=2')
  })

  it('round-trips through a real URL, joined to a line the way `walk.ts` joins them', () => {
    const url = new URL(
      `https://example.test/gambits/legal-mate${lineSearch(['Bh5', 'Nxe5', 'Bxd1'])}&${encodeMate(2)}`,
    )

    expect(parseLine(url.searchParams.get(lineParam) ?? '').plies).toStrictEqual([
      'Bh5',
      'Nxe5',
      'Bxd1',
    ])
    expect(parseMate(url.searchParams.get(mateParam) ?? '').ply).toBe(2)
  })
})

describe('what it says when it refuses', () => {
  it('quotes the value back, so a stale link is diagnosable', () => {
    expect(describeMateProblem({ kind: 'not-a-count', value: 'three' })).toContain('"three"')
  })

  it('names the bound it enforced', () => {
    expect(describeMateProblem({ kind: 'too-many-plies', limit: 512 })).toContain('512')
  })
})
