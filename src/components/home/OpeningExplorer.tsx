import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import './OpeningExplorer.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import type { Catalogue } from '../../lib/catalogue.ts'
import { fullName } from '../../lib/catalogue.ts'
import type { Locale } from '../../lib/locale.ts'
import { walkOpeningTree } from '../../lib/opening-tree.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'
import {
  applyFilter,
  autoExpandLimit,
  indexCatalogue,
  type CatalogueFilter,
} from '../catalogue/filter.ts'
import { CatalogueList } from '../catalogue/CatalogueList.tsx'
import { isSquare } from './board-square.ts'
import { HomeBoard } from './HomeBoard.tsx'
import { movesParam, movesSearch, parseMovesShape } from './moves-param.ts'
import { useOpeningTree } from './useOpeningTree.ts'

/**
 * The home page's interactive opening board, and the catalogue narrowed to whatever has
 * been played on it (issue #129).
 *
 * **All of the played-move state is in the `moves` URL parameter**, following this
 * project's own rule that durable view state is never a bare `useState`
 * (docs/design-system.md §1): the address bar is what a visitor could bookmark or share,
 * and the back button steps through the moves played because it steps through URLs. The
 * catalogue filter is built directly from that state and applied here, deliberately not
 * routed through `filter-url.ts`, which owns the `/gambits` route's own, different filter
 * state (issue #129's own design section explains why the two must not share a module).
 */
export type OpeningExplorerProps = {
  readonly locale: Locale
  readonly catalogue: Catalogue | null
}

export const OpeningExplorer = ({ locale, catalogue }: OpeningExplorerProps) => {
  const { state, retry } = useOpeningTree()
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const translated = useTranslated()
  const retrying = state.status === 'failed' && state.retrying

  const requested = useMemo(
    () => parseMovesShape(searchParams.get(movesParam) ?? ''),
    [searchParams],
  )

  const tree = state.status === 'loaded' ? state.tree : null
  const walk = useMemo(
    () => (tree === null ? null : walkOpeningTree(tree, requested)),
    [tree, requested],
  )
  const plies = useMemo(() => walk?.plies ?? [], [walk])

  const goTo = (nextPlies: readonly string[]): void => {
    void navigate({ pathname, search: movesSearch(nextPlies) }, { preventScrollReset: true })
  }

  const commit = (san: string): void => goTo([...plies, san])
  const undo = (): void => goTo(plies.slice(0, -1))
  const reset = (): void => goTo([])

  /** The move that produced the current node, its from/to, and the announcement for it. */
  const lastEdge = useMemo(() => {
    if (tree === null || plies.length === 0) return null
    let node = tree
    let edge = null
    for (const ply of plies) {
      const child = node.children.find((candidate) => candidate.san === ply)
      if (child === undefined) return null
      edge = child
      node = child.node
    }
    return edge
  }, [tree, plies])

  const index = useMemo(() => (catalogue === null ? [] : indexCatalogue(catalogue)), [catalogue])
  const filter: CatalogueFilter = useMemo(
    () => ({ q: '', side: null, category: null, soundness: null, tier: 'all', movesPrefix: plies }),
    [plies],
  )
  const result = useMemo(() => applyFilter(index, filter), [index, filter])

  /*
   * A hand-off, not another rung of the ladder (issue #129's own design section). The
   * opening tree only ever covers *defining* lines, so once a node has no further
   * children, every match left is an entry whose whole defining line has just been played
   * in full — there is nowhere further for this board's own data to take a learner, and
   * each match's own page is where its tree continues.
   */
  const atLeaf = walk !== null && walk.node.children.length === 0 && plies.length > 0

  return (
    <section className="opening-explorer" aria-labelledby="opening-explorer-heading">
      <h2 id="opening-explorer-heading">
        <Translated id="home.tryHeading" />
      </h2>
      <p>
        <Translated id="home.tryIntro" />
      </p>

      {state.status === 'loading' && (
        <p className="opening-explorer__status" role="status">
          <Translated id="home.boardLoading" />
        </p>
      )}

      {/*
       * Quiet, like every other fetch failure on this route (`HomeRoute`'s own docblock):
       * nothing here failed to *render* and an alert banner over a "try a move" invitation
       * would read as a broken product on a first visit. `ContentLoadError` is not reused
       * here for exactly that reason — its `role="alert"` is right for the catalogue and
       * gambit pages, where the failure is the whole point of the screen, and wrong for a
       * home-page extra that the rest of the page works fine without.
       */}
      {state.status === 'failed' && (
        <p className="opening-explorer__status">
          <Translated id="home.boardUnavailable" />{' '}
          <button type="button" onClick={retry} disabled={retrying}>
            <Translated id={retrying ? 'home.retrying' : 'home.retry'} />
          </button>
        </p>
      )}

      {tree !== null && walk !== null && (
        <div className="opening-explorer__layout">
          <div className="opening-explorer__board">
            <HomeBoard
              node={walk.node}
              lastMove={
                lastEdge !== null && isSquare(lastEdge.from) && isSquare(lastEdge.to)
                  ? { from: lastEdge.from, to: lastEdge.to }
                  : undefined
              }
              announcement={
                lastEdge === null
                  ? undefined
                  : translated('home.movePlayed', { san: lastEdge.san }).text
              }
              onCommit={commit}
            />

            <p className="opening-explorer__controls">
              <button type="button" onClick={undo} disabled={plies.length === 0}>
                <Translated id="home.undo" />
              </button>
              <button type="button" onClick={reset} disabled={plies.length === 0}>
                <Translated id="home.reset" />
              </button>
            </p>
          </div>

          <div className="opening-explorer__matches">
            {/*
             * Nothing to narrow yet: every published entry matches an empty prefix, and
             * seven hundred cards is the exact "graveyard" `CatalogueList`'s own docblock
             * warns against — this is an invitation to play a move, not the full index
             * again (that already has its own page, linked from this one).
             */}
            {plies.length === 0 ? (
              <p className="opening-explorer__status">
                <Translated id="home.playToFilter" />
              </p>
            ) : (
              <>
                <p className="opening-explorer__status" role="status">
                  <Translated id="home.matchCount" values={{ count: result.entries }} />
                </p>

                {result.entries === 0 ? (
                  <p>
                    <Translated id="home.noMatch" />
                  </p>
                ) : (
                  <CatalogueList
                    locale={locale}
                    families={result.families}
                    // A move was just played, which is asking to see what it matches — the
                    // same reasoning `CatalogueRoute` applies to a search term, capped at
                    // the same measured threshold so a very early, very wide prefix (a
                    // single opening move) does not repaint hundreds of cards at once.
                    expandByDefault={result.entries <= autoExpandLimit}
                    progress={{}}
                  />
                )}
              </>
            )}

            {atLeaf &&
              result.families.flatMap((family) =>
                family.entries.map((indexed) => (
                  <p key={indexed.entry.id} className="opening-explorer__continue">
                    <Link to={routePath(locale, routeSegments.catalogue, indexed.entry.id)}>
                      <Translated
                        id="home.continueIn"
                        values={{ name: fullName(family.family, indexed.entry) }}
                      />
                    </Link>
                  </p>
                )),
              )}
          </div>
        </div>
      )}
    </section>
  )
}
