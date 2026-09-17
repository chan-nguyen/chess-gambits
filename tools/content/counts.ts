import type { Position } from './board.ts'
import { applyPly } from './board.ts'
import type { AuthoredCount } from './schema.ts'

/**
 * Counted claims, derived by replay (ADR-0011).
 *
 * The pipeline already replays every ply, derives every FEN and verifies every mate
 * certificate. The one thing it never checked was a *number in a sentence* — "twenty-five of
 * the forty-two legal replies are mated at once", which was twenty-three, and which survived
 * review because the paragraph around it was internally consistent (#77).
 *
 * There are three questions the existing entries actually ask, and they are all questions
 * about the set of legal replies to one position. Nothing here judges anything: it counts.
 *
 * Build-time only. `chess.js` reaches this module and never the browser
 * (`src/components/board/board-tripwire.test.ts`).
 */

/** How many legal replies here are checkmated at once by `ply`. */
const matedBy = (position: Position, ply: string): number =>
  position.legalMoves.filter((reply) => {
    const played = applyPly(position, reply)
    if (!played.ok) return false
    const mate = applyPly(played.position, ply)
    return mate.ok && mate.position.isCheckmate
  }).length

/**
 * The figure the claim is actually about.
 *
 * `notMatedBy` is the complement rather than a second search, because "nineteen replies do
 * stop the mate" and "twenty-three are mated" are one count read two ways, and deriving them
 * separately would let them disagree.
 */
export const deriveCount = (position: Position, spec: AuthoredCount): number => {
  switch (spec.count) {
    case 'legalReplies':
      return position.legalMoves.length
    case 'matedBy':
      return matedBy(position, spec.ply)
    case 'notMatedBy':
      return position.legalMoves.length - matedBy(position, spec.ply)
  }
}

/** How the claim reads in an error message, so the author is told which claim is wrong. */
export const describeCount = (spec: AuthoredCount): string => {
  switch (spec.count) {
    case 'legalReplies':
      return 'legal replies here'
    case 'matedBy':
      return `legal replies here that are checkmated at once by \`${spec.ply}\``
    case 'notMatedBy':
      return `legal replies here that are **not** checkmated at once by \`${spec.ply}\``
  }
}

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g

/** `{Mated}` is the count called `mated`, capitalised. See `schema.ts`. */
const lookupName = (written: string): string =>
  `${written.slice(0, 1).toLowerCase()}${written.slice(1)}`

export type FilledProse = {
  readonly text: string
  /** Placeholders naming a count this node does not declare. */
  readonly unknown: readonly string[]
  /** Counts this text did use, so the node can refuse one it declared and never used. */
  readonly used: readonly string[]
}

/**
 * Replace every `{name}` with the spelled-out figure the build derived.
 *
 * A placeholder whose count is declared but has no spelling is left standing. That only
 * happens when the count has already been refused — a mismatch with `expect`, or a figure
 * too large to write in words — and the file is rejected either way; repeating the same
 * cause as a second, differently worded issue helps nobody.
 */
export const fillProse = (
  text: string,
  spellings: ReadonlyMap<string, string>,
  declared: ReadonlySet<string>,
): FilledProse => {
  const unknown: string[] = []
  const used: string[] = []
  const filled = text.replace(PLACEHOLDER, (whole, written: string) => {
    const name = lookupName(written)
    if (!declared.has(name)) {
      unknown.push(written)
      return whole
    }
    used.push(name)
    return spellings.get(written) ?? whole
  })
  return { text: filled, unknown, used }
}
