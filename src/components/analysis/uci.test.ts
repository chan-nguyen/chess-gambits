import { describe, expect, it } from 'vitest'
import { parseUciLine } from './uci.ts'

/**
 * Every fixture here is a line `stockfish-19-lite-single` actually printed, captured on
 * 2026-09-28 by running the vendored build under Node (#154) — not a line written to fit the
 * parser.
 */

describe('the handshake', () => {
  it('reads uciok and readyok', () => {
    expect(parseUciLine('uciok')).toStrictEqual({ kind: 'uciok' })
    expect(parseUciLine('readyok')).toStrictEqual({ kind: 'readyok' })
  })

  it('ignores the identity and option lines', () => {
    expect(parseUciLine('id name Stockfish 19 Lite WASM')).toStrictEqual({ kind: 'other' })
    expect(parseUciLine('option name UCI_ShowWDL type check default false')).toStrictEqual({
      kind: 'other',
    })
  })
})

describe('an info line', () => {
  it('reads depth, line number, score, WDL and the principal variation', () => {
    expect(
      parseUciLine(
        'info depth 12 seldepth 15 multipv 2 score cp -34 wdl 5 927 68 nodes 108576 nps 987054 hashfull 31 time 110 pv c7c5 g1f3 e7e6 d2d4',
      ),
    ).toStrictEqual({
      kind: 'info',
      info: {
        depth: 12,
        multipv: 2,
        score: { kind: 'cp', value: -34 },
        wdl: [5, 927, 68],
        pv: ['c7c5', 'g1f3', 'e7e6', 'd2d4'],
      },
    })
  })

  it('reads a mate score', () => {
    const message = parseUciLine(
      'info depth 8 seldepth 2 multipv 1 score mate 1 wdl 1000 0 0 nodes 1932 nps 644000 hashfull 0 time 3 pv d8h4',
    )
    expect(message).toMatchObject({
      kind: 'info',
      info: { score: { kind: 'mate', value: 1 }, wdl: [1000, 0, 0], pv: ['d8h4'] },
    })
  })

  it('reads a promotion in the line', () => {
    const message = parseUciLine('info depth 3 multipv 1 score cp 900 pv b7b8q a7a6')
    expect(message).toMatchObject({ kind: 'info', info: { pv: ['b7b8q', 'a7a6'] } })
  })

  it('treats a line without multipv as the best line', () => {
    expect(parseUciLine('info depth 5 score cp 20 pv e2e4')).toMatchObject({
      info: { multipv: 1, wdl: null },
    })
  })

  it('ignores a bounded score, which the same depth is about to take back', () => {
    expect(
      parseUciLine('info depth 14 multipv 1 score cp 41 lowerbound nodes 9 pv e2e4'),
    ).toStrictEqual({ kind: 'other' })
    expect(
      parseUciLine('info depth 14 multipv 1 score cp 12 upperbound nodes 9 pv e2e4'),
    ).toStrictEqual({ kind: 'other' })
  })

  it('ignores the mated position, which carries no line', () => {
    expect(parseUciLine('info depth 0 score mate 0')).toStrictEqual({ kind: 'other' })
  })

  it('ignores info strings and progress lines', () => {
    expect(
      parseUciLine(
        'info string NNUE evaluation using nn-61e7af4bb97d.nnue (1MiB, (768, 1024, 32, 32, 1))',
      ),
    ).toStrictEqual({ kind: 'other' })
    expect(parseUciLine('info depth 9 currmove e2e4 currmovenumber 1')).toStrictEqual({
      kind: 'other',
    })
  })
})

describe('the end of a search', () => {
  it('reads the best move, ignoring the ponder move', () => {
    expect(parseUciLine('bestmove e7e6 ponder b1c3')).toStrictEqual({
      kind: 'bestmove',
      move: 'e7e6',
    })
  })

  it('reads a position with no legal move as no move', () => {
    expect(parseUciLine('bestmove (none)')).toStrictEqual({ kind: 'bestmove', move: null })
  })
})

describe('whatever else arrives', () => {
  it.each(['', '   ', 'garbage', 'info', 'info depth x score cp y pv'])(
    'never throws on %j',
    (line) => {
      expect(() => parseUciLine(line)).not.toThrow()
      expect(parseUciLine(line).kind).toBe('other')
    },
  )
})
