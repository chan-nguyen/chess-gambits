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

/**
 * The gambit ids that get their own shell.
 *
 * Empty until #12 compiles the catalogue. This constant is the seam: that ticket reads
 * the compiled catalogue and passes the ids to `shellPaths`, and nothing else in this
 * module changes. Emitting a shell per gambit with no code change is requirement F11
 * working as intended.
 */
export const publishedGambitIds: readonly string[] = []

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
