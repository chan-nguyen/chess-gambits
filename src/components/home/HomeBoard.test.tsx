import { Chess } from 'chess.js'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'
import viLocale from '../../locales/vi.ts'
import type { LastMove } from '../board/Board.tsx'
import { plyMotionBetween, type PlyMotion } from '../learn/ply-motion.ts'
import { HomeBoard } from './HomeBoard.tsx'

/**
 * Dragging a piece with the mouse (#167), on the component the home and analysis pages share.
 * The geometry is `board-drag.test.ts`'s; this is what the drag does to the board and to the
 * move it reports. A real mouse on the real page is `e2e/opening-explorer.spec.ts`'s.
 *
 * jsdom lays nothing out and has no pointer capture, so the board's surface is given a
 * 400px box at the origin — 50px a square — and a capture that does nothing.
 */

const SQUARE = 50

/** The centre of a square as White sees it, in client pixels. */
const at = (square: string) => ({
  clientX: ('abcdefgh'.indexOf(square.charAt(0)) + 0.5) * SQUARE,
  clientY: (8 - Number(square.charAt(1)) + 0.5) * SQUARE,
})

const mouse = { pointerType: 'mouse', button: 0, pointerId: 1 }

afterEach(cleanup)

const renderBoard = async (chess = new Chess(), motion?: PlyMotion) => {
  const onCommit = vi.fn()
  let shown = { chess, motion }
  const page = (arrows?: readonly LastMove[]) => (
    <I18nProvider locale="vi" load={() => Promise.resolve(viLocale)}>
      <HomeBoard
        chess={shown.chess}
        lastMove={undefined}
        check={undefined}
        ended={null}
        announcement={undefined}
        orientation="white"
        arrows={arrows}
        motion={shown.motion}
        onCommit={onCommit}
      />
    </I18nProvider>
  )
  const { container, rerender } = render(page())
  // The provider renders nothing until the locale has loaded.
  await screen.findByRole('grid', { name: viLocale.board.label })
  const surface = container.querySelector('.home-board__surface')
  if (!(surface instanceof HTMLElement)) throw new Error('no board surface')
  Object.defineProperty(surface, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 8 * SQUARE, height: 8 * SQUARE }),
  })
  Object.defineProperty(surface, 'setPointerCapture', { value: () => {} })

  const cell = (square: string): HTMLElement => {
    const found = container.querySelector(`[data-square="${square}"]`)
    if (!(found instanceof HTMLElement)) throw new Error(`no cell ${square}`)
    return found
  }
  const lifted = () => container.querySelector('.home-board__lifted use')
  const marked = () => container.querySelectorAll('.board__square--marked').length
  const targets = () => container.querySelectorAll('.board__target').length
  /** The pieces the last ply took, held under the mover while it slides in. */
  const taken = () => container.querySelectorAll('.board__piece--gone').length

  /** Press on `from`, then move the mouse to each point in turn; the button stays down. */
  const press = (from: string, ...through: readonly { clientX: number; clientY: number }[]) => {
    fireEvent.pointerDown(cell(from), { ...mouse, ...at(from) })
    for (const point of through) moveTo(point)
  }
  const moveTo = (point: { clientX: number; clientY: number }) =>
    fireEvent.pointerMove(surface, { ...mouse, ...point })
  const release = (point: { clientX: number; clientY: number }) =>
    fireEvent.pointerUp(surface, { ...mouse, ...point })

  /** The page drawing the board again with a new engine arrow, as the analysis page does. */
  const redraw = (arrows: readonly LastMove[]) => rerender(page(arrows))

  /** The page's next position arriving, as it does once a move it was told of has been played. */
  const arrive = (next: Chess, nextMotion?: PlyMotion) => {
    shown = { chess: next, motion: nextMotion }
    rerender(page())
  }

  return { onCommit, cell, lifted, marked, targets, taken, press, moveTo, release, redraw, arrive }
}

/** 1.e4 d5, White to move: the position an `exd5` is played from. */
const beforeCapture = () => {
  const chess = new Chess()
  for (const san of ['e4', 'd5']) chess.move(san)
  return chess
}

/** The position after 2.exd5, and the ply that took the pawn on d5 to reach it. */
const capture = () => {
  const before = beforeCapture()
  const chess = new Chess(before.fen())
  chess.move('exd5')
  return { chess, motion: plyMotionBetween(before.fen(), chess.fen()) }
}

describe('dragging a piece with the mouse', () => {
  it('lifts the piece off its square and draws it under the pointer', async () => {
    const board = await renderBoard()
    board.press('e2', at('e3'))

    expect(board.lifted()?.getAttribute('transform')).toBe('translate(4.000 5.000)')
    expect(board.cell('e2')).toHaveAccessibleName('e2, ô trống')
    // Selected as a click would select it: the square tinted, e3 and e4 dotted.
    expect(board.marked()).toBe(1)
    expect(board.targets()).toBe(2)

    board.moveTo(at('e4'))
    expect(board.lifted()?.getAttribute('transform')).toBe('translate(4.000 4.000)')
  })

  it('keeps the piece under the pointer when the page redraws the board mid-drag', async () => {
    const board = await renderBoard()
    board.press('e2', at('e3'), at('d4'))
    board.redraw([{ from: 'g1', to: 'f3' }])

    expect(board.lifted()?.getAttribute('transform')).toBe('translate(3.000 4.000)')
    board.release(at('e4'))
    expect(board.onCommit).toHaveBeenCalledExactlyOnceWith('e4')
  })

  it('plays the move it is dropped on, and keeps the piece there until the position arrives', async () => {
    const board = await renderBoard()
    board.press('e2', at('e3'), at('e4'))
    board.release(at('e4'))

    expect(board.onCommit).toHaveBeenCalledExactlyOnceWith('e4')
    expect(board.lifted()).toBeNull()
    expect(board.cell('e4')).toHaveAccessibleName('e4, tốt trắng')
    expect(board.cell('e2')).toHaveAccessibleName('e2, ô trống')
  })

  it('ignores the click a browser sends after a drop', async () => {
    const board = await renderBoard()
    board.press('g1', at('g2'))
    board.release(at('g1'))
    fireEvent.click(board.cell('g1'))

    // Still selected: the click did not deselect it, so f3 is still a move away.
    expect(board.marked()).toBe(1)
    fireEvent.click(board.cell('f3'))
    expect(board.onCommit).toHaveBeenCalledExactlyOnceWith('Nf3')
  })

  it('puts the piece back and clears the selection when dropped where it cannot go', async () => {
    const board = await renderBoard()
    board.press('e2', at('e3'), at('e5'))
    board.release(at('e5'))

    expect(board.onCommit).not.toHaveBeenCalled()
    expect(board.cell('e2')).toHaveAccessibleName('e2, tốt trắng')
    expect(board.marked()).toBe(0)
    expect(board.targets()).toBe(0)
  })

  it('puts the piece back when dropped off the board', async () => {
    const board = await renderBoard()
    board.press('e2', at('e3'), { clientX: 225, clientY: 600 })
    expect(board.lifted()?.getAttribute('transform')).toBe('translate(4.000 11.500)')
    board.release({ clientX: 225, clientY: 600 })

    expect(board.onCommit).not.toHaveBeenCalled()
    expect(board.cell('e2')).toHaveAccessibleName('e2, tốt trắng')
    expect(board.marked()).toBe(0)
  })

  it('asks which piece before a dropped promotion commits', async () => {
    const board = await renderBoard(new Chess('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1'))
    board.press('b7', at('b8'))
    board.release(at('b8'))

    expect(board.onCommit).not.toHaveBeenCalled()
    const picker = screen.getByRole('group', { name: viLocale.home.choosePromotion })
    fireEvent.click(within(picker).getByRole('button', { name: viLocale.board.whiteBishop }))
    expect(board.onCommit).toHaveBeenCalledExactlyOnceWith('b8=B')
  })
})

describe('what does not start a drag', () => {
  it('a press that does not travel, which stays a click', async () => {
    const board = await renderBoard()
    board.press('e2', { clientX: at('e2').clientX + 2, clientY: at('e2').clientY })
    board.release(at('e2'))
    expect(board.lifted()).toBeNull()

    fireEvent.click(board.cell('e2'))
    fireEvent.click(board.cell('e4'))
    expect(board.onCommit).toHaveBeenCalledExactlyOnceWith('e4')
  })

  it('a piece of the side not to move', async () => {
    const board = await renderBoard()
    board.press('e7', at('e6'), at('e5'))
    expect(board.lifted()).toBeNull()
    expect(board.marked()).toBe(0)
  })

  it('a finger, which keeps the tap and leaves the page to scroll', async () => {
    const board = await renderBoard()
    fireEvent.pointerDown(board.cell('e2'), { ...mouse, pointerType: 'touch', ...at('e2') })
    fireEvent.pointerMove(board.cell('e2'), { ...mouse, pointerType: 'touch', ...at('e4') })
    expect(board.lifted()).toBeNull()
    expect(board.marked()).toBe(0)
  })
})

describe('the slide the caller asks for (#72)', () => {
  it('draws the piece the last ply took under the mover, and nothing when it is not asked', async () => {
    const { chess, motion } = capture()
    expect((await renderBoard(chess, motion)).taken()).toBe(1)
    cleanup()
    expect((await renderBoard(chess)).taken()).toBe(0)
  })

  it('does not bring that piece back while another is in the hand, or when it is put down', async () => {
    const { chess, motion } = capture()
    const board = await renderBoard(chess, motion)
    board.press('g8', at('g7'))
    expect(board.lifted()).not.toBeNull()
    expect(board.taken()).toBe(0)

    board.release(at('g8'))
    expect(board.taken()).toBe(0)
  })

  it('does not bring back the piece a drop took, when its position arrives', async () => {
    const before = beforeCapture()
    const board = await renderBoard(before)
    board.press('e4', at('e5'), at('d5'))
    board.release(at('d5'))

    const { chess: took, motion } = capture()
    board.arrive(took, motion)
    expect(board.taken()).toBe(0)

    // The next ply is drawn as usual: the silence was for the drop and not for the board.
    const answered = new Chess(took.fen())
    answered.move('Qxd5')
    board.arrive(answered, plyMotionBetween(took.fen(), answered.fen()))
    expect(board.taken()).toBe(1)
  })
})
