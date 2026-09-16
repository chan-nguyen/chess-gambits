import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Board } from './Board'
import { FEN_FIXTURES, VIETNAMESE_LABELS } from './board-fixtures'

/**
 * AC 10. An opponent node renders one preview board per candidate reply (F5), so many
 * boards mount in one go — the compounding cost ADR-0003 says the first answer missed.
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

/**
 * The least-interrupted of several runs, which is the standard answer to a noisy
 * microbenchmark: scheduling can only ever make a measurement slower, never faster, so the
 * minimum is the closest reading to the real cost.
 *
 * The first version of this test took one sample of each. Alone that passed; under the full
 * suite, with fifty files in parallel, a single-board sample of a fraction of a millisecond
 * got distorted enough to make the ratio explode, and the gate failed intermittently. An
 * intermittent gate is worse than no gate — it teaches people to re-run until it is green.
 */
const fastestOf = (runs: number, measure: () => number): number => {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < runs; i += 1) {
    best = Math.min(best, measure())
    cleanup()
  }
  return best
}

const mountOne = (showCoordinates: boolean): number => {
  const started = performance.now()
  render(
    <Board fen={positions[0] ?? ''} labels={VIETNAMESE_LABELS} showCoordinates={showCoordinates} />,
  )
  return performance.now() - started
}

const mountMany = (showCoordinates: boolean): number => {
  const started = performance.now()
  render(
    <>
      {positions.map((fen, index) => (
        <Board key={index} fen={fen} labels={VIETNAMESE_LABELS} showCoordinates={showCoordinates} />
      ))}
    </>,
  )
  return performance.now() - started
}

describe(`mounting ${COUNT} boards`, () => {
  it('warms the module up first, so the measurement is not a cold start', () => {
    mountMany(false)
    cleanup()
    expect(true).toBe(true)
  })

  it.each([
    ['previews', false],
    ['full boards', true],
  ])('scales linearly across twenty-four %s', (label, showCoordinates) => {
    mountMany(showCoordinates)
    cleanup()
    const one = fastestOf(7, () => mountOne(showCoordinates))
    const many = fastestOf(3, () => mountMany(showCoordinates))
    const ratio = many / Math.max(one, 0.01)

    console.info(
      `24 ${label}: ${many.toFixed(1)}ms total, ${(many / COUNT).toFixed(1)}ms each ` +
        `(one alone: ${one.toFixed(1)}ms, ratio ${ratio.toFixed(1)}x for ${COUNT} boards)`,
    )

    // Generous, because React and jsdom both add fixed per-render overhead that a single
    // board pays in full and twenty-four amortise. Anything quadratic clears this by an
    // order of magnitude, which is the failure worth catching.
    expect(ratio).toBeLessThan(COUNT * 2)
  })

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
