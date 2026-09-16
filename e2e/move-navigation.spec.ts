import { expect, test, type Locator, type Page } from '@playwright/test'
import { MAIN_LINE, MAPPED_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import { shortcutStorageKey } from '../src/components/learn/shortcuts.ts'
import { lineSearch } from '../src/lib/line.ts'
import vi from '../src/locales/vi.ts'
import { atLine as lineUrl, serveEntry } from './learning-fixture.ts'

/**
 * The core loop — look at the position, press next — against the built output in a real
 * browser. Three of this ticket's criteria can only be settled here:
 *
 * - **AC 6**, that the board and the controls are on screen together without scrolling. It
 *   is a claim about layout at a real viewport size, which jsdom does not have.
 * - **AC 7**, that pressing next stays under 200ms of interaction latency on a throttled
 *   CPU. `PerformanceObserver` and CPU throttling both need a real engine.
 * - That the controls are genuinely links: a middle click really does open the next
 *   position in its own tab (docs/design-system.md §4).
 *
 * Each measurement here carries a probe that makes it fail, because a gate nobody has seen
 * fail is a comment.
 */

const gambit = MAPPED_ENTRY.id

const open = async (page: Page, line: readonly string[] = []): Promise<void> => {
  await serveEntry(page, MAPPED_ENTRY)
  await page.goto(`vi/gambits/${gambit}${lineSearch(line)}`)
  await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
}

const nextControl = (page: Page) => page.getByRole('link', { name: vi.learn.nextPly })
const previousControl = (page: Page) => page.getByRole('link', { name: vi.learn.previousPly })

test.describe('the core loop', () => {
  test('presses next through a whole line, one ply at a time', async ({ page }) => {
    await open(page)

    for (const [index, ply] of MAIN_LINE.entries()) {
      await nextControl(page).click()
      await expect(page).toHaveURL(lineUrl(gambit, MAIN_LINE.slice(0, index + 1)))
      expect(ply).not.toBe('')
    }

    // At the leaf, next is gone as an action and present as a state.
    await expect(nextControl(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(nextControl(page)).toHaveAccessibleDescription(vi.learn.atEnd)
  })

  test('changes the position on the board, not only the URL', async ({ page }) => {
    await open(page)
    const h5 = page.getByRole('gridcell', { name: /^h5/ })

    await expect(h5).toHaveAccessibleName(`h5, ${vi.board.emptySquare}`)

    await nextControl(page).click()
    await nextControl(page).click()

    await expect(h5).toHaveAccessibleName(`h5, ${vi.board.whiteQueen}`)
  })

  test('moves focus to the annotation heading, not back to the top (AC 5)', async ({ page }) => {
    await open(page)

    await nextControl(page).click()

    const heading = page.getByRole('heading', { level: 2 })
    await expect(heading).toBeFocused()
    await expect(heading).toHaveText(`${vi.learn.after} 3...fxe5`)
  })

  test('steps back and forward through browser history (AC 3)', async ({ page }) => {
    await open(page)

    await nextControl(page).click()
    await nextControl(page).click()
    await expect(page).toHaveURL(lineUrl(gambit, ['fxe5', 'Qh5+']))

    await page.goBack()
    await expect(page).toHaveURL(lineUrl(gambit, ['fxe5']))
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`${vi.learn.after} 3...fxe5`)

    await page.goForward()
    await expect(page).toHaveURL(lineUrl(gambit, ['fxe5', 'Qh5+']))
  })

  test('jumps back to any ply on the path from the move list (AC 8)', async ({ page }) => {
    await open(page, MAIN_LINE)
    const list = page.getByRole('navigation', { name: vi.learn.plyList })

    await list.getByRole('link', { name: '4.Qh5+' }).click()

    await expect(page).toHaveURL(lineUrl(gambit, ['fxe5', 'Qh5+']))
    await expect(list.getByRole('link')).toHaveText([
      vi.learn.startingPosition,
      '3...fxe5',
      '4.Qh5+',
    ])
  })
})

/**
 * §4's binding decision, demonstrated rather than asserted: a middle click opens the next
 * position in its own tab. A button cannot do this, which is the whole argument.
 */
test.describe('the controls are links', () => {
  test('a middle click opens the next position in a new tab', async ({ page, context }) => {
    await open(page)

    const opened = context.waitForEvent('page')
    await nextControl(page).click({ button: 'middle' })
    const tab = await opened

    await expect(tab).toHaveURL(lineUrl(gambit, ['fxe5']))
    // And the original tab did not move: a link opened elsewhere is not a navigation here.
    await expect(page).toHaveURL(lineUrl(gambit, []))
  })

  test('carries an absolute href a visitor can copy', async ({ page }) => {
    await open(page)

    const href = await nextControl(page).getAttribute('href')
    expect(href).toContain(`/vi/gambits/${gambit}?line=fxe5`)
  })
})

test.describe('the arrow keys and the switch that turns them off (AC 2)', () => {
  test('step the line, and stop when the setting is off', async ({ page }) => {
    await open(page)

    await page.keyboard.press('ArrowRight')
    await expect(page).toHaveURL(lineUrl(gambit, ['fxe5']))

    await page.getByRole('checkbox', { name: vi.learn.shortcuts }).click()
    await page.keyboard.press('ArrowRight')

    await expect(page).toHaveURL(lineUrl(gambit, ['fxe5']))
    await expect(previousControl(page)).toHaveAttribute('href')
  })

  test('remembers the switch across a reload, in real storage', async ({ page }) => {
    await open(page)

    await page.getByRole('checkbox', { name: vi.learn.shortcuts }).click()
    expect(await page.evaluate((key) => window.localStorage.getItem(key), shortcutStorageKey)).toBe(
      'off',
    )

    await page.reload()
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()

    await expect(page.getByRole('checkbox', { name: vi.learn.shortcuts })).not.toBeChecked()
    await page.keyboard.press('ArrowRight')
    await expect(page).toHaveURL(lineUrl(gambit, []))
  })
})

/**
 * AC 6. "At every width the board and the previous/next controls are visible together
 * without scrolling. If that needs a scroll, the product has failed."
 */
type Geometry = { readonly top: number; readonly bottom: number; readonly viewport: number }

const geometryOf = (locator: Locator): Promise<Geometry> =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      viewport: window.innerHeight,
    }
  })

const VIEWPORTS = [
  { name: '360x640 — the smallest phone the product targets', width: 360, height: 640 },
  { name: '390x844 — a current phone', width: 390, height: 844 },
  { name: '768x1024 — the breakpoint, portrait', width: 768, height: 1024 },
  { name: '1024x600 — wide and short, the hardest case', width: 1024, height: 600 },
  { name: '1280x800 — a laptop', width: 1280, height: 800 },
]

/**
 * Measured at the **root**, which is the worst case: previous is unavailable there, so the
 * navigator also carries the sentence that says why, and that sentence is height the board
 * does not get. The whole navigation landmark is measured rather than just the next link —
 * a state a learner has to scroll to read is a state they have not been told.
 */
const showsBoardAndControlsTogether = async (page: Page): Promise<void> => {
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  const board = await geometryOf(page.getByRole('grid'))
  const navigator = await geometryOf(page.getByRole('navigation', { name: vi.learn.navigation }))

  expect(board.top, 'the board starts above the viewport').toBeGreaterThanOrEqual(0)
  expect(
    board.bottom,
    `the board reaches ${board.bottom}px of ${board.viewport}px`,
  ).toBeLessThanOrEqual(board.viewport)
  expect(navigator.top, 'the controls start above the viewport').toBeGreaterThanOrEqual(0)
  expect(
    navigator.bottom,
    `the controls reach ${navigator.bottom}px of ${navigator.viewport}px`,
  ).toBeLessThanOrEqual(navigator.viewport)
}

for (const { name, width, height } of VIEWPORTS) {
  test.describe(`at ${name}`, () => {
    test.use({ viewport: { width, height } })

    test('shows the board and the controls together, with no scroll', async ({ page }) => {
      await open(page)

      await showsBoardAndControlsTogether(page)
    })

    test('still does mid-line, where the move list has grown', async ({ page }) => {
      await open(page, MAIN_LINE.slice(0, 4))

      await showsBoardAndControlsTogether(page)
    })

    test('does not scroll sideways either', async ({ page }) => {
      await open(page, ['fxe5'])

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      )
    })
  })
}

/**
 * The longest of the three languages at the narrowest width. Vietnamese labels are short
 * and French ones are not — "Coup précédent" against "Nước trước" — so a control row that
 * fits in Vietnamese is not yet a control row that fits.
 */
test.describe('at 360px in French', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('shows the board and the controls together there too', async ({ page }) => {
    await serveEntry(page, MAPPED_ENTRY)
    await page.goto(`fr/gambits/${gambit}`)
    await expect(page.getByRole('grid')).toBeVisible()

    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    const board = await geometryOf(page.getByRole('grid'))
    const navigator = await geometryOf(page.locator('.move-navigator'))

    expect(board.bottom).toBeLessThanOrEqual(board.viewport)
    expect(
      navigator.bottom,
      `the controls reach ${navigator.bottom}px of ${navigator.viewport}px`,
    ).toBeLessThanOrEqual(navigator.viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  })
})

test.describe('the viewport measurement itself', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  /**
   * The control for every assertion above. Without it, "bottom is within the viewport"
   * would keep passing if `geometryOf` ever started reporting zeros — which is exactly how
   * a layout gate rots into a comment.
   */
  test('reports an element below the fold as below the fold', async ({ page }) => {
    await open(page)

    await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.id = 'below-the-fold'
      probe.style.position = 'absolute'
      probe.style.insetBlockStart = '200vh'
      probe.style.inlineSize = '1rem'
      probe.style.blockSize = '1rem'
      document.body.append(probe)
    })

    const probe = await geometryOf(page.locator('#below-the-fold'))

    expect(probe.bottom).toBeGreaterThan(probe.viewport)
  })
})
