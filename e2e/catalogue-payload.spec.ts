import { gzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'
import { BUDGET_BYTES, asKb } from './budgets.ts'

/**
 * AC 6 and AC 8, against the built output on a real static host.
 *
 * Two things a unit test cannot reach. That the catalogue files are actually published at
 * the URL the loader asks for — which is a claim about the host and the base path, and the
 * matrix runs this spec at both of them (ADR-0009). And that the payload the visitor
 * downloads is inside its budget, measured on the bytes that shipped rather than on the
 * build's own report of them.
 */

const catalogueUrl = (locale: string): string => {
  const base = test.info().project.use.baseURL
  if (base === undefined) throw new Error('no baseURL configured')
  return new URL(`catalogue/catalogue.${locale}.json`, base).toString()
}

for (const locale of ['vi', 'en', 'fr']) {
  test(`the ${locale} catalogue is published as a static JSON file`, async ({ page }) => {
    const response = await page.request.get(catalogueUrl(locale))

    expect(response.status()).toBe(200)

    const body: unknown = await response.json()
    expect(body).toMatchObject({ locale })
  })
}

test('no route downloads the catalogue it was not asked for', async ({ page }) => {
  const seen: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/catalogue/')) seen.push(request.url())
  })

  /**
   * The home page is **no longer on this list**, and that is a deliberate narrowing rather
   * than a gate bent to fit a feature. #13's AC 7 requires the home page to route to a
   * taught entry, and which entries are taught is generated data: the only alternative to
   * reading it from the catalogue is a copy of it committed somewhere else, kept in step by
   * hand. The fetch is not render-blocking — the page's own copy paints from the shell — so
   * what this test protected has moved rather than gone, and it is asserted below: a
   * visitor still downloads one locale's catalogue and never three.
   */
  for (const route of ['vi/about', 'fr/about']) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
  }

  expect(seen).toEqual([])

  // The recorder has to be able to catch one, or the assertion above is a tautology.
  await page.evaluate((url) => fetch(url), catalogueUrl('vi'))
  await expect.poll(() => seen.length).toBe(1)
})

test('a route that needs the catalogue downloads one locale of it, never three', async ({
  page,
}) => {
  /**
   * The chunking guarantee, which is what the budget above depends on: the payloads are
   * built per locale precisely so a visitor pays for one language of names
   * (docs/design-system.md, *Catalogue chunking*). A page that fetched all three would sit
   * inside the per-file budget and be three times over it in practice.
   */
  for (const route of ['vi/', 'vi/gambits']) {
    const seen: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/catalogue/')) seen.push(request.url())
    })

    await page.goto(route)
    await page.waitForLoadState('networkidle')

    expect(seen.length, `${route} requested ${seen.join(', ')}`).toBeGreaterThan(0)
    expect(new Set(seen), `${route} requested more than one catalogue`).toHaveProperty('size', 1)
    expect(seen[0]).toContain('catalogue.vi.json')

    page.removeAllListeners('request')
  }
})

test('the catalogue payload stays inside its budget over the whole file', async ({ page }) => {
  for (const locale of ['vi', 'en', 'fr']) {
    const response = await page.request.get(catalogueUrl(locale))
    const body = await response.body()

    /*
     * Compressed here rather than read off a `content-encoding` header. The static server
     * does now negotiate gzip, as GitHub Pages does — #19 taught it to, because Lighthouse
     * measures LCP from the bytes that crossed the wire — but `page.request` decodes the
     * response transparently, so this measures the file itself rather than whatever
     * encoding this run happened to negotiate. Over the whole shipped file, never a sample.
     */
    const gzipped = gzipSync(body).byteLength

    expect(gzipped, `catalogue.${locale}.json is ${asKb(gzipped)} gzipped`).toBeLessThanOrEqual(
      BUDGET_BYTES.routePayload,
    )
  }
})
