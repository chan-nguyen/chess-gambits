import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import './catalogue.css'
import { CatalogueFilters } from '../components/catalogue/CatalogueFilters.tsx'
import { CatalogueList } from '../components/catalogue/CatalogueList.tsx'
import { CoverageSummary } from '../components/catalogue/CoverageSummary.tsx'
import {
  applyFilter,
  autoExpandLimit,
  indexCatalogue,
  isNarrowed,
  type CatalogueFilter,
} from '../components/catalogue/filter.ts'
import { readFilter, writeFilter } from '../components/catalogue/filter-url.ts'
import { useCatalogue } from '../components/catalogue/useCatalogue.ts'
import { ContentLoadError } from '../components/content/ContentLoadError.tsx'
import { readProgress, type StoredProgress } from '../components/progress/progress-storage.ts'
import { Translated } from '../i18n/Translated.tsx'
import { useTranslated } from '../i18n/useTranslated.ts'
import { defaultLocale, isLocale } from '../lib/locale.ts'

/**
 * The catalogue (#13, requirements F14 and F15).
 *
 * Seven hundred entries, none of them taught in depth today. Everything on this page is
 * arranged around that fact rather than around the number: the coverage counts are stated
 * before the list, the depth filter starts at Taught, and the breadth of the index is
 * something a visitor asks for rather than something they are dropped into
 * (docs/design-system.md, *The catalogue defaults to depth, not to breadth*).
 *
 * **All filter state is in the URL and nowhere else** (AC 1, §1). There is no `useState`
 * holding a filter here — `readFilter` derives it from the query string on every render
 * and `writeFilter` puts it back — so a filtered view is a link, the back button steps
 * through filters, and the language switcher carries a filter across languages untouched.
 *
 * The page downloads a catalogue **summary**, never content: no entry's tree is fetched
 * here, which is why seven hundred entries cost under 17KB gzipped and why this route adds
 * nothing to the gambit-tree budget (§6, `e2e/catalogue-payload.spec.ts`).
 */
export const CatalogueRoute = () => {
  const { locale } = useParams()
  const safeLocale = locale !== undefined && isLocale(locale) ? locale : defaultLocale

  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.toString()
  const filter = useMemo(() => readFilter(new URLSearchParams(search)), [search])

  const { state, retry } = useCatalogue(safeLocale)
  const translated = useTranslated()

  const catalogue = state.status === 'loaded' ? state.catalogue : null

  /**
   * Folded once per catalogue, not once per keystroke. Folding seven hundred names on
   * every character typed is the difference between a filter that answers instantly and
   * one that does not, and the names do not change between keystrokes.
   */
  const index = useMemo(() => (catalogue === null ? [] : indexCatalogue(catalogue)), [catalogue])
  const result = useMemo(() => applyFilter(index, filter), [index, filter])

  /**
   * Read once, on mount, for the same reason `GambitProgress` reads it once: a card that
   * painted "0 of 12" and corrected itself a frame later would be telling a learner they
   * had lost their progress and then taking it back. A discarded envelope reads as no
   * progress here and the notice that explains it belongs on the gambit page, which is
   * where the marks are made.
   */
  const [progress] = useState<StoredProgress>(() => {
    const read = readProgress()
    return read.status === 'ready' ? read.progress : {}
  })

  /**
   * Typing replaces the history entry; every other control pushes one. Both halves are
   * deliberate. A pushed entry per keystroke means Back has to be pressed twelve times to
   * undo one word, which makes the button useless exactly when a visitor reaches for it;
   * a replaced entry on a discrete choice would make "undo that filter" impossible.
   */
  const apply = (next: CatalogueFilter): void => {
    const onlyQueryChanged =
      next.side === filter.side &&
      next.category === filter.category &&
      next.soundness === filter.soundness &&
      next.tier === filter.tier

    setSearchParams(writeFilter(next), {
      replace: onlyQueryChanged,
      preventScrollReset: true,
    })
  }

  return (
    <main className="catalogue">
      <h1>
        <Translated id="catalogue.heading" />
      </h1>
      <p className="catalogue__intro">
        <Translated id="catalogue.intro" />
      </p>

      {state.status === 'loading' && (
        <p className="catalogue__status" role="status">
          <Translated id="catalogue.loading" />
        </p>
      )}

      {state.status === 'failed' && (
        <ContentLoadError
          what={translated('catalogue.heading').text}
          failure={state.failure}
          onRetry={retry}
          retrying={state.retrying}
        />
      )}

      {catalogue !== null && (
        <>
          <CoverageSummary counts={catalogue.counts} />

          <CatalogueFilters filter={filter} onChange={apply} />

          {/*
           * A live region, so a filter change is announced rather than only seen. It is the
           * one thing on this page that tells a screen-reader user that pressing a radio
           * did anything at all: the list below them changed, and nothing moved their focus.
           */}
          <p className="catalogue__status" role="status">
            <Translated
              id="catalogue.showing"
              values={{ shown: result.entries, total: catalogue.counts.entries }}
            />
          </p>

          {result.entries === 0 ? (
            <div className="catalogue__empty">
              {/*
               * Two different emptinesses. "Nothing matches these filters" is a search that
               * came back empty; "nothing is taught in depth yet" is the state of the whole
               * site today, and telling a visitor the first when the truth is the second
               * would send them off rewording a search term that was never the problem.
               */}
              {filter.tier === 'taught' && catalogue.counts.taught === 0 ? (
                <>
                  <p>
                    <Translated id="catalogue.nothingTaught" />
                  </p>
                  <p>
                    <Link
                      className="catalogue__show-everything"
                      to={{ search: writeFilter({ ...filter, tier: 'all' }).toString() }}
                      preventScrollReset
                    >
                      <Translated id="catalogue.showEverything" />
                    </Link>
                  </p>
                </>
              ) : (
                <p>
                  <Translated id="catalogue.nothingHere" />
                </p>
              )}
            </div>
          ) : (
            <CatalogueList
              locale={safeLocale}
              families={result.families}
              /*
               * Somebody who searched asked to see results, so the matches are shown —
               * up to the point where they stop being results. Past `autoExpandLimit`
               * the families stay grouped, each with its match count on the control that
               * opens it, which is both the faster render and the more useful answer.
               */
              expandByDefault={isNarrowed(filter) && result.entries <= autoExpandLimit}
              progress={progress}
            />
          )}
        </>
      )}
    </main>
  )
}
