import { expect, test, type Page } from '@playwright/test'
import { BRANCHING_ENTRY } from '../src/components/learn/tree-fixtures.ts'
import { lineSearch } from '../src/lib/line.ts'
import vi from '../src/locales/vi.ts'
import { atLine, serveEntry } from './learning-fixture.ts'

/**
 * The whole-tree view against the built output, for the three of its claims that no unit
 * test can settle:
 *
 * - the nodes are **links**, demonstrated by middle-clicking one into its own tab — a
 *   button cannot do it, which is the whole of §4's argument (AC 2);
 * - the page never scrolls sideways at any of the three widths, with the tree open
 *   (definition of done, "works from 360px wide with no horizontal scroll");
 * - and WCAG 2.2 *2.4.11 Focus Not Obscured* holds when the overlay opens and when it
 *   closes (AC 4) — which is a question about what is drawn on top of what, at a real
 *   viewport, and is answered here with `elementFromPoint` rather than with an intention.
 *
 * Each of the two measurements carries a probe that makes it fail, because a gate nobody
 * has seen fail is a comment.
 */

const gambit = BRANCHING_ENTRY.id
const TREE = vi.tree

const open = async (page: Page, line: readonly string[] = []): Promise<void> => {
  await serveEntry(page, BRANCHING_ENTRY)
  await page.goto(`vi/gambits/${gambit}${lineSearch(line)}`)
  await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
}

const nodeAt = (page: Page, name: RegExp) => page.getByRole('treeitem', { name })

/** How wide the document actually is, against how wide it is allowed to be. */
const documentWidth = (page: Page): Promise<{ scroll: number; client: number; height: number }> =>
  page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }))

/**
 * Whether the focused element is covered by something drawn over it.
 *
 * This is the whole of 2.4.11 made mechanical: take what has focus, and ask the document
 * what is actually painted at the middle of it. If the answer is not that element or
 * something inside it, a visitor looking for their focus ring is looking at whatever came
 * back instead.
 */
type FocusState = { readonly element: string; readonly obscured: boolean; readonly by: string }

const focusState = (page: Page): Promise<FocusState> =>
  page.evaluate(() => {
    const name = (element: Element): string => {
      const classes = element.getAttribute('class')
      return `${element.tagName.toLowerCase()}${classes === null ? '' : `.${classes}`}`
    }

    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return { element: 'none', obscured: true, by: 'nothing' }

    const box = active.getBoundingClientRect()
    if (box.width === 0 || box.height === 0)
      return { element: name(active), obscured: true, by: 'a box of no size' }

    const painted = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    if (painted === null)
      return { element: name(active), obscured: true, by: 'nothing — it is off screen' }

    const covered = painted !== active && !active.contains(painted) && !painted.contains(active)
    return { element: name(active), obscured: covered, by: covered ? name(painted) : '' }
  })

test.describe('the nodes are links (AC 2)', () => {
  test('a middle click opens that position in its own tab', async ({ page, context }) => {
    await open(page)

    const opened = context.waitForEvent('page')
    await nodeAt(page, /^7\.\.\.Nxc4/).click({ button: 'middle' })
    const tab = await opened

    /*
     * `commit` rather than the default `load`: the new tab opens in the background, where
     * Chromium throttles it, and waiting for it to finish loading makes the assertion a
     * measurement of how busy the machine is. The address is what a middle click has to
     * produce, and the address is committed the moment the navigation starts.
     */
    await tab.waitForURL(atLine(gambit, ['Nxe5', 'Qxh5', 'Nxc4']), { waitUntil: 'commit' })
    // And this tab did not move: a link opened elsewhere is not a navigation here.
    await expect(page).toHaveURL(atLine(gambit, []))
  })

  test('carries an absolute href a visitor can copy', async ({ page }) => {
    await open(page)

    expect(await nodeAt(page, /^6\.\.\.Bxd1/).getAttribute('href')).toContain(
      `/vi/gambits/${gambit}?line=Bxd1`,
    )
  })

  test('sets the board and the URL when one is followed (AC 1)', async ({ page }) => {
    await open(page)

    await nodeAt(page, /^6\.\.\.Bxd1/).click()

    await expect(page).toHaveURL(atLine(gambit, ['Bxd1']))
    await expect(page.getByRole('gridcell', { name: /^d1/ })).toHaveAccessibleName(
      `d1, ${vi.board.blackBishop}`,
    )
    await expect(nodeAt(page, /^6\.\.\.Bxd1/)).toHaveAttribute('aria-current', 'true')
  })
})

/**
 * §1's three layouts, measured at the three widths the definition of done names. Each one
 * also reports what it measured, so the numbers in a pull request are the numbers a
 * machine produced rather than the ones somebody remembered.
 */
const LAYOUTS = [
  { width: 360, height: 640, mode: 'a summary that opens an overlay' },
  { width: 768, height: 1024, mode: 'a disclosure' },
  { width: 1280, height: 800, mode: 'open at full width' },
]

for (const { width, height, mode } of LAYOUTS) {
  test.describe(`at ${width}px — ${mode} (AC 3)`, () => {
    test.use({ viewport: { width, height } })

    test('shows the layout §1 asks for at this width', async ({ page }) => {
      await open(page)

      if (width >= 1024) {
        await expect(page.getByRole('tree')).toBeVisible()
        await expect(page.getByRole('button', { name: TREE.show })).toHaveCount(0)
        await expect(page.getByRole('button', { name: TREE.hide })).toHaveCount(0)
      } else if (width >= 768) {
        await expect(page.getByRole('button', { name: TREE.hide })).toHaveAttribute(
          'aria-expanded',
          'true',
        )
        await expect(page.getByRole('tree')).toBeVisible()
      } else {
        await expect(page.getByRole('tree')).toHaveCount(0)
        await expect(page.getByRole('button', { name: TREE.show })).toBeVisible()

        await page.getByRole('button', { name: TREE.show }).click()
        const overlay = page.getByRole('dialog')
        await expect(overlay).toBeVisible()

        /*
         * Full-screen: the overlay is the viewport, not a card inside it. Measured against
         * the document's own client box rather than against the viewport size, because a
         * vertical scrollbar takes width out of the first and not out of the second.
         */
        const box = await overlay.boundingBox()
        const client = await documentWidth(page)
        expect(box?.width).toBe(client.client)
        expect(box?.height).toBe(client.height)
      }
    })

    test('does not scroll sideways, with the tree showing', async ({ page }) => {
      await open(page, ['Nxe5', 'Qxh5'])
      if (width < 768) await page.getByRole('button', { name: TREE.show }).click()
      await expect(page.getByRole('tree')).toBeVisible()

      const measured = await documentWidth(page)
      const region = await page.getByRole('tree').boundingBox()

      console.log(
        `[${width}x${height}] document ${measured.scroll}px of ${measured.client}px · tree ${Math.round(region?.width ?? 0)}x${Math.round(region?.height ?? 0)} at x=${Math.round(region?.x ?? 0)}`,
      )

      expect(
        measured.scroll,
        `the document is ${measured.scroll}px wide in a ${measured.client}px viewport`,
      ).toBeLessThanOrEqual(measured.client)
    })
  })
}

test.describe('the no-horizontal-scroll measurement itself', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  /** The control for every width above. A gate nobody has seen fail is a comment. */
  test('reports a document wider than its viewport as wider than its viewport', async ({
    page,
  }) => {
    await open(page)
    expect((await documentWidth(page)).scroll).toBeLessThanOrEqual(360)

    await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.inlineSize = '200vw'
      probe.style.blockSize = '1rem'
      document.body.append(probe)
    })

    const measured = await documentWidth(page)
    expect(measured.scroll).toBeGreaterThan(measured.client)
  })
})

/**
 * WCAG 2.2 *2.4.11 Focus Not Obscured*, Level AA (AC 4). The overlay covers the whole
 * viewport, so the only thing that keeps this true is where focus goes — into the overlay
 * as it opens, and back onto the control that opened it as it closes.
 */
test.describe('the overlay does not obscure the focused element (AC 4)', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  const toggle = (page: Page) => page.getByRole('button', { name: TREE.show })

  test('keeps the focused element on top when it opens', async ({ page }) => {
    await open(page)
    await toggle(page).focus()
    await toggle(page).press('Enter')

    const overlay = page.getByRole('dialog')
    await expect(overlay).toBeVisible()
    await expect(page.getByRole('button', { name: TREE.close })).toBeFocused()

    const state = await focusState(page)
    console.log(`[open] focus on ${state.element}, obscured: ${state.obscured}`)
    expect(state.obscured, `${state.element} is covered by ${state.by}`).toBe(false)
  })

  test('keeps the focused element on top when it closes', async ({ page }) => {
    await open(page)
    await toggle(page).click()
    await page.getByRole('button', { name: TREE.close }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(toggle(page)).toBeFocused()

    const state = await focusState(page)
    console.log(`[close] focus on ${state.element}, obscured: ${state.obscured}`)
    expect(state.obscured, `${state.element} is covered by ${state.by}`).toBe(false)
  })

  test('closes on Escape and lands focus in the same place', async ({ page }) => {
    await open(page)
    await toggle(page).click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(toggle(page)).toBeFocused()
    expect((await focusState(page)).obscured).toBe(false)
  })

  test('keeps the tab key inside it, so focus cannot get behind it', async ({ page }) => {
    await open(page)
    await toggle(page).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press('Tab')
      const state = await focusState(page)
      expect(state.obscured, `${state.element} is covered by ${state.by}`).toBe(false)
    }
  })

  /**
   * The control for the four tests above. Without it, "obscured is false" would keep
   * passing if `elementFromPoint` ever started answering with the focused element whatever
   * was drawn over it — which is exactly how an accessibility gate rots into a comment.
   */
  test('reports a covered element as covered', async ({ page }) => {
    await open(page)
    await toggle(page).focus()
    expect((await focusState(page)).obscured).toBe(false)

    await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'probe'
      probe.style.position = 'fixed'
      probe.style.inset = '0'
      probe.style.zIndex = '99'
      probe.style.background = 'black'
      document.body.append(probe)
    })

    const state = await focusState(page)
    expect(state.obscured).toBe(true)
    expect(state.by).toBe('div.probe')
  })
})

/**
 * AC 5 and AC 7 in a real engine: the refutation is opt-in, and the arrow keys belong to
 * the tree rather than to the line while focus is inside it.
 */
test.describe('the refutation control and the keyboard', () => {
  test('hides the proved sequence until it is asked for', async ({ page }) => {
    await open(page)

    await expect(page.getByText('Bxf7+ Ke7 Nd5#')).toHaveCount(0)

    await page.getByRole('checkbox', { name: TREE.showRefutation }).check()

    await expect(page.getByText('Bxf7+ Ke7 Nd5#')).toBeVisible()
  })

  test('is one tab stop, and moves between nodes with the arrow keys', async ({ page }) => {
    await open(page)
    await nodeAt(page, new RegExp(`^${vi.learn.startingPosition}`)).focus()

    await page.keyboard.press('ArrowDown')
    await expect(nodeAt(page, /^6\.\.\.Bxd1/)).toBeFocused()

    await page.keyboard.press('End')
    await expect(nodeAt(page, /^7\.\.\.Ng6/)).toBeFocused()

    // And none of that stepped the line, which Left and Right do everywhere else (#8).
    await expect(page).toHaveURL(atLine(gambit, []))
  })

  test('leaves the line keys alone once focus is outside the tree', async ({ page }) => {
    await open(page)

    /*
     * The learning surface attaches its window listener in an effect, which React flushes
     * *after* the paint that made the landmark visible. Waiting for the landmark is
     * therefore not yet waiting for the shortcut to be live, and a press that lands in that
     * gap is swallowed — which is a race in the test, not in the page. `networkidle` is
     * half a second past the last request, which is several orders of magnitude more than
     * the flush needs.
     */
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('ArrowRight')

    await expect(page).toHaveURL(atLine(gambit, ['Bxd1']))
  })
})
