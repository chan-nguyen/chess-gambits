import { expect, test, type Page } from '@playwright/test'
import { MATE_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import { lineSearch } from '../src/lib/line.ts'
import fr from '../src/locales/fr.ts'
import vi from '../src/locales/vi.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * Three locales in a real browser, against the built output.
 *
 * Four of #7's claims are claims no unit test can settle, because they are claims about
 * what a *host* serves and a *browser* fetches: that each locale is a separate chunk, that
 * only two of the three are ever downloaded, that a chunk which fails to arrive produces
 * the designed fallback, and that a string missing from a real deployed catalogue really
 * does come out marked.
 */

/** The catalogue chunks Vite emits, one per locale (`assets/<locale>-<hash>.js`). */
const chunkPattern = (locale: string) => `**/assets/${locale}-*.js`

const assetsRequested = (page: Page): string[] => {
  const seen: string[] = []
  page.on('request', (request) => {
    const match = /\/assets\/(vi|en|fr)-[^/]+\.js$/.exec(request.url())
    if (match?.[1] !== undefined) seen.push(match[1])
  })
  return seen
}

const required = (value: string | undefined, name: string): string => {
  if (value === undefined) throw new Error(`fixture: ${name} is missing from the catalogue`)
  return value
}

const FRENCH_MENU = required(fr.nav?.menu, 'fr.nav.menu')
const FRENCH_MARKER = required(fr.untranslated?.marker, 'fr.untranslated.marker')
const FRENCH_MATE_PROOF = required(fr.footer?.mateProof, 'fr.footer.mateProof')
const FRENCH_PLY_LIST = required(fr.learn?.plyList, 'fr.learn.plyList')
const FRENCH_STARTING_POSITION = required(fr.learn?.startingPosition, 'fr.learn.startingPosition')

test.describe('the locale in the route drives the language (AC 1, AC 5)', () => {
  for (const { locale, mateProof } of [
    { locale: 'vi', mateProof: vi.footer.mateProof },
    { locale: 'fr', mateProof: FRENCH_MATE_PROOF },
  ]) {
    test(`${locale} renders in ${locale} and says so on the document`, async ({ page }) => {
      await page.goto(`${locale}/about`)

      await expect(page.getByRole('link', { name: mateProof })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
    })
  }

  test('switching language keeps the route and the line parameter exactly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    /*
     * #8 replaced the gambit route's placeholder with the learning surface, so the line is
     * read back off the move list. That needs a tree with more than one ply in it, which
     * `content/` does not publish yet (#13).
     */
    await serveEntry(page, MATE_ENTRY)
    await page.goto(`vi/gambits/legal-mate${lineSearch(['Bh5', 'Nxe5'])}`)

    await page
      .getByRole('navigation', { name: vi.nav.language })
      .getByRole('link', { name: 'Français' })
      .click()

    await expect(page).toHaveURL(/\/fr\/gambits\/legal-mate\?line=Bh5_Nxe5$/)
    await expect(
      page.getByRole('navigation', { name: FRENCH_PLY_LIST }).getByRole('link'),
    ).toHaveText([FRENCH_STARTING_POSITION, '5...Bh5', '6.Nxe5'])
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })
})

test.describe('one chunk per locale (AC 2)', () => {
  test('a French visitor downloads French and Vietnamese, and never English', async ({ page }) => {
    const requested = assetsRequested(page)
    await page.goto('fr/about')
    await expect(page.getByRole('link', { name: FRENCH_MATE_PROOF })).toBeVisible()

    // Vietnamese comes too, and must: rendering Vietnamese fallback text requires having it.
    expect([...new Set(requested)].sort()).toEqual(['fr', 'vi'])
  })

  test('a Vietnamese visitor downloads exactly one language', async ({ page }) => {
    const requested = assetsRequested(page)
    await page.goto('vi/about')
    await expect(page.getByRole('link', { name: vi.footer.mateProof })).toBeVisible()

    expect([...new Set(requested)]).toEqual(['vi'])
  })
})

test.describe('a string missing from the active catalogue (AC 3, AC 4, AC 5)', () => {
  /**
   * The marker, demonstrated against the real deployed French chunk rather than a fixture.
   * Renaming the key is what removes it: the chunk stays valid JavaScript, `footer.mateProof`
   * simply no longer exists in French, and i18next resolves it from Vietnamese — which is
   * exactly the situation `missingKeyHandler` would have stayed silent about.
   */
  const dropFrenchMateProof = async (page: Page): Promise<void> => {
    await page.route(chunkPattern('fr'), async (route) => {
      const response = await route.fetch()
      const body = (await response.text()).replace('mateProof:', 'mateProofRemovedByTest:')
      await route.fulfill({ response, body })
    })
  }

  test('renders the Vietnamese text, marked, in its own lang', async ({ page }) => {
    await dropFrenchMateProof(page)
    await page.goto('fr/about')

    const fallback = page.getByRole('contentinfo').getByText(vi.footer.mateProof)
    await expect(fallback).toBeVisible()
    await expect(fallback).toHaveAttribute('lang', 'vi')
    await expect(page.getByText(FRENCH_MARKER)).toBeVisible()

    // Never blank and never a raw key.
    await expect(page.getByText('footer.mateProof')).toHaveCount(0)
  })

  /**
   * The marker is extra words on a line that was already sized for one language. 360px is
   * the smallest phone the product targets, so it is where a badge beside a link would
   * push the page sideways if it were going to.
   */
  test('does not push the page sideways at 360px', async ({ page }) => {
    await dropFrenchMateProof(page)
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('fr/about')
    await expect(page.getByText(FRENCH_MARKER)).toBeVisible()

    const overflowing = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth
      return [...document.querySelectorAll('*')]
        .filter((element) => element.getBoundingClientRect().right > limit + 1)
        .map((element) => element.tagName.toLowerCase())
    })

    expect(overflowing).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  })

  test('and the companion: nothing is marked when the catalogue is intact', async ({ page }) => {
    await page.goto('fr/about')

    await expect(page.getByRole('link', { name: FRENCH_MATE_PROOF })).toBeVisible()
    await expect(page.getByText(FRENCH_MARKER)).toHaveCount(0)
  })
})

test.describe('a locale bundle that fails to load (AC 7)', () => {
  test('falls back to Vietnamese and says so', async ({ page }) => {
    await page.route(chunkPattern('fr'), (route) => route.abort())
    await page.goto('fr/about')

    const notice = page.getByRole('status')
    await expect(notice).toContainText(vi.untranslated.bundleFailed)
    await expect(notice).toContainText(vi.untranslated.inVietnamese)
    await expect(notice).toHaveAttribute('lang', 'vi')

    // The page is readable, in Vietnamese, rather than blank or full of raw keys.
    await expect(page.getByRole('link', { name: vi.footer.mateProof })).toBeVisible()
    await expect(page.getByRole('button', { name: FRENCH_MENU })).toHaveCount(0)
  })

  test('says it once rather than marking every string on the page', async ({ page }) => {
    await page.route(chunkPattern('fr'), (route) => route.abort())
    await page.goto('fr/about')

    await expect(page.getByRole('status')).toBeVisible()
    await expect(page.getByText(vi.untranslated.marker)).toHaveCount(0)
  })

  test('says nothing at all when the bundle loads, which is the companion', async ({ page }) => {
    await page.goto('fr/about')

    await expect(page.getByRole('link', { name: FRENCH_MATE_PROOF })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})
