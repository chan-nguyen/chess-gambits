import { expect, test, type Page } from '@playwright/test'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'
const analysis = `${basePath}vi/${routeSegments.analysis}`
const A = vi.analysis

/**
 * The analysis page against the real engine, in a real browser (#154, ADR-0012) — the only
 * place the vendored Stockfish build, its worker, its WASM, the CSP it runs under and the
 * static host's MIME types can be checked together. Every unit test of the page uses a fake
 * engine; this file is the proof there is a real one behind it.
 *
 * Nothing here waits for the search to finish: a shared CI runner may take far longer than
 * a laptop to reach depth 20, and what matters is that the engine answers, not how fast.
 */

const score = (page: Page) => page.locator('.engine-panel__value')

/** Waits for the engine to have searched at least `depth` plies into this position. */
const searchedTo = async (page: Page, depth: number): Promise<void> => {
  await expect
    .poll(
      async () =>
        Number(/(\d+)/.exec((await page.locator('.engine-panel__depth').textContent()) ?? '')?.[1]),
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(depth)
}

test('Stockfish evaluates a position in the browser, and says it is an estimate', async ({
  page,
}) => {
  await page.goto(`${analysis}?moves=e4_e5_Nf3`)

  await expect(page.getByText(A.estimate)).toBeVisible()
  await searchedTo(page, 8)

  // A quiet opening position: a small score either way, not a mate, not nonsense.
  await expect(score(page)).toHaveText(/^[+-]?0\.\d\d$/)
  await expect(page.locator('.engine-panel__chances')).toHaveText(/Trắng thắng \d+%/)
  await expect(page.locator('.engine-panel__line')).toHaveCount(3)
  await expect(page.locator('polygon.board__arrow')).toHaveCount(1)
})

test('finds the mate on the board, plays it from the line, and hands over to the rules', async ({
  page,
}) => {
  await page.goto(`${analysis}?moves=f3_e5_g4`)

  await expect(score(page)).toHaveText('-M1', { timeout: 60_000 })
  await expect(page.getByText('Stockfish thấy Đen chiếu hết trong 1 nước.')).toBeVisible()

  await page.getByRole('button', { name: /Đi Qh4#/ }).click()

  await expect(page).toHaveURL(/moves=f3_e5_g4_Qh4%23$/)
  await expect(page.locator('.home-board__status')).toHaveText(vi.home.checkmate)
  await expect(page.getByText(A.gameOver)).toBeVisible()
})

test('steps back through the line with the keyboard, keeping the rest of it', async ({ page }) => {
  await page.goto(`${analysis}?moves=e4_e5_Nf3`)
  await searchedTo(page, 1)

  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/moves=e4_e5_Nf3&ply=2$/)
  await expect(page.locator('.analysis-moves [aria-current="step"]')).toHaveText('e5')
  // A new position, a new search: the figures come back for it.
  await searchedTo(page, 1)

  await page.keyboard.press('f')
  await expect(page).toHaveURL(/ply=2&flip=1$/)
  await expect(page.locator('[role="grid"] [data-square]').first()).toHaveAttribute(
    'data-square',
    'h1',
  )
})

/**
 * The position editor (2026-09-29) end to end: a position that exists nowhere in a game from
 * the start, set up by hand with Black to move, handed to the real engine. King and queen
 * against king is a forced mate, so the engine's answer is checkable without trusting it to
 * be fast.
 */
test('sets up a position by hand and has Stockfish analyse it', async ({ page }) => {
  await page.goto(`${analysis}?moves=e4_e5`)
  await page.getByRole('link', { name: A.setupOpen }).click()
  await expect(page.getByRole('heading', { name: A.setupHeading })).toBeVisible()

  await page.getByRole('button', { name: A.setupClear }).click()
  const analyse = page.getByRole('button', { name: A.setupAnalyse })
  await expect(analyse).toHaveAttribute('aria-disabled', 'true')
  await expect(analyse).toHaveAccessibleDescription(A.setupWhiteKing)

  const place = async (piece: string, square: string) => {
    await page.getByRole('button', { name: piece, exact: true }).click()
    await page.locator(`[data-square="${square}"]`).click()
  }
  await place(vi.board.whiteKing, 'e1')
  await place(vi.board.blackKing, 'e8')
  await place(vi.board.whiteQueen, 'd1')
  await page.getByRole('radio', { name: A.setupBlackToMove }).check()

  await expect(page.getByRole('textbox', { name: A.setupFen })).toHaveValue(
    '4k3/8/8/8/8/8/8/3QK3 b - - 0 2',
  )
  await expect(analyse).toHaveAttribute('aria-disabled', 'false')
  await analyse.click()

  await expect(page).toHaveURL(/\?fen=4k3%2F8%2F8%2F8%2F8%2F8%2F8%2F3QK3%20b%20-%20-%200%202$/)
  await expect(score(page)).toHaveText(/^M\d+$/, { timeout: 60_000 })
  await expect(page.locator('.engine-panel__chances')).toHaveText(/Trắng thắng \d+%/)
  // Black to move, and the counters kept from 1.e4 e5: the line starts on Black's half of move 2.
  await expect(page.locator('.engine-panel__line').first()).toContainText(/2\.\.\.K/)
})

test('the home board opens its position here', async ({ page }) => {
  await page.goto(`${basePath}vi/`)
  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()
  await expect(page).toHaveURL(/moves=e4$/)

  await page.getByRole('link', { name: A.openHere }).click()

  await expect(page).toHaveURL(new RegExp(`${routeSegments.analysis}\\?moves=e4$`))
  await searchedTo(page, 1)
})

test('a Black gambit opens here the same way up as on its own page', async ({ page }) => {
  await page.goto(`${basePath}vi/${routeSegments.catalogue}/benko-gambit`)

  await page.getByRole('link', { name: A.openHere }).click()

  await expect(page).toHaveURL(/moves=d4_Nf6_c4_c5_d5_b5&flip=1$/)
  await expect(page.locator('[role="grid"] [data-square]').first()).toHaveAttribute(
    'data-square',
    'h1',
  )
})

test('leaves nothing running once the visitor has left the page', async ({ page }) => {
  await page.goto(analysis)
  await searchedTo(page, 1)
  expect(page.workers()).toHaveLength(1)

  await page.getByRole('link', { name: vi.nav.catalogue }).first().click()

  await expect.poll(() => page.workers().length).toBe(0)
})
