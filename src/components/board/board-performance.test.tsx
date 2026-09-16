import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Board } from './Board'
import { FEN_FIXTURES, VIETNAMESE_LABELS } from './board-fixtures'

/**
 * AC 10. An opponent node renders one preview board per candidate reply (F5), so many
 * boards mount in one go — the compounding cost ADR-0003 says the first answer missed.
 *
 * Measured in jsdom, which builds a real DOM in JavaScript with no compositor and no
 * native layout. It is slower than a browser at this, so the figure here is pessimistic
 * rather than flattering.
 */

const COUNT = 24

afterEach(cleanup)

const positions = FEN_FIXTURES.slice(0, COUNT).map((fixture) => fixture.fen)

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

  it('mounts twenty-four previews in under 100ms', () => {
    mountMany(false)
    cleanup()
    const elapsed = mountMany(false)
    console.info(`24 previews (no coordinates): ${elapsed.toFixed(1)}ms`)
    expect(elapsed).toBeLessThan(100)
  })

  it('mounts twenty-four full boards in under 100ms', () => {
    mountMany(true)
    cleanup()
    const elapsed = mountMany(true)
    console.info(`24 full boards (with coordinates): ${elapsed.toFixed(1)}ms`)
    expect(elapsed).toBeLessThan(100)
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
