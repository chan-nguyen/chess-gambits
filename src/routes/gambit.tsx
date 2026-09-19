import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import './gambit.css'
import { NotTaughtYet } from '../components/catalogue/EmptyTree.tsx'
import { useCatalogue } from '../components/catalogue/useCatalogue.ts'
import { LearningSurface, PendingPosition } from '../components/learn/LearningSurface.tsx'
import { GambitTree } from '../components/learn/GambitTree.tsx'
import { inPreludeAt } from '../components/learn/walk.ts'
import { GambitProgress } from '../components/progress/GambitProgress.tsx'
import { ContentLoadError } from '../components/content/ContentLoadError.tsx'
import { findEntry, fullName } from '../lib/catalogue.ts'
import type { CompiledEntry } from '../lib/content-types.ts'
import { loadEntry, type EntryLoad, type EntryLoadFailure } from '../lib/content.ts'
import { describeLineProblem, lineParam, parseLine } from '../lib/line.ts'
import { describeMateProblem, mateParam, parseMate } from '../lib/mate-step.ts'
import { describePreludeProblem, parsePrelude, preludeParam } from '../lib/prelude.ts'
import { defaultLocale, isLocale } from '../lib/locale.ts'

/**
 * The learning surface (#8): a position, its annotation, and the controls that step
 * through the line.
 *
 * Three attacker-controlled values arrive here and each is handled at its own boundary
 * (docs/security.md, B4). The `line` parameter is parsed for *shape* by `parseLine` and
 * recovered to the longest prefix that reads as SAN; the plies that survive are then
 * walked against the real tree by `resolvePath`, which recovers again to the nearest node
 * that exists. The `prelude` parameter (#70) is parsed for shape by `parsePrelude` — a
 * bounded whole number and nothing else — and clamped against the entry's own defining line
 * by `walkEntry`. Neither can throw, and neither produces a blank page: a bad link lands on
 * a real position and says what it could not follow.
 *
 * The `mate` parameter (#123) is parsed for shape the same way `prelude` is — a bounded whole
 * number and nothing else — but what it *means* cannot be decided here: only `walkEntry`
 * knows whether `line` resolved to a leaf that claims a proved mate, so this route hands the
 * raw parsed count through and lets `walkEntry` decide whether it names anything at all
 * (`src/lib/mate-step.ts`).
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
  const { id, locale } = useParams()
  const safeLocale = locale !== undefined && isLocale(locale) ? locale : defaultLocale
  const [searchParams] = useSearchParams()
  const raw = searchParams.get(lineParam) ?? ''
  const { plies, problem } = useMemo(() => parseLine(raw), [raw])
  const rawPrelude = searchParams.get(preludeParam) ?? ''
  const { plies: prelude, problem: preludeProblem } = useMemo(
    () => parsePrelude(rawPrelude),
    [rawPrelude],
  )
  const rawMate = searchParams.get(mateParam) ?? ''
  const { ply: mate, problem: mateProblem } = useMemo(() => parseMate(rawMate), [rawMate])
  const { state, retry } = useEntry(id)

  /**
   * **A missing content file is not an error here** (requirement F15, #13's AC 8). Six
   * hundred and ninety-nine of this site's seven hundred entries are listed and have no
   * tree yet, so a 404 from the content directory is the *ordinary* case and the page it
   * deserves is the one that shows what the catalogue does know.
   *
   * The catalogue is fetched only in that case. It is not on the learning surface's
   * critical path (§6) and a taught gambit must not pay for a lookup it never needs.
   * Every other failure — offline, a damaged file, an error status — is still a failure
   * and still reaches `ContentLoadError`.
   */
  const notPublished = state.status === 'failed' && state.failure.reason === 'missing'
  const { state: catalogueState, retry: retryCatalogue } = useCatalogue(safeLocale, notPublished)

  const listed =
    catalogueState.status === 'loaded' && id !== undefined
      ? findEntry(catalogueState.catalogue, id)
      : null

  const name =
    state.status === 'loaded'
      ? state.entry.name
      : listed !== null
        ? fullName(listed.family, listed.entry)
        : (id ?? '')

  return (
    <main className="gambit">
      <h1>{name}</h1>

      {problem !== null && <p role="alert">{describeLineProblem(problem)}</p>}

      {preludeProblem !== null && <p role="alert">{describePreludeProblem(preludeProblem)}</p>}

      {mateProblem !== null && <p role="alert">{describeMateProblem(mateProblem)}</p>}

      {state.status === 'loading' && <PendingPosition />}

      {state.status === 'failed' &&
        (notPublished ? (
          <NotTaughtYet
            locale={safeLocale}
            id={id ?? ''}
            state={catalogueState}
            onRetry={retryCatalogue}
          />
        ) : (
          <ContentLoadError
            what={name}
            failure={state.failure}
            onRetry={retry}
            retrying={state.retrying}
          />
        ))}

      {state.status === 'loaded' && (
        <>
          <LearningSurface entry={state.entry} requested={plies} prelude={prelude} mate={mate} />
          {/*
           * #14's mount point, and it is here rather than inside the surface for two
           * reasons. The surface belongs to #9 and is being changed in parallel, and this
           * needs nothing from it: the entry and the plies are the same two values the
           * surface receives, and `GambitProgress` resolves the path itself. It sits
           * **after** the surface because §1 requires the board and the previous/next
           * controls to be visible together without scrolling at every width, and anything
           * inserted above them is what pushes them apart on a 360px phone.
           */}
          <GambitProgress entry={state.entry} requested={plies} />
          {/*
           * #10's tree, a sibling rather than a third region inside the surface: from
           * 1024px the surface is itself a two-column grid, so a region nested in it would
           * land in one column instead of spanning the width §1 asks for.
           */}
          <GambitTree
            entry={state.entry}
            requested={plies}
            inPrelude={inPreludeAt(state.entry, prelude, plies)}
          />
        </>
      )}
    </main>
  )
}
