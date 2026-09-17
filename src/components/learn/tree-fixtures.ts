import type { CompiledEntry } from '../../lib/content-types.ts'

/**
 * A tree with a shape, for the whole-tree view's tests. Test-only: nothing in the
 * application imports it.
 *
 * It is Légal's Mate, in the form `tools/content/fixtures/compiled/proved-mate.json`
 * publishes it — which matters, because the two plausible shapes of a mate in this project
 * are not the same thing. A proved mate is a **leaf** carrying the sequence its certificate
 * proves; the net itself lives in the certificate and never reaches the browser. Building
 * this fixture the other way, with the mating moves as nodes, would have made the tree
 * view's refutation control (AC 5) look like it worked on a shape the site never serves.
 *
 * Real SAN and real FENs, every one replayed through chess.js — including the mate, which
 * chess.js confirms is checkmate. The `learn-fixtures.ts` comment gives the reason and it
 * is the same one here: a fabricated FEN draws a position that cannot happen, and nothing
 * downstream would notice.
 *
 * The shape is chosen to be the awkward one:
 *
 * - the root branches, so the tree has no single spine;
 * - `6...Nxe5 7.Qxh5` is a run of forced plies, which is what chain collapsing is for;
 * - that run ends in a second branch point, so branches nest;
 * - and the three leaves are three different endings — a proved mate, an assessment and
 *   an unexplored branch — which is what AC 6 has to tell apart without using colour.
 */
export const BRANCHING_ENTRY: CompiledEntry = {
  id: 'legal-mate',
  name: "Légal's Mate",
  eco: 'C50',
  category: 'trap',
  side: 'white',
  definingLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6', 'Nc3', 'Bg4', 'h3', 'Bh5', 'Nxe5'],
  prelude: [
    { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
    { ply: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
    { ply: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
    { ply: 'Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
    { ply: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
    { ply: 'Bc4', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
    { ply: 'd6', fen: 'r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4' },
    { ply: 'Nc3', fen: 'r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 1 4' },
    { ply: 'Bg4', fen: 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 2 5' },
    { ply: 'h3', fen: 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5' },
    { ply: 'Bh5', fen: 'r2qkbnr/ppp2ppp/2np4/4p2b/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 1 6' },
    { ply: 'Nxe5', fen: 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6' },
  ],
  soundness: {
    value: 'dubious',
    reviewedAt: '2026-09-16',
    basis: { basis: 'judgement', by: 'fixture-author', at: '2026-09-16' },
  },
  judgement: { basis: 'judgement', by: 'fixture-author', at: '2026-09-16' },
  tier: 'taught',
  tree: {
    kind: 'opponent',
    fen: 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
    annotation: {
      vi: 'Trắng thí hậu. Ăn hậu là bị chiếu hết; ăn mã thì ván cờ vẫn bình thường.',
      en: 'White offers the queen. Taking it is mate; taking the knight keeps an ordinary game.',
      fr: 'Les Blancs offrent la dame. La prendre, c’est mat ; prendre le cavalier garde une partie normale.',
    },
    children: [
      {
        ply: 'Bxd1',
        kind: 'learner',
        replyQuality: 'blunder',
        frequency: 'rare',
        fen: 'r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N4P/PPPP1PP1/R1BbK2R w KQkq - 0 7',
        annotation: {
          vi: 'Ăn hậu. Đây là nước thua.',
          en: 'Taking the queen. This is the losing move.',
        },
        outcome: {
          kind: 'mate',
          inMoves: 2,
          sequence: ['Bxf7+', 'Ke7', 'Nd5#'],
          provedBy: 'modelled-net',
          basis: {
            basis: 'proved',
            by: 'certificate',
            certificate: 'fixture-legal-trap.Bxd1.mate.json',
          },
        },
      },
      {
        ply: 'Nxe5',
        kind: 'learner',
        replyQuality: 'best',
        frequency: 'common',
        fen: 'r2qkbnr/ppp2ppp/3p4/4n2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R w KQkq - 0 7',
        annotation: { vi: 'Ăn mã, và giữ được hậu.', en: 'Takes the knight, and keeps the queen.' },
        children: [
          {
            ply: 'Qxh5',
            kind: 'opponent',
            fen: 'r2qkbnr/ppp2ppp/3p4/4n2Q/2B1P3/2N4P/PPPP1PP1/R1B1K2R b KQkq - 0 7',
            annotation: { vi: 'Ăn lại tượng h5.', en: 'Recaptures the bishop on h5.' },
            children: [
              {
                ply: 'Nxc4',
                kind: 'learner',
                replyQuality: 'good',
                frequency: 'common',
                fen: 'r2qkbnr/ppp2ppp/3p4/7Q/2n1P3/2N4P/PPPP1PP1/R1B1K2R w KQkq - 0 8',
                annotation: {
                  vi: 'Đổi quân về thế cân bằng.',
                  en: 'Trades back into a level game.',
                },
                outcome: {
                  kind: 'position',
                  evaluation: { vi: 'Ngang quân.', en: 'Material is level.' },
                  plan: { vi: 'Nhập thành và chơi d4.', en: 'Castle and play d4.' },
                  basis: { basis: 'judgement', by: 'fixture-author', at: '2026-09-16' },
                },
              },
              {
                ply: 'Ng6',
                kind: 'learner',
                replyQuality: 'inaccuracy',
                frequency: 'occasional',
                fen: 'r2qkbnr/ppp2ppp/3p2n1/7Q/2B1P3/2N4P/PPPP1PP1/R1B1K2R w KQkq - 1 8',
                outcome: { kind: 'unexplored' },
              },
            ],
          },
        ],
      },
    ],
  },
}

/** Every node in the fixture, in the order the tree draws them. */
export const BRANCHING_ORDER: readonly string[] = [
  '',
  'Bxd1',
  'Nxe5',
  'Nxe5_Qxh5',
  'Nxe5_Qxh5_Nxc4',
  'Nxe5_Qxh5_Ng6',
]
