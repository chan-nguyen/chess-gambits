import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import {
  checkedKingSquare,
  commitMove,
  gameEnd,
  legalDestinationsFrom,
  promotionRoles,
  replay,
} from './chess-engine.ts'

describe('legalDestinationsFrom', () => {
  it('collapses four promotion moves into one flagged destination', () => {
    const chess = new Chess('k7/4P3/8/8/8/8/8/4K3 w - - 0 1')
    expect(legalDestinationsFrom(chess, 'e7')).toStrictEqual([{ to: 'e8', needsPromotion: true }])
  })

  it('is empty for a square with no piece, or the opponent’s', () => {
    const chess = new Chess()
    expect(legalDestinationsFrom(chess, 'e4')).toStrictEqual([])
    expect(legalDestinationsFrom(chess, 'e7')).toStrictEqual([])
  })
})

describe('checkedKingSquare', () => {
  it('is null when nobody is in check', () => {
    expect(checkedKingSquare(new Chess())).toBeNull()
  })

  it('finds the side-to-move’s own king when it is in check', () => {
    // Scholar's-mate setup, one move short: Black king on e8 is in check from the queen.
    const chess = new Chess('rnb1kbnr/pppp1ppp/8/4p3/2B1P2q/8/PPPP1PPP/RNBQK1NR w KQkq - 4 3')
    // It is White to move and White is not in check yet — the queen threatens f2, not check.
    expect(checkedKingSquare(chess)).toBeNull()
  })

  it('finds the checked king after a move that gives check', () => {
    const chess = new Chess()
    chess.move('f3')
    chess.move('e5')
    chess.move('g4')
    chess.move('Qh4') // checkmate, but check first
    expect(checkedKingSquare(chess)).toBe('e1')
  })
})

describe('gameEnd', () => {
  it('is null mid-game', () => {
    expect(gameEnd(new Chess())).toBeNull()
  })

  it('reports checkmate', () => {
    const chess = new Chess()
    chess.move('f3')
    chess.move('e5')
    chess.move('g4')
    chess.move('Qh4')
    expect(gameEnd(chess)).toBe('checkmate')
  })

  it('reports stalemate', () => {
    // A textbook stalemate: Black to move, no legal move, not in check.
    const chess = new Chess('k7/8/1Q6/8/8/8/8/7K b - - 0 1')
    expect(chess.isStalemate()).toBe(true)
    expect(gameEnd(chess)).toBe('stalemate')
  })

  it('reports a draw by insufficient material as "draw"', () => {
    const chess = new Chess('k7/8/8/8/8/8/8/K7 w - - 0 1')
    expect(gameEnd(chess)).toBe('draw')
  })
})

describe('replay', () => {
  it('replays a legal sequence in full', () => {
    const result = replay(['e4', 'e5', 'Nf3'])
    expect(result.plies).toStrictEqual(['e4', 'e5', 'Nf3'])
    expect(result.lastMove).toStrictEqual({ san: 'Nf3', from: 'g1', to: 'f3' })
  })

  it('stops at the first token that is not a legal move here, rather than throwing', () => {
    const result = replay(['e4', 'e5', 'not-a-move', 'Nf3'])
    expect(result.plies).toStrictEqual(['e4', 'e5'])
    expect(result.lastMove).toStrictEqual({ san: 'e5', from: 'e7', to: 'e5' })
  })

  it('the empty sequence replays to the start position, with no last move', () => {
    const result = replay([])
    expect(result.plies).toStrictEqual([])
    expect(result.lastMove).toBeNull()
    expect(result.chess.fen()).toBe(new Chess().fen())
  })
})

describe('commitMove', () => {
  it('commits an ordinary move and reports its SAN', () => {
    const chess = new Chess()
    expect(commitMove(chess, 'e2', 'e4')).toBe('e4')
    expect(chess.history()).toStrictEqual(['e4'])
  })

  it('commits a promotion with the chosen piece, not always a queen', () => {
    const chess = new Chess('k7/4P3/8/8/8/8/8/4K3 w - - 0 1')
    expect(commitMove(chess, 'e7', 'e8', 'n')).toBe('e8=N')
  })

  it('every promotion role actually commits', () => {
    for (const role of promotionRoles) {
      const chess = new Chess('k7/4P3/8/8/8/8/8/4K3 w - - 0 1')
      const san = commitMove(chess, 'e7', 'e8', role)
      expect(san).not.toBeNull()
      expect(san?.startsWith('e8=')).toBe(true)
    }
  })

  it('returns null, rather than throwing, for a move that is not legal', () => {
    const chess = new Chess()
    expect(commitMove(chess, 'e2', 'e5')).toBeNull()
  })
})
