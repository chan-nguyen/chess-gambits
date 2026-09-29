import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { parseFen } from '../board/board-model.ts'
import {
  DRAG_THRESHOLD,
  boardPoint,
  liftedTransform,
  squareAtPoint,
  travelled,
  withoutPiece,
} from './board-drag.ts'

/** A 400px board whose top-left corner is at (100, 50) on screen: 50px a square. */
const BOX = { left: 100, top: 50, width: 400 }

/** The centre of a square, in client pixels, counted from the top-left as drawn. */
const centreOf = (column: number, row: number) => ({
  clientX: BOX.left + 50 * column + 25,
  clientY: BOX.top + 50 * row + 25,
})

describe('boardPoint', () => {
  it('measures the pointer in squares from the top-left corner', () => {
    expect(boardPoint({ clientX: 100, clientY: 50 }, BOX)).toStrictEqual({ x: 0, y: 0 })
    expect(boardPoint({ clientX: 500, clientY: 450 }, BOX)).toStrictEqual({ x: 8, y: 8 })
    expect(boardPoint(centreOf(4, 6), BOX)).toStrictEqual({ x: 4.5, y: 6.5 })
  })

  it('goes outside 0–8 off the board rather than clamping', () => {
    expect(boardPoint({ clientX: 50, clientY: 500 }, BOX)).toStrictEqual({ x: -1, y: 9 })
  })
})

describe('squareAtPoint', () => {
  it('reads the square the way up White sits', () => {
    expect(squareAtPoint(boardPoint(centreOf(0, 0), BOX), 'white')).toBe('a8')
    expect(squareAtPoint(boardPoint(centreOf(4, 6), BOX), 'white')).toBe('e2')
    expect(squareAtPoint(boardPoint(centreOf(7, 7), BOX), 'white')).toBe('h1')
  })

  it('reads it the other way up when the board is flipped', () => {
    expect(squareAtPoint(boardPoint(centreOf(0, 0), BOX), 'black')).toBe('h1')
    expect(squareAtPoint(boardPoint(centreOf(4, 6), BOX), 'black')).toBe('d7')
  })

  it('is null off every edge of the board', () => {
    expect(squareAtPoint({ x: -0.01, y: 3 }, 'white')).toBeNull()
    expect(squareAtPoint({ x: 3, y: -0.01 }, 'white')).toBeNull()
    expect(squareAtPoint({ x: 8, y: 3 }, 'white')).toBeNull()
    expect(squareAtPoint({ x: 3, y: 8 }, 'white')).toBeNull()
  })
})

describe('travelled', () => {
  const start = { clientX: 200, clientY: 200 }

  it('is a click, not a drag, below the threshold', () => {
    expect(travelled(start, start)).toBe(false)
    expect(travelled(start, { clientX: 200 + DRAG_THRESHOLD - 1, clientY: 200 })).toBe(false)
  })

  it('is a drag at the threshold, in any direction', () => {
    expect(travelled(start, { clientX: 200 + DRAG_THRESHOLD, clientY: 200 })).toBe(true)
    expect(travelled(start, { clientX: 200, clientY: 200 - DRAG_THRESHOLD })).toBe(true)
  })
})

describe('liftedTransform', () => {
  it('centres the piece on the pointer', () => {
    expect(liftedTransform({ x: 4.5, y: 6.5 })).toBe('translate(4.000 6.000)')
    expect(liftedTransform({ x: -1, y: 0.25 })).toBe('translate(-1.500 -0.250)')
  })
})

describe('withoutPiece', () => {
  it('takes the lifted piece off its square and leaves every other one', () => {
    const chess = new Chess()
    const before = parseFen(chess.fen())
    const after = parseFen(withoutPiece(chess, 'e2'))

    expect(after.has('e2')).toBe(false)
    expect(after.size).toBe(before.size - 1)
    expect(after.get('d2')).toBe('whitePawn')
  })

  it('never touches the position it was given', () => {
    const chess = new Chess()
    withoutPiece(chess, 'g1')
    expect(chess.get('g1')).toStrictEqual({ type: 'n', color: 'w' })
  })
})
