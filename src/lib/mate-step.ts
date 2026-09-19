/**
 * The `mate` URL parameter: how many plies of a proved mate's `sequence` the walk has played,
 * counted from the leaf that claims the mate (docs/CONTEXT.md, *Outcome*; `sequenceFens` on
 * `CompiledOutcome`, `src/lib/content-types.ts`).
 *
 * It exists for the same reason `prelude` does (`src/lib/prelude.ts`) and the precedent is
 * deliberate, not incidental: a mate-sequence position is also "a FEN with no tree node" — the
 * proved line has no branches, nothing to render as a choice — so it gets the same treatment
 * as the defining line, its own `Address` variant (`walk.ts`) and its own parameter, rather
 * than a second `?line=`-shaped thing or component-local state (#121/#122's `MateNet`, before
 * this ticket).
 *
 * **The precedence rule is not `prelude`'s, and copying it would be wrong.** `prelude` sits
 * *behind* the gambit root, so a `line` beside it is contradictory — one says "before the
 * root", the other "at or past it" — and the tie is broken in `line`'s favour because `line`
 * is what every published link carries. `mate` sits *forward* of a position `line` itself
 * names: `line` says which leaf the proof is played from, `mate` says how many of its plies
 * have been played since. The two are not competing answers to the same question, so there is
 * nothing to break a tie on — the URL for a mate step is `?line=<leaf>&mate=<n>`, both present
 * together and both true at once.
 *
 * What *is* dropped, and where, is different from `prelude`'s drop rule too. A `mate` value is
 * meaningless without a `line` that resolves to a leaf whose outcome is a proved mate — there
 * is no sequence to count into anywhere else. That check needs the entry's own tree (which
 * node `line` resolved to, and whether it carries `outcome.kind === 'mate'`), so it cannot be
 * made here the way `prelude`'s "is this a small whole number" bound can: it is `walk.ts`'s
 * job, the same way `walk.ts` — not this module — clamps a `prelude` past the end of a short
 * defining line to the root. This module only ever answers "is this string a small whole
 * number", and leaves what it means to `walk.ts`.
 *
 * **A count, not SAN**, for exactly `prelude.ts`'s reason: `sequence` is the one fixed line a
 * certificate proved (ADR-0005), not an attacker-chosen branch that has to be validated
 * against a tree — there is no tree to validate it against, only a length to bound it by.
 */

/** The query parameter's name, in one place so the router and the tests agree. */
export const mateParam = 'mate'

/**
 * An upper bound on the count, for the same reason `maxPreludePlies` exists: the value is
 * attacker-controlled and nothing legitimate approaches it. The longest proved mate in the
 * catalogue is a handful of plies.
 */
export const maxMatePly = 512

/** Why a `mate` could not be read. */
export type MateProblem =
  | { readonly kind: 'not-a-count'; readonly value: string }
  | { readonly kind: 'too-many-plies'; readonly limit: number }

/**
 * A `mate` that has been read. `ply` is null when the parameter is absent or could not be
 * read, both of which mean "not inside the mate sequence" — the same position `line` alone
 * would name.
 */
export type ParsedMate = {
  readonly ply: number | null
  readonly problem: MateProblem | null
}

/** Digits only: no sign, no decimal point, no whitespace, no leading zero padding. */
const count = /^(?:0|[1-9][0-9]{0,3})$/

/**
 * The `mate` parameter's value, unprefixed. Unlike `preludeSearch`/`lineSearch` this is never
 * a whole query string on its own: a `mate` address always carries a `line` beside it, naming
 * the leaf, and joining the two is `walk.ts`'s `addressSearch`, not this module's job.
 */
export const encodeMate = (ply: number): string => `${mateParam}=${ply}`

/** Read a decoded `mate` value. Never throws: every failure is a returned problem. */
export const parseMate = (raw: string): ParsedMate => {
  if (raw === '') return { ply: null, problem: null }
  if (!count.test(raw)) return { ply: null, problem: { kind: 'not-a-count', value: raw } }

  const ply = Number(raw)
  if (ply > maxMatePly) {
    return { ply: null, problem: { kind: 'too-many-plies', limit: maxMatePly } }
  }

  return { ply, problem: null }
}

/**
 * What went wrong, specifically enough to act on, in the same voice as
 * `describePreludeProblem`.
 *
 * A count that is simply *longer than this leaf's proved sequence* is not reported here and
 * is not a problem, for the same reason a `prelude` past the end of the defining line is not:
 * `walk.ts` clamps it to the real end, which is a real position and not an error.
 */
export const describeMateProblem = (problem: MateProblem): string => {
  switch (problem.kind) {
    case 'not-a-count':
      return `This link's step into the mate, "${problem.value}", is not a number of moves, so the position is shown from the leaf instead.`
    case 'too-many-plies':
      return `This link asks for more than ${problem.limit} moves into the mate, so only the real end of it is shown.`
  }
}
