import { describe, expect, it } from 'vitest'
import { FEN_FIXTURES, VIETNAMESE_LABELS } from './board-fixtures'
import {
  FILES,
  RANKS,
  isLightSquare,
  nextFocus,
  orientedFiles,
  orientedRanks,
  parseFen,
  squareAt,
  squareLabel,
} from './board-model'
import type { BoardLabels, FocusedSquare, PieceKey, Position } from './board-model'

/**
 * An independent oracle: the reverse of the mapping the module keeps privately. Written
 * out rather than imported, so a round trip proves something instead of proving that one
 * table agrees with itself.
 */
const FEN_CHARACTERS: Readonly<Record<PieceKey, string>> = {
  whiteKing: 'K',
  whiteQueen: 'Q',
  whiteRook: 'R',
  whiteBishop: 'B',
  whiteKnight: 'N',
  whitePawn: 'P',
  blackKing: 'k',
  blackQueen: 'q',
  blackRook: 'r',
  blackBishop: 'b',
  blackKnight: 'n',
  blackPawn: 'p',
}

const toPlacement = (position: Position): string =>
  [...RANKS]
    .reverse()
    .map((rank) => {
      let row = ''
      let empty = 0
      for (const file of FILES) {
        const piece = position.get(squareAt(file, rank))
        if (piece === undefined) {
          empty += 1
          continue
        }
        if (empty > 0) {
          row += String(empty)
          empty = 0
        }
        row += FEN_CHARACTERS[piece]
      }
      return empty > 0 ? `${row}${String(empty)}` : row
    })
    .join('/')

const placementOf = (fen: string): string => fen.split(' ')[0] ?? ''
const countOf = (placement: string, character: string): number =>
  [...placement].filter((each) => each === character).length

describe('the fixture positions', () => {
  it('provides more than the fifty real positions the property test needs', () => {
    expect(FEN_FIXTURES.length).toBeGreaterThanOrEqual(50)
  })

  // Catches a typo in the fixtures themselves, which would otherwise quietly weaken
  // every property below it.
  it.each(FEN_FIXTURES)('$name is a structurally sound position', ({ fen }) => {
    const placement = placementOf(fen)
    const rows = placement.split('/')
    expect(rows).toHaveLength(8)
    for (const row of rows) {
      const width = [...row].reduce((total, character) => {
        const skipped = Number.parseInt(character, 10)
        return total + (Number.isNaN(skipped) ? 1 : skipped)
      }, 0)
      expect(width).toBe(8)
    }
    expect(countOf(placement, 'K')).toBe(1)
    expect(countOf(placement, 'k')).toBe(1)
    expect(countOf(placement, 'P')).toBeLessThanOrEqual(8)
    expect(countOf(placement, 'p')).toBeLessThanOrEqual(8)
  })
})

describe('parseFen over real positions', () => {
  // AC 1. The property: re-encoding whatever was read reproduces the placement field
  // exactly, so no piece is dropped, duplicated, or put on the wrong square.
  it.each(FEN_FIXTURES)('$name round-trips through the board and back', ({ fen }) => {
    expect(toPlacement(parseFen(fen))).toBe(placementOf(fen))
  })

  it.each(FEN_FIXTURES)('$name places only pieces the FEN names', ({ fen }) => {
    const position = parseFen(fen)
    const placement = placementOf(fen)
    expect(position.size).toBe([...placement].filter((each) => /[a-z]/i.test(each)).length)
    for (const square of position.keys()) {
      expect(square).toMatch(/^[a-h][1-8]$/)
    }
  })

  it('reads the starting position onto the squares a chessboard actually has', () => {
    const position = parseFen(FEN_FIXTURES[0]?.fen ?? '')
    expect(position.size).toBe(32)
    expect(position.get('e1')).toBe('whiteKing')
    expect(position.get('d8')).toBe('blackQueen')
    expect(position.get('a1')).toBe('whiteRook')
    expect(position.get('h8')).toBe('blackRook')
    expect(position.get('e4')).toBeUndefined()
  })

  it('ignores everything after the placement field', () => {
    const withoutSuffix = parseFen('8/8/8/4k3/8/8/4Q3/4K3')
    const withSuffix = parseFen('8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1')
    expect([...withoutSuffix]).toStrictEqual([...withSuffix])
  })
})

describe('parseFen on input it cannot read', () => {
  // Recovering rather than erroring (design-system.md §4). A throw here would take the
  // page down; an empty board is visible and diagnosable.
  it.each([
    ['empty', ''],
    ['too few ranks', '8/8/8/8'],
    ['too many ranks', '8/8/8/8/8/8/8/8/8'],
    ['a rank that is too short', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN'],
    ['a rank that is too long', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNRR'],
    ['an unknown piece letter', 'xnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'],
    ['punctuation', '!!!/8/8/8/8/8/8/8'],
  ])('yields an empty board for %s', (_reason, fen) => {
    expect(parseFen(fen).size).toBe(0)
  })
})

describe('square geometry', () => {
  it('makes a1 dark and h1 light, as a chessboard is', () => {
    expect(isLightSquare('a', '1')).toBe(false)
    expect(isLightSquare('h', '1')).toBe(true)
    expect(isLightSquare('a', '8')).toBe(true)
    expect(isLightSquare('h', '8')).toBe(false)
  })

  it('orders files and ranks for each orientation', () => {
    expect(orientedFiles('white')[0]).toBe('a')
    expect(orientedFiles('black')[0]).toBe('h')
    expect(orientedRanks('white')[0]).toBe('8')
    expect(orientedRanks('black')[0]).toBe('1')
  })
})

describe('nextFocus', () => {
  const e4: FocusedSquare = { file: 'e', rank: '4' }

  it('moves arrows the way the board is drawn, not the way the files run', () => {
    expect(nextFocus('ArrowRight', e4, 'white')).toStrictEqual({ file: 'f', rank: '4' })
    expect(nextFocus('ArrowRight', e4, 'black')).toStrictEqual({ file: 'd', rank: '4' })
    expect(nextFocus('ArrowUp', e4, 'white')).toStrictEqual({ file: 'e', rank: '5' })
    expect(nextFocus('ArrowUp', e4, 'black')).toStrictEqual({ file: 'e', rank: '3' })
    expect(nextFocus('ArrowLeft', e4, 'white')).toStrictEqual({ file: 'd', rank: '4' })
    expect(nextFocus('ArrowDown', e4, 'white')).toStrictEqual({ file: 'e', rank: '3' })
  })

  // AC 2 says the a-file and the h-file, not the first and last column, so these stay
  // absolute on a flipped board — which is what a cell announcing itself "a4" implies.
  it('sends Home to the a-file and End to the h-file in either orientation', () => {
    expect(nextFocus('Home', e4, 'white')).toStrictEqual({ file: 'a', rank: '4' })
    expect(nextFocus('End', e4, 'white')).toStrictEqual({ file: 'h', rank: '4' })
    expect(nextFocus('Home', e4, 'black')).toStrictEqual({ file: 'a', rank: '4' })
    expect(nextFocus('End', e4, 'black')).toStrictEqual({ file: 'h', rank: '4' })
  })

  it('stops at the edges rather than wrapping round', () => {
    expect(nextFocus('ArrowLeft', { file: 'a', rank: '4' }, 'white')).toStrictEqual({
      file: 'a',
      rank: '4',
    })
    expect(nextFocus('ArrowUp', { file: 'e', rank: '8' }, 'white')).toStrictEqual({
      file: 'e',
      rank: '8',
    })
  })

  it('declines keys that are not its business', () => {
    for (const key of ['Enter', ' ', 'Tab', 'a', 'PageUp', 'Escape']) {
      expect(nextFocus(key, e4, 'white')).toBeUndefined()
    }
  })
})

describe('squareLabel', () => {
  const labels: BoardLabels = VIETNAMESE_LABELS

  // AC 3, and the example the ticket gives verbatim.
  it('names the square and its occupant in the active locale', () => {
    expect(squareLabel('f3', 'whiteKnight', labels)).toBe('f3, mã trắng')
    expect(squareLabel('d8', 'blackQueen', labels)).toBe('d8, hậu đen')
  })

  it('still names an empty square', () => {
    expect(squareLabel('e4', undefined, labels)).toBe('e4, ô trống')
  })
})
