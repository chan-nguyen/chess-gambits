import { describe, expect, it } from 'vitest'
import { numberSequence } from './mate-sequence.ts'

/**
 * Numbering a proved line, which is the one piece of arithmetic in this ticket.
 *
 * The positions are the real ones from `OUTCOMES_ENTRY`, produced by replaying the line
 * through chess.js 1.4.0. A fabricated FEN would make these pass against a position that
 * cannot happen.
 */

/** Légal's Mate after `6...Bxd1`: White to move, move seven. */
const WHITE_TO_MOVE = 'r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N4P/PPPP1PP1/R1BbK2R w KQkq - 0 7'
/** The gambit root after `5.h3`: Black to move, move five. */
const BLACK_TO_MOVE = 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5'

const labels = (fen: string, sequence: readonly string[]): readonly string[] =>
  numberSequence(fen, sequence).map((numbered) => numbered.label)

describe('numbering a line played from a position', () => {
  it('starts on the move number in the FEN when White is to move', () => {
    expect(labels(WHITE_TO_MOVE, ['Bxf7+', 'Ke7', 'Nd5#'])).toStrictEqual([
      '7.Bxf7+',
      '7...Ke7',
      '8.Nd5#',
    ])
  })

  /**
   * The case a naive counter gets wrong: with Black to move the move number is already half
   * spent, so the first ply is `5...` and the *second* is `6.` rather than `6...`.
   */
  it('starts mid-move when Black is to move', () => {
    expect(labels(BLACK_TO_MOVE, ['Bh5', 'Nxe5', 'Bxd1'])).toStrictEqual([
      '5...Bh5',
      '6.Nxe5',
      '6...Bxd1',
    ])
  })

  it('numbers a mate in one, which is the whole of a `search` proof', () => {
    expect(labels(WHITE_TO_MOVE, ['Nd5#'])).toStrictEqual(['7.Nd5#'])
  })

  it('carries the SAN through untouched, because notation is never localised', () => {
    const numbered = numberSequence(WHITE_TO_MOVE, ['Bxf7+', 'Ke7', 'Nd5#'])
    expect(numbered.map((ply) => ply.ply)).toStrictEqual(['Bxf7+', 'Ke7', 'Nd5#'])
  })

  it('has nothing to number when the line is empty', () => {
    expect(numberSequence(WHITE_TO_MOVE, [])).toStrictEqual([])
  })
})

/**
 * A number is worth having only where it is right. Everything below falls back to the bare
 * SAN, because `NaN.Bxf7+` on this site would be worse than no number at all.
 */
describe('a FEN it cannot read', () => {
  it.each([
    ['not a FEN at all', 'hello'],
    ['a side to move that is neither', `${WHITE_TO_MOVE.replace(' w ', ' x ')}`],
    ['a fullmove counter that is not a number', WHITE_TO_MOVE.replace(/ 7$/, ' seven')],
    ['a fullmove counter below one', WHITE_TO_MOVE.replace(/ 7$/, ' 0')],
    ['a fractional fullmove counter', WHITE_TO_MOVE.replace(/ 7$/, ' 7.5')],
  ])('falls back to plain SAN: %s', (_what, fen) => {
    expect(labels(fen, ['Bxf7+', 'Ke7'])).toStrictEqual(['Bxf7+', 'Ke7'])
  })
})
