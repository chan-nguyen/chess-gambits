import { expect, test } from '@playwright/test'
import { z } from 'zod'
import {
  progressSchemaVersion,
  progressStorageKey,
} from '../src/components/progress/progress-storage.ts'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'

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

/**
 * The part of the shipped payload the stale-mark test below reads, and it is read through a
 * schema rather than poked at: a file that shipped with the keys missing would otherwise be
 * indistinguishable from an entry with nothing to learn, and the test would pass on it.
 *
 * `isCatalogue` from `src/lib/catalogue.ts` says the same thing and is not importable here —
 * it reaches `import.meta.env` through `base-path.ts`, and the end-to-end project has no Vite
 * types. `src/lib/catalogue.test.ts` is where that guard is held to this shape.
 */
const shippedEntries = z.object({
  families: z.array(
    z.object({
      entries: z.array(z.object({ id: z.string(), branchKeys: z.array(z.string()) })),
    }),
  ),
})

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
 * 1,003 of the 1,010 entries and is the worst case for the *matching*; `5` after a `C`
 * narrows 848 ECO matches to 85, the largest result set the page still expands, and is the
 * worst case for the *rendering*; `q` matches twenty-four.
 *
 * All three scan every one of the thousand entries — `applyFilter` has no early exit — so
 * "over the full generated catalogue" holds for each of them.
 */
test('filtering the full catalogue answers in under 100ms', async ({ page }) => {
  const cases: readonly { readonly from: string; readonly key: string; readonly then: RegExp }[] = [
    { from: '', key: 'b', then: /Đang hiện 1011/ },
    { from: 'C', key: '5', then: /Đang hiện 87/ },
    { from: '', key: 'q', then: /Đang hiện 24 / },
  ]

  for (const { from, key, then } of cases) {
    await page.goto(`${gambits}?tier=all${from === '' ? '' : `&q=${from}`}`)
    const status = page.getByRole('main').getByRole('status')
    await expect(status).toContainText('trong 1024 mục')

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
  /*
   * The Benko itself is taught since #15, so the listed example here is its sibling, and
   * it is addressed by id rather than by position in the list — "the first Benko row" is
   * a different entry every time content lands, and this test is about the *listed* state,
   * which needs a sibling with **no content file at all** (a missing file is what routes to
   * `EmptyTree`, docs/CONTEXT.md — an authored-but-unmapped file instead renders its own,
   * different "branch not mapped" state). `benko-gambit-accepted` and
   * `benko-gambit-declined-bishop-attack` were this sibling until #102 mapped them, so
   * `benko-gambit-mutkin-countergambit`, still unauthored, is the one addressed here now.
   */
  await page
    .getByRole('main')
    .locator(`a[href$="/vi/${routeSegments.catalogue}/benko-gambit-mutkin-countergambit"]`)
    .click()

  await expect(page.getByText('Gambit này chưa được dạy sâu.')).toBeVisible()
  await expect(page.getByText('1.d4')).toBeVisible()
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)

  await page.getByRole('link', { name: /Mới liệt kê/ }).click()
  await expect(page).toHaveURL(new RegExp('/about#tiers$'))
  await expect(page.locator('#tiers')).toBeVisible()
})

/**
 * **Issue #48, in a real browser and against the payload that actually shipped.**
 *
 * A card and the gambit page it links to have to print the same count, and the case they
 * used to differ on is a mark that outlived its branch — which content churn produces and
 * which nothing in the product prevents. The card clamped the number of keys in storage to
 * the total it was given; the page intersected with the keys its tree has. One stale key and
 * the card said "2 of 9" where the page said "1 of 9".
 *
 * `card-and-page-agree.test.tsx` pins the same thing over a fixture. This is the half a unit
 * test cannot reach: that the built catalogue really carries the keys, in the spelling a
 * stored mark is written in, for an entry the site actually publishes. A build that emitted
 * an empty list, or the path spelled some other way, would pass every unit test in the repo
 * and print every taught entry as untouched here.
 *
 * The real key is read out of the shipped file rather than recomputed from `content/`, on
 * purpose: what a learner's browser intersects against is the file, so the file is what has
 * to be right.
 */
test('a stale mark leaves the card and the page saying the same thing', async ({
  page,
  request,
}) => {
  const payload: unknown = await (
    await request.get(`${basePath}catalogue/catalogue.vi.json`)
  ).json()

  const entry = shippedEntries
    .parse(payload)
    .families.flatMap((family) => family.entries)
    .find((candidate) => candidate.id === 'benko-gambit')
  if (entry === undefined) throw new Error('no benko-gambit in the shipped catalogue')

  const keys = entry.branchKeys
  expect(keys.length, 'the Benko ships no branch keys, so there is nothing to intersect').toBe(9)

  const [real] = keys
  if (real === undefined) throw new Error('unreachable: the length is asserted above')

  /*
   * A key shaped like the others and named by none of them — a branch that was renamed away
   * after the learner marked it. Asserted absent rather than assumed, so a content change
   * that happened to create this line turns this test red instead of quietly neutering it.
   */
  const stale = `${real}_Kd8`
  expect(keys).not.toContain(stale)

  await page.addInitScript(
    ([key, blob]) => window.localStorage.setItem(key ?? '', blob ?? ''),
    [
      progressStorageKey,
      JSON.stringify({
        version: progressSchemaVersion,
        entries: { 'benko-gambit': [real, stale] },
      }),
    ],
  )

  const expected = vi.progress.count
    .replace('{{learned}}', '1')
    .replace('{{total}}', String(keys.length))

  await page.goto(`${gambits}?q=benko`)
  const card = page
    .getByRole('main')
    .locator('li.gambit-card')
    .filter({ has: page.locator(`a[href$="/vi/${routeSegments.catalogue}/benko-gambit"]`) })

  await expect(card).toHaveCount(1)
  await expect(card).toContainText(expected)

  await card.getByRole('link', { name: /Benko/ }).click()

  await expect(page.getByRole('region', { name: vi.progress.heading })).toContainText(expected)
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

/**
 * The round trip nothing else makes: the page **writes** a key, the card **reads** one.
 *
 * The stale-mark test above seeds storage with a key taken out of the shipped payload, so it
 * proves the card reads what the build wrote. It cannot prove the other half — that what the
 * *page* writes when a learner presses the marker is spelled the same way. Seed both sides
 * from the same source and a mismatch between them is invisible by construction: every card
 * on the site would read "0 of 9" for a learner who had marked nine branches, and every test
 * in the repo would still be green.
 *
 * So nothing is seeded here. A branch is marked the way a learner marks it, and the catalogue
 * is asked what it thinks afterwards.
 */
test('a branch marked on the page is the one the card counts', async ({ page, request }) => {
  const payload: unknown = await (
    await request.get(`${basePath}catalogue/catalogue.vi.json`)
  ).json()

  const entry = shippedEntries
    .parse(payload)
    .families.flatMap((family) => family.entries)
    .find((candidate) => candidate.id === 'benko-gambit')
  if (entry === undefined) throw new Error('no benko-gambit in the shipped catalogue')

  const [branch] = entry.branchKeys
  if (branch === undefined) throw new Error('the Benko ships no branch keys')

  // The key is the URL spelling of the line, which is what makes it addressable at all.
  await page.goto(`${basePath}vi/${routeSegments.catalogue}/benko-gambit?line=${branch}`)

  const panel = page.getByRole('region', { name: vi.progress.heading })
  await expect(panel).toBeVisible()

  const marker = page.getByRole('button', { name: vi.progress.learned })
  await expect(marker, `${branch} is not a markable branch end`).toBeVisible()
  await marker.click()

  const expected = vi.progress.count
    .replace('{{learned}}', '1')
    .replace('{{total}}', String(entry.branchKeys.length))

  await expect(panel).toContainText(expected)

  await page.goto(`${gambits}?q=benko`)
  const card = page
    .getByRole('main')
    .locator('li.gambit-card')
    .filter({ has: page.locator(`a[href$="/vi/${routeSegments.catalogue}/benko-gambit"]`) })

  await expect(card).toHaveCount(1)
  await expect(card).toContainText(expected)
})
