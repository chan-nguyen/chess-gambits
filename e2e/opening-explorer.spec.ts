import { expect, test, type Page } from '@playwright/test'
import { routeSegments } from '../src/lib/routes.ts'

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'
const home = `${basePath}vi/`

/**
 * The home page's interactive opening board (issue #129), against the real built site and
 * the real opening tree — the only place its own click-to-move restriction, its live
 * narrowing of the catalogue, and its hand-off into a matched entry's own page can be
 * checked together.
 */

const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`)

/**
 * The opening tree is fetched after mount (§6, not on the LCP-critical path), so a click
 * fired the instant the page navigates lands before the tree has arrived. Waiting for the
 * first mark is waiting for the one thing every test below actually depends on.
 */
const openHome = async (page: Page): Promise<void> => {
  await page.goto(home)
  await expect(page.locator('.board__mark').first()).toBeVisible()
}

/**
 * Click a piece, then click its destination, and wait for the board's own live region to
 * announce the move that produced.
 *
 * The wait matters and is not decorative: `history.pushState` (which `?moves=` navigation
 * uses) updates `location.href` synchronously, but React committing the re-render that
 * derives the *next* node from it does not happen in that same tick. Two clicks fired back
 * to back — which is what Playwright does, and which nothing stops a fast real click from
 * doing either — can land the second one on a component still holding the previous
 * position, selecting nothing. Waiting for the announcement is waiting for the one thing
 * that is only ever true once the new node is actually the one on screen.
 */
const move = async (page: Page, from: string, to: string, announced: string): Promise<void> => {
  await square(page, from).click()
  await square(page, to).click()
  await expect(page.locator('.board__announcement')).toHaveText(announced)
}

test('play e4, then e5, narrows the catalogue at each step, and undo/reset restore it', async ({
  page,
}) => {
  await openHome(page)

  await expect(page.getByRole('heading', { name: 'Thử đi vài nước' })).toBeVisible()
  // Nothing narrowed yet: an invitation, not the whole catalogue dumped onto the page.
  await expect(page.getByText('Đi một nước trên bàn cờ')).toBeVisible()

  await move(page, 'e2', 'e4', 'Đã đi e4')

  await expect(page).toHaveURL(/moves=e4$/)
  const afterE4 = page.getByRole('status').filter({ hasText: 'Khớp' })
  await expect(afterE4).toBeVisible()
  const countAfterE4 = await afterE4.textContent()

  // A spot check against real catalogue data: every published line beginning with 1.e4
  // includes the Italian Game family (Evans Gambit among its variations), and nothing
  // beginning with 1.d4 should still be listed at all. Past the same auto-expand threshold
  // `CatalogueRoute` itself uses, families stay collapsed until opened.
  await page.getByRole('button', { name: /Khai cuộc Ý/ }).click()
  await expect(
    page.getByRole('link', { name: 'Khai cuộc Ý: Evans Gambit', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Englund Gambit', exact: true })).toHaveCount(0)

  await move(page, 'e7', 'e5', 'Đã đi e5')

  await expect(page).toHaveURL(/moves=e4_e5$/)
  const afterE4E5 = page.getByRole('status').filter({ hasText: 'Khớp' })
  const countAfterE4E5 = await afterE4E5.textContent()
  expect(countAfterE4E5).not.toBe(countAfterE4)

  // Undo goes back one ply, restoring the wider, 1.e4-only list.
  await page.getByRole('button', { name: 'Đi lại' }).click()
  await expect(page).toHaveURL(/moves=e4$/)
  await expect(page.getByRole('status').filter({ hasText: 'Khớp' })).toHaveText(countAfterE4 ?? '')

  // Reset returns to the start position and the invitation text.
  await page.getByRole('button', { name: 'Về đầu' }).click()
  await expect(page).not.toHaveURL(/moves=/)
  await expect(page.getByText('Đi một nước trên bàn cờ')).toBeVisible()
})

test('reaching the end of an opening tree line offers a hand-off into that entry', async ({
  page,
}) => {
  await openHome(page)

  // 1.e4 f5 (Duras Gambit) is a genuine leaf of the real opening tree: no published entry's
  // defining line continues past it, which is exactly the state issue #129 hands off from.
  await move(page, 'e2', 'e4', 'Đã đi e4')
  await move(page, 'f7', 'f5', 'Đã đi f5')

  await expect(page).toHaveURL(/moves=e4_f5$/)

  const link = page.getByRole('link', { name: 'Duras Gambit', exact: true })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', new RegExp(`${routeSegments.catalogue}/duras-gambit$`))
})

test('the board only ever offers moves the catalogue actually contains', async ({ page }) => {
  await openHome(page)

  // Every square with at least one catalogue-backed opening move is marked from the start
  // (there is no other way to discover a legal square to pick up), so there is a non-zero
  // baseline count of marks before anything is clicked.
  const marks = page.locator('.board__mark')
  const baseline = await marks.count()
  expect(baseline).toBeGreaterThan(0)

  // A rook has no legal first move from a1 in any catalogue line, so clicking it must
  // neither select it (the marks stay exactly the starting "these squares are pickable"
  // set) nor commit any move (the URL stays at the start position).
  await square(page, 'a1').click()
  await expect(marks).toHaveCount(baseline)
  await expect(page).not.toHaveURL(/moves=/)
})

test('is fully operable by keyboard, with no pointer event anywhere in the walk', async ({
  page,
}) => {
  await openHome(page)

  const a1 = square(page, 'a1')
  await a1.focus()

  // From a1 (White's own corner) to e2: four files right, one rank up.
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator(':focus')).toHaveAttribute('data-square', 'e2')

  await page.keyboard.press('Enter') // select e2
  await expect(page.locator('.board__mark')).not.toHaveCount(0)

  await page.keyboard.press('ArrowUp') // e3
  await page.keyboard.press('ArrowUp') // e4
  await expect(page.locator(':focus')).toHaveAttribute('data-square', 'e4')
  await page.keyboard.press('Enter') // commit e2-e4

  await expect(page).toHaveURL(/moves=e4$/)
  await expect(page.locator('.board__announcement')).toHaveText('Đã đi e4')
})
