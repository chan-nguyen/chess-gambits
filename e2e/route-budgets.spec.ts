import { randomBytes } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { expect, test, type Browser } from '@playwright/test'
import { routeSegments } from '../src/lib/routes.ts'
import { BUDGET_BYTES, asKb } from './budgets.ts'

/**
 * **AC 1 and AC 4. What a visitor actually downloads, per route, and where it comes from.**
 *
 * Measured in a real browser against the built output, never from the build's own report
 * of itself. Vite prints a gzipped size per chunk and that number is true and not the one
 * this budget is about: §6 budgets what a *route* costs, which is the chunks that route
 * pulls **plus its data payload** — and the data is the half a bundler cannot see. The
 * catalogue page's JavaScript has been inside budget since the first week; the 165KB of
 * JSON it fetches is the thing that will grow toward 700 entries and beyond.
 *
 * Three numbers, and each can fail a pull request:
 *
 * - **Initial JavaScript**, `< 200KB` gzipped — every script a cold load of that route
 *   downloads.
 * - **Per-route incremental JavaScript**, `< 50KB` gzipped — what the route adds over the
 *   entry route. This is the one that catches a lazily-imported library landing on one
 *   screen: the totals would both still be inside 200KB while a single route quietly
 *   doubled.
 * - **The route's data payload**, `≤ 100KB` gzipped — the JSON it fetches.
 *   `e2e/catalogue-payload.spec.ts` holds the same number against the catalogue *files*,
 *   which is the "regardless of catalogue size" half of §6; this is the per-route half, and
 *   it covers the gambit trees that file says nothing about.
 *
 * **Gzipped here rather than read off a `content-encoding` header.** `scripts/static-server.ts`
 * does negotiate gzip, as GitHub Pages does, but Playwright decodes a response before
 * handing it over — so the bytes are re-compressed here and the number is a property of
 * the file rather than of whatever encoding this run happened to negotiate.
 *
 * **A fresh context per route**, because the second navigation in a warm browser downloads
 * almost nothing and would report every route as free.
 */

/** One response the browser actually received, with what it would have cost compressed. */
type Resource = {
  readonly url: string
  readonly gzipped: number
}

type RouteLoad = {
  /** Every URL requested, including ones that never answered. */
  readonly requested: readonly string[]
  readonly scripts: readonly Resource[]
  readonly data: readonly Resource[]
  readonly total: number
}

const sum = (resources: readonly Resource[]): number =>
  resources.reduce((bytes, resource) => bytes + resource.gzipped, 0)

const pathOf = (url: string): string => new URL(url).pathname

/**
 * Cold-load a route and record everything that crossed the wire.
 *
 * `networkidle` rather than a visible heading: this has to see the fetches a route makes
 * *after* it paints — the catalogue JSON is one — and a measurement that stopped at first
 * paint would report the payload as zero and pass.
 */
const load = async (browser: Browser, route: string): Promise<RouteLoad> => {
  const base = test.info().project.use.baseURL
  if (base === undefined) throw new Error('no baseURL configured')

  const context = await browser.newContext()
  const page = await context.newPage()

  const requested: string[] = []
  const bodies: Promise<Resource | null>[] = []

  page.on('request', (request) => requested.push(request.url()))
  page.on('response', (response) => {
    bodies.push(
      response
        .body()
        .then((body) => ({ url: response.url(), gzipped: gzipSync(body).byteLength }))
        // A redirect or a 304 has no body to measure, and is not a payload either.
        .catch(() => null),
    )
  })

  await page.goto(new URL(route, base).toString())
  await page.waitForLoadState('networkidle')

  const received = (await Promise.all(bodies)).filter((resource) => resource !== null)
  await context.close()

  return {
    requested,
    scripts: received.filter((resource) => pathOf(resource.url).endsWith('.js')),
    data: received.filter((resource) => pathOf(resource.url).endsWith('.json')),
    total: sum(received),
  }
}

/**
 * The route a visitor arrives on, and therefore the JavaScript every other route is
 * measured *against*. Locale-specific, because the locale bundle is a real chunk.
 */
const ENTRY_ROUTE = 'vi/'

/**
 * One route of every shape the site has, chosen so each budget has something to bite on:
 * the catalogue for the payload, a taught entry for the tree JSON, a *Listed* entry for the
 * empty state, a second locale because the locale bundles are separate chunks, and a deep
 * `?line=` because that is the state most likely to pull something extra.
 */
const ROUTES: readonly string[] = [
  ENTRY_ROUTE,
  `vi/${routeSegments.catalogue}`,
  `vi/${routeSegments.about}`,
  `vi/${routeSegments.catalogue}/damiano-defence-refutation`,
  `vi/${routeSegments.catalogue}/benko-gambit`,
  `vi/${routeSegments.catalogue}/benko-gambit?line=cxb5+a6`,
  `en/${routeSegments.catalogue}/legals-mate`,
  `fr/${routeSegments.catalogue}/italian-game-evans-gambit`,
]

test.describe('what each route costs (AC 1)', () => {
  test('every route stays inside all three budgets', async ({ browser }) => {
    const entry = await load(browser, ENTRY_ROUTE)
    const alreadyHave = new Set(entry.scripts.map((resource) => pathOf(resource.url)))

    const rows: string[] = []

    for (const route of ROUTES) {
      const measured = route === ENTRY_ROUTE ? entry : await load(browser, route)

      const initial = sum(measured.scripts)
      const incremental = sum(
        measured.scripts.filter((resource) => !alreadyHave.has(pathOf(resource.url))),
      )
      const payload = sum(measured.data)

      rows.push(
        `  [budget] ${route.padEnd(48)} js ${asKb(initial).padStart(8)}` +
          ` · +${asKb(incremental).padStart(7)} · data ${asKb(payload).padStart(8)}` +
          ` · all ${asKb(measured.total).padStart(8)}`,
      )

      /*
       * A route that downloaded no script at all would satisfy every budget below. That is
       * not a pass, it is a broken page or a broken recorder, and this project has already
       * shipped one gate that could not fail.
       */
      expect(initial, `${route} downloaded no JavaScript at all`).toBeGreaterThan(0)

      expect(
        initial,
        `${route} downloads ${asKb(initial)} of JavaScript gzipped, over the ` +
          `${asKb(BUDGET_BYTES.initialJavaScript)} budget in docs/design-system.md §6`,
      ).toBeLessThan(BUDGET_BYTES.initialJavaScript)

      expect(
        incremental,
        `${route} adds ${asKb(incremental)} of JavaScript over ${ENTRY_ROUTE}, past the ` +
          `${asKb(BUDGET_BYTES.routeIncrementalJavaScript)} per-route budget`,
      ).toBeLessThan(BUDGET_BYTES.routeIncrementalJavaScript)

      expect(
        payload,
        `${route} downloads ${asKb(payload)} of data gzipped, past the ` +
          `${asKb(BUDGET_BYTES.routePayload)} payload budget`,
      ).toBeLessThanOrEqual(BUDGET_BYTES.routePayload)
    }

    // Printed, not just asserted: AC 5 records these in docs/PROJECT-PLAN.md, and a number
    // nobody can read off a CI log is a number that gets copied from memory.
    process.stdout.write(`\n${rows.join('\n')}\n`)
  })

  /**
   * The probe, and the reason the test above is a measurement rather than three constants
   * compared with each other. A route is made to ship a large, incompressible script and
   * the same measurement has to notice — both in the absolute budget and in the
   * incremental one, because they are computed differently and either could be dead.
   */
  test('a route that ships too much JavaScript is caught by the same measurement', async ({
    browser,
  }) => {
    const base = test.info().project.use.baseURL
    if (base === undefined) throw new Error('no baseURL configured')

    // Random bytes, base64. Filler that gzip would flatten would prove only that gzip works.
    const bulk = `globalThis.__bulk = ${JSON.stringify(randomBytes(400 * 1024).toString('base64'))}`

    const context = await browser.newContext()
    const page = await context.newPage()
    const bodies: Promise<Resource | null>[] = []

    page.on('response', (response) => {
      bodies.push(
        response
          .body()
          .then((body) => ({ url: response.url(), gzipped: gzipSync(body).byteLength }))
          .catch(() => null),
      )
    })
    await page.route('**/probe-bulk.js', (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: bulk }),
    )

    await page.goto(new URL(`vi/${routeSegments.about}`, base).toString())
    await page.waitForLoadState('networkidle')

    const before = (await Promise.all(bodies)).filter((resource) => resource !== null)
    expect(sum(before.filter((r) => pathOf(r.url).endsWith('.js')))).toBeLessThan(
      BUDGET_BYTES.initialJavaScript,
    )

    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'probe-bulk.js'
        script.addEventListener('load', () => resolve())
        script.addEventListener('error', () => reject(new Error('the probe script was blocked')))
        document.head.append(script)
      })
    })
    await page.waitForLoadState('networkidle')

    const after = (await Promise.all(bodies)).filter((resource) => resource !== null)
    const scripts = after.filter((resource) => pathOf(resource.url).endsWith('.js'))
    const overloaded = sum(scripts)
    const added = sum(scripts.filter((resource) => pathOf(resource.url).endsWith('probe-bulk.js')))
    await context.close()

    process.stdout.write(
      `\n  [budget] probe: the same route measures ${asKb(overloaded)} with ` +
        `${asKb(added)} of filler on it\n`,
    )

    expect(overloaded, 'the recorder did not notice 400KB of extra script').toBeGreaterThanOrEqual(
      BUDGET_BYTES.initialJavaScript,
    )
    expect(added).toBeGreaterThanOrEqual(BUDGET_BYTES.routeIncrementalJavaScript)
  })
})

/**
 * **AC 4. Zero third-party requests at runtime (requirement N8), fonts and piece assets
 * included.**
 *
 * `e2e/progress.spec.ts` already holds a version of this, and it is deliberately not
 * widened there: it records what *marking progress* causes, starting after the page has
 * finished loading, on one fixture-served route. That is the right scope for the feature
 * most likely to grow a sync, and it says nothing at all about what a cold load fetches —
 * which is where a font, an icon CDN or an analytics snippet would actually arrive, and
 * which now covers routes with real content that did not exist when it was written.
 *
 * No allow-list and no filter: every URL the browser asked for, required to be under this
 * site's own origin and base path.
 */
test.describe('nothing comes from anywhere else (AC 4)', () => {
  const offOrigin = (requested: readonly string[], base: string): readonly string[] => {
    const origin = new URL(base).origin
    return requested.filter((url) => !url.startsWith(origin))
  }

  test('no route asks for anything outside this origin', async ({ browser }) => {
    const base = test.info().project.use.baseURL
    if (base === undefined) throw new Error('no baseURL configured')

    for (const route of ROUTES) {
      const { requested } = await load(browser, route)

      expect(requested.length, `${route} requested nothing at all`).toBeGreaterThan(0)
      expect(offOrigin(requested, base), `${route} reached off-origin`).toEqual([])
    }
  })

  /**
   * Fonts, named separately because §6 budgets them at **zero downloaded** and a font is
   * the one third-party request a site acquires by accident. Two ways it could arrive —
   * a stylesheet rule and a request — and both are checked: `src/styles/tokens.css` uses
   * system stacks, so there is no `@font-face` to find and nothing to fetch.
   */
  test('no font is downloaded, and none is declared', async ({ browser, page }) => {
    const base = test.info().project.use.baseURL
    if (base === undefined) throw new Error('no baseURL configured')

    const { requested } = await load(browser, `vi/${routeSegments.catalogue}/benko-gambit`)
    const fonts = requested.filter((url) => /\.(woff2?|ttf|otf|eot)(\?|$)/.test(url))
    expect(fonts, 'a font was downloaded').toEqual([])

    await page.goto(`vi/${routeSegments.about}`)
    const stylesheets = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) =>
        link.getAttribute('href'),
      ),
    )
    expect(stylesheets.length, 'the page has no stylesheet to check').toBeGreaterThan(0)

    for (const href of stylesheets) {
      const css = await page.request.get(new URL(href ?? '', base).toString())
      expect(css.status()).toBe(200)
      expect(await css.text(), `${href} declares a font face`).not.toContain('@font-face')
    }
  })

  /**
   * The probe. An empty list is worth nothing unless the recorder can fill one, and under
   * the site's own Content Security Policy it cannot: `default-src 'none'` refuses an
   * off-origin fetch before the browser ever makes a request, so there would be nothing
   * for a listener to hear.
   *
   * So the policy is lifted for this one context — `bypassCSP`, which is the only place in
   * the suite that does it — and the request is fulfilled locally, so nothing leaves the
   * machine and the test needs no internet. What the two halves prove together: the policy
   * stops an off-origin request (`e2e/content-security-policy.spec.ts`), and if one ever
   * got past it, this recorder would see it.
   */
  test('the recorder catches a third-party request when there is one', async ({ browser }) => {
    const base = test.info().project.use.baseURL
    if (base === undefined) throw new Error('no baseURL configured')

    const context = await browser.newContext({ bypassCSP: true })
    const page = await context.newPage()
    const requested: string[] = []
    page.on('request', (request) => requested.push(request.url()))

    await page.route('https://cdn.example.invalid/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/plain', body: 'x' }),
    )

    await page.goto(new URL(`vi/${routeSegments.about}`, base).toString())
    await page.evaluate(() => fetch('https://cdn.example.invalid/analytics.js'))
    await page.waitForLoadState('networkidle')
    await context.close()

    expect(offOrigin(requested, base)).toEqual(['https://cdn.example.invalid/analytics.js'])
  })
})
