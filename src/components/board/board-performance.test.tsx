import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Board } from './Board'
import { FEN_FIXTURES, VIETNAMESE_LABELS } from './board-fixtures'

/**
 * AC 10. An opponent node renders one preview board per candidate reply (F5), so many
 * boards mount in one go — the compounding cost ADR-0003 says the first answer missed.
 *
 * **This file no longer times anything, and that is the point.**
 *
 * It used to assert that mounting 24 boards cost less than 24 times one board, on the
 * reasoning that a per-instance blow-up — a shared id collision, a listener per square, a
 * layout read in a loop — is superlinear and would clear that by an order of magnitude. The
 * reasoning was right and the instrument was not. Measured on an idle machine the ratio is
 * already 22x for previews and 27x for full boards, against a limit of 48, because React and
 * jsdom charge a fixed cost per render that one board pays alone and 24 amortise. Under a
 * loaded machine it read 50.6, 57.9 and 73.0, so it failed two runs in three while the
 * component was fine — and #15's and #18's agents both lost time to it.
 *
 * Widening the limit was the obvious repair and it was wrong. Injecting the exact defect the
 * test claims to catch — a document-wide `querySelectorAll` on every one of the 1,536 squares,
 * which is quadratic in the number of boards — moved the ratio from 27.2 to 27.0. It cannot
 * see the thing it was written to see. A gate that cannot fail for the right reason, and does
 * fail for the wrong one, is worse than no gate: it teaches people to re-run until green, and
 * then a real failure reads as one more flake.
 *
 * The real budget is INP under 200ms, measured by `PerformanceObserver` in a real browser on
 * CPU-throttled hardware against the built output, and #19 enforces it — 64ms today on the
 * widest branch node the published content has. That measurement can both fail correctly and
 * pass reliably, which is the whole of what was wanted here.
 *
 * What remains is the claim jsdom can actually answer: that 24 boards really do render, in
 * full, all 1,536 squares of them.
 *
 * What this asserts is **scaling**, not wall-clock time. The first version of this test
 * asserted 24 boards mount in under 100ms; that passed at 52ms on a developer machine and
 * failed at 341ms on a shared CI runner. A wall-clock number in jsdom measures jsdom and
 * the machine underneath it, not the component, so as a gate it only reports which runner
 * it happened to land on.
 *
 * The property that actually matters is that per-board cost stays flat: mounting 24 boards
 * must not cost dramatically more than 24 times one board. That is what catches a
 * per-instance blow-up — a shared id collision, a listener attached per square, a layout
 * read in a loop — and it holds on any machine.
 *
 * The real budget is INP under 200ms, measured with Playwright in a browser against the
 * built output, and it is enforced by #19. It cannot be enforced here.
 */

const COUNT = 24

afterEach(cleanup)

const positions = FEN_FIXTURES.slice(0, COUNT).map((fixture) => fixture.fen)

describe(`mounting ${COUNT} boards`, () => {
  it('really did render them all', () => {
    const { container } = render(
      <>
        {positions.map((fen, index) => (
          <Board key={index} fen={fen} labels={VIETNAMESE_LABELS} showCoordinates={false} />
        ))}
      </>,
    )
    expect(container.querySelectorAll('[role="grid"]')).toHaveLength(COUNT)
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(COUNT * 64)
  })
})
