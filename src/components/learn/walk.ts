import type { CompiledEntry, CompiledNode } from '../../lib/content-types.ts'
import { lineSearch } from '../../lib/line.ts'
import { preludeSearch } from '../../lib/prelude.ts'
import { nextPath, previousPath, resolvePath, type ResolvedPath } from './tree-path.ts'

/**
 * One walk from the initial position, through the defining line, into the tree (#70).
 *
 * Before this module a gambit page began at the position *after* the defining line: the
 * Benko opened on `1.d4 Nf6 2.c4 c5 3.d5 b5` already played, and there was no address for
 * `1.d4`. A learner could see what happens once the opening has been reached and never how
 * it is reached, which for an opening trainer is the interesting half missing.
 *
 * **The join is the whole of this module, and it is a join rather than a rewrite.** The
 * tree half is `tree-path.ts`, untouched: `resolvePath`, `nextPath` and `previousPath` still
 * take plies from the gambit root and still mean exactly what `?line=` means. What is added
 * in front of them is the prelude, addressed by its own parameter, and one `Address` type so
 * that next and previous can cross the seam without either side knowing where the other
 * begins.
 *
 * Two consequences are worth stating because acceptance criteria rest on them:
 *
 * - **A prelude position has no node** (AC 4). It is a FEN and a ply and nothing else, so
 *   there are no children to read, and `BranchChoices`, `PlanChoices` and `OutcomeCard` have
 *   nothing to render there. The defining line cannot become a branch point by accident,
 *   because there is no structure at it that could branch.
 * - **Nothing here counts anything** (AC 5). Progress counts root-to-leaf branches in the
 *   tree (`progress/branches.ts`); the prelude adds no leaf and is not a tree, so the
 *   denominator cannot move.
 */

/**
 * A position, as the URL names it. Exactly one of the two parameters is ever written: the
 * prelude ends where `line` begins, so no address needs both.
 */
export type Address =
  | { readonly at: 'prelude'; readonly plies: number }
  | { readonly at: 'line'; readonly path: readonly string[] }

/** The gambit root: no `prelude`, no `line`. The address every published link resolves to. */
export const rootAddress: Address = { at: 'line', path: [] }

/** The query string for an address, `''` at the gambit root where both parameters are noise. */
export const addressSearch = (address: Address): string =>
  address.at === 'prelude' ? preludeSearch(address.plies) : lineSearch(address.path)

/**
 * A stable string for an address, for React keys and for "did the position change?".
 *
 * The prefix is what keeps `prelude=0` and the root distinct: both are empty-ish and they
 * are not the same place.
 */
export const addressKey = (address: Address): string =>
  address.at === 'prelude' ? `p${address.plies}` : `l${address.path.join('_')}`

/** One ply already walked, and the address of the position it reached. */
export type WalkStep = {
  readonly ply: string
  readonly fen: string
  readonly address: Address
  /** True while the ply belongs to the defining line, which has no branches (AC 4). */
  readonly inPrelude: boolean
}

export type Walk = {
  /** The position on the board. */
  readonly fen: string
  /** The address of that position, which is what the URL says. */
  readonly here: Address
  /**
   * The position before it, or null where there is none. What the board marks its last ply
   * from.
   */
  readonly previousFen: string | null
  /**
   * The ply that reached this position, or null at the initial position, which no ply
   * reached. At the gambit root it is the defining line's last ply: the root node carries no
   * `ply` of its own, and now that the defining line is walkable the move that arrives there
   * is one the page has shown.
   */
  readonly ply: string | null
  /**
   * The tree node the learner is standing on, or **null while inside the defining line**.
   * This null is AC 4: no node, no children, nothing that can render an opponent choice.
   */
  readonly node: CompiledNode | null
  /** The tree half, resolved. Carries `strayedAt` whether or not the walk is in the tree. */
  readonly resolved: ResolvedPath
  /** Every ply walked so far: the defining line up to here, then the path through the tree. */
  readonly steps: readonly WalkStep[]
  readonly previous: Address | null
  readonly next: Address | null
  /** The initial position. */
  readonly start: Address
  /** True when the learner is standing on it, so "back to the start" is at its edge. */
  readonly atStart: boolean
  /** True when the learner is standing on the gambit root — `rootAddress`. */
  readonly atRoot: boolean
  /** True while the learner is inside the defining line, before the root. */
  readonly inPrelude: boolean
}

/**
 * Where a prelude index is addressed, and the one line that makes AC 3 structural.
 *
 * The last prelude position *is* the gambit root, so it is addressed as the root — no
 * `prelude` parameter — and `?prelude=` is therefore never written for a position a
 * published link already names. Every address this module produces at or past the root is
 * byte-for-byte the address the site produced before it existed.
 */
const preludeAddress = (plies: number, lastIndex: number): Address =>
  plies >= lastIndex ? rootAddress : { at: 'prelude', plies }

/**
 * The last index of the prelude, which is the gambit root's own position.
 *
 * An entry whose wire shape carries no prelude — a truncated or doctored response, since the
 * build always emits one — reads as 0, and the whole walk degrades to exactly the behaviour
 * this page had before the prelude existed. A missing board costs the walk, never the page.
 */
const rootIndex = (entry: CompiledEntry): number => Math.max(entry.prelude.length - 1, 0)

/**
 * Whether the URL puts the learner inside the defining line, before the root.
 *
 * **`line` wins.** A URL asking for plies is asking for a position past the root, so a
 * `prelude` beside it is contradictory and is dropped. This is the rule AC 3 rests on: a
 * link published before `?prelude=` existed cannot carry one, so a link with plies resolves
 * through `resolvePath` alone — the same function, the same arguments, the same node — and a
 * link without plies resolves to the root, as it always has.
 *
 * The test is on the plies the URL *asked for*, not on the ones that resolved. A stale link
 * to a branch that has been renamed asks for a tree position and gets the nearest one, which
 * is what `strayedAt` already reports; dropping such a learner into the opening instead
 * would answer "that branch is gone" with "here is move one", which is a worse answer and a
 * different one from the one this page has always given.
 *
 * Exported because `GambitTree` needs the same answer and must not compute it a second way:
 * two readers of the URL that disagree is the defect `LearningSurface` keeps the `line`
 * parameter as a single source of truth to avoid.
 */
export const inPreludeAt = (
  entry: CompiledEntry,
  prelude: number | null,
  requested: readonly string[],
): prelude is number => requested.length === 0 && prelude !== null && prelude < rootIndex(entry)

export const walkEntry = (
  entry: CompiledEntry,
  /** The `prelude` count the URL asked for, or null when it is absent or unreadable. */
  prelude: number | null,
  /** The plies the URL asked for, already shape-checked by `parseLine`. */
  requested: readonly string[],
): Walk => {
  const resolved = resolvePath(entry.tree, requested)
  const { path, steps: treeSteps } = resolved

  const lastIndex = rootIndex(entry)
  const inPrelude = inPreludeAt(entry, prelude, requested)

  const preludeSteps: readonly WalkStep[] = entry.prelude.flatMap((step, index) =>
    step.ply === undefined
      ? []
      : [
          {
            ply: step.ply,
            fen: step.fen,
            address: preludeAddress(index, lastIndex),
            inPrelude: true,
          },
        ],
  )

  const start: Address = preludeAddress(0, lastIndex)

  if (inPrelude) {
    // Clamped by `inPrelude` above, so this index is inside the array. `?? entry.tree.fen`
    // is the total-function fallback and not a claim: `noUncheckedIndexedAccess` is on, and
    // an unreachable branch is still a branch that has to return a board.
    const step = entry.prelude[prelude]
    const fen = step?.fen ?? entry.tree.fen

    return {
      fen,
      here: preludeAddress(prelude, lastIndex),
      previousFen: entry.prelude[prelude - 1]?.fen ?? null,
      ply: step?.ply ?? null,
      node: null,
      resolved,
      steps: preludeSteps.slice(0, prelude),
      previous: prelude === 0 ? null : preludeAddress(prelude - 1, lastIndex),
      next: preludeAddress(prelude + 1, lastIndex),
      start,
      atStart: prelude === 0,
      atRoot: false,
      inPrelude: true,
    }
  }

  const node = resolved.node
  const atRoot = path.length === 0

  /*
   * **The root's arriving ply is now marked, and it used to be deliberately unmarked.**
   *
   * The old reason was that the root is "where the learner arrives, not somewhere they
   * stepped to", so marking the defining line's last ply would point at a move the page had
   * never shown. This ticket is what makes that premise false: the move is now a step the
   * learner can have just taken, and it is in the move list directly above the board either
   * way. Leaving it unmarked would make pressing next into the root the one step in the walk
   * that does not say what changed.
   */
  const previousFen = atRoot
    ? (entry.prelude[lastIndex - 1]?.fen ?? null)
    : (treeSteps[treeSteps.length - 2]?.node.fen ?? entry.tree.fen)

  const lineSteps: readonly WalkStep[] = treeSteps.map((step) => ({
    ply: step.ply,
    fen: step.node.fen,
    address: { at: 'line', path: step.path },
    inPrelude: false,
  }))

  const ahead = nextPath(node, path)
  /*
   * One ply back inside the tree, from the tree half. Null there means the root, which is
   * where the walk crosses into the defining line — so the join is the only thing this
   * module adds, and "one ply back" is still answered where it always was.
   */
  const back = previousPath(path)

  return {
    fen: node.fen,
    here: { at: 'line', path },
    previousFen,
    ply: node.ply ?? entry.prelude[lastIndex]?.ply ?? null,
    node,
    resolved,
    steps: [...preludeSteps, ...lineSteps],
    previous:
      back === null
        ? lastIndex === 0
          ? null
          : preludeAddress(lastIndex - 1, lastIndex)
        : { at: 'line', path: back },
    next: ahead === null ? null : { at: 'line', path: ahead },
    start,
    atStart: false,
    atRoot,
    inPrelude: false,
  }
}
