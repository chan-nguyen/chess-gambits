import { expect, test, type Page } from '@playwright/test'
import { MAIN_LINE, MAPPED_ENTRY } from '../src/components/learn/learn-fixtures.ts'
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
 * The line under test is the Damiano refutation, and it is the mapped fixture rather than the
 * mate one for a reason worth writing down (issue #46). CONTEXT.md names `+` and `#`
 * together, but only one of them can ever be *in* a path: a mate is claimed on the leaf before
 * the mating move and its `sequence` runs from there, so `Nd5#` is a ply in a proof and never
 * a node anything can link to. What a link to a proved checkmate actually carries is the
 * checks played on the way to it, and this line has three — `4.Qh5+`, `5.Qxe5+` and `6.Bc4+`.
 * The `#` still gets its test below, as the corruption it causes when a link is pasted
 * unencoded, which is the only form in which it reaches a URL at all.
 */

const gambit = MAPPED_ENTRY.id

const plies = (page: Page) =>
  page.getByRole('navigation', { name: vi.learn.plyList }).getByRole('link')

const NUMBERED = [
  vi.learn.startingPosition,
  '3...fxe5',
  '4.Qh5+',
  '4...Ke7',
  '5.Qxe5+',
  '5...Kf7',
  '6.Bc4+',
]

test.beforeEach(async ({ page }) => {
  await serveEntry(page, MAPPED_ENTRY)
})

test('a link whose plies carry checks restores its exact line', async ({ page }) => {
  await page.goto(`vi/gambits/${gambit}${lineSearch(MAIN_LINE)}`)

  await expect(plies(page)).toHaveText(NUMBERED)
  await expect(plies(page).last()).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('the encoded line survives a full page reload', async ({ page }) => {
  await page.goto(`vi/gambits/${gambit}${lineSearch(MAIN_LINE)}`)
  await page.reload()

  await expect(plies(page)).toHaveText(NUMBERED)
})

test('an unencoded link is corrupted, and the page says exactly how', async ({ page }) => {
  // Exactly the corruption CONTEXT.md documents, and both halves of it: `+` arrives as a
  // space, and everything from the `#` onwards never leaves the browser.
  await page.goto(`vi/gambits/${gambit}?line=fxe5_Qh5+_Ke7#_Qxe5+_Kf7_Bc4+`)

  // `Qh5 ` — the plus is gone, and the parser names the segment rather than guessing.
  await expect(page.getByRole('alert').first()).toContainText('"Qh5 "')
  // The tail after the `#` was never sent, so the line stops at the one ply that parsed.
  await expect(plies(page)).toHaveText([vi.learn.startingPosition, '3...fxe5'])
  await expect(page.getByRole('grid')).toBeVisible()
})

test('a hostile line neither throws nor blanks the page', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`vi/gambits/${gambit}?line=%3Cscript%3Ealert(1)%3C%2Fscript%3E`)

  await expect(page.getByRole('heading', { level: 1, name: MAPPED_ENTRY.name })).toBeVisible()
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
