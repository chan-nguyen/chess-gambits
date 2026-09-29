import { describe, expect, it } from 'vitest'
import { movesSearch } from '../home/moves-param.ts'
import {
  analysisSearch,
  importPgn,
  maxAnalysisPlies,
  parseLine,
  parsePly,
  playAt,
  scoresheet,
  withSetup,
} from './analysis-line.ts'

describe('the address', () => {
  it('reads a home-board URL as the same line, standing at its end', () => {
    // `analysisSearch` at the end of a line is `movesSearch`, so every home link is valid here.
    expect(analysisSearch({ start: null, line: ['e4', 'e5'], ply: 2 }, false)).toBe(
      movesSearch(['e4', 'e5']),
    )
  })

  it('writes `ply` only when the board is not at the end', () => {
    expect(analysisSearch({ start: null, line: ['e4', 'e5'], ply: 1 }, false)).toBe(
      '?moves=e4_e5&ply=1',
    )
    expect(analysisSearch({ start: null, line: ['e4', 'e5'], ply: 0 }, true)).toBe(
      '?moves=e4_e5&ply=0&flip=1',
    )
    expect(analysisSearch({ start: null, line: [], ply: 0 }, false)).toBe('')
  })

  it('encodes check and mate so the URL does not lose them', () => {
    expect(analysisSearch({ start: null, line: ['f3', 'e5', 'g4', 'Qh4#'], ply: 4 }, false)).toBe(
      '?moves=f3_e5_g4_Qh4%23',
    )
  })

  it('caps a line at its bound', () => {
    const long = Array.from({ length: maxAnalysisPlies + 50 }, () => 'Nf3').join('_')
    expect(parseLine(long)).toHaveLength(maxAnalysisPlies)
    expect(parseLine(null)).toStrictEqual([])
  })
})

describe('a line from a set-up position', () => {
  const start = '4k3/8/8/8/8/8/8/4K3 b - - 0 14'

  it('writes the position first, encoded, and keeps it on every step', () => {
    expect(analysisSearch({ start, line: [], ply: 0 }, false)).toBe(
      `?fen=${encodeURIComponent(start)}`,
    )
    expect(analysisSearch({ start, line: ['Kd7'], ply: 0 }, true)).toBe(
      `?fen=${encodeURIComponent(start)}&moves=Kd7&ply=0&flip=1`,
    )
    expect(playAt({ start, line: [], ply: 0 }, 'Kd7')).toStrictEqual({
      start,
      line: ['Kd7'],
      ply: 1,
    })
  })
})

describe('the position editor in the address', () => {
  it('opens beside what is already there, byte for byte, and closes back to it', () => {
    const open = withSetup('?moves=e4_e5&ply=1&flip=1', '8/8/8/8/8/8/8/8 w - - 0 1')
    expect(open).toBe(
      '?moves=e4_e5&ply=1&flip=1&setup=8%2F8%2F8%2F8%2F8%2F8%2F8%2F8%20w%20-%20-%200%201',
    )
    expect(withSetup(open, null)).toBe('?moves=e4_e5&ply=1&flip=1')
  })

  it('replaces the board it holds rather than adding a second one', () => {
    const once = withSetup('', '4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(withSetup(once, '8/8/8/8/8/8/8/8 w - - 0 1').match(/setup=/g)).toHaveLength(1)
    expect(withSetup(once, null)).toBe('')
  })
})

describe('the scoresheet', () => {
  it('pairs a line from the initial position from move 1', () => {
    expect(scoresheet(null, 3)).toStrictEqual([
      { number: 1, white: 0, black: 1 },
      { number: 2, white: 2, black: null },
    ])
  })

  it("starts a line with Black to move on Black's half of its own move number", () => {
    expect(scoresheet('4k3/8/8/8/8/8/8/4K3 b - - 0 14', 3)).toStrictEqual([
      { number: 14, white: null, black: 0 },
      { number: 15, white: 1, black: 2 },
    ])
  })

  it('has no rows for no moves, whoever is to move', () => {
    expect(scoresheet(null, 0)).toStrictEqual([])
    expect(scoresheet('4k3/8/8/8/8/8/8/4K3 b - - 0 1', 0)).toStrictEqual([])
  })
})

describe('reading `ply`', () => {
  it('stands at the end when absent', () => {
    expect(parsePly(null, 6)).toBe(6)
  })

  it('reads a count, clamped to the line', () => {
    expect(parsePly('0', 6)).toBe(0)
    expect(parsePly('3', 6)).toBe(3)
    expect(parsePly('999', 6)).toBe(6)
  })

  it.each(['', '-1', '1.5', 'two', '12345', '0x2'])('reads %j as the end', (raw) => {
    expect(parsePly(raw, 6)).toBe(6)
  })
})

describe('playing a move mid-line', () => {
  const line = ['e4', 'e5', 'Nf3', 'Nc6']

  it("steps onto the line's own move and keeps the rest", () => {
    expect(playAt({ start: null, line, ply: 2 }, 'Nf3')).toStrictEqual({
      start: null,
      line,
      ply: 3,
    })
  })

  it('replaces the rest of the line with any other move', () => {
    expect(playAt({ start: null, line, ply: 2 }, 'Bc4')).toStrictEqual({
      start: null,
      line: ['e4', 'e5', 'Bc4'],
      ply: 3,
    })
  })

  it('extends the line at its end', () => {
    expect(playAt({ start: null, line, ply: 4 }, 'Bb5')).toStrictEqual({
      start: null,
      line: [...line, 'Bb5'],
      ply: 5,
    })
  })
})

describe('a pasted PGN', () => {
  it('reads the main line, headers and all', () => {
    const pgn = '[Event "Casual"]\n[White "A"]\n[Black "B"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'
    expect(importPgn(pgn)).toStrictEqual({
      ok: true,
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
    })
  })

  it('reads bare movetext, with comments and a result', () => {
    expect(importPgn('1. e4 {best by test} e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0')).toStrictEqual({
      ok: true,
      moves: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'],
    })
  })

  it('refuses nothing at all', () => {
    expect(importPgn('   \n ')).toStrictEqual({ ok: false, problem: 'empty' })
  })

  it('refuses an illegal move instead of stopping silently before it', () => {
    expect(importPgn('1. e4 e5 2. Ke3 Ke6 3. Bxz9')).toStrictEqual({
      ok: false,
      problem: 'invalid',
    })
    expect(importPgn('hello')).toStrictEqual({ ok: false, problem: 'invalid' })
  })

  it('refuses a game from a set-up position, rather than replaying it from the wrong board', () => {
    const pgn = '[SetUp "1"]\n[FEN "8/8/8/8/8/8/k7/7K w - - 0 1"]\n\n1. Kg2 *'
    expect(importPgn(pgn)).toStrictEqual({ ok: false, problem: 'custom-start' })
  })

  it('refuses a paste too long to be a game before parsing it', () => {
    expect(importPgn('e4 '.repeat(20_000))).toStrictEqual({ ok: false, problem: 'too-long' })
  })
})
