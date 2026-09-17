import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter'
import { MINIMUM_E2E_TESTS, breachReport, e2eFloorBreaches, floorIsEnforced } from './floor.ts'

/**
 * The Playwright half of the floor described in `./floor.ts`, registered in
 * `playwright.config.ts`.
 *
 * Playwright already knows both numbers: `onBegin` is handed the collected suite, and `onTestEnd`
 * fires once per attempt at running a test. It reported `158 passed` on a 224-test suite and
 * exited 0 because nothing put the two side by side.
 *
 * A test that Playwright *skipped* does not count as run. There are no skips in `e2e/` today, and
 * a suite that quietly grows some is the same failure in a different costume.
 */
export default class E2eTestFloor implements Reporter {
  #collected = 0
  #listing = false
  readonly #executed = new Set<string>()

  onBegin(config: FullConfig, suite: Suite): void {
    // `playwright test --list` collects and runs nothing; there is no floor under a run that
    // was never asked to happen. Everything else — a file filter, `--grep` — is a subset that
    // has to say so, exactly as it does under vitest.
    this.#listing = config.argv.includes('--list')
    this.#collected = suite.allTests().length
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Retries fire this hook again for the same test, hence the set.
    if (result.status !== 'skipped') this.#executed.add(test.id)
  }

  async onEnd(_result: FullResult): Promise<{ status: FullResult['status'] } | undefined> {
    if (this.#listing) return undefined

    if (!floorIsEnforced()) {
      console.log('  Test floor  not enforced (TEST_FLOOR=off)')
      return undefined
    }

    const breaches = e2eFloorBreaches({
      minimum: MINIMUM_E2E_TESTS,
      collected: this.#collected,
      executed: this.#executed.size,
    })

    if (breaches.length === 0) {
      console.log(
        `  Test floor  ${this.#executed.size} tests ran — every one Playwright collected, ` +
          `and at least the ${MINIMUM_E2E_TESTS} committed`,
      )
      return undefined
    }

    console.error(breachReport('Playwright', breaches))
    return { status: 'failed' }
  }
}
