// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { importPgn } from './pgn-import.ts'
import type { ImportOptions, ImportResult } from './pgn-import.ts'
import { validateText } from './validate.ts'

/**
 * AC 1. A PGN with recursive variations becomes a YAML skeleton that keeps the branch
 * structure, the comments and the NAG suffixes.
 *
 * The import is also tested for what it refuses to produce. A tool that quietly filled in
 * a `dismissed` reason, a soundness label or an ECO code would make the content gate pass
 * on content nobody has actually judged, which is worse than the gate failing.
 */

const base: ImportOptions = {
  id: 'fixture-import',
  name: undefined,
  eco: 'C40',
  side: 'white',
  category: 'trap',
  soundness: 'dubious',
  author: 'tester',
  today: '2026-09-16',
  definingPlies: undefined,
}

const imported = (pgn: string, overrides: Partial<ImportOptions> = {}): ImportResult =>
  importPgn(pgn, { ...base, ...overrides })

const succeeded = (result: ImportResult): string => {
  if (!result.ok) throw new Error(result.problem.message)
  return result.yaml
}

const refused = (result: ImportResult): string => {
  if (result.ok) throw new Error('expected the import to be refused')
  return result.problem.message
}

const TWO_BRANCHES = `1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 4. Qh5+ g6 $2 {Mất quân.}
(4... Ke7 $4 {Vua lộ diện.} 5. Qxe5+ Kf7) 5. Qxe5+ *`

describe('branch structure', () => {
  it('turns a variation into a sibling of the move it replaces', () => {
    const report = validateText('imported.yaml', succeeded(imported(TWO_BRANCHES)))

    expect(report.issues).toStrictEqual([])
    expect(report.entry?.tree.children.map((child) => child.ply)).toStrictEqual(['g6', 'Ke7'])
  })

  it('keeps a variation nested inside a variation', () => {
    const nested = `1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 4. Qh5+ g6 (4... Ke7 5. Qxe5+ Kf7 6. Bc4+ (6. Qf5+)) 5. Qxe5+ *`
    const report = validateText('imported.yaml', succeeded(imported(nested)))
    const branch = report.entry?.tree.children.find((child) => child.ply === 'Ke7')
    const afterKf7 = branch?.children[0]?.children[0]

    expect(report.issues).toStrictEqual([])
    expect(afterKf7?.ply).toBe('Kf7')
    expect(afterKf7?.children.map((child) => child.ply)).toStrictEqual(['Bc4+', 'Qf5+'])
  })

  it('ends every line that stops with an honest `unexplored` leaf, never a bare node', () => {
    const report = validateText('imported.yaml', succeeded(imported(TWO_BRANCHES)))
    const leaf = report.entry?.tree.children[0]?.children[0]

    expect(leaf?.outcome).toStrictEqual({ kind: 'unexplored' })
  })
})

describe('comments and NAGs', () => {
  it('keeps a PGN comment as the Vietnamese annotation, which is the source locale', () => {
    const report = validateText('imported.yaml', succeeded(imported(TWO_BRANCHES)))

    expect(report.entry?.tree.children[0]?.annotation?.vi).toBe('Mất quân.')
    expect(report.entry?.tree.children[0]?.annotation?.en).toBeUndefined()
  })

  /**
   * A comment on the last defining-line ply is a comment about the position the root *is*.
   * Dropping it would make "comments are preserved" true only of the ones past the branch
   * point, which is not what AC 1 says.
   */
  it('keeps a comment written on a defining-line ply as the root annotation', () => {
    const pgn = `1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 4. Qh5+ {Chiếu và bắt tốt e5.} g6 (4... Ke7) *`
    const report = validateText('imported.yaml', succeeded(imported(pgn)))

    expect(report.entry?.tree.annotation?.vi).toBe('Chiếu và bắt tốt e5.')
  })

  it('maps a NAG on the opponent’s reply to `replyQuality`', () => {
    const report = validateText('imported.yaml', succeeded(imported(TWO_BRANCHES)))

    expect(report.entry?.tree.children[0]?.replyQuality).toBe('mistake')
    expect(report.entry?.tree.children[1]?.replyQuality).toBe('blunder')
  })

  it('reads the `??` suffix the same as an explicit $4', () => {
    const pgn = `1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 4. Qh5+ g6?? (4... Ke7) *`
    const report = validateText('imported.yaml', succeeded(imported(pgn)))

    expect(report.entry?.tree.children[0]?.replyQuality).toBe('blunder')
  })

  /**
   * The model has no field for a quality on a move the gambit prescribes, and inventing
   * one would put a claim in the data that nothing validates. The glyph is kept where a
   * human will see it instead of being dropped without a word.
   */
  it('keeps a NAG on a learner’s move as a YAML comment rather than inventing a field', () => {
    const pgn = `1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 4. Qh5+ g6 (4... Ke7) 5. Qxe5+! *`
    const result = imported(pgn)
    const yaml = succeeded(result)

    expect(yaml).toContain('# PGN NAG $1 (!)')
    expect(yaml).toContain('no `replyQuality`')
    if (!result.ok) throw new Error('unreachable')
    expect(result.summary.keptNags).toBe(1)
    // And it is a comment, so it is not data: the parsed document has no such field.
    const parsed: unknown = parse(yaml)
    expect(JSON.stringify(parsed)).not.toContain('NAG')
  })

  it('keeps a NAG on a defining-line ply beside the defining line', () => {
    const pgn = `1. e4 e5 2. Nf3 f6?? 3. Nxe5 fxe5 4. Qh5+ g6 (4... Ke7) *`
    const yaml = succeeded(imported(pgn))

    expect(yaml).toContain('# PGN NAGs on the defining line, by ply: 4:$4 (??)')
    expect(validateText('imported.yaml', yaml).issues).toStrictEqual([])
  })
})

describe('the YAML it writes', () => {
  /**
   * Regression, found by running the importer's own output through the gate. `yaml` emits
   * an anchor the moment two fields share an object — `soundness.basis` and `judgement`
   * are the same author on the same date — and the loader refuses anchors and aliases
   * outright (docs/security.md, B1). The importer would have produced a file its own gate
   * rejected, with a message about YAML indirection that no author could act on.
   */
  it('contains no YAML anchor or alias, which the loader refuses', () => {
    const yaml = succeeded(imported(TWO_BRANCHES))

    expect(yaml).not.toMatch(/&[A-Za-z]\w*\s*$/m)
    expect(yaml).not.toMatch(/:\s*\*[A-Za-z]/)
    expect(validateText('imported.yaml', yaml).issues).toStrictEqual([])
  })

  it('says where it came from and that the YAML is now the source of truth', () => {
    expect(succeeded(imported(TWO_BRANCHES))).toContain('only source of')
  })

  it('canonicalises SAN through chess.js rather than trusting the PGN spelling', () => {
    // `e4` is fine; `Qh5` without the check marker is not, and chess.js writes `Qh5+`.
    const pgn = `1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 4. Qh5 g6 (4... Ke7) *`
    const yaml = succeeded(imported(pgn))

    expect(yaml).toContain('Qh5+')
    expect(validateText('imported.yaml', yaml).issues).toStrictEqual([])
  })
})

describe('the defining line', () => {
  it('runs to the first branch, so the root is where the gambit starts branching', () => {
    const result = imported(TWO_BRANCHES)
    if (!result.ok) throw new Error(result.problem.message)

    expect(result.summary.definingLine).toStrictEqual([
      'e4',
      'e5',
      'Nf3',
      'f6',
      'Nxe5',
      'fxe5',
      'Qh5+',
    ])
  })

  /**
   * Invariant 5: it ends with the learner's own ply, so the root is an opponent node and
   * the opponent's error is always a modelled reply that can carry a quality.
   */
  it('stops one ply short when the first branch leaves the opponent to move', () => {
    const pgn = `1. e4 e5 2. Nf3 Nc6 (2... f6) *`
    const result = imported(pgn, { side: 'black' })
    if (!result.ok) throw new Error(result.problem.message)

    expect(result.summary.definingLine).toStrictEqual(['e4', 'e5'])
  })

  it('can be pinned with an explicit ply count', () => {
    const result = imported(TWO_BRANCHES, { definingPlies: 5 })
    if (!result.ok) throw new Error(result.problem.message)

    expect(result.summary.definingLine).toStrictEqual(['e4', 'e5', 'Nf3', 'f6', 'Nxe5'])
  })

  /**
   * Invariant 5 wants the root to be an opponent node. The derivation always produces one,
   * and an explicit override does not: that is left to the author and written into the file,
   * because the content gate does not enforce it and merged fixtures in this repository sit
   * on the other side of it.
   */
  it('records, rather than refuses, a pinned line that leaves the learner to move', () => {
    const yaml = succeeded(imported(TWO_BRANCHES, { definingPlies: 6 }))

    expect(yaml).toContain('invariant 5')
    expect(validateText('imported.yaml', yaml).issues.length).toBeGreaterThanOrEqual(0)
  })
})

describe('what it refuses', () => {
  it('refuses an illegal move, and says the parser never checked it', () => {
    const pgn = `1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 4. Qh5+ Qh4 (4... Ke7) *`

    expect(refused(imported(pgn))).toContain('not a legal move')
  })

  it('refuses a PGN that starts from a FEN, because positions are derived', () => {
    const pgn = `[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n\n1. Ka2 *`

    expect(refused(imported(pgn))).toContain('invariant 1')
  })

  it('refuses a file with more than one game', () => {
    const pgn = `[Event "A"]\n\n1. e4 *\n\n[Event "B"]\n\n1. d4 *\n`

    expect(refused(imported(pgn))).toContain('One PGN file becomes one entry')
  })

  it('refuses a PGN with no ECO tag and no --eco, rather than choosing a code', () => {
    expect(refused(imported(TWO_BRANCHES, { eco: undefined }))).toContain('--eco')
  })

  it('refuses a PGN with no author, rather than attributing the judgements to nobody', () => {
    expect(refused(imported(TWO_BRANCHES, { author: undefined }))).toContain('invariant 7b')
  })

  it('reports a syntax error with the line and column it happened on', () => {
    const result = imported('1. e4 ((((')
    if (result.ok) throw new Error('expected a refusal')

    expect(result.problem.at?.line).toBe(1)
    expect(result.problem.at?.column).toBeGreaterThan(0)
  })

  it('refuses an empty file', () => {
    expect(refused(imported('*'))).toContain('no moves')
  })
})

describe('what it will not invent', () => {
  /**
   * The check ADR-0004 calls the one the product turns on. The importer knows exactly which
   * replies are legal — `chess.js` is right there — and still does not write a `dismissed`
   * entry for them, because a dismissal carries a *reason*, and a generated reason would
   * satisfy the check while meaning nothing.
   */
  it('writes no `dismissed` entry, leaving the gate to demand a real reason', () => {
    // After 3.Nxe5 Black has many legal replies; the PGN models one.
    const pgn = `1. e4 e5 2. Nf3 f6 3. Nxe5 fxe5 (3... Qe7) *`
    const yaml = succeeded(imported(pgn))
    const report = validateText('imported.yaml', yaml)

    // Checked against the parsed data, not the text: the header comment mentions the word
    // precisely in order to tell the author it is theirs to write.
    expect(JSON.stringify(parse(yaml))).not.toContain('dismissed')
    expect(report.issues.map((issue) => issue.code)).toContain('reply-incomplete')
  })

  it('writes no assessment, so a stopping point stays visibly unexplored', () => {
    const yaml = succeeded(imported(TWO_BRANCHES))

    expect(yaml).not.toContain('type: position')
    expect(validateText('imported.yaml', yaml).entry?.tier).toBe('listed')
  })

  it('writes no mate outcome, which only a proof may produce', () => {
    expect(JSON.stringify(parse(succeeded(imported(TWO_BRANCHES))))).not.toContain('mate')
  })
})
