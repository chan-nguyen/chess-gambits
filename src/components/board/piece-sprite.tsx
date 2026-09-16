import { PIECE_ROLES, shapeId } from './board-model'
import type { PieceRole } from './board-model'

/**
 * The twelve pieces as one inline sprite.
 *
 * Inlined, never fetched: a network request for a piece would breach requirement N8
 * (zero third-party requests) outright, and there is no URL here to fetch from.
 *
 * Six `<symbol>` shapes rather than twelve. A piece's *role* is carried by its
 * silhouette and its *colour* by fill and stroke, which `<use>` inherits into the
 * referenced shape — so `whiteKnight` and `blackKnight` share one outline and differ by
 * a light body with a dark outline against a dark body with a light one. That inverts
 * cleanly in greyscale, which is what acceptance criterion 7 asks for, and it halves the
 * sprite.
 *
 * Shapes are drawn in a 45x45 box, the conventional chess-piece grid, and `<symbol>`
 * scales each one into a single board square.
 *
 * Origin and licence: original work for this repository, MIT. See `NOTICE`.
 */
const SHAPES: Readonly<Record<PieceRole, string>> = {
  pawn:
    'M22.5 8c3.6 0 6.5 2.9 6.5 6.5 0 2.2-1 4.1-2.7 5.3 2.9 1.8 4.9 5 5.7 8.7H34v4H11' +
    'v-4h2c.8-3.7 2.8-6.9 5.7-8.7A6.5 6.5 0 0 1 16 14.5C16 10.9 18.9 8 22.5 8Z',
  rook: 'M11 9h5v4h5V9h5v4h5V9h5v10l-4 3v8l4 4v3H11v-3l4-4v-8l-4-3z',
  knight: 'M29 6 32 12c6 6 4 15 2 21H12c0-5 2-8 6-10-5 0-9-1-10-4l5-3 2-5z' + 'M10 33h25v5H10z',
  bishop:
    'M22.5 5.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM22.5 11.5c6 0 10.8 7.2 10.8 13' +
    ' 0 4.2-4.3 7-10.8 7s-10.8-2.8-10.8-7c0-5.8 4.8-13 10.8-13zM11 33h23v5H11z' +
    'M21 15.5 25.5 22',
  queen:
    'M11 32 8 14l4.4 7.4L16 8l4 11.6L22.5 10 25 19.6 29 8l3.6 13.4L37 14l-3 18zM10 33h25v5H10z',
  king:
    'M20.6 5.5h3.8v4.2h4.2v3.8h-4.2v3.3h-3.8v-3.3h-4.2V9.7h4.2zM22.5 17.5c7.1 0 11.6 5 11.6 10' +
    'l-1 4.5H11.9l-1-4.5c0-5 4.5-10 11.6-10zM10 32h25v5H10z',
}

export const PieceSprite = ({ spriteId }: { readonly spriteId: string }) => (
  <>
    {PIECE_ROLES.map((role: PieceRole) => (
      <symbol key={role} id={shapeId(spriteId, role)} viewBox="0 0 45 45">
        <path d={SHAPES[role]} />
      </symbol>
    ))}
  </>
)
