import { Chess } from 'chess.js'
import type { Color } from 'chess.js'
import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import './HomeBoard.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { useBoardLabels } from '../../i18n/board-labels.ts'
import { Board } from '../board/Board.tsx'
import type { LastMove } from '../board/Board.tsx'
import { parseFen } from '../board/board-model.ts'
import type { Orientation, PieceColour, PieceKey, Square } from '../board/board-model.ts'
import { resolveActivation } from './board-interaction.ts'
import {
  boardPoint,
  liftedTransform,
  squareAtPoint,
  travelled,
  withoutPiece,
} from './board-drag.ts'
import type { BoardPoint } from './board-drag.ts'
import { squareFromTarget } from './board-square.ts'
import { commitMove, isSelectable, legalDestinationsFrom, promotionRoles } from './chess-engine.ts'
import type { GameEnd, PromotionRole } from './chess-engine.ts'
import { LiftedPiece } from './LiftedPiece.tsx'

/**
 * The home page's interactive board, and the analysis page's. Any legal move can be played
 * (#131, reversing #129's catalogue-only restriction by product decision) — never a rules
 * engine inside `src/components/board/`, and `Board` reused exactly as it ships (ADR-0003,
 * amended for #131 and #167). The rules engine, `chess.js`, is read here and in
 * `chess-engine.ts`/`board-interaction.ts`, all under `src/components/home/`.
 *
 * A move is played by clicking the piece and then its destination, by Enter/Space on the
 * grid, or by dragging the piece with the mouse (#167, "tựa như trên chess.com"). The drag
 * lives here beside the click, because `Board` takes no input at all; touch keeps the tap,
 * so a finger over the board still scrolls the page.
 *
 * **Selection, a drag and a pending promotion are transient interaction state** (`useState`,
 * not URL state), the same distinction #129 already drew: which square is picked up
 * mid-click, or which piece a promotion is waiting on, is not something worth bookmarking.
 * **The move actually played** is the caller's business — `onCommit` reports a SAN and the
 * caller decides what that means for the URL (`OpeningExplorer` appends it to `moves`).
 */
export type HomeBoardProps = {
  /** The current position, as a live `chess.js` instance — read here, never mutated. */
  readonly chess: Chess
  readonly lastMove: LastMove | undefined
  readonly check: Square | undefined
  /** `null` while the game continues; otherwise how it ended. */
  readonly ended: GameEnd | null
  readonly announcement: string | undefined
  /** Which side sits at the bottom; the caller reads it from the URL. */
  readonly orientation: Orientation
  /** Arrows to draw, passed straight to `Board`: the analysis page's best move (#154). */
  readonly arrows?: readonly LastMove[] | undefined
  readonly onCommit: (san: string) => void
}

const colourOf = (turn: Color): PieceColour => (turn === 'w' ? 'white' : 'black')

const PROMOTION_PIECE_KEYS: Readonly<
  Record<PromotionRole, Readonly<Record<PieceColour, PieceKey>>>
> = {
  q: { white: 'whiteQueen', black: 'blackQueen' },
  r: { white: 'whiteRook', black: 'blackRook' },
  b: { white: 'whiteBishop', black: 'blackBishop' },
  n: { white: 'whiteKnight', black: 'blackKnight' },
}

type PendingPromotion = { readonly from: Square; readonly to: Square }

/** A mouse button held down on a piece that has not yet moved far enough to be a drag. */
type Press = { readonly from: Square; readonly clientX: number; readonly clientY: number }

/** A piece in the hand: off its square on the board, and drawn under the pointer instead. */
type Drag = { readonly from: Square; readonly piece: PieceKey; readonly at: BoardPoint }

const GAME_END_KEYS: Readonly<Record<GameEnd, TranslationKey>> = {
  checkmate: 'home.checkmate',
  stalemate: 'home.stalemate',
  draw: 'home.draw',
}

export const HomeBoard = ({
  chess,
  lastMove,
  check,
  ended,
  announcement,
  orientation,
  arrows,
  onCommit,
}: HomeBoardProps) => {
  const labels = useBoardLabels()
  const translated = useTranslated()
  const [selected, setSelected] = useState<Square | null>(null)
  const [pending, setPending] = useState<PendingPromotion | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  // The position a drop produced, shown until the caller's new position arrives. The caller
  // navigates inside a transition, and without this the dropped piece would flash back to
  // its square for the frames in between.
  const [landed, setLanded] = useState<string | null>(null)
  const press = useRef<Press | null>(null)
  // Set by a drop, so the click the browser may send after it is not read as a second one.
  const dropped = useRef(false)
  const lifted = useRef<SVGUseElement>(null)

  /*
   * Neither selection, a drag nor a pending promotion can survive onto a different position:
   * adjusted during render, the same way `CatalogueList` resets its disclosure state when
   * the filter's default flips. Committing a move, undoing, and resetting all replace
   * `chess` with a freshly-replayed instance, so identity is exactly the signal.
   */
  const [chessAt, setChessAt] = useState(chess)
  if (chessAt !== chess) {
    setChessAt(chess)
    if (selected !== null) setSelected(null)
    if (pending !== null) setPending(null)
    if (drag !== null) setDrag(null)
    if (landed !== null) setLanded(null)
  }

  // The selected square is tinted; its legal destinations get a dot, or a ring where a
  // piece would be taken (2026-09-28, by user request, "giống như chess.com") — not the
  // background tint on every destination that a follow-up to #131 asked to remove.
  const marks = selected === null ? [] : [selected]
  const targets =
    selected === null ? [] : legalDestinationsFrom(chess, selected).map(({ to }) => to)

  const liftedFen = useMemo(
    () => (drag === null ? null : withoutPiece(chess, drag.from)),
    [chess, drag],
  )

  /** Plays the move and returns the position it produced, or `null` if it did not play. */
  const attemptCommit = (from: Square, to: Square, promotion?: PromotionRole): string | null => {
    // A scratch copy: this component only ever reads `chess`, never mutates the instance
    // its caller derived and passed down.
    const scratch = new Chess(chess.fen())
    const san = commitMove(scratch, from, to, promotion)
    if (san === null) return null
    onCommit(san)
    return scratch.fen()
  }

  const activate = (square: Square): void => {
    if (ended !== null) return
    const activation = resolveActivation(chess, selected, square)
    switch (activation.kind) {
      case 'select':
        setSelected(activation.square)
        return
      case 'deselect':
        setSelected(null)
        return
      case 'commit':
        setSelected(null)
        attemptCommit(activation.from, activation.to)
        return
      case 'promote':
        setSelected(null)
        setPending({ from: activation.from, to: activation.to })
        return
      case 'none':
        return
    }
  }

  const choosePromotion = (role: PromotionRole): void => {
    if (pending === null) return
    attemptCommit(pending.from, pending.to, role)
    setPending(null)
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (dropped.current) {
      dropped.current = false
      return
    }
    const square = squareFromTarget(event.target)
    if (square !== null) activate(square)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const square = squareFromTarget(event.target)
    if (square === null) return
    // Space would otherwise scroll the page; Enter on a `div` does nothing to prevent.
    event.preventDefault()
    activate(square)
  }

  /*
   * The drag (#167). A press on a piece of the side to move becomes a drag once the mouse has
   * travelled a few pixels, so a click that wobbles is still a click and everything above
   * handles it. From then on the wrapper holds the pointer, and the square under it is read
   * from the board's box, not from the event's target (`board-drag.ts`).
   */
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    dropped.current = false
    press.current = null
    if (event.pointerType !== 'mouse' || event.button !== 0 || ended !== null) return
    const square = squareFromTarget(event.target)
    if (square === null || !isSelectable(chess, square)) return
    press.current = { from: square, clientX: event.clientX, clientY: event.clientY }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const pressed = press.current
    // A mouse passing over the board with no button down is most of what arrives here.
    if (drag === null && pressed === null) return
    const point = boardPoint(event, event.currentTarget.getBoundingClientRect())
    if (drag !== null) {
      // Set on the element rather than through state: a mouse reports a move every frame, and
      // only this one transform changes, not the sixty-four squares under it.
      lifted.current?.setAttribute('transform', liftedTransform(point))
      return
    }
    const piece = pressed === null ? undefined : parseFen(chess.fen()).get(pressed.from)
    if (pressed === null || piece === undefined || !travelled(pressed, event)) return
    press.current = null
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelected(pressed.from)
    setDrag({ from: pressed.from, piece, at: point })
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    press.current = null
    if (drag === null) return
    dropped.current = true
    setDrag(null)
    const point = boardPoint(event, event.currentTarget.getBoundingClientRect())
    const to = squareAtPoint(point, orientation)
    // Put back on its own square: still selected, as a click on it would have left it.
    if (to === drag.from) return
    setSelected(null)
    if (to === null) return
    const activation = resolveActivation(chess, drag.from, to)
    if (activation.kind === 'commit') setLanded(attemptCommit(activation.from, activation.to))
    if (activation.kind === 'promote') setPending({ from: activation.from, to: activation.to })
  }

  const handlePointerCancel = (): void => {
    press.current = null
    setDrag(null)
  }

  const promotionColour = pending === null ? null : colourOf(chess.turn())

  return (
    <div className="home-board">
      <div
        className={`home-board__surface${drag === null ? '' : ' home-board__surface--dragging'}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Keyed by orientation so a flip redraws in place: the same pieces with new
            transforms would otherwise all slide across the board at once (#72). */}
        <Board
          key={orientation}
          fen={landed ?? liftedFen ?? chess.fen()}
          labels={labels}
          orientation={orientation}
          lastMove={lastMove}
          check={check}
          marks={marks}
          targets={targets}
          arrows={arrows}
          announcement={announcement}
        />
        {drag !== null && <LiftedPiece piece={drag.piece} at={drag.at} ref={lifted} />}
      </div>

      {pending !== null && promotionColour !== null && (
        <div
          className="home-board__promotion"
          role="group"
          aria-label={translated('home.choosePromotion').text}
        >
          {promotionRoles.map((role) => (
            <button key={role} type="button" onClick={() => choosePromotion(role)}>
              {labels.pieces[PROMOTION_PIECE_KEYS[role][promotionColour]]}
            </button>
          ))}
        </div>
      )}

      {/*
       * Visible, but not its own live region: `Board`'s own `announcement` already speaks
       * this (`OpeningExplorer` appends it to the move that produced it), and a second
       * `role="status"` here would announce the same sentence twice.
       */}
      {ended !== null && (
        <p className="home-board__status">
          <Translated id={GAME_END_KEYS[ended]} />
        </p>
      )}
    </div>
  )
}
