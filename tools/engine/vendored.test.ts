// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The vendored engine is what its README says it is, and nothing else reaches into it
 * (ADR-0012).
 *
 * Two claims the licence argument rests on, checked rather than written down. **The files
 * are the upstream release, unmodified**: their SHA-256 hashes are the ones the published
 * README gives, so a changed engine is a failing build and a reviewed diff to both, never a
 * silent swap. **The application does not link to it**: nothing under `src/` imports from
 * the engine directory, and exactly one module starts a worker.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const engine = join(root, 'public/engine')

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex')

/** `| `file` | … | `hash` |` rows of the README's table. */
const documented = (): ReadonlyMap<string, string> => {
  const readme = readFileSync(join(engine, 'README.md'), 'utf8')
  const rows = [...readme.matchAll(/^\|\s*`([^`]+)`\s*\|[^|]*\|\s*`([0-9a-f]{64})`\s*\|$/gm)]
  return new Map(rows.flatMap(([, file, hash]) => (file && hash ? [[file, hash]] : [])))
}

const sourcesUnder = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourcesUnder(path)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })

describe('the vendored engine', () => {
  it('documents every file it ships, and ships every file it documents', () => {
    const shipped = readdirSync(engine)
      .filter((name) => name !== 'README.md')
      .sort()
    expect([...documented().keys()].sort()).toStrictEqual(shipped)
    expect(shipped).toStrictEqual([
      'COPYING.txt',
      'stockfish-19-lite-single.js',
      'stockfish-19-lite-single.wasm',
    ])
  })

  it.each([...documented()])('holds %s to the hash its README publishes', (file, hash) => {
    expect(sha256(join(engine, file))).toBe(hash)
  })

  it('ships the GNU GPL version 3 as its licence', () => {
    const licence = readFileSync(join(engine, 'COPYING.txt'), 'utf8')
    expect(licence).toContain('GNU GENERAL PUBLIC LICENSE')
    expect(licence).toContain('Version 3, 29 June 2007')
  })
})

describe('the application does not link to it', () => {
  const sources = sourcesUnder(join(root, 'src'))

  it('imports nothing from the engine directory, and no stockfish package', () => {
    const offenders = sources.filter((path) =>
      /from\s+['"][^'"]*(public\/engine|stockfish-19|['"]stockfish['"])/.test(
        readFileSync(path, 'utf8'),
      ),
    )
    expect(offenders).toStrictEqual([])
  })

  it('starts a worker in exactly one module, the one that speaks UCI to it', () => {
    const starters = sources
      .filter((path) => /new Worker\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path))
    expect(starters).toStrictEqual(['src/components/analysis/stockfish-source.ts'])
  })
})
