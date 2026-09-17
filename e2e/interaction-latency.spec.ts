import { expect, test, type Page } from '@playwright/test'
import { MAIN_LINE, MAPPED_ENTRY } from '../src/components/learn/learn-fixtures.ts'
import type { CompiledNode } from '../src/lib/content-types.ts'
import { lineSearch } from '../src/lib/line.ts'
import { routeSegments } from '../src/lib/routes.ts'
import vi from '../src/locales/vi.ts'
import { compileEntry } from '../tools/content/compile.ts'
import { loadContent } from '../tools/content/entries.ts'
import { INP_BUDGET_MS } from './budgets.ts'
import { atLine, serveEntry } from './learning-fixture.ts'

/**
 * #14's AC 7 and #19's AC 3: pressing next has an INP under 200ms.
 *
 * Measured with `PerformanceObserver` on the `event` timing entries, in a real Chromium,
 * with the CPU throttled, against the built output. **Not** with Lighthouse, which cannot
 * measure INP at all: INP is a field metric over real interactions, and Lighthouse's lab
 * run has none. Anything it reported would be Total Blocking Time wearing INP's name.
 *
 * What is reported below is the *worst* interaction latency observed, which is what INP is
 * for a handful of interactions — the 98th percentile only starts to differ from the
 * maximum past about fifty of them.
 *
 * Two honest limitations, stated rather than buried:
 *
 * - `durationThreshold` has a floor of 16ms in the specification, so an interaction faster
 *   than that produces no entry at all. Zero entries therefore means "nothing reached
 *   16ms", and the test says so rather than reporting a zero it did not measure.
 * - The suite runs `fullyParallel`, so other workers are competing for the same CPU while
 *   this measures one. That can only make the number worse, never better, so a pass here
 *   is not an optimistic reading.
 */

declare global {
  interface Window {
    interactionDurations?: number[]
  }

  /**
   * `durationThreshold` is part of the Event Timing API and TypeScript's DOM library has
   * not caught up with it. Declared rather than asserted: an `as` here would silence the
   * checker about the whole init object, and this says exactly which property is missing
   * and what its type is.
   */
  interface PerformanceObserverInit {
    durationThreshold?: number
  }
}

/** Lighthouse's own mid-tier-mobile multiplier, so the number means something familiar. */
const CPU_THROTTLING_RATE = 4

/**
 * The waits here are synchronisation, not measurement: the number this test reports comes
 * from `PerformanceObserver`, never from how long an assertion took to settle. They are
 * generous because the suite is `fullyParallel` and a throttled tab shares a machine with
 * however many other workers are running, and a performance test that fails as a *timeout*
 * tells nobody anything about performance.
 */
const SETTLE = { timeout: 10_000 }

const throttle = async (page: Page): Promise<void> => {
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLING_RATE })
}

/**
 * Collect every event-timing entry that belongs to a real interaction. `interactionId` is
 * what separates a discrete interaction from an incidental event such as a `mousemove`.
 */
const observeInteractions = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const durations: number[] = []
    window.interactionDurations = durations

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const id = 'interactionId' in entry ? entry.interactionId : undefined
        if (typeof id === 'number' && id > 0) durations.push(entry.duration)
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true })
  })

const observed = (page: Page): Promise<readonly number[]> =>
  page.evaluate(() => [...(window.interactionDurations ?? [])])

const report = (what: string, durations: readonly number[]): number => {
  const worst = durations.length === 0 ? 0 : Math.max(...durations)
  process.stdout.write(
    `\n  [INP] ${what}: ${durations.length} interaction entries over 16ms, worst ${worst.toFixed(1)}ms\n`,
  )
  return worst
}

test.describe('pressing next (AC 7)', () => {
  test('stays under 200ms of interaction latency on a throttled CPU', async ({ page }) => {
    await throttle(page)
    await serveEntry(page, MAPPED_ENTRY)
    await page.goto(`vi/gambits/${MAPPED_ENTRY.id}`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)
    await observeInteractions(page)

    const next = page.getByRole('link', { name: vi.learn.nextPly })
    for (const [index] of MAIN_LINE.entries()) {
      await next.click()
      await expect(page).toHaveURL(atLine(MAPPED_ENTRY.id, MAIN_LINE.slice(0, index + 1)), SETTLE)
    }

    /*
     * The keyboard route to the same action, which goes through a different event path.
     * The wait is not decoration: the controls step from the position that is on screen,
     * so pressing before it has caught up would step from the previous one. A person
     * cannot press inside a render frame; Playwright at 4x throttling can.
     */
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      `${vi.learn.after} 6.Bc4+`,
      SETTLE,
    )
    await page.keyboard.press('ArrowLeft')
    await expect(page).toHaveURL(atLine(MAPPED_ENTRY.id, MAIN_LINE.slice(0, 5)), SETTLE)

    // A frame after the last navigation, so its entry has been delivered to the observer.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100))),
    )

    const worst = report('next, 6 clicks and 1 arrow key', await observed(page))

    expect(worst, 'worst interaction latency pressing next').toBeLessThan(INP_BUDGET_MS)
  })

  /**
   * The control. An assertion that a number is under 200 is worth nothing unless the
   * number can exceed 200, and an observer that silently recorded nothing would pass the
   * test above forever. This blocks the main thread for longer than the budget on purpose
   * and requires the same measurement to notice.
   */
  test('the measurement notices an interaction that is too slow', async ({ page }) => {
    await throttle(page)
    await serveEntry(page, MAPPED_ENTRY)
    await page.goto(`vi/gambits/${MAPPED_ENTRY.id}`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)
    await observeInteractions(page)

    await page.evaluate(() => {
      const probe = document.createElement('button')
      probe.id = 'slow-probe'
      probe.textContent = 'slow'
      probe.addEventListener('click', () => {
        const until = performance.now() + 400
        while (performance.now() < until) {
          // Block the main thread, which is what a slow interaction actually is.
        }
      })
      document.body.append(probe)
    })

    await page.locator('#slow-probe').click()
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100))),
    )

    const worst = report('a deliberately slow probe', await observed(page))

    expect(worst, 'the probe must breach the same budget the real test passes').toBeGreaterThan(
      INP_BUDGET_MS,
    )
  })
})

/**
 * **#19's AC 3, against published content rather than a fixture.**
 *
 * The block above serves its tree from `learning-fixture.ts`, which was the only option
 * when it was written: every published id was Tier 0 and there was no branch node on the
 * site to press next through. #15 changed that, and the difference is not cosmetic. A
 * fixture hands compiled JSON to the shipped application; a published route goes through
 * the real shell, the real route, the real loader and the real compiled file — and the
 * file is 41KB of tree rather than a handful of nodes, which is exactly the part that
 * costs a frame.
 *
 * Which node is chosen is derived, not written down: the **widest** branch point in
 * published content, and among equally wide ones the one with the longest main line left
 * to walk, because INP over one click is a worse estimate than INP over six. §6's budget
 * is about the interaction that has the most to render, and a line hard-coded here would
 * quietly stop being the widest node the first time content changed.
 */
type BranchPoint = {
  readonly id: string
  readonly line: readonly string[]
  readonly width: number
  /**
   * The main line onward from the node: the first modelled reply at each step, which is
   * where `nextPath` in `tree-path.ts` sends the next control. Capped, because the budget
   * is about one interaction and six samples already establish the worst of them.
   */
  readonly continuation: readonly string[]
}

const MOST_CLICKS = 6

const mainLineFrom = (node: CompiledNode): readonly string[] => {
  const plies: string[] = []
  let cursor = node
  while (plies.length < MOST_CLICKS) {
    const child = (cursor.children ?? []).find((candidate) => candidate.ply !== undefined)
    if (child?.ply === undefined) break
    plies.push(child.ply)
    cursor = child
  }
  return plies
}

const widestBranch = ((): BranchPoint => {
  const content = loadContent('content')
  if (!content.ok) throw new Error('content/ does not pass the gate, so there is nothing to press')

  let widest: BranchPoint = { id: '', line: [], width: 0, continuation: [] }

  const better = (candidate: BranchPoint): boolean =>
    candidate.width > widest.width ||
    (candidate.width === widest.width && candidate.continuation.length > widest.continuation.length)

  for (const { entry } of content.entries) {
    if (entry.tier !== 'taught') continue
    const tree = compileEntry(entry).tree

    const walk = (node: CompiledNode, line: readonly string[]): void => {
      const children = node.children ?? []
      const candidate: BranchPoint = {
        id: entry.id,
        line,
        width: children.length,
        continuation: mainLineFrom(node),
      }
      if (better(candidate)) widest = candidate

      for (const child of children) {
        if (child.ply !== undefined) walk(child, [...line, child.ply])
      }
    }

    walk(tree, [])
  }

  return widest
})()

test.describe('pressing next on the widest published branch node (#19 AC 3)', () => {
  test('there is a wide branch node in published content to measure', () => {
    /*
     * The guard for everything below. If content ever regressed to single-child trees this
     * whole describe would still pass, having measured a button that renders one move — so
     * the shape of what is being measured is asserted rather than assumed.
     */
    expect(widestBranch.width, 'no published entry has a branch point at all').toBeGreaterThan(3)
    expect(widestBranch.continuation.length, 'nothing to press next through').toBeGreaterThan(2)
  })

  test('stays under the budget on a throttled CPU', async ({ page }) => {
    await throttle(page)

    const { id, line, continuation } = widestBranch
    await page.goto(`vi/${routeSegments.catalogue}/${id}${lineSearch(line)}`)
    await expect(page.getByRole('navigation', { name: vi.learn.navigation })).toBeVisible(SETTLE)

    // The node really does offer the choice this test claims it does. A `?line=` that
    // failed to resolve recovers to the nearest valid node, which would measure a
    // different and easier screen while reporting this one's name.
    await expect(page.getByRole('heading', { name: vi.learn.branchHeading })).toBeVisible(SETTLE)
    await expect(page.locator('.choice-link')).toHaveCount(widestBranch.width, SETTLE)

    await observeInteractions(page)

    const next = page.getByRole('link', { name: vi.learn.nextPly })
    for (const [index] of continuation.entries()) {
      await next.click()
      await expect(page).toHaveURL(
        atLine(id, [...line, ...continuation.slice(0, index + 1)]),
        SETTLE,
      )
    }

    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100))),
    )

    const worst = report(
      `${id} at [${line.join(' ')}], ${widestBranch.width} replies, ${continuation.length} clicks`,
      await observed(page),
    )

    expect(worst, 'worst interaction latency pressing next on published content').toBeLessThan(
      INP_BUDGET_MS,
    )
  })
})
