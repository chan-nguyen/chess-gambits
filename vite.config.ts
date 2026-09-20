/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { TestFileFloor } from './tools/test/vitest-floor.ts'

/**
 * GitHub Pages serves a project site from /<repo>/ (ADR-0007), so the base path is
 * configuration rather than a constant — adding a custom domain later moves the site
 * to / and must not require touching router paths. `vite dev` serves at the base path
 * too, so sub-path bugs surface in development rather than in production.
 */
const base = process.env.BASE_PATH ?? '/chess-gambits/'

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    // Only unit tests. `e2e/` holds Playwright specs and vitest would try to run them.
    // Both roots must be listed: `src/` is the application, `tools/` is the build-time
    // content gate. Naming only `src/` silently drops the gate's own tests, which is how
    // a suite reports green while the checks that matter most are not running at all.
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.{ts,tsx}'],
    /**
     * Vitest's 5s default assumes tests do not compute anything. Several here do real work:
     * proving a mate *absent* is exhaustive search and costs seconds by nature (ADR-0005), and
     * the catalogue budget test generates 1,500 real entries through the real pipeline.
     *
     * Two of them measured 4.8s and 4.76s on a developer machine — under the default, and over
     * it on a shared runner, so whether the build was green depended on which runner it drew.
     * Raised once here rather than patched test by test; a genuinely hung test now takes 30s to
     * fail instead of 5, which is the cost of not having a flaky gate.
     *
     * Raised again, 30s → 90s, by the Fishing Pole Trap's mate-in-3 certificate (2026-09-18):
     * `verify:mates`' minimality check runs an independent, exhaustive search up to the claimed
     * depth (ADR-0005) to confirm no *shorter* mate exists, and a wide first ply (26 replies)
     * at three plies deep costs far more than the mate-in-1/mate-in-2 claims that set the
     * previous number. Measured 24s for `verify:mates` alone and up to 48.7s for the single
     * `content.test.ts` case that validates this one file, both on a developer machine — so a
     * shared runner needed real headroom, not another value picked to just clear one measurement.
     *
     * Raised again, 90s → 150s (2026-09-20): CI's `Test` step failed twice in a row on PR #128
     * with `tools/content/cli.test.ts`'s and `tools/content/content-cli.test.ts`'s
     * subprocess-spawning cases each hitting exactly 90000ms, on the same CI run whose e2e jobs
     * also needed their own webServer timeout raised (`playwright.config.ts`) for the identical
     * reason — a shared runner running unusually slow that day, not a hang in the tests
     * themselves. A clean sibling worktree ran the same cases in 15–27s. As with the two raises
     * above, the fix is more headroom, not a value tuned to one bad run.
     */
    testTimeout: 150_000,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    /**
     * Vitest stubs CSS imports to an empty module by default, which also empties `?raw`
     * and `?inline`. Components assert over their own stylesheets — that a board draws
     * with design tokens rather than raw colours, for one — so the text has to survive
     * the transform.
     */
    css: true,
    /**
     * `isolate` stays at its default, and so does `pool`, against the hint vitest prints under
     * every run (issue #50, AC 3). The hint is honest about the arithmetic and wrong about the
     * trade.
     *
     * Measured on this suite, three runs each: **10.80s** isolated, **9.30s** with
     * `--no-isolate` — so the ~1.5s it promises is real, and it is 14% of a ten-second suite
     * that runs inside a CI job dominated by `npm ci`, a build and Lighthouse. What it costs is
     * one jsdom global and one module registry shared by every file that lands in the same
     * worker. This project's recurring defect is precisely a test file quietly ceasing to be
     * independent of its neighbours — i18next is a module singleton, and #50 itself was one
     * file's side effect landing inside another file's import. Per-file isolation is the thing
     * that makes those failures loud instead of intermittent, and 1.5s does not buy it back.
     *
     * `pool: 'vmThreads'` is not a trade at all: it fails `tools/content/content-cli.test.ts`
     * on every run with `expected [] to strictly equal []` — arrays built in another VM realm
     * are not the arrays the assertions compare against — and it measured no faster
     * (8.50s, 10.67s, 11.55s).
     *
     * Vitest's default, written down so the next reader of that hint finds the answer rather
     * than the question.
     */
    isolate: true,
    /**
     * The floor from issue #50: a run that collected fewer test files than exist on disk fails,
     * however green its assertions were. `tools/test/floor.ts` says why it is a reporter and not
     * a test. `default` is listed because naming any reporter replaces the list rather than
     * adding to it.
     */
    reporters: ['default', new TestFileFloor()],
  },
})
