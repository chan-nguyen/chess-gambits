import { expect, test, type Locator, type Page } from '@playwright/test'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'
import { CLS_BUDGET } from './budgets.ts'

/**
 * #57: the footer no longer moves when a route's data lands.
 *
 * **The measurement is the hard part of this ticket, not the fix.** The defect was
 * intermittent in Lighthouse — 0.216 on five runs of ten and 0.000 on the other five — and
 * it was intermittent for a reason worth keeping in mind here: the shift always happened,
 * and whether it landed inside the measured window depended on whether the route's JSON
 * resolved before or after the first paint. An instrument that inherits that race inherits
 * the coin flip, and a green run then means nothing.
 *
 * So this file removes the race rather than measuring around it. Every request for route
 * data is **held** until the loading state has been painted for two frames, and only then
 * released. The loading state is therefore always what paints first, which is the worst
 * case and the one the budget is about.
 *
 * Four claims per route and width, and they are deliberately not four spellings of one:
 *
 * 1. The footer is **rendered while the data is in flight** — this fix may not be "hide it
 *    until the page is ready". The footer carries the CC BY-SA attribution that
 *    `LICENSE-CONTENT` requires to stay visible, so trading a shift for a flash is not a
 *    fix, and a test that only measured CLS would call that trade a pass.
 * 2. Its top edge is at or below the fold, both while loading and once settled. This is the
 *    claim with teeth: it is exact, it needs no timing luck, and it is what actually stopped
 *    happening. Cumulative layout shift is a *consequence* of it.
 * 3. It never moves back **up** the page. A reservation that is released once the content
 *    turns out to be shorter than it is the same defect pointing the other way, which is
 *    what AC 4 asks about — a catalogue filtered to one result, and a Tier 0 gambit page.
 * 4. Measured cumulative layout shift stays under §6's budget.
 *
 * Claim 2 exists because claim 4 cannot see the defect everywhere. On the broken build the
 * home page measured 0.037 at 360px and the catalogue 0.069 at 1280px — real shifts of a
 * real footer, both comfortably under a 0.1 budget. A suite that asserted only the budget
 * would have certified two of the five routes it was pointed at. Reverting the stylesheet
 * fails claim 2 on all ten route-and-width combinations, which is how that was established.
 */

declare global {
  interface Window {
    /** Set by the init script below, before any of the application runs. */
    layoutShifts?: RecordedShift[]
  }
}

type RecordedShift = {
  readonly value: number
  /** Every element the browser blamed, so a failure names it rather than a number. */
  readonly sources: readonly string[]
}

/**
 * Collect every shift from the very first frame.
 *
 * `buffered: true` matters more than it looks: the shift this ticket is about happens
 * within a second of navigation, and an observer registered after the page has started
 * would miss exactly the entries it exists to catch.
 *
 * Everything the observer needs is written inside the callback because the callback is
 * serialised and run in the browser, where nothing in this module exists. `layout-shift`
 * entries are not in TypeScript's DOM library either, so the two fields read off them are
 * narrowed by hand rather than asserted into existence — `docs/definition-of-done.md` bans
 * the `as` that would otherwise appear here, and this says exactly what is being assumed.
 */
const recordShifts = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const shifts: RecordedShift[] = []
    window.layoutShifts = shifts

    const describe = (node: unknown): string => {
      if (!(node instanceof Element)) return '(an anonymous box)'
      const classes = node.getAttribute('class') ?? ''
      const suffix = classes.trim() === '' ? '' : `.${classes.trim().split(/\s+/).join('.')}`
      return `${node.tagName.toLowerCase()}${suffix}`
    }

    const blamed = (entry: PerformanceEntry): readonly string[] => {
      if (!('sources' in entry)) return []
      const sources: unknown = entry.sources
      if (!Array.isArray(sources)) return []
      return sources.map((source: unknown) =>
        typeof source === 'object' && source !== null && 'node' in source
          ? describe(source.node)
          : '(an anonymous box)',
      )
    }

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!('value' in entry) || typeof entry.value !== 'number') continue
        // A shift within 500ms of a real interaction is expected rather than a defect, and
        // the browser flags those itself. Nothing here interacts, so this should never fire
        // — it is here so the number means the same thing as Lighthouse's.
        if ('hadRecentInput' in entry && entry.hadRecentInput === true) continue
        shifts.push({ value: entry.value, sources: blamed(entry) })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
}

const cumulativeLayoutShift = async (page: Page): Promise<number> => {
  const shifts = await page.evaluate(() => window.layoutShifts ?? [])
  return shifts.reduce((total, { value }) => total + value, 0)
}

/** What shifted, for the failure message. A bare number sends the next person hunting. */
const shiftReport = async (page: Page): Promise<string> => {
  const shifts = await page.evaluate(() => window.layoutShifts ?? [])
  if (shifts.length === 0) return 'no layout shift was recorded at all'
  return shifts
    .map(({ value, sources }) => `${value.toFixed(4)} — ${sources.join(', ') || 'no source named'}`)
    .join('; ')
}

/**
 * Hold every request for route data until the returned function is called.
 *
 * This is what makes the measurement deterministic. Without it the loading state is in a
 * race with the network, which is the race that made the original Lighthouse number a coin
 * flip.
 */
const holdRouteData = async (page: Page): Promise<() => void> => {
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })

  await page.route(
    (url) => url.pathname.endsWith('.json'),
    async (route) => {
      await held
      await route.continue()
    },
  )

  return release
}

/** Two frames, so what is on screen has actually been painted and not merely laid out. */
const painted = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

type FooterGeometry = {
  /** Distance from the top of the viewport. At or above `viewportHeight` is out of sight. */
  readonly viewportTop: number
  /** Distance from the top of the document, which is what "it moved" is measured in. */
  readonly documentTop: number
  readonly height: number
  readonly viewportHeight: number
}

const footerGeometry = (page: Page): Promise<FooterGeometry> =>
  page.evaluate(() => {
    const footer = document.querySelector('footer.site-footer')
    if (footer === null) throw new Error('there is no footer.site-footer on the page')
    const rect = footer.getBoundingClientRect()
    return {
      viewportTop: Math.round(rect.top),
      documentTop: Math.round(rect.top + window.scrollY),
      height: Math.round(rect.height),
      viewportHeight: window.innerHeight,
    }
  })

type Case = {
  readonly name: string
  readonly path: string
  /** Visible only once the route's own data has arrived and rendered. */
  readonly settled: (page: Page) => Locator
}

const catalogueSettled = (page: Page): Locator => page.getByRole('search')

/**
 * The three routes acceptance criterion 1 names, plus the two acceptance criterion 4 does.
 *
 * `cambridge gambit` is a query that matches exactly one entry of the 1,003 in the shipped
 * catalogue, and the Alekhine entry it matches is also the Tier 0 page below — a listed
 * entry with no tree at all. Both are the short-content case: less content arrives than the
 * reservation holds, which is when a reservation that is released pulls the footer back up.
 */
const CASES: readonly Case[] = [
  {
    name: 'the home page',
    path: 'vi/',
    settled: (page) => page.getByRole('heading', { level: 2, name: vi.home.startHere }),
  },
  {
    name: 'the catalogue',
    path: `vi/${routeSegments.catalogue}`,
    settled: catalogueSettled,
  },
  {
    name: 'a taught gambit page',
    path: `vi/${routeSegments.catalogue}/benko-gambit`,
    // The main board and every branch preview share one renderer, so there is more than
    // one `grid` on a loaded gambit page. The first is the position itself.
    settled: (page) => page.getByRole('grid').first(),
  },
  {
    name: 'the catalogue filtered to one result',
    path: `vi/${routeSegments.catalogue}?q=cambridge+gambit&tier=all`,
    settled: catalogueSettled,
  },
  {
    name: 'a Tier 0 gambit page',
    path: `vi/${routeSegments.catalogue}/alekhine-defense-four-pawns-attack-cambridge-gambit`,
    settled: (page) => page.getByRole('heading', { level: 2, name: vi.emptyTree.notTaught }),
  },
]

/** §5's narrowest supported width, and a laptop. AC 1 asks for both, not Lighthouse's own. */
const WIDTHS = [
  { label: '360px', width: 360, height: 640 },
  { label: '1280px', width: 1280, height: 800 },
]

for (const { label, width, height } of WIDTHS) {
  test.describe(`at ${label}`, () => {
    test.use({ viewport: { width, height } })

    for (const { name, path, settled } of CASES) {
      test(`${name} does not move the footer when its data lands`, async ({ page }) => {
        await recordShifts(page)
        const release = await holdRouteData(page)

        await page.goto(path)

        // The shell is up and the data is still held, so this is the state the visitor sees
        // first — the one that used to park the footer inside the viewport.
        await expect(page.getByRole('banner')).toBeVisible()
        await expect(page.getByRole('contentinfo')).toBeVisible()
        await painted(page)

        // Claim 1. Not hidden, not collapsed, and still carrying the licence.
        const footer = page.getByRole('contentinfo')
        await expect(footer.getByRole('link', { name: 'CC BY-SA 4.0' })).toBeVisible()

        const whileLoading = await footerGeometry(page)
        expect(
          whileLoading.height,
          'the footer is rendered while the data is in flight',
        ).toBeGreaterThan(0)

        // Claim 2, first half.
        expect(
          whileLoading.viewportTop,
          `the footer is inside the viewport while ${path} is still loading, so anything that ` +
            'grows the content region will visibly push it',
        ).toBeGreaterThanOrEqual(whileLoading.viewportHeight)

        release()
        await expect(settled(page)).toBeVisible()
        await page.waitForLoadState('networkidle')
        await painted(page)

        const afterLoading = await footerGeometry(page)

        // Claim 2, second half.
        expect(
          afterLoading.viewportTop,
          `the footer is inside the viewport once ${path} has loaded`,
        ).toBeGreaterThanOrEqual(afterLoading.viewportHeight)

        // Claim 3.
        expect(
          afterLoading.documentTop,
          `the footer moved up the page when ${path} finished loading, which means the ` +
            'reserved height was released rather than filled',
        ).toBeGreaterThanOrEqual(whileLoading.documentTop)

        // Claim 4.
        expect(await cumulativeLayoutShift(page), await shiftReport(page)).toBeLessThan(CLS_BUDGET)
      })
    }
  })
}

/**
 * The recorder, shown catching one.
 *
 * Without this every assertion above could be green because `window.layoutShifts` stayed
 * empty — a broken init script, a renamed entry type, a Chromium that stopped emitting
 * them. This project has retired two gates that could not see their own defect, and the
 * cheapest way not to ship a third is to make the instrument prove itself on every run.
 */
test.describe('the recorder', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('reports a shift over the budget when one is deliberately caused', async ({ page }) => {
    await recordShifts(page)
    await page.goto(`vi/${routeSegments.catalogue}`)
    await expect(page.getByRole('search')).toBeVisible()
    await painted(page)

    expect(await cumulativeLayoutShift(page)).toBeLessThan(CLS_BUDGET)

    // Half the viewport, inserted above everything, which is roughly what the footer used
    // to suffer. Inserted before `#root` so React's own subtree is left alone.
    await page.evaluate(() => {
      const pusher = document.createElement('div')
      pusher.style.blockSize = '320px'
      document.body.prepend(pusher)
    })
    await painted(page)

    expect(
      await cumulativeLayoutShift(page),
      'the recorder did not see a shift that was inserted on purpose',
    ).toBeGreaterThan(CLS_BUDGET)
    expect(await shiftReport(page)).not.toContain('no layout shift was recorded')
  })
})
