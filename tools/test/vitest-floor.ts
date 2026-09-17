import { relative } from 'node:path'
import type { Reporter, TestModule, Vitest } from 'vitest/node'
import {
  MINIMUM_UNIT_TEST_FILES,
  breachReport,
  floorIsEnforced,
  unitFloorBreaches,
  unitTestFilesOnDisk,
} from './floor.ts'

/**
 * The vitest half of the floor described in `./floor.ts`, registered in `vite.config.ts`.
 *
 * It is a reporter rather than a test file on purpose. A test file that counts the suite is a
 * check that disappears with exactly the class of fault it is there to catch — the missing file
 * could be this one, and the run would still be green. A reporter is loaded from the config, runs
 * in the main process, and reports on a run it did not take part in.
 *
 * `process.exitCode = 1` is how it fails the run. Vitest sets that itself for a failed run just
 * before it calls `onTestRunEnd`, and does not read it again afterwards, so writing it here is
 * additive and survives to the exit.
 */
export class TestFileFloor implements Reporter {
  #root = process.cwd()
  #watch = false

  onInit(vitest: Vitest): void {
    this.#root = vitest.config.root
    this.#watch = vitest.config.watch
  }

  async onTestRunEnd(testModules: readonly TestModule[]): Promise<void> {
    // Watch mode reruns one file at a time by design, and has no exit code to fail.
    if (this.#watch) return

    if (!floorIsEnforced()) {
      console.log('  Test floor  not enforced (TEST_FLOOR=off)')
      return
    }

    const collected = testModules.map((module) => relative(this.#root, module.moduleId)).sort()
    const onDisk = await unitTestFilesOnDisk(this.#root)
    const breaches = unitFloorBreaches({
      minimum: MINIMUM_UNIT_TEST_FILES,
      collected,
      onDisk,
    })

    if (breaches.length === 0) {
      console.log(
        `  Test floor  ${collected.length} test files ran — every one of the ${onDisk.length} on disk, ` +
          `and at least the ${MINIMUM_UNIT_TEST_FILES} committed`,
      )
      return
    }

    console.log(breachReport('vitest', breaches))
    process.exitCode = 1
  }
}
