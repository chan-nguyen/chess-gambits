import type { CompiledNode } from '../../lib/content-types.ts'

/**
 * Where the learner is in a gambit tree, and where previous and next go from there.
 *
 * Everything here steps by **ply** — one side's single move (docs/CONTEXT.md, *Ply*).
 * `moves` appears in exactly one place, `moveNumberOf`, and it means what chess means by
 * it: a White ply and a Black reply. The two are never the same identifier.
 *
 * Pure, and free of React and of the router, because the whole of this ticket's
 * correctness is here: which node a URL names, which node the arrow keys reach, and what
 * happens when a shared link names a branch that no longer exists.
 */

/** One ply of the current path, and the node it reaches. */
export type PathStep = {
  readonly ply: string
  /** The plies from the gambit root up to and including this one — a `line` parameter. */
  readonly path: readonly string[]
  readonly node: CompiledNode
}

export type ResolvedPath = {
  /** The deepest node the requested path actually reached. */
  readonly node: CompiledNode
  /** The plies that were followed. A prefix of what was requested, never more. */
  readonly path: readonly string[]
  readonly steps: readonly PathStep[]
  /**
   * The first requested ply that is not a child of the node before it, or null when the
   * whole path was followed. A shared link to a branch that has since been renamed or
   * removed recovers to the nearest valid node and says which ply it could not follow
   * (docs/design-system.md §4, *Errors are specific*).
   */
  readonly strayedAt: string | null
}

/**
 * Walk a requested path from the root, stopping at the first ply that is not there.
 *
 * Matching is by SAN rather than by child index on purpose (docs/CONTEXT.md, *Path*): a
 * sibling inserted or a branch reordered must not silently send an old link somewhere
 * else, and with SAN it cannot.
 */
export const resolvePath = (root: CompiledNode, requested: readonly string[]): ResolvedPath => {
  const steps: PathStep[] = []
  let node = root
  let strayedAt: string | null = null

  for (const ply of requested) {
    const child = node.children?.find((candidate) => candidate.ply === ply)
    if (child === undefined) {
      strayedAt = ply
      break
    }
    node = child
    steps.push({ ply, path: [...steps.map((step) => step.ply), ply], node: child })
  }

  return { node, path: steps.map((step) => step.ply), steps, strayedAt }
}

/** One ply back, or null at the root, where previous is disabled (AC 1). */
export const previousPath = (path: readonly string[]): readonly string[] | null =>
  path.length === 0 ? null : path.slice(0, -1)

/**
 * One ply forward, or null at a leaf, where next is disabled (AC 1).
 *
 * **The seam for #9.** At an opponent node with several modelled replies this takes the
 * first child, so the page is never dead-ended at a branch point. Choosing between them is
 * `BranchChoices`' job and this function is what it replaces: everything else here already
 * navigates by an arbitrary path, so #9 changes which ply is offered and nothing else.
 */
export const nextPath = (node: CompiledNode, path: readonly string[]): readonly string[] | null => {
  const child = node.children?.[0]
  if (child === undefined) return null
  const { ply } = child
  return ply === undefined ? null : [...path, ply]
}

/**
 * The chess move number of the ply that produced a position, read off its own FEN.
 *
 * This is the one place `moves` and `ply` meet, and the FEN is what keeps them honest: a
 * position with Black to move was reached by a White ply, and the fullmove counter has not
 * advanced yet, so the number is the counter itself. With White to move the counter has
 * already advanced past the Black ply that arrived, so the number is one less.
 *
 * Null rather than a guess when the FEN is not one: nothing downstream renders `NaN.`
 */
export type MoveNumber = { readonly moves: number; readonly bySide: 'white' | 'black' }

export const moveNumberOf = (fen: string): MoveNumber | null => {
  const fields = fen.split(' ')
  const fullmove = Number(fields[5])
  if (!Number.isInteger(fullmove) || fullmove < 1) return null
  if (fields[1] === 'b') return { moves: fullmove, bySide: 'white' }
  if (fields[1] === 'w' && fullmove > 1) return { moves: fullmove - 1, bySide: 'black' }
  return null
}

/**
 * `3.Nxe5`, `3...fxe5`. The SAN itself is never localised (docs/design-system.md §7); the
 * number in front of it is the standard notation every chess resource writes, not prose.
 */
export const plyLabel = (ply: string, fen: string): string => {
  const number = moveNumberOf(fen)
  return number === null ? ply : `${number.moves}${number.bySide === 'white' ? '.' : '...'}${ply}`
}
