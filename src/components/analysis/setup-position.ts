import { Chess, validateFen } from 'chess.js'
import { FILES, RANKS, colourOf, parseFen, roleOf, squareAt } from '../board/board-model.ts'
import type { PieceColour, PieceKey, Position, Square } from '../board/board-model.ts'
import { isSquare } from '../home/board-square.ts'

/**
 * A position set up by hand on the analysis page (2026-09-29, by user request: "sắp xếp vị
 * trí các quân cờ, chọn quân trắng hay quân đen đi trước, rồi phân tích").
 *
 * **Pure, and lenient until it is asked to be strict.** A position halfway through being
 * set up is routinely not a legal one — the board is cleared before the kings go back — so
 * `readSetup` accepts any FEN of the right *shape*, and `setupProblem` is the one place that
 * says whether what is on the board can be analysed. Nothing reaches the engine without
 * passing it, because the engine is a separate program that trusts its input: Stockfish's
 * network, for one, has room for 32 pieces and no more.
 *
 * `chess.js` is used for the two questions it answers properly — whether a FEN is valid,
 * and whether a king is attacked — and never to hold the position being edited, because it
 * refuses a second king and a board with none, which are ordinary states of an editor.
 */

export type CastlingRight = 'K' | 'Q' | 'k' | 'q'

/** In FEN order, which is also the order the checkboxes are drawn in. */
export const castlingRights: readonly CastlingRight[] = ['K', 'Q', 'k', 'q']

export type Setup = {
  readonly placement: Position
  readonly turn: PieceColour
  /** The rights asked for. Only those whose king and rook are at home are written out. */
  readonly castling: ReadonlySet<CastlingRight>
  readonly enPassant: Square | null
  readonly halfmove: number
  readonly fullmove: number
}

export const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export const emptyFen = '8/8/8/8/8/8/8/8 w - - 0 1'

/** The initial position as a setup: what the editor falls back to on a board it cannot read. */
export const startingSetup: Setup = {
  placement: parseFen(startingFen),
  turn: 'white',
  castling: new Set(castlingRights),
  enPassant: null,
  halfmove: 0,
  fullmove: 1,
}

/** A real game never has more, and Stockfish's network cannot take more than 32 in all. */
export const maxPiecesPerSide = 16

/** Past any FEN: the longest real one is under 90 characters. A URL is attacker-controlled. */
const maxFenLength = 100

const PIECE_CHARACTERS: Readonly<Record<PieceKey, string>> = {
  whiteKing: 'K',
  whiteQueen: 'Q',
  whiteRook: 'R',
  whiteBishop: 'B',
  whiteKnight: 'N',
  whitePawn: 'P',
  blackKing: 'k',
  blackQueen: 'q',
  blackRook: 'r',
  blackBishop: 'b',
  blackKnight: 'n',
  blackPawn: 'p',
}

/** Where a right's king and rook have to stand for it to mean anything. */
const CASTLING_HOMES: Readonly<
  Record<
    CastlingRight,
    { readonly king: Square; readonly rook: Square; readonly colour: PieceColour }
  >
> = {
  K: { king: 'e1', rook: 'h1', colour: 'white' },
  Q: { king: 'e1', rook: 'a1', colour: 'white' },
  k: { king: 'e8', rook: 'h8', colour: 'black' },
  q: { king: 'e8', rook: 'a8', colour: 'black' },
}

export const canCastle = (placement: Position, right: CastlingRight): boolean => {
  const { king, rook, colour } = CASTLING_HOMES[right]
  return placement.get(king) === `${colour}King` && placement.get(rook) === `${colour}Rook`
}

const isCastlingRight = (value: string): value is CastlingRight =>
  castlingRights.some((right) => right === value)

/** Eight ranks of eight squares, in FEN's letters. `parseFen` is lenient about the rest. */
const isPlacement = (field: string): boolean => {
  const rows = field.split('/')
  return (
    rows.length === RANKS.length &&
    rows.every(
      (row) =>
        /^[1-8pnbrqkPNBRQK]+$/.test(row) &&
        row.replace(/[1-8]/g, (digits) => '.'.repeat(Number(digits))).length === FILES.length,
    )
  )
}

const counter = /^\d{1,4}$/

/**
 * A FEN of the right shape, as a set-up position; null for anything else. The fields after
 * the placement may be left off, as an EPD or a hand-typed FEN often leaves them, and take
 * the values a fresh game has.
 */
export const readSetup = (text: string): Setup | null => {
  if (text.length > maxFenLength) return null
  const [
    placement = '',
    turn = 'w',
    castling = '-',
    enPassant = '-',
    half = '0',
    full = '1',
    ...rest
  ] = text.trim().split(/\s+/)
  if (rest.length > 0 || !isPlacement(placement)) return null
  if (turn !== 'w' && turn !== 'b') return null
  if (!/^(-|K?Q?k?q?)$/.test(castling)) return null
  if (enPassant !== '-' && !isSquare(enPassant)) return null
  if (!counter.test(half) || !counter.test(full)) return null
  return {
    placement: parseFen(placement),
    turn: turn === 'w' ? 'white' : 'black',
    castling: new Set([...castling].filter(isCastlingRight)),
    enPassant: isSquare(enPassant) ? enPassant : null,
    halfmove: Number(half),
    fullmove: Math.max(1, Number(full)),
  }
}

const placementField = (placement: Position): string =>
  [...RANKS]
    .reverse()
    .map((rank) => {
      let row = ''
      let empty = 0
      for (const file of FILES) {
        const piece = placement.get(squareAt(file, rank))
        if (piece === undefined) {
          empty += 1
          continue
        }
        row += `${empty === 0 ? '' : empty}${PIECE_CHARACTERS[piece]}`
        empty = 0
      }
      return `${row}${empty === 0 ? '' : empty}`
    })
    .join('/')

/** The setup as a FEN, with only the castling rights its pieces still allow. */
export const setupFen = (setup: Setup): string => {
  const castling = castlingRights
    .filter((right) => setup.castling.has(right) && canCastle(setup.placement, right))
    .join('')
  return [
    placementField(setup.placement),
    setup.turn === 'white' ? 'w' : 'b',
    castling === '' ? '-' : castling,
    setup.enPassant ?? '-',
    setup.halfmove,
    setup.fullmove,
  ].join(' ')
}

/**
 * A piece put on a square, or the square emptied. En passant is dropped: it named the pawn
 * that had just moved in the position this came from, and this is a different position.
 */
export const withPiece = (setup: Setup, square: Square, piece: PieceKey | null): Setup => {
  const placement = new Map(setup.placement)
  if (piece === null) placement.delete(square)
  else placement.set(square, piece)
  return { ...setup, placement, enPassant: null }
}

export const withTurn = (setup: Setup, turn: PieceColour): Setup =>
  turn === setup.turn ? setup : { ...setup, turn, enPassant: null }

export const withCastling = (setup: Setup, right: CastlingRight, allowed: boolean): Setup => {
  const castling = new Set(setup.castling)
  if (allowed) castling.add(right)
  else castling.delete(right)
  return { ...setup, castling }
}

/** Why a set-up position cannot be analysed. */
export type SetupProblem =
  'white-king' | 'black-king' | 'pawn-on-edge' | 'too-many-pieces' | 'opponent-in-check' | 'invalid'

/**
 * What stops this position being analysed, or null when nothing does. The order is the
 * order a visitor fixes things in: kings first, then what stands on the wrong rank.
 */
export const setupProblem = (setup: Setup): SetupProblem | null => {
  const pieces = [...setup.placement.entries()]
  const count = (wanted: (piece: PieceKey) => boolean): number =>
    pieces.filter(([, piece]) => wanted(piece)).length

  if (count((piece) => piece === 'whiteKing') !== 1) return 'white-king'
  if (count((piece) => piece === 'blackKing') !== 1) return 'black-king'
  const onEdge = (square: Square) => square.endsWith('1') || square.endsWith('8')
  if (pieces.some(([square, piece]) => roleOf(piece) === 'pawn' && onEdge(square)))
    return 'pawn-on-edge'
  for (const colour of ['white', 'black'] as const) {
    if (count((piece) => colourOf(piece) === colour) > maxPiecesPerSide) return 'too-many-pieces'
  }

  const fen = setupFen(setup)
  if (!validateFen(fen).ok) return 'invalid'
  // The side that is not to move cannot be in check: its opponent would take the king.
  const waiting = pieces.find(
    ([, piece]) => roleOf(piece) === 'king' && colourOf(piece) !== setup.turn,
  )?.[0]
  if (waiting === undefined) return 'invalid'
  const attacker = setup.turn === 'white' ? 'w' : 'b'
  if (new Chess(fen).isAttacked(waiting, attacker)) return 'opponent-in-check'
  return null
}

/**
 * The FEN a line on the analysis page starts from, read from a URL: a position that passes
 * `setupProblem`, as `chess.js` writes it back, or null for the ordinary start. The initial
 * position itself is null too, so there is one address for it and not two.
 */
export const readStart = (raw: string | null): string | null => {
  if (raw === null) return null
  const setup = readSetup(raw)
  if (setup === null || setupProblem(setup) !== null) return null
  const fen = new Chess(setupFen(setup)).fen()
  return fen === startingFen ? null : fen
}
