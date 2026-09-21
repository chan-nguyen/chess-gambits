import { useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import './HomeBoard.css'
import { useBoardLabels } from '../../i18n/board-labels.ts'
import type { OpeningTreeNode } from '../../lib/opening-tree.ts'
import { Board } from '../board/Board.tsx'
import type { LastMove } from '../board/Board.tsx'
import type { Square } from '../board/board-model.ts'
import { destinationsFrom, resolveActivation, selectableOrigins } from './board-interaction.ts'
import { isSquare } from './board-square.ts'

/**
 * The home page's interactive board (issue #129). Click-to-move, restricted entirely to
 * moves the opening tree actually offers — never a rules engine, never a drag, and no code
 * inside `src/components/board/` (ADR-0003; `board-tripwire.test.ts` is unmodified by this
 * feature). `Board` is reused exactly as it ships: this component only ever changes which
 * `fen`, `check`, `marks` and `lastMove` it hands to it.
 *
 * **Selection is transient interaction state** (a `useState`, not URL state): which square
 * is picked up mid-click is not something worth bookmarking. **The move actually played**
 * is the caller's business — `onCommit` reports a SAN and the caller decides what that
 * means for the URL (`OpeningExplorer` appends it to `moves`).
 *
 * Interaction, mouse and keyboard alike, is read off the DOM by delegation rather than by
 *64 handlers: `Board`'s own grid already gives every cell a `data-square` attribute and a
 * roving tabindex with full arrow-key navigation, so the only thing missing for
 * click-to-move is *activating* whatever cell the pointer or the keyboard's Enter/Space
 * lands on — which is what ADR-0003 itself names as v2's own anticipated interaction.
 */
export type HomeBoardProps = {
  readonly node: OpeningTreeNode
  readonly lastMove: LastMove | undefined
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

export const HomeBoard = ({ node, lastMove, announcement, onCommit }: HomeBoardProps) => {
  const labels = useBoardLabels()
  const [selected, setSelected] = useState<Square | null>(null)

  /*
   * A selection can never survive onto a different position: adjusted during render, the
   * same way `CatalogueList` resets its disclosure state when the filter's default flips
   * (`defaultWas`). Committing a move, undoing, and resetting all replace `node` with a
   * different object from the (immutable) opening tree, so identity is exactly the signal.
   */
  const [selectedAt, setSelectedAt] = useState(node)
  if (selectedAt !== node) {
    setSelectedAt(node)
    if (selected !== null) setSelected(null)
  }

  const origins = useMemo(() => selectableOrigins(node), [node])
  const destinations = useMemo(
    () => (selected === null ? [] : destinationsFrom(node, selected)),
    [node, selected],
  )
  const marks = selected === null ? origins : destinations

  const activate = (square: Square): void => {
    const activation = resolveActivation(node, selected, square)
    switch (activation.kind) {
      case 'select':
        setSelected(activation.square)
        return
      case 'deselect':
        setSelected(null)
        return
      case 'commit':
        setSelected(null)
        onCommit(activation.san)
        return
      case 'none':
        return
    }
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

  return (
    <div className="home-board" onClick={handleClick} onKeyDown={handleKeyDown}>
      <Board
        fen={node.fen}
        labels={labels}
        lastMove={lastMove}
        check={node.check !== null && isSquare(node.check) ? node.check : undefined}
        marks={marks}
        announcement={announcement}
      />
    </div>
  )
}
