import { type RouteObject } from 'react-router'
import { AppShell } from './components/layout/AppShell.tsx'
import { gambitIdParam, routeSegments } from './lib/routes.ts'
import { AboutRoute } from './routes/about.tsx'
import { CatalogueRoute } from './routes/catalogue.tsx'
import { GambitRoute } from './routes/gambit.tsx'
import { HomeRoute } from './routes/home.tsx'
import { LocaleLayout } from './routes/locale-layout.tsx'
import { LocaleRedirect } from './routes/locale-redirect.tsx'
import { NotFoundRoute } from './routes/not-found.tsx'
import { RouteErrorRoute } from './routes/route-error.tsx'

/**
 * The route tree. Paths come from `lib/routes.ts` so that the router and the shell
 * generator cannot disagree about what exists — a disagreement would 404 on the host
 * while passing every test here.
 *
 * Exported as plain route objects rather than as a router so that tests can mount the
 * same tree in memory and the browser entry point can add the base path.
 */
export const routes: RouteObject[] = [
  {
    // The shell #2 supplies: header, content, footer. Every route renders inside it, and
    // the error element deliberately does not — a shell that threw cannot be trusted to
    // frame the report of its own failure.
    element: <AppShell />,
    errorElement: <RouteErrorRoute />,
    children: [
      { path: '/', element: <LocaleRedirect /> },
      {
        path: '/:locale',
        element: <LocaleLayout />,
        children: [
          { index: true, element: <HomeRoute /> },
          { path: routeSegments.catalogue, element: <CatalogueRoute /> },
          { path: `${routeSegments.catalogue}/:${gambitIdParam}`, element: <GambitRoute /> },
          { path: routeSegments.about, element: <AboutRoute /> },
        ],
      },
      { path: '*', element: <NotFoundRoute /> },
    ],
  },
]
