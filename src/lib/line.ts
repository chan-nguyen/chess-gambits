/**
 * The `line` URL parameter: the learner's path from the gambit root, as ordered SAN
 * plies (docs/CONTEXT.md, *Path*).
 *
 * Encoded as underscore-joined SAN, then percent-encoded **as a whole**. That is not a
 * precaution, it is a fix: raw, `+` is the form encoding for a space and `#` begins the
 * fragment, so `?line=Nxe5_Bxd1_Bxf7+_Ke7_Nd5#` parses back as `Nxe5_Bxd1_Bxf7 _Ke7_Nd5`
 * — silently truncated. Check moves carry `+` and mate moves carry `#`, so the links
 * that break unencoded are exactly the links to proved checkmates.
 *
 * Note the deliberate asymmetry: `encodeLine` returns the percent-encoded parameter
 * *value* for building a URL, while `parseLine` takes the *decoded* value, because
 * anything that reads a URL — `URL.searchParams`, `useSearchParams` — decodes for you.
 */

const plySeparator = '_'

/** The query parameter's name, in one place so the router and the tests agree. */
export const lineParam = 'line'

/**
 * An upper bound on how many plies a `line` may carry. A URL is attacker-controlled
 * (docs/security.md, B4) and nothing legitimate approaches this: the longest gambit
 * line in the catalogue is tens of plies, not hundreds.
 */
export const maxLinePlies = 512

/**
 * The shape of a single SAN ply. Shape only — whether the move is *legal* from the
 * parent position can only be answered by replaying it against the gambit tree, which
 * is the content pipeline's job, not the URL parser's.
 */
const sanPly = /^(?:O-O(?:-O)?|(?:[KQRBN][a-h]?[1-8]?|[a-h])?x?[a-h][1-8](?:=[QRBN])?)[+#]?$/

/** Why a `line` could not be read in full. */
export type LineProblem =
  | { readonly kind: 'empty-ply'; readonly index: number }
  | { readonly kind: 'malformed-ply'; readonly index: number; readonly ply: string }
  | { readonly kind: 'too-many-plies'; readonly limit: number }

/**
 * A `line` that has been read as far as it makes sense to. `plies` is the nearest valid
 * node — the longest prefix that parsed — and `problem` is null only when the whole
 * value parsed.
 */
export type ParsedLine = {
  readonly plies: readonly string[]
  readonly problem: LineProblem | null
}

/** The `line` parameter value for a path: underscore-joined SAN, percent-encoded whole. */
export const encodeLine = (plies: readonly string[]): string =>
  encodeURIComponent(plies.join(plySeparator))

/** The query string for a path, or `''` at the gambit root where the parameter is noise. */
export const lineSearch = (plies: readonly string[]): string =>
  plies.length === 0 ? '' : `?${lineParam}=${encodeLine(plies)}`

/** Read a decoded `line` value. Never throws: every failure is a returned problem. */
export const parseLine = (raw: string): ParsedLine => {
  if (raw === '') return { plies: [], problem: null }

  const segments = raw.split(plySeparator)
  const capped = segments.slice(0, maxLinePlies)

  for (const [index, segment] of capped.entries()) {
    if (segment === '') {
      return { plies: capped.slice(0, index), problem: { kind: 'empty-ply', index } }
    }
    if (!sanPly.test(segment)) {
      return {
        plies: capped.slice(0, index),
        problem: { kind: 'malformed-ply', index, ply: segment },
      }
    }
  }

  return {
    plies: capped,
    problem:
      segments.length > maxLinePlies ? { kind: 'too-many-plies', limit: maxLinePlies } : null,
  }
}

/**
 * What went wrong, specifically enough to act on. Ply numbers are 1-based here because
 * this is read by a person, not by an index.
 */
export const describeLineProblem = (problem: LineProblem): string => {
  switch (problem.kind) {
    case 'empty-ply':
      return `This link has a missing move at position ${problem.index + 1}, so it was followed as far as it made sense.`
    case 'malformed-ply':
      return `This link's move ${problem.index + 1}, "${problem.ply}", is not a move, so it was followed as far as it made sense.`
    case 'too-many-plies':
      return `This link has more than ${problem.limit} moves, so only the first ${problem.limit} were followed.`
  }
}
