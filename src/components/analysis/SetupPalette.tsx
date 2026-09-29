import { useId } from 'react'
// The pieces here are drawn with the board's own sprite, and so with the board's own rules.
import '../board/Board.css'
import './SetupPalette.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { useBoardLabels } from '../../i18n/board-labels.ts'
import { PieceSprite } from '../board/piece-sprite.tsx'
import { colourOf, roleOf, shapeId } from '../board/board-model.ts'
import type { PieceKey } from '../board/board-model.ts'

/**
 * What a click on the position editor's board does: pick a piece up and put it down
 * elsewhere, take one off, or put one particular piece there.
 */
export type SetupTool = 'move' | 'erase' | PieceKey

export type SetupPaletteProps = {
  readonly tool: SetupTool
  readonly onChoose: (tool: SetupTool) => void
}

const ROWS: readonly (readonly PieceKey[])[] = [
  ['whiteKing', 'whiteQueen', 'whiteRook', 'whiteBishop', 'whiteKnight', 'whitePawn'],
  ['blackKing', 'blackQueen', 'blackRook', 'blackBishop', 'blackKnight', 'blackPawn'],
]

/**
 * The editor's tools, as toggle buttons: `aria-pressed` says which is in hand. A piece is
 * drawn, and named in the visitor's language by the same labels the board's squares use; the
 * two tools that are not pieces are written out.
 */
export const SetupPalette = ({ tool, onChoose }: SetupPaletteProps) => {
  const labels = useBoardLabels()
  const translated = useTranslated()
  // Stripped to letters and digits so the id is safe in a `#fragment` reference, as `Board` does.
  const spriteId = useId().replace(/[^a-zA-Z0-9]/g, '')

  return (
    <div className="setup-palette" role="group" aria-label={translated('analysis.setupTools').text}>
      <svg className="setup-palette__sprite" aria-hidden="true" focusable="false">
        <defs>
          <PieceSprite spriteId={spriteId} />
        </defs>
      </svg>
      <div className="setup-palette__tools">
        {(['move', 'erase'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className="setup-palette__tool"
            aria-pressed={tool === candidate}
            onClick={() => onChoose(candidate)}
          >
            <Translated id={candidate === 'move' ? 'analysis.setupMove' : 'analysis.setupErase'} />
          </button>
        ))}
      </div>
      {ROWS.map((row) => (
        <div key={row[0]} className="setup-palette__pieces">
          {row.map((piece) => (
            <button
              key={piece}
              type="button"
              className="setup-palette__piece"
              aria-pressed={tool === piece}
              title={labels.pieces[piece]}
              onClick={() => onChoose(piece)}
            >
              <svg viewBox="0 0 1 1" aria-hidden="true" focusable="false">
                <use
                  className={`board__piece board__piece--${colourOf(piece)}`}
                  href={`#${shapeId(spriteId, roleOf(piece))}`}
                  width="1"
                  height="1"
                />
              </svg>
              <span className="visually-hidden">{labels.pieces[piece]}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
