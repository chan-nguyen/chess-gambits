import { expect, test, type Page } from '@playwright/test'
import { MATE_ENTRY, MATE_LINE } from '../src/components/learn/learn-fixtures.ts'
import { lineSearch } from '../src/lib/line.ts'
import vi from '../src/locales/vi.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * The `line` parameter through a real browser, which is where the encoding actually has
 * to hold: a `+` decoded as a space or a `#` swallowed as a fragment happens in the URL
 * bar, not in a unit test.
 *
 * Note the status codes. No gambit is published yet (`publishedGambitIds` is empty until
 * #13), so a gambit path has no shell and is served by `404.html` — which boots the same
 * application and routes correctly. That is ADR-0009 working: the status is honest about
 * the page not existing, and the visitor still gets a page.
 *
 * The line under test is Légal's Mate, because it is the case CONTEXT.md singles out: its
 * plies carry `+` and `#`, so the links that break unencoded are exactly the links to
 * proved checkmates, which are the most shareable thing this site produces.
 */

const gambit = 'legal-mate'

const plies = (page: Page) =>
  page.getByRole('navigation', { name: vi.learn.plyList }).getByRole('link')

const NUMBERED = [
  vi.learn.startingPosition,
  '5...Bh5',
  '6.Nxe5',
  '6...Bxd1',
  '7.Bxf7+',
  '7...Ke7',
  '8.Nd5#',
]

test.beforeEach(async ({ page }) => {
  await serveEntry(page, MATE_ENTRY)
})

test('a link to a proved checkmate restores its exact line', async ({ page }) => {
  await page.goto(`vi/gambits/${gambit}${lineSearch(MATE_LINE)}`)

  await expect(plies(page)).toHaveText(NUMBERED)
  await expect(plies(page).last()).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('the encoded line survives a full page reload', async ({ page }) => {
  await page.goto(`vi/gambits/${gambit}${lineSearch(MATE_LINE)}`)
  await page.reload()

  await expect(plies(page)).toHaveText(NUMBERED)
})

test('an unencoded link is corrupted, and the page says exactly how', async ({ page }) => {
  // Exactly the corruption CONTEXT.md documents: `+` arrives as a space and everything
  // from `#` onwards never reaches the server at all.
  await page.goto(`vi/gambits/${gambit}?line=Bh5_Nxe5_Bxd1_Bxf7+_Ke7_Nd5#`)

  // `Bxf7 ` — the plus is gone, and the parser names the segment rather than guessing.
  await expect(page.getByRole('alert').first()).toContainText('"Bxf7 "')
  await expect(page.getByRole('grid')).toBeVisible()
})

test('a hostile line neither throws nor blanks the page', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`vi/gambits/${gambit}?line=%3Cscript%3Ealert(1)%3C%2Fscript%3E`)

  await expect(page.getByRole('heading', { level: 1, name: MATE_ENTRY.name })).toBeVisible()
  await expect(plies(page)).toHaveText([vi.learn.startingPosition])
  await expect(page.getByRole('alert').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('a missing line parameter reads as the gambit root', async ({ page }) => {
  await page.goto(`vi/gambits/${gambit}`)

  await expect(plies(page)).toHaveText([vi.learn.startingPosition])
  await expect(plies(page).first()).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
})
