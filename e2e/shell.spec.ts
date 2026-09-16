import { expect, test, type Page } from '@playwright/test'
import vi from '../src/locales/vi.ts'
import { themeStorageKey } from '../src/styles/theme.ts'

/**
 * The shell, in a real browser, because three of its claims are claims no unit test can
 * settle: that nothing overflows at 360px (AC 7), that the header collapses at the right
 * width (AC 3), and that the stored theme is on the page before the first frame rather
 * than shortly after it (AC 8).
 */

const ROUTES = ['vi/', 'vi/gambits', 'vi/about', 'vi/definitely-not-a-route']

const WIDTHS = [
  { name: '360 — the smallest phone the product targets', width: 360 },
  { name: '768 — the breakpoint itself', width: 768 },
  { name: '1280 — a laptop', width: 1280 },
]

/**
 * Anything wider than the viewport, named. A bare "scrollWidth is too big" failure sends
 * the next person hunting through a stylesheet; this one says which element did it.
 */
const overflowingElements = (page: Page): Promise<readonly string[]> =>
  page.evaluate(() => {
    const limit = document.documentElement.clientWidth
    return [...document.querySelectorAll('*')]
      .filter((element) => element.getBoundingClientRect().right > limit + 1)
      .map((element) => {
        const classes = element.getAttribute('class') ?? ''
        const right = Math.round(element.getBoundingClientRect().right)
        return `${element.tagName.toLowerCase()}${classes === '' ? '' : `.${classes}`} reaches ${right}px of ${limit}px`
      })
  })

for (const { name, width } of WIDTHS) {
  test.describe(`at ${name}`, () => {
    test.use({ viewport: { width, height: 800 } })

    for (const route of ROUTES) {
      test(`${route} does not scroll sideways`, async ({ page }) => {
        await page.goto(route)
        await expect(page.getByRole('banner')).toBeVisible()

        expect(await overflowingElements(page)).toEqual([])
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          'the document is wider than the viewport',
        ).toBeLessThanOrEqual(width)
      })
    }
  })
}

test.describe('the header below 768px', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('collapses the destinations behind a button and keeps the language switcher', async ({
    page,
  }) => {
    await page.goto('vi/about')

    await expect(page.getByRole('button', { name: vi.nav.menu })).toBeVisible()
    await expect(page.getByRole('navigation', { name: vi.nav.language })).toBeVisible()
    await expect(page.getByRole('navigation', { name: vi.nav.primary })).toBeHidden()
  })

  test('opens them, and closes again when one is followed', async ({ page }) => {
    await page.goto('vi/about')

    await page.getByRole('button', { name: vi.nav.menu }).click()
    const primary = page.getByRole('navigation', { name: vi.nav.primary })
    await expect(primary).toBeVisible()
    await expect(page.getByRole('button', { name: vi.nav.menu })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    await primary.getByRole('link', { name: vi.nav.catalogue }).click()
    await expect(page).toHaveURL(/\/vi\/gambits$/)
    await expect(primary).toBeHidden()
  })

  test('still does not scroll sideways with the menu open', async ({ page }) => {
    await page.goto('vi/about')
    await page.getByRole('button', { name: vi.nav.menu }).click()
    await expect(page.getByRole('navigation', { name: vi.nav.primary })).toBeVisible()

    expect(await overflowingElements(page)).toEqual([])
  })
})

test.describe('the header from 768px', () => {
  for (const width of [768, 1280]) {
    test(`shows the destinations without a menu button at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('vi/about')

      await expect(page.getByRole('navigation', { name: vi.nav.primary })).toBeVisible()
      await expect(page.getByRole('navigation', { name: vi.nav.language })).toBeVisible()
      await expect(page.getByRole('group', { name: vi.appearance.label })).toBeVisible()
      await expect(page.getByRole('button', { name: vi.nav.menu })).toBeHidden()
    })
  }
})

/** Both palettes, read off the page, so this file never hard-codes a colour. */
const palette = (page: Page): Promise<{ readonly light: string; readonly dark: string }> =>
  page.evaluate(() => {
    const root = document.documentElement
    const chosen = root.getAttribute('data-theme')
    const backgroundWith = (theme: string): string => {
      root.setAttribute('data-theme', theme)
      return window.getComputedStyle(root).backgroundColor
    }
    const light = backgroundWith('light')
    const dark = backgroundWith('dark')
    if (chosen === null) root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', chosen)
    return { light, dark }
  })

/**
 * What the page looked like at the first frame it could have painted. Recorded from an
 * init script, so it is measured before anything the application does — a theme corrected
 * after this point is a theme the visitor would have seen change.
 */
const recordFirstFrame = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      const root = document.documentElement
      root.setAttribute(
        'data-first-frame',
        `${root.getAttribute('data-theme') ?? 'none'}|${window.getComputedStyle(root).backgroundColor}`,
      )
    })
  })
}

const firstFrame = async (page: Page): Promise<{ theme: string; background: string }> => {
  await expect(page.locator('html')).toHaveAttribute('data-first-frame', /.+/)
  const recorded = (await page.getAttribute('html', 'data-first-frame')) ?? ''
  const [theme, background] = recorded.split('|')
  return { theme: theme ?? '', background: background ?? '' }
}

test.describe('the theme', () => {
  test('follows the system preference when nothing has been chosen', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()
    await recordFirstFrame(page)
    await page.goto('vi/about')

    const { light, dark } = await palette(page)
    expect(light, 'the two themes must differ for any of this to mean anything').not.toBe(dark)
    expect((await firstFrame(page)).background).toBe(dark)

    await context.close()
  })

  test('paints a stored light override before the first frame, on a dark system', async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()
    await page.goto('vi/about')
    await page.evaluate(
      ([key]) => window.localStorage.setItem(key ?? '', 'light'),
      [themeStorageKey],
    )

    await recordFirstFrame(page)
    await page.reload()

    const { light } = await palette(page)
    const frame = await firstFrame(page)
    // The attribute is already on the document at the first frame: nothing to correct,
    // so nothing to flash.
    expect(frame.theme).toBe('light')
    expect(frame.background).toBe(light)

    await context.close()
  })

  test('paints a stored dark override before the first frame, on a light system', async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: 'light' })
    const page = await context.newPage()
    await page.goto('vi/about')
    await page.evaluate(
      ([key]) => window.localStorage.setItem(key ?? '', 'dark'),
      [themeStorageKey],
    )

    await recordFirstFrame(page)
    await page.reload()

    const { dark } = await palette(page)
    const frame = await firstFrame(page)
    expect(frame.theme).toBe('dark')
    expect(frame.background).toBe(dark)

    await context.close()
  })

  test('is chosen in the header, and survives a reload', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' })
    const page = await context.newPage()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('vi/about')

    const appearance = page.getByRole('group', { name: vi.appearance.label })
    await appearance.getByRole('button', { name: vi.appearance.dark }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await recordFirstFrame(page)
    await page.reload()

    const { dark } = await palette(page)
    expect((await firstFrame(page)).background).toBe(dark)
    await expect(appearance.getByRole('button', { name: vi.appearance.dark })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await context.close()
  })
})

test.describe('motion', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  const menuButtonTransition = (page: Page): Promise<string> =>
    page
      .getByRole('button', { name: vi.nav.menu })
      .evaluate((element) => window.getComputedStyle(element).transitionDuration)

  /**
   * The control for the test below. Without it, "no motion under reduce" would pass just
   * as well on a page that has no motion at any setting, which proves nothing.
   */
  test('exists when the visitor has expressed no preference', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference' })
    const page = await context.newPage()
    await page.goto('vi/about')

    expect(await menuButtonTransition(page)).not.toBe('0s')

    await context.close()
  })

  test('is suppressed entirely under prefers-reduced-motion: reduce (AC 5)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('vi/about')

    expect(await menuButtonTransition(page)).toBe('0s')

    await context.close()
  })
})
