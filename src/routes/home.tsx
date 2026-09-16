import { Link, useParams } from 'react-router'
import './home.css'
import { aboutAnchors } from '../components/catalogue/about-anchors.ts'
import { useCatalogue } from '../components/catalogue/useCatalogue.ts'
import { Translated } from '../i18n/Translated.tsx'
import { firstTaught, fullName } from '../lib/catalogue.ts'
import { defaultLocale, isLocale } from '../lib/locale.ts'
import { routePath, routeSegments } from '../lib/routes.ts'

/**
 * The home page. **It routes to a taught entry, never to the raw catalogue** (#13's AC 7,
 * docs/design-system.md, *The catalogue defaults to depth, not to breadth*).
 *
 * That is the whole reason this page fetches anything. Dropping a first-time visitor into
 * seven hundred rows, of which none is a lesson, is the failure this product was designed
 * against — so the one destination offered here is a gambit that is actually taught, and
 * which one that is has to come from the catalogue rather than from a name written down in
 * this file. A committed constant would be a second source of truth for which entries are
 * taught, and it would be wrong the first time content changed without it.
 *
 * Today there is no taught entry in any locale, so what this page shows is the honest
 * version of that: it says so, and offers the index to anyone who wants it anyway. The
 * link appears on its own the day content earns it.
 *
 * The fetch is not on the critical path. The site name, the tagline and the explanation
 * render from the shell, so LCP is unaffected (§6) and the catalogue arrives afterwards to
 * fill in one link. "Chess Gambit Trainer" is not translated, for the reason `Header`
 * gives: it is the site's name.
 *
 * **A catalogue that never arrives is not reported here**, and that is a decision rather
 * than an omission. This page has no region that failed — it has a sentence it could not
 * add — and an error banner over the one paragraph explaining what the site *is* would
 * make a first visit read as a broken product because of a link that was going to say
 * "nothing is taught yet" anyway. The visitor still has the catalogue link, and the
 * catalogue page names the failure and offers the retry, which is where a retry can do
 * something.
 */
export const HomeRoute = () => {
  const { locale } = useParams()
  const safeLocale = locale !== undefined && isLocale(locale) ? locale : defaultLocale

  const { state } = useCatalogue(safeLocale)
  const taught = state.status === 'loaded' ? firstTaught(state.catalogue) : null

  return (
    <main className="home">
      <h1>Chess Gambit Trainer</h1>
      <p className="home__tagline">
        <Translated id="home.tagline" />
      </p>
      <p>
        <Translated id="home.intro" />
      </p>

      {taught !== null && (
        <>
          <h2>
            <Translated id="home.startHere" />
          </h2>
          {/*
           * The gambit's own name is the link text. "Start here" is the heading above it,
           * because a link that reads "start here" tells a screen-reader user running
           * through the page's links nothing about where it goes.
           */}
          <p className="home__start">
            <Link to={routePath(safeLocale, routeSegments.catalogue, taught.entry.id)}>
              {fullName(taught.family, taught.entry)}
            </Link>
          </p>
        </>
      )}

      {/*
       * Shown only once the catalogue has actually answered. Saying "nothing is taught
       * yet" while the file is still in flight would be stating as fact something this
       * page does not know, and would then take it back a moment later.
       */}
      {state.status === 'loaded' && taught === null && (
        <p className="home__nothing-taught">
          <Translated id="home.nothingTaughtYet" />
        </p>
      )}

      <p>
        <Link to={routePath(safeLocale, routeSegments.catalogue)}>
          <Translated id="home.browseCatalogue" />
        </Link>
      </p>
      <p>
        <Link
          to={{
            pathname: routePath(safeLocale, routeSegments.about),
            hash: `#${aboutAnchors.tiers}`,
          }}
        >
          <Translated id="home.whatTiersMean" />
        </Link>
      </p>
    </main>
  )
}
