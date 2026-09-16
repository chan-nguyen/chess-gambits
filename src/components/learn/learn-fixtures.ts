import type { CompiledEntry } from '../../lib/content-types.ts'

/**
 * A mapped gambit tree, for the learning surface's tests. Test-only: nothing in the
 * application imports this, and `e2e/move-navigation.spec.ts` serves it in place of a
 * fetched entry so that a real browser has something with more than one ply in it.
 *
 * It is the Damiano Defence refutation — the same entry `content/` publishes today, which
 * is at the *Listed* tier and whose tree is a single root node. A one-node tree is the
 * right first entry and the wrong thing to test navigation against, so this is that entry
 * as it will look once it is mapped. Real SAN, real FENs: every one was produced by
 * replaying the line through chess.js, because a fabricated FEN would draw a position that
 * cannot happen and nothing downstream of here would notice.
 *
 * `annotation` is deliberately uneven. `3...fxe5` carries Vietnamese only, so the
 * untranslated marker has something to mark (AC 4); `3...Qe7` carries none at all, so the
 * panel's empty state is a state something reaches rather than a claim in a comment.
 */
export const MAPPED_ENTRY: CompiledEntry = {
  id: 'damiano-defence-refutation',
  name: 'Damiano Defence, 3.Nxe5 refutation',
  eco: 'C40',
  category: 'trap',
  side: 'white',
  definingLine: ['e4', 'e5', 'Nf3', 'f6', 'Nxe5'],
  soundness: {
    value: 'sound',
    reviewedAt: '2026-09-16',
    basis: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
  },
  judgement: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
  tier: 'listed',
  tree: {
    kind: 'opponent',
    fen: 'rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
    annotation: {
      vi: 'Trắng vừa thí mã. Đen phải chọn: ăn mã hay bỏ qua.',
      en: 'White has just offered the knight. Black has to choose: take it, or decline.',
      fr: 'Les Blancs viennent de sacrifier le cavalier. Les Noirs doivent choisir.',
    },
    children: [
      {
        ply: 'fxe5',
        kind: 'learner',
        replyQuality: 'blunder',
        frequency: 'common',
        fen: 'rnbqkbnr/pppp2pp/8/4p3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4',
        annotation: { vi: 'Ăn mã là nước thua. Vua đen mất hàng phòng thủ trước tốt f.' },
        children: [
          {
            ply: 'Qh5+',
            kind: 'opponent',
            fen: 'rnbqkbnr/pppp2pp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KB1R b KQkq - 1 4',
            annotation: {
              vi: 'Chiếu. Đen không thể chắn bằng g6 vì mất xe h8.',
              en: 'Check. Black cannot block with g6 without losing the rook on h8.',
              fr: 'Échec. Les Noirs ne peuvent pas parer par g6 sans perdre la tour en h8.',
            },
            children: [
              {
                ply: 'Ke7',
                kind: 'learner',
                replyQuality: 'best',
                frequency: 'common',
                fen: 'rnbq1bnr/ppppk1pp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KB1R w KQ - 2 5',
                annotation: {
                  vi: 'Vua buộc phải đi ra. Đây là lý do 2...f6 bị bác bỏ.',
                  en: 'The king is forced out. This is why 2...f6 is refuted.',
                  fr: 'Le roi est contraint de sortir. Voilà pourquoi 2...f6 est réfuté.',
                },
                children: [
                  {
                    ply: 'Qxe5+',
                    kind: 'opponent',
                    fen: 'rnbq1bnr/ppppk1pp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R b KQ - 0 5',
                    annotation: {
                      vi: 'Ăn lại tốt, vẫn chiếu, và hậu đứng ở trung tâm.',
                      en: 'Recapturing with check, and the queen sits in the centre.',
                      fr: 'Reprise avec échec, et la dame occupe le centre.',
                    },
                    children: [
                      {
                        ply: 'Kf7',
                        kind: 'learner',
                        replyQuality: 'best',
                        frequency: 'common',
                        fen: 'rnbq1bnr/pppp1kpp/8/4Q3/4P3/8/PPPP1PPP/RNB1KB1R w KQ - 1 6',
                        annotation: {
                          vi: 'Vua tiếp tục lang thang. Trắng phát triển kèm chiếu.',
                          en: 'The king keeps walking. White develops with check.',
                          fr: 'Le roi continue de marcher. Les Blancs développent avec échec.',
                        },
                        children: [
                          {
                            ply: 'Bc4+',
                            kind: 'opponent',
                            fen: 'rnbq1bnr/pppp1kpp/8/4Q3/2B1P3/8/PPPP1PPP/RNB1K2R b KQ - 2 6',
                            annotation: {
                              vi: 'Phần còn lại của biến chưa được dựng.',
                              en: 'The rest of this line is not mapped yet.',
                              fr: "La suite de cette ligne n'est pas encore cartographiée.",
                            },
                            outcome: { kind: 'unexplored' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        ply: 'Qe7',
        kind: 'learner',
        replyQuality: 'best',
        frequency: 'occasional',
        fen: 'rnb1kbnr/ppppq1pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 1 4',
        outcome: { kind: 'unexplored' },
      },
    ],
  },
}

/** The main line through the fixture, root to leaf. */
export const MAIN_LINE: readonly string[] = ['fxe5', 'Qh5+', 'Ke7', 'Qxe5+', 'Kf7', 'Bc4+']

/**
 * A trap branch ending in a proved mate, for the one claim the `line` parameter exists to
 * protect: a link to a checkmate. Its plies carry `+` and `#`, which are exactly the two
 * characters that corrupt a URL when it is not percent-encoded as a whole
 * (docs/CONTEXT.md, *Path*), so the most shareable thing this site produces is also the
 * most fragile link it produces.
 *
 * Légal's Mate, and it is a real mate: chess.js reports checkmate on the final FEN. The
 * defining line ends with White's `5.h3` — the learner's own ply — so the root is an
 * opponent node and the losing reply is modelled, which is what CONTEXT.md invariant 5
 * requires for a trap branch to be expressible at all.
 */
export const MATE_ENTRY: CompiledEntry = {
  id: 'legal-mate',
  name: "Légal's Mate",
  eco: 'C41',
  category: 'trap',
  side: 'white',
  definingLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6', 'Nc3', 'Bg4', 'h3'],
  soundness: {
    value: 'unsound',
    reviewedAt: '2026-09-16',
    basis: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
  },
  judgement: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
  tier: 'listed',
  tree: {
    kind: 'opponent',
    fen: 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P1b1/2N2N1P/PPPP1PP1/R1BQK2R b KQkq - 0 5',
    annotation: { vi: 'Đen phải trả lời h3.', en: 'Black has to answer h3.' },
    children: [
      {
        ply: 'Bh5',
        kind: 'learner',
        replyQuality: 'mistake',
        fen: 'r2qkbnr/ppp2ppp/2np4/4p2b/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 1 6',
        annotation: { vi: 'Giữ tượng, nhưng bỏ mặc e5.', en: 'Keeps the bishop, and abandons e5.' },
        children: [
          {
            ply: 'Nxe5',
            kind: 'opponent',
            fen: 'r2qkbnr/ppp2ppp/2np4/4N2b/2B1P3/2N4P/PPPP1PP1/R1BQK2R b KQkq - 0 6',
            annotation: { vi: 'Thí hậu.', en: 'The queen is offered.' },
            children: [
              {
                ply: 'Bxd1',
                kind: 'learner',
                replyQuality: 'blunder',
                fen: 'r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N4P/PPPP1PP1/R1BbK2R w KQkq - 0 7',
                annotation: {
                  vi: 'Ăn hậu, và bị chiếu hết.',
                  en: 'Takes the queen, and is mated.',
                },
                children: [
                  {
                    ply: 'Bxf7+',
                    kind: 'opponent',
                    fen: 'r2qkbnr/ppp2Bpp/2np4/4N3/4P3/2N4P/PPPP1PP1/R1BbK2R b KQkq - 0 7',
                    annotation: { vi: 'Chiếu.', en: 'Check.' },
                    children: [
                      {
                        ply: 'Ke7',
                        kind: 'learner',
                        fen: 'r2q1bnr/ppp1kBpp/2np4/4N3/4P3/2N4P/PPPP1PP1/R1BbK2R w KQ - 1 8',
                        annotation: { vi: 'Nước duy nhất.', en: 'The only move.' },
                        children: [
                          {
                            ply: 'Nd5#',
                            kind: 'opponent',
                            fen: 'r2q1bnr/ppp1kBpp/2np4/3NN3/4P3/7P/PPPP1PP1/R1BbK2R b KQ - 2 8',
                            annotation: { vi: 'Chiếu hết.', en: 'Checkmate.' },
                            outcome: {
                              kind: 'mate',
                              inMoves: 3,
                              sequence: ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'],
                              provedBy: 'modelled-net',
                              // #5 made every mate outcome carry where its proof came from.
                              // A fixture is not exempt: the point of the field is that no mate
                              // can be stated without naming the certificate behind it.
                              basis: {
                                basis: 'proved',
                                by: 'certificate',
                                certificate: 'fixture-legal-trap.Bxd1.mate.json',
                              },
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
}

/** The trap branch, root to the mate. Every `+` and the `#` are load-bearing. */
export const MATE_LINE: readonly string[] = ['Bh5', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#']
