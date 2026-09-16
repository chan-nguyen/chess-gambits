// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_DOCUMENT_BYTES, MAX_NESTING_DEPTH, loadYaml } from './yaml-source.ts'

/**
 * Bounded parsing (docs/security.md, B1). A fork pull request runs this parser, so the
 * limits are the control; these tests are what says the control is wired up.
 */

describe('bounded YAML loading', () => {
  it('refuses a document over the size limit before it parses it', () => {
    const oversized = `# ${'x'.repeat(MAX_DOCUMENT_BYTES)}\nid: big\n`
    const result = loadYaml('big.yaml', oversized)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('yaml-too-large')
    expect(result.issues[0]?.message).toContain('Checked before parsing')
  })

  it('measures the size in bytes, not in characters', () => {
    // Every character here is three UTF-8 bytes, so a character count would pass it.
    const multibyte = `a: '${'ề'.repeat(MAX_DOCUMENT_BYTES / 3)}'\n`
    expect(multibyte.length).toBeLessThan(MAX_DOCUMENT_BYTES)
    expect(loadYaml('multibyte.yaml', multibyte).ok).toBe(false)
  })

  it('refuses nesting past the depth limit', () => {
    const deep = `a: ${'['.repeat(MAX_NESTING_DEPTH + 5)}${']'.repeat(MAX_NESTING_DEPTH + 5)}\n`
    const result = loadYaml('deep.yaml', deep)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.code)).toEqual(['yaml-too-deep'])
  })

  it('accepts nesting up to the limit', () => {
    const fine = `a: ${'['.repeat(MAX_NESTING_DEPTH - 2)}1${']'.repeat(MAX_NESTING_DEPTH - 2)}\n`
    expect(loadYaml('fine.yaml', fine).ok).toBe(true)
  })

  it('refuses an alias, and refuses it before the document is expanded', () => {
    // `maxAliasCount: 0` does not do this: measured against yaml 2.9.1, the option lets the
    // alias through and `toJS()` expands it. The refusal has to be our own.
    const result = loadYaml('alias.yaml', 'a: &x { p: 1 }\nb: *x\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.code)).toEqual(['yaml-alias', 'yaml-alias'])
  })

  it('refuses an anchor even where nothing references it', () => {
    const result = loadYaml('anchor.yaml', 'a: &x 1\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.message).toContain('Anchors exist only to be referenced')
  })

  it('refuses a merge key, which needs an alias to mean anything', () => {
    expect(loadYaml('merge.yaml', 'a: &x { p: 1 }\nb:\n  <<: *x\n').ok).toBe(false)
  })

  it('reports a syntax error with a line and column', () => {
    const result = loadYaml('broken.yaml', 'a: [1, 2\nb: 3\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('yaml-syntax')
    expect(result.issues[0]?.at?.line).toBeGreaterThan(0)
  })

  it('locates a data path so an error can name a line', () => {
    const result = loadYaml('ok.yaml', 'tree:\n  children:\n    - ply: e4\n')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source.locate(['tree', 'children', 0, 'ply'])).toEqual({ line: 3, col: 12 })
  })

  it('falls back to the nearest ancestor when a path does not exist', () => {
    const result = loadYaml('ok.yaml', 'tree:\n  children:\n    - ply: e4\n')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source.locate(['tree', 'children', 0, 'missing'])?.line).toBe(3)
  })
})
