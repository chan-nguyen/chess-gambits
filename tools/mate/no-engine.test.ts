// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `npm run verify:mates` is a required CI step and must use **`chess.js` only** — no engine
 * (issue #5, AC 2; ADR-0005).
 *
 * That is a claim about a module graph, so it is checked as one: walk every local import
 * reachable from the verifier's entry point and assert that the oracle is not among them.
 * A comment saying "this file is never imported by the verifier" is exactly the kind of gate
 * this project keeps finding to be a comment rather than a rule.
 *
 * It matters for two separate reasons, and neither is hypothetical. Correctness: the engine
 * is an oracle and is trusted for nothing, so a verifier that consulted one would be
 * checking a proof against the thing that produced it. Licensing: GPL-3.0 binds conveying,
 * and the boundary this test draws is where "we use Stockfish on a runner" stops and
 * "we ship Stockfish" would begin.
 */

const here = dirname(fileURLToPath(import.meta.url))

const localImports = (source: string): readonly string[] =>
  [...source.matchAll(/from\s+'(\.[^']+)'/g)].flatMap((match) => match[1] ?? [])

const reachableFrom = (entry: string): ReadonlySet<string> => {
  const seen = new Set<string>()
  const queue = [resolve(here, entry)]
  while (queue.length > 0) {
    const file = queue.pop()
    if (file === undefined || seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const specifier of localImports(source)) queue.push(resolve(dirname(file), specifier))
  }
  return seen
}

const short = (files: ReadonlySet<string>): readonly string[] =>
  [...files].map((file) => file.slice(file.lastIndexOf('/tools/') + 1)).sort()

describe('the verifier speaks to no engine', () => {
  const graph = reachableFrom('./verify-cli.ts')

  it('cannot reach the oracle from `verify:mates`', () => {
    expect(short(graph)).not.toContain('tools/mate/oracle.ts')
    expect([...graph].some((file) => file.endsWith('oracle.ts'))).toBe(false)
  })

  it('names no engine anywhere in its module graph', () => {
    for (const file of graph) {
      const source = readFileSync(file, 'utf8').toLowerCase()
      // The word may appear in prose explaining why it is absent; an *import* may not.
      expect(source).not.toMatch(/from\s+'[^']*stockfish[^']*'/)
      expect(source).not.toMatch(/require\(\s*'[^']*stockfish[^']*'\s*\)/)
    }
  })

  it('spawns no process, which is the only way an engine could be reached at all', () => {
    for (const file of graph) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toContain('node:child_process')
      expect(source).not.toContain('child_process')
    }
  })

  it('reaches the search and the rules engine, so it is verifying something', () => {
    const files = short(graph)

    expect(files).toContain('tools/mate/verify.ts')
    expect(files).toContain('tools/mate/search.ts')
    expect(files).toContain('tools/mate/certificate.ts')
  })
})

describe('the prover is the only thing that may', () => {
  it('reaches the oracle from `prove:mates`, and only from there', () => {
    const graph = short(reachableFrom('./prove-cli.ts'))

    expect(graph).toContain('tools/mate/oracle.ts')
  })

  it('keeps the oracle out of the browser bundle entirely', () => {
    const source = readFileSync(resolve(here, 'oracle.ts'), 'utf8')

    // Build-time only, and stated as such where someone moving the file would read it.
    expect(source).toContain('never shipped')
    expect(source).toContain('GPL-3.0')
  })
})
