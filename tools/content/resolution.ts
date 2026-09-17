import { Chess } from 'chess.js'

/**
 * Where a line is allowed to stop, in the one part of that question a machine can settle
 * (docs/CONTEXT.md, **Where a line may stop**).
 *
 * The rule is mostly a reviewer's rule: an `Assessment` leaf has to name a feature that is
 * on the board. No check can read a sentence and decide whether "White has the initiative"
 * describes anything. What a check *can* do is settle the precondition that sentence
 * depends on — **that the board has finished moving** — and that is all this module does.
 *
 * Three conditions, all read off the derived position and none of them an evaluation:
 *
 * - **The side to move is in check.** A line that stops here has stopped mid-sequence; the
 *   reply is nearly forced and the position a learner is asked to make a plan for is not
 *   the position that will be on the board one ply later.
 * - **The side to move has mate in one.** The starkest case of the board not having
 *   finished moving, and the one that slips between the other two.
 * - **A capture is going free.** A capture whose destination square the opponent cannot
 *   recapture on changes the material count by force, so the count the leaf states is not
 *   the count the position has.
 *
 * **No piece values, deliberately.** "Free" here means *nobody can take back*, which is a
 * property of the legal move list and nothing else. A static exchange evaluation would be a
 * second, weaker chess engine living beside `chess.js` — the arrangement this project
 * refuses everywhere else — and it would trade a class of false positives a reviewer can
 * see for a class of false negatives nobody can.
 *
 * The honest consequences of that choice, both stated rather than hidden:
 *
 * - It **misses** the leaf where a queen may capture a defended pawn and lose the queen for
 *   it. Material is in flight there too, and this says nothing about it.
 * - It **fires** on a capture no sane player makes — a rook taking a poisoned knight that
 *   is defended by a piece pinned against its own king, say, where `chess.js` reports no
 *   legal recapture because there genuinely is none. That is the shape `unsettled` is for.
 *
 * Build-time only. Nothing here reaches the browser.
 */

/**
 * **Every mate the side to move can deliver in one, in canonical SAN.**
 *
 * This exists because the other two conditions have a gap between them, and the gap is the
 * worst position in the file to be wrong about. `1.f3 e5 2.g4` leaves Black to move with
 * `Qh4#` on the board: nobody is in check, the game is not over, and there is not a single
 * capture available — so a leaf here passed every chess check ADR-0004 lists and published
 * a lesson calling it a comfortable middlegame one ply before White is mated.
 *
 * Unconditional, like a check and unlike a free capture: `unsettled` cannot excuse it. A
 * reason for stopping a move before the game ends is not a reason, it is the missing move.
 *
 * Not a mate *search* and not a relaxation of ADR-0005 — depth one, over the legal move
 * list, claiming nothing about the position beyond what the next ply does to it. A proved
 * mate is still a certificate.
 */
export const matesInOne = (fen: string): readonly string[] => {
  const chess = new Chess(fen)
  return chess
    .moves({ verbose: true })
    .filter((move) => {
      chess.move(move)
      const mate = chess.isCheckmate()
      chess.undo()
      return mate
    })
    .map((move) => move.san)
}

/**
 * Every capture the side to move can play whose destination square the opponent has no
 * legal recapture on, in canonical SAN.
 *
 * A capture that gives checkmate counts as free, and that is right: nobody can take back.
 * It is `matesInOne` above, not this, that makes a leaf one ply from mate impossible — the
 * mate may not be a capture at all, and the fixture that proves it is not.
 */
export const freeCaptures = (fen: string): readonly string[] => {
  const chess = new Chess(fen)
  return chess
    .moves({ verbose: true })
    .filter((move) => {
      if (move.captured === undefined) return false
      chess.move(move)
      const recapture = chess.moves({ verbose: true }).some((reply) => reply.to === move.to)
      chess.undo()
      return !recapture
    })
    .map((move) => move.san)
}
