import { describe, expect, it } from 'vitest'
import assessmentSource from './AssessmentOutcome.tsx?raw'
import mateSource from './MateOutcome.tsx?raw'
import cardSource from './OutcomeCard.tsx?raw'
import provenanceSource from './OutcomeProvenance.tsx?raw'
import type { AssessmentOutcomeProps } from './AssessmentOutcome.tsx'
import type { MateOutcomeProps } from './MateOutcome.tsx'
import type {
  CompiledAnnotation,
  CompiledJudgement,
  CompiledOutcome,
  CompiledProved,
  CompiledProvenance,
} from '../../lib/content-types.ts'
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
const PROVENANCE = withoutComments(provenanceSource)

/** What a module imports from `OutcomeProvenance`, as the names it actually asked for. */
/**
 * `true` only when every `From` is a `To`. Written as a type so that a widening in
 * `content-types.ts` flips it and stops the file type-checking — a compile-time gate wearing
 * a runtime assertion's clothes.
 */
type Assignable<From, To> = [From] extends [To] ? true : false

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

  /**
   * Widen `basis` to the full provenance union and this stops type-checking, because the
   * conditional resolves to `true` and `true` is not assignable to `false`.
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
 * **And the mirror of it: a merely winning position is not machine-proved (#45).**
 *
 * `CompiledProved` is a *mate certificate* — a file a reader can fetch and replay (ADR-0005).
 * A position that is only winning has no such file, so a `position` outcome carrying a proved
 * basis is not a state this project has copy for: `ProvedNote` would say "the count and the
 * line above" under a card that has neither, and link "How a mate is proved" for something
 * that is not a mate. Until #45 the type admitted it, which is why there was a `proved` arm
 * to render at all.
 *
 * These gates are the reason there is no longer one. Widen `basis` back to the full union and
 * the three constants below flip, and the file stops type-checking.
 */
describe('a proved assessment is not expressible', () => {
  type ProvedPosition = {
    readonly kind: 'position'
    readonly evaluation: CompiledAnnotation
    readonly plan: CompiledAnnotation
    readonly basis: CompiledProved
  }

  it('refuses a position outcome whose basis is a certificate', () => {
    const provedPositionIsNotAnOutcome: Assignable<ProvedPosition, CompiledOutcome> = false

    expect(provedPositionIsNotAnOutcome).toBe(false)
  })

  it('accepts the same shape carrying a judgement, so the gate above is not vacuous', () => {
    type JudgedPosition = Omit<ProvedPosition, 'basis'> & { readonly basis: CompiledJudgement }
    const judgedPositionIsAnOutcome: Assignable<JudgedPosition, CompiledOutcome> = true

    expect(judgedPositionIsAnOutcome).toBe(true)
  })

  /**
   * And the component asks for the narrowed thing rather than re-widening it at the prop,
   * which is where the rendering of the impossible state actually lived.
   */
  it('and AssessmentOutcome will not take a certificate either', () => {
    const certificateIsNotAnAssessmentBasis: Assignable<
      CompiledProved,
      AssessmentOutcomeProps['basis']
    > = false

    expect(certificateIsNotAnAssessmentBasis).toBe(false)
  })

  it('but does take the judgement the wire carries', () => {
    type PositionArm = Extract<CompiledOutcome, { kind: 'position' }>
    const theWireFitsTheProp: Assignable<PositionArm['basis'], AssessmentOutcomeProps['basis']> =
      true

    expect(theWireFitsTheProp).toBe(true)
  })
})

/**
 * **`ProvedNote` has exactly one caller (#45, AC 3).**
 *
 * The import list in `MateOutcome` says what that component can render. This says the other
 * direction — that nothing else in the shipped source can render it — which is the claim
 * that would quietly stop being true if a second outcome grew a proved arm again.
 */
describe('the proof note is reachable from one component only', () => {
  const SOURCES: Readonly<Record<string, string>> = import.meta.glob('/src/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  /** The note's own module defines it; every other mention is a caller. */
  const CALLERS = Object.entries(SOURCES)
    .filter(([path]) => !path.includes('.test.') && !path.endsWith('/OutcomeProvenance.tsx'))
    .filter(([, text]) => /\bProvedNote\b/.test(withoutComments(text)))
    .map(([path]) => path.replace(/^\//, ''))

  it('finds the source it claims to scan', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(10)
    expect(Object.keys(SOURCES)).toContain('/src/components/learn/OutcomeProvenance.tsx')
  })

  it('and that component is MateOutcome', () => {
    expect(CALLERS).toStrictEqual(['src/components/learn/MateOutcome.tsx'])
  })
})

/**
 * **And the module that owns both notes can no longer choose between them (#45).**
 *
 * The scan above deliberately skips `OutcomeProvenance.tsx`, because that file *defines*
 * `ProvedNote` and would match itself. That exemption is also a blind spot, and it is
 * pointed at exactly the code #45 deleted: `AssessmentProvenance` lived in this module and
 * branched on `basis` to pick a note, so a future tidy-up that reintroduces a chooser here
 * — the single most likely way this regresses — restores the rendering of the impossible
 * state with every gate on this page still green.
 *
 * So the rule for this one file is stronger than "has no second caller": it may not know
 * what a basis is. Which note a leaf gets is now settled by the type at the call site,
 * where `CompiledProved` and `CompiledJudgement` make the wrong one unrepresentable, and a
 * component that re-decided it at render time could only ever disagree with that.
 */
describe('the notes are told which one to be', () => {
  it('so their module never mentions a basis', () => {
    expect(PROVENANCE).not.toContain('basis')
  })

  it('and it is still the module that defines them both, so this is not an empty file passing', () => {
    expect(PROVENANCE).toContain('export const ProvedNote')
    expect(PROVENANCE).toContain('export const JudgementNote')
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
  type Unexpected = Exclude<
    keyof MateArm,
    'kind' | 'inMoves' | 'sequence' | 'sequenceFens' | 'provedBy' | 'basis'
  >

  it('a mate leaf carries these six fields and no seventh', () => {
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
 * `MateOutcome` renders, and since #45 that is the whole story — `howProved` was also
 * reachable from the `proved` arm of `AssessmentProvenance`, and there is no such arm, no
 * such component, and no such shape for `CompiledOutcome` to admit any more. The describes
 * above hold each half of that.
 */
describe('no catalogue calls a merely winning position a mate', () => {
  const MATE_KEYS: ReadonlySet<string> = new Set([
    'mateHeading',
    'mateForced',
    'netModelled',
    'netImmediate',
    'howProved',
    'mateReached',
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
