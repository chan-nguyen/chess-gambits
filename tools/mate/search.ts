import { Chess } from 'chess.js'

/**
 * The bounded, three-valued mate search (ADR-0005, "Failing safe").
 *
 * It answers one question — *can the side to move force mate, and in how few moves?* — and
 * it is allowed to answer "I do not know". That third value is the whole point of this
 * module.
 *
 * The near-universal implementation error here is fail-soft: a search that runs out of
 * budget reports "no mate found", the caller reads that as "not refuted", and a mate claim
 * is generated for a position that is not mate — the exact failure ADR-0005 exists to
 * prevent, inside the mechanism meant to prevent it. So `unknown` is a first-class result
 * and it **poisons upward**: a node with an `unknown` child is `unknown` unless some other
 * child settles the question on its own.
 *
 * Soundness of the two short circuits, which is what makes poisoning safe to skip:
 *
 * - At an **attacker** node, `forced` is existential — one move that forces mate is a
 *   forced mate, whatever the unexamined siblings would have said.
 * - At a **defender** node, `escapes` is existential — one reply the attacker cannot answer
 *   means the mate is not forced, whatever the unexamined siblings would have said.
 *
 * Every other verdict is universal and therefore needs every child, so an `unknown` child
 * makes the node `unknown`.
 *
 * Build-time only. Nothing here ships to the browser, and it speaks to no engine: the
 * rules come from `chess.js` and the reasoning is this file (ADR-0005, step 4).
 */

/**
 * `mate` carries the **minimum** number of moves, which is what makes the result usable as
 * a minimality check: iterative deepening returns the first depth that succeeds, so a
 * shallower mate would have been found at a shallower depth.
 */
export type MateSearch =
  | { readonly kind: 'mate'; readonly inMoves: number }
  /** No mate within the requested bound. Says nothing about deeper mates. */
  | { readonly kind: 'no-mate' }
  /** The node cap was reached. Nothing at all is claimed (ADR-0005). */
  | { readonly kind: 'unknown' }

/**
 * A node is one move played. The cap bounds the whole search including every deepening
 * pass, so the same call on the same position always spends the same budget and the
 * hundred-node test is deterministic rather than timing-dependent.
 */
export const DEFAULT_NODE_CAP = 3_000_000

type Budget = { spent: number; readonly cap: number }

/** `false` once the cap is reached, which is how `unknown` starts propagating. */
const spend = (budget: Budget): boolean => {
  if (budget.spent >= budget.cap) return false
  budget.spent += 1
  return true
}

type Verdict = 'forced' | 'escapes' | 'unknown'

/** Can the side to move force mate in at most `moves` moves? */
const attacker = (chess: Chess, moves: number, budget: Budget): Verdict => {
  if (moves <= 0) return 'escapes'
  let seenUnknown = false

  for (const san of chess.moves()) {
    if (!spend(budget)) return 'unknown'
    chess.move(san)
    // With one move left and no mate delivered, there is nothing further to try: the
    // defender never gets to reply inside the bound. Skipping that expansion is what
    // keeps a mate-in-one proof to one ply of work rather than two.
    const verdict: Verdict = chess.isCheckmate()
      ? 'forced'
      : moves === 1
        ? 'escapes'
        : defender(chess, moves - 1, budget)
    chess.undo()

    if (verdict === 'forced') return 'forced'
    if (verdict === 'unknown') seenUnknown = true
  }

  return seenUnknown ? 'unknown' : 'escapes'
}

/** Can the defender avoid being mated within `moves` further attacker moves? */
const defender = (chess: Chess, moves: number, budget: Budget): Verdict => {
  const replies = chess.moves()
  // No legal reply and not checkmate is stalemate, so the attacker's move did not mate —
  // it ended the game as a draw. Reading an empty move list as success is the vacuous
  // hole ADR-0005 check 4 closes, and it is closed here too.
  if (replies.length === 0) return 'escapes'
  let seenUnknown = false

  for (const san of replies) {
    if (!spend(budget)) return 'unknown'
    chess.move(san)
    const verdict = attacker(chess, moves, budget)
    chess.undo()

    if (verdict === 'escapes') return 'escapes'
    if (verdict === 'unknown') seenUnknown = true
  }

  return seenUnknown ? 'unknown' : 'forced'
}

export type SearchOptions = {
  /** Deepest mate to look for, in **moves** — a mate in 2 is four plies of search. */
  readonly withinMoves: number
  readonly nodeCap?: number | undefined
}

/**
 * Search from a position given as a FEN.
 *
 * Deliberately from a FEN and not a game: a forced mate within a handful of moves cannot
 * be avoided by claiming a repetition draw, so the history is irrelevant *here*. It is not
 * irrelevant to a certificate, where a repeated position along a line would let the
 * defender claim the draw — that is ADR-0005 check 6 and it lives in `verify.ts`, which
 * replays the real game from the standard start position.
 */
export const searchMate = (fen: string, options: SearchOptions): MateSearch => {
  const budget: Budget = { spent: 0, cap: options.nodeCap ?? DEFAULT_NODE_CAP }
  const chess = new Chess(fen)

  for (let depth = 1; depth <= options.withinMoves; depth += 1) {
    const verdict = attacker(chess, depth, budget)
    if (verdict === 'forced') return { kind: 'mate', inMoves: depth }
    // A truncated pass cannot be read as "no mate at this depth", and a deeper pass costs
    // strictly more, so the whole search stops rather than reporting a depth it reached
    // only because the budget ran out under it.
    if (verdict === 'unknown') return { kind: 'unknown' }
  }

  return { kind: 'no-mate' }
}

/**
 * The single mating move an attacker plays at a node, chosen as the first in `chess.js`'s
 * move order that forces mate within `inMoves`. Used by the generator; the verifier never
 * needs it, because a committed certificate already names the move and is checked by
 * replay.
 */
export const matingMove = (
  fen: string,
  inMoves: number,
  nodeCap: number,
): { readonly san: string } | undefined => {
  const budget: Budget = { spent: 0, cap: nodeCap }
  const chess = new Chess(fen)

  for (const san of chess.moves()) {
    if (!spend(budget)) return undefined
    chess.move(san)
    const verdict: Verdict = chess.isCheckmate()
      ? 'forced'
      : inMoves === 1
        ? 'escapes'
        : defender(chess, inMoves - 1, budget)
    chess.undo()
    if (verdict === 'forced') return { san }
  }

  return undefined
}
