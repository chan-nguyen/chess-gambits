import './ContentLoadError.css'
import type { EntryLoadFailure } from '../../lib/content.ts'

/**
 * The designed failure state for anything the browser fetches on demand — a gambit's
 * compiled tree today, a locale bundle next (docs/design-system.md §3, *Lazy-load failure
 * states*).
 *
 * It exists because a lazy boundary without one is a blank screen in production, and this
 * project sends no telemetry anywhere: a blank screen is invisible to the visitor, to the
 * maintainer, and to everyone in between. So the failure is named, it is attributed to the
 * thing that failed, and it offers the one action that can help.
 *
 * It is a **section, not a page**. It replaces the region whose content did not arrive and
 * nothing else, so the header, the footer and the language switcher stay where they were
 * and keep working — a visitor whose connection dropped on one gambit can still change
 * language or walk back to the catalogue.
 *
 * Heading level is `h2`: this sits inside a route that already owns the `h1`
 * (docs/design-system.md §5, "one `h1` per route, no level skipped").
 */

export type ContentLoadErrorProps = {
  /** What did not arrive, in the visitor's words — a gambit name, not a URL. */
  readonly what: string
  readonly failure: EntryLoadFailure
  readonly onRetry: () => void
  readonly retrying?: boolean | undefined
}

/**
 * "Errors are specific" (docs/design-system.md §4). A dropped connection, a link from an
 * older version of the site and a damaged download are three different problems with three
 * different next steps, and collapsing them into "something went wrong" hides all three.
 */
const describe = (what: string, failure: EntryLoadFailure): string => {
  switch (failure.reason) {
    case 'unknown-id':
      return `“${what}” is not an address this site can look up, so nothing was requested.`
    case 'offline':
      return `The site could not be reached, so “${what}” was never downloaded. This usually means the connection dropped.`
    case 'missing':
      return `There is no published file for “${what}”. The link may be from an older version of the site.`
    case 'unavailable':
      return `The site answered with an error (${failure.status}) instead of “${what}”.`
    case 'malformed':
      return `The file for “${what}” arrived damaged, so none of it was used. Showing part of a gambit is worse than showing none.`
  }
}

export const ContentLoadError = ({
  what,
  failure,
  onRetry,
  retrying = false,
}: ContentLoadErrorProps) => (
  <section className="content-load-error" role="alert">
    <h2 className="content-load-error__heading">Could not load {what}</h2>
    <p className="content-load-error__detail">{describe(what, failure)}</p>
    <p className="content-load-error__scope">
      Nothing else on this page is affected — the menu and the language switcher still work.
    </p>
    <button
      type="button"
      className="content-load-error__retry"
      /**
       * `aria-disabled` rather than `disabled`: a disabled button leaves the tab order, so
       * pressing it would throw a keyboard user's focus back to the top of the page at the
       * exact moment they are waiting for something.
       */
      aria-disabled={retrying}
      onClick={() => {
        if (!retrying) onRetry()
      }}
    >
      {retrying ? 'Trying again…' : 'Try again'}
    </button>
  </section>
)
