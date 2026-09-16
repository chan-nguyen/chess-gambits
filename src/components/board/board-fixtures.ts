/**
 * Fixtures for the board's tests. Test-only: nothing in the application imports this.
 *
 * The positions are from real games and standard opening theory. Every one is checked
 * for structural sanity by `board-model.test.ts` — eight ranks of eight, exactly one
 * king a side, no more than eight pawns a side — so a typo here fails loudly rather than
 * quietly weakening the property test it feeds.
 */
import type { BoardLabels } from './board-model'

/**
 * Vietnamese, the source locale (CONTEXT.md, Annotation). Piece names are localised and
 * SAN never is, so these are what a screen reader should actually say.
 */
export const VIETNAMESE_LABELS: BoardLabels = {
  board: 'Bàn cờ',
  emptySquare: 'ô trống',
  pieces: {
    whiteKing: 'vua trắng',
    whiteQueen: 'hậu trắng',
    whiteRook: 'xe trắng',
    whiteBishop: 'tượng trắng',
    whiteKnight: 'mã trắng',
    whitePawn: 'tốt trắng',
    blackKing: 'vua đen',
    blackQueen: 'hậu đen',
    blackRook: 'xe đen',
    blackBishop: 'tượng đen',
    blackKnight: 'mã đen',
    blackPawn: 'tốt đen',
  },
}

export type FenFixture = { readonly name: string; readonly fen: string }

export const FEN_FIXTURES: readonly FenFixture[] = [
  { name: 'starting position', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { name: '1.e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
  { name: '1.e4 e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
  { name: '2.Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
  { name: '2...Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
  {
    name: 'Italian, 3.Bc4',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  },
  {
    name: 'Giuoco Piano',
    fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  },
  {
    name: 'Evans Gambit, 4.b4',
    fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq b3 0 4',
  },
  {
    name: 'Evans accepted, 4...Bxb4',
    fen: 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 0 5',
  },
  {
    name: 'Evans, 5.c3',
    fen: 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
  },
  {
    name: 'Evans, 5...Ba5',
    fen: 'r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6',
  },
  {
    name: 'Evans, 6.d4',
    fen: 'r1bqk1nr/pppp1ppp/2n5/b3p3/2BPP3/2P2N2/P4PPP/RNBQK2R b KQkq d3 0 6',
  },
  {
    name: 'Evans, 6.O-O',
    fen: 'r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQ1RK1 b kq - 1 6',
  },
  {
    name: 'Two Knights, 3...Nf6',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  },
  {
    name: 'Two Knights, 4.Ng5',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4',
  },
  {
    name: 'Two Knights, 4...d5',
    fen: 'r1bqkb1r/ppp2ppp/2n2n2/3pp1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq d6 0 5',
  },
  {
    name: 'Two Knights, 5.exd5',
    fen: 'r1bqkb1r/ppp2ppp/2n2n2/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R b KQkq - 0 5',
  },
  {
    name: 'Two Knights, 5...Nxd5',
    fen: 'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6',
  },
  {
    name: 'Fried Liver, 6.Nxf7',
    fen: 'r1bqkb1r/ppp2Npp/2n5/3np3/2B5/8/PPPP1PPP/RNBQK2R b KQkq - 0 6',
  },
  {
    name: 'Fried Liver, 6...Kxf7',
    fen: 'r1bq1b1r/ppp2kpp/2n5/3np3/2B5/8/PPPP1PPP/RNBQK2R w KQ - 0 7',
  },
  {
    name: 'Fried Liver, 7.Qf3+',
    fen: 'r1bq1b1r/ppp2kpp/2n5/3np3/2B5/5Q2/PPPP1PPP/RNB1K2R b KQ - 1 7',
  },
  {
    name: "Legal's Mate, 2...d6",
    fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
  },
  {
    name: "Legal's Mate, 3...Bg4",
    fen: 'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  },
  {
    name: "Legal's Mate, 4...g6",
    fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
  },
  {
    name: "Legal's Mate, 5...Bxd1",
    fen: 'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6',
  },
  {
    name: "Legal's Mate, 6...Ke7",
    fen: 'rn1q1bnr/ppp1kB1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R w KQ - 1 7',
  },
  {
    name: "Legal's Mate, 7.Nd5#",
    fen: 'rn1q1bnr/ppp1kB1p/3p2p1/3NN3/4P3/8/PPPP1PPP/R1BbK2R b KQ - 2 7',
  },
  { name: "Fool's Mate", fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3' },
  {
    name: "Scholar's Mate",
    fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
  },
  { name: 'Opera Game, 17.Rd8#', fen: '1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K4R b k - 1 17' },
  {
    name: 'Immortal Game, 23.Be7#',
    fen: 'r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 b - - 1 23',
  },
  { name: 'Ruy Lopez', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
  {
    name: 'Ruy Lopez, Morphy Defence',
    fen: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
  },
  {
    name: 'Sicilian Defence',
    fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
  },
  { name: 'Open Sicilian', fen: 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 5 5' },
  { name: 'Najdorf', fen: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6' },
  { name: 'Dragon', fen: 'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6' },
  { name: 'French Defence', fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { name: 'French Advance', fen: 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3' },
  { name: 'Caro-Kann', fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  {
    name: 'Caro-Kann Advance',
    fen: 'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
  },
  { name: 'Pirc Defence', fen: 'rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 3 3' },
  { name: 'Scandinavian', fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2' },
  { name: 'Alekhine Defence', fen: 'rnbqkb1r/pppppppp/5n2/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2' },
  {
    name: "Queen's Gambit Declined",
    fen: 'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
  },
  {
    name: "Queen's Gambit Accepted",
    fen: 'rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
  },
  { name: 'Slav Defence', fen: 'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3' },
  { name: "King's Indian", fen: 'rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 3 4' },
  { name: 'Nimzo-Indian', fen: 'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 4 4' },
  { name: 'Gruenfeld', fen: 'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4' },
  { name: 'English Opening', fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 1' },
  { name: 'Reti Opening', fen: 'rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq c3 0 2' },
  { name: 'Dutch Defence', fen: 'rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq f6 0 2' },
  { name: "Bird's Opening", fen: 'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq f3 0 1' },
  { name: "King's Gambit", fen: 'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2' },
  {
    name: "King's Gambit Accepted",
    fen: 'rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR w KQkq - 0 3',
  },
  {
    name: "King's Gambit, 3.Nf3",
    fen: 'rnbqkbnr/pppp1ppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R b KQkq - 1 3',
  },
  {
    name: 'Danish Gambit, 2...exd4',
    fen: 'rnbqkbnr/pppp1ppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
  },
  {
    name: 'Danish Gambit, 3.c3',
    fen: 'rnbqkbnr/pppp1ppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b KQkq - 0 3',
  },
  {
    name: 'Danish Gambit, 4.Bc4',
    fen: 'rnbqkbnr/pppp1ppp/8/8/2B1P3/2p5/PP3PPP/RNBQK1NR b KQkq - 1 4',
  },
  {
    name: 'Smith-Morra, 2...cxd4',
    fen: 'rnbqkbnr/pp1ppppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
  },
  {
    name: 'Smith-Morra, 4.Nxc3',
    fen: 'rnbqkbnr/pp1ppppp/8/8/4P3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4',
  },
  {
    name: 'Blackmar-Diemer, 3.Nc3',
    fen: 'rnbqkbnr/ppp1pppp/8/8/3Pp3/2N5/PPP2PPP/R1BQKBNR b KQkq - 1 3',
  },
  {
    name: 'Blackmar-Diemer, 4.f3',
    fen: 'rnbqkb1r/ppp1pppp/5n2/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR b KQkq - 0 4',
  },
  {
    name: 'Budapest Gambit',
    fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq e6 0 3',
  },
  { name: 'Benko Gambit', fen: 'rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq b6 0 4' },
  {
    name: 'Latvian Gambit',
    fen: 'rnbqkbnr/pppp2pp/8/4pp2/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq f6 0 3',
  },
  {
    name: 'Elephant Gambit',
    fen: 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq d6 0 3',
  },
  { name: 'Englund Gambit', fen: 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq e6 0 2' },
  { name: 'Vienna Game', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2' },
  {
    name: 'Scotch, 3...exd4',
    fen: 'r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4',
  },
  { name: 'Scotch, 4.Nxd4', fen: 'r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4' },
  {
    name: 'Petrov Defence',
    fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 3 3',
  },
  {
    name: 'Philidor Defence',
    fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
  },
  {
    name: 'Four Knights',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 5 5',
  },
  { name: 'rook and pawn endgame', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1' },
  { name: 'back-rank mate', fen: '6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1' },
  { name: 'king and queen against king', fen: '8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1' },
  { name: 'king and rook against king', fen: '8/8/8/4k3/8/8/8/R3K3 w Q - 0 1' },
  { name: 'pawn opposition', fen: '8/8/8/3k4/8/3K4/3P4/8 w - - 0 1' },
]
