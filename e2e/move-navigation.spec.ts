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
    // The defining line leads the list since #70: one walk from move one, not two (AC 1).
    await expect(list.getByRole('link')).toHaveText([
      vi.learn.startingPosition,
      '1.e4',
      '1...e5',
      '2.Nf3',
      '2...f6',
      '3.Nxe5',
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

/**
 * **The ply that produced the position, on the board (issue #54).**
 *
 * `Board` has drawn this since #4 and no caller passed it a move for four waves, so the
 * assertions here are about the shipped surface: what a browser paints after a real click,
 * at a real viewport, with the real stylesheet.
 *
 * **The greyscale check, and what it now measures (2026-09-18, then 2026-09-18 again).**
 * §2's "a shape or border difference, not only a tint" carries a documented exception for
 * exactly this highlight: both squares are a plain background colour and nothing is drawn
 * on top of either. The two squares were briefly distinguishable by luminance alone; they
 * are now the same token, by product decision, so the greyscale check below is "do the two
 * squares read as one identical fill" rather than "are they still two" — the opposite claim
 * from before, and just as checkable.
 */
test.describe('the last-ply highlight', () => {
  /** `f6-e5`: which two squares a board marks, read back off the tinted squares' geometry. */
  const marked = (page: Page, scope: string): Promise<string> =>
    page.evaluate((selector) => {
      const board = document.querySelector(selector)
      const square = (tinted: Element | null): string => {
        if (tinted === null) return ''
        const x = Math.round(Number(tinted.getAttribute('x')))
        const y = Math.round(Number(tinted.getAttribute('y')))
        return `${'abcdefgh'[x] ?? '?'}${8 - y}`
      }
      const from = square(board?.querySelector('.board__square--from') ?? null)
      const to = square(board?.querySelector('.board__square--to') ?? null)
      return from === '' || to === '' ? '' : `${from}-${to}`
    }, scope)

  const BOARD = '.learning-surface__board'

  test('marks the two squares of the ply just played, and moves with the line', async ({
    page,
  }) => {
    await open(page)
    /*
     * The root marks the defining line's last ply since #70. It used to mark nothing, on the
     * reasoning that the move had never been shown — and the walk from move one is exactly
     * what made that untrue. The unmarked board is now the initial position, asserted in
     * `defining-line.spec.ts`.
     */
    await expect.poll(() => marked(page, BOARD)).toBe('f3-e5')

    // Polled rather than read once: `toHaveURL` resolves on the address bar, and the
    // commit that paints the new position lands a tick later.
    await nextControl(page).click()
    await expect(page).toHaveURL(lineUrl(gambit, ['fxe5']))
    await expect.poll(() => marked(page, BOARD)).toBe('f6-e5')

    await nextControl(page).click()
    await expect.poll(() => marked(page, BOARD)).toBe('d1-h5')

    await previousControl(page).click()
    await expect.poll(() => marked(page, BOARD)).toBe('f6-e5')

    // Back to the root, which since #70 marks the defining line's last ply rather than
    // nothing: the walk continues behind it, so there is a "what just changed" to answer.
    await previousControl(page).click()
    await expect.poll(() => marked(page, BOARD)).toBe('f3-e5')
  })

  /**
   * The same mark, on the two ways of arriving that nobody walks a tree for.
   *
   * The test above steps there with the controls, so the surface has been through every
   * position on the way and could have remembered the previous one. Neither of these does.
   * A shared URL is this product's headline feature — "copy this and send it to someone" —
   * and it lands the reader in the middle of a line having pressed nothing, which is the
   * case a highlight is worth the most and the only one nothing was checking. Browser back
   * and forward are the second: they restore a URL rather than walking, and this surface has
   * already had one bug where a handler read navigation state a commit out of date.
   *
   * A wrong highlight has no symptom — it is a plausible-looking ring on the wrong square —
   * so the positions are named rather than compared to each other.
   */
  test('marks the ply on a link that arrives mid-line, and through browser history', async ({
    page,
  }) => {
    await open(page, ['fxe5', 'Qh5+'])
    await expect.poll(() => marked(page, BOARD)).toBe('d1-h5')

    await previousControl(page).click()
    await expect.poll(() => marked(page, BOARD)).toBe('f6-e5')

    await page.goBack()
    await expect.poll(() => marked(page, BOARD)).toBe('d1-h5')

    await page.goForward()
    await expect.poll(() => marked(page, BOARD)).toBe('f6-e5')
  })

  /**
   * Reduced motion for this pair of tests only: `Board.css` transitions `fill` over
   * `--duration-base` (200ms), and setting a square's fill from a probe would otherwise be
   * read back mid-transition — an interpolated colour that is neither the old value nor the
   * new one, and single-handedly the reason the first version of this probe failed with a
   * `false negative` (colours it had itself just made equal still read as two). The global
   * stylesheet turns every transition off under this preference (`!important`), which is
   * the same mechanism a real reduced-motion visitor gets, not a test-only shortcut.
   */
  test.describe('read without a colour transition in flight', () => {
    test.use({ reducedMotion: 'reduce' })

    /** What a desaturated screenshot still carries: each square's resolved fill. */
    const fills = (page: Page): Promise<readonly string[]> =>
      page.evaluate(() =>
        ['.board__square--from', '.board__square--to'].map((selector) => {
          const square = document.querySelector(`.learning-surface__board ${selector}`)
          return square === null ? '' : window.getComputedStyle(square).fill
        }),
      )

    const greyscale = (page: Page) =>
      page.evaluate(() => {
        document.documentElement.style.filter = 'grayscale(1)'
      })

    test('reads both last-ply squares as the identical fill, with the colour gone', async ({
      page,
    }) => {
      await open(page, ['fxe5'])
      await expect(page.locator(`${BOARD} .board__square--from`)).toHaveCount(1)
      await expect(page.locator(`${BOARD} .board__square--to`)).toHaveCount(1)
      await greyscale(page)

      const resolved = await fills(page)
      for (const fill of resolved) expect(fill).not.toBe('')
      expect(new Set(resolved).size, `squares read as ${resolved.join(' / ')}`).toBe(1)
    })

    /**
     * The probe. The assertion above compares two signals, so without this it would keep
     * passing if the selectors stopped resolving anything — which is exactly how a
     * colour-alone check rots into a comment.
     */
    test('reports two squares of different fills as different things', async ({ page }) => {
      await open(page, ['fxe5'])
      await expect(page.locator(`${BOARD} .board__square--from`)).toHaveCount(1)
      await greyscale(page)
      expect(new Set(await fills(page)).size).toBe(1)

      /*
       * Paint the departed square a colour the arrival square does not have and the two
       * stop reading as one fill — exactly the failure mode a regression back to the old
       * two-tint design would look like.
       *
       * Written through CSSOM rather than `setAttribute('style', …)`, which the Content
       * Security Policy #19 introduced refuses without `'unsafe-inline'`. A refused
       * attribute does not throw: the probe would have gone on running, changed nothing,
       * and left this assertion failing for a reason that has nothing to do with the fills.
       */
      await page.evaluate(() => {
        const from = document.querySelector('.learning-surface__board .board__square--from')
        if (from instanceof SVGElement) {
          from.style.fill = 'rgb(0, 0, 0)'
        }
      })

      expect(new Set(await fills(page)).size).toBe(2)
    })
  })
})
