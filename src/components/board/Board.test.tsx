import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Board } from './Board'
import { FEN_FIXTURES, VIETNAMESE_LABELS } from './board-fixtures'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

afterEach(cleanup)

const cellNamed = (name: string) => screen.getByRole('gridcell', { name })
const focusedCell = () => document.activeElement
/** `.focus()` schedules a React state update, so it belongs inside act like any event. */
const focusCell = (name: string) => {
  const cell = cellNamed(name)
  act(() => cell.focus())
  return cell
}

describe('rendering a position (AC 1)', () => {
  it('renders all sixty-four squares', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    expect(screen.getAllByRole('gridcell')).toHaveLength(64)
  })

  it.each(FEN_FIXTURES)('draws one piece per occupant of $name', ({ fen }) => {
    const { container } = render(<Board fen={fen} labels={VIETNAMESE_LABELS} />)
    const placement = fen.split(' ')[0] ?? ''
    const occupants = [...placement].filter((character) => /[a-z]/i.test(character)).length
    expect(container.querySelectorAll('use')).toHaveLength(occupants)
  })

  it('puts each piece on the square the FEN gives it', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    expect(cellNamed('e1, vua trắng')).toBeInTheDocument()
    expect(cellNamed('d8, hậu đen')).toBeInTheDocument()
    expect(cellNamed('b1, mã trắng')).toBeInTheDocument()
    expect(cellNamed('e4, ô trống')).toBeInTheDocument()
  })
})

describe('grid semantics and roving tabindex (AC 2)', () => {
  it('is a grid of eight rows of eight cells', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const grid = screen.getByRole('grid', { name: 'Bàn cờ' })
    const rows = within(grid).getAllByRole('row')
    expect(rows).toHaveLength(8)
    for (const row of rows) expect(within(row).getAllByRole('gridcell')).toHaveLength(8)
  })

  // The whole point: seven boards on screen must not be two hundred tab stops.
  it('is exactly one tab stop, whatever else is on the board', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const cells = screen.getAllByRole('gridcell')
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1)
    expect(cells.filter((cell) => cell.tabIndex === -1)).toHaveLength(63)
  })

  it('keeps one tab stop across four boards', () => {
    render(
      <>
        <Board fen={START} labels={VIETNAMESE_LABELS} />
        <Board fen={START} labels={VIETNAMESE_LABELS} />
        <Board fen={START} labels={VIETNAMESE_LABELS} />
        <Board fen={START} labels={VIETNAMESE_LABELS} />
      </>,
    )
    const tabbable = screen.getAllByRole('gridcell').filter((cell) => cell.tabIndex === 0)
    expect(tabbable).toHaveLength(4)
  })

  it('moves focus with the arrow keys and carries the tab stop along', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const a1 = focusCell('a1, xe trắng')
    expect(a1.tabIndex).toBe(0)

    fireEvent.keyDown(a1, { key: 'ArrowRight' })
    expect(focusedCell()).toBe(cellNamed('b1, mã trắng'))
    expect(cellNamed('b1, mã trắng').tabIndex).toBe(0)
    expect(cellNamed('a1, xe trắng').tabIndex).toBe(-1)

    fireEvent.keyDown(cellNamed('b1, mã trắng'), { key: 'ArrowUp' })
    expect(focusedCell()).toBe(cellNamed('b2, tốt trắng'))

    fireEvent.keyDown(cellNamed('b2, tốt trắng'), { key: 'ArrowLeft' })
    expect(focusedCell()).toBe(cellNamed('a2, tốt trắng'))

    fireEvent.keyDown(cellNamed('a2, tốt trắng'), { key: 'ArrowDown' })
    expect(focusedCell()).toBe(cellNamed('a1, xe trắng'))
  })

  it('sends Home to the a-file and End to the h-file', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const d4 = focusCell('d4, ô trống')

    fireEvent.keyDown(d4, { key: 'End' })
    expect(focusedCell()).toBe(cellNamed('h4, ô trống'))

    fireEvent.keyDown(cellNamed('h4, ô trống'), { key: 'Home' })
    expect(focusedCell()).toBe(cellNamed('a4, ô trống'))
  })

  it('reads arrow keys against the screen, not the files, when flipped', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} orientation="black" />)
    const d4 = focusCell('d4, ô trống')
    fireEvent.keyDown(d4, { key: 'ArrowRight' })
    expect(focusedCell()).toBe(cellNamed('c4, ô trống'))
  })

  it('stops at the edge instead of wrapping', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const a1 = focusCell('a1, xe trắng')
    fireEvent.keyDown(a1, { key: 'ArrowLeft' })
    expect(focusedCell()).toBe(a1)
  })

  it('leaves keys it does not own to the page', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const a1 = focusCell('a1, xe trắng')
    const event = new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true })
    a1.dispatchEvent(event)
    // `f` flips the board at page level (design-system.md §4); the board must not eat it.
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('accessible names (AC 3)', () => {
  it('names every square with its occupant in the active locale', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    expect(cellNamed('f3, ô trống')).toBeInTheDocument()
    expect(cellNamed('g8, mã đen')).toBeInTheDocument()
    expect(cellNamed('c1, tượng trắng')).toBeInTheDocument()
  })

  it('speaks the piece name from the locale map, not from English in the component', () => {
    render(
      <Board
        fen="8/8/8/8/5N2/8/8/4K2k w - - 0 1"
        labels={{
          board: 'Échiquier',
          emptySquare: 'case vide',
          pieces: { ...VIETNAMESE_LABELS.pieces, whiteKnight: 'cavalier blanc' },
        }}
      />,
    )
    expect(cellNamed('f4, cavalier blanc')).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'Échiquier' })).toBeInTheDocument()
    expect(screen.queryByRole('gridcell', { name: /knight/i })).not.toBeInTheDocument()
  })

  it('names every one of the sixty-four cells', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    for (const cell of screen.getAllByRole('gridcell')) {
      expect(cell).toHaveAccessibleName(/^[a-h][1-8], .+/)
    }
  })
})

describe('the live region (AC 4)', () => {
  it('is polite, and present before there is anything to announce', () => {
    const { container } = render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const region = container.querySelector('[role="status"]')
    expect(region).not.toBeNull()
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('')
  })

  it('announces the ply that produced the position, verbatim from the prop', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} announcement="Nxe5, ăn quân, chiếu hết" />)
    expect(screen.getByRole('status')).toHaveTextContent('Nxe5, ăn quân, chiếu hết')
  })
})

describe('orientation (AC 5)', () => {
  it('puts White at the bottom by default and Black at the bottom when flipped', () => {
    const { container, rerender } = render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const firstCell = () => container.querySelectorAll('[role="gridcell"]')[0]
    const lastCell = () => container.querySelectorAll('[role="gridcell"]')[63]
    expect(firstCell()).toHaveAttribute('data-square', 'a8')
    expect(lastCell()).toHaveAttribute('data-square', 'h1')

    rerender(<Board fen={START} labels={VIETNAMESE_LABELS} orientation="black" />)
    expect(firstCell()).toHaveAttribute('data-square', 'h1')
    expect(lastCell()).toHaveAttribute('data-square', 'a8')
  })

  it('re-labels the coordinates when it flips', () => {
    const coordinates = (root: HTMLElement) =>
      [...root.querySelectorAll('.board__coordinate')].map((node) => node.textContent)

    const { container, rerender } = render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const white = coordinates(container)
    expect(white).toHaveLength(16)
    // Ranks run down the left edge top to bottom, then files along the bottom edge.
    expect(white.slice(0, 8)).toStrictEqual(['8', '7', '6', '5', '4', '3', '2', '1'])
    expect(white.slice(8)).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])

    rerender(<Board fen={START} labels={VIETNAMESE_LABELS} orientation="black" />)
    const black = coordinates(container)
    expect(black.slice(0, 8)).toStrictEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    expect(black.slice(8)).toStrictEqual(['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'])
  })

  it('keeps a1 dark in both orientations', () => {
    const { container, rerender } = render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const a1Class = () => container.querySelectorAll('.board__square')[56]?.getAttribute('class')
    expect(a1Class()).toContain('board__square--dark')
    rerender(<Board fen={START} labels={VIETNAMESE_LABELS} orientation="black" />)
    expect(container.querySelectorAll('.board__square')[7]?.getAttribute('class')).toContain(
      'board__square--dark',
    )
  })

  it('can drop the coordinates, which is what a branch preview needs', () => {
    const { container } = render(
      <Board fen={START} labels={VIETNAMESE_LABELS} showCoordinates={false} />,
    )
    expect(container.querySelectorAll('.board__coordinate')).toHaveLength(0)
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(64)
  })
})

describe('highlights (AC 6)', () => {
  const highlighted = () =>
    render(
      <Board
        fen={START}
        labels={VIETNAMESE_LABELS}
        lastMove={{ from: 'e2', to: 'e4' }}
        check="e8"
        marks={['d5', 'f7']}
      />,
    ).container

  /**
   * 2026-09-18: both squares of the last ply are tinted and neither carries a ring any
   * more. Read off the class attribute in full rather than by the presence of one name, so
   * a differently-spelled tint fails here too.
   */
  it('tints the square a ply left and the square it reached, differently from each other', () => {
    const container = highlighted()
    expect(container.querySelectorAll('.board__square--from')).toHaveLength(1)
    expect(container.querySelectorAll('.board__square--to')).toHaveLength(1)

    // e2 is the square this ply left: file e is x=4, rank 2 is y=6, so 6 * 8 + 4.
    const left = container.querySelectorAll('.board__square')[52]
    expect(left?.getAttribute('class')).toBe(
      'board__square board__square--light board__square--from',
    )
  })

  it('draws no ring or border on either square — a tint is the whole signal', () => {
    const container = highlighted()
    expect(container.querySelectorAll('.board__last-ply')).toHaveLength(0)

    // Check is still a disc, not a fifth tinted square.
    expect(container.querySelectorAll('circle.board__check')).toHaveLength(1)
    // A mark is still a ring, a different shape again.
    expect(container.querySelectorAll('circle.board__mark')).toHaveLength(2)
  })

  it('draws the mark over the pieces so an occupied square still reads', () => {
    const container = highlighted()
    const nodes = [...(container.querySelector('svg')?.children ?? [])]
    const lastPiece = nodes.findLastIndex((node) => node.tagName === 'use')
    const firstMark = nodes.findIndex((node) => node.classList.contains('board__mark'))
    expect(firstMark).toBeGreaterThan(lastPiece)
  })

  it('draws check behind the piece, so the king is still visible', () => {
    const container = highlighted()
    const nodes = [...(container.querySelector('svg')?.children ?? [])]
    const check = nodes.findIndex((node) => node.classList.contains('board__check'))
    const firstPiece = nodes.findIndex((node) => node.tagName === 'use')
    expect(check).toBeLessThan(firstPiece)
  })

  it('renders nothing extra when nothing is highlighted', () => {
    const { container } = render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    expect(container.querySelectorAll('.board__square--from')).toHaveLength(0)
    expect(container.querySelectorAll('.board__square--to')).toHaveLength(0)
    expect(container.querySelectorAll('.board__check')).toHaveLength(0)
    expect(container.querySelectorAll('.board__mark')).toHaveLength(0)
  })
})

describe('the board displays and never accepts a move (AC 8)', () => {
  it('offers nothing draggable and no control that promises an action', () => {
    const { container } = render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    expect(container.querySelectorAll('[draggable]')).toHaveLength(0)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0)
  })

  it('marks the grid read-only', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    expect(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true')
  })

  it('does not change the position when a square is clicked', () => {
    render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const e2 = cellNamed('e2, tốt trắng')
    fireEvent.click(e2)
    fireEvent.click(cellNamed('e4, ô trống'))
    expect(cellNamed('e2, tốt trắng')).toBeInTheDocument()
    expect(cellNamed('e4, ô trống')).toBeInTheDocument()
  })
})

describe('the piece sprite is inlined (AC 11)', () => {
  it('defines its shapes in the document and references them locally', () => {
    const { container } = render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    expect(container.querySelectorAll('symbol')).toHaveLength(6)
    for (const use of container.querySelectorAll('use')) {
      expect(use.getAttribute('href')).toMatch(/^#/)
    }
  })

  it('never asks the network for a piece', () => {
    const { container } = render(<Board fen={START} labels={VIETNAMESE_LABELS} />)
    const markup = container.innerHTML
    expect(markup).not.toMatch(/https?:\/\//)
    expect(container.querySelectorAll('image')).toHaveLength(0)
  })

  // Two boards sharing one sprite id would make every `<use>` resolve to the first.
  it('gives each board its own sprite ids', () => {
    const { container } = render(
      <>
        <Board fen={START} labels={VIETNAMESE_LABELS} />
        <Board fen={START} labels={VIETNAMESE_LABELS} />
      </>,
    )
    const ids = [...container.querySelectorAll('symbol')].map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/**
 * The static half of #72. Where a piece *travels* is a browser question and
 * `e2e/piece-animation.spec.ts` answers it by watching pieces move; what jsdom can answer
 * is the property that whole animation rests on — that the board with nothing running on it
 * is the position, and nothing else.
 */
describe('a ply that moved a piece (#72)', () => {
  /** `e4` with White at the bottom: the fifth column, four rows down from rank 8. */
  const E4 = 'translate(4 4)'
  const E2 = 'translate(4 6)'

  const afterOpeningPly = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

  it('draws the piece that moved on the square it reached, not the one it came from', () => {
    const { container } = render(
      <Board
        fen={afterOpeningPly}
        labels={VIETNAMESE_LABELS}
        arrivedFrom={new Map([['e4', 'e2']])}
      />,
    )
    const transforms = [...container.querySelectorAll('use')].map((use) =>
      use.getAttribute('transform'),
    )

    expect(transforms, 'the pawn is drawn on e4').toContain(E4)
    expect(transforms, 'the pawn is left standing on the square it came from').not.toContain(E2)
  })

  it('draws the piece the ply took, where it stood, over and above the position', () => {
    const { container } = render(
      <Board
        fen={afterOpeningPly}
        labels={VIETNAMESE_LABELS}
        arrivedFrom={new Map([['e4', 'e2']])}
        captured={new Map([['e4', 'blackPawn']])}
      />,
    )

    const taken = container.querySelectorAll('.board__piece--gone')
    expect(taken, 'one extra piece, the one that came off').toHaveLength(1)
    expect(container.querySelectorAll('use')).toHaveLength(33)
    expect(taken[0]?.getAttribute('transform')).toBe(E4)
  })

  it('draws no taken piece when the ply took nothing', () => {
    const { container } = render(<Board fen={afterOpeningPly} labels={VIETNAMESE_LABELS} />)

    expect(container.querySelectorAll('.board__piece--gone')).toHaveLength(0)
    expect(container.querySelectorAll('use')).toHaveLength(32)
  })
})
