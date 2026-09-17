import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MINIMUM_E2E_TESTS,
  MINIMUM_UNIT_TEST_FILES,
  e2eFloorBreaches,
  unitFloorBreaches,
  unitTestFilesOnDisk,
  floorIsEnforced,
} from './floor.ts'

/**
 * The floor is a gate, so these tests are written the way `tools/lint/lint-gate.test.ts` is
 * written: they do not ask whether it is configured, they breach it and insist it notices. A gate
 * nobody has tried to get past is the kind this project keeps finding holes in.
 */

const REPO_ROOT = join(import.meta.dirname, '..', '..')

const twoFiles = ['src/a.test.ts', 'tools/b.test.ts'] as const

describe('the unit test floor', () => {
  it('passes a run that collected every file on disk and cleared the minimum', () => {
    expect(
      unitFloorBreaches({ minimum: 2, collected: [...twoFiles], onDisk: [...twoFiles] }),
    ).toEqual([])
  })

  it('fails when a file on disk did not run, and names it', () => {
    const breaches = unitFloorBreaches({
      minimum: 1,
      collected: ['src/a.test.ts'],
      onDisk: [...twoFiles],
    })

    expect(breaches).toHaveLength(1)
    expect(breaches[0]).toContain('tools/b.test.ts')
  })

  it('fails when fewer files ran than the committed minimum', () => {
    const breaches = unitFloorBreaches({
      minimum: 3,
      collected: [...twoFiles],
      onDisk: [...twoFiles],
    })

    expect(breaches.some((breach) => breach.includes('2 test files ran'))).toBe(true)
  })

  /**
   * The failure the floor is most likely to have itself: a glob that matches nothing compares
   * zero against zero and calls it a pass. The committed minimum is the only thing standing
   * between that and a gate that is quietly gone.
   */
  it('fails when its own glob finds fewer files than the committed minimum', () => {
    const breaches = unitFloorBreaches({ minimum: 3, collected: [...twoFiles], onDisk: [] })

    expect(breaches.some((breach) => breach.includes('or this check is broken'))).toBe(true)
  })

  it('finds at least the committed minimum of test files in this repository', async () => {
    const onDisk = await unitTestFilesOnDisk(REPO_ROOT)

    expect(onDisk.length).toBeGreaterThanOrEqual(MINIMUM_UNIT_TEST_FILES)
    expect(onDisk).toContain('tools/test/floor.test.ts')
  })

  it('looks outside the directories vitest is configured to collect', async () => {
    const onDisk = await unitTestFilesOnDisk(REPO_ROOT)

    // `src/` and `tools/` are what `vite.config.ts` includes. The glob must not be written from
    // that list, or it can never catch the list being wrong.
    expect(onDisk.some((file) => file.startsWith('node_modules/'))).toBe(false)
  })
})

describe('the end-to-end test floor', () => {
  it('passes a run that executed everything it collected, above the minimum', () => {
    expect(e2eFloorBreaches({ minimum: 2, collected: 2, executed: 2 })).toEqual([])
  })

  it('fails when a collected test never ran — the 158-of-224 shape', () => {
    const breaches = e2eFloorBreaches({ minimum: 100, collected: 224, executed: 158 })

    expect(breaches).toEqual(['66 of the 224 collected tests never ran.'])
  })

  it('fails when collection itself came up short', () => {
    const breaches = e2eFloorBreaches({
      minimum: MINIMUM_E2E_TESTS,
      collected: 158,
      executed: 158,
    })

    expect(breaches.some((breach) => breach.includes('collected 158 tests'))).toBe(true)
  })
})

/**
 * The pure functions above can be right while the floor is still ornamental. What actually fails
 * a run is `process.exitCode = 1` written from a reporter hook, which vitest honours today and
 * has never promised to. So this breaches the real gate, through the real config, and reads the
 * real exit code — the same reason `tools/lint/lint-gate.test.ts` shells out to `oxlint` rather
 * than asserting over `.oxlintrc.json`.
 */
describe('the floor as it is actually wired', () => {
  const REPO_ROOT_DIR = join(import.meta.dirname, '..', '..')

  /** One cheap file, so the nested run costs startup and almost nothing else. */
  const runOneFile = (floor: string) =>
    spawnSync(
      join(REPO_ROOT_DIR, 'node_modules', '.bin', 'vitest'),
      ['run', 'tools/shells/csp.test.ts'],
      {
        cwd: REPO_ROOT_DIR,
        encoding: 'utf8',
        env: { ...process.env, TEST_FLOOR: floor },
      },
    )

  it('fails a run in which every test passed and most of the suite never ran', () => {
    const run = runOneFile('on')

    expect(run.stdout).toContain('test floor breached')
    expect(run.stdout).toContain('1 test files ran; the committed floor is')
    expect(run.status).toBe(1)
  })

  it('lets that same run pass once it says out loud that it is a subset', () => {
    const run = runOneFile('off')

    expect(run.stdout).toContain('not enforced')
    expect(run.status).toBe(0)
  })
})

/**
 * The escape hatch, and the one place it may not reach.
 *
 * `TEST_FLOOR=off` exists because some runs really are a subset on purpose, and an env var is
 * the honest way to say so: the run that skipped the floor announces it on the line that asked
 * for it. That honesty is worth something on a developer's machine and nothing at all on the
 * merge path, where the person who would read the announcement is the same person who wrote it.
 *
 * So the merge path may not carry it. This is not a hypothetical tidiness rule. Everything this
 * floor exists to catch — five test files silently dropped by an `include` pattern, fourteen
 * lost to a fixture race, a Playwright run reporting two thirds of itself as a pass — was a
 * **green** result, and the cheapest way to make a stubborn red one green again is to reach for
 * the documented switch. A gate with a documented off switch and nothing watching it is a
 * suggestion.
 */
describe('the floor cannot be switched off on the way to main', () => {
  const merged = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8')

  it('is not disabled anywhere in the workflow that gates a merge', () => {
    const workflow = merged(join('.github', 'workflows', 'ci.yml'))

    expect(workflow).toContain('npm test')
    expect(workflow).toContain('npm run e2e')
    expect(workflow).not.toContain('TEST_FLOOR')
  })

  it('is not disabled by the scripts that workflow runs', () => {
    const manifest: unknown = JSON.parse(merged('package.json'))
    const scripts =
      typeof manifest === 'object' && manifest !== null && 'scripts' in manifest
        ? manifest.scripts
        : undefined
    if (typeof scripts !== 'object' || scripts === null)
      throw new Error('package.json has no scripts')

    const gating = new Set(['test', 'pretest', 'e2e'])
    const entries: readonly (readonly [string, unknown])[] = Object.entries(scripts)
    const checked = entries.filter(
      ([name, script]) => gating.has(name) && typeof script === 'string',
    )

    // Without this the loop below is happy to check nothing at all, which is the shape of
    // failure this whole file exists to make impossible.
    expect(checked.map(([name]) => name).sort()).toStrictEqual(['e2e', 'pretest', 'test'])

    for (const [name, script] of checked) {
      expect(String(script), `\`npm run ${name}\` disables the floor`).not.toContain('TEST_FLOOR')
    }
  })

  /**
   * And the hatch really is a hatch — asserted so this file cannot pass by testing a switch that
   * had quietly stopped working, which would leave the two assertions above guarding nothing.
   */
  it('still works where it is allowed', () => {
    expect(floorIsEnforced()).toBe(true)
  })
})
