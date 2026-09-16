import { expect, test } from '@playwright/test'
import { locales } from '../src/lib/locale.ts'
import { routeSegments } from '../src/lib/routes.ts'

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'

/**
 * The claim ADR-0009 makes, checked against a real host: a pasted deep link is answered
 * with a genuine HTTP 200 by a file that exists, not by a 404 dressed up as a page and
 * not by a single-page fallback.
 *
 * The static server in `scripts/static-server.ts` has no SPA fallback on purpose. That
 * is what makes a 200 here mean something — see the "no fallback" test at the bottom,
 * which is the control for every other assertion in this file.
 */

test('a deep link to a locale route is served with HTTP 200 and renders', async ({ page }) => {
  const response = await page.goto(`fr/${routeSegments.about}`)

  expect(response).not.toBeNull()
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible()
  await expect(page).toHaveURL(`${basePath}fr/about`)
})

test('every static route has a shell at its own path in every locale', async ({ request }) => {
  const paths = locales.flatMap((locale) => [
    `${basePath}${locale}`,
    `${basePath}${locale}/${routeSegments.catalogue}`,
    `${basePath}${locale}/${routeSegments.about}`,
  ])

  for (const path of paths) {
    const response = await request.get(path)
    expect(response.status(), `${path} should be a pre-built shell`).toBe(200)
    expect(await response.text()).toContain('<div id="root">')
  }
})

test('the site root is served and the 404 shell exists', async ({ request }) => {
  expect((await request.get(basePath)).status()).toBe(200)
  expect((await request.get(`${basePath}404.html`)).status()).toBe(200)
  expect((await request.get(`${basePath}.nojekyll`)).status()).toBe(200)
})

test('asset URLs carry the base path so a shell works at any depth', async ({ request }) => {
  const html = await (await request.get(`${basePath}fr/${routeSegments.about}`)).text()
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1] ?? '')

  expect(urls.length).toBeGreaterThan(0)
  for (const url of urls) {
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('#')) continue
    expect(url, `${url} should be absolute and base-prefixed`).toMatch(
      new RegExp(`^${basePath.replace(/\//g, '\\/')}`),
    )
  }
})

test('every asset a shell references actually loads', async ({ page }) => {
  const failures: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })

  await page.goto(`fr/${routeSegments.about}`)
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible()

  expect(failures).toEqual([])
})

test('an unknown path is a genuine 404 that still renders not-found', async ({ page }) => {
  const response = await page.goto('no/such/page/at/all')

  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
})

test('an unknown locale renders not-found rather than a blank page', async ({ page }) => {
  const response = await page.goto(`de/${routeSegments.about}`)

  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to the catalogue' })).toBeVisible()
})

test('the static server has no single-page fallback', async ({ request }) => {
  // The control for this whole file. If this ever returns 200, every other 200 here is
  // meaningless because the server would be inventing pages that were never emitted.
  const response = await request.get(`${basePath}vi/definitely-not-a-route`)

  expect(response.status()).toBe(404)
})
