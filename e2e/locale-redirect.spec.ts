import { expect, test } from '@playwright/test'
import { storedLocaleKey } from '../src/lib/locale.ts'

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'

/**
 * `/` carries no locale. It resolves one from the visitor's language preferences,
 * redirects **once**, and remembers the answer so a return visit does not guess again
 * (docs/design-system.md §1).
 */

test.describe('a visitor whose browser asks for French', () => {
  test.use({ locale: 'fr-FR' })

  test('lands on the French home page', async ({ page }) => {
    await page.goto(basePath)

    await expect(page).toHaveURL(`${basePath}fr/`)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Chess Gambit Trainer' }),
    ).toBeVisible()
  })

  test('redirects once, leaving no history entry to bounce off', async ({ page }) => {
    // Calibrate against a route that does not redirect: a plain navigation costs one
    // history entry, so a `replace` redirect must cost exactly one too. A push would
    // cost two and trap the visitor pressing back into `/` and forward again.
    await page.goto(`${basePath}fr/about`)
    const afterPlainNavigation = await page.evaluate(() => window.history.length)

    await page.goto(basePath)
    await expect(page).toHaveURL(`${basePath}fr/`)

    expect(await page.evaluate(() => window.history.length)).toBe(afterPlainNavigation + 1)

    // And the user-visible meaning of that: back goes back, it does not bounce.
    await page.goBack()
    await expect(page).toHaveURL(`${basePath}fr/about`)
  })

  test('remembers the resolution for a return visit', async ({ page }) => {
    await page.goto(basePath)
    await expect(page).toHaveURL(`${basePath}fr/`)

    expect(await page.evaluate((key) => window.localStorage.getItem(key), storedLocaleKey)).toBe(
      'fr',
    )
  })
})

test.describe('a visitor whose browser asks for a language the site does not have', () => {
  test.use({ locale: 'de-DE' })

  test('falls back to Vietnamese', async ({ page }) => {
    await page.goto(basePath)

    await expect(page).toHaveURL(`${basePath}vi/`)
  })
})

test.describe('a returning visitor', () => {
  test.use({ locale: 'en-GB' })

  test('is sent where they were sent last time, not where their browser asks', async ({ page }) => {
    await page.goto(basePath)
    await expect(page).toHaveURL(`${basePath}en/`)

    await page.evaluate((key) => window.localStorage.setItem(key, 'fr'), storedLocaleKey)
    await page.goto(basePath)

    await expect(page).toHaveURL(`${basePath}fr/`)
  })

  test('ignores a remembered value that has been tampered with', async ({ page }) => {
    await page.goto(basePath)
    await page.evaluate((key) => window.localStorage.setItem(key, 'klingon'), storedLocaleKey)

    await page.goto(basePath)

    await expect(page).toHaveURL(`${basePath}en/`)
  })
})
