/**
 * The `prelude` URL parameter: how many plies of the **defining line** have been played,
 * counted from the initial position (docs/CONTEXT.md, *Prelude*).
 *
 * It exists because `line` could not be asked to carry this and stay itself. `line` is the
 * ordered SAN plies **from the gambit root**, and that is not a spelling — it is what every
 * published link means. Repointing it at the initial position would leave every shared URL
 * resolving, and resolving somewhere else, which is worse than breaking it: nothing tells
 * the reader they are looking at the wrong board. So `line` is untouched and the walk
 * *before* the root gets its own parameter.
 *
 * Three properties follow from the design and each is a test in `prelude.test.ts`:
 *
 * - **Absent means "at or past the gambit root".** Every URL that exists today omits it, so
 *   every URL that exists today still lands exactly where it landed (AC 3).
 * - **`line` wins.** A URL carrying both is contradictory — one says the learner is inside
 *   the defining line, the other says they are past it — and the tie is broken in `line`'s
 *   favour, because `line` is the half that is published. That is not a tidy-up: it is what
 *   makes AC 3 hold *by construction* rather than by inspection of a list of links.
 * - **A count, not SAN.** The defining line is one fixed sequence with no siblings and no
 *   ordering to survive, so *Path*'s argument for SAN over indices — that SAN survives a
 *   branch being reordered or a sibling inserted — has nothing to bite on here. What a count
 *   does buy is that the only malformed value is "not a small whole number": a SAN prelude
 *   would be an attacker-supplied move list (docs/security.md, B4) that has to be walked and
 *   recovered, to name positions that are already enumerated in the entry.
 */

/** The query parameter's name, in one place so the router and the tests agree. */
export const preludeParam = 'prelude'

/**
 * An upper bound on the count, for the same reason `maxLinePlies` exists: the value is
 * attacker-controlled and nothing legitimate approaches it. The longest defining line in the
 * catalogue is a dozen plies.
 */
export const maxPreludePlies = 512

/** Why a `prelude` could not be read. */
export type PreludeProblem =
  | { readonly kind: 'not-a-count'; readonly value: string }
  | { readonly kind: 'too-many-plies'; readonly limit: number }

/**
 * A `prelude` that has been read. `plies` is null when the parameter is absent or could not
 * be read — both of which mean "at or past the gambit root", which is where a URL with no
 * `prelude` at all has always landed.
 */
export type ParsedPrelude = {
  readonly plies: number | null
  readonly problem: PreludeProblem | null
}

/** Digits only: no sign, no decimal point, no whitespace, no leading zero padding. */
const count = /^(?:0|[1-9][0-9]{0,3})$/

/** The query string for a prelude position. */
export const preludeSearch = (plies: number): string => `?${preludeParam}=${plies}`

/** Read a decoded `prelude` value. Never throws: every failure is a returned problem. */
export const parsePrelude = (raw: string): ParsedPrelude => {
  if (raw === '') return { plies: null, problem: null }
  if (!count.test(raw)) return { plies: null, problem: { kind: 'not-a-count', value: raw } }

  const plies = Number(raw)
  if (plies > maxPreludePlies) {
    return { plies: null, problem: { kind: 'too-many-plies', limit: maxPreludePlies } }
  }

  return { plies, problem: null }
}

/**
 * What went wrong, specifically enough to act on, in the same voice as
 * `describeLineProblem`.
 *
 * A count that is simply *longer than this gambit's defining line* is not reported here and
 * is not a problem: every such value names a position at or past the gambit root, the root
 * is a real position, and it is the one a link with no `prelude` has always resolved to. The
 * walk clamps there silently rather than accusing a link of being broken when it is merely
 * pointing past the end of a short opening.
 */
export const describePreludeProblem = (problem: PreludeProblem): string => {
  switch (problem.kind) {
    case 'not-a-count':
      return `This link's opening position, "${problem.value}", is not a number of moves, so the gambit is shown from its own starting point.`
    case 'too-many-plies':
      return `This link asks for more than ${problem.limit} opening moves, so the gambit is shown from its own starting point.`
  }
}
