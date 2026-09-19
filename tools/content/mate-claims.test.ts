// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compileEntry } from './compile.ts'
import { compiledJson } from './compile.ts'
import { validateText } from './validate.ts'
import type { CertificateSource } from './validate.ts'

/**
 * Where a claimed trap becomes a proved mate, or the file is refused (ADR-0005;
 * docs/CONTEXT.md invariants 4 and 5).
 *
 * The author writes `outcome: { type: trap }` and nothing else — no move count, no line, no
 * certificate name, because every one of those is something the build derives and something
 * a file able to state it could lie about. Everything below is about the gap between that
 * claim and a proof, and about refusing to close it with anything other than a proof.
 */

const read = (path: string): string => readFileSync(path, 'utf8')

const validateFile = (path: string) => validateText(path, read(path))

const TRAP = 'tools/mate/fixtures/valid/legal-trap.yaml'

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

/** No certificate exists anywhere, so a claim can only ever be refused. */
const noCertificates: CertificateSource = () => undefined

const codes = (yaml: string, certificates: CertificateSource = noCertificates): readonly string[] =>
  validateText('unit.yaml', yaml, certificates).issues.map((issue) => issue.code)

const messages = (yaml: string, certificates: CertificateSource = noCertificates): string =>
  validateText('unit.yaml', yaml, certificates)
    .issues.map((issue) => issue.message)
    .join('\n')

describe('a claimed trap that is proved', () => {
  it('becomes a mate outcome carrying the move count the certificate proves', () => {
    const report = validateFile(TRAP)

    expect(report.issues).toEqual([])
    const leaf = report.entry?.tree.children[0]
    expect(leaf?.ply).toBe('Bxd1')
    expect(leaf?.outcome).toEqual({
      kind: 'mate',
      inMoves: 2,
      sequence: ['Bxf7+', 'Ke7', 'Nd5#'],
      sequenceFens: [
        'r2qkbnr/ppp2Bpp/2np4/4N3/4P3/2N4P/PPPP1PP1/R1BbK2R b KQkq - 0 7',
        'r2q1bnr/ppp1kBpp/2np4/4N3/4P3/2N4P/PPPP1PP1/R1BbK2R w KQ - 1 8',
        'r2q1bnr/ppp1kBpp/2np4/3NN3/4P3/7P/PPPP1PP1/R1BbK2R b KQ - 2 8',
      ],
      provedBy: 'modelled-net',
      basis: {
        basis: 'proved',
        by: 'certificate',
        certificate: 'fixture-legal-trap.Bxd1.mate.json',
      },
    })
  })

  it('records where the proof is, so anyone can fetch it and replay it', () => {
    const report = validateFile(TRAP)
    const outcome = report.entry?.tree.children[0]?.outcome

    expect(outcome?.kind).toBe('mate')
    if (outcome?.kind !== 'mate') return
    expect(outcome.basis.basis).toBe('proved')
    expect(outcome.basis.certificate).toContain('.mate.json')
  })

  it('says a mate delivered at once rests on search, and a branching one on the net', () => {
    const immediate = validateFile('tools/mate/fixtures/valid/halosar-trap.yaml')
    const branching = validateFile(TRAP)

    expect(immediate.entry?.tree.children[0]?.outcome).toMatchObject({ provedBy: 'search' })
    expect(branching.entry?.tree.children[0]?.outcome).toMatchObject({ provedBy: 'modelled-net' })
  })

  it('reports the claim whether or not it was proved, which is what the prover reads', () => {
    const report = validateFile(TRAP)

    expect(report.mateClaims).toEqual([
      {
        entryId: 'fixture-legal-trap',
        nodePath: ['Bxd1'],
        line: [...(report.entry?.definingLine ?? []), 'Bxd1'],
        certificate: 'fixture-legal-trap.Bxd1.mate.json',
        attacker: 'white',
        proved: true,
      },
    ])
  })

  /**
   * A field that stops at the compiler is a feature nobody gets, so the proof is followed all
   * the way out: this pins the compiled payload byte for byte, and `src/lib/content.test.ts`
   * feeds the same committed file to the browser's runtime guard. Neither directory imports
   * the other's runtime code; the file is what holds the two halves to one shape.
   */
  it('compiles to exactly the payload the browser tests load', () => {
    const report = validateFile(TRAP)
    if (report.entry === undefined) throw new Error('fixture did not validate')
    const json = compiledJson(compileEntry(report.entry))
    const committed = readFileSync('tools/content/fixtures/compiled/proved-mate.json', 'utf8')

    expect(committed.trim()).toBe(json)
    expect(json).toContain('"certificate":"fixture-legal-trap.Bxd1.mate.json"')
    expect(json).toContain('"basis":"proved"')
  })
})

describe('a claimed trap that is not proved', () => {
  const claimed = entry(
    'white',
    'e4, e5, Nf3, Nc6, Bc4, d6, Nc3, Bg4, h3, Bh5, Nxe5',
    [
      'tree:',
      '  dismissRest:',
      "    reason: { vi: 'Các nước khác không thuộc phạm vi bài kiểm tra này.' }",
      '  children:',
      '    - ply: Bxd1',
      '      replyQuality: blunder',
      '      outcome: { type: trap }',
    ].join('\n'),
  )

  it('is refused, and the message says where the proof should be', () => {
    expect(codes(claimed)).toEqual(['mate-unproved'])
    expect(messages(claimed)).toContain('unit-under-test.Bxd1.mate.json')
    expect(messages(claimed)).toContain('npm run prove:mates')
  })

  it('is never quietly downgraded to an assessment or to unexplored', () => {
    const report = validateText('unit.yaml', claimed, noCertificates)

    expect(report.entry).toBeUndefined()
    expect(report.mateClaims[0]?.proved).toBe(false)
  })

  /**
   * The hazard this closes is not hypothetical: an entry's defining line changes, the
   * certificate is not regenerated, and the file name still matches because a name is derived
   * from the entry and the node rather than from the game.
   */
  it('is refused when the certificate proves a mate in a different game', () => {
    const legal: CertificateSource = () =>
      JSON.parse(read('tools/mate/fixtures/valid/fixture-legal-trap.Bxd1.mate.json'))
    const reordered = [
      'id: fixture-legal-trap',
      'name: Unit under test',
      'eco: C40',
      'category: trap',
      'side: white',
      'definingLine: [e4, e5, Nf3, Nc6, Bc4, d6, Nc3, Bg4, h3, Bh5, a3, a6, Nxe5]',
      'soundness:',
      '  value: unsound',
      "  reviewedAt: '2026-09-16'",
      "  basis: { by: a, at: '2026-09-16' }",
      "judgement: { by: a, at: '2026-09-16' }",
      'tree:',
      '  dismissRest:',
      "    reason: { vi: 'Các nước khác không thuộc phạm vi bài kiểm tra này.' }",
      '  children:',
      '    - ply: Bxd1',
      '      replyQuality: blunder',
      '      outcome: { type: trap }',
    ].join('\n')

    expect(codes(reordered, legal)).toEqual(['mate-unproved'])
    expect(messages(reordered, legal)).toContain('different game')
  })

  it('is refused when the certificate itself does not verify', () => {
    const broken: CertificateSource = () =>
      JSON.parse(read('tools/mate/fixtures/invalid/fixture-not-minimal.Kf3.mate.json'))

    expect(codes(claimed, broken)).toEqual(['mate-unproved'])
    expect(messages(claimed, broken)).toContain('does not prove a mate here')
  })
})

describe('invariant 5: how a mate may be reached', () => {
  it('refuses a mate reachable without the opponent having erred', () => {
    // The same trap with the `blunder` taken off the reply. If the opponent reaches a mate by
    // playing well, the claim is that the gambit refutes correct play.
    const yaml = entry(
      'white',
      'e4, e5, Nf3, Nc6, Bc4, d6, Nc3, Bg4, h3, Bh5, Nxe5',
      [
        'tree:',
        '  dismissRest:',
        "    reason: { vi: 'Các nước khác không thuộc phạm vi bài kiểm tra này.' }",
        '  children:',
        '    - ply: Bxd1',
        '      replyQuality: best',
        '      outcome: { type: trap }',
      ].join('\n'),
    )

    expect(codes(yaml)).toEqual(['mate-not-through-blunder'])
    expect(messages(yaml)).toContain('invariant 5')
  })

  it('accepts a mistake as well as a blunder, and counts one anywhere on the path', () => {
    const viaAncestor = entry(
      'white',
      'e4, e5, Nf3, f6, Nxe5, fxe5, Qh5+',
      [
        'tree:',
        '  dismissed:',
        "    - { ply: g6, reason: 'Blocks with the g-pawn.' }",
        '  children:',
        '    - ply: Ke7',
        '      replyQuality: mistake',
        '      children:',
        '        - ply: Qxe5+',
        '          children:',
        '            - ply: Kf7',
        '              outcome: { type: trap }',
      ].join('\n'),
    )

    // The mistake is four plies above the claim, and it still counts: the invariant is about
    // the path, not the leaf. So the refusal here is the missing proof, never the quality.
    expect(codes(viaAncestor)).toEqual(['mate-unproved'])
  })

  it('refuses a trap claimed where the opponent would be the one mating', () => {
    const yaml = entry(
      'white',
      'e4, e5, Nf3, Nc6, Bc4, d6, Nc3, Bg4, h3, Bh5, Nxe5',
      ['tree:', '  outcome: { type: trap }'].join('\n'),
    )

    expect(codes(yaml)).toContain('kind-mismatch')
    expect(messages(yaml)).toContain('learner mates from here')
  })
})

describe('invariant 5: where a defining line may end', () => {
  it('refuses a line that leaves the learner to move at the root', () => {
    // The Damiano, written the way the invariant forbids: the losing move 2...f6 sits inside
    // the defining line, where no node can carry a quality.
    const yaml = entry('white', 'e4, e5, Nf3, f6', 'tree:\n  outcome: { type: unexplored }')

    expect(codes(yaml)).toEqual(['defining-line-parity'])
    const said = messages(yaml)
    expect(said).toContain('white')
    expect(said).toContain('`f6`')
    expect(said).toContain('invariant 5')
  })

  it('accepts the same line one ply shorter, which is how the Damiano is modelled', () => {
    const yaml = entry(
      'white',
      'e4, e5, Nf3',
      [
        'tree:',
        '  dismissRest:',
        "    reason: { vi: 'Các nước khác không thuộc phạm vi bài kiểm tra này.' }",
        '  children:',
        '    - ply: f6',
        '      replyQuality: blunder',
        '      outcome: { type: unexplored }',
        '    - ply: Nc6',
        '      outcome: { type: unexplored }',
      ].join('\n'),
    )

    expect(codes(yaml)).toEqual([])
  })

  it('holds for a black learner too, with the parity the other way round', () => {
    expect(codes(entry('black', 'e4, e5', 'tree:\n  outcome: { type: unexplored }'))).toEqual([])
    expect(codes(entry('black', 'e4', 'tree:\n  outcome: { type: unexplored }'))).toEqual([
      'defining-line-parity',
    ])
  })

  it('names the ply that has to move out of the defining line', () => {
    const report = validateText(
      'unit.yaml',
      entry('black', 'e4', 'tree:\n  outcome: { type: unexplored }'),
      noCertificates,
    )

    expect(report.issues[0]?.dataPath).toBe('definingLine[0]')
  })
})

describe('what an author still may not write', () => {
  it('refuses `type: mate`, before the schema even sees it', () => {
    const yaml = entry(
      'white',
      'e4, e5, Nf3',
      'tree:\n  outcome:\n    type: mate\n    inMoves: 2\n    sequence: [Bxf7+]',
    )

    expect(codes(yaml)).toEqual(['derived-field'])
    expect(messages(yaml)).toContain('never authored')
  })

  it('refuses a move count or a certificate name beside the claim', () => {
    expect(
      codes(entry('white', 'e4, e5, Nf3', 'tree:\n  outcome: { type: trap, inMoves: 2 }')),
    ).toEqual(['schema'])
    expect(
      codes(
        entry('white', 'e4, e5, Nf3', "tree:\n  outcome: { type: trap, certificate: 'x.json' }"),
      ),
    ).toEqual(['schema'])
  })
})
