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

test('the page bundle carries no chess engine and no PGN parser', async ({ page }) => {
  const scripts: string[] = []
  page.on('response', async (response) => {
    if (response.url().endsWith('.js')) scripts.push(await response.text())
  })

  await page.goto('vi/gambits')
  await page.waitForLoadState('networkidle')

  expect(scripts.length).toBeGreaterThan(0)
  for (const script of scripts) {
    // Identifiers the two build-time libraries cannot be shipped without.
    expect(script).not.toContain('SEVEN_TAG_ROSTER')
    expect(script).not.toContain('DEFAULT_POSITION')
    expect(script).not.toContain('peg$')
  }
})
