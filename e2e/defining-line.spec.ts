import { expect, test, type Page } from '@playwright/test'
import { MAIN_LINE, MAPPED_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import type { CompiledEntry } from '../src/lib/content-types.ts'
import { lineSearch } from '../src/lib/line.ts'
import { preludeSearch } from '../src/lib/prelude.ts'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'
import { atLine as lineUrl, serveEntry } from './learning-fixture.ts'

/**
 * Walking the opening from move one (#70), in a real browser against the built output.
 *
 * What only a browser can settle here is the thing the ticket's first criterion is about:
 * that this is **one walk and not two modes**. In jsdom a navigation is a state update; here
 * it is a real URL change, a real history entry and a real render, so "no separate mode, no
 * reload" is a claim that can be checked rather than asserted — the page is navigated the
 * whole way from the initial position to a leaf and the document is never reloaded.
 *
 * Each measurement carries a probe that makes it fail, following the convention the rest of
 * `e2e/` set: a gate nobody has watched fail is a comment.
 */

const gambit = MAPPED_ENTRY.id
const DEFINING = MAPPED_ENTRY.definingLine
const ROOT_INDEX = DEFINING.length

const open = async (page: Page, search: string, entry: CompiledEntry = MAPPED_ENTRY) => {
  await serveEntry(page, entry)
  await page.goto(`vi/${routeSegments.catalogue}/${entry.id}${search}`)
  await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
}

const next = (page: Page) => page.getByRole('link', { name: vi.learn.nextPly })
const previous = (page: Page) => page.getByRole('link', { name: vi.learn.previousPly })
const toStart = (page: Page) => page.getByRole('link', { name: vi.learn.toStart })
const toRoot = (page: Page) => page.getByRole('link', { name: vi.learn.toRoot })

/** A marker planted on the live document; it does not survive a reload. */
const markDocument = (page: Page) =>
  page.evaluate(() => {
    window.name = 'not-reloaded'
  })

const documentSurvived = (page: Page) => page.evaluate(() => window.name === 'not-reloaded')

test.describe('one walk from the initial position into the tree (AC 1)', () => {
  test('presses next from move one to a leaf without a reload or a mode change', async ({
    page,
  }) => {
    await open(page, preludeSearch(0))
    await markDocument(page)

    // Through the defining line. Each press is one ply, and the parameter counts up.
    for (let played = 1; played < ROOT_INDEX; played += 1) {
      await next(page).click()
      await expect(page).toHaveURL(new RegExp(`\\?prelude=${played}$`))
    }

    // Across the join: the last defining-line ply is the gambit root, and the root is the
    // URL with no parameters at all — which is what every published link to it looks like.
    await next(page).click()
    await expect(page).toHaveURL(lineUrl(gambit, []))

    // And on into the tree, where `?line=` takes over and means what it always meant.
    for (const [index] of MAIN_LINE.entries()) {
      await next(page).click()
      await expect(page).toHaveURL(lineUrl(gambit, MAIN_LINE.slice(0, index + 1)))
    }

    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
    expect(await documentSurvived(page)).toBe(true)
  })

  test('walks back down the same steps, across the join, with previous', async ({ page }) => {
    await open(page, lineSearch(['fxe5']))
    await markDocument(page)

    await previous(page).click()
    await expect(page).toHaveURL(lineUrl(gambit, []))

    await previous(page).click()
    await expect(page).toHaveURL(new RegExp(`\\?prelude=${ROOT_INDEX - 1}$`))

    await previous(page).click()
    await expect(page).toHaveURL(new RegExp(`\\?prelude=${ROOT_INDEX - 2}$`))

    expect(await documentSurvived(page)).toBe(true)
  })

  test('changes the board, not only the URL', async ({ page }) => {
    await open(page, preludeSearch(0))
    const e4 = page.getByRole('gridcell', { name: /^e4/ })

    await expect(e4).toHaveAccessibleName(`e4, ${vi.board.emptySquare}`)

    await next(page).click()

    await expect(e4).toHaveAccessibleName(`e4, ${vi.board.whitePawn}`)
  })

  /**
   * The probe. If the walk ever stopped at the gambit root — which is exactly where it
   * stopped before this ticket — the first press above would leave the parameter alone, and
   * this is what that failure looks like from here.
   */
  test('probe: a board that never left the initial position would be visible', async ({ page }) => {
    await open(page, preludeSearch(0))
    const e4 = page.getByRole('gridcell', { name: /^e4/ })

    await expect(e4).toHaveAccessibleName(`e4, ${vi.board.emptySquare}`)
    await expect(next(page)).toHaveAttribute('href', /prelude=1/)
  })
})

test.describe('the two starts (AC 2)', () => {
  test('back to the start reaches the initial position, from deep in a line', async ({ page }) => {
    await open(page, lineSearch(MAIN_LINE))

    await toStart(page).click()

    await expect(page).toHaveURL(new RegExp('\\?prelude=0$'))
    await expect(toStart(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(previous(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(previous(page)).toHaveAccessibleDescription(vi.learn.atStart)
  })

  /**
   * The behaviour that had to survive: the gambit root is what almost every published link
   * points at, so it stays one control away — from inside the defining line as well as from
   * inside the tree — and the URL it produces carries no parameter at all.
   */
  test('back to the start of the line still reaches the gambit root', async ({ page }) => {
    await open(page, lineSearch(MAIN_LINE))

    await toRoot(page).click()
    await expect(page).toHaveURL(lineUrl(gambit, []))
    await expect(toRoot(page)).toHaveAttribute('aria-disabled', 'true')

    await page.goto(`vi/${routeSegments.catalogue}/${gambit}${preludeSearch(1)}`)
    await toRoot(page).click()
    await expect(page).toHaveURL(lineUrl(gambit, []))
  })

  test('both are links a visitor can copy or middle-click', async ({ page }) => {
    await open(page, lineSearch(['fxe5']))

    expect(await toStart(page).getAttribute('href')).toContain(`/vi/gambits/${gambit}?prelude=0`)
    expect(await toRoot(page).getAttribute('href')).toContain(`/vi/gambits/${gambit}`)
    expect(await toRoot(page).getAttribute('href')).not.toContain('?')
  })
})

/**
 * **Acceptance criterion 3, in the browser.** The `?line=` values this suite uses are the
 * closest thing the project has to published links, and the position each one resolves to is
 * frozen in `src/components/learn/published-links.test.ts`. What is checked here is the
 * property that makes that freeze hold in a real address bar: a URL with no `prelude` lands
 * on the gambit root, and one with both lands wherever `line` says.
 */
test.describe('every URL that worked before still resolves the same (AC 3)', () => {
  test('a bare gambit URL is the gambit root, not the initial position', async ({ page }) => {
    await open(page, '')

    // The root of this fixture is after 3.Nxe5: the knight is on e5 and e4 has a white pawn.
    await expect(page.getByRole('gridcell', { name: /^e5/ })).toHaveAccessibleName(
      `e5, ${vi.board.whiteKnight}`,
    )
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`${vi.learn.after} 3.Nxe5`)
  })

  test('a line parameter beside a prelude is the one that is obeyed', async ({ page }) => {
    await open(page, `${preludeSearch(1)}&line=fxe5`)

    // `?line=fxe5` is one ply past the root; `?prelude=1` would be one ply past the start.
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`${vi.learn.after} 3...fxe5`)
  })

  test('a malformed line with no prelude still recovers to the gambit root', async ({ page }) => {
    // `cxb5+a6` arrives decoded as one segment containing a space, which is not SAN.
    await open(page, '?line=cxb5+a6')

    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`${vi.learn.after} 3.Nxe5`)
  })
})

test.describe('the defining line is not a branch point (AC 4)', () => {
  test('renders no opponent-choice boards at any ply of it', async ({ page }) => {
    for (let played = 0; played < ROOT_INDEX; played += 1) {
      await open(page, preludeSearch(played))

      await expect(page.getByRole('heading', { name: vi.learn.branchHeading })).toHaveCount(0)
      await expect(page.locator('.choice-link')).toHaveCount(0)
    }
  })

  /** The probe: the same locator finds plenty the moment the walk reaches the root. */
  test('probe: the first branch is at the gambit root, where it always was', async ({ page }) => {
    await open(page, '')

    await expect(page.getByRole('heading', { name: vi.learn.branchHeading })).toBeVisible()
    expect(await page.locator('.choice-link').count()).toBeGreaterThan(0)
  })
})

/**
 * **Acceptance criterion 6.** A Listed entry has a defining line and a root with nothing
 * under it. It has to be walkable all the same, and then say what it is: not mapped.
 */
test.describe('a Listed entry (AC 6)', () => {
  const LISTED: CompiledEntry = {
    ...MAPPED_ENTRY,
    tier: 'listed',
    tree: { kind: 'opponent', fen: MAPPED_ENTRY.tree.fen, outcome: { kind: 'unexplored' } },
  }

  test('walks its defining line and then says the branch is not mapped', async ({ page }) => {
    await open(page, preludeSearch(0), LISTED)

    await expect(page.getByText(vi.outcome.unexploredHeading)).toHaveCount(0)

    for (let played = 1; played <= ROOT_INDEX; played += 1) {
      await next(page).click()
    }

    await expect(page).toHaveURL(lineUrl(gambit, []))
    await expect(page.getByText(vi.outcome.unexploredHeading)).toBeVisible()
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true')
  })
})
