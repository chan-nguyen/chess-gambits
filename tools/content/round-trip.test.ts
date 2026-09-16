// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { compileEntry, compiledJson } from './compile.ts'
import { importPgn } from './pgn-import.ts'
import type { ImportOptions } from './pgn-import.ts'
import { formatIssues } from './issue.ts'
import { validateText } from './validate.ts'
import type { CompiledEntry, CompiledNode } from '../../src/lib/content-types.ts'

/**
 * AC 7. A PGN with two branches at one move survives import → YAML → compile with both
 * branches intact.
 *
 * This is the acceptance criterion the parser choice rests on, so it is asserted at every
 * stage rather than only at the end: the branch must exist in the source PGN, in the
 * imported YAML, in the validated tree, and in the compiled JSON the browser downloads. A
 * test that only checked the last one would pass on a pipeline that reconstructed the
 * branch from somewhere else.
 *
 * The control below is what makes the rest mean anything. It runs the same PGN with the
 * variation deleted and requires the pipeline to notice — one branch where there were two,
 * and then a refusal, because the deleted reply is still legal and is now neither modelled
 * nor dismissed. A pipeline that always reported two branches, or a matcher that always
 * passed, fails here rather than at the next content bug.
 */

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/pgn/${name}`, import.meta.url)), 'utf8')

const TWO_BRANCHES = fixture('damiano-two-branches.pgn')

/**
 * The same game with `(4... Ke7 ...)` removed. The defining line is pinned to the same
 * seven plies wherever this is used, because with no branch left the importer would derive
 * a longer one — correctly, but then the two runs would not be comparable.
 */
const ONE_BRANCH = TWO_BRANCHES.replace(/\(4\.\.\. Ke7[^)]*\)/, '').replace(/ {2,}/g, ' ')

const options: ImportOptions = {
  id: 'damiano-two-branches',
  name: undefined,
  eco: undefined,
  side: 'white',
  category: 'trap',
  soundness: 'sound',
  author: undefined,
  today: '2026-09-16',
  definingPlies: undefined,
}

/** PGN in, compiled entry out — every step real, none skipped or stubbed. */
const pipeline = (pgn: string): CompiledEntry => {
  const imported = importPgn(pgn, options)
  if (!imported.ok) throw new Error(`import failed: ${imported.problem.message}`)

  const report = validateText('round-trip.yaml', imported.yaml)
  expect(formatIssues(report.issues)).toBe('')
  const { entry } = report
  if (entry === undefined) throw new Error('the imported YAML did not validate')

  const compiled = compileEntry(entry)
  // Through the serialiser and back, because that is what the browser actually receives.
  const parsed: unknown = JSON.parse(compiledJson(compiled))
  expect(parsed).toStrictEqual(compiled)
  return compiled
}

const pliesOf = (children: readonly CompiledNode[] | undefined): readonly string[] =>
  (children ?? []).map((child) => child.ply ?? '(root)')

describe('a PGN with two branches at one move (AC 7)', () => {
  it('has two branches in the source, before anything touches it', () => {
    expect(TWO_BRANCHES).toContain('Qh5+ g6 $2')
    expect(TWO_BRANCHES).toContain('(4... Ke7')
  })

  it('keeps both branches in the imported YAML', () => {
    const imported = importPgn(TWO_BRANCHES, options)
    if (!imported.ok) throw new Error(imported.problem.message)

    expect(imported.yaml).toContain('ply: g6')
    expect(imported.yaml).toContain('ply: Ke7')
    expect(imported.summary.branchPoints).toBe(1)
  })

  it('keeps both branches in the compiled JSON, as siblings under one node', () => {
    expect(pliesOf(pipeline(TWO_BRANCHES).tree.children)).toStrictEqual(['g6', 'Ke7'])
  })

  it('keeps each branch a distinct subtree rather than a repeated one', () => {
    const [first, second] = pipeline(TWO_BRANCHES).tree.children ?? []

    expect(pliesOf(first?.children)).toStrictEqual(['Qxe5+'])
    expect(pliesOf(second?.children)).toStrictEqual(['Qxe5+'])
    // The Ke7 branch continues a ply further, which is what makes these two branches and
    // not one subtree reached twice.
    expect(pliesOf(second?.children?.[0]?.children)).toStrictEqual(['Kf7'])
    expect(first?.children?.[0]?.children).toBeUndefined()
  })

  it('carries the derived kind, FEN and tier that only the build may state', () => {
    const compiled = pipeline(TWO_BRANCHES)

    expect(compiled.tree.kind).toBe('opponent')
    expect(compiled.tree.children?.[0]?.kind).toBe('learner')
    expect(compiled.tree.fen).toContain(' b ')
    expect(compiled.tier).toBe('listed')
  })

  it('keeps the reply qualities the NAGs carried', () => {
    const [first, second] = pipeline(TWO_BRANCHES).tree.children ?? []

    expect(first?.replyQuality).toBe('mistake')
    expect(second?.replyQuality).toBe('blunder')
  })
})

describe('the control: the same PGN with the variation deleted', () => {
  const imported = importPgn(ONE_BRANCH, { ...options, definingPlies: 7 })

  it('imports one branch where the other imported two', () => {
    if (!imported.ok) throw new Error(imported.problem.message)

    expect(imported.yaml).toContain('ply: g6')
    expect(imported.yaml).not.toContain('ply: Ke7')
    expect(imported.summary.branchPoints).toBe(0)
  })

  it('is then refused by the gate, naming the reply that went missing', () => {
    if (!imported.ok) throw new Error(imported.problem.message)
    const report = validateText('one-branch.yaml', imported.yaml)

    expect(report.issues.map((issue) => issue.code)).toContain('reply-incomplete')
    expect(formatIssues(report.issues)).toContain('Ke7')
    expect(report.entry).toBeUndefined()
  })
})

describe('why the parser is not chess.js (ADR-0004)', () => {
  /**
   * A pinned experiment, not a preference. `chess.js` is the rules engine everywhere in
   * this pipeline and is never the parser, because its own `loadPgn()` walks the mainline
   * and drops every variation — silently, with no error to notice.
   *
   * If this test ever fails, `chess.js` has grown variation support and ADR-0004's split
   * is worth revisiting. Until then it is the whole reason `@mliebelt/pgn-parser` is here.
   */
  it('loses every branch when chess.js parses the same PGN', () => {
    const chess = new Chess()
    chess.loadPgn(TWO_BRANCHES)
    const reexported = chess.pgn()

    expect(TWO_BRANCHES).toContain('Ke7')
    expect(reexported).not.toContain('Ke7')
    expect(reexported).not.toContain('(')
  })

  it('keeps every branch when @mliebelt/pgn-parser does', () => {
    expect(pliesOf(pipeline(TWO_BRANCHES).tree.children)).toContain('Ke7')
  })
})
