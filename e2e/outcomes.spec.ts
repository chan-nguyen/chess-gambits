import { expect, test, type Page } from '@playwright/test'
import {
  OUTCOMES_ENTRY,
  OUTCOME_ASSESSMENT_LINE,
  OUTCOME_MATE_LINE,
  OUTCOME_UNEXPLORED_LINE,
} from '../src/components/learn/learn-fixtures.ts'
import { lineSearch } from '../src/lib/line.ts'
import vi from '../src/locales/vi.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * What a line ends in, against the built output in a real browser.
 *
 * Three of this ticket's claims can only be settled here, because all three are about
 * layout and rendering rather than about the DOM:
 *
 * - **AC 3**, that the net is one board and a SAN list at 360px with nothing running off
 *   the side. jsdom has no layout at all, so a unit test can count boards and cannot say
 *   whether they fit.
 * - **AC 4**, that an assessment is not a consolation prize — measured as the box it
 *   actually occupies beside the box a proved mate occupies, not as the copy inside it.
 * - **The greyscale review** §2 asks for, run as a measurement rather than as an eyeball:
 *   the page is really desaturated and a proof is still told from an opinion.
 *
 * The greyscale check carries a probe that makes it fail, because a gate nobody has seen
 * fail is a comment.
 */

const open = async (page: Page, line: readonly string[]): Promise<void> => {
  await serveEntry(page, OUTCOMES_ENTRY)
  await page.goto(`vi/gambits/${OUTCOMES_ENTRY.id}${lineSearch(line)}`)
  await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
}

const PHONE = { width: 360, height: 640 }

/** How far the page runs off its own width. Anything above zero is a sideways scrollbar. */
const overflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('a proved forced mate', () => {
  test('states the count, the forced line and the certificate behind it', async ({ page }) => {
    await open(page, OUTCOME_MATE_LINE)
    const card = page.locator('.mate-outcome')

    await expect(card).toBeVisible()
    await expect(card).toContainText('Chiếu hết bắt buộc sau 2 nước')
    await expect(card.locator('.mate-net__ply')).toHaveText(['7.Bxf7+', '7...Ke7', '8.Nd5#'])
    await expect(card).toContainText('legal-mate-outcomes.Bh5_Nxe5_Bxd1.mate.json')
  })

  /**
   * Scoped to the card, because the footer links the same explanation under the same words
   * — deliberately, since one idea gets one vocabulary (§3). Two links with one name and
   * one destination is what 2.4.4 asks for; two names for one destination is not.
   */
  test('links to how the claim was proved, and the link goes there', async ({ page }) => {
    await open(page, OUTCOME_MATE_LINE)

    await page.locator('.mate-outcome').getByRole('link', { name: vi.outcome.howProved }).click()

    await expect(page).toHaveURL(/\/vi\/about$/)
  })

  /**
   * AC 3. A defender node inside a net can have twenty-four legal replies, and twenty-four
   * preview boards on a 360px phone is not a design. One board, whatever the line's length.
   */
  test('is one board and a list on a 360px phone, with nothing off the side', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await open(page, OUTCOME_MATE_LINE)

    await expect(page.locator('.mate-net .board-preview')).toHaveCount(1)
    await expect(page.locator('.mate-net__ply')).toHaveCount(3)
    expect(await overflow(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('an assessed position', () => {
  test('states the evaluation and the middlegame plan', async ({ page }) => {
    await open(page, OUTCOME_ASSESSMENT_LINE)
    const card = page.locator('.assessment-outcome')

    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: vi.outcome.evaluation })).toBeVisible()
    await expect(card.getByRole('heading', { name: vi.outcome.plan })).toBeVisible()
    await expect(card).toContainText('f2–f4')
  })

  /**
   * AC 4, measured rather than asserted. "Not a consolation prize" is a claim about the
   * space a thing takes up, so the two cards are laid out at the same width and compared:
   * the ordinary ending of a gambit is not allowed to be the smaller box.
   */
  test('takes as much room as a proved mate does', async ({ page }) => {
    await page.setViewportSize(PHONE)

    await open(page, OUTCOME_MATE_LINE)
    const mate = await page.locator('.mate-outcome').boundingBox()

    await open(page, OUTCOME_ASSESSMENT_LINE)
    const assessment = await page.locator('.assessment-outcome').boundingBox()

    expect(mate?.width).toBeGreaterThan(0)
    expect(assessment?.width).toBe(mate?.width)
    expect(await overflow(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('a branch nobody has mapped', () => {
  test('is a designed state and not a spinner', async ({ page }) => {
    await open(page, OUTCOME_UNEXPLORED_LINE)
    const card = page.locator('.unexplored-outcome')

    await expect(card).toBeVisible()
    await expect(card).toContainText(vi.outcome.unexploredHeading)
    await expect(page.locator('.unexplored-outcome [aria-busy]')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

/**
 * **The greyscale review.** §2: "Every colour-coded element passes a greyscale screenshot
 * review. This is a review step, not a suggestion."
 *
 * So the page is really desaturated — `filter: grayscale(1)` on the root element, which is
 * what a greyscale screenshot is — and the provenance notes are read back. A proof sitting
 * beside an unlabelled opinion does not make the opinion true, only convincing, and six of
 * the ten colour pairs in this palette are so close in luminance that hue is not available
 * to carry the difference.
 */
test.describe('the greyscale review', () => {
  const greyscale = (page: Page) =>
    page.evaluate(() => {
      document.documentElement.style.filter = 'grayscale(1)'
    })

  /** Everything a desaturated screenshot still shows: the words, the outlines, the rule. */
  const signal = (page: Page): Promise<string> =>
    page.evaluate(() => {
      const note = document.querySelector('.provenance')
      if (note === null) return ''
      const style = window.getComputedStyle(note)
      return [
        note.textContent ?? '',
        ...[...note.querySelectorAll('svg *')].map(
          (shape) => `${shape.tagName}:${shape.getAttribute('d') ?? ''}`,
        ),
        style.borderInlineStartStyle,
        style.borderInlineStartWidth,
      ].join('|')
    })

  test('tells a proof, an opinion and an unmapped branch apart with the colour gone', async ({
    page,
  }) => {
    const signals: string[] = []
    for (const line of [OUTCOME_MATE_LINE, OUTCOME_ASSESSMENT_LINE, OUTCOME_UNEXPLORED_LINE]) {
      await open(page, line)
      await greyscale(page)
      signals.push(await signal(page))
    }

    expect(signals).toHaveLength(3)
    for (const one of signals) expect(one).not.toBe('')
    expect(new Set(signals).size).toBe(3)
  })

  /** The card itself: its border geometry and the mark in its heading, never its fill. */
  const cardShape = (page: Page): Promise<string> =>
    page.evaluate(() => {
      const card = document.querySelector('section[class$="-outcome"]')
      if (card === null) return ''
      const style = window.getComputedStyle(card)
      return [
        style.borderTopStyle,
        style.borderTopWidth,
        style.borderInlineStartStyle,
        style.borderInlineStartWidth,
        card.querySelector('h3 svg path')?.getAttribute('d') ?? '',
      ].join('|')
    })

  test('and the three cards are three silhouettes, not three fills', async ({ page }) => {
    const shapes: string[] = []
    for (const line of [OUTCOME_MATE_LINE, OUTCOME_ASSESSMENT_LINE, OUTCOME_UNEXPLORED_LINE]) {
      await open(page, line)
      await greyscale(page)
      shapes.push(await cardShape(page))
    }

    for (const one of shapes) expect(one).not.toBe('')
    expect(new Set(shapes).size).toBe(3)
  })

  /**
   * The probe. Every assertion above compares signals, so without this they would keep
   * passing if the signal ever stopped carrying anything — which is exactly how a
   * colour-alone check rots into a comment.
   */
  test('reports two notes that differ only in their colour as the same thing', async ({ page }) => {
    await open(page, OUTCOME_MATE_LINE)
    await greyscale(page)
    const before = await signal(page)

    // Strip the words and the outlines and match the border, leaving only the hue.
    await page.evaluate(() => {
      const note = document.querySelector('.provenance')
      if (note === null) return
      note.textContent = 'provenance'
      note.setAttribute('style', 'border-inline-start: 1px dashed currentColor')
    })
    const stripped = await signal(page)

    await page.evaluate(() => {
      const note = document.querySelector('.provenance')
      if (note === null) return
      note.textContent = 'provenance'
      note.setAttribute('style', 'border-inline-start: 1px dashed red')
    })

    expect(stripped).not.toBe(before)
    expect(await signal(page)).toBe(stripped)
  })
})
