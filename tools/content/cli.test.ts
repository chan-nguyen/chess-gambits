// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

/** `npm run validate:content` itself (AC 10): the exit code is what CI reads. */

const root = fileURLToPath(new URL('../../', import.meta.url))
const cli = 'tools/content/cli.ts'

const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })

const temporary: string[] = []
const scratch = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'content-gate-'))
  temporary.push(directory)
  return directory
}

afterAll(() => {
  for (const directory of temporary) {
    spawnSync('rm', ['-rf', directory])
  }
})

describe('validate:content', () => {
  it('exits 0 on the valid fixtures and reports the derived tier', () => {
    const result = run('tools/content/fixtures/valid')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('taught')
    expect(result.stdout).toContain('Translation coverage')
    // The count is printed, so one line of YAML never hides how many replies it answers.
    expect(result.stdout).toContain('dismissRest answers 34 of 35 legal replies')
  })

  it('exits 0 on the committed content and is what CI runs with no arguments', () => {
    const result = run()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('content/damiano-defence-refutation.yaml')
  })

  it('exits 1 on the adversarial corpus, naming a file, a node and a line', () => {
    const result = run('tools/content/fixtures/invalid')
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('tools/content/fixtures/invalid/missing-reply.yaml:')
    expect(result.stdout).toContain('[reply-incomplete]')
    expect(result.stdout).toMatch(/31 file\(s\) rejected/)
  })

  it('exits 1 when two entries share an id, because an id is a published URL', () => {
    const directory = scratch()
    const original = join(root, 'tools/content/fixtures/valid/listed-entry.yaml')
    copyFileSync(original, join(directory, 'one.yaml'))
    copyFileSync(original, join(directory, 'two.yaml'))
    const result = run(directory)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('[duplicate-id]')
  })

  it('exits 1 when there is nothing to check, because that is not the same as passing', () => {
    const directory = scratch()
    writeFileSync(join(directory, 'notes.txt'), 'nothing here\n')
    const result = run(directory)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('not the same as everything passing')
  })
})
