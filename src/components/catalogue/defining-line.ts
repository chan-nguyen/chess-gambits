/**
 * The defining line as SAN, numbered the way a scoresheet is.
 *
 * Numbered from the index rather than from a position, because the catalogue carries the
 * moves and no positions — deriving a FEN would mean putting a chess engine in the bundle
 * to print a move number. The format matches `plyLabel` exactly (`1.e4`, `1...e5`), so the
 * same line reads identically here and in the move list on a taught page.
 *
 * Never localised (docs/design-system.md §7): a Vietnamese learner reading `Nf3` reads what
 * every other chess resource shows them.
 */
export const numberedPlies = (line: string): readonly string[] =>
  line
    .split(/\s+/)
    .filter((ply) => ply !== '')
    .map((ply, index) => `${Math.floor(index / 2) + 1}${index % 2 === 0 ? '.' : '...'}${ply}`)
