import { locales } from './locale.ts'

/**
 * The route inventory, in one place, because two things have to agree about it: the
 * router that matches a URL in the browser, and the build script that emits a pre-built
 * shell at every one of those paths (ADR-0009). If those two lists ever drift, a deep
 * link 404s on the host while passing every unit test — which is the failure this ticket
 * exists to make impossible.
 *
 * Kept free of browser APIs so the Node build script can import it.
 */

/** Path segments, so the router and the shell generator spell them identically. */
export const routeSegments = {
  catalogue: 'gambits',
  about: 'about',
} as const

/** The dynamic segment of the gambit route, as the router names it. */
export const gambitIdParam = 'id'

/** Locale-relative paths of the routes that exist without any content. */
const staticRoutePaths: readonly string[] = ['', routeSegments.catalogue, routeSegments.about]

/*
 * Module prose rather than a doc comment, because it documents the *absence* of a symbol
 * and a `/**` block with no declaration under it is shown for whatever happens to follow.
 *
 * The gambit ids that get their own shell arrive as an argument to `shellPaths`, and they
 * are read off the built catalogue by `scripts/generate-shells.ts`.
 *
 * This used to be an empty constant waiting for #12 to fill it. A constant was the wrong
 * seam: 1,003 ids are generated data, so a committed copy of them would be a second source
 * of truth for which URLs exist, kept in step by hand and wrong the first time it was not.
 * The list the browser downloads is the list that gets shells, which is the only version
 * of that rule that cannot drift.
 *
 * Nothing in the browser needs the list — the router matches `:id` — so it is not in the
 * bundle at all.
 */

/** A site-relative path, without the base path. `routePath('vi')` is the locale home. */
export const routePath = (locale: string, ...segments: readonly string[]): string =>
  segments.length === 0 ? `/${locale}/` : `/${locale}/${segments.join('/')}`

/**
 * Every directory that needs an `index.html` shell, relative to the output root. The
 * site root is excluded: Vite already writes `dist/index.html` there.
 */
export const shellPaths = (gambitIds: readonly string[]): readonly string[] =>
  locales.flatMap((locale) => [
    ...staticRoutePaths.map((path) => (path === '' ? locale : `${locale}/${path}`)),
    ...gambitIds.map((id) => `${locale}/${routeSegments.catalogue}/${id}`),
  ])
