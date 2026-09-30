import { Chess } from 'chess.js'
import { orientedFiles, orientedRanks, squareAt } from '../board/board-model.ts'
import type { Orientation, Square } from '../board/board-model.ts'

/**
 * The geometry of dragging a piece with the mouse (#167), as pure functions a test can call
 * without a browser — the same reason `board-interaction.ts` keeps what a click does out of
 * the component.
 *
 * A drag has to answer "which square is the pointer over" while it is captured by the
 * wrapper, so the grid cell under it is no longer the event's target and `squareFromTarget`
 * cannot say. It is answered from the board's own box instead, in the 8×8 user units
 * `Board`'s SVG already draws in, which is also where the lifted piece is drawn.
 */

/** How far the mouse travels, in CSS pixels, before a press on a piece becomes a drag. */
export const DRAG_THRESHOLD = 4

/** A point in board units from the top-left corner: 0–8 across the board, outside it off it. */
export type BoardPoint = { readonly x: number; readonly y: number }

type ClientPoint = { readonly clientX: number; readonly clientY: number }
type Box = { readonly left: number; readonly top: number; readonly width: number }

/** Where a pointer is, in board units, given the board's box on screen. The board is square. */
export const boardPoint = (pointer: ClientPoint, box: Box): BoardPoint => ({
  x: ((pointer.clientX - box.left) / box.width) * 8,
  y: ((pointer.clientY - box.top) / box.width) * 8,
})

/** The square under a point, the way up the board is drawn; `null` off the board. */
export const squareAtPoint = (point: BoardPoint, orientation: Orientation): Square | null => {
  const file = orientedFiles(orientation)[Math.floor(point.x)]
  const rank = orientedRanks(orientation)[Math.floor(point.y)]
  return file === undefined || rank === undefined ? null : squareAt(file, rank)
}

/** Where the lifted piece is drawn: centred on the pointer, as chess.com holds it. */
export const liftedTransform = (point: BoardPoint): string =>
  `translate(${(point.x - 0.5).toFixed(3)} ${(point.y - 0.5).toFixed(3)})`

/** Whether a press has travelled far enough to be a drag rather than the start of a click. */
export const travelled = (from: ClientPoint, to: ClientPoint): boolean =>
  Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY) >= DRAG_THRESHOLD

/**
 * The position with the lifted piece taken off its square, which is what the board shows
 * while the piece is in the hand. Only the placement is read by `Board`, so nothing else in
 * the FEN matters here.
 */
export const withoutPiece = (chess: Chess, square: Square): string => {
  const scratch = new Chess(chess.fen())
  scratch.remove(square)
  return scratch.fen()
}
