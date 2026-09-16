// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateText } from './validate.ts'

/** Valid fixtures parse, and the tier they derive is the tier their content earns (AC 1, 2). */

const root = fileURLToPath(new URL('../../', import.meta.url))

const validate = (relativePath: string) =>
  validateText(relativePath, readFileSync(`${root}${relativePath}`, 'utf8'))

const yamlIn = (relativeDir: string): readonly string[] =>
  readdirSync(`${root}${relativeDir}`)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => `${relativeDir}${name}`)

describe('valid content', () => {
  for (const file of [...yamlIn('tools/content/fixtures/valid/'), ...yamlIn('content/')]) {
    it(`accepts ${file}`, () => {
      const report = validate(file)
      expect(report.issues.map((issue) => `${issue.code} ${issue.message}`)).toEqual([])
      expect(report.entry).toBeDefined()
    })
  }

  it('derives listed for an entry whose tree stops at the root', () => {
    const report = validate('tools/content/fixtures/valid/listed-entry.yaml')
    expect(report.entry?.tier).toBe('listed')
    expect(report.entry?.tree.outcome).toEqual({ kind: 'unexplored' })
  })

  it('derives mapped when the tree is complete but only Vietnamese is written', () => {
    const report = validate('tools/content/fixtures/valid/mapped-transposition.yaml')
    expect(report.entry?.tier).toBe('mapped')
    expect(report.coverage.vi).toBe(report.coverage.slots)
    expect(report.coverage.en).toBe(0)
  })

  it('derives taught only when all three locales are complete', () => {
    const report = validate('tools/content/fixtures/valid/taught-entry.yaml')
    expect(report.entry?.tier).toBe('taught')
    expect(report.coverage).toEqual({ slots: 10, vi: 10, en: 10, fr: 10 })
  })

  it('reports a missing translation as coverage rather than as a failure (AC 9)', () => {
    const report = validate('tools/content/fixtures/valid/mapped-transposition.yaml')
    expect(report.issues).toEqual([])
    expect(report.coverage.fr).toBeLessThan(report.coverage.slots)
  })

  it('derives kind from side to move and never from the file', () => {
    const report = validate('tools/content/fixtures/valid/taught-entry.yaml')
    // The defining line ends with 10...Kf7, so it is White — the learner — to move at the root.
    expect(report.entry?.tree.kind).toBe('learner')
    expect(report.entry?.tree.children.map((child) => child.kind)).toEqual(['opponent'])
  })

  it('derives a position for every node rather than reading one from the file', () => {
    const report = validate('tools/content/fixtures/valid/taught-entry.yaml')
    expect(report.entry?.tree.fen).toMatch(/^[1-8pnbrqkPNBRQK/]+ w /)
  })

  it('resolves a transposition against the first four FEN fields', () => {
    const report = validate('tools/content/fixtures/valid/mapped-transposition.yaml')
    const [first, second] = report.entry?.tree.children ?? []
    expect(first?.children[0]?.children[0]?.transposesTo).toBeUndefined()
    expect(second?.children[0]?.children[0]?.transposesTo).toEqual(['Qe8+', 'Kf6', 'Qg6+'])
  })

  it('records that reply quality and frequency are an author judgement, never a measurement', () => {
    const report = validate('tools/content/fixtures/valid/taught-entry.yaml')
    expect(report.entry?.judgement.basis).toBe('judgement')
    expect(report.entry?.soundness.basis.basis).toBe('judgement')
  })
})
