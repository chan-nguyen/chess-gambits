import { useEffect, useState } from 'react'
import {
  loadCatalogue,
  type Catalogue,
  type CatalogueLoad,
  type CatalogueLoadFailure,
} from '../../lib/catalogue.ts'
import type { Locale } from '../../lib/locale.ts'

/**
 * One locale's catalogue, with a retry. Three pages need it and each needs it differently,
 * which is why it is a hook here rather than three copies of the same effect: the catalogue
 * page renders it, the home page reads one entry out of it, and the gambit page consults it
 * only after a content file turns out not to exist.
 *
 * The state is **derived** rather than driven, exactly as `useEntry` derives it in
 * `routes/gambit.tsx`. The only thing stored is the last settled fetch and which request it
 * answered; a separate "loading" flag set from inside an effect would say the same thing in
 * a second place and the two would disagree for one render every time the locale changed —
 * the render that shows one language's catalogue under the other language's heading.
 *
 * `loadCatalogue` returns every failure as a value, so nothing here throws and no promise
 * is thrown at a lazy boundary (docs/design-system.md §3).
 */
export type CatalogueState =
  /** Not asked for. The gambit page is in this state until a content file 404s. */
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly catalogue: Catalogue }
  | {
      readonly status: 'failed'
      readonly failure: CatalogueLoadFailure
      /** A retry in flight. The failure stays on screen so focus stays on the button. */
      readonly retrying: boolean
    }

/** A settled fetch, tagged with what was asked for, so a stale one is recognisable. */
type Attempted = {
  readonly locale: Locale
  readonly attempt: number
  readonly load: CatalogueLoad
}

export const useCatalogue = (
  locale: Locale,
  enabled = true,
): { readonly state: CatalogueState; readonly retry: () => void } => {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Attempted | null>(null)

  useEffect(() => {
    if (!enabled) return

    let live = true
    void loadCatalogue(locale).then((load) => {
      if (live) setSettled({ locale, attempt, load })
    })

    return () => {
      live = false
    }
  }, [locale, attempt, enabled])

  const current = settled !== null && settled.locale === locale ? settled : null

  const state: CatalogueState = !enabled
    ? { status: 'idle' }
    : current === null
      ? { status: 'loading' }
      : current.load.ok
        ? { status: 'loaded', catalogue: current.load.catalogue }
        : {
            status: 'failed',
            failure: current.load.failure,
            retrying: current.attempt !== attempt,
          }

  return { state, retry: () => setAttempt((count) => count + 1) }
}
