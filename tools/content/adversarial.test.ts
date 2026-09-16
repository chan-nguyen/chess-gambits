// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { IssueCode } from './issue.ts'
import { validateText } from './validate.ts'

/**
 * Every file in `fixtures/invalid` must be rejected, for a named reason (AC 11).
 *
 * A validator with no tests that must fail is not a validator: a check that has never been
 * seen to fire is a check nobody knows is wired up. The expectation table below is the
 * specification, and the last test in this file makes it impossible to add a fixture
 * without also stating why it must be refused.
 */

const directory = fileURLToPath(new URL('./fixtures/invalid/', import.meta.url))

type Expectation = {
  readonly code: IssueCode
  /** A fragment the message must contain, so a vague message fails the test. */
  readonly says: string
  /** The data path the issue must point at, where the point of the fixture is *where* it is. */
  readonly at?: string
}

const MUST_BE_REJECTED: Readonly<Record<string, Expectation>> = {
  'authored-kind.yaml': { code: 'derived-field', says: 'invariant 2', at: 'tree.kind' },
  'authored-tier.yaml': { code: 'derived-field', says: 'invariant 8', at: 'tier' },
  'authored-fen.yaml': { code: 'derived-field', says: 'invariant 1', at: 'tree.fen' },
  'fen-hidden-in-prose.yaml': {
    code: 'derived-field',
    says: 'contains a FEN',
    at: 'tree.annotation.vi',
  },
  'authored-mate-outcome.yaml': {
    code: 'derived-field',
    says: 'never authored',
    at: 'tree.outcome.type',
  },
  'authored-proved-basis.yaml': { code: 'schema', says: 'certificate' },
  'illegal-move.yaml': {
    code: 'illegal-move',
    says: '`Nf6` is not a legal move',
    at: 'tree.children[0].ply',
  },
  'ambiguous-san.yaml': { code: 'illegal-move', says: 'Ngf3', at: 'tree.children[0].ply' },
  'missing-check-suffix.yaml': {
    code: 'san-not-canonical',
    says: 'Write `Qh5+`',
    at: 'tree.children[0].ply',
  },
  'false-mate-claim.yaml': {
    code: 'false-mate-claim',
    says: 'not checkmate',
    at: 'tree.children[0].ply',
  },
  'unmarked-mate.yaml': {
    code: 'unclaimed-mate',
    says: 'must be written `Qh4#`',
    at: 'tree.children[0].ply',
  },
  'assessment-at-checkmate.yaml': {
    code: 'assessment-is-terminal',
    says: 'it is checkmate',
    at: 'tree.children[0].outcome',
  },
  'missing-reply.yaml': { code: 'reply-incomplete', says: 'g6', at: 'tree' },
  'dismissed-not-legal.yaml': {
    code: 'dismissed-not-legal',
    says: '`Nf6` is dismissed',
    at: 'tree.dismissed[0].ply',
  },
  'duplicate-san.yaml': { code: 'duplicate-san', says: 'both `Ke7`', at: 'tree.children[1].ply' },
  'duplicate-position.yaml': { code: 'duplicate-position', says: 'transposesTo' },
  'transposition-mismatch.yaml': {
    code: 'transposition-mismatch',
    says: 'first four FEN fields',
    at: 'tree.children[1].children[0].transposesTo',
  },
  'transposition-unresolved.yaml': { code: 'transposition-unresolved', says: 'No node at' },
  'outcome-and-children.yaml': { code: 'node-shape', says: 'children and outcome', at: 'tree' },
  'no-outcome-no-children.yaml': { code: 'node-shape', says: 'has none', at: 'tree' },
  'reply-quality-on-prescribed-move.yaml': {
    code: 'kind-mismatch',
    says: 'only on a child of an opponent node',
    at: 'tree.children[0].replyQuality',
  },
  'annotation-without-vietnamese.yaml': {
    code: 'schema',
    says: 'expected string',
    at: 'tree.annotation.vi',
  },
  'empty-annotation.yaml': { code: 'schema', says: 'empty', at: 'tree.annotation.vi' },
  'placeholder-annotation.yaml': { code: 'schema', says: 'placeholder', at: 'tree.annotation.vi' },
  'unknown-field.yaml': { code: 'schema', says: 'annotaion', at: 'tree' },
  'yaml-alias-bomb.yaml': { code: 'yaml-alias', says: 'refused' },
  'yaml-too-deep.yaml': { code: 'yaml-too-deep', says: '100 levels' },
}

describe('the adversarial corpus', () => {
  for (const [name, expectation] of Object.entries(MUST_BE_REJECTED)) {
    it(`rejects ${name} with ${expectation.code}`, () => {
      const report = validateText(name, readFileSync(`${directory}${name}`, 'utf8'))

      expect(report.issues.length).toBeGreaterThan(0)
      expect(report.entry).toBeUndefined()

      const matching = report.issues.filter((issue) => issue.code === expectation.code)
      expect(matching.map((issue) => issue.message).join('\n')).toContain(expectation.says)

      if (expectation.at !== undefined) {
        expect(matching.map((issue) => issue.dataPath)).toContain(expectation.at)
      }
    })
  }

  it('names the file and a node on every issue it raises', () => {
    for (const name of Object.keys(MUST_BE_REJECTED)) {
      const report = validateText(name, readFileSync(`${directory}${name}`, 'utf8'))
      for (const issue of report.issues) {
        expect(issue.file).toBe(name)
        expect(issue.dataPath === '' && issue.nodePath === undefined).toBe(false)
        expect(issue.message.length).toBeGreaterThan(20)
      }
    }
  })

  it('has an expectation for every fixture on disk', () => {
    const onDisk = readdirSync(directory)
      .filter((name) => name.endsWith('.yaml'))
      .sort()
    expect(onDisk).toEqual(Object.keys(MUST_BE_REJECTED).sort())
    expect(onDisk.length).toBeGreaterThanOrEqual(10)
  })
})
