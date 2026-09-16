import { Link, useParams } from 'react-router'
import { defaultLocale, isLocale } from '../lib/locale.ts'
import { routePath, routeSegments } from '../lib/routes.ts'

/** Placeholder: layout and content are #2 and #7. This ticket proves the route resolves. */
export const HomeRoute = () => {
  const { locale } = useParams()
  const safeLocale = locale !== undefined && isLocale(locale) ? locale : defaultLocale

  return (
    <main>
      <h1>Chess Gambit Trainer</h1>
      <p>Learn gambits and opening traps as a branching move tree.</p>
      <nav aria-label="Primary">
        <ul>
          <li>
            <Link to={routePath(safeLocale, routeSegments.catalogue)}>Catalogue</Link>
          </li>
          <li>
            <Link to={routePath(safeLocale, routeSegments.about)}>About</Link>
          </li>
        </ul>
      </nav>
    </main>
  )
}
