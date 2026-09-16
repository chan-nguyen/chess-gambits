import type { Page } from '@playwright/test'
import { lineSearch } from '../src/lib/line.ts'
import type { CompiledEntry } from '../src/lib/content-types.ts'

/**
 * Serve a compiled entry in place of whatever the page fetches from `content/`.
 *
 * The site publishes exactly one entry today and its tree is a single root node at the
 * *Listed* tier — the right first entry, and nothing to navigate. Authoring a mapped
 * gambit is content work and belongs to whoever writes content, not to the ticket that
 * builds the navigation, so these tests supply their own tree instead. What they do *not*
 * supply is the application: the routing, the loader, the guards in `content.ts`, the
 * rendering and the URL handling are all the shipped ones, and the JSON handed over here
 * is the same shape and the same bytes `tools/content/compile.ts` emits.
 *
 * The id is rewritten to whatever was asked for, because `loadEntry` rejects a file that
 * names a different entry — correctly, since that is a misconfigured host.
 */
export const serveEntry = async (page: Page, entry: CompiledEntry): Promise<void> => {
  await page.route('**/content/*.json', async (route) => {
    const { pathname } = new URL(route.request().url())
    const id = pathname.slice(pathname.lastIndexOf('/') + 1).replace(/\.json$/, '')

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...entry, id }),
    })
  })
}

/**
 * The URL a path produces, as a pattern for `toHaveURL`.
 *
 * `lineSearch` returns a real query string, and `?` and `+` are regular-expression syntax —
 * the very two characters this project's encoding exists to protect — so the value is
 * escaped rather than interpolated raw. Getting this wrong does not fail loudly: it throws
 * "Nothing to repeat" from the regular-expression engine, which reads like a bug in the
 * page rather than a bug in the test.
 */
export const atLine = (gambit: string, line: readonly string[]): RegExp =>
  new RegExp(`/vi/gambits/${gambit}${lineSearch(line).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
