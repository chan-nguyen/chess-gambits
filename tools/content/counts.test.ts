// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { spellNumber } from './numerals.ts'
import { validateText } from './validate.ts'
import type { ContentNode } from './types.ts'

/**
 * ADR-0011. A number in a lesson is derived, and the author's own figure is refuted.
 *
 * The bug this exists for (#77) was a paragraph that said twenty-five where the position
 * says twenty-three. It was internally consistent — `25 + 17 = 42` — so reading it carefully
 * did not expose it; only replaying the position did. So the tests here replay, and the last
 * group of them pins the *rendered* sentences, because a gate that quietly reworded a lesson
 * in three languages would have traded one silent wrong for another.
 */

const root = fileURLToPath(new URL('../../', import.meta.url))
const contentFile = (name: string): string => readFileSync(`${root}content/${name}`, 'utf8')

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

const issues = (yaml: string) => validateText('unit.yaml', yaml).issues

describe('spelling a count for a learner', () => {
  /**
   * The irregular cases only. A table of every number would test the table against itself;
   * these are the ones a naive implementation gets wrong, and the ones a reader of the
   * Vietnamese or French would notice immediately.
   */
  it.each([
    [15, 'vi', 'mười lăm'],
    [14, 'vi', 'mười bốn'],
    [21, 'vi', 'hai mươi mốt'],
    [24, 'vi', 'hai mươi tư'],
    [25, 'vi', 'hai mươi lăm'],
    [23, 'vi', 'hai mươi ba'],
    [30, 'vi', 'ba mươi'],
    [21, 'fr', 'vingt et un'],
    [71, 'fr', 'soixante et onze'],
    [76, 'fr', 'soixante-seize'],
    [80, 'fr', 'quatre-vingts'],
    [81, 'fr', 'quatre-vingt-un'],
    [99, 'fr', 'quatre-vingt-dix-neuf'],
    [42, 'fr', 'quarante-deux'],
    [0, 'en', 'zero'],
    [19, 'en', 'nineteen'],
    [40, 'en', 'forty'],
    [42, 'en', 'forty-two'],
  ] as const)('writes %i in %s as "%s"', (value, locale, expected) => {
    expect(spellNumber(value, locale)).toBe(expected)
  })

  it('refuses a figure it cannot write out, rather than falling back to digits', () => {
    expect(spellNumber(100, 'en')).toBeUndefined()
    expect(spellNumber(-1, 'en')).toBeUndefined()
    expect(spellNumber(1.5, 'en')).toBeUndefined()
  })
})

/**
 * The Halosar position after 8.Nb5, which is the one #77 is about: 42 legal replies, 23 of
 * them mated at once by Nxc7#, and the 19 that are not.
 */
const HALOSAR = 'd4, d5, e4, dxe4, Nc3, Nf6, f3, exf3, Qxf3, Qxd4, Be3, Qb4, O-O-O, Bg4, Nb5'

const halosarTree = (counts: readonly string[], prose: string): string =>
  [
    'tree:',
    '  counts:',
    ...counts.map((line) => `    ${line}`),
    '  annotation:',
    // Quoted: a YAML scalar that opens with `{` is a flow mapping, which is the one thing an
    // author writing `{Mated} of the ...` as their first words has to know.
    `    vi: ${JSON.stringify(prose)}`,
    '  outcome: { type: unexplored }',
  ].join('\n')

describe('the gate on a counted claim', () => {
  it('accepts the figure the position actually gives', () => {
    const yaml = entry(
      'white',
      HALOSAR,
      halosarTree(
        [
          'legal: { count: legalReplies, expect: 42 }',
          "mated: { count: matedBy, ply: 'Nxc7#', expect: 23 }",
          "stops: { count: notMatedBy, ply: 'Nxc7#', expect: 19 }",
        ],
        '{Mated} trong {legal}, và {stops} thoát.',
      ),
    )
    expect(issues(yaml)).toEqual([])
    expect(validateText('unit.yaml', yaml).entry?.tree.annotation?.vi).toBe(
      'Hai mươi ba trong bốn mươi hai, và mười chín thoát.',
    )
  })

  /**
   * The bug, exactly as it was written. Twenty-five is refuted, and the message says which
   * claim and what the position says instead.
   */
  it('refuses the figure #76 had to fix, and names the claim and the truth', () => {
    const yaml = entry(
      'white',
      HALOSAR,
      halosarTree(["mated: { count: matedBy, ply: 'Nxc7#', expect: 25 }"], '{Mated} nước.'),
    )
    const [issue] = issues(yaml)
    expect(issue?.code).toBe('count-mismatch')
    expect(issue?.dataPath).toBe('tree.counts.mated')
    expect(issue?.message).toContain('`mated` claims 25')
    expect(issue?.message).toContain('`Nxc7#`')
    expect(issue?.message).toContain('there are 23')
  })

  it('refuses a wrong total just as readily', () => {
    const yaml = entry(
      'white',
      HALOSAR,
      halosarTree(['legal: { count: legalReplies, expect: 41 }'], '{Legal} nước.'),
    )
    expect(issues(yaml).map((i) => i.code)).toEqual(['count-mismatch'])
    expect(issues(yaml)[0]?.message).toContain('there are 42')
  })

  it('refuses a placeholder naming a count the node does not declare', () => {
    const yaml = entry(
      'white',
      HALOSAR,
      halosarTree(['legal: { count: legalReplies, expect: 42 }'], '{Legal} nước, {mated} bí.'),
    )
    const codes = issues(yaml).map((i) => i.code)
    expect(codes).toContain('unknown-count')
    expect(issues(yaml).find((i) => i.code === 'unknown-count')?.message).toContain('`{mated}`')
  })

  /**
   * The failure the whole design turns on. A count that no sentence uses is a check sitting
   * beside a number that is still typed by hand, which is #77 with extra steps.
   */
  it('refuses a count no prose uses', () => {
    const yaml = entry(
      'white',
      HALOSAR,
      halosarTree(
        [
          'legal: { count: legalReplies, expect: 42 }',
          "mated: { count: matedBy, ply: 'Nxc7#', expect: 23 }",
        ],
        'Hai mươi ba trong {legal} nước.',
      ),
    )
    const issue = issues(yaml).find((i) => i.code === 'count-unused')
    expect(issue?.dataPath).toBe('tree.counts')
    expect(issue?.message).toContain('`mated`')
  })

  /**
   * The one-locale version of the same bug: the Vietnamese derives the figure and the English
   * spells it out by hand. Nothing in the first four rules notices, because `mated` is used —
   * just not everywhere.
   */
  it('refuses a figure one language derives and another types out', () => {
    const yaml = entry(
      'white',
      HALOSAR,
      [
        'tree:',
        '  counts:',
        "    mated: { count: matedBy, ply: 'Nxc7#', expect: 23 }",
        '  annotation:',
        '    vi: "{Mated} nước bị chiếu bí."',
        '    en: Twenty-three replies are mated.',
        '    fr: "{Mated} réponses sont matées."',
        '  outcome: { type: unexplored }',
      ].join('\n'),
    )
    const issue = issues(yaml).find((candidate) => candidate.code === 'count-locale-gap')
    expect(issue?.message).toContain('used here in vi, fr but not in en')
    expect(issue?.dataPath).toBe('tree.annotation.en')
  })

  /**
   * After 8...Na6 it is White's move, and White is the learner. What the learner can play is
   * the gambit's choice rather than a set of replies to be ready for, so counting it is a
   * category error — the same one `dismissRest` and `replyQuality` are already refused for.
   */
  it('refuses a count on a learner node, where there are no replies to count', () => {
    const yaml = entry(
      'white',
      HALOSAR,
      [
        'tree:',
        '  dismissRest:',
        '    reason: { vi: Đen chơi một nước khác và Trắng tiếp tục. }',
        '  children:',
        '    - ply: Na6',
        '      counts:',
        '        legal: { count: legalReplies, expect: 49 }',
        '      annotation:',
        '        vi: "{Legal} nước."',
        '      outcome: { type: unexplored }',
      ].join('\n'),
    )
    expect(issues(yaml).map((issue) => issue.code)).toEqual(['kind-mismatch'])
    expect(issues(yaml)[0]?.dataPath).toBe('tree.children[0].counts')
  })
})

const nodeAt = (file: string, path: readonly string[]): ContentNode => {
  const report = validateText(`content/${file}`, contentFile(file))
  let node = report.entry?.tree
  if (node === undefined) throw new Error(`${file} did not validate`)
  for (const ply of path) {
    const next: ContentNode | undefined = node.children.find((child) => child.ply === ply)
    if (next === undefined) throw new Error(`no node at ${path.join(' > ')} in ${file}`)
    node = next
  }
  return node
}

/**
 * Every counted claim in the corpus, rendered.
 *
 * These strings are what the four entries said before the counts existed, character for
 * character, in all three languages. That is the point of pinning them: the gate was allowed
 * to change how a number is *produced* and not what a lesson *reads like*, and a rendered
 * "23" or a mis-declined Vietnamese numeral would show up here rather than in front of a
 * learner.
 */
describe('the six counted claims in the corpus, as a learner reads them', () => {
  it('halosar-trap, after 8.Nb5', () => {
    const reason = nodeAt('halosar-trap.yaml', ['Bg4', 'Nb5']).dismissRest?.reason
    expect(reason?.vi).toContain(
      'Hai mươi ba trong bốn mươi hai nước hợp lệ ở đây bỏ mặc ô c7 và bị Nxc7 chiếu bí ngay lập tức. Mười chín nước còn lại có ngăn được nước chiếu bí.',
    )
    expect(reason?.en).toContain(
      'Twenty-three of the forty-two legal replies here leave c7 alone and are mated at once by Nxc7#. Nineteen replies do stop the mate.',
    )
    expect(reason?.fr).toContain(
      'Vingt-trois des quarante-deux réponses légales ici délaissent c7 et sont matées aussitôt par Nxc7#. Dix-neuf réponses parent le mat.',
    )
  })

  it('kieninger-trap, at the root', () => {
    const reason = nodeAt('kieninger-trap.yaml', []).dismissRest?.reason
    expect(reason?.vi).toContain('Không nước nào trong hai mươi sáu nước hợp lệ ở đây')
    expect(reason?.en).toContain('None of the twenty-six legal moves here is mated on the spot')
    expect(reason?.fr).toContain("Aucun des vingt-six coups légaux d'ici")
  })

  it('kieninger-trap, after 8...Ngxe5', () => {
    const reason = nodeAt('kieninger-trap.yaml', ['a3', 'Ngxe5']).dismissRest?.reason
    expect(reason?.vi).toContain('Mười chín trong hai mươi chín nước hợp lệ ở đây bị 8...Nd3')
    expect(reason?.en).toContain(
      'Nineteen of the twenty-nine legal moves here are mated by 8...Nd3#',
    )
    expect(reason?.fr).toContain('Dix-neuf des vingt-neuf coups légaux ici sont matés par 8...Nd3#')
  })

  it('kieninger-trap, after 9...Nxe5', () => {
    const reason = nodeAt('kieninger-trap.yaml', ['a3', 'Ngxe5', 'Nxe5', 'Nxe5']).dismissRest
      ?.reason
    expect(reason?.vi).toContain('Mười sáu trong hai mươi lăm nước hợp lệ ở đây vẫn bị 9...Nd3')
    expect(reason?.en).toContain(
      'Sixteen of the twenty-five legal moves here are still mated by 9...Nd3#',
    )
    expect(reason?.fr).toContain(
      'Seize des vingt-cinq coups légaux ici sont encore matés par 9...Nd3#',
    )
  })

  it('englund-gambit-trap, at the root', () => {
    const annotation = nodeAt('englund-gambit-trap.yaml', []).annotation
    expect(annotation?.vi).toContain('Trắng chỉ có sáu nước hợp lệ, tất cả đều là chắn')
    expect(annotation?.en).toContain('White has exactly six legal answers, all of them blocks')
    expect(annotation?.fr).toContain("les Blancs n'ont que six réponses légales")
  })

  it('legals-mate, after 7...Bxf3 8.Qxf3', () => {
    const outcome = nodeAt('legals-mate.yaml', ['Bxf3', 'Qxf3']).outcome
    if (outcome?.kind !== 'position') throw new Error('expected an assessed leaf')
    expect(outcome.evaluation.vi).toContain(
      'Đen chỉ có mười bốn nước hợp lệ ngăn được nó trong số hai mươi tám nước có thể',
    )
    expect(outcome.evaluation.en).toContain(
      "Only fourteen of Black's twenty-eight legal moves stop it",
    )
    expect(outcome.evaluation.fr).toContain(
      "Seuls quatorze des vingt-huit coups légaux noirs l'arrêtent",
    )
  })

  /**
   * The corpus-wide half of the rule. Every count that exists is checked by the gate above;
   * this says how many there are, so a claim that is quietly dropped — or a seventh that is
   * added without being counted here — is visible in a diff.
   */
  it('is all six of them', () => {
    const declared = [
      'halosar-trap.yaml',
      'kieninger-trap.yaml',
      'englund-gambit-trap.yaml',
      'legals-mate.yaml',
    ]
      .map((file) => (contentFile(file).match(/^\s+counts:$/gm) ?? []).length)
      .reduce((total, found) => total + found, 0)
    expect(declared).toBe(6)
  })
})
