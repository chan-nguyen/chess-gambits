import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  MAIN_LINE,
  MAPPED_ENTRY,
  OUTCOMES_ENTRY,
  OUTCOME_ASSESSMENT_LINE,
  OUTCOME_MATE_LINE,
  OUTCOME_UNEXPLORED_LINE,
  WIDE_ENTRY,
} from '../src/components/learn/learn-fixtures.ts'
import { lineSearch } from '../src/lib/line.ts'
import vi from '../src/locales/vi.ts'
import { serveEntry } from './learning-fixture.ts'

/**
 * The greyscale review step (#18, AC 5) — the **capture half** of it.
 *
 * `docs/design-system.md` §2 requires every colour-coded element to pass a greyscale
 * screenshot review before a release, and §5 lists it as a step a person performs. This
 * file exists because that person needs something to look at: it desaturates the three
 * surfaces §2 names — the board, the quality labels and the outcome cards — and attaches
 * a PNG of each to the Playwright report and to `test-results/`.
 *
 * **What it deliberately does not do is repeat the assertions.** The machine-checkable part
 * of this review already exists and is not duplicated here:
 *
 * - quality labels: `e2e/branch-choices.spec.ts`, "the greyscale review" — twelve replies,
 *   five qualities, five distinct signals once the hue is gone.
 * - outcome cards: `e2e/outcomes.spec.ts` — a proof is still told from an opinion.
 * - board and pieces: `src/components/board/board-contrast.test.ts`, which reads the
 *   normative token table in §2 and checks the fills and strokes against each other.
 *
 * What is left over is exactly what the machine cannot do, and saying so is the point of
 * the ticket: whether the desaturated screen still *reads*. A set of icons can be five
 * distinct paths and still look like five smudges at 14px; a card can carry distinct
 * wording and still be skimmed past. Nothing below decides that. The checklist in
 * `docs/design-system.md` §5 says who decides it, how often, and — the limitation worth
 * stating rather than papering over — that the sole reviewer is not a screen-reader user.
 *
 * Why this matters more here than the phrase "greyscale review" usually implies: in this
 * palette the nine outcome and reply-quality colours are all within 1.5:1 of each other
 * once hue is removed, in **both** themes, and several pairs are the identical grey. The
 * distinctions cannot lean on colour even slightly. §5 records the measurements.
 */

const PHONE = { width: 360, height: 640 }

const open = async (
  page: Page,
  entry: typeof MAPPED_ENTRY,
  line: readonly string[],
): Promise<void> => {
  await serveEntry(page, entry)
  await page.goto(`vi/gambits/${entry.id}${lineSearch(line)}`)
  await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible()
}

/** What a greyscale screenshot is: the root element desaturated, and then photographed. */
const desaturate = (page: Page): Promise<void> =>
  page.evaluate(() => {
    document.documentElement.style.filter = 'grayscale(1)'
  })

/**
 * Photograph `subject` twice — in colour and desaturated — attach the desaturated frame for
 * the reviewer, and require the two frames to differ.
 *
 * That last part is the probe, and it is not a formality. A review step that quietly
 * produced colour images would pass every run, would look exactly like this one in the
 * report, and would be reviewed by a person who believed they were looking at greyscale.
 */
const capture = async (page: Page, subject: Locator, name: string): Promise<void> => {
  await expect(subject).toBeVisible()
  const colour = await subject.screenshot()

  await desaturate(page)
  const file = test.info().outputPath(`${name}.png`)
  const grey = await subject.screenshot({ path: file })
  await test.info().attach(`${name} (greyscale)`, { path: file, contentType: 'image/png' })

  expect(grey.equals(colour), `${name} came out of the filter unchanged — it is not grey`).toBe(
    false,
  )
}

test.describe('the surfaces a release reviews in greyscale (AC 5)', () => {
  test.use({ viewport: PHONE })

  /**
   * §5: "Pieces are distinguishable without colour. Piece sets differ in shape; white and
   * black pieces carry an outline contrast that survives greyscale." Captured mid-line, so
   * both colours of piece are on both colours of square.
   *
   * The frame is taken mid-line, so it also carries the **last-ply highlight** — which it
   * did not until #54, because `Board` implemented it in full behind an optional `lastMove`
   * prop that no caller passed for four waves. What the reviewer is looking at is the
   * dashed ring on the square 3...fxe5 left and the solid ring on the square it reached,
   * and what they are deciding is whether those two read apart at this size once the hue is
   * gone. They have to, because nothing else can: desaturated, the two highlight tints are
   * 1.05:1 apart and either is within 1.3:1 of an ordinary square
   * (`board-contrast.test.ts`). The machine-checkable half is not repeated here —
   * `e2e/move-navigation.spec.ts`, "the last-ply highlight", measures the two rings on a
   * desaturated page and carries a probe that makes it fail.
   */
  test('the board, mid-line, with both colours of piece on both colours of square', async ({
    page,
  }) => {
    await open(page, MAPPED_ENTRY, MAIN_LINE.slice(0, 2))

    await capture(page, page.locator('.learning-surface__board'), 'board')
  })

  /**
   * §2: reply quality carries an icon and a text label, not just a colour. The wide entry
   * rather than the four-reply one, because it is the only fixture that puts all **five**
   * qualities in a single frame — and the pair a reviewer has to look hardest at, mistake
   * against blunder, is missing from the smaller one.
   */
  test('the quality labels on a branch point, all five qualities', async ({ page }) => {
    await open(page, WIDE_ENTRY, [])

    await capture(page, page.locator('.branch-choices'), 'quality-labels')
  })

  /** §2: "a mate leaf and an assessment leaf do not differ only in hue". All three kinds,
   * captured separately because they are never on screen together. */
  const outcomes = [
    { name: 'outcome-mate', line: OUTCOME_MATE_LINE, card: '.mate-outcome' },
    { name: 'outcome-assessment', line: OUTCOME_ASSESSMENT_LINE, card: '.assessment-outcome' },
    { name: 'outcome-unexplored', line: OUTCOME_UNEXPLORED_LINE, card: '.unexplored-outcome' },
  ]

  for (const { name, line, card } of outcomes) {
    test(`the ${name.replace('outcome-', '')} outcome card`, async ({ page }) => {
      await open(page, OUTCOMES_ENTRY, line)

      await capture(page, page.locator(card), name)
    })
  }
})
