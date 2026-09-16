import { useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import './Board.css'
import { PieceSprite } from './piece-sprite'
import {
  FILES,
  RANKS,
  colourOf,
  isLightSquare,
  nextFocus,
  orientedFiles,
  orientedRanks,
  parseFen,
  roleOf,
  shapeId,
  squareAt,
  squareLabel,
} from './board-model'
import type { BoardLabels, FocusedSquare, Orientation, Square } from './board-model'

export type LastMove = { readonly from: Square; readonly to: Square }

export type BoardProps = {
  /** The position to display. Derived upstream and never authored (CONTEXT.md, Node). */
  readonly fen: string
  /** Square and piece names in the active locale. Wiring is #7's; the map is a prop. */
  readonly labels: BoardLabels
  /** Which side sits at the bottom. Defaults to White. */
  readonly orientation?: Orientation | undefined
  /**
   * What the polite live region says — the ply that produced this position, including
   * check, capture and checkmate. Supplied ready-made: the board does not know chess and
   * does not generate SAN.
   */
  readonly announcement?: string | undefined
  readonly lastMove?: LastMove | undefined
  /** The square of a king in check. */
  readonly check?: Square | undefined
  /** Arbitrary squares to mark. Teaching arrows are a later ticket. */
  readonly marks?: readonly Square[] | undefined
  /** Off for previews, which are small and carry no coordinates. */
  readonly showCoordinates?: boolean | undefined
}

/**
 * Which square an element stands for, read back off the element itself.
 *
 * Navigation resolves its origin from the focused cell rather than from state, so the
 * two can never disagree: the DOM is the single answer to "where am I", and the state
 * below only decides which cell carries the tab stop.
 */
const squareOf = (element: EventTarget | null): FocusedSquare | undefined => {
  if (!(element instanceof HTMLElement)) return undefined
  const file = FILES.find((candidate) => candidate === element.dataset['file'])
  const rank = RANKS.find((candidate) => candidate === element.dataset['rank'])
  return file === undefined || rank === undefined ? undefined : { file, rank }
}

const SQUARE_CENTRE = 0.5
const CHECK_RADIUS = 0.45
const MARK_RADIUS = 0.39
const HIGHLIGHT_INSET = 0.06
// Unitless SVG user units, so no px reaches the stylesheet (see Board.css).
const COORDINATE_SIZE = 0.2

/**
 * A chessboard that displays a position and never accepts a move.
 *
 * There is no drag, no click-to-move, no rules logic and no `chess.js`: nothing in v1
 * lets a learner play a piece, so the machinery for it would be weight without a
 * capability (ADR-0003). What the board owes instead is an accessibility model — a
 * `role="grid"` of 64 cells on a single tab stop, each named with its square and
 * occupant in the learner's language, and one polite live region.
 *
 * Under 400 lines by ADR-0003's tripwire, which `board-tripwire.test.ts` measures.
 */
export const Board = ({
  fen,
  labels,
  orientation = 'white',
  announcement,
  lastMove,
  check,
  marks,
  showCoordinates = true,
}: BoardProps) => {
  const position = useMemo(() => parseFen(fen), [fen])
  const files = useMemo(() => orientedFiles(orientation), [orientation])
  const ranks = useMemo(() => orientedRanks(orientation), [orientation])
  const markedSquares = useMemo(() => new Set(marks ?? []), [marks])
  const gridRef = useRef<HTMLDivElement>(null)

  // Stripped to letters and digits so the id is safe in a `#fragment` reference.
  const spriteId = useId().replace(/[^a-zA-Z0-9]/g, '')

  const [focused, setFocused] = useState<FocusedSquare>(() =>
    orientation === 'white' ? { file: 'a', rank: '1' } : { file: 'h', rank: '8' },
  )
  const focusedSquare = squareAt(focused.file, focused.rank)

  const cells = useMemo(
    () =>
      ranks.flatMap((rank, y) =>
        files.map((file, x) => ({
          square: squareAt(file, rank),
          file,
          rank,
          x,
          y,
          light: isLightSquare(file, rank),
        })),
      ),
    [files, ranks],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const origin = squareOf(event.target)
    if (origin === undefined) return
    const target = nextFocus(event.key, origin, orientation)
    if (target === undefined) return
    event.preventDefault()
    setFocused(target)
    const square = squareAt(target.file, target.rank)
    const cell = gridRef.current?.querySelector(`[data-square="${square}"]`)
    if (cell instanceof HTMLElement) cell.focus()
  }

  // Delegated rather than 64 closures: clicking a cell must move the roving tabindex too.
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = squareOf(event.target)
    if (target === undefined) return
    setFocused(target)
  }

  const squareClassName = (square: Square, light: boolean) => {
    const tint =
      square === lastMove?.from
        ? ' board__square--from'
        : square === lastMove?.to
          ? ' board__square--to'
          : ''
    return `board__square board__square--${light ? 'light' : 'dark'}${tint}`
  }

  const lastRowIndex = ranks.length - 1

  return (
    <div className="board">
      {/* Decorative: every square's name and occupant is on the grid cell below. */}
      <svg className="board__canvas" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
        <defs>
          <PieceSprite spriteId={spriteId} />
        </defs>

        {cells.map((cell) => (
          <rect
            key={cell.square}
            className={squareClassName(cell.square, cell.light)}
            x={cell.x}
            y={cell.y}
            width="1"
            height="1"
          />
        ))}

        {/* Highlights differ by border or shape, never by tint alone (design-system.md §2):
            the square a ply left is dashed, the square it reached is solid. */}
        {cells
          .filter((cell) => cell.square === lastMove?.from || cell.square === lastMove?.to)
          .map((cell) => (
            <rect
              key={`move-${cell.square}`}
              className={`board__last-ply board__last-ply--${cell.square === lastMove?.from ? 'from' : 'to'}`}
              x={cell.x + HIGHLIGHT_INSET}
              y={cell.y + HIGHLIGHT_INSET}
              width={1 - HIGHLIGHT_INSET * 2}
              height={1 - HIGHLIGHT_INSET * 2}
            />
          ))}

        {/* Check is a disc behind the king — a different shape from a tinted square. */}
        {cells
          .filter((cell) => cell.square === check)
          .map((cell) => (
            <circle
              key={`check-${cell.square}`}
              className="board__check"
              cx={cell.x + SQUARE_CENTRE}
              cy={cell.y + SQUARE_CENTRE}
              r={CHECK_RADIUS}
            />
          ))}

        {cells.map((cell) => {
          const piece = position.get(cell.square)
          if (piece === undefined) return null
          return (
            <use
              key={`piece-${cell.square}`}
              className={`board__piece board__piece--${colourOf(piece)}`}
              href={`#${shapeId(spriteId, roleOf(piece))}`}
              x={cell.x}
              y={cell.y}
              width="1"
              height="1"
            />
          )
        })}

        {/* A ring, drawn above the pieces so a mark on an occupied square still reads. */}
        {cells
          .filter((cell) => markedSquares.has(cell.square))
          .map((cell) => (
            <circle
              key={`mark-${cell.square}`}
              className="board__mark"
              cx={cell.x + SQUARE_CENTRE}
              cy={cell.y + SQUARE_CENTRE}
              r={MARK_RADIUS}
            />
          ))}

        {showCoordinates &&
          cells.map((cell) => (
            <g key={`coordinate-${cell.square}`}>
              {cell.x === 0 && (
                <text
                  className="board__coordinate"
                  fontSize={COORDINATE_SIZE}
                  x={cell.x + 0.07}
                  y={cell.y + 0.27}
                >
                  {cell.rank}
                </text>
              )}
              {cell.y === lastRowIndex && (
                <text
                  className="board__coordinate board__coordinate--file"
                  fontSize={COORDINATE_SIZE}
                  x={cell.x + 0.93}
                  y={cell.y + 0.94}
                >
                  {cell.file}
                </text>
              )}
            </g>
          ))}
      </svg>

      {/* One tab stop for the whole board. Thirty-two focusable pieces across seven
          boards would be two hundred tab stops nobody wants (ADR-0003). */}
      <div
        className="board__grid"
        role="grid"
        aria-label={labels.board}
        aria-readonly="true"
        ref={gridRef}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      >
        {ranks.map((rank) => (
          <div className="board__row" role="row" key={rank}>
            {files.map((file) => {
              const square = squareAt(file, rank)
              return (
                <div
                  key={square}
                  className="board__cell"
                  role="gridcell"
                  tabIndex={square === focusedSquare ? 0 : -1}
                  data-square={square}
                  data-file={file}
                  data-rank={rank}
                  aria-label={squareLabel(square, position.get(square), labels)}
                />
              )
            })}
          </div>
        ))}
      </div>

      <p className="board__announcement" role="status" aria-live="polite">
        {announcement ?? ''}
      </p>
    </div>
  )
}
