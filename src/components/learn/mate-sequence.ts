/**
 * A proved line, numbered the way chess numbers one.
 *
 * `plyLabel` in `tree-path.ts` numbers a ply from the FEN of the position it *produced*,
 * which is what a node on a path carries. A mate sequence has no such FENs: the wire
 * carries the leaf's position and a list of SAN, and nothing else — the certificate that
 * proves the mate is a build input and never reaches the browser (ADR-0005). So the
 * numbering is counted forward from the leaf instead.
 *
 * This reads two fields of a FEN and does arithmetic. It is emphatically **not** rules
 * logic and must not become any: the application has no engine and ADR-0003's tripwire
 * exists to keep it that way. Every SAN here was already replayed against a real board by
 * the content gate before it was compiled.
 *
 * Counted in **plies**, labelled in **moves** (docs/CONTEXT.md, *Ply*): a mate in N runs to
 * `2N - 1` plies, so the two numbers are never interchangeable and the code never spells
 * them the same.
 */

export type NumberedPly = {
  readonly ply: string
  /** `7.Bxf7+`, `7...Ke7`. Standard notation, never localised (docs/design-system.md §7). */
  readonly label: string
}

/**
 * Number a sequence of plies played *from* `fen`.
 *
 * A FEN that does not parse falls back to the bare SAN rather than to a guess: `NaN.Bxf7+`
 * on a page whose argument is that it does not overstate would be worse than no number.
 */
export const numberSequence = (
  fen: string,
  sequence: readonly string[],
): readonly NumberedPly[] => {
  const fields = fen.split(' ')
  const side = fields[1]
  const fullmove = Number(fields[5])

  if ((side !== 'w' && side !== 'b') || !Number.isInteger(fullmove) || fullmove < 1) {
    return sequence.map((ply) => ({ ply, label: ply }))
  }

  return sequence.map((ply, index) => {
    // Black to move means the move number is already half spent, so the count starts at 1.
    const plies = side === 'w' ? index : index + 1
    const moves = fullmove + Math.floor(plies / 2)
    return { ply, label: `${moves}${plies % 2 === 0 ? '.' : '...'}${ply}` }
  })
}
