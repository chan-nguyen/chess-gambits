import { expect, test, type Locator, type Page } from '@playwright/test'
import { EVANS_ENTRY, PLAN_LINE, WIDE_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import { shortcutStorageKey } from '../src/components/learn/shortcuts.ts'
import { lineSearch } from '../src/lib/line.ts'
import type { CompiledEntry } from '../src/lib/content-types.ts'
import vi from '../src/locales/vi.ts'
import { atLine as lineUrl, serveEntry } from './learning-fixture.ts'

/**
 * "What if my opponent plays something else?" — against the built output, in a real
 * browser. Four of this ticket's criteria can only be settled here:
 *
 * - **AC 8**, that a branch-choice control is at least 44x44 CSS pixels. That is a claim
 *   about layout at a real viewport, and jsdom has no layout at all.
 * - **AC 9**, that a preview board is not in the tab order. `inert` is a browser behaviour;
 *   jsdom renders the attribute and does nothing with it, so an assertion there would only
 *   be checking that the attribute is spelled correctly.
 * - **AC 6**, that a branch past the ninth is reachable without a numeric shortcut — which
 *   means actually pressing Tab until focus arrives.
 * - The **greyscale review** §2 asks for, run as a measurement rather than as an eyeball:
 *   the page is desaturated for real and the qualities are still told apart.
 *
 * Every measurement here carries a probe that makes it fail, because a gate nobody has seen
 * fail is a comment.
 */

const open = async (page: Page, entry: CompiledEntry, line: readonly string[] = []) => {
  await serveEntry(page, entry)
  await page.goto(`vi/gambits/${entry.id}${lineSearch(line)}`)
  await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
}

const choices = (page: Page): Locator => page.locator('.choice-link')

const PHONE = { width: 360, height: 640 }

test.describe('the replies at a branch point', () => {
  test('shows every modelled reply, each with its own board', async ({ page }) => {
    await open(page, EVANS_ENTRY)

    await expect(choices(page)).toHaveCount(4)
    // Four previews, and the position being studied. Five boards, not four.
    await expect(page.locator('.board-preview .board__grid')).toHaveCount(4)
    await expect(choices(page).first()).toContainText('5...Ba5')
  })

  test('navigates into a branch and puts it in the URL (AC 5)', async ({ page }) => {
    await open(page, EVANS_ENTRY)

    await page.getByRole('link', { name: /5\.\.\.Be7/ }).click()

    await expect(page).toHaveURL(lineUrl(EVANS_ENTRY.id, ['Be7']))
    await expect(page.getByRole('heading', { level: 2 })).toBeFocused()
  })

  test('a middle click opens a reply in its own tab, because it is a link', async ({
    page,
    context,
  }) => {
    await open(page, EVANS_ENTRY)

    const opened = context.waitForEvent('page')
    await page.getByRole('link', { name: /5\.\.\.Bd6/ }).click({ button: 'middle' })
    const tab = await opened

    /*
     * `waitForEvent('page')` resolves when the tab *exists*, which is before it has
     * navigated — a new tab's URL is the empty string until then. `waitForURL` waits for
     * the navigation itself, where `toHaveURL` would poll a URL the tab has not been given
     * yet and report the race as a failure.
     */
    await tab.waitForURL(lineUrl(EVANS_ENTRY.id, ['Bd6']))
    // And the original tab did not move: a link opened elsewhere is not a navigation here.
    await expect(page).toHaveURL(lineUrl(EVANS_ENTRY.id, []))
  })

  test('renders the catch-all with its count, and expands to the covered replies (AC 4)', async ({
    page,
  }) => {
    await open(page, EVANS_ENTRY)
    const covers = EVANS_ENTRY.tree.dismissRest?.covers ?? []
    const rest = page.locator('.omitted--rest')

    await expect(rest.locator('.omitted__label')).toHaveText(
      `${covers.length} ${vi.learn.otherReplies}`,
    )
    // Collapsed, which is a rendering state rather than an absence: the list is in the
    // document and in find-in-page, and it is not on screen until it is asked for.
    await expect(rest).not.toHaveAttribute('open', '')
    await expect(rest.locator('.omitted__ply').first()).toBeHidden()

    await rest.locator('summary').click()

    await expect(rest.locator('.omitted__ply')).toHaveCount(covers.length)
    await expect(rest.locator('.omitted__ply').first()).toBeVisible()
    await expect(rest.locator('.omitted__ply').first()).toHaveText(covers[0] ?? '')
  })

  test('renders the replies a maintainer set aside, collapsed (AC 3)', async ({ page }) => {
    await open(page, EVANS_ENTRY)
    const dismissed = page.locator('.omitted--dismissed')

    await expect(dismissed.locator('.omitted__label')).toHaveText(`1 ${vi.learn.dismissedReply}`)
    await expect(dismissed.locator('.omitted__ply')).toBeHidden()

    await dismissed.locator('summary').click()

    await expect(dismissed.locator('.omitted__ply')).toHaveText('Bxc3')
    await expect(dismissed).toContainText('Tự nguyện trả tượng')
  })

  test('renders the learner’s own plans as their own thing (AC 7)', async ({ page }) => {
    await open(page, EVANS_ENTRY, PLAN_LINE)

    await expect(page.locator('.choice-link--plan')).toHaveCount(2)
    await expect(page.locator('.choice-link--reply')).toHaveCount(0)
    await expect(page.locator('.quality-badge')).toHaveCount(0)
    await expect(page.getByText(vi.learn.planHeading)).toBeVisible()
  })
})

/**
 * **AC 8.** Branch-choice controls are at least 44x44 CSS pixels, because they are the
 * primary touch interaction (docs/design-system.md §5). Measured at the narrowest viewport
 * the product targets, where a grid is most tempted to shrink its cells.
 */
test.describe('the size of a choice', () => {
  test.use({ viewport: PHONE })

  const TOUCH_FLOOR = 44

  /**
   * The gate itself, as one function, so the test that shows it failing runs *this* code
   * and not a second copy of it.
   *
   * The empty-match check is not padding. "Every choice clears 44px" is vacuously true of
   * no choices at all, and a locator that silently stops matching is the most likely way
   * for this to stop measuring anything.
   */
  const clearsTouchFloor = async (locator: Locator, what: string): Promise<void> => {
    const count = await locator.count()
    expect(count, `${what}: nothing matched, so nothing was measured`).toBeGreaterThan(0)

    for (let index = 0; index < count; index += 1) {
      const box = await locator.nth(index).boundingBox()
      expect(box, `${what} ${index + 1} has no box`).not.toBeNull()
      expect(
        box?.width ?? 0,
        `${what} ${index + 1} is ${box?.width ?? 0}px wide, under ${TOUCH_FLOOR}`,
      ).toBeGreaterThanOrEqual(TOUCH_FLOOR)
      expect(
        box?.height ?? 0,
        `${what} ${index + 1} is ${box?.height ?? 0}px tall, under ${TOUCH_FLOOR}`,
      ).toBeGreaterThanOrEqual(TOUCH_FLOOR)
    }
  }

  test('every reply clears 44x44 at 360px', async ({ page }) => {
    await open(page, WIDE_ENTRY)

    await expect(choices(page)).toHaveCount(12)
    await clearsTouchFloor(choices(page), 'choice')
  })

  test('so does every disclosure beside them', async ({ page }) => {
    await open(page, EVANS_ENTRY)

    await expect(page.locator('.omitted__summary')).toHaveCount(2)
    await clearsTouchFloor(page.locator('.omitted__summary'), 'disclosure')
  })

  test('and the plans on a learner node', async ({ page }) => {
    await open(page, EVANS_ENTRY, PLAN_LINE)

    await clearsTouchFloor(page.locator('.choice-link--plan'), 'plan')
  })

  test('and twelve of them do not make the page scroll sideways', async ({ page }) => {
    await open(page, WIDE_ENTRY)

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width,
    )
  })

  /**
   * The control, and it runs the real gate rather than a paraphrase of it: an undersized
   * `.choice-link` is put on the page and `clearsTouchFloor` — the same function the three
   * tests above call — is required to reject it, naming the width it found.
   *
   * Without this, "every choice clears 44px" would keep passing if the floor were deleted
   * from the stylesheet, if the locator stopped matching, or if `boundingBox` started
   * answering zeros. A target-size check that has never been seen failing is a comment.
   */
  test('the gate rejects a control that is too small', async ({ page }) => {
    await open(page, EVANS_ENTRY)

    await clearsTouchFloor(choices(page), 'choice')

    await page.evaluate(() => {
      const probe = document.createElement('a')
      probe.className = 'choice-link probe'
      probe.href = '#'
      probe.style.cssText =
        'display:block;inline-size:20px;block-size:20px;min-inline-size:0;min-block-size:0'
      document.body.append(probe)
    })

    await expect(choices(page)).toHaveCount(5)
    await expect(clearsTouchFloor(choices(page), 'choice')).rejects.toThrow(/20px wide/)
  })

  test('and rejects a locator that has stopped matching anything', async ({ page }) => {
    await open(page, EVANS_ENTRY)

    await expect(
      clearsTouchFloor(page.locator('.choice-link--that-does-not-exist'), 'choice'),
    ).rejects.toThrow(/nothing was measured/)
  })
})

/**
 * **AC 9.** The preview board is not in the tab order; the choice control is.
 *
 * Tabbing is the only way to establish this. A preview holds a `role="grid"` with a cell
 * carrying `tabindex="0"`, so without `inert` each reply would put a board between the
 * learner and the next control — four extra stops at this node, twelve at the next.
 */
test.describe('the tab order', () => {
  const focusedDescription = (page: Page) =>
    page.evaluate(() => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement)) return 'none'
      const insidePreview = active.closest('.board-preview') !== null
      return `${active.tagName}${insidePreview ? ' inside a preview' : ''}`
    })

  test('never lands inside a preview board, however long it is tabbed', async ({ page }) => {
    await open(page, WIDE_ENTRY)
    await page.locator('body').click()

    const visited: string[] = []
    for (let press = 0; press < 40; press += 1) {
      await page.keyboard.press('Tab')
      visited.push(await focusedDescription(page))
    }

    expect(visited.filter((entry) => entry.includes('inside a preview'))).toStrictEqual([])
  })

  test('does land on the choices themselves', async ({ page }) => {
    await open(page, EVANS_ENTRY)
    const first = page.getByRole('link', { name: /5\.\.\.Ba5/ })

    await first.focus()
    await expect(first).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(lineUrl(EVANS_ENTRY.id, ['Ba5']))
  })

  /**
   * The control for the two tests above. The *main* board is a grid with a real tab stop,
   * and it is reached by tabbing — so the detector can see a board in the tab order when
   * there is one, and "no preview was focused" is a result rather than a tautology.
   */
  test('the detector does see a board when a board is in the tab order', async ({ page }) => {
    await open(page, EVANS_ENTRY)

    await page.locator('.learning-surface__board [role="gridcell"][tabindex="0"]').focus()

    expect(await page.evaluate(() => document.activeElement?.getAttribute('role') ?? 'none')).toBe(
      'gridcell',
    )
    expect(await focusedDescription(page)).not.toContain('inside a preview')
    // It is the studied position's board, and it is outside every preview — which is the
    // distinction the tab test relies on being able to draw.
    expect(
      await page.evaluate(() => document.activeElement?.closest('.board-preview') === null),
    ).toBe(true)
  })
})

/**
 * **AC 6.** Nine keys, and the rest reachable without them.
 */
test.describe('the number keys', () => {
  test('select the first nine branches', async ({ page }) => {
    await open(page, WIDE_ENTRY)

    await page.keyboard.press('3')

    await expect(page).toHaveURL(lineUrl(WIDE_ENTRY.id, ['Be7']))
  })

  test('reach the ninth, and there is no tenth key to press', async ({ page }) => {
    await open(page, WIDE_ENTRY)

    await page.keyboard.press('9')

    await expect(page).toHaveURL(lineUrl(WIDE_ENTRY.id, ['d5']))
  })

  test('are never the only route: the tenth is reached by tabbing to it', async ({ page }) => {
    await open(page, WIDE_ENTRY)
    const tenth = choices(page).nth(9)

    await expect(tenth).toContainText('Bd4')
    await expect(tenth.locator('.choice-link__shortcut')).toHaveCount(0)

    // Tab from the ninth until focus arrives on the tenth: no digit involved.
    await choices(page).nth(8).focus()
    for (
      let press = 0;
      press < 10 && !(await tenth.evaluate((el) => el === document.activeElement));
      press += 1
    ) {
      await page.keyboard.press('Tab')
    }

    await expect(tenth).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(lineUrl(WIDE_ENTRY.id, ['Bd4']))
  })

  test('stop working, key caps and all, when single-key shortcuts are switched off', async ({
    page,
  }) => {
    await open(page, EVANS_ENTRY)

    await page.getByRole('checkbox', { name: vi.learn.shortcuts }).click()
    expect(await page.evaluate((key) => window.localStorage.getItem(key), shortcutStorageKey)).toBe(
      'off',
    )
    /*
     * Focus has to leave the checkbox before the key is pressed. The handler ignores any
     * key whose target is an `INPUT`, so pressing `2` while the checkbox still holds focus
     * proves nothing: this assertion passed just as happily when the setting did nothing at
     * all. Blurring rather than reloading keeps the claim the one this test is making —
     * that switching the shortcuts off takes effect *now*, not on the next page load, which
     * is what `e2e/move-navigation.spec.ts` covers.
     */
    await page.getByRole('checkbox', { name: vi.learn.shortcuts }).blur()
    await page.keyboard.press('2')

    await expect(page).toHaveURL(lineUrl(EVANS_ENTRY.id, []))
    await expect(page.locator('.choice-link__shortcut')).toHaveCount(0)
    // And the branch is still reachable, which is what makes switching them off safe.
    await page.getByRole('link', { name: /5\.\.\.Bc5/ }).click()
    await expect(page).toHaveURL(lineUrl(EVANS_ENTRY.id, ['Bc5']))
  })
})

/**
 * **AC 2, as a review step rather than a claim.** §2: "Every colour-coded element passes a
 * greyscale screenshot review. This is a review step, not a suggestion."
 *
 * So the page is really desaturated — `filter: grayscale(1)` on the root element, which is
 * what a greyscale screenshot is — and the qualities are read back. Two things are checked:
 * that the accessible names still tell every quality apart, and that the icons still differ
 * in outline. The probe at the end strips the words and shows the check failing.
 */
test.describe('the greyscale review', () => {
  const greyscale = (page: Page) =>
    page.evaluate(() => {
      document.documentElement.style.filter = 'grayscale(1)'
    })

  test('still tells every quality apart with the colour gone', async ({ page }) => {
    await open(page, WIDE_ENTRY)
    await greyscale(page)

    const signals = await page.evaluate(() =>
      [...document.querySelectorAll('.quality-badge')].map((badge) =>
        [
          badge.textContent ?? '',
          ...[...badge.querySelectorAll('path')].map((path) => path.getAttribute('d') ?? ''),
        ].join('|'),
      ),
    )

    expect(signals).toHaveLength(12)
    // Five qualities across twelve replies, and five distinct signals: none of them is
    // being told apart by its hue, because there is no hue left.
    expect(new Set(signals).size).toBe(5)
  })

  test('and the icons alone would still do it', async ({ page }) => {
    await open(page, WIDE_ENTRY)
    await greyscale(page)

    const shapes = await page.evaluate(() =>
      [...document.querySelectorAll('.quality-badge__icon path')].map((path) =>
        path.getAttribute('d'),
      ),
    )

    expect(new Set(shapes).size).toBe(5)
  })

  /**
   * The probe. With the words removed and one shape shared, the check above reports the two
   * qualities as one — which is what "conveyed by colour alone" looks like from here, and
   * proves the check is measuring something.
   */
  test('reports a badge that has only its colour left as indistinguishable', async ({ page }) => {
    await open(page, WIDE_ENTRY)
    await greyscale(page)

    const signals = await page.evaluate(() => {
      const host = document.createElement('div')
      host.innerHTML =
        '<span class="quality-badge quality-badge--good"></span>' +
        '<span class="quality-badge quality-badge--mistake"></span>'
      document.body.append(host)
      return [...host.querySelectorAll('.quality-badge')].map((badge) =>
        [
          badge.textContent ?? '',
          ...[...badge.querySelectorAll('path')].map((path) => path.getAttribute('d') ?? ''),
        ].join('|'),
      )
    })

    expect(signals).toHaveLength(2)
    expect(new Set(signals).size).toBe(1)
  })
})

/**
 * The layout rule #8 established, re-measured with the choices on the page. A branch point
 * is where the page grows most, so it is where "the board and the controls are visible
 * together without scrolling" is most likely to break.
 */
test.describe('at 360px, with twelve replies below the board', () => {
  test.use({ viewport: PHONE })

  test('still shows the board and the controls together, with no scroll', async ({ page }) => {
    await open(page, WIDE_ENTRY)

    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    const geometry = async (locator: Locator) =>
      locator.evaluate((element) => ({
        top: Math.round(element.getBoundingClientRect().top),
        bottom: Math.round(element.getBoundingClientRect().bottom),
        viewport: window.innerHeight,
      }))

    const board = await geometry(page.getByRole('grid'))
    const navigator = await geometry(page.getByRole('navigation', { name: vi.learn.navigation }))

    expect(board.top).toBeGreaterThanOrEqual(0)
    expect(
      board.bottom,
      `the board reaches ${board.bottom}px of ${board.viewport}px`,
    ).toBeLessThanOrEqual(board.viewport)
    expect(
      navigator.bottom,
      `the controls reach ${navigator.bottom}px of ${navigator.viewport}px`,
    ).toBeLessThanOrEqual(navigator.viewport)
  })
})
