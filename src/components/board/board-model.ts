/**
 * The board's entire model. It knows squares, it knows how to read a FEN's placement
 * field, and it knows how arrow keys move around an 8x8 grid. It does not know chess:
 * there is no move generation, no legality, no check detection and no `chess.js`
 * (ADR-0003, and acceptance criterion 8). A position comes in as a FEN and goes out as
 * a map of occupied squares.
 */

export type PieceColour = 'white' | 'black'
export type PieceRole = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'

/** The twelve pieces, e.g. `whiteKnight`. Keys the locale map and the sprite. */
export type PieceKey = `${PieceColour}${Capitalize<PieceRole>}`

export type FileLetter = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
export type RankNumber = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'

/** An algebraic square name, e.g. `f3`. A closed union of all 64, so no assertion is needed. */
export type Square = `${FileLetter}${RankNumber}`

/** Which side sits at the bottom of the board. */
export type Orientation = 'white' | 'black'

/** Occupied squares only. An absent key is an empty square. */
export type Position = ReadonlyMap<Square, PieceKey>

export const PIECE_ROLES: readonly PieceRole[] = [
  'king',
  'queen',
  'rook',
  'bishop',
  'knight',
  'pawn',
]

const ROLES_BY_PIECE: Readonly<Record<PieceKey, PieceRole>> = {
  whiteKing: 'king',
  whiteQueen: 'queen',
  whiteRook: 'rook',
  whiteBishop: 'bishop',
  whiteKnight: 'knight',
  whitePawn: 'pawn',
  blackKing: 'king',
  blackQueen: 'queen',
  blackRook: 'rook',
  blackBishop: 'bishop',
  blackKnight: 'knight',
  blackPawn: 'pawn',
}

/** A piece's role carries its silhouette; its colour is fill and stroke (see the sprite). */
export const roleOf = (piece: PieceKey): PieceRole => ROLES_BY_PIECE[piece]

export const colourOf = (piece: PieceKey): PieceColour =>
  piece.startsWith('white') ? 'white' : 'black'

/**
 * Sprite ids are per board instance. `<use href="#id">` resolves document-wide and a
 * branch node mounts one preview per reply, so a shared id would make every board draw
 * from whichever sprite happened to be first.
 */
export const shapeId = (spriteId: string, role: PieceRole): string => `${spriteId}-${role}`

export const FILES: readonly FileLetter[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
export const RANKS: readonly RankNumber[] = ['1', '2', '3', '4', '5', '6', '7', '8']

export const squareAt = (file: FileLetter, rank: RankNumber): Square => `${file}${rank}`

const FEN_PIECE_KEYS: Readonly<Record<string, PieceKey>> = {
  K: 'whiteKing',
  Q: 'whiteQueen',
  R: 'whiteRook',
  B: 'whiteBishop',
  N: 'whiteKnight',
  P: 'whitePawn',
  k: 'blackKing',
  q: 'blackQueen',
  r: 'blackRook',
  b: 'blackBishop',
  n: 'blackKnight',
  p: 'blackPawn',
}

const EMPTY_POSITION: Position = new Map()

/**
 * Read the placement field of a FEN into the squares it occupies.
 *
 * A malformed FEN yields an empty board rather than a throw. The board is handed a
 * derived FEN by trusted code, so malformed input is a bug upstream — but a render-time
 * throw takes the whole page down, and `design-system.md` §4 asks for recovery over
 * erroring. The empty board is visible, inspectable and harmless.
 */
export const parseFen = (fen: string): Position => {
  const placement = fen.trim().split(' ')[0]
  if (placement === undefined) return EMPTY_POSITION

  const rows = placement.split('/')
  if (rows.length !== RANKS.length) return EMPTY_POSITION

  const position = new Map<Square, PieceKey>()
  for (const [rowIndex, row] of rows.entries()) {
    // A FEN's placement runs from rank 8 down to rank 1.
    const rank = RANKS[RANKS.length - 1 - rowIndex]
    if (rank === undefined) return EMPTY_POSITION

    let fileIndex = 0
    for (const character of row) {
      const skipped = Number.parseInt(character, 10)
      if (Number.isNaN(skipped)) {
        const piece = FEN_PIECE_KEYS[character]
        const file = FILES[fileIndex]
        if (piece === undefined || file === undefined) return EMPTY_POSITION
        position.set(squareAt(file, rank), piece)
        fileIndex += 1
      } else {
        fileIndex += skipped
      }
    }
    if (fileIndex !== FILES.length) return EMPTY_POSITION
  }
  return position
}

/** Files in display order: a-h with White at the bottom, reversed when Black is. */
export const orientedFiles = (orientation: Orientation): readonly FileLetter[] =>
  orientation === 'white' ? FILES : [...FILES].reverse()

/** Ranks in display order, top row first. */
export const orientedRanks = (orientation: Orientation): readonly RankNumber[] =>
  orientation === 'white' ? [...RANKS].reverse() : RANKS

/** A square is light when its file and rank indices differ in parity; a1 is dark. */
export const isLightSquare = (file: FileLetter, rank: RankNumber): boolean =>
  (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 1

const clampedAt = <T>(list: readonly T[], index: number): T | undefined =>
  list[Math.min(Math.max(index, 0), list.length - 1)]

/** The square the roving tabindex holds, kept as its parts so neither needs re-parsing. */
export type FocusedSquare = { readonly file: FileLetter; readonly rank: RankNumber }

/**
 * Where a key press moves focus, or `undefined` when the key is not ours to handle.
 *
 * Arrows are relative to what is on screen, so they still read correctly on a flipped
 * board. Home and End are absolute — acceptance criterion 2 says they jump to the a-file
 * and the h-file, not to the first and last column, and a cell announces itself
 * algebraically. Focus stops at the edges rather than wrapping.
 */
export const nextFocus = (
  key: string,
  from: FocusedSquare,
  orientation: Orientation,
): FocusedSquare | undefined => {
  const fileIndex = FILES.indexOf(from.file)
  const rankIndex = RANKS.indexOf(from.rank)
  const towardsScreenRight = orientation === 'white' ? 1 : -1

  const movedFile = (delta: number): FocusedSquare | undefined => {
    const file = clampedAt(FILES, fileIndex + delta)
    return file === undefined ? undefined : { file, rank: from.rank }
  }
  const movedRank = (delta: number): FocusedSquare | undefined => {
    const rank = clampedAt(RANKS, rankIndex + delta)
    return rank === undefined ? undefined : { file: from.file, rank }
  }

  switch (key) {
    case 'ArrowRight':
      return movedFile(towardsScreenRight)
    case 'ArrowLeft':
      return movedFile(-towardsScreenRight)
    case 'ArrowUp':
      return movedRank(towardsScreenRight)
    case 'ArrowDown':
      return movedRank(-towardsScreenRight)
    case 'Home':
      return movedFile(-FILES.length)
    case 'End':
      return movedFile(FILES.length)
    default:
      return undefined
  }
}

/** Piece names and the board's own name, in the active locale. Supplied by the caller (issue #7). */
export type BoardLabels = {
  /** Accessible name for the grid itself, e.g. `Bàn cờ`. */
  readonly board: string
  /** Spoken for a square with nothing on it, e.g. `ô trống`. */
  readonly emptySquare: string
  readonly pieces: Readonly<Record<PieceKey, string>>
}

/** `f3, mã trắng` — the square, then its occupant, both in the active locale. */
export const squareLabel = (
  square: Square,
  piece: PieceKey | undefined,
  labels: BoardLabels,
): string => `${square}, ${piece === undefined ? labels.emptySquare : labels.pieces[piece]}`
