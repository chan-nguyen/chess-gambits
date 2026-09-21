import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import './OpeningExplorer.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import type { Catalogue } from '../../lib/catalogue.ts'
import { fullName } from '../../lib/catalogue.ts'
import type { Locale } from '../../lib/locale.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'
import {
  applyFilter,
  autoExpandLimit,
  indexCatalogue,
  type CatalogueFilter,
} from '../catalogue/filter.ts'
import { CatalogueList } from '../catalogue/CatalogueList.tsx'
import { HomeBoard } from './HomeBoard.tsx'
import { checkedKingSquare, gameEnd, replay } from './chess-engine.ts'
import { movesParam, movesSearch, parseMovesShape } from './moves-param.ts'

/**
 * The home page's interactive opening board, and the catalogue narrowed to whatever has
 * been played on it.
 *
 * **All of the played-move state is in the `moves` URL parameter**, following this
 * project's own rule that durable view state is never a bare `useState`
 * (docs/design-system.md §1): the address bar is what a visitor could bookmark or share,
 * and the back button steps through the moves played because it steps through URLs.
 *
 * As of #131, any legal move can be played here, not only one some catalogue entry's own
 * line happens to contain (see `chess-engine.ts` and ADR-0003's amendment for #131). The
 * position is recomputed by replaying the whole `moves` sequence with `chess.js` on every
 * render — cheap even at the catalogue's longest lines, and it is what makes the URL the
 * single source of truth rather than a cache that could disagree with it.
 */
export type OpeningExplorerProps = {
  readonly locale: Locale
  readonly catalogue: Catalogue | null
}

export const OpeningExplorer = ({ locale, catalogue }: OpeningExplorerProps) => {
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const translated = useTranslated()

  const requested = useMemo(
    () => parseMovesShape(searchParams.get(movesParam) ?? ''),
    [searchParams],
  )

  const { chess, plies, lastMove } = useMemo(() => replay(requested), [requested])
  const check = useMemo(() => checkedKingSquare(chess) ?? undefined, [chess])
  const ended = useMemo(() => gameEnd(chess), [chess])

  const goTo = (nextPlies: readonly string[]): void => {
    void navigate({ pathname, search: movesSearch(nextPlies) }, { preventScrollReset: true })
  }

  const commit = (san: string): void => goTo([...plies, san])
  const undo = (): void => goTo(plies.slice(0, -1))
  const reset = (): void => goTo([])

  /** What the board's live region says: the move played, plus how the game ended, if it did. */
  const announcement = useMemo(() => {
    if (lastMove === null) return undefined
    const played = translated('home.movePlayed', { san: lastMove.san }).text
    if (ended === null) return played
    const outcome = translated(
      ended === 'checkmate'
        ? 'home.checkmate'
        : ended === 'stalemate'
          ? 'home.stalemate'
          : 'home.draw',
    ).text
    return `${played} ${outcome}`
  }, [lastMove, ended, translated])

  const index = useMemo(() => (catalogue === null ? [] : indexCatalogue(catalogue)), [catalogue])
  const filter: CatalogueFilter = useMemo(
    () => ({ q: '', side: null, category: null, soundness: null, tier: 'all', movesPrefix: plies }),
    [plies],
  )
  const result = useMemo(() => applyFilter(index, filter), [index, filter])

  /**
   * A hand-off, not another rung of the ladder. With the opening tree gone, "the end of a
   * defining line" no longer exists as a concept the board can ask about — the natural
   * replacement (#131) is the filter narrowing to exactly one entry, regardless of ply
   * depth, since that is the only remaining state where "go read that entry's own page"
   * is the one useful next step.
   *
   * `result.entries === 1` means exactly one family is present with exactly one entry in
   * it — `applyFilter` never keeps a family with zero matches — so this lookup is total,
   * not a guess at index 0 of something that might be empty.
   */
  const singleFamily = result.entries === 1 ? result.families[0] : undefined
  const singleMatch = singleFamily?.entries[0]

  return (
    <section className="opening-explorer" aria-labelledby="opening-explorer-heading">
      <h2 id="opening-explorer-heading">
        <Translated id="home.tryHeading" />
      </h2>
      <p>
        <Translated id="home.tryIntro" />
      </p>

      <div className="opening-explorer__layout">
        <div className="opening-explorer__board">
          <HomeBoard
            chess={chess}
            lastMove={lastMove === null ? undefined : { from: lastMove.from, to: lastMove.to }}
            check={check}
            ended={ended}
            announcement={announcement}
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

          {singleFamily !== undefined && singleMatch !== undefined && (
            <p className="opening-explorer__continue">
              <Link to={routePath(locale, routeSegments.catalogue, singleMatch.entry.id)}>
                <Translated
                  id="home.continueIn"
                  values={{ name: fullName(singleFamily.family, singleMatch.entry) }}
                />
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
