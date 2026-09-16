import { Chess } from 'chess.js'
import type { Certificate, MateNet } from './certificate.ts'
import { certificateFileName, countNet, parseCertificate } from './certificate.ts'
import { DEFAULT_NODE_CAP, searchMate } from './search.ts'

/**
 * The verifier (ADR-0005, step 4). **This module is the product's only guarantee.**
 *
 * It re-derives everything from the moves and trusts nothing: not the engine that found the
 * mate, not the generator that expanded the net, not the number written in the certificate.
 * It speaks to no engine — the rules come from `chess.js` and the reasoning is here — so it
 * runs in CI on every pull request in milliseconds, while the oracle that produced its input
 * runs on a schedule and is never installed on a merge path.
 *
 * The six required checks, and where each one is:
 *
 * 1. Every attacker move is legal in its position — `attacker-move-illegal`.
 * 2. Defender children are set-equal to the full legal move list, **including all four
 *    promotion pieces** — `defences-not-set-equal`. Equality is on the multiset, so a
 *    duplicated reply cannot pad the count while a real reply is missing.
 * 3. Every terminal is checkmate — `non-mate-terminal`.
 * 4. No defender node has zero children — `stalemate-terminal`. An empty legal move list is
 *    stalemate, and an empty authored list would satisfy check 2 *vacuously*: `{} == {}` is
 *    the classic hole and it is closed by its own check rather than left to arithmetic.
 * 5. No terminal inside the net is anything but checkmate — also `non-mate-terminal`, plus
 *    `mate-not-terminal` for a net that carries on past a mate it already delivered.
 * 6. No position repeats three times along any line — `repetition`. This is why the whole
 *    game is replayed from the standard start position rather than the certificate being
 *    checked from a FEN: a repetition is a fact about a game's history, and a fragment
 *    cannot see one.
 *
 * Minimality is checked separately and by a different method (ADR-0005, step 5): the net
 * proves "mate **within** N", and only the bounded search can say that no shorter mate
 * exists. If that search reaches its node cap it returns `unknown`, and the claim is
 * **refused** — never accepted for want of a refutation.
 */

export type VerificationReason =
  /* The file itself */
  | 'certificate-malformed'
  | 'certificate-misfiled'
  | 'line-illegal'
  | 'line-mismatched'
  | 'claim-terminal'
  /* The six checks over the net */
  | 'attacker-move-illegal'
  | 'defences-not-set-equal'
  | 'stalemate-terminal'
  | 'non-mate-terminal'
  | 'mate-not-terminal'
  | 'repetition'
  /* The claim the net is supposed to support */
  | 'depth-mismatch'
  | 'not-minimal'
  | 'search-disagrees'
  | 'search-cap'

export type VerificationFailure = {
  readonly reason: VerificationReason
  /** The node inside the net, as SAN from the claimed position, e.g. `Bxf7+ > Ke7`. */
  readonly at: string
  readonly message: string
}

export type Proof = {
  readonly certificate: Certificate
  readonly inMoves: number
  /**
   * The longest line in the net, in plies from the claimed position: the mate as it goes
   * when the defender holds out as long as possible. A mate in N runs to `2N - 1` plies.
   */
  readonly sequence: readonly string[]
  readonly attacker: 'white' | 'black'
  readonly attackerMoves: number
  readonly defenderNodes: number
}

export type Verification =
  | { readonly ok: true; readonly proof: Proof }
  | { readonly ok: false; readonly failures: readonly VerificationFailure[] }

const joinNetPath = (plies: readonly string[]): string =>
  plies.length === 0 ? '(the claimed position)' : plies.join(' > ')

type Walk = {
  readonly failures: VerificationFailure[]
  readonly chess: Chess
}

const fail = (
  walk: Walk,
  reason: VerificationReason,
  path: readonly string[],
  message: string,
): void => {
  walk.failures.push({ reason, at: joinNetPath(path), message })
}

/** The deepest line under one attacker move: its length in moves, and its plies. */
type Deepest = { readonly moves: number; readonly line: readonly string[] }

const verifyAttacker = (walk: Walk, node: MateNet, path: readonly string[]): Deepest => {
  const chess = walk.chess
  const legal = chess.moves()

  // Check 1. Legality and canonical spelling in one: `chess.moves()` emits canonical SAN,
  // so a move that is legal but written another way is not in the list — and a net that
  // spells a move ambiguously is a net whose replay depends on who reads it.
  if (!legal.includes(node.ply)) {
    fail(
      walk,
      'attacker-move-illegal',
      path,
      `\`${node.ply}\` is not a legal move for the attacker here. Legal: ${legal.join(', ')}.`,
    )
    return { moves: 0, line: [] }
  }

  chess.move(node.ply)
  const here = [...path, node.ply]
  try {
    // Check 6, on the attacker's own move: a position reached for the third time is a draw
    // the defender can claim, so the mate is not forced.
    if (chess.isThreefoldRepetition()) {
      fail(
        walk,
        'repetition',
        here,
        `\`${node.ply}\` repeats a position for the third time. The defender claims the draw here, so nothing beyond this point is forced.`,
      )
    }

    if (chess.isCheckmate()) {
      // Check 5's mirror: a net that continues past the mate it delivered is not describing
      // the game it claims to describe.
      if (node.defences.length > 0) {
        fail(
          walk,
          'mate-not-terminal',
          here,
          `\`${node.ply}\` is checkmate, but the net carries ${node.defences.length} repl${node.defences.length === 1 ? 'y' : 'ies'} beyond it. The game is over.`,
        )
      }
      return { moves: 1, line: [node.ply] }
    }

    const replies = chess.moves()

    // Check 4, explicitly and before check 2 can be satisfied by an empty set on both sides.
    if (replies.length === 0) {
      fail(
        walk,
        'stalemate-terminal',
        here,
        `\`${node.ply}\` leaves the defender with no legal move and no check: this is **stalemate**, a draw, not mate. An empty set of replies would satisfy set-equality vacuously, which is exactly why this is its own check (ADR-0005, check 4).`,
      )
      return { moves: 1, line: [node.ply] }
    }

    // Checks 3 and 5: a terminal here is a leaf in a net that has not mated.
    if (node.defences.length === 0) {
      fail(
        walk,
        'non-mate-terminal',
        here,
        `The net ends after \`${node.ply}\`, but the game does not: the defender has ${replies.length} legal repl${replies.length === 1 ? 'y' : 'ies'} and is not checkmated. A net may only stop at checkmate (ADR-0005, check 5).`,
      )
      return { moves: 1, line: [node.ply] }
    }

    // Check 2. Multiset equality, so a duplicate cannot stand in for a missing reply.
    const authored = node.defences.map((defence) => defence.ply)
    const missing = replies.filter((reply) => !authored.includes(reply))
    const unexpected = authored.filter((reply) => !replies.includes(reply))
    const duplicated = authored.filter((reply, index) => authored.indexOf(reply) !== index)
    if (missing.length > 0 || unexpected.length > 0 || duplicated.length > 0) {
      const parts = [
        missing.length === 0 ? undefined : `missing ${missing.join(', ')}`,
        unexpected.length === 0 ? undefined : `not legal here: ${unexpected.join(', ')}`,
        duplicated.length === 0 ? undefined : `listed twice: ${duplicated.join(', ')}`,
      ].filter((part) => part !== undefined)
      fail(
        walk,
        'defences-not-set-equal',
        here,
        `After \`${node.ply}\` the net answers ${authored.length} of the defender's ${replies.length} legal replies — ${parts.join('; ')}. A mate is forced only if every reply is answered, and a promoting reply means all four of \`=Q\`, \`=R\`, \`=B\` and \`=N\` (ADR-0005, check 2).`,
      )
    }

    let deepest: Deepest = { moves: 1, line: [node.ply] }
    for (const defence of node.defences) {
      if (!replies.includes(defence.ply)) continue
      chess.move(defence.ply)
      const below = [...here, defence.ply]
      if (chess.isThreefoldRepetition()) {
        fail(
          walk,
          'repetition',
          below,
          `\`${defence.ply}\` repeats a position for the third time, so the defender draws here rather than being mated.`,
        )
      }
      const under = verifyAttacker(walk, defence.answer, below)
      chess.undo()
      if (1 + under.moves > deepest.moves) {
        deepest = { moves: 1 + under.moves, line: [node.ply, defence.ply, ...under.line] }
      }
    }
    return deepest
  } finally {
    chess.undo()
  }
}

export type VerifyOptions = {
  readonly nodeCap?: number | undefined
}

/**
 * Verify one certificate.
 *
 * `fileName` is checked against what the certificate says it is about, so a file renamed or
 * copied to another entry fails rather than quietly proving the wrong leaf.
 */
export const verifyCertificate = (
  fileName: string,
  value: unknown,
  options: VerifyOptions = {},
): Verification => {
  const parsed = parseCertificate(value)
  if (!parsed.ok) {
    return {
      ok: false,
      failures: [
        {
          reason: 'certificate-malformed',
          at: '(the file)',
          message: `Not a proof certificate: ${parsed.problems.join('; ')}.`,
        },
      ],
    }
  }

  const certificate = parsed.certificate
  const walk: Walk = { failures: [], chess: new Chess() }

  const expected = certificateFileName(certificate.entry, certificate.node)
  const actual = fileName.split('/').at(-1)
  if (actual !== expected) {
    fail(
      walk,
      'certificate-misfiled',
      [],
      `This file is named \`${actual ?? fileName}\` but proves \`${certificate.node.join(' ')}\` in \`${certificate.entry}\`, which belongs in \`${expected}\`. A certificate that can be filed anywhere can prove the wrong leaf.`,
    )
  }

  const tail = certificate.line.slice(-certificate.node.length)
  if (tail.join(' ') !== certificate.node.join(' ')) {
    fail(
      walk,
      'line-mismatched',
      [],
      `\`line\` ends \`${tail.join(' ')}\` but \`node\` is \`${certificate.node.join(' ')}\`. The line is the whole game to the claimed leaf, so it must end with the path from the entry root.`,
    )
    return { ok: false, failures: walk.failures }
  }

  for (const [index, ply] of certificate.line.entries()) {
    const legal = walk.chess.moves()
    if (!legal.includes(ply)) {
      fail(
        walk,
        'line-illegal',
        [],
        `Ply ${index + 1} of \`line\` is \`${ply}\`, which is not legal (or not canonical SAN) in the position it is played from. Every position is replayed from the standard start position and never asserted (docs/CONTEXT.md, invariant 1).`,
      )
      return { ok: false, failures: walk.failures }
    }
    walk.chess.move(ply)
  }

  if (walk.chess.isCheckmate() || walk.chess.isStalemate()) {
    fail(
      walk,
      'claim-terminal',
      [],
      `The claimed position is already ${walk.chess.isCheckmate() ? 'checkmate' : 'stalemate'}, so there is no mate to force from it.`,
    )
    return { ok: false, failures: walk.failures }
  }
  if (walk.chess.isThreefoldRepetition()) {
    fail(
      walk,
      'repetition',
      [],
      'The claimed position has already occurred three times, so the defender claims a draw before the net begins.',
    )
  }

  const attacker = walk.chess.turn() === 'w' ? 'white' : 'black'
  const claimedFen = walk.chess.fen()
  const deepest = verifyAttacker(walk, certificate.net, [])

  if (deepest.moves !== certificate.inMoves) {
    fail(
      walk,
      'depth-mismatch',
      [],
      `The certificate claims mate in ${certificate.inMoves}, but its longest line is ${deepest.moves} move${deepest.moves === 1 ? '' : 's'} (${deepest.line.join(' ')}). The number is a claim about the net, not a label on it.`,
    )
  }

  // Minimality, by the one method that can establish it. Run even when the net failed: a
  // report that names every reason is worth more than one that stops at the first.
  const search = searchMate(claimedFen, {
    withinMoves: certificate.inMoves,
    nodeCap: options.nodeCap ?? DEFAULT_NODE_CAP,
  })
  switch (search.kind) {
    case 'unknown':
      fail(
        walk,
        'search-cap',
        [],
        `The minimality search reached its node cap, so it does not know whether a shorter mate exists. An unproved claim is refused, never accepted for want of a refutation (ADR-0005, "Failing safe").`,
      )
      break
    case 'no-mate':
      fail(
        walk,
        'search-disagrees',
        [],
        `The net claims mate in ${certificate.inMoves}, and an independent search of the same position to the same depth found none. Two methods over the same rules disagree, so nothing here is proved.`,
      )
      break
    case 'mate':
      if (search.inMoves < certificate.inMoves) {
        fail(
          walk,
          'not-minimal',
          [],
          `The certificate claims mate in ${certificate.inMoves}, but mate in ${search.inMoves} is forced from the same position. A net proves "mate within N"; the number published must be the shortest one (ADR-0005, step 5).`,
        )
      }
      break
  }

  if (walk.failures.length > 0) return { ok: false, failures: walk.failures }

  const counted = countNet(certificate.net)
  return {
    ok: true,
    proof: {
      certificate,
      inMoves: certificate.inMoves,
      sequence: deepest.line,
      attacker,
      attackerMoves: counted.attackerMoves,
      defenderNodes: counted.defenderNodes,
    },
  }
}

/** For the CLI's one-line summary of a refusal. */
export const describeFailure = (failure: VerificationFailure): string =>
  `[${failure.reason}] ${failure.at}\n    ${failure.message}`
