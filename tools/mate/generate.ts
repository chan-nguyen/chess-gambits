import { Chess } from 'chess.js'
import type { Certificate, MateNet } from './certificate.ts'
import { DEFAULT_NODE_CAP, matingMove, searchMate } from './search.ts'

/**
 * The generator (ADR-0005, step 3): given a claimed position, expand the **complete** forced
 * net and hand back something a verifier can replay.
 *
 * At an attacker node it records the single mating move. At a defender node it enumerates
 * every legal reply from `chess.js` and recurses into all of them — never a chosen subset,
 * because a subset is exactly the mate net a person would have written and exactly the class
 * of error this replaces.
 *
 * It refuses more readily than it produces. A claim it cannot settle inside the node cap is
 * **refused**, not downgraded and not deferred: an unprovable claim never becomes a published
 * one, and the leaf goes back to the author to be written as an honest assessment. The
 * Fishing Pole's mate in four is the worked example — measured here, it is still `unknown`
 * after three million nodes and 159 seconds, so the tooling refuses it and says so.
 *
 * Build-time only, and scheduled rather than run per pull request.
 */

export type GenerationRefusal =
  /** The position is already over, so there is nothing to force. */
  | 'position-terminal'
  /** No forced mate within the depth asked for. The claim is simply false. */
  | 'no-mate'
  /** The search reached its node cap. Nothing is claimed either way (ADR-0005). */
  | 'cap-reached'

export type Generation =
  | { readonly ok: true; readonly net: MateNet; readonly inMoves: number }
  | { readonly ok: false; readonly reason: GenerationRefusal; readonly message: string }

export type GenerateOptions = {
  /** Deepest mate to look for, in moves. */
  readonly maxMoves: number
  readonly nodeCap?: number | undefined
}

const refuse = (reason: GenerationRefusal, message: string): Generation => ({
  ok: false,
  reason,
  message,
})

/**
 * Expand the net below a position whose minimal forced mate is already known to be
 * `inMoves`. Returns nothing only if the search that established that goes back on itself,
 * which would be a defect rather than a content problem — so it is reported, never
 * papered over.
 */
const expand = (chess: Chess, inMoves: number, nodeCap: number): MateNet | undefined => {
  const chosen = matingMove(chess.fen(), inMoves, nodeCap)
  if (chosen === undefined) return undefined

  chess.move(chosen.san)
  try {
    if (chess.isCheckmate()) return { ply: chosen.san, defences: [] }

    const replies = chess.moves()
    // A position that is not checkmate and has no legal reply is stalemate: it does not mate,
    // so there is nothing here to expand and `matingMove` should never have chosen it.
    if (replies.length === 0) return undefined

    const defences = []
    for (const reply of replies) {
      chess.move(reply)
      const below = searchMate(chess.fen(), { withinMoves: inMoves - 1, nodeCap })
      if (below.kind !== 'mate') {
        chess.undo()
        return undefined
      }
      // Recomputed rather than decremented: a reply that walks into a faster mate gets the
      // faster net, so every branch is minimal and not just the root.
      const answer = expand(chess, below.inMoves, nodeCap)
      chess.undo()
      if (answer === undefined) return undefined
      defences.push({ ply: reply, answer })
    }

    return { ply: chosen.san, defences }
  } finally {
    chess.undo()
  }
}

/** Expand the net for the position reached by replaying `line` from the start position. */
export const generateNet = (line: readonly string[], options: GenerateOptions): Generation => {
  const nodeCap = options.nodeCap ?? DEFAULT_NODE_CAP
  const chess = new Chess()
  for (const ply of line) chess.move(ply)

  if (chess.isGameOver()) {
    return refuse('position-terminal', 'The claimed position is already over.')
  }

  const found = searchMate(chess.fen(), { withinMoves: options.maxMoves, nodeCap })
  if (found.kind === 'unknown') {
    return refuse(
      'cap-reached',
      `The search reached its cap of ${nodeCap.toLocaleString('en')} nodes without settling whether mate in ${options.maxMoves} is forced. The claim is refused: an unproved mate is not a mate (ADR-0005).`,
    )
  }
  if (found.kind === 'no-mate') {
    return refuse(
      'no-mate',
      `No forced mate within ${options.maxMoves} move${options.maxMoves === 1 ? '' : 's'} exists here. The leaf is an assessment, not a trap.`,
    )
  }

  const net = expand(chess, found.inMoves, nodeCap)
  if (net === undefined) {
    return refuse(
      'cap-reached',
      `A mate in ${found.inMoves} was found but the net could not be expanded within the node cap.`,
    )
  }

  return { ok: true, net, inMoves: found.inMoves }
}

export type CertificateGeneration =
  | { readonly ok: true; readonly certificate: Certificate }
  | { readonly ok: false; readonly reason: GenerationRefusal; readonly message: string }

export const generateCertificate = (
  entry: string,
  definingLine: readonly string[],
  node: readonly string[],
  options: GenerateOptions,
): CertificateGeneration => {
  const line = [...definingLine, ...node]
  const generated = generateNet(line, options)
  if (!generated.ok) return generated
  return {
    ok: true,
    certificate: {
      entry,
      node: [...node],
      line,
      inMoves: generated.inMoves,
      net: generated.net,
    },
  }
}
