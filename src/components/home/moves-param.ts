/**
 * The `moves` URL parameter: the sequence of plies played on the home page's own board
 * (issue #129), as ordered SAN.
 *
 * A sibling of `src/lib/line.ts`, in idiom only. `line` already means something specific
 * and different — the learner's path *within one entry's own tree* on the gambit page —
 * and repointing it at a different route's different state would make one name mean two
 * things depending on which page a reader was looking at. This gets its own parameter, on
 * its own route, and is not read by `filter-url.ts`, which owns `/gambits`'s own filter
 * state and nothing about what a visitor has played on a board.
 *
 * Encoded the same way `line.ts` encodes a path — underscore-joined SAN, percent-encoded as
 * a whole — for the same reason: a raw `+` (check) or `#` (mate) in the query string is
 * form-decoded or truncates the URL at the fragment before it ever reaches this parser.
 *
 * **Shape only.** Whether a given ply was actually *offered* here can only be answered by
 * the opening tree — `walkOpeningTree` in `src/lib/opening-tree.ts` does that, walking the
 * tree itself rather than testing a SAN-shaped regex, which issue #129 asks for
 * specifically: the opening tree enumerates exactly what is legal at each step, so there is
 * no reason to settle for a weaker, shape-only check the way `line.ts` has to (nothing on
 * the gambit page can afford to re-walk a whole gambit tree on every keystroke of a URL).
 */

const plySeparator = '_'

/** The query parameter's name. */
export const movesParam = 'moves'

/**
 * An upper bound on how many plies a `moves` value may carry. A URL is attacker-controlled
 * (docs/security.md, B4); nothing legitimate approaches this since the opening tree is only
 * ever as deep as the catalogue's longest defining line, a dozen or so plies.
 */
export const maxMovesPlies = 128

/** The `moves` value for a played sequence: underscore-joined SAN, percent-encoded whole. */
export const encodeMoves = (plies: readonly string[]): string =>
  encodeURIComponent(plies.join(plySeparator))

/** The query string for a played sequence, or `''` at the start position. */
export const movesSearch = (plies: readonly string[]): string =>
  plies.length === 0 ? '' : `?${movesParam}=${encodeMoves(plies)}`

/**
 * Read a decoded `moves` value into its shape only — a list of SAN-shaped tokens, capped at
 * `maxMovesPlies`. Never throws. Whether each token is a move the opening tree actually
 * offers at its position is for the caller to check with `walkOpeningTree`.
 */
export const parseMovesShape = (raw: string): readonly string[] =>
  raw === '' ? [] : raw.split(plySeparator).slice(0, maxMovesPlies)
