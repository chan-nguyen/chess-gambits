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
 * **Shape only.** Whether a given ply was actually *legal* at its position can only be
 * answered by replaying it — `replay` in `chess-engine.ts` does that with a real `chess.js`
 * instance (#131; a precomputed opening tree walk did this job before it, when moves were
 * restricted to the catalogue). This parser stays shape-only regardless: it has no board
 * position to check a token against, only a string that came out of a URL.
 */

const plySeparator = '_'

/** The query parameter's name. */
export const movesParam = 'moves'

/**
 * An upper bound on how many plies a `moves` value may carry. A URL is attacker-controlled
 * (docs/security.md, B4), and this is comfortably past any game that has not already ended
 * — chess games this long are vanishingly rare, and `replay` stops offering moves the
 * instant `chess.js` reports the game over regardless.
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
 * `maxMovesPlies`. Never throws. Whether each token is actually a legal move at its
 * position is for the caller to check by replaying it (`replay` in `chess-engine.ts`).
 */
export const parseMovesShape = (raw: string): readonly string[] =>
  raw === '' ? [] : raw.split(plySeparator).slice(0, maxMovesPlies)
