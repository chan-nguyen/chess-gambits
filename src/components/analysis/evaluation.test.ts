import { describe, expect, it } from 'vitest'
import {
  bestMoveArrow,
  formatScore,
  fromEngine,
  numberedLine,
  whiteShare,
  type EngineLine,
} from './evaluation.ts'
import type { UciInfo } from './uci.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
/** 1.f3 e5 2.g4: Black to move, and ...Qh4# is on. */
const FOOLS = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2'

const info = (overrides: Partial<UciInfo>): UciInfo => ({
  depth: 12,
  multipv: 1,
  score: { kind: 'cp', value: 0 },
  wdl: null,
  pv: ['e2e4'],
  ...overrides,
})

describe("turning the engine's side-to-move view into White's", () => {
  it('keeps the sign when White is to move', () => {
    const line = fromEngine(START, info({ score: { kind: 'cp', value: 30 }, wdl: [60, 900, 40] }))
    expect(line?.score).toStrictEqual({ kind: 'cp', value: 30 })
    expect(line?.chances).toStrictEqual({ white: 60, draw: 900, black: 40 })
  })

  /** Captured: after 1.e4 the engine says `score cp -25 wdl 7 945 48` from Black's side. */
  it('flips the sign and the WDL when Black is to move', () => {
    const line = fromEngine(
      AFTER_E4,
      info({ score: { kind: 'cp', value: -25 }, wdl: [7, 945, 48], pv: ['e7e6'] }),
    )
    expect(line?.score).toStrictEqual({ kind: 'cp', value: 25 })
    expect(line?.chances).toStrictEqual({ white: 48, draw: 945, black: 7 })
  })

  it('makes a Black mate negative', () => {
    const line = fromEngine(FOOLS, info({ score: { kind: 'mate', value: 1 }, pv: ['d8h4'] }))
    expect(line?.score).toStrictEqual({ kind: 'mate', value: -1 })
  })

  it('replays the line into SAN, with the squares each move used', () => {
    const line = fromEngine(START, info({ pv: ['e2e4', 'e7e5', 'g1f3'] }))
    expect(line?.moves).toStrictEqual([
      { san: 'e4', from: 'e2', to: 'e4' },
      { san: 'e5', from: 'e7', to: 'e5' },
      { san: 'Nf3', from: 'g1', to: 'f3' },
    ])
  })

  it('writes a mate and a promotion the way SAN does', () => {
    expect(fromEngine(FOOLS, info({ pv: ['d8h4'] }))?.moves[0]?.san).toBe('Qh4#')
    const promoting = fromEngine('8/1P6/8/8/8/8/k7/7K w - - 0 1', info({ pv: ['b7b8q'] }))
    expect(promoting?.moves[0]?.san).toBe('b8=Q')
  })

  it('cuts the line at the first move that is not legal, rather than trusting it', () => {
    const line = fromEngine(START, info({ pv: ['e2e4', 'e2e4', 'g1f3'] }))
    expect(line?.moves.map((move) => move.san)).toStrictEqual(['e4'])
  })

  it('refuses a line that replays to nothing', () => {
    expect(fromEngine(START, info({ pv: ['e7e5'] }))).toBeNull()
    expect(fromEngine(START, info({ pv: ['zz99'] }))).toBeNull()
  })
})

describe('printing a score', () => {
  it.each([
    [{ kind: 'cp', value: 34 }, '+0.34'],
    [{ kind: 'cp', value: -120 }, '-1.20'],
    [{ kind: 'cp', value: 0 }, '0.00'],
    [{ kind: 'mate', value: 3 }, 'M3'],
    [{ kind: 'mate', value: -2 }, '-M2'],
  ] as const)('prints %j as %s', (score, printed) => {
    expect(formatScore(score)).toBe(printed)
  })
})

describe("White's share of the bar", () => {
  const line = (overrides: Partial<EngineLine>): EngineLine => ({
    score: { kind: 'cp', value: 0 },
    chances: null,
    moves: [{ san: 'e4', from: 'e2', to: 'e4' }],
    ...overrides,
  })

  it("is White's expected score under the WDL model: a win and half a draw", () => {
    expect(whiteShare(line({ chances: { white: 100, draw: 800, black: 100 } }))).toBe(0.5)
    expect(whiteShare(line({ chances: { white: 500, draw: 500, black: 0 } }))).toBe(0.75)
  })

  it('fills for whoever is mating, without WDL', () => {
    expect(whiteShare(line({ score: { kind: 'mate', value: 2 } }))).toBe(1)
    expect(whiteShare(line({ score: { kind: 'mate', value: -2 } }))).toBe(0)
  })

  it('falls back to a logistic of the centipawns, level at zero and leaning with the score', () => {
    expect(whiteShare(line({}))).toBe(0.5)
    expect(whiteShare(line({ score: { kind: 'cp', value: 200 } }))).toBeGreaterThan(0.6)
    expect(whiteShare(line({ score: { kind: 'cp', value: -200 } }))).toBeLessThan(0.4)
  })
})

describe('numbering a line', () => {
  it('numbers from the position, for either side to move', () => {
    expect(numberedLine(START, ['e4', 'e5', 'Nf3'])).toBe('1.e4 e5 2.Nf3')
    expect(numberedLine(AFTER_E4, ['e5', 'Nf3', 'Nc6'])).toBe('1...e5 2.Nf3 Nc6')
    expect(numberedLine(FOOLS, ['Qh4#'])).toBe('2...Qh4#')
  })

  it('starts from the move number the FEN gives, not from one', () => {
    const late = 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 4 14'
    expect(numberedLine(late, ['O-O', 'd6'])).toBe('14.O-O d6')
  })
})

describe('the best-move arrow', () => {
  it('is the first move of the best line, and nothing while there is none', () => {
    const moves = [{ san: 'e4', from: 'e2', to: 'e4' }] as const
    const evaluation = {
      depth: 5,
      complete: false,
      lines: [{ score: { kind: 'cp', value: 20 }, chances: null, moves }],
    } as const
    expect(bestMoveArrow(evaluation)).toStrictEqual({ from: 'e2', to: 'e4' })
    expect(bestMoveArrow(null)).toBeNull()
    expect(bestMoveArrow({ depth: 1, complete: true, lines: [] })).toBeNull()
  })
})
