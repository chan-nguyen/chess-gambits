import { Chess } from 'chess.js'
import type { Color } from 'chess.js'
import { useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import './HomeBoard.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { useBoardLabels } from '../../i18n/board-labels.ts'
import { Board } from '../board/Board.tsx'
import type { LastMove } from '../board/Board.tsx'
import type { PieceColour, PieceKey, Square } from '../board/board-model.ts'
import { resolveActivation } from './board-interaction.ts'
import { isSquare } from './board-square.ts'
import { commitMove, promotionRoles } from './chess-engine.ts'
import type { GameEnd, PromotionRole } from './chess-engine.ts'

/**
 * The home page's interactive board. Any legal move can be played (#131, reversing #129's
 * catalogue-only restriction by product decision) — never a rules engine inside
 * `src/components/board/`, never a drag, and `Board` reused exactly as it ships (ADR-0003,
 * amended for #131). The rules engine, `chess.js`, is read here and in
 * `chess-engine.ts`/`board-interaction.ts`, all under `src/components/home/`.
 *
 * **Selection and a pending promotion are transient interaction state** (`useState`, not
 * URL state), the same distinction #129 already drew: which square is picked up mid-click,
 * or which piece a promotion is waiting on, is not something worth bookmarking. **The move
 * actually played** is the caller's business — `onCommit` reports a SAN and the caller
 * decides what that means for the URL (`OpeningExplorer` appends it to `moves`).
 */
export type HomeBoardProps = {
  /** The current position, as a live `chess.js` instance — read here, never mutated. */
  readonly chess: Chess
  readonly lastMove: LastMove | undefined
  readonly check: Square | undefined
  /** `null` while the game continues; otherwise how it ended. */
  readonly ended: GameEnd | null
  readonly announcement: string | undefined
  readonly onCommit: (san: string) => void
}

const squareFromTarget = (target: EventTarget | null): Square | null => {
  if (!(target instanceof Element)) return null
  const cell = target.closest('[data-square]')
  if (!(cell instanceof HTMLElement)) return null
  const value = cell.dataset['square']
  return value !== undefined && isSquare(value) ? value : null
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
  onCommit,
}: HomeBoardProps) => {
  const labels = useBoardLabels()
  const translated = useTranslated()
  const [selected, setSelected] = useState<Square | null>(null)
  const [pending, setPending] = useState<PendingPromotion | null>(null)

  /*
   * Neither selection nor a pending promotion can survive onto a different position:
   * adjusted during render, the same way `CatalogueList` resets its disclosure state when
   * the filter's default flips. Committing a move, undoing, and resetting all replace
   * `chess` with a freshly-replayed instance, so identity is exactly the signal.
   */
  const [chessAt, setChessAt] = useState(chess)
  if (chessAt !== chess) {
    setChessAt(chess)
    if (selected !== null) setSelected(null)
    if (pending !== null) setPending(null)
  }

  // Only the selected square itself, by user request — not its legal destinations too.
  // `resolveActivation` still finds those internally to resolve the *next* click; nothing
  // here needs to know them just to draw a mark.
  const marks = selected === null ? [] : [selected]

  const attemptCommit = (from: Square, to: Square, promotion?: PromotionRole): void => {
    // A scratch copy: this component only ever reads `chess`, never mutates the instance
    // its caller derived and passed down.
    const scratch = new Chess(chess.fen())
    const san = commitMove(scratch, from, to, promotion)
    if (san !== null) onCommit(san)
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

  const promotionColour = pending === null ? null : colourOf(chess.turn())

  return (
    <div className="home-board">
      <div onClick={handleClick} onKeyDown={handleKeyDown}>
        <Board
          fen={chess.fen()}
          labels={labels}
          lastMove={lastMove}
          check={check}
          marks={marks}
          announcement={announcement}
        />
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
