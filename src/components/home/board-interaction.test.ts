import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { resolveActivation } from './board-interaction.ts'

/**
 * The home board's move-selection logic (issue #131's own "done" checklist), tested as a
 * pure function over a real `chess.js` instance rather than a mounted component.
 */

describe('resolveActivation', () => {
  it('selects a square with at least one legal move, when nothing is selected', () => {
    const chess = new Chess()
    expect(resolveActivation(chess, null, 'e2')).toStrictEqual({ kind: 'select', square: 'e2' })
  })

  it('does nothing for a square with no legal move, when nothing is selected', () => {
    const chess = new Chess()
    // A rook has no legal first move from a1.
    expect(resolveActivation(chess, null, 'a1')).toStrictEqual({ kind: 'none' })
  })

  it('does nothing for an opponent piece, when nothing is selected', () => {
    const chess = new Chess()
    // It is White to move, so a black piece has no legal move to offer yet.
    expect(resolveActivation(chess, null, 'e7')).toStrictEqual({ kind: 'none' })
  })

  it('commits the move when the activated square is a non-promoting destination', () => {
    const chess = new Chess()
    expect(resolveActivation(chess, 'e2', 'e4')).toStrictEqual({
      kind: 'commit',
      from: 'e2',
      to: 'e4',
    })
  })

  it('deselects when the activated square is the one already selected', () => {
    const chess = new Chess()
    expect(resolveActivation(chess, 'e2', 'e2')).toStrictEqual({ kind: 'deselect' })
  })

  it('switches selection to a different selectable origin, while one is already selected', () => {
    const chess = new Chess()
    expect(resolveActivation(chess, 'e2', 'd2')).toStrictEqual({ kind: 'select', square: 'd2' })
  })

  it('does nothing for a square that is neither a destination nor a selectable origin', () => {
    const chess = new Chess()
    expect(resolveActivation(chess, 'e2', 'a1')).toStrictEqual({ kind: 'none' })
  })

  it('asks for a promotion choice when the destination is a pawn reaching the back rank', () => {
    // White to promote on e8, from e7, with the back rank clear to receive it.
    const chess = new Chess('k7/4P3/8/8/8/8/8/4K3 w - - 0 1')
    expect(resolveActivation(chess, 'e7', 'e8')).toStrictEqual({
      kind: 'promote',
      from: 'e7',
      to: 'e8',
    })
  })

  it('commits without asking, for the same pawn moving one rank short of promotion', () => {
    const chess = new Chess('k7/8/4P3/8/8/8/8/4K3 w - - 0 1')
    expect(resolveActivation(chess, 'e6', 'e7')).toStrictEqual({
      kind: 'commit',
      from: 'e6',
      to: 'e7',
    })
  })

  it('resolves castling as an ordinary two-square king move, with no special-casing needed', () => {
    // White king and rook both on their home squares, nothing between them.
    const chess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(resolveActivation(chess, 'e1', 'g1')).toStrictEqual({
      kind: 'commit',
      from: 'e1',
      to: 'g1',
    })
  })

  it('resolves en passant as an ordinary pawn destination', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('a6')
    chess.move('e5')
    chess.move('d5') // Black's pawn lands beside White's, opening en passant on d6.
    expect(resolveActivation(chess, 'e5', 'd6')).toStrictEqual({
      kind: 'commit',
      from: 'e5',
      to: 'd6',
    })
  })

  it('offers nothing at all once the game has ended', () => {
    // Fool's mate: Black to move has no legal move anywhere, checkmated.
    const chess = new Chess()
    chess.move('f3')
    chess.move('e5')
    chess.move('g4')
    chess.move('Qh4')
    expect(chess.isCheckmate()).toBe(true)
    expect(resolveActivation(chess, null, 'e8')).toStrictEqual({ kind: 'none' })
  })
})
