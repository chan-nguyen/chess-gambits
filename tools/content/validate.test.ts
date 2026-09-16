// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { positionKey, replay, startPosition } from './board.ts'
import { validateText } from './validate.ts'

/**
 * Focused tests for the rules that no fixture file expresses on its own, and for the two
 * places where getting it wrong would be silent: an opponent node that is a leaf, and the
 * underpromotions inside a legal move list.
 */

const entry = (side: string, definingLine: string, tree: string): string =>
  [
    'id: unit-under-test',
    'name: Unit under test',
    'eco: C40',
    'category: trap',
    `side: ${side}`,
    `definingLine: [${definingLine}]`,
    'soundness:',
    '  value: unsound',
    "  reviewedAt: '2026-09-16'",
    "  basis: { by: a, at: '2026-09-16' }",
    "judgement: { by: a, at: '2026-09-16' }",
    tree,
  ].join('\n')

const codes = (yaml: string): readonly string[] =>
  validateText('unit.yaml', yaml).issues.map((issue) => issue.code)

const messages = (yaml: string): string =>
  validateText('unit.yaml', yaml)
    .issues.map((issue) => issue.message)
    .join('\n')

const DAMIANO = 'e4, e5, Nf3, f6, Nxe5, fxe5, Qh5+'

describe('the defining line', () => {
  it('is replayed from the standard start position and fails on an illegal ply', () => {
    const yaml = entry('white', 'e4, e5, Nf3, Nf3', 'tree:\n  outcome: { type: unexplored }')
    expect(codes(yaml)).toEqual(['illegal-move'])
    expect(messages(yaml)).toContain('ply 4 of the defining line')
  })

  it('fails when a ply is legal but not canonical', () => {
    const yaml = entry('white', 'e2e4, e5', 'tree:\n  outcome: { type: unexplored }')
    expect(codes(yaml)).toEqual(['san-not-canonical'])
    expect(messages(yaml)).toContain('Write `e4`')
  })
})

describe('reply completeness', () => {
  it('does not fire on an opponent node that is a leaf, which is where a line honestly ends', () => {
    const yaml = entry('white', DAMIANO, 'tree:\n  outcome: { type: unexplored }')
    expect(codes(yaml)).toEqual([])
  })

  it('fires as soon as one reply is modelled, which is the moment the claim is made', () => {
    const yaml = entry(
      'white',
      DAMIANO,
      'tree:\n  children:\n    - ply: Ke7\n      outcome: { type: unexplored }',
    )
    expect(codes(yaml)).toEqual(['reply-incomplete'])
  })

  it('counts a dismissal as cover, so a reason is all that is asked for', () => {
    const yaml = entry(
      'white',
      DAMIANO,
      [
        'tree:',
        '  children:',
        '    - ply: Ke7',
        '      outcome: { type: unexplored }',
        '  dismissed:',
        "    - { ply: g6, reason: 'Blocks with the g-pawn; not modelled yet.' }",
      ].join('\n'),
    )
    expect(codes(yaml)).toEqual([])
  })

  it('demands every underpromotion, because three of the four are the ones people forget', () => {
    const yaml = entry(
      'white',
      'Nf3, b5, Ng1, b4, Nf3, b3, Ng1, bxc2',
      [
        'tree:',
        '  children:',
        '    - ply: e3',
        '      children:',
        '        - ply: cxb1=Q',
        '          outcome: { type: unexplored }',
      ].join('\n'),
    )
    expect(codes(yaml)).toEqual(['reply-incomplete'])
    const said = messages(yaml)
    for (const promotion of ['cxb1=N', 'cxb1=B', 'cxb1=R', 'cxd1=Q+', 'cxd1=N']) {
      expect(said).toContain(promotion)
    }
  })

  it('cannot be satisfied vacuously by an empty children list', () => {
    // `{} == {}` is the classic vacuous-truth hole (ADR-0005, check 4). It is closed in the
    // schema: `children` and `dismissed` are non-empty when present, so the only way to
    // model no replies at all is to be a leaf and say so with an outcome.
    expect(codes(entry('white', DAMIANO, 'tree:\n  children: []'))).toEqual(['schema'])
    expect(
      codes(
        entry(
          'white',
          DAMIANO,
          'tree:\n  children:\n    - ply: Ke7\n      outcome: { type: unexplored }\n  dismissed: []',
        ),
      ),
    ).toEqual(['schema'])
  })

  it('refuses a reply that is both modelled and dismissed', () => {
    const yaml = entry(
      'white',
      DAMIANO,
      [
        'tree:',
        '  children:',
        '    - ply: Ke7',
        '      outcome: { type: unexplored }',
        '    - ply: g6',
        '      outcome: { type: unexplored }',
        '  dismissed:',
        "    - { ply: g6, reason: 'Blocks with the g-pawn.' }",
      ].join('\n'),
    )
    expect(codes(yaml)).toEqual(['dismissed-also-modelled'])
  })

  it('refuses a dismissal on a node where the learner is the one choosing', () => {
    const yaml = entry(
      'white',
      'e4, e5, Nf3, f6, Nxe5, fxe5',
      [
        'tree:',
        '  children:',
        '    - ply: Qh5+',
        '      outcome: { type: unexplored }',
        '  dismissed:',
        "    - { ply: d4, reason: 'A different plan.' }",
      ].join('\n'),
    )
    expect(codes(yaml)).toContain('kind-mismatch')
  })

  it('refuses a dismissal with no modelled reply beside it', () => {
    const yaml = entry(
      'white',
      DAMIANO,
      [
        'tree:',
        '  outcome: { type: unexplored }',
        '  dismissed:',
        "    - { ply: g6, reason: 'Blocks with the g-pawn.' }",
      ].join('\n'),
    )
    expect(codes(yaml)).toContain('dismissed-without-children')
  })
})

describe('transposition', () => {
  it('refuses a node that transposes into itself', () => {
    const yaml = entry(
      'white',
      'e4, e5, Nf3, f6, Nxe5, fxe5',
      'tree:\n  children:\n    - ply: Qh5+\n      transposesTo: [Qh5+]',
    )
    expect(codes(yaml)).toContain('transposition-cycle')
  })
})

describe('position keys', () => {
  it('drops the halfmove clock and the fullmove number and keeps nothing else', () => {
    expect(positionKey('8/8/8/8/8/8/8/K6k w - - 13 42')).toBe('8/8/8/8/8/8/8/K6k w - -')
  })

  it('records what chess.js 1.4.0 actually writes for en passant', () => {
    // docs/CONTEXT.md invariant 12 says an en-passant square is written on any double pawn
    // push. On 1.4.0 it is written only when the capture is available, so the fourth field
    // carries information rather than noise. Kept as a test so a version bump has to notice.
    const quiet = replay(['e4'])
    expect(quiet.ok && positionKey(quiet.position.fen).endsWith(' -')).toBe(true)
    expect(positionKey(startPosition().fen)).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
    )
  })
})

describe('outcomes', () => {
  it('accepts unexplored at a position that is already checkmate, and holds the tier down', () => {
    // A mate cannot yet be stated: the ForcedMate outcome is generated by the prover (#5),
    // so `unexplored` is the only honest thing an author can write at a mating leaf today.
    const yaml = entry(
      'black',
      'f3, e5, g4',
      'tree:\n  children:\n    - ply: Qh4#\n      outcome: { type: unexplored }',
    )
    const validated = validateText('unit.yaml', yaml)
    expect(validated.issues).toEqual([])
    expect(validated.entry?.tier).toBe('listed')
  })

  it('refuses an assessment at stalemate as well as at checkmate', () => {
    // 1.e3 a5 2.Qh5 Ra6 3.Qxa5 h5 4.Qxc7 Rah6 5.h4 f6 6.Qxd7+ Kf7 7.Qxb7 Qd3 8.Qxb8 Qh7
    // 9.Qxc8 Kg6 10.Qe6 — the shortest known stalemate.
    const yaml = entry(
      'white',
      'e3, a5, Qh5, Ra6, Qxa5, h5, Qxc7, Rah6, h4, f6, Qxd7+, Kf7, Qxb7, Qd3, Qxb8, Qh7, Qxc8, Kg6',
      [
        'tree:',
        '  children:',
        '    - ply: Qe6',
        '      outcome:',
        '        type: position',
        "        evaluation: { vi: 'Trắng hơn quân.' }",
        "        plan: { vi: 'Trắng đổi quân về tàn cuộc.' }",
        "        basis: { by: a, at: '2026-09-16' }",
      ].join('\n'),
    )
    expect(codes(yaml)).toEqual(['assessment-is-terminal'])
    expect(messages(yaml)).toContain('stalemate')
  })
})

describe('a document that is not an entry at all', () => {
  it('says so against the document root rather than throwing', () => {
    expect(codes('')).toEqual(['schema'])
    expect(messages('')).toContain('expected object, received null')
  })

  it('treats an unknown YAML tag as text, never as something to evaluate', () => {
    // docs/security.md B1: content files are data, and the loader must not be capable of
    // evaluating one. `!!js/function` resolves to a plain string and is then refused.
    const yaml = "id: !!js/function 'function(){}'\nname: n\n"
    expect(messages(yaml)).toContain('kebab-case slug')
  })
})
