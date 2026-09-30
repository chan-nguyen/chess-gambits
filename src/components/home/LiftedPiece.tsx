import { useId } from 'react'
import type { Ref } from 'react'
import { PieceSprite } from '../board/piece-sprite.tsx'
import { colourOf, roleOf, shapeId } from '../board/board-model.ts'
import type { PieceKey } from '../board/board-model.ts'
import { liftedTransform } from './board-drag.ts'
import type { BoardPoint } from './board-drag.ts'

type LiftedPieceProps = {
  readonly piece: PieceKey
  /** Where the drag began. After that `HomeBoard` moves the piece itself, through `ref`. */
  readonly at: BoardPoint
  readonly ref: Ref<SVGUseElement>
}

/**
 * The piece in the hand during a mouse drag (#167), drawn over the board in the board's own
 * 8×8 units and the board's own artwork and colours, so it is the same piece that left the
 * square.
 *
 * It has a sprite of its own because `Board`'s is behind an id this component cannot see,
 * and mounts only while a drag is on. Decorative, like the board's canvas: what a
 * screen-reader user needs is the grid cell's name and the live region, and neither drags.
 */
export const LiftedPiece = ({ piece, at, ref }: LiftedPieceProps) => {
  const spriteId = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg className="home-board__lifted" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <defs>
        <PieceSprite spriteId={spriteId} />
      </defs>
      <use
        ref={ref}
        className={`board__piece board__piece--${colourOf(piece)}`}
        href={`#${shapeId(spriteId, roleOf(piece))}`}
        transform={liftedTransform(at)}
        width="1"
        height="1"
      />
    </svg>
  )
}
