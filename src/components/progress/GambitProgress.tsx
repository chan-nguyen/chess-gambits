import { useEffect, useId, useMemo, useState } from 'react'
import './GambitProgress.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { CompiledEntry } from '../../lib/content-types.ts'
import { resolvePath } from '../learn/tree-path.ts'
import { ProgressMarker } from './ProgressMarker.tsx'
import { branchKey, countableBranches, learnedCount } from './branches.ts'
import { readProgress, writeProgress, type StoredProgress } from './progress-storage.ts'

/**
 * One gambit's progress: how much of it is learned, and the control that changes that.
 *
 * **A count, never a percentage** (docs/design-system.md §3, AC 5). "12 of 20 branches" only
 * ever grows; the denominator growing is itself the news. A percentage falls when content
 * improves, so a learner at 100% on the Evans drops to 60% the day three branches are added,
 * with no explanation and no way to tell an improvement from a regression.
 *
 * It takes the same two inputs the learning surface does — the entry and the plies the URL
 * asked for — and resolves the path itself rather than being handed a node. That is what
 * lets it mount beside the surface instead of inside it: the `line` parameter is the single
 * source of truth for where the learner is, so two readers of it cannot disagree, and this
 * component has no opinion about how the surface is built.
 *
 * Nothing here is sent anywhere. There is no request in this file, no request in anything it
 * imports, and `e2e/progress.spec.ts` records the wire while a branch is marked and requires
 * it to be empty — requirement N8, and progress is the one feature that would tempt a sync.
 */
export type GambitProgressProps = {
  readonly entry: CompiledEntry
  /** The plies the URL asked for. Already shape-checked by `parseLine`. */
  readonly requested: readonly string[]
}

export const GambitProgress = ({ entry, requested }: GambitProgressProps) => {
  const headingId = useId()

  /**
   * Read once, on mount. `useState`'s lazy initialiser rather than an effect, because the
   * first render must already know: a count that painted "0 of 20" and corrected itself to
   * "12 of 20" a frame later would be telling the learner they had lost their progress and
   * then taking it back.
   */
  const [initial] = useState(readProgress)
  const [stored, setStored] = useState<StoredProgress>(
    initial.status === 'ready' ? initial.progress : {},
  )

  /**
   * AC 4, the other half. The notice below says the data was discarded, and this is what
   * makes that true rather than a figure of speech: the unreadable envelope is replaced with
   * an empty one at the version this code writes.
   *
   * It could instead be left in place and ignored, which would be less code and would show
   * the same notice on every page load for the rest of the visitor's life. Discarding it
   * once, and saying so once, is what the criterion asks for.
   */
  useEffect(() => {
    if (initial.status === 'discarded') writeProgress({})
  }, [initial])

  const branches = useMemo(() => countableBranches(entry.tree), [entry.tree])
  const learned = useMemo(() => new Set<string>(stored[entry.id] ?? []), [stored, entry.id])

  /**
   * Resolved against the real tree rather than taken from the URL, so a stale link that
   * recovered to the nearest valid node marks *that* node. Marking the branch a learner is
   * not looking at is the one bug this line exists to prevent.
   */
  const { path } = useMemo(() => resolvePath(entry.tree, requested), [entry.tree, requested])
  const here = branchKey(path)
  const markable = branches.includes(here)

  const change = (marked: boolean): void => {
    const next = new Set(learned)
    if (marked) next.add(here)
    else next.delete(here)

    // Every gambit's marks live in one envelope, so the other entries are carried through
    // rather than read back and merged: there is no second writer to race with.
    const updated: StoredProgress = { ...stored, [entry.id]: [...next] }
    setStored(updated)
    writeProgress(updated)
  }

  return (
    <section className="gambit-progress" aria-labelledby={headingId}>
      {/*
       * A labelled `region` landmark rather than a heading, and that is a concession rather
       * than a preference. A titled panel wants an `h2`, the page has room for one — `h1` is
       * the gambit's name and `h2` is the annotation — and adding one here makes
       * `getByRole('heading', { level: 2 })` ambiguous in `LearningSurface.test.tsx`, a file
       * #9 is changing in parallel. Ten of that file's tests use it, and breaking a parallel
       * ticket's suite to improve this panel's markup is a poor trade for something a
       * landmark already provides: with an accessible name the section is reachable by
       * landmark navigation, and the title stays visible. Worth revisiting once #9 lands and
       * its query can name the heading it means.
       */}
      <p className="gambit-progress__heading" id={headingId}>
        <Translated id="progress.heading" />
      </p>

      {initial.status === 'discarded' && (
        <p className="gambit-progress__notice" role="status">
          <Translated id="progress.versionDiscarded" />
        </p>
      )}

      {branches.length === 0 ? (
        /*
         * The empty state, and it is the state of every entry on the site today: a Tier 0
         * entry's whole tree is one unexplored root, and there is nothing in it to have
         * learned. Saying so is better than "0 of 0", which reads like a defect.
         */
        <p className="gambit-progress__empty">
          <Translated id="progress.nothingToMark" />
        </p>
      ) : (
        <>
          <p className="gambit-progress__count">
            <Translated
              id="progress.count"
              values={{ learned: learnedCount(branches, learned), total: branches.length }}
            />
          </p>

          {markable ? (
            /*
             * Keyed by the branch, so navigating to another one remounts the marker and
             * drops an undo offer that no longer refers to anything on the screen.
             */
            <ProgressMarker key={here} marked={learned.has(here)} onChange={change} />
          ) : (
            /*
             * Mid-line, or at a stub that is not mapped yet. The control's absence is
             * explained rather than left to be noticed: a disabled control here would be a
             * thing to try, and there is nothing to try.
             */
            <p className="gambit-progress__hint">
              <Translated id="progress.atBranchEnd" />
            </p>
          )}
        </>
      )}
    </section>
  )
}
