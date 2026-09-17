import { glob } from 'node:fs/promises'
import { sep } from 'node:path'

/**
 * A floor under both test runners: **a run that executed less of the suite than exists is not a
 * pass** (issue #50).
 *
 * Every failure this project has paid for in its test suite had the same shape, and none of them
 * was a red test:
 *
 * - a vitest `include` that named only `src/`, dropping five content-gate files. Green.
 * - `tools/lint/lint-gate.test.ts` writing a fixture into `src/` while another file's eager
 *   `import.meta.glob` imported it mid-flight, so that file failed to load and its fourteen tests
 *   vanished. `Tests 1748 passed (1748)`, twice, exit 0. Fixed in #59 — three agents lost time to
 *   it first.
 * - Playwright reporting `158 passed` on a suite `--list` counts as 224. Exit 0.
 *
 * In each case the number was on the screen and nothing was comparing it to anything. So the two
 * reporters in this directory compare it, and they do it the same way twice over:
 *
 * 1. **An exact, self-maintaining check.** For vitest, every `*.test.ts(x)` file on disk must have
 *    been collected — including files outside `src/` and `tools/`, so that a wrong `include`
 *    pattern is caught and not merely re-encoded. For Playwright, every test it collected must
 *    have produced a result. Neither needs updating when the suite grows.
 * 2. **A committed lower bound**, below. A lower bound rather than an exact count because the
 *    exact work is done by (1): this number exists to catch the cases (1) cannot see — the disk
 *    glob matching nothing, or Playwright collecting a fraction of the suite and then faithfully
 *    running all of it. An exact count would have to be edited by every pull request that adds a
 *    test for no signal that (1) does not already give, and a number edited that often stops being
 *    read.
 *
 * The pairing matters more than either half. A check that compares two numbers it derives from the
 * same broken source passes silently, which is the exact failure mode this file exists to end.
 */

/**
 * The number of unit test files this repository is known to have. Raise it when the suite grows
 * enough that the old number would no longer notice a directory going missing; it never needs
 * touching to make a green run green.
 */
export const MINIMUM_UNIT_TEST_FILES = 73

/**
 * `npx playwright test --list` reports `Total: 256 tests in 20 files`, at both base paths. Same
 * rule as above: this is the backstop for a short *collection*, not a count to keep in step.
 */
export const MINIMUM_E2E_TESTS = 256

/**
 * The one way out, for the runs that are a subset on purpose — `npm run review:greyscale`, or a
 * single file while you work on it. It is an env var rather than a silent heuristic so that a run
 * with no floor says so on the command line that asked for it.
 */
export const floorIsEnforced = (): boolean => process.env.TEST_FLOOR !== 'off'

/** Directories that hold no source of ours; pruned so the glob does not walk `node_modules`. */
const NOT_OURS = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
])

/**
 * Every unit test file in the repository, as paths relative to `root`.
 *
 * Deliberately **not** `vite.config.ts`'s `include` patterns. Asking vitest's own patterns which
 * files vitest should have run is a tautology, and it is the tautology that let the `include` bug
 * ship. This walks the whole tree instead, so a test file that no pattern covers shows up as one
 * that did not run.
 */
export const unitTestFilesOnDisk = async (root: string): Promise<readonly string[]> => {
  const found: string[] = []
  for await (const path of glob(['**/*.test.ts', '**/*.test.tsx'], {
    cwd: root,
    exclude: (candidate) => NOT_OURS.has(candidate.split(sep)[0] ?? ''),
  })) {
    found.push(path)
  }
  return found.sort()
}

export type UnitRun = {
  readonly minimum: number
  /** Test files vitest collected, relative to the repository root. */
  readonly collected: readonly string[]
  /** Test files on disk, relative to the repository root. */
  readonly onDisk: readonly string[]
}

/** Empty when the floor holds; one line per breach otherwise. */
export const unitFloorBreaches = ({ minimum, collected, onDisk }: UnitRun): readonly string[] => {
  const ran = new Set(collected)
  const missing = onDisk.filter((file) => !ran.has(file))
  return [
    ...(collected.length < minimum
      ? [`${collected.length} test files ran; the committed floor is ${minimum}.`]
      : []),
    ...(onDisk.length < minimum
      ? [
          `the floor's own glob found ${onDisk.length} test files on disk, fewer than the ` +
            `committed floor of ${minimum} — either test files were deleted, or this check is broken.`,
        ]
      : []),
    ...(missing.length > 0
      ? [
          `${missing.length} test ${missing.length === 1 ? 'file exists' : 'files exist'} but did not run:\n` +
            missing.map((file) => `      ${file}`).join('\n'),
        ]
      : []),
  ]
}

export type E2eRun = {
  readonly minimum: number
  /** Tests Playwright collected for this run. */
  readonly collected: number
  /** Collected tests that produced a result other than `skipped`. */
  readonly executed: number
}

/** Empty when the floor holds; one line per breach otherwise. */
export const e2eFloorBreaches = ({ minimum, collected, executed }: E2eRun): readonly string[] => [
  ...(collected < minimum
    ? [`Playwright collected ${collected} tests; the committed floor is ${minimum}.`]
    : []),
  ...(executed < collected
    ? [`${collected - executed} of the ${collected} collected tests never ran.`]
    : []),
]

/** The breach, phrased so that nobody reads it as a warning. */
export const breachReport = (runner: string, breaches: readonly string[]): string =>
  [
    '',
    `  ${runner} test floor breached — this run is NOT a pass.`,
    ...breaches.map((breach) => `    · ${breach}`),
    '    A deliberate subset? Re-run it with TEST_FLOOR=off.',
    '',
  ].join('\n')
