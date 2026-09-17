import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The gate that enforces `docs/definition-of-done.md`'s "no new `any`, no `as` assertion, no
 * non-null `!`" (issue #28).
 *
 * This file exists because of the pattern the first day of delivery established: `oxlint` exited 0
 * on `debugger`, a vitest `include` silently dropped five test files, and this very rule was
 * honoured by hand for a week while nothing checked it. Each hole was found by trying to violate
 * the gate, never by the gate passing. So the tests below do not ask whether the rules are
 * configured — they write code that must be rejected and insist that it is.
 */

const repoRoot = join(import.meta.dirname, '..', '..')
const oxlint = join(repoRoot, 'node_modules', '.bin', 'oxlint')

/** Exactly the flags `npm run lint` uses; the test below pins that they stay exactly those. */
const GATE_FLAGS = ['--deny-warnings']

const runGate = (...paths: readonly string[]) =>
  spawnSync(oxlint, [...GATE_FLAGS, ...paths], { cwd: repoRoot, encoding: 'utf8' })

const VIOLATIONS = [
  {
    what: 'an explicit any',
    rule: 'no-explicit-any',
    source:
      'export const bad = (value: unknown) => {\n  const loose: any = value\n  return loose\n}\n',
  },
  {
    what: 'an as assertion',
    rule: 'consistent-type-assertions',
    source: 'export const bad = (value: unknown) => value as string\n',
  },
  {
    what: 'a non-null assertion',
    rule: 'no-non-null-assertion',
    source: 'export const bad = (value: { inner?: number }) => value.inner!\n',
  },
] as const

/** The four trees the rule must cover (issue #28, AC 2). */
const COVERED = ['src', 'tools', 'scripts', 'e2e'] as const

/**
 * The fixture lands inside `src/`, `tools/`, `scripts/` and `e2e/` for a few milliseconds at a
 * time, while seventy other test files are being transformed and run in parallel. Its extension
 * is what keeps that safe, and the reason is not the one the first version of this comment gave.
 *
 * That version named it `__lint-gate__.test.fixture.ts`, reasoning that `.test.` is this
 * repository's marker for "not application source" and that the files globbing `src/**` all skip
 * it. They do — at *assertion* time. But `src/styles/no-raw-values.test.ts` and
 * `src/lib/content.test.ts` reach those files through `import.meta.glob(..., { eager: true })`,
 * which Vite resolves and **imports** when it transforms the importing file, long before any
 * filter in the test body runs. Catch the fixture in that window and the import fails, the whole
 * file fails to load, and its fourteen tests vanish from a suite that still exits 0.
 *
 * That is issue #50 — "one test file occasionally fails to load, taking 14 tests with it" — and
 * the cause was this, not the worker-startup contention it was filed on. Three agents lost time
 * to it.
 *
 * `.mts` closes it properly: `oxlint` lints it like any other TypeScript file, and none of the
 * globs match it, because `*.{ts,tsx}` needs a literal `.ts` and `.mts` does not have one. The
 * fixture is never a module any of those files can try to import.
 */
const FIXTURE = '__lint-gate__.fixture.mts'

const withFixture = <T>(directory: string, source: string, body: (relative: string) => T): T => {
  const relative = join(directory, FIXTURE)
  writeFileSync(join(repoRoot, relative), source)
  try {
    return body(relative)
  } finally {
    rmSync(join(repoRoot, relative), { force: true })
  }
}

describe('the gate command itself', () => {
  it('is the command this file exercises', () => {
    const manifest: unknown = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    const scripts =
      typeof manifest === 'object' && manifest !== null && 'scripts' in manifest
        ? manifest.scripts
        : undefined
    const lint =
      typeof scripts === 'object' && scripts !== null && 'lint' in scripts
        ? scripts.lint
        : undefined

    // If someone drops `--deny-warnings`, or points the script at a subset of paths, every
    // assertion below would keep passing while the real gate quietly weakened.
    expect(lint).toBe(['oxlint', ...GATE_FLAGS].join(' '))
  })

  it('passes on the repository as it stands', () => {
    // Without this, every "the gate rejects X" test below could be green because the gate
    // rejects everything.
    //
    // Only the exit status is asserted. Under `--deny-warnings` a zero exit already means zero
    // errors and zero warnings, so nothing is added by also pinning the text — and the text is
    // not the same everywhere: CI prints a `Found 0 warnings and 0 errors.` summary that a local
    // run does not, which is exactly what an earlier, over-specified version of this assertion
    // tripped on. The output is passed as the failure message so a future break is still legible.
    const result = runGate()
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })
})

/**
 * AC 1 asks that the message name the file and the line, and this predicate is how that is
 * checked, because oxlint does not always say it the same way. Run by hand it uses its own
 * reporter; run inside GitHub Actions it switches to the `::error file=...` workflow-command
 * format. The first version of this test matched only the shape seen locally and went red on CI
 * while the gate underneath was working exactly as intended — the assertion was wrong, not the
 * rule. Both shapes end in `<path>:<line>:<column>:`, so that is what is matched, and the test
 * below pins the predicate against a real line captured from each reporter.
 */
const namesFileAndLine = (output: string, path: string): boolean =>
  new RegExp(`${path.replaceAll('.', '\\.')}:\\d+:\\d+:`).test(output)

describe('reading what the gate reports', () => {
  it('recognises the file and line under either reporter', () => {
    const fromDefaultReporter =
      'src/example.ts:1:51: error typescript(no-non-null-assertion): Forbidden non-null assertion.'
    // Copied verbatim from the run that caught the first version of this file.
    const fromGithubActions =
      '::error file=src/example.ts,line=1,endLine=1,col=51,endColumn=63,' +
      'title=typescript(no-non-null-assertion)::src/example.ts:1:51: Forbidden non-null assertion.'

    expect(namesFileAndLine(fromDefaultReporter, 'src/example.ts')).toBe(true)
    expect(namesFileAndLine(fromGithubActions, 'src/example.ts')).toBe(true)

    // A pass, or a complaint about some other file, must not read as a hit.
    expect(namesFileAndLine('Found 0 warnings and 0 errors.', 'src/example.ts')).toBe(false)
    expect(namesFileAndLine(fromDefaultReporter, 'src/other.ts')).toBe(false)
  })
})

describe.each(VIOLATIONS)('the gate rejects $what', ({ rule, source }) => {
  it.each(COVERED)('in %s/', (directory) => {
    const result = withFixture(directory, source, () => runGate())

    expect(result.status).not.toBe(0)
    expect(namesFileAndLine(result.stdout, `${directory}/${FIXTURE}`)).toBe(true)
    expect(result.stdout).toContain(rule)
  })
})

describe('the escape hatch', () => {
  it('suppresses the rule on the next line, and only there', () => {
    const suppressed = `export const ok = (value: unknown) => {
  // oxlint-disable-next-line typescript/no-explicit-any -- a third-party type models this badly
  const loose: any = value
  return loose
}
`
    expect(withFixture('src', suppressed, () => runGate()).status).toBe(0)

    // Off by one line and the suppression does not apply — the hatch is narrow, not a mood.
    const misplaced = `export const bad = (value: unknown) => {
  // oxlint-disable-next-line typescript/no-explicit-any -- a third-party type models this badly

  const loose: any = value
  return loose
}
`
    expect(withFixture('src', misplaced, () => runGate()).status).not.toBe(0)
  })

  it('carries a written justification everywhere it is used', () => {
    // Built from parts so this scan does not match its own source.
    const needle = ['oxlint', 'disable'].join('-')
    const tracked = spawnSync('git', ['ls-files', ...COVERED], { cwd: repoRoot, encoding: 'utf8' })
    expect(tracked.status).toBe(0)

    const unjustified = tracked.stdout
      .split('\n')
      .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
      .flatMap((file) =>
        readFileSync(join(repoRoot, file), 'utf8')
          .split('\n')
          .map((line, index) => ({ file, line: index + 1, text: line }))
          .filter(({ text }) => text.includes(needle) && !/ -- \S/.test(text))
          .map(({ file: where, line }) => `${where}:${line}`),
      )

    // AC 3: an exception is allowed, but it has to say why, in the diff, where a reviewer sees it.
    expect(unjustified).toStrictEqual([])
  })
})

describe('what the gate deliberately allows', () => {
  it('accepts a const assertion', () => {
    // `as const` is a widening guard, not a claim about a type the compiler cannot check, and four
    // places already rely on it. Pinned so a future tightening of `assertionStyle` is a decision
    // somebody makes on purpose rather than a surprise.
    const source = "export const MODES = ['learn', 'browse'] as const\n"
    expect(withFixture('src', source, () => runGate()).status).toBe(0)
  })
})
