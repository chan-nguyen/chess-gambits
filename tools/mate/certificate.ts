import { z } from 'zod'

/**
 * A proof certificate: the complete forced mate net, committed beside its content file
 * (ADR-0005, step 3).
 *
 * It is a **replay script**, not a claim. It stores moves and nothing else — no FEN, no
 * evaluation, no engine output — so there is nothing in it that can drift out of sync with
 * the moves beside it (`docs/CONTEXT.md`, invariant 1). Everything else is derived by
 * playing it: the positions, whose turn it is, whether a line mates, and whether a position
 * repeats.
 *
 * `line` makes the file self-contained: it is the whole game from the standard start
 * position to the claimed leaf, so `verify.ts` needs no content file to check it, and
 * threefold repetition is judged against the real history rather than a fragment. `entry`
 * and `node` are what tie it back to the content, and the validator checks that
 * `line` is exactly `definingLine` followed by `node` rather than trusting either.
 *
 * Build-time only. A certificate is a build input and never reaches the browser; what a
 * learner receives is the proved outcome the certificate justifies, carrying this file's
 * name so the proof can be looked up and replayed by anyone.
 */

/** A defender's reply, and the single attacker move that answers it. */
export type Defence = {
  readonly ply: string
  readonly answer: MateNet
}

/**
 * One attacker move and every legal reply to it.
 *
 * `defences` empty means the move ended the game, and `verify.ts` requires that ending to
 * be checkmate. The shape cannot express a defender node with a *chosen* subset of replies:
 * a `Defence` carries exactly one answer and an attacker node carries all of them or none.
 */
export type MateNet = {
  readonly ply: string
  readonly defences: readonly Defence[]
}

export type Certificate = {
  /** The entry id this proof belongs to. */
  readonly entry: string
  /** Canonical SAN path from the entry root to the claimed leaf (`docs/CONTEXT.md`, Path). */
  readonly node: readonly string[]
  /** The whole game in canonical SAN, from the standard start position to that leaf. */
  readonly line: readonly string[]
  /** The claim: the opponent is mated in this many **moves**, and no fewer. */
  readonly inMoves: number
  readonly net: MateNet
}

const san = z.string().min(2).max(10)

const net: z.ZodType<MateNet> = z.strictObject({
  ply: san,
  get defences() {
    return z.array(defence)
  },
})

const defence: z.ZodType<Defence> = z.strictObject({
  ply: san,
  get answer() {
    return net
  },
})

export const certificateSchema = z.strictObject({
  entry: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  node: z.array(san).min(1),
  line: z.array(san).min(1),
  inMoves: z.int().min(1),
  net,
})

/**
 * Where a certificate lives, derived from what it is about rather than stored in it.
 *
 * The node path is percent-encoded as a whole, exactly as a `line` URL parameter is
 * (`docs/CONTEXT.md`, Path): check and mate suffixes carry `+` and `#`, and both are
 * hostile in a file name for the same reason they are hostile in a query string. A proof of
 * a mate is the most likely thing in this project to have a `#` in its name.
 */
export const certificateFileName = (entry: string, node: readonly string[]): string =>
  `${entry}.${encodeURIComponent(node.join('_'))}.mate.json`

/** Pretty-printed and newline-terminated: a certificate is read in a diff during review. */
export const certificateJson = (certificate: Certificate): string =>
  `${JSON.stringify(certificate, undefined, 2)}\n`

export type CertificateParse =
  | { readonly ok: true; readonly certificate: Certificate }
  | { readonly ok: false; readonly problems: readonly string[] }

export const parseCertificate = (value: unknown): CertificateParse => {
  const result = certificateSchema.safeParse(value)
  if (result.success) return { ok: true, certificate: result.data }
  return {
    ok: false,
    problems: result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    ),
  }
}

/** Every attacker move in the net, in replay order. Used for counting and reporting. */
export const countNet = (node: MateNet): { attackerMoves: number; defenderNodes: number } =>
  node.defences.reduce(
    (total, defence) => {
      const below = countNet(defence.answer)
      return {
        attackerMoves: total.attackerMoves + below.attackerMoves,
        defenderNodes: total.defenderNodes + below.defenderNodes,
      }
    },
    { attackerMoves: 1, defenderNodes: node.defences.length === 0 ? 0 : 1 },
  )
