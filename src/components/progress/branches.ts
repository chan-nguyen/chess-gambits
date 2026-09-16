import type { CompiledNode } from '../../lib/content-types.ts'
import { encodeLine } from '../../lib/line.ts'

/**
 * What progress counts, and what it refuses to count.
 *
 * **Progress is a count, not a percentage** (docs/design-system.md §3). "12 of 20 branches",
 * never "60%": a percentage *falls* when content improves, so a learner at 100% on the Evans
 * drops to 60% the day three branches are added, with no explanation and no way to tell an
 * improvement from a regression. A count only ever grows, and the denominator growing is
 * itself the news.
 *
 * That only works if the denominator is a number a learner can act on, so two kinds of leaf
 * are excluded. Both exclusions are here, in one function, rather than spread across the
 * component that displays them.
 *
 * Pure, and free of React and of storage: the whole of the counting is here, and the rest of
 * this folder is a control and a place to keep the answer.
 */

/**
 * A branch's identity, and it is deliberately the *same string the URL carries*.
 *
 * `encodeLine` is what `?line=` is built from (`src/lib/line.ts`), so a key in storage is a
 * link a maintainer can paste into the address bar, and there is one canonical spelling of a
 * path rather than two that can disagree. The percent-encoding is noise inside JSON and is
 * accepted for that: `Bxf7+` must survive as `Bxf7%2B` somewhere, and having it survive the
 * same way in both places is worth more than a tidier storage blob.
 */
export const branchKey = (path: readonly string[]): string => encodeLine(path)

const collect = (node: CompiledNode, path: readonly string[], into: string[]): void => {
  /**
   * **The mate-net exclusion (AC 6), and it is this `return` that is the rule.**
   *
   * A leaf carrying a proved mate is one branch — the trap branch, which is the most
   * valuable thing this product teaches and is emphatically counted. What is *not* counted
   * is the generated net that proves it: a net with hundreds of leaves would swamp every
   * authored line and make every real gambit read as 4% complete forever.
   *
   * Today a net cannot reach the browser at all — a certificate is a build input and what
   * ships is the outcome it justifies (`tools/mate/certificate.ts`) — so nothing in the
   * current pipeline can produce the tree this guards against. It is still load-bearing
   * rather than decorative, because `isCompiledEntry` in `src/lib/content.ts` accepts a node
   * carrying *both* an outcome and children: invariant 3 is enforced by the build, not by
   * the wire, and the wire is where this code's input comes from. Stopping at the outcome is
   * what keeps a spliced net out of the denominator whether it arrives by a future compile
   * step or by a doctored response. `branches.test.ts` feeds it exactly that tree.
   */
  if (node.outcome !== undefined) {
    /**
     * `unexplored` is the second exclusion. It means "not mapped yet" — the placeholder that
     * lets half-finished work be committed (`tools/content/types.ts`) — so there is nothing
     * at it to learn and its annotation says so. Counting it would make the denominator a
     * measure of *unwritten* content, and a learner who had learned everything that exists
     * would read "3 of 7" and be unable to tell that from having four branches left. That is
     * the same dishonesty the percentage was rejected for, arriving by the other door.
     */
    if (node.outcome.kind !== 'unexplored') into.push(branchKey(path))
    return
  }

  if (node.children === undefined || node.children.length === 0) {
    // A transposing node is a leaf that carries no outcome (docs/CONTEXT.md, invariant 3),
    // and "this line transposes into the Scotch" is a real thing to have learned.
    if (node.transposesTo !== undefined) into.push(branchKey(path))
    return
  }

  for (const child of node.children) {
    // A child with no ply cannot be addressed by a path, so it cannot be marked or counted.
    // Only the root is allowed to have none, and the root is not a child.
    if (child.ply !== undefined) collect(child, [...path, child.ply], into)
  }
}

/**
 * Every branch of an entry a learner can mark, as path keys, in tree order.
 *
 * A branch is a root-to-leaf line (docs/CONTEXT.md, *Line*), which is what "12 of 20
 * branches" counts and what the marker marks. The empty array is a real answer and the
 * common one today: every published entry is at the *Listed* tier, whose whole tree is one
 * `unexplored` root.
 */
export const countableBranches = (tree: CompiledNode): readonly string[] => {
  const keys: string[] = []
  collect(tree, [], keys)
  return keys
}

/**
 * The numerator, and the reason it is intersected rather than counted directly.
 *
 * Marks outlive the content they were made against. A branch that has been renamed, moved or
 * removed leaves a key in storage that names nothing, and counting those would produce "21 of
 * 20" — a number that is not merely wrong but visibly impossible, on the one display whose
 * entire purpose is to be believed. Counting the *branches that exist* and are marked cannot
 * exceed the denominator by construction.
 */
export const learnedCount = (branches: readonly string[], learned: ReadonlySet<string>): number =>
  branches.filter((key) => learned.has(key)).length
