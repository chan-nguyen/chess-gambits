import { describe, expect, it } from 'vitest'
import {
  canCastle,
  emptyFen,
  maxPiecesPerSide,
  readSetup,
  readStart,
  setupFen,
  setupProblem,
  startingFen,
  withCastling,
  withPiece,
  withTurn,
  type Setup,
} from './setup-position.ts'

const setup = (fen: string): Setup => {
  const read = readSetup(fen)
  if (read === null) throw new Error(`fixture: ${fen} does not read`)
  return read
}

/** Two kings and nothing else, White to move: the smallest position that can be analysed. */
const KINGS = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'

describe('reading a FEN', () => {
  it.each([startingFen, emptyFen, KINGS, 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 12 40'])(
    'writes %s back exactly as it read it',
    (fen) => {
      expect(setupFen(setup(fen))).toBe(fen)
    },
  )

  it('fills in the fields a hand-typed FEN leaves off', () => {
    expect(setupFen(setup('4k3/8/8/8/8/8/8/4K3'))).toBe(KINGS)
    expect(setupFen(setup('4k3/8/8/8/8/8/8/4K3 b'))).toBe('4k3/8/8/8/8/8/8/4K3 b - - 0 1')
  })

  it('accepts a position no game could reach, because an editor passes through them', () => {
    expect(readSetup(emptyFen)).not.toBeNull()
    expect(readSetup('KKKK4/8/8/8/8/8/8/8 w - - 0 1')).not.toBeNull()
  })

  it.each([
    ['nothing', ''],
    ['seven ranks', '8/8/8/8/8/8/8 w - - 0 1'],
    ['a rank of nine', '9/8/8/8/8/8/8/8 w - - 0 1'],
    ['a rank of seven', '7/8/8/8/8/8/8/8 w - - 0 1'],
    ['a letter that is not a piece', '4x3/8/8/8/8/8/8/4K3 w - - 0 1'],
    ['a side that is neither', `${KINGS.split(' ')[0]} x - - 0 1`],
    ['castling out of order', `${KINGS.split(' ')[0]} w qK - 0 1`],
    ['en passant off the board', `${KINGS.split(' ')[0]} w - e9 0 1`],
    ['a counter that is not one', `${KINGS.split(' ')[0]} w - - x 1`],
    ['a seventh field', `${KINGS} extra`],
    ['something too long to be a FEN', `${KINGS}${' '.repeat(100)}`],
  ])('refuses %s', (_, fen) => {
    expect(readSetup(fen)).toBeNull()
  })
})

describe('castling', () => {
  it('is possible only with the king and that rook at home', () => {
    const start = setup(startingFen).placement
    expect(canCastle(start, 'K')).toBe(true)
    expect(canCastle(setup(KINGS).placement, 'K')).toBe(false)
    expect(canCastle(withPiece(setup(startingFen), 'a1', null).placement, 'Q')).toBe(false)
    expect(canCastle(withPiece(setup(startingFen), 'a1', null).placement, 'K')).toBe(true)
  })

  it('writes out only the rights the pieces allow, whatever was asked for', () => {
    expect(setupFen(setup('4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1'))).toBe(KINGS)
    expect(setupFen(setup('r3k3/8/8/8/8/8/8/4K2R w KQkq - 0 1'))).toBe(
      'r3k3/8/8/8/8/8/8/4K2R w Kq - 0 1',
    )
  })

  it('is switched on and off one right at a time', () => {
    const noWhite = withCastling(withCastling(setup(startingFen), 'K', false), 'Q', false)
    expect(setupFen(noWhite)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w kq - 0 1')
    expect(setupFen(withCastling(noWhite, 'Q', true))).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w Qkq - 0 1',
    )
  })
})

describe('editing', () => {
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

  it('puts a piece on a square, replacing whatever stood there, and empties one', () => {
    const edited = withPiece(withPiece(setup(KINGS), 'd1', 'whiteQueen'), 'e8', 'blackQueen')
    expect(setupFen(edited)).toBe('4q3/8/8/8/8/8/8/3QK3 w - - 0 1')
    expect(setupFen(withPiece(edited, 'd1', null))).toBe('4q3/8/8/8/8/8/8/4K3 w - - 0 1')
  })

  it('drops en passant once the position is no longer the one it described', () => {
    expect(setupFen(setup(afterE4))).toBe(afterE4)
    expect(setupFen(withPiece(setup(afterE4), 'a3', 'whiteKnight'))).toContain(' b KQkq - ')
    expect(setupFen(withTurn(setup(afterE4), 'white'))).toContain(' w KQkq - ')
  })

  it('keeps en passant when the side to move is chosen again unchanged', () => {
    expect(setupFen(withTurn(setup(afterE4), 'black'))).toBe(afterE4)
  })

  it('never changes the setup it was given', () => {
    const before = setup(KINGS)
    withPiece(before, 'd1', 'whiteQueen')
    withCastling(before, 'K', true)
    expect(setupFen(before)).toBe(KINGS)
  })
})

describe('what stops a position being analysed', () => {
  it('finds nothing wrong with the initial position or two kings', () => {
    expect(setupProblem(setup(startingFen))).toBeNull()
    expect(setupProblem(setup(KINGS))).toBeNull()
  })

  it.each([
    ['white-king', emptyFen],
    ['white-king', '4k3/8/8/8/8/8/8/K3K3 w - - 0 1'],
    ['black-king', '8/8/8/8/8/8/8/4K3 w - - 0 1'],
    ['black-king', 'k3k3/8/8/8/8/8/8/4K3 w - - 0 1'],
    ['pawn-on-edge', 'P3k3/8/8/8/8/8/8/4K3 w - - 0 1'],
    ['pawn-on-edge', '4k3/8/8/8/8/8/8/p3K3 w - - 0 1'],
    // White to move, and White's queen already attacks Black's king.
    ['opponent-in-check', '4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1'],
    // Kings side by side: each is attacking the other, whoever is to move.
    ['opponent-in-check', '8/8/8/8/8/8/8/3kK3 b - - 0 1'],
  ])('says %s about %s', (problem, fen) => {
    expect(setupProblem(setup(fen))).toBe(problem)
  })

  it('allows the side to move to be in check, which is only a position', () => {
    expect(setupProblem(setup('4k3/4Q3/8/8/8/8/8/4K3 b - - 0 1'))).toBeNull()
  })

  it(`refuses more than ${maxPiecesPerSide} pieces a side, and allows exactly that many`, () => {
    // A king and sixteen knights, none of them near the black king.
    const seventeen = setup('4k3/8/8/8/NNNNNNNN/NNNNNNNN/8/K7 w - - 0 1')
    expect(setupProblem(seventeen)).toBe('too-many-pieces')
    expect(setupProblem(withPiece(seventeen, 'h4', null))).toBeNull()
  })

  it('refuses an en passant square the position cannot have', () => {
    expect(setupProblem(setup('4k3/8/8/8/8/8/8/4K3 w - e3 0 1'))).toBe('invalid')
  })
})

describe('the start of a line, read from a URL', () => {
  it('is null when absent, unreadable or not analysable', () => {
    expect(readStart(null)).toBeNull()
    expect(readStart('nonsense')).toBeNull()
    expect(readStart(emptyFen)).toBeNull()
  })

  it('is null for the initial position, so it has one address', () => {
    expect(readStart(startingFen)).toBeNull()
    expect(readStart('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -')).toBeNull()
    // Without its castling rights it is a different position, and keeps its address.
    expect(readStart('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
    )
  })

  it('is the position as chess.js writes it', () => {
    expect(readStart('4k3/8/8/8/8/8/8/4K3 b')).toBe('4k3/8/8/8/8/8/8/4K3 b - - 0 1')
    // An en passant square no pawn can use is dropped, as chess.js drops it.
    expect(readStart('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2')).toBe(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    )
  })
})
