import { gzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'

/**
 * AC 6 and AC 8, against the built output on a real static host.
 *
 * Two things a unit test cannot reach. That the catalogue files are actually published at
 * the URL the loader asks for — which is a claim about the host and the base path, and the
 * matrix runs this spec at both of them (ADR-0009). And that the payload the visitor
 * downloads is inside its budget, measured on the bytes that shipped rather than on the
 * build's own report of them.
 */

const BUDGET_BYTES = 100 * 1024

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

  for (const route of ['vi/', 'vi/about', 'fr/about']) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
  }

  expect(seen).toEqual([])

  // The recorder has to be able to catch one, or the assertion above is a tautology.
  await page.evaluate((url) => fetch(url), catalogueUrl('vi'))
  await expect.poll(() => seen.length).toBe(1)
})

test('the catalogue payload stays inside its budget over the whole file', async ({ page }) => {
  for (const locale of ['vi', 'en', 'fr']) {
    const response = await page.request.get(catalogueUrl(locale))
    const body = await response.body()

    // Compressed here rather than read off a `content-encoding` header: the static server
    // these tests run against does not compress, and the budget is about what a host that
    // does would send. Measured over the whole shipped file, never a sample.
    const gzipped = gzipSync(body).byteLength

    expect(
      gzipped,
      `catalogue.${locale}.json is ${(gzipped / 1024).toFixed(1)}KB gzipped`,
    ).toBeLessThanOrEqual(BUDGET_BYTES)
  }
})
