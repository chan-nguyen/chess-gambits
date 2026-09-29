import { useId, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import './PositionSetup.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useBoardLabels } from '../../i18n/board-labels.ts'
import { Board } from '../board/Board.tsx'
import { squareLabel } from '../board/board-model.ts'
import type { Orientation, Square } from '../board/board-model.ts'
import { squareFromTarget } from '../home/board-square.ts'
import { SetupControls } from './SetupControls.tsx'
import { SetupPalette, type SetupTool } from './SetupPalette.tsx'
import { readSetup, setupFen, startingSetup, withPiece, type Setup } from './setup-position.ts'

/**
 * The analysis page's position editor (2026-09-29): put pieces on a board, say whose move it
 * is, and hand the result to the analysis.
 *
 * **The board being set up is mirrored into the URL** (`setup`, `analysis-line.ts`), like
 * everything else on this page, so a reload keeps it and a link shares it; each edit replaces
 * the entry rather than adding one, so the back button leaves the editor instead of undoing a
 * piece at a time. The URL is read when the editor opens and written on every edit, but not
 * read back while it is open: the router commits a navigation inside a transition, so a
 * second click that lands before it has would edit the board as it stood before the first —
 * measured, placing both kings quickly left only the second one. So the working board is
 * this component's state, and nothing else on the page writes `setup` while it is mounted.
 *
 * What is in hand — the tool, and a piece picked up to move — is transient too, for the
 * reason `HomeBoard` gives about a selection.
 *
 * `Board` is reused exactly as it ships and takes no input (ADR-0003): clicks and Enter or
 * Space are read on a wrapper, as the home board reads them.
 */
export type PositionSetupProps = {
  /** The board as the URL held it when the editor opened; unreadable is the initial position. */
  readonly fen: string
  readonly flipped: boolean
  readonly orientation: Orientation
  readonly onChange: (fen: string) => void
  /** Turn the board round, given the board as it now stands: the URL may not have it yet. */
  readonly onFlip: (fen: string) => void
  readonly onAnalyse: (fen: string) => void
  readonly cancel: string
}

export const PositionSetup = ({
  fen,
  flipped,
  orientation,
  onChange,
  onFlip,
  onAnalyse,
  cancel,
}: PositionSetupProps) => {
  const headingId = useId()
  const labels = useBoardLabels()
  const [working, setWorking] = useState(() => setupFen(readSetup(fen) ?? startingSetup))
  const setup: Setup = readSetup(working) ?? startingSetup
  const [tool, setTool] = useState<SetupTool>('move')
  const [held, setHeld] = useState<Square | null>(null)
  const [announcement, setAnnouncement] = useState<string | undefined>(undefined)
  // A piece picked up is only still in hand while it is still on the board: a FEN pasted in
  // meanwhile may have put something else there, or nothing.
  const picked = tool === 'move' && held !== null && setup.placement.has(held) ? held : null

  const change = (next: string): void => {
    setWorking(next)
    onChange(next)
  }

  const edit = (next: Setup, square: Square): void => {
    setAnnouncement(squareLabel(square, next.placement.get(square), labels))
    change(setupFen(next))
  }

  const activate = (square: Square): void => {
    const here = setup.placement.get(square)
    if (tool === 'erase') {
      if (here !== undefined) edit(withPiece(setup, square, null), square)
      return
    }
    if (tool !== 'move') {
      // The same piece again takes it off, which is how every editor with a palette reads it.
      edit(withPiece(setup, square, here === tool ? null : tool), square)
      return
    }
    if (picked === null) {
      if (here !== undefined) setHeld(square)
      return
    }
    setHeld(null)
    const moving = setup.placement.get(picked)
    if (picked === square || moving === undefined) return
    edit(withPiece(withPiece(setup, picked, null), square, moving), square)
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
    <section className="position-setup" aria-labelledby={headingId}>
      <h2 className="position-setup__heading" id={headingId}>
        <Translated id="analysis.setupHeading" />
      </h2>
      <p className="position-setup__intro">
        <Translated id="analysis.setupIntro" />
      </p>
      <div className="position-setup__body">
        <div className="position-setup__stage">
          <div className="position-setup__board" onClick={handleClick} onKeyDown={handleKeyDown}>
            {/* No ply produced a position set up by hand, so none is highlighted. */}
            <Board
              key={orientation}
              fen={working}
              labels={labels}
              orientation={orientation}
              lastMove={undefined}
              marks={picked === null ? undefined : [picked]}
              announcement={announcement}
            />
          </div>
          <SetupPalette
            tool={tool}
            onChoose={(next) => {
              setTool(next)
              setHeld(null)
            }}
          />
        </div>
        <SetupControls
          setup={setup}
          flipped={flipped}
          onChange={change}
          onFlip={() => onFlip(working)}
          onAnalyse={onAnalyse}
          cancel={cancel}
        />
      </div>
    </section>
  )
}
