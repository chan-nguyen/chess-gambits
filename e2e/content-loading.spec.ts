import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import viStrings from '../src/locales/vi.ts'

/**
 * AC 4 and AC 6, against the built output on a real static host.
 *
 * The catalogue must download no entry tree. That is asserted here rather than in a unit
 * test because it is a claim about what a browser puts on the wire, and because the way it
 * would be broken — a `import.meta.glob` over the catalogue, or a catalogue page that
 * prefetches — leaves every unit test passing.
 *
 * An assertion that a list is empty is worth nothing unless the thing filling the list
 * works, so each test that expects no request goes on to make one and require it to be
 * seen. That keeps the recorder honest permanently, instead of on the day it was written.
 */

const contentRequestsOf = (page: Page): readonly string[] => {
  const seen: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/content/')) seen.push(request.url())
  })
  return seen
}

const contentUrl = (path: string): string => {
  const base = test.info().project.use.baseURL
  if (base === undefined) throw new Error('no baseURL configured')
  return new URL(`content/${path}`, base).toString()
}

test('the catalogue route downloads no entry tree', async ({ page }) => {
  const seen = contentRequestsOf(page)

  await page.goto('vi/gambits')
  // The real catalogue page since #13, so it is waited for by something it only shows once
  // its own payload has arrived — a heading alone would be there before any of it had.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(viStrings.catalogue.heading)
  await expect(page.getByRole('search')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(seen).toEqual([])

  // The recorder has to be able to catch one, or the assertion above is a tautology that
  // would keep passing after the catalogue started pulling entries down.
  await page.evaluate((url) => fetch(url), contentUrl('damiano-defence-refutation.json'))
  await expect.poll(() => seen.length).toBe(1)
})

test('no route downloads an entry tree it was not asked for', async ({ page }) => {
  const seen = contentRequestsOf(page)

  for (const route of ['vi/', 'vi/gambits', 'vi/about', 'fr/gambits']) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
  }

  expect(seen).toEqual([])
})

test('an entry is published as a static JSON file, addressed by URL', async ({ page }) => {
  // damiano-defence-refutation was this listed-tier example until #102 gave it a tree;
  // benko-gambit-fianchetto-variation is kept deliberately unmapped for this test now.
  const response = await page.request.get(contentUrl('benko-gambit-fianchetto-variation.json'))

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/json')

  const body = await response.text()
  // Minified, so it is a payload rather than a file anyone reads.
  expect(body).not.toContain('\n')

  const entry: unknown = JSON.parse(body)
  expect(entry).toMatchObject({
    id: 'benko-gambit-fianchetto-variation',
    tier: 'listed',
    tree: { kind: 'opponent' },
  })
  expect(JSON.stringify(entry)).toContain('"fen":"rnbqkbnr/')
})

test('an entry that was never published answers 404, not a page pretending to be one', async ({
  page,
}) => {
  const response = await page.request.get(contentUrl('no-such-gambit.json'))

  expect(response.status()).toBe(404)
})

/**
 * **The PGN parser never reaches the browser (ADR-0004), on the real built bundle.**
 *
 * `peg$` is retired as this test's own marker for `chess.js` (#131): this project has no
 * route-based code splitting, so the one shared script every route loads now legitimately
 * carries `chess.js` — the home page's free-play board needs it at runtime, by product
 * decision, and `src/lib/content.test.ts` already checks that boundary at the *source*
 * level (which directory is allowed to import it). What this test can still catch, and
 * what it exists for, is `@mliebelt/pgn-parser` reaching the browser — a real risk, since
 * it is a peggy-generated parser the same shape as the one `chess.js` bundles internally
 * for its own `loadPgn`/`pgn()` methods, which is exactly why their generated code shares
 * the `peg$`-prefixed identifiers this test used to key off of. `chess.js`'s own copy is
 * confirmed present below, by name, rather than pretended away — a passing test that
 * cannot fail on the thing it is supposed to catch is worse than an honest one.
 *
 * The marker below is a string literal from one of `@mliebelt/pgn-parser`'s own error
 * messages, not an identifier: a minifier renames local variable and function names freely,
 * but never a string a program can throw or compare against, so this is the one kind of
 * fingerprint minification cannot remove.
 */
test('the page bundle carries no @mliebelt/pgn-parser, though it does carry chess.js', async ({
  page,
}) => {
  const scripts: string[] = []
  page.on('response', async (response) => {
    if (response.url().endsWith('.js')) scripts.push(await response.text())
  })

  await page.goto('vi/gambits')
  await page.waitForLoadState('networkidle')

  expect(scripts.length).toBeGreaterThan(0)

  // A marker only `@mliebelt/pgn-parser`'s own generated parser throws — not chess.js's.
  const pgnParserMarker = 'Result in tags is different to result in SAN'
  for (const script of scripts) {
    expect(script).not.toContain(pgnParserMarker)
  }

  // Confirmed present, not merely un-asserted: chess.js really is in this shared bundle,
  // which is the state #131 put the project in on purpose. A string literal again, and
  // from `move()` itself — the part of chess.js the home board actually calls — rather
  // than from its internal PGN parser, whose own generated names Terser mangles
  // inconsistently (some survive, most do not, since they are local, not properties).
  expect(scripts.some((script) => script.includes('Invalid move: '))).toBe(true)
})
