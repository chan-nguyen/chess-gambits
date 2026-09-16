import { describe, expect, it } from 'vitest'
import assessmentSource from './AssessmentOutcome.tsx?raw'
import mateSource from './MateOutcome.tsx?raw'
import cardSource from './OutcomeCard.tsx?raw'
import type { MateOutcomeProps } from './MateOutcome.tsx'
import type { CompiledOutcome, CompiledProvenance } from '../../lib/content-types.ts'
import { locales, type Locale } from '../../lib/locale.ts'
import en from '../../locales/en.ts'
import fr from '../../locales/fr.ts'
import vi from '../../locales/vi.ts'

/**
 * The spine of the product, held from the source side.
 *
 * `OutcomeCard.test.tsx` checks what a learner sees. This file checks the things that stop
 * being true one refactor before a learner could notice: that a proved mate and an author's
 * judgement are **two components rather than one with a flag**, that the code has no path
 * from a mate to the sentence "one author's judgement", that the proof's net never becomes
 * something the wire could carry, and that no catalogue starts calling a merely winning
 * position a mate.
 *
 * A distinction only a rendering test defends is a distinction that survives until someone
 * decides two near-identical components should be unified — which is a reasonable-sounding
 * refactor, and the one this project cannot have.
 */

/** Documentation must never trip a gate, so prose about `<section>` is removed first. */
const withoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

/** The three sources as code, with every comment removed. */
const CARD = withoutComments(cardSource)
const MATE = withoutComments(mateSource)
const ASSESSMENT = withoutComments(assessmentSource)

/** What a module imports from `OutcomeProvenance`, as the names it actually asked for. */
const provenanceImports = (source: string): readonly string[] => {
  const found = /import\s*\{([^}]*)\}\s*from\s*'\.\/OutcomeProvenance\.tsx'/.exec(source)
  return (found?.[1] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

describe('OutcomeCard is a switch and not a shell (AC 1)', () => {
  /**
   * The moment this grows an element of its own, a proved mate and an author's opinion are
   * one card with a variant, and "two distinct components, not one with a flag" has become
   * a comment. So: no intrinsic element anywhere in it.
   */
  it('renders no element of its own', () => {
    expect(CARD).not.toMatch(/<[a-z]/)
  })

  it('has no stylesheet, because it draws nothing to style', () => {
    expect(CARD).not.toMatch(/import\s+'\.\/[A-Za-z]+\.css'/)
  })

  it('switches to all three arms, so no outcome shape renders as nothing', () => {
    for (const arm of ['MateOutcome', 'AssessmentOutcome', 'UnexploredOutcome']) {
      expect(CARD).toContain(`<${arm}`)
    }
  })
})

describe('a mate and an assessment share no shell (AC 1)', () => {
  it('neither component names the other anywhere in its code', () => {
    expect(MATE).not.toContain('AssessmentOutcome')
    expect(ASSESSMENT).not.toContain('MateOutcome')
  })

  it('each brings its own stylesheet and neither brings the other’s', () => {
    expect(MATE).toContain("import './MateOutcome.css'")
    expect(MATE).not.toContain('AssessmentOutcome.css')
    expect(ASSESSMENT).toContain("import './AssessmentOutcome.css'")
    expect(ASSESSMENT).not.toContain('MateOutcome.css')
  })

  /**
   * The mate never shows the net's board list to an assessment and the assessment never
   * shows prose blocks to a mate, because neither can reach the other's parts.
   */
  it('the assessment cannot reach the mate net', () => {
    expect(ASSESSMENT).not.toContain('MateNet')
  })
})

/**
 * **There is no code path from a proved mate to the words "one author's judgement".**
 *
 * `MateOutcome` takes `CompiledProved`, not the `CompiledProvenance` union, so a mate that
 * arrived over the wire carrying a judgement is not merely refused at runtime — it is
 * unconstructable. The import list is the second half of the same claim: the component does
 * not have the judgement note to render even if someone gave it one.
 */
describe('a hand-judged mate is not expressible', () => {
  it('MateOutcome imports the proof note and not the judgement note', () => {
    expect(provenanceImports(MATE)).toStrictEqual(['ProvedNote'])
  })

  type Judgement = Extract<CompiledProvenance, { basis: 'judgement' }>
  type Assignable<From, To> = [From] extends [To] ? true : false

  /**
   * A compile-time gate wearing a runtime assertion's clothes. Widen `basis` to the full
   * provenance union and this stops type-checking, because the conditional resolves to
   * `true` and `true` is not assignable to `false`.
   */
  it('refuses a judgement where a mate’s basis is asked for', () => {
    const judgementIsNotAMateBasis: Assignable<Judgement, MateOutcomeProps['basis']> = false

    expect(judgementIsNotAMateBasis).toBe(false)
  })

  it('accepts a certificate there, so the gate above is not vacuous', () => {
    type Proved = Extract<CompiledProvenance, { basis: 'proved' }>
    const certificateIsAMateBasis: Assignable<Proved, MateOutcomeProps['basis']> = true

    expect(certificateIsAMateBasis).toBe(true)
  })
})

/**
 * **A proved net never reaches the browser (ADR-0005).**
 *
 * A certificate holds every defender reply at every depth; a mate in four runs to tens of
 * thousands of nodes and it is a build input, verified by replay in CI and never shipped.
 * What a compiled leaf carries is one line of SAN — the longest the defender can hold out —
 * and this is the tripwire that fails if a field ever appears that could carry more.
 */
describe('the wire carries a line, not a net', () => {
  type MateArm = Extract<CompiledOutcome, { kind: 'mate' }>
  type Unexpected = Exclude<keyof MateArm, 'kind' | 'inMoves' | 'sequence' | 'provedBy' | 'basis'>

  it('a mate leaf carries these five fields and no sixth', () => {
    const nothingElseOnTheWire: [Unexpected] extends [never] ? true : false = true

    expect(nothingElseOnTheWire).toBe(true)
  })

  it('and its line is plain SAN, which cannot branch', () => {
    type Line = MateArm['sequence']
    const lineIsFlat: readonly string[] extends Line ? true : false = true

    expect(lineIsFlat).toBe(true)
  })
})

/**
 * **AC 7, at the catalogue rather than at the card.**
 *
 * `OutcomeCard.test.tsx` reads the rendered page; this reads the three dictionaries, so a
 * translator who writes "no mate, but a good position" into the assessment heading is
 * caught whether or not a test happens to render that string.
 *
 * Scope, stated rather than left implicit: the mate keys below are the ones only
 * `MateOutcome` renders. `howProved` is among them, and it is also reachable from the
 * `proved` arm of `AssessmentProvenance` — a shape `CompiledOutcome` admits and
 * `tools/content/validate.ts` never emits, since it writes `basis: 'judgement'` on every
 * `position` outcome it compiles. If that ever changes, this scope is wrong and the copy
 * needs a sentence of its own.
 */
describe('no catalogue calls a merely winning position a mate', () => {
  const MATE_KEYS: ReadonlySet<string> = new Set([
    'mateHeading',
    'mateForced',
    'netModelled',
    'netImmediate',
    'howProved',
  ])

  /**
   * Unicode-aware boundaries rather than `\b`: JavaScript treats an accented letter as a
   * non-word character, so `\bmat\b` matches inside *matériel* and *affirmation* would be
   * safe only by luck.
   */
  const MATE_WORDS: Readonly<Record<Locale, RegExp>> = {
    vi: /chiếu hết/iu,
    en: /(?<!\p{L})(mate|mated|mates|checkmate|checkmated)(?!\p{L})/iu,
    fr: /(?<!\p{L})(mat|mats|mate|maté)(?!\p{L})/iu,
  }

  const OUTCOME_COPY: Readonly<Record<Locale, typeof vi.outcome>> = {
    vi: vi.outcome,
    en: { ...vi.outcome, ...en.outcome },
    fr: { ...vi.outcome, ...fr.outcome },
  }

  it.each(locales)('%s says it only where a mate is what is being described', (locale) => {
    const offenders = Object.entries(OUTCOME_COPY[locale])
      .filter(([key]) => !MATE_KEYS.has(key))
      .filter(([, text]) => MATE_WORDS[locale].test(text))
      .map(([key]) => `outcome.${key}`)

    expect(offenders).toStrictEqual([])
  })

  it.each(locales)('and %s does say it where one is', (locale) => {
    const copy = OUTCOME_COPY[locale]

    expect(copy.mateHeading).toMatch(MATE_WORDS[locale])
    expect(copy.howProved).toMatch(MATE_WORDS[locale])
  })

  /** The probe: the scan is looking at the keys it claims to, and would report one. */
  it('reports a key that starts saying it', () => {
    const catalogue = { ...vi.outcome, ...en.outcome, assessmentHeading: 'No mate, but winning' }
    const offenders = Object.entries(catalogue)
      .filter(([key]) => !MATE_KEYS.has(key))
      .filter(([, text]) => MATE_WORDS.en.test(text))
      .map(([key]) => `outcome.${key}`)

    expect(offenders).toStrictEqual(['outcome.assessmentHeading'])
  })
})
