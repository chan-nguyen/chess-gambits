import { expect, test, type Page } from '@playwright/test'
import { routeSegments } from '../src/lib/routes.ts'

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'
const home = `${basePath}vi/`

/**
 * The home page's interactive board, against the real built site and the real catalogue —
 * the only place the free-play rules engine (#131), its narrowing of the catalogue, and its
 * hand-off into a matched entry's own page can be checked together.
 *
 * #131 reverses #129's "catalogue-only moves" restriction by product decision: any legal
 * move can be played now, including one no catalogue entry contains. `board-interaction.
 * test.ts` and `chess-engine.test.ts` cover the rules engine itself as pure functions; this
 * file is what only a real browser can check — a real click landing on a real
 * `[data-square]` cell, a real promotion picker, and the real live-region announcement.
 */

const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`)

/**
 * Click a piece, then click its destination, and wait for the board's own live region to
 * announce the move that produced.
 *
 * The wait matters and is not decorative: `history.pushState` (which `?moves=` navigation
 * uses) updates `location.href` synchronously, but React committing the re-render that
 * derives the *next* position from it does not happen in that same tick. Two clicks fired
 * back to back — which is what Playwright does, and which nothing stops a fast real click
 * from doing either — can land the second one on a component still holding the previous
 * position, selecting nothing. Waiting for the announcement is waiting for the one thing
 * that is only ever true once the new position is actually the one on screen.
 */
const move = async (page: Page, from: string, to: string, announced: string): Promise<void> => {
  await square(page, from).click()
  await square(page, to).click()
  await expect(page.locator('.board__announcement')).toHaveText(announced)
}

test('play e4, then e5, narrows the catalogue at each step, and undo/reset restore it', async ({
  page,
}) => {
  await page.goto(home)

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

test('narrowing to exactly one match offers a hand-off into that entry', async ({ page }) => {
  await page.goto(home)

  // 1.e4 f5 (Duras Gambit) narrows the real catalogue to exactly one entry — the state
  // #131 hands off from, replacing #129's "end of an opening-tree line" concept, which no
  // longer exists once any legal move (not only a catalogue-backed one) can be played.
  await move(page, 'e2', 'e4', 'Đã đi e4')
  await move(page, 'f7', 'f5', 'Đã đi f5')

  await expect(page).toHaveURL(/moves=e4_f5$/)

  const link = page.getByRole('link', { name: 'Học tiếp: Duras Gambit', exact: true })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', new RegExp(`${routeSegments.catalogue}/duras-gambit$`))
})

test('an off-book sequence plays freely and reports "not found" rather than being refused', async ({
  page,
}) => {
  await page.goto(home)

  // 1.a4 a5 2.h4 is not a prefix of any published line — the exact case #131 exists for:
  // catalogue-only restriction is gone, so this has to play, not be refused.
  await move(page, 'a2', 'a4', 'Đã đi a4')
  await move(page, 'a7', 'a5', 'Đã đi a5')
  await move(page, 'h2', 'h4', 'Đã đi h4')

  await expect(page).toHaveURL(/moves=a4_a5_h4$/)
  await expect(page.getByText('Không có gambit/trap nào tìm thấy')).toBeVisible()
})

test('a pawn promotion asks which piece, and a non-queen choice actually commits', async ({
  page,
}) => {
  await page.goto(home)

  // A short march to a white pawn that can capture-promote on b8 (Black's own knight
  // stands there, so c8 itself, blocked by the bishop, is deliberately not the target):
  // 1.b4 g5 2.b5 g4 3.b6 g3 4.bxc7 h5, then 5.cxb8=?. Every ply here is off-book, which
  // is exactly what #131 has to allow — nothing here is a catalogue line.
  await move(page, 'b2', 'b4', 'Đã đi b4')
  await move(page, 'g7', 'g5', 'Đã đi g5')
  await move(page, 'b4', 'b5', 'Đã đi b5')
  await move(page, 'g5', 'g4', 'Đã đi g4')
  await move(page, 'b5', 'b6', 'Đã đi b6')
  await move(page, 'g4', 'g3', 'Đã đi g3')
  await move(page, 'b6', 'c7', 'Đã đi bxc7')
  await move(page, 'h7', 'h5', 'Đã đi h5')

  await square(page, 'c7').click()
  await square(page, 'b8').click()

  const picker = page.getByRole('group', { name: 'Chọn quân để phong cấp' })
  await expect(picker).toBeVisible()

  // A non-queen choice, to prove the picker is not cosmetic (this catalogue's own content
  // — the Lasker Trap — specifically teaches an underpromotion).
  await picker.getByRole('button', { name: 'xe trắng' }).click()

  await expect(page.locator('.board__announcement')).toHaveText('Đã đi cxb8=R')
  await expect(page).toHaveURL(/moves=.*b8%3DR$/)
  await expect(picker).toHaveCount(0)
})

test('playing to checkmate ends the game without leaving the board looking broken', async ({
  page,
}) => {
  await page.goto(home)

  // The Fool's Mate: the fastest possible checkmate, so this test stays short.
  await move(page, 'f2', 'f3', 'Đã đi f3')
  await move(page, 'e7', 'e5', 'Đã đi e5')
  await move(page, 'g2', 'g4', 'Đã đi g4')
  await square(page, 'd8').click()
  await square(page, 'h4').click()
  await expect(page.locator('.board__announcement')).toContainText('Qh4')

  // `.board__announcement` also says "Chiếu hết." (concatenated onto the move that
  // produced it, for the screen reader that already heard "Đã đi Qh4#") — scoped so this
  // assertion is about the board's own, separate, visible status line (`HomeBoard.tsx`).
  await expect(page.locator('.home-board__status')).toHaveText('Chiếu hết.')

  // Further clicks do nothing broken: no navigation, no thrown error, nothing selected.
  await square(page, 'e1').click()
  await expect(page).toHaveURL(/moves=f3_e5_g4_Qh4%23$/)
  await expect(page.locator('.board__square--marked')).toHaveCount(0)
})

test('is fully operable by keyboard, with no pointer event anywhere in the walk', async ({
  page,
}) => {
  await page.goto(home)

  const a1 = square(page, 'a1')
  await a1.focus()

  // From a1 (White's own corner) to e2: four files right, one rank up.
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator(':focus')).toHaveAttribute('data-square', 'e2')

  await page.keyboard.press('Enter') // select e2
  await expect(page.locator('.board__square--marked')).not.toHaveCount(0)

  await page.keyboard.press('ArrowUp') // e3
  await page.keyboard.press('ArrowUp') // e4
  await expect(page.locator(':focus')).toHaveAttribute('data-square', 'e4')
  await page.keyboard.press('Enter') // commit e2-e4

  await expect(page).toHaveURL(/moves=e4$/)
  await expect(page.locator('.board__announcement')).toHaveText('Đã đi e4')
})

test('a selected piece shows where it can go: a dot on an empty square, a ring on a capture', async ({
  page,
}) => {
  await page.goto(home)
  await move(page, 'e2', 'e4', 'Đã đi e4')
  await move(page, 'd7', 'd5', 'Đã đi d5')

  await square(page, 'e4').click()

  // exd5 and e5: one of each. Nothing else is a target, and the tint is on e4 alone.
  await expect(page.locator('circle.board__target')).toHaveCount(2)
  await expect(page.locator('circle.board__target--occupied')).toHaveCount(1)
  await expect(page.locator('.board__square--marked')).toHaveCount(1)

  // The dot is said in words too, so it is not a sighted-only signal.
  await expect(square(page, 'e5')).toHaveAttribute('aria-label', 'e5, ô trống, đi được tới đây')
  await expect(square(page, 'd5')).toHaveAttribute('aria-label', 'd5, tốt đen, đi được tới đây')
  await expect(square(page, 'e3')).toHaveAttribute('aria-label', 'e3, ô trống')

  // Committing clears them with the selection.
  await square(page, 'd5').click()
  await expect(page.locator('.board__announcement')).toHaveText('Đã đi exd5')
  await expect(page.locator('circle.board__target')).toHaveCount(0)
})

test('the flip control turns the board, and moves keep it turned', async ({ page }) => {
  await page.goto(home)
  const flip = page.getByRole('button', { name: 'Lật bàn cờ' })
  const cells = page.getByRole('gridcell')

  await expect(flip).toHaveAttribute('aria-pressed', 'false')
  await expect(cells.first()).toHaveAttribute('data-square', 'a8')

  await flip.click()
  await expect(page).toHaveURL(/\?flip=1$/)
  await expect(flip).toHaveAttribute('aria-pressed', 'true')
  await expect(cells.first()).toHaveAttribute('data-square', 'h1')

  // Black at the bottom, and a move played that way round keeps it that way round.
  await move(page, 'e2', 'e4', 'Đã đi e4')
  await expect(page).toHaveURL(/\?moves=e4&flip=1$/)
  await expect(cells.first()).toHaveAttribute('data-square', 'h1')

  // Flipping is a history step like a move: back undoes it, and only it.
  await page.goBack()
  await expect(page).toHaveURL(/\?flip=1$/)
  await flip.click()
  await expect(page).not.toHaveURL(/flip=/)
  await expect(cells.first()).toHaveAttribute('data-square', 'a8')
})

/**
 * The centre of a square on screen, where a real mouse presses it. The board is below the
 * fold at this viewport, and unlike `click()` a bare mouse does not scroll to what it means.
 */
const centreOf = async (page: Page, name: string): Promise<{ x: number; y: number }> => {
  await page.locator('.home-board__surface').scrollIntoViewIfNeeded()
  const box = await square(page, name).boundingBox()
  if (box === null) throw new Error(`${name} is not on screen`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('a piece dragged with the mouse follows it and plays where it is dropped (#167)', async ({
  page,
}) => {
  await page.goto(home)
  const lifted = page.locator('.home-board__lifted')

  const e2 = await centreOf(page, 'e2')
  const e4 = await centreOf(page, 'e4')
  await page.mouse.move(e2.x, e2.y)
  await page.mouse.down()
  await page.mouse.move(e4.x, e4.y, { steps: 8 })

  // In the hand: off its square, drawn under the pointer, and its moves shown as for a click.
  await expect(lifted).toBeVisible()
  await expect(square(page, 'e2')).toHaveAttribute('aria-label', 'e2, ô trống')
  await expect(page.locator('.board__square--marked')).toHaveCount(1)
  await expect(page.locator('circle.board__target')).toHaveCount(2)

  await page.mouse.up()
  await expect(page.locator('.board__announcement')).toHaveText('Đã đi e4')
  await expect(page).toHaveURL(/moves=e4$/)
  await expect(lifted).toHaveCount(0)
})

test('a dragged piece goes back where it cannot go, and stays selected on its own square', async ({
  page,
}) => {
  await page.goto(home)
  await move(page, 'e2', 'e4', 'Đã đi e4')
  const g8 = await centreOf(page, 'g8')

  // Off the board altogether: back on g8, nothing selected, nothing played.
  await page.mouse.move(g8.x, g8.y)
  await page.mouse.down()
  await page.mouse.move(g8.x + 500, g8.y, { steps: 8 })
  await page.mouse.up()
  await expect(square(page, 'g8')).toHaveAttribute('aria-label', 'g8, mã đen')
  await expect(page.locator('.board__square--marked')).toHaveCount(0)
  await expect(page).toHaveURL(/moves=e4$/)

  // Lifted and put down on its own square it stays picked up, as a click leaves it — the
  // click the browser sends after the drop does not put it down again — so one more click
  // on a destination plays it.
  await page.mouse.move(g8.x, g8.y)
  await page.mouse.down()
  await page.mouse.move(g8.x + 12, g8.y + 6, { steps: 4 })
  await page.mouse.up()
  await expect(page.locator('.board__square--marked')).toHaveCount(1)
  await square(page, 'f6').click()
  await expect(page.locator('.board__announcement')).toHaveText('Đã đi Nf6')
})
