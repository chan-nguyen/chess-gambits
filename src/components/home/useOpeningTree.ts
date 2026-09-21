import { useEffect, useState } from 'react'
import {
  loadOpeningTree,
  type OpeningTreeLoad,
  type OpeningTreeLoadFailure,
  type OpeningTreeNode,
} from '../../lib/opening-tree.ts'

/**
 * The opening tree, fetched once. A sibling of `useCatalogue.ts`, kept as a separate hook
 * rather than folded into it because the two files are fetched independently (one per
 * locale against one locale-independent file) and only the home page needs this one.
 *
 * Same shape of state for the same reason `useCatalogue` gives: derived from the last
 * settled fetch rather than driven by a separate loading flag, so there is exactly one
 * state that can never disagree with itself for a render.
 */
export type OpeningTreeState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly tree: OpeningTreeNode }
  | {
      readonly status: 'failed'
      readonly failure: OpeningTreeLoadFailure
      readonly retrying: boolean
    }

type Attempted = { readonly attempt: number; readonly load: OpeningTreeLoad }

export const useOpeningTree = (): {
  readonly state: OpeningTreeState
  readonly retry: () => void
} => {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Attempted | null>(null)

  useEffect(() => {
    let live = true
    void loadOpeningTree().then((load) => {
      if (live) setSettled({ attempt, load })
    })
    return () => {
      live = false
    }
  }, [attempt])

  const state: OpeningTreeState =
    settled === null
      ? { status: 'loading' }
      : settled.load.ok
        ? { status: 'loaded', tree: settled.load.tree }
        : {
            status: 'failed',
            failure: settled.load.failure,
            retrying: settled.attempt !== attempt,
          }

  return { state, retry: () => setAttempt((count) => count + 1) }
}
