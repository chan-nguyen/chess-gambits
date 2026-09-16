import { Link, useParams } from 'react-router'
import { defaultLocale, isLocale } from '../lib/locale.ts'
import { routePath, routeSegments } from '../lib/routes.ts'

/**
 * Reached both by an unknown path and by a locale that is not one of the three. A path
 * with no shell is served by `dist/404.html`, so this renders under a genuine HTTP 404
 * rather than under a 200 that lies (ADR-0009).
 */
export const NotFoundRoute = () => {
  const { locale } = useParams()
  const safeLocale = locale !== undefined && isLocale(locale) ? locale : defaultLocale

  return (
    <main>
      <h1>Page not found</h1>
      <p>
        There is nothing at this address. It may have been a typo, or a link that is out of date.
      </p>
      <p>
        <Link to={routePath(safeLocale, routeSegments.catalogue)}>Go to the catalogue</Link>
      </p>
    </main>
  )
}
