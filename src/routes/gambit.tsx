import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import './gambit.css'
import { LearningSurface, PendingPosition } from '../components/learn/LearningSurface.tsx'
import { ContentLoadError } from '../components/content/ContentLoadError.tsx'
import type { CompiledEntry } from '../lib/content-types.ts'
import { loadEntry, type EntryLoad, type EntryLoadFailure } from '../lib/content.ts'
import { describeLineProblem, lineParam, parseLine } from '../lib/line.ts'

/**
 * The learning surface (#8): a position, its annotation, and the controls that step
 * through the line.
 *
 * Two attacker-controlled values arrive here and each is handled at its own boundary
 * (docs/security.md, B4). The `line` parameter is parsed for *shape* by `parseLine` and
 * recovered to the longest prefix that reads as SAN; the plies that survive are then
 * walked against the real tree by `resolvePath`, which recovers again to the nearest node
 * that exists. Neither can throw, and neither produces a blank page — a bad link lands on
 * a real position and says what it could not follow.
 *
 * The id is checked by `loadEntry` before it is put in a request path, so this route never
 * builds a URL out of it itself.
 */

type EntryState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly entry: CompiledEntry }
  | {
      readonly status: 'failed'
      readonly failure: EntryLoadFailure
      /** A retry in flight. The failure stays on screen so focus stays on the button. */
      readonly retrying: boolean
    }

/** A settled fetch, tagged with what was asked for, so a stale one is recognisable. */
type Attempted = {
  readonly id: string
  readonly attempt: number
  readonly load: EntryLoad
}

/**
 * One compiled entry, with a retry.
 *
 * The state is *derived* rather than driven: the only thing stored is the last settled
 * fetch and which request it answered, and everything the page renders follows from
 * comparing that to what is being asked for now. A "loading" flag set from inside an effect
 * would say the same thing in a second place, and the two would disagree for exactly one
 * render every time the id changed — the render where a new gambit is shown under the old
 * gambit's tree.
 */
const useEntry = (
  id: string | undefined,
): { readonly state: EntryState; readonly retry: () => void } => {
  const requested = id ?? ''
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Attempted | null>(null)

  useEffect(() => {
    let live = true

    // `loadEntry` returns every failure as a value, so there is nothing here to catch and
    // no promise a lazy boundary could throw (docs/design-system.md §3).
    void loadEntry(requested).then((load) => {
      if (live) setSettled({ id: requested, attempt, load })
    })

    return () => {
      live = false
    }
  }, [requested, attempt])

  const current = settled !== null && settled.id === requested ? settled : null

  const state: EntryState =
    current === null
      ? { status: 'loading' }
      : current.load.ok
        ? { status: 'loaded', entry: current.load.entry }
        : {
            status: 'failed',
            failure: current.load.failure,
            retrying: current.attempt !== attempt,
          }

  return { state, retry: () => setAttempt((count) => count + 1) }
}

export const GambitRoute = () => {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const raw = searchParams.get(lineParam) ?? ''
  const { plies, problem } = useMemo(() => parseLine(raw), [raw])
  const { state, retry } = useEntry(id)

  const name = state.status === 'loaded' ? state.entry.name : (id ?? '')

  return (
    <main className="gambit">
      <h1>{name}</h1>

      {problem !== null && <p role="alert">{describeLineProblem(problem)}</p>}

      {state.status === 'loading' && <PendingPosition />}

      {state.status === 'failed' && (
        <ContentLoadError
          what={name}
          failure={state.failure}
          onRetry={retry}
          retrying={state.retrying}
        />
      )}

      {state.status === 'loaded' && <LearningSurface entry={state.entry} requested={plies} />}
    </main>
  )
}
