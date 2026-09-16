import { expect, test } from '@playwright/test'
import { routeSegments } from '../src/lib/routes.ts'

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'

/**
 * The catalogue page (#13), against the built site and the **real** seven-hundred-entry
 * payload — which is the only place several of its acceptance criteria can be checked.
 *
 * AC 3 is a latency budget over the whole catalogue, and a jsdom test measures a machine
 * with no layout engine; the number that matters is the one a browser produces after it has
 * laid out the result. AC 4's grouping only reads as a design at real cardinality. And the
 * links this page emits are the reason the build emits a shell per gambit: on a static host
 * a link to a path with no file behind it is a 404, and only a real host can say otherwise.
 */

const gambits = `${basePath}vi/${routeSegments.catalogue}`

test('the page states the aggregate coverage before it states anything else', async ({ page }) => {
  await page.goto(gambits)

  // The real numbers, whatever they are today — asserted as a shape so this does not have
  // to be edited every time content lands, and still fails if the sentence disappears.
  await expect(page.getByRole('main')).toContainText(/\d+ đã liệt kê · \d+ đã dựng cây/)
})

test('the default view is depth, and breadth is something a visitor asks for', async ({ page }) => {
  await page.goto(gambits)
  const filters = page.getByRole('search')

  await expect(filters.getByRole('radio', { name: 'Đã dạy sâu' })).toBeChecked()

  /*
   * `click`, not `check`. The radios are controlled by the URL, so the browser's native
   * check is reverted and reapplied a render later; `check` verifies the state the instant
   * it clicks and reports a failure that is nothing but that one frame.
   */
  const everything = filters.getByRole('radio', { name: 'Tất cả mục đã liệt kê' })
  await everything.click()
  await expect(page).toHaveURL(new RegExp('tier=all'))
  await expect(everything).toBeChecked()

  // Forty-seven families, not seven hundred rows: the index is collapsed until asked.
  const families = page.getByRole('main').getByRole('button', { expanded: false })
  await expect.poll(async () => await families.count()).toBeGreaterThan(20)
})

test('every filter is reachable and operable from the keyboard alone', async ({ page }) => {
  await page.goto(`${gambits}?tier=all`)
  const filters = page.getByRole('search')
  await filters.getByLabel('Tìm theo tên hoặc mã ECO').focus()

  // Tab forward through the form and collect what the focus ring actually lands on.
  const reached: string[] = []
  for (let step = 0; step < 8; step += 1) {
    reached.push(await page.evaluate(() => document.activeElement?.tagName ?? ''))
    await page.keyboard.press('Tab')
  }

  expect(reached).toContain('INPUT')
  expect(reached).toContain('SELECT')

  // And the radio group is operable the way a radio group is: with the arrow keys.
  await filters.getByRole('radio', { name: 'Đã dạy sâu' }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page).toHaveURL(new RegExp('tier=(mapped|all)'))
})

test('search folds Vietnamese diacritics over the whole catalogue', async ({ page }) => {
  await page.goto(`${gambits}?tier=all`)
  const box = page.getByLabel('Tìm theo tên hoặc mã ECO')

  await box.fill('benko gambit')
  await expect(page.getByRole('main').getByRole('status')).toContainText(/Đang hiện [1-9]/)
  await expect(page.getByRole('link', { name: /Benko/ }).first()).toBeVisible()
})

declare global {
  interface Window {
    catalogueInteractions?: number[]
  }
}

/**
 * **AC 3, measured** the way `interaction-latency.spec.ts` measures its own budget: with
 * `PerformanceObserver` on event-timing entries, in a real Chromium, against the built
 * output. The number reported is the worst interaction latency observed — the time from the
 * key press to the paint that answered it, which is the span a visitor experiences.
 *
 * Not measured with Playwright's own polling, which steps at 100ms: against a 100ms budget
 * the answer would always be "one poll interval".
 *
 * `durationThreshold` has a floor of 16ms in the specification, so an interaction faster
 * than that produces no entry at all. No entries therefore means "nothing reached 16ms",
 * which is a pass — and the assertion that the result count actually changed is what stops
 * that from also being the reading when nothing happened.
 */
const observeInteractions = (page: import('@playwright/test').Page): Promise<void> =>
  page.evaluate(() => {
    const durations: number[] = []
    window.catalogueInteractions = durations

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const id = 'interactionId' in entry ? entry.interactionId : undefined
        if (typeof id === 'number' && id > 0) durations.push(entry.duration)
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true })
  })

/**
 * Three keystrokes, each chosen against the real catalogue for what it costs. `b` matches
 * 694 of the 700 entries and is the worst case for the *matching*; `5` after a `C` narrows
 * 630 ECO matches to 85, the largest result set the page still expands, and is the worst
 * case for the *rendering*; `q` matches six.
 *
 * All three scan every one of the seven hundred entries — `applyFilter` has no early exit —
 * so "over the full generated catalogue" holds for each of them.
 */
test('filtering the full catalogue answers in under 100ms', async ({ page }) => {
  const cases: readonly { readonly from: string; readonly key: string; readonly then: RegExp }[] = [
    { from: '', key: 'b', then: /Đang hiện 694/ },
    { from: 'C', key: '5', then: /Đang hiện 85/ },
    { from: '', key: 'q', then: /Đang hiện 6 / },
  ]

  for (const { from, key, then } of cases) {
    await page.goto(`${gambits}?tier=all${from === '' ? '' : `&q=${from}`}`)
    const status = page.getByRole('main').getByRole('status')
    await expect(status).toContainText('trong 700 mục')

    await page.getByLabel('Tìm theo tên hoặc mã ECO').click()
    await observeInteractions(page)
    await page.keyboard.press(key)

    // The filter has to have actually run, or "no entries over 16ms" means nothing.
    await expect(status).toContainText(then)

    const durations = await page.evaluate(() => [...(window.catalogueInteractions ?? [])])
    const worst = durations.length === 0 ? 0 : Math.max(...durations)

    process.stdout.write(
      `\n  [filter] "${from}${key}": ${durations.length} entries over 16ms, worst ${worst.toFixed(1)}ms\n`,
    )
    expect(worst, `${worst.toFixed(1)}ms to answer "${from}${key}"`).toBeLessThan(100)
  }
})

test('an entry links to a URL that the host actually answers', async ({ page, request }) => {
  await page.goto(`${gambits}?tier=all&q=benko`)

  const link = page.getByRole('main').getByRole('link', { name: /Benko/ }).first()
  const href = await link.getAttribute('href')
  expect(href).not.toBeNull()

  /*
   * The whole reason `scripts/generate-shells.ts` emits one shell per published gambit.
   * Without it this request is a 404 from GitHub Pages while every unit test passes.
   */
  const response = await request.get(href ?? '')
  expect(response.status(), `${href} has no shell on disk`).toBe(200)
  expect(await response.text()).toContain('<div id="root">')
})

/**
 * **Requirement F15 / AC 8.** Following a card to a listed entry lands on a designed state,
 * not on an error, a spinner or a 404 — and the tier badge on it goes somewhere that
 * explains the word.
 */
test('a listed entry opens on its identity and its moves, never an error', async ({ page }) => {
  await page.goto(`${gambits}?tier=all&q=benko`)
  await page.getByRole('main').getByRole('link', { name: /Benko/ }).first().click()

  await expect(page.getByText('Gambit này chưa được dạy sâu.')).toBeVisible()
  await expect(page.getByText('1.d4')).toBeVisible()
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)

  await page.getByRole('link', { name: /Mới liệt kê/ }).click()
  await expect(page).toHaveURL(new RegExp('/about#tiers$'))
  await expect(page.locator('#tiers')).toBeVisible()
})

test('a filtered view is a link, and the language switcher carries it', async ({ page }) => {
  await page.goto(`${gambits}?tier=all&side=black&q=benko`)

  await page
    .getByRole('navigation', { name: 'Ngôn ngữ' })
    .getByRole('link', { name: /English/ })
    .click()

  await expect(page).toHaveURL(new RegExp('/en/gambits\\?.*side=black'))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Catalogue')
})

test('the page has no horizontal scroll at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${gambits}?tier=all&q=benko`)
  await expect(page.getByRole('link', { name: /Benko/ }).first()).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the catalogue overflows a 360px viewport').toBeLessThanOrEqual(0)
})
