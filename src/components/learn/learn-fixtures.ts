import type { CompiledEntry, CompiledNode, ReplyQuality } from '../../lib/content-types.ts'

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

/**
 * The Evans Gambit at its first branch point — the fixture #9 is written against, and the
 * one entry that carries every shape of answer at once.
 *
 * The defining line ends with White's `5.c3`, the learner's own ply, so the root is an
 * opponent node (docs/CONTEXT.md, invariant 5) and Black's fifth move is a modelled reply
 * carrying a quality. Thirty-three replies are legal there; four are modelled, one is
 * individually dismissed, and `dismissRest` answers the remaining twenty-eight. The count
 * is not decoration — it is the arithmetic that makes the catch-all defensible, and the
 * learner is shown it (acceptance criterion 4).
 *
 * `5...Ba5` is the acceptance criterion 7 fixture: after it White is to move, so the node
 * is a **learner** node, and `6.d4` and `6.O-O` are both main lines. That is a genuine
 * choice of plans rather than a reply to be ready for, and it renders as one.
 *
 * Every FEN here was produced by replaying the line through chess.js. A fabricated FEN
 * would draw a position that cannot happen, and nothing downstream of this file would
 * notice.
 */
export const EVANS_ENTRY: CompiledEntry = {
  id: 'evans-gambit',
  name: 'Evans Gambit, 5.c3',
  eco: 'C51',
  category: 'gambit',
  side: 'white',
  definingLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3'],
  soundness: {
    value: 'dubious',
    reviewedAt: '2026-09-16',
    basis: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
  },
  judgement: {
    basis: 'judgement',
    by: 'chan',
    at: '2026-09-16',
    source: 'No engine and no opening explorer: these are one player’s impressions.',
  },
  tier: 'listed',
  tree: {
    kind: 'opponent',
    fen: 'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5',
    annotation: {
      vi: 'Trắng đòi lại nhịp. Tượng đen phải rút về đâu đó, và mỗi chỗ là một biến khác.',
      en: 'White claims the tempo back. The bishop has to go somewhere, and each square is a different game.',
      fr: 'Les Blancs reprennent le tempo. Le fou doit partir, et chaque case est une autre partie.',
    },
    dismissed: [
      {
        ply: 'Bxc3',
        reason:
          'Tự nguyện trả tượng lấy tốt c3 rồi Nxc3 — Trắng phát triển miễn phí. Chưa dựng vì không ai chơi hai lần.',
      },
    ],
    dismissRest: {
      reason: {
        vi: 'Không giữ được tốt và cũng không thách thức gambit; Trắng tiếp tục d4 theo kế hoạch.',
        en: 'Neither keeps the pawn nor challenges the gambit; White continues with d4 as planned.',
        fr: 'Ne garde pas le pion et ne conteste pas le gambit ; les Blancs poursuivent par d4.',
      },
      covers: [
        'Rb8',
        'Qe7',
        'Qf6',
        'Qg5',
        'Qh4',
        'Kf8',
        'Ke7',
        'Nh6',
        'Nf6',
        'Nge7',
        'a6',
        'a5',
        'b6',
        'b5',
        'd6',
        'd5',
        'f6',
        'f5',
        'g6',
        'g5',
        'h6',
        'h5',
        'Nb8',
        'Nce7',
        'Nd4',
        'Na5',
        'Bf8',
        'Ba3',
      ],
    },
    children: [
      {
        ply: 'Ba5',
        kind: 'learner',
        replyQuality: 'best',
        frequency: 'common',
        fen: 'r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6',
        annotation: {
          vi: 'Giữ tượng trên đường chéo và ghim tốt c3. Đây là biến chính.',
          en: 'Keeps the bishop on the diagonal and pins the c3 pawn. This is the main line.',
          fr: 'Garde le fou sur la diagonale et cloue le pion c3. C’est la ligne principale.',
        },
        /*
         * Acceptance criterion 7, and the reason it has a fixture rather than an assertion:
         * a learner node with two children is a *deliberate* act and the schema allows it,
         * so the UI has to have met one.
         */
        children: [
          {
            ply: 'd4',
            kind: 'opponent',
            fen: 'r1bqk1nr/pppp1ppp/2n5/b3p3/2BPP3/2P2N2/P4PPP/RNBQK2R b KQkq - 0 6',
            annotation: {
              vi: 'Mở trung tâm ngay. Đây là cách chơi cổ điển của gambit.',
              en: 'Opening the centre at once. This is the classical way to play the gambit.',
              fr: 'Ouvrir le centre tout de suite. C’est la manière classique de jouer le gambit.',
            },
            outcome: { kind: 'unexplored' },
          },
          {
            ply: 'O-O',
            kind: 'opponent',
            fen: 'r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQ1RK1 b kq - 2 6',
            annotation: {
              vi: 'Nhập thành trước, để dành d4. Cũng là biến chính, chỉ khác thứ tự.',
              en: 'Castling first and saving d4. Also a main line, and only the order differs.',
              fr: 'Roquer d’abord et garder d4. Ligne principale également, seul l’ordre change.',
            },
            outcome: { kind: 'unexplored' },
          },
        ],
      },
      {
        ply: 'Bc5',
        kind: 'learner',
        replyQuality: 'good',
        frequency: 'occasional',
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6',
        annotation: { vi: 'Rút về ô cũ. Trắng chơi d4 với nhịp.' },
        outcome: { kind: 'unexplored' },
      },
      {
        ply: 'Be7',
        kind: 'learner',
        replyQuality: 'inaccuracy',
        frequency: 'occasional',
        fen: 'r1bqk1nr/ppppbppp/2n5/4p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6',
        annotation: { vi: 'An toàn nhưng thụ động: tượng không còn nhìn vào trung tâm.' },
        outcome: { kind: 'unexplored' },
      },
      {
        ply: 'Bd6',
        kind: 'learner',
        replyQuality: 'mistake',
        fen: 'r1bqk1nr/pppp1ppp/2nb4/4p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6',
        annotation: { vi: 'Chặn chính tốt d của mình. Đây là nước đã có tên trong sách.' },
        outcome: { kind: 'unexplored' },
      },
    ],
  },
}

/** The learner node where the gambit offers a choice of plans (acceptance criterion 7). */
export const PLAN_LINE: readonly string[] = ['Ba5']

/**
 * More replies than there are digits, which is the only way to check the second half of
 * acceptance criterion 6: **a numeric shortcut is never the only route to a branch.**
 *
 * The position is the Evans one ply earlier, after `4.b4` — the case ADR-0003 names, where
 * 35 replies are legal. Twelve are modelled here, so three of them have no key and have to
 * be reachable by tab and by click, and twelve preview boards have to fit on a 360px phone
 * without a sideways scroll.
 */
/**
 * One modelled reply in `WIDE_ENTRY`. Twelve near-identical literals would bury the one
 * thing that differs between them, which is the quality — and the qualities are what the
 * greyscale and shortcut checks read.
 */
const wideReply = (ply: string, replyQuality: ReplyQuality, fen: string): CompiledNode => ({
  ply,
  kind: 'learner',
  replyQuality,
  frequency: 'rare',
  fen,
  outcome: { kind: 'unexplored' },
})

export const WIDE_ENTRY: CompiledEntry = {
  id: 'evans-gambit-wide',
  name: 'Evans Gambit, 4.b4 — twelve modelled replies',
  eco: 'C51',
  category: 'gambit',
  side: 'white',
  definingLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'],
  soundness: {
    value: 'dubious',
    reviewedAt: '2026-09-16',
    basis: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
  },
  judgement: { basis: 'judgement', by: 'chan', at: '2026-09-16' },
  tier: 'listed',
  tree: {
    kind: 'opponent',
    fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4',
    annotation: { vi: 'Trắng thí tốt b. Đen có ba mươi lăm nước hợp lệ ở đây.' },
    children: [
      wideReply(
        'Bxb4',
        'best',
        'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 0 5',
      ),
      wideReply(
        'Bb6',
        'good',
        'r1bqk1nr/pppp1ppp/1bn5/4p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 1 5',
      ),
      wideReply(
        'Be7',
        'good',
        'r1bqk1nr/ppppbppp/2n5/4p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 1 5',
      ),
      wideReply(
        'Bd6',
        'inaccuracy',
        'r1bqk1nr/pppp1ppp/2nb4/4p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 1 5',
      ),
      wideReply(
        'Bf8',
        'inaccuracy',
        'r1bqkbnr/pppp1ppp/2n5/4p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 1 5',
      ),
      wideReply(
        'Nxb4',
        'inaccuracy',
        'r1bqk1nr/pppp1ppp/8/2b1p3/1nB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 0 5',
      ),
      wideReply(
        'Nf6',
        'good',
        'r1bqk2r/pppp1ppp/2n2n2/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 1 5',
      ),
      wideReply(
        'd6',
        'good',
        'r1bqk1nr/ppp2ppp/2np4/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 0 5',
      ),
      wideReply(
        'd5',
        'inaccuracy',
        'r1bqk1nr/ppp2ppp/2n5/2bpp3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 0 5',
      ),
      wideReply(
        'Bd4',
        'mistake',
        'r1bqk1nr/pppp1ppp/2n5/4p3/1PBbP3/5N2/P1PP1PPP/RNBQK2R w KQkq - 1 5',
      ),
      wideReply(
        'Be3',
        'blunder',
        'r1bqk1nr/pppp1ppp/2n5/4p3/1PB1P3/4bN2/P1PP1PPP/RNBQK2R w KQkq - 1 5',
      ),
      wideReply(
        'Bxf2+',
        'blunder',
        'r1bqk1nr/pppp1ppp/2n5/4p3/1PB1P3/5N2/P1PP1bPP/RNBQK2R w KQkq - 0 5',
      ),
    ],
  },
}

/**
 * One entry carrying **all three** outcome shapes, for #11.
 *
 * Légal's Mate again, but modelled the way the content pipeline actually produces a mate
 * rather than the way `MATE_ENTRY` above does. That difference is the reason this fixture
 * exists and is worth stating: `tools/content/validate.ts` attaches the outcome to the leaf
 * that *claims* the trap and fills `sequence` with the net's longest line **from** that
 * leaf, so the plies in it have not been played yet. `MATE_ENTRY` instead hangs the outcome
 * on the final `Nd5#` node with the moves that led to it, which is a shape the compiler
 * never emits. Both are legal `CompiledEntry` values; only this one is what arrives over the
 * wire, and it is what the outcome components are measured against.
 *
 * So the mate leaf here is `6...Bxd1` — White to move, mate in **2**, and the proved line is
 * `7.Bxf7+ 7...Ke7 8.Nd5#`. Checked with chess.js 1.4.0: the final position reports
 * `isCheckmate()`, and `7.Bxf7+` has exactly one legal reply, so the net has one defender
 * node and `provedBy` is `modelled-net` rather than `search`.
 *
 * The three replies to `5.h3` are each a different ending, which is what makes this one
 * fixture enough for every outcome test and for the greyscale review:
 *
 * - `5...Bh5` — a mistake, and the trap: it runs into the proved mate.
 * - `5...Bxf3` — good, and an ordinary gambit ending: an `Assessment`, with material, the
 *   imbalance, and a concrete plan with a pawn break in it.
 * - `5...Be6` — an inaccuracy nobody has mapped: `Unexplored`.
 *
 * Invariant 5 holds: the mate is reached through `5...Bh5` (mistake) and `6...Bxd1`
 * (blunder), so a `best` reply never leads to one.
 */
export const OUTCOMES_ENTRY: CompiledEntry = {
  id: 'legal-mate-outcomes',
  name: "Légal's Mate, 5.h3",
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
    annotation: {
      vi: 'Tượng bị hỏi. Đen phải chọn: giữ tượng, đổi lấy mã, hay rút về.',
      en: 'The bishop is questioned. Black chooses: keep it, trade it for the knight, or retreat.',
      fr: 'Le fou est mis en question. Les Noirs choisissent : le garder, l’échanger, ou reculer.',
    },
    children: [
      {
        ply: 'Bh5',
        kind: 'learner',
        replyQuality: 'mistake',
        frequency: 'common',
        fen: 'r2qkbnr/ppp2ppp/2np4/4p2b/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 1 6',
        annotation: {
          vi: 'Giữ tượng trên đường chéo, và bỏ mặc ô e5.',
          en: 'Keeps the bishop on the diagonal, and abandons e5.',
        },
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
                frequency: 'common',
                fen: 'r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N4P/PPPP1PP1/R1BbK2R w KQkq - 0 7',
                annotation: {
                  vi: 'Ăn hậu — và đây là lý do biến này có tên.',
                  en: 'Takes the queen — and this is why the line has a name.',
                },
                outcome: {
                  kind: 'mate',
                  inMoves: 2,
                  sequence: ['Bxf7+', 'Ke7', 'Nd5#'],
                  provedBy: 'modelled-net',
                  basis: {
                    basis: 'proved',
                    by: 'certificate',
                    certificate: 'legal-mate-outcomes.Bh5_Nxe5_Bxd1.mate.json',
                  },
                },
              },
            ],
          },
        ],
      },
      {
        ply: 'Bxf3',
        kind: 'learner',
        replyQuality: 'good',
        frequency: 'common',
        fen: 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P3/2N2b1P/PPPP1PP1/R1BQK2R w KQkq - 0 6',
        annotation: {
          vi: 'Đổi tượng lấy mã trước khi bị hỏi thêm lần nữa.',
          en: 'Trading the bishop for the knight before it is questioned again.',
        },
        children: [
          {
            ply: 'Qxf3',
            kind: 'opponent',
            fen: 'r2qkbnr/ppp2ppp/2np4/4p3/2B1P3/2N2Q1P/PPPP1PP1/R1B1K2R b KQkq - 0 6',
            annotation: {
              vi: 'Ăn lại bằng hậu. Không còn đòn thí nào ở đây.',
              en: 'Recapturing with the queen. There is no sacrifice here any more.',
            },
            outcome: {
              kind: 'position',
              evaluation: {
                vi: 'Quân số bằng nhau. Trắng có cặp tượng, Đen không; đổi lại Đen đã bỏ được thế ghim và cấu trúc tốt vẫn lành lặn.',
                en: 'Material is level. White has the two bishops and Black does not; in exchange Black is out of the pin and the pawn structure is sound on both sides.',
                fr: 'Matériel égal. Les Blancs ont la paire de fous, pas les Noirs ; en échange les Noirs sont sortis du clouage et la structure de pions reste saine.',
              },
              plan: {
                vi: 'Trắng nhập thành ngắn, chơi d3 rồi Nd5 hoặc Ne2–g3, và chuẩn bị f2–f4 để mở đường cho cặp tượng. Đen giữ chắc e5 bằng Nf6 và Be7, và nhắm phản công bằng d6–d5 khi cột f đã mở.',
                en: 'White castles short, plays d3 and Nd5 or Ne2–g3, and prepares the f2–f4 break to open lines for the bishop pair. Black holds e5 with Nf6 and Be7 and aims at d6–d5 once the f-file is open.',
                fr: 'Les Blancs roquent court, jouent d3 puis Nd5 ou Ne2–g3, et préparent la poussée f2–f4 pour ouvrir des lignes à la paire de fous. Les Noirs tiennent e5 par Nf6 et Be7 et visent d6–d5 dès que la colonne f est ouverte.',
              },
              basis: {
                basis: 'judgement',
                by: 'chan',
                at: '2026-09-16',
                source: 'No engine and no opening explorer: this is one player’s reading.',
              },
            },
          },
        ],
      },
      {
        ply: 'Be6',
        kind: 'learner',
        replyQuality: 'inaccuracy',
        frequency: 'occasional',
        fen: 'r2qkbnr/ppp2ppp/2npb3/4p3/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 1 6',
        annotation: {
          vi: 'Rút về và mời đổi tượng. Nhánh này chưa được dựng.',
          en: 'Retreating and offering the trade. This branch is not mapped yet.',
        },
        outcome: { kind: 'unexplored' },
      },
    ],
  },
}

/** The trap branch of `OUTCOMES_ENTRY`, root to the proved mate leaf. */
export const OUTCOME_MATE_LINE: readonly string[] = ['Bh5', 'Nxe5', 'Bxd1']
/** The ordinary branch: a gambit line that ends in an assessment, not in a mate. */
export const OUTCOME_ASSESSMENT_LINE: readonly string[] = ['Bxf3', 'Qxf3']
/** The branch nobody has mapped. */
export const OUTCOME_UNEXPLORED_LINE: readonly string[] = ['Be6']
