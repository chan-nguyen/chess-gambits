import { Link } from 'react-router'
import './EmptyTree.css'
import { Translated } from '../../i18n/Translated.tsx'
import { findEntry, type CatalogueLookup } from '../../lib/catalogue.ts'
import type { Locale } from '../../lib/locale.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'
import { ContentLoadError } from '../content/ContentLoadError.tsx'
import { numberedPlies } from './defining-line.ts'
import { SoundnessBadge, TierBadge } from './Badges.tsx'
import type { CatalogueState } from './useCatalogue.ts'

/**
 * The Tier 0 state (requirement F15, AC 8): **never an empty tree, never a spinner, never
 * a 404.**
 *
 * Six hundred and ninety-nine of this site's seven hundred entries have no content file at
 * all, so this is not an edge case — it is the state a visitor who searched for a gambit
 * they know will almost certainly land in. What it shows is everything the catalogue
 * actually has: the name, the ECO code, the side, the soundness label and the moves that
 * define the line. What it does not do is dress that up as a lesson.
 *
 * The identity is worth a page on its own. "This gambit exists, here is what it is called
 * and how it starts, and nobody has written the tree yet" is a true and useful answer; an
 * error page for the same fact would be a lie about whose failure it was.
 */

export type EmptyTreeProps = {
  readonly locale: Locale
  readonly listed: CatalogueLookup
}

export const EmptyTree = ({ locale, listed }: EmptyTreeProps) => (
  <section className="empty-tree">
    <h2 className="empty-tree__heading">
      <Translated id="emptyTree.notTaught" />
    </h2>

    <p className="empty-tree__badges">
      <SoundnessBadge locale={locale} soundness={listed.entry.soundness} />
      <TierBadge locale={locale} tier={listed.entry.tier} />
    </p>

    <p className="empty-tree__facts">
      <span className="empty-tree__eco">
        <span className="visually-hidden">
          <Translated id="catalogue.eco" />{' '}
        </span>
        {listed.entry.eco}
      </span>
      <span>
        <Translated id={listed.entry.side === 'white' ? 'catalogue.white' : 'catalogue.black'} />
      </span>
    </p>

    <h3 className="empty-tree__line-heading">
      <Translated id="emptyTree.definingLine" />
    </h3>
    <ol className="empty-tree__line">
      {numberedPlies(listed.entry.line).map((label) => (
        <li key={label}>{label}</li>
      ))}
    </ol>

    <p>
      <Translated id="emptyTree.explain" />
    </p>

    <p className="empty-tree__back">
      <Link to={routePath(locale, routeSegments.catalogue)}>
        <Translated id="emptyTree.backToCatalogue" />
      </Link>
    </p>
  </section>
)

export type NotTaughtYetProps = {
  readonly locale: Locale
  /** The id from the URL. Echoed back only when the catalogue does not know it. */
  readonly id: string
  readonly state: CatalogueState
  readonly onRetry: () => void
}

/**
 * What the gambit page shows once a content file turns out not to exist.
 *
 * A missing content file means one of two things and the content directory cannot say
 * which: the entry is listed and has no tree yet, or the id is not an entry at all. The
 * catalogue is the only thing that can tell them apart, so it is consulted *here* — on the
 * failure path — rather than downloaded on every gambit page for a question almost nobody
 * asks (§6: the catalogue is not on the learning surface's critical path).
 *
 * An unknown id is reported with **the id echoed back**, which is what the failure-states
 * table asks for: a stale shared link is only diagnosable if the reader can see what was
 * asked for. Nothing is interpolated into markup — it is text in a translated sentence.
 */
export const NotTaughtYet = ({ locale, id, state, onRetry }: NotTaughtYetProps) => {
  if (state.status === 'failed') {
    return (
      <ContentLoadError
        what={id}
        failure={state.failure}
        onRetry={onRetry}
        retrying={state.retrying}
      />
    )
  }

  if (state.status !== 'loaded') {
    /*
     * The one moment this page shows something transient, and it is a sentence rather than
     * a spinner: it says which lookup is in flight, so a visitor whose connection is slow
     * knows the page is doing something specific rather than hanging.
     */
    return (
      <p className="empty-tree__status" role="status">
        <Translated id="emptyTree.loading" />
      </p>
    )
  }

  const listed = findEntry(state.catalogue, id)

  if (listed === null) {
    return (
      <section className="empty-tree" role="alert">
        <h2 className="empty-tree__heading">
          <Translated id="emptyTree.unknown" values={{ id }} />
        </h2>
        <p className="empty-tree__back">
          <Link to={routePath(locale, routeSegments.catalogue)}>
            <Translated id="emptyTree.backToCatalogue" />
          </Link>
        </p>
      </section>
    )
  }

  return <EmptyTree locale={locale} listed={listed} />
}
