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

/** Named so no test runner, bundler or tripwire scan picks it up while it briefly exists. */
const FIXTURE = '__lint-gate-fixture__.ts'

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
    const result = runGate()
    expect(result.stdout + result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})

describe.each(VIOLATIONS)('the gate rejects $what', ({ rule, source }) => {
  it.each(COVERED)('in %s/', (directory) => {
    const result = withFixture(directory, source, () => runGate())

    expect(result.status).not.toBe(0)
    // AC 1: the message names the file and the line.
    expect(result.stdout).toContain(`${directory}/${FIXTURE}:`)
    expect(result.stdout).toMatch(new RegExp(`${FIXTURE}:\\d+:\\d+: error`))
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
