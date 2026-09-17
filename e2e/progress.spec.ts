import { expect, test, type Locator, type Page } from '@playwright/test'
import { MATE_ENTRY, MATE_LINE } from '../src/components/learn/learn-fixtures.ts'
import { branchKey } from '../src/components/progress/branches.ts'
import {
  progressSchemaVersion,
  progressStorageKey,
} from '../src/components/progress/progress-storage.ts'
import { lineSearch } from '../src/lib/line.ts'
import fr from '../src/locales/fr.ts'
import vi from '../src/locales/vi.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * Progress against the built output in a real browser, because three of this ticket's
 * criteria are claims no unit test can settle:
 *
 * - **AC 2**, that a mark survives a reload. jsdom's `localStorage` is a polyfill and a
 *   re-render is not a reload; this is the same bundle a visitor gets, in the same storage.
 * - **AC 4**, that data written by a different schema version is discarded *and said out
 *   loud*, starting from a blob genuinely sitting in the browser's storage.
 * - **AC 7**, that nothing is sent anywhere. Only a browser can be watched for everything a
 *   browser is able to send.
 *
 * Légal's Mate is the fixture, because it has exactly **one** countable branch and that branch
 * is a proved mate — the branch this product exists to teach, and a denominator of 1 that says
 * what it means in every count below. Since #46 the mate is claimed on `6...Bxd1` and the
 * mating move lives in the proof, so the path carries no `+` and no `#`; the encoding of those
 * is held where they are real, by `branches.test.ts` and `e2e/line-parameter.spec.ts`. What
 * this file still depends on is that a branch is keyed exactly as the URL spells it, because a
 * key that disagreed with the path would mean a mark that never came back.
 */

const gambit = MATE_ENTRY.id
const MARKED_BRANCH = branchKey(MATE_LINE)

const count = (learned: number, total: number): string =>
  vi.progress.count.replace('{{learned}}', String(learned)).replace('{{total}}', String(total))

const panel = (page: Page): Locator => page.getByRole('region', { name: vi.progress.heading })
const marker = (page: Page): Locator => page.getByRole('button', { name: vi.progress.learned })
const undo = (page: Page): Locator => page.getByRole('button', { name: vi.progress.undo })

const open = async (page: Page, line: readonly string[] = MATE_LINE): Promise<void> => {
  await serveEntry(page, MATE_ENTRY)
  await page.goto(`vi/gambits/${gambit}${lineSearch(line)}`)
  await expect(panel(page)).toBeVisible()
}

const storedProgress = (page: Page): Promise<unknown> =>
  page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  }, progressStorageKey)

const seed = (page: Page, version: number, entries: unknown): Promise<void> =>
  page.evaluate(
    ([key, blob]) => window.localStorage.setItem(key ?? '', blob ?? ''),
    [progressStorageKey, JSON.stringify({ version, entries })],
  )

test.describe('marking a branch, in a real browser', () => {
  test('marks it, counts it, and keeps it across a reload (AC 1, AC 2)', async ({ page }) => {
    await open(page)
    await expect(panel(page)).toContainText(count(0, 1))

    await marker(page).click()

    await expect(marker(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page)).toContainText(count(1, 1))
    expect(await storedProgress(page)).toEqual({
      version: progressSchemaVersion,
      entries: { [gambit]: [MARKED_BRANCH] },
    })

    await page.reload()

    await expect(marker(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page)).toContainText(count(1, 1))
  })

  test('unmarks with no confirmation, and the undo puts it back (AC 1)', async ({ page }) => {
    await open(page)
    await marker(page).click()

    await marker(page).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(panel(page)).toContainText(vi.progress.unmarked)
    await expect(panel(page)).toContainText(count(0, 1))

    await undo(page).click()

    await expect(marker(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page)).toContainText(count(1, 1))
    // Focus goes somewhere sensible after the action: back onto the control, not to the top
    // of the document, which is where it lands when a focused button is simply removed.
    await expect(marker(page)).toBeFocused()
  })

  test('is reachable and operable from the keyboard alone', async ({ page }) => {
    await open(page)

    await marker(page).focus()
    await page.keyboard.press('Space')
    await expect(marker(page)).toHaveAttribute('aria-pressed', 'true')

    await page.keyboard.press('Space')
    await expect(marker(page)).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.press('Tab')
    await expect(undo(page)).toBeFocused()
  })

  test('offers no control mid-line, and says why', async ({ page }) => {
    await open(page, MATE_LINE.slice(0, 2))

    await expect(panel(page)).toContainText(vi.progress.atBranchEnd)
    await expect(marker(page)).toHaveCount(0)
  })

  test('shows a count and never a percentage (AC 5)', async ({ page }) => {
    await open(page)
    await marker(page).click()

    await expect(panel(page)).toContainText(count(1, 1))
    expect(await panel(page).textContent()).not.toContain('%')
  })
})

/**
 * 360px is the smallest phone the product targets and the primary device. Measured in the
 * panel's *widest* state — count, control and the undo offer all on screen at once — because
 * that is the one a narrower test would never reach, and in French, whose labels are the
 * longest of the three ("Annuler" over "Hoàn tác", and a notice sentence to match).
 */
test.describe('at 360px, the width the product targets', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  const overflowing = (page: Page): Promise<readonly string[]> =>
    page.evaluate(() => {
      const limit = document.documentElement.clientWidth
      return [...document.querySelectorAll('.gambit-progress *')]
        .filter((element) => element.getBoundingClientRect().right > limit + 1)
        .map((element) => `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`)
    })

  /** French over the source locale: `fr.ts` is typed as a subset of `vi.ts`. */
  const FR = { ...vi.progress, ...fr.progress }

  test('fits with the control and the undo offer both showing', async ({ page }) => {
    await serveEntry(page, MATE_ENTRY)
    await page.goto(`fr/gambits/${gambit}${lineSearch(MATE_LINE)}`)

    const region = page.getByRole('region', { name: FR.heading })
    const toggle = page.getByRole('button', { name: FR.learned })
    await expect(region).toBeVisible()

    await toggle.click()
    await toggle.click()
    await expect(page.getByRole('button', { name: FR.undo })).toBeVisible()

    expect(await overflowing(page)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  })
})

/**
 * AC 4. The half that matters is *not silently*: a learner whose marks vanished has to be
 * told, or the first content-schema change wipes everyone's progress and looks like nothing
 * happened.
 */
test.describe('stored data carries a schema version (AC 4)', () => {
  test('discards an unrecognised version, says so, and replaces it', async ({ page }) => {
    await open(page)
    await seed(page, progressSchemaVersion + 1, { [gambit]: [MARKED_BRANCH] })
    await page.reload()

    await expect(panel(page)).toContainText(vi.progress.versionDiscarded)
    await expect(panel(page)).toContainText(count(0, 1))
    await expect(marker(page)).toHaveAttribute('aria-pressed', 'false')

    // Discarded means discarded: the unreadable envelope is gone, so the notice is shown
    // once rather than on every page load for the rest of this browser's life.
    expect(await storedProgress(page)).toEqual({
      version: progressSchemaVersion,
      entries: {},
    })

    await page.reload()
    await expect(panel(page)).not.toContainText(vi.progress.versionDiscarded)
  })

  /**
   * The control. Without it the test above would pass just as well against a panel that
   * showed the notice unconditionally and never read anything at all.
   */
  test('reads the same payload at the version this build writes, with no notice', async ({
    page,
  }) => {
    await open(page)
    await seed(page, progressSchemaVersion, { [gambit]: [MARKED_BRANCH] })
    await page.reload()

    await expect(panel(page)).not.toContainText(vi.progress.versionDiscarded)
    await expect(panel(page)).toContainText(count(1, 1))
    await expect(marker(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('treats a hand-edited blob as no saved progress, silently (AC 3)', async ({ page }) => {
    await open(page)
    await page.evaluate(
      (key) => window.localStorage.setItem(key, '{{ not json'),
      progressStorageKey,
    )
    await page.reload()

    await expect(panel(page)).toContainText(count(0, 1))
    await expect(panel(page)).not.toContainText(vi.progress.versionDiscarded)
  })
})

/**
 * **AC 7. Nothing is sent anywhere.**
 *
 * Progress is the one feature on this site that would tempt a sync, and requirement N8 is
 * zero third-party requests at runtime — so this records *every* request the page makes,
 * with no filter and no allow-list, and requires the list to be empty.
 *
 * An empty list is worth nothing unless the recorder can fill one, so the block ends by
 * sending something down each of the three channels a page has and requiring every one to
 * be seen. Without that, this file would keep passing on the day somebody wired a beacon
 * into the marker, and this project has already shipped one gate that could not fail.
 */
test.describe('nothing is sent anywhere (AC 7)', () => {
  const recordEverything = (page: Page): readonly string[] => {
    const seen: string[] = []
    page.on('request', (request) => seen.push(`${request.method()} ${request.url()}`))
    page.on('websocket', (socket) => seen.push(`WS ${socket.url()}`))
    return seen
  }

  const collector = (): string => {
    const base = test.info().project.use.baseURL
    if (base === undefined) throw new Error('no baseURL configured')
    return new URL('collect-probe', base).toString()
  }

  test('no request results from marking, unmarking or undoing', async ({ page }) => {
    await open(page)
    // Recording starts only once the page has finished loading itself, so what is left is
    // exactly what marking causes.
    await page.waitForLoadState('networkidle')
    const seen = recordEverything(page)

    await marker(page).click()
    await expect(marker(page)).toHaveAttribute('aria-pressed', 'true')
    await marker(page).click()
    await undo(page).click()
    await expect(marker(page)).toHaveAttribute('aria-pressed', 'true')
    await page.waitForLoadState('networkidle')

    expect(seen).toEqual([])
  })

  test('no request results from reading progress back on a reload', async ({ page }) => {
    await open(page)
    await marker(page).click()
    await expect(panel(page)).toContainText(count(1, 1))
    await page.reload()
    await expect(panel(page)).toContainText(count(1, 1))
    await page.waitForLoadState('networkidle')

    const seen = recordEverything(page)
    await page.waitForTimeout(500)

    expect(seen).toEqual([])
  })

  /**
   * The probe, and the reason the two assertions above are statements about the application
   * rather than about a listener nothing was ever able to reach. Each of `fetch`,
   * `navigator.sendBeacon` and `WebSocket` is used once and required to show up.
   */
  test('the recorder catches every channel it claims to watch', async ({ page }) => {
    await open(page)
    await page.waitForLoadState('networkidle')
    const seen = recordEverything(page)
    const url = collector()

    await page.evaluate((target) => fetch(target).catch(() => undefined), url)
    await expect.poll(() => seen.filter((line) => line.startsWith('GET'))).toHaveLength(1)

    await page.evaluate((target) => window.navigator.sendBeacon(target, 'marked'), url)
    await expect.poll(() => seen.filter((line) => line.startsWith('POST'))).toHaveLength(1)

    await page.evaluate((target) => {
      new WebSocket(target.replace(/^http/, 'ws'))
    }, url)
    await expect.poll(() => seen.filter((line) => line.startsWith('WS '))).toHaveLength(1)
  })
})
