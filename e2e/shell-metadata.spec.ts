import { expect, test, type APIRequestContext } from '@playwright/test'
import { locales, type Locale } from '../src/lib/locale.ts'
import { routeSegments } from '../src/lib/routes.ts'
import { siteName } from '../src/lib/site.ts'
import { catalogueEntries } from '../tools/shells/metadata.ts'

/**
 * What a deep link says **before any JavaScript runs** (#17).
 *
 * Every assertion here reads the raw bytes the host answered with, never the rendered
 * page. That is the whole point: `AppShell` corrects `document.documentElement.lang` on
 * mount, so a page inspected through the DOM looks right even when the document that was
 * served claimed the wrong language — which is the WCAG 3.1.1 Level A failure this ticket
 * closes, and what a screen reader, a crawler and Slack's unfurler all actually see.
 *
 * The build assertion in `scripts/generate-shells.ts` is what covers all 2,111 documents;
 * with that many, a spot check proves almost nothing on its own. This is the part that
 * cannot be checked from inside the build: that a real host, at both base paths, answers
 * a real deep link with those bytes.
 */

const basePath = process.env.BASE_PATH ?? '/chess-gambits/'

/** A gambit that exists in all three payloads, and is named differently in each. */
const GAMBIT_ID = 'italian-game-evans-gambit'

const first = (html: string, pattern: RegExp): string => pattern.exec(html)?.[1] ?? ''

const head = (html: string) => ({
  lang: first(html, /<html lang="([^"]*)"/),
  title: first(html, /<title>([^<]*)<\/title>/),
  description: first(html, /<meta name="description" content="([^"]*)"/),
  canonical: first(html, /<link rel="canonical" href="([^"]*)"/),
  ogTitle: first(html, /<meta property="og:title" content="([^"]*)"/),
  ogDescription: first(html, /<meta property="og:description" content="([^"]*)"/),
  ogUrl: first(html, /<meta property="og:url" content="([^"]*)"/),
  ogSiteName: first(html, /<meta property="og:site_name" content="([^"]*)"/),
  alternates: [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map(
    (match) => ({ hreflang: match[1] ?? '', href: match[2] ?? '' }),
  ),
})

/** The name this locale's payload gives the entry — the same file the build read. */
const publishedName = async (request: APIRequestContext, locale: Locale): Promise<string> => {
  const response = await request.get(`${basePath}catalogue/catalogue.${locale}.json`)
  expect(response.status()).toBe(200)

  const result = catalogueEntries(await response.text())
  expect(result.ok, `catalogue.${locale}.json is not readable`).toBe(true)
  if (!result.ok) return ''

  return result.entries.get(GAMBIT_ID)?.name ?? ''
}

const deepLink = (locale: Locale): string =>
  `${basePath}${locale}/${routeSegments.catalogue}/${GAMBIT_ID}`

for (const locale of locales) {
  test(`a ${locale} deep link is served with its own language, title and preview`, async ({
    request,
  }) => {
    const response = await request.get(deepLink(locale))
    expect(response.status()).toBe(200)

    const name = await publishedName(request, locale)
    expect(name, 'the catalogue names this entry').not.toBe('')

    const served = head(await response.text())

    // AC 1 — WCAG 3.1.1. The document that arrived says which language it is in.
    expect(served.lang).toBe(locale)

    // AC 2 — this page, not two thousand pages called `app`.
    expect(served.title).toBe(`${name} · ${siteName}`)
    expect(served.description).toContain(name)

    // AC 3 — what Slack, Messenger and Discord read off a pasted URL.
    expect(served.ogTitle).toBe(name)
    expect(served.ogSiteName).toBe(siteName)
    expect(served.ogDescription).toContain(name)
    expect(served.ogUrl).toBe(served.canonical)

    // AC 4 — one canonical, and the same route in every language.
    expect(new URL(served.canonical).pathname).toBe(deepLink(locale))
    expect(served.alternates.map((alternate) => alternate.hreflang)).toStrictEqual([
      ...locales,
      'x-default',
    ])
    for (const alternate of served.alternates) {
      expect(alternate.href.startsWith('https://'), `${alternate.hreflang} is absolute`).toBe(true)
    }
    expect(
      served.alternates.find((alternate) => alternate.hreflang === locale)?.href,
      'a shell is its own alternate in its own language',
    ).toBe(served.canonical)
  })
}

test('the three locales of one gambit are three distinguishable pages', async ({ request }) => {
  const titles = await Promise.all(
    locales.map(async (locale) => head(await (await request.get(deepLink(locale))).text()).title),
  )

  // The failure this ticket closes was 2,109 shells sharing one title; three URLs for the
  // same gambit are the smallest case where the names must still differ.
  expect(new Set(titles).size).toBe(locales.length)
})

test('the site root is not left with the placeholder head either', async ({ request }) => {
  const served = head(await (await request.get(basePath)).text())

  expect(served.title).toContain(siteName)
  expect(served.title).not.toBe('app')
  expect(served.lang).not.toBe('')
  expect(new URL(served.canonical).pathname).toBe(basePath)
})

/**
 * The other half of AC 1, and the half no byte of a shell can cover.
 *
 * Every assertion above reads the document the host served, because that is what a screen
 * reader meets before any script runs. But the language switcher is a react-router `Link`,
 * so choosing another language **replaces no document**: the same `<html>` element stays on
 * screen with the same `lang` attribute it was served with, and the only thing that can
 * correct it is `AppShell`. That is exactly what `AppShell`'s comment now claims — *"this is
 * what keeps it correct after a client-side navigation between locales, which replaces no
 * document"* — and nothing was checking it.
 *
 * Left unchecked, the shells being right makes the failure *harder* to see rather than
 * easier: a Vietnamese document, served correctly as `lang="vi"`, quietly stays Vietnamese
 * to a screen reader while the visitor reads French. It is the same WCAG 3.1.1 Level A
 * failure this ticket closes, arrived at from the other side.
 */
test('the language follows a switch that replaces no document', async ({ page }) => {
  await page.goto(deepLink('vi'))
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')

  /*
   * A mark on the living document. If the click turned out to be a full page load, the mark
   * would go with it — and the assertions below would be reading a freshly served shell,
   * which the tests above already cover, rather than the running application.
   */
  await page.evaluate(() => {
    document.documentElement.dataset.sameDocument = 'yes'
  })

  await page.getByRole('link', { name: 'Français' }).click()

  await expect(page).toHaveURL(new RegExp(`/fr/${routeSegments.catalogue}/${GAMBIT_ID}`))
  await expect(page.locator('html')).toHaveAttribute('data-same-document', 'yes')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
})
