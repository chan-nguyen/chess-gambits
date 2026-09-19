import type { CompiledEntry, CompiledNode } from '../../lib/content-types.ts'
import { lineSearch } from '../../lib/line.ts'
import { encodeMate } from '../../lib/mate-step.ts'
import { preludeSearch } from '../../lib/prelude.ts'
import { nextPath, previousPath, resolvePath, type ResolvedPath } from './tree-path.ts'

/**
 * One walk from the initial position, through the defining line, into the tree, and — at a
 * proved mate leaf — into and through the mate itself (#70, #121/#122, #123).
 *
 * Before this module a gambit page began at the position *after* the defining line: the
 * Benko opened on `1.d4 Nf6 2.c4 c5 3.d5 b5` already played, and there was no address for
 * `1.d4`. A learner could see what happens once the opening has been reached and never how
 * it is reached, which for an opening trainer is the interesting half missing.
 *
 * **The join is the whole of this module, and it is a join rather than a rewrite.** The
 * tree half is `tree-path.ts`, untouched: `resolvePath`, `nextPath` and `previousPath` still
 * take plies from the gambit root and still mean exactly what `?line=` means. What is added
 * in front of it is the prelude, and past it, at a leaf whose outcome is a proved mate, the
 * mate sequence — each addressed by its own parameter, and one `Address` type so that next
 * and previous can cross both seams without any side knowing where the others begin.
 *
 * **The mate address is modelled on the prelude's, on purpose (#123).** Both are "a FEN with
 * no tree node": a fixed sequence with no siblings and no branch to render, derived rather
 * than authored, walked forward from a fixed point. #121/#122 first gave a mate sequence its
 * own component-local `step` state instead, reasoning that `?line=` already names one
 * position and a second parameter naming "N plies into a mate" would make two things the
 * single source of truth — the same tension `prelude` already resolved by becoming its own
 * `Address` variant rather than a rival to `line`. `docs/CONTEXT.md`'s *Prelude* section
 * carries that reasoning in full; it is not re-derived here.
 *
 * The precedence between the two new parameters is not the same rule twice, though, and
 * `src/lib/mate-step.ts`'s own doc comment works out why: `prelude` sits *behind* the root,
 * so a `line` beside it is contradictory and `line` wins; `mate` sits *forward* of a leaf
 * `line` itself names, so the two are never in conflict — a mate address is `?line=<leaf>` and
 * `&mate=<n>` together, both true at once, and what gets dropped when a `mate` cannot mean
 * anything is worked out here rather than in that module, because only `walk.ts` knows which
 * node `line` resolved to and what it claims.
 *
 * Three consequences are worth stating because acceptance criteria rest on them:
 *
 * - **A prelude position, and a mate-sequence position, have no node** (AC 4, #123). Each is
 *   a FEN and a ply and nothing else, so there are no children to read, and `BranchChoices`,
 *   `PlanChoices` and `OutcomeCard` have nothing to render there. Neither can become a branch
 *   point by accident, because there is no structure at either that could branch.
 * - **Nothing here counts anything** (AC 5). Progress counts root-to-leaf branches in the
 *   tree (`progress/branches.ts`); neither the prelude nor a mate sequence adds a leaf or is
 *   a tree, so the denominator cannot move.
 * - **The mate's FEN comes from the leaf's own `sequenceFens`, never recomputed.** The wire
 *   already carries the position after every ply of the proved line (`content-types.ts`), the
 *   same way `prelude` is shipped rather than replayed in the browser (ADR-0003) — this
 *   module reads an index into an array either way, on both sides of the root.
 */

/**
 * A position, as the URL names it.
 *
 * `prelude` and `line` are mutually exclusive — the prelude ends where `line` begins, so no
 * address needs both. `mate` is different: it never appears alone, only alongside the `line`
 * of the leaf it continues from, which is why the variant below carries that leaf's own path
 * rather than relying on some other `line` written beside it in the URL.
 */
export type Address =
  | { readonly at: 'prelude'; readonly plies: number }
  | { readonly at: 'line'; readonly path: readonly string[] }
  | {
      readonly at: 'mate'
      /** The `line` path of the leaf the proved mate is played from. */
      readonly leaf: readonly string[]
      /** How many plies of that leaf's `sequence` have been played, `1 <= ply <= length`. */
      readonly ply: number
    }

/** The gambit root: no `prelude`, no `line`. The address every published link resolves to. */
export const rootAddress: Address = { at: 'line', path: [] }

/**
 * The query string for an address, `''` at the gambit root where every parameter is noise.
 *
 * A `mate` address writes `line` and `mate` together — the one case where two of these
 * parameters appear in the same URL on purpose (see the module doc above and
 * `src/lib/mate-step.ts`).
 */
export const addressSearch = (address: Address): string => {
  switch (address.at) {
    case 'prelude':
      return preludeSearch(address.plies)
    case 'line':
      return lineSearch(address.path)
    case 'mate': {
      const linePart = lineSearch(address.leaf)
      // `lineSearch` returns `''` only at the gambit root, which cannot itself have proved a
      // mate against no opponent move at all in this catalogue — but if it ever did, `mate`
      // would still need to start the query string rather than follow a `?` that never came.
      return `${linePart}${linePart === '' ? '?' : '&'}${encodeMate(address.ply)}`
    }
  }
}

/**
 * A stable string for an address, for React keys and for "did the position change?".
 *
 * The `p`/`l`/`m` prefixes are what keep `prelude=0`, the root, and a mate address that
 * happens to share a leaf's path all distinct: several of these are empty-ish or share a
 * path, and none of them are the same place.
 */
export const addressKey = (address: Address): string => {
  switch (address.at) {
    case 'prelude':
      return `p${address.plies}`
    case 'line':
      return `l${address.path.join('_')}`
    case 'mate':
      return `m${address.leaf.join('_')}_${address.ply}`
  }
}

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
  /**
   * The `mate` count the URL asked for, or null when it is absent or unreadable
   * (`src/lib/mate-step.ts`). Meaningless anywhere `requested` does not resolve to a leaf
   * whose outcome is a proved mate, which is decided below rather than by the caller.
   */
  mate: number | null,
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

  /**
   * The mate this leaf claims, if any — read once so both branches below agree on it.
   *
   * A node earns a `mate` address purely by carrying `outcome.kind === 'mate'`, regardless
   * of whether `requested` strayed on its way here (AC 4's "nearest valid node" reasoning in
   * `tree-path.ts` already decided *which* node is current; this only asks what that node
   * claims).
   */
  const mateOutcome = node.outcome?.kind === 'mate' ? node.outcome : null
  const sequenceLength = mateOutcome?.sequence.length ?? 0
  /**
   * Bound and dropped here, not in `mate-step.ts` (see that module's doc comment): dropped to
   * `0` — meaning "the leaf's own `line` address, not the mate" — whenever there is no mate
   * to step into, or the URL asked for none, or asked for `0` itself; clamped to
   * `sequenceLength` past the end, the same "past-the-end names the real end" rule
   * `preludeAddress` already applies to a `prelude` longer than the defining line.
   */
  const requestedMatePly =
    mateOutcome === null || mate === null ? 0 : Math.min(Math.max(mate, 0), sequenceLength)

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

  if (mateOutcome !== null && requestedMatePly > 0) {
    const { sequence, sequenceFens } = mateOutcome
    // Both arrays are `sequenceFens.length === sequence.length` by construction
    // (`content-types.ts`), and `requestedMatePly` is clamped to that length above, so every
    // index read here is in bounds; `?? node.fen` is the total-function fallback
    // `noUncheckedIndexedAccess` asks for, not a claim that the wire can be short.
    const mateSteps: readonly WalkStep[] = sequence
      .slice(0, requestedMatePly)
      .map((ply, index) => ({
        ply,
        fen: sequenceFens[index] ?? node.fen,
        address: { at: 'mate', leaf: path, ply: index + 1 },
        inPrelude: false,
      }))

    return {
      fen: sequenceFens[requestedMatePly - 1] ?? node.fen,
      here: { at: 'mate', leaf: path, ply: requestedMatePly },
      previousFen:
        requestedMatePly === 1 ? node.fen : (sequenceFens[requestedMatePly - 2] ?? node.fen),
      ply: sequence[requestedMatePly - 1] ?? null,
      // AC 4, restated for the mate half of the join: the sequence has no node either.
      node: null,
      resolved,
      steps: [...preludeSteps, ...lineSteps, ...mateSteps],
      previous:
        requestedMatePly === 1
          ? { at: 'line', path }
          : { at: 'mate', leaf: path, ply: requestedMatePly - 1 },
      next:
        requestedMatePly < sequenceLength
          ? { at: 'mate', leaf: path, ply: requestedMatePly + 1 }
          : null,
      start,
      atStart: false,
      atRoot: false,
      inPrelude: false,
    }
  }

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
    /*
     * `ahead === null` means this is a leaf — either genuinely (no children) or by AC 4's
     * guard in `branchChoices` (a mate net is never expanded into children). A leaf claiming
     * a proved mate offers its first mate step instead of ending the walk here; every other
     * leaf still ends it, exactly as before #123.
     */
    next:
      ahead === null
        ? mateOutcome === null
          ? null
          : { at: 'mate', leaf: path, ply: 1 }
        : { at: 'line', path: ahead },
    start,
    atStart: false,
    atRoot,
    inPrelude: false,
  }
}
