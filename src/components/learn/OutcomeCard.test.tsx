import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import assessmentCss from './AssessmentOutcome.css?raw'
import mateCss from './MateOutcome.css?raw'
import provenanceCss from './OutcomeProvenance.css?raw'
import unexploredCss from './UnexploredOutcome.css?raw'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'
import type { LocaleLoader } from '../../i18n/i18n.ts'
import type { PartialTranslations } from '../../i18n/translations.ts'
import type { CompiledAnnotation, CompiledOutcome } from '../../lib/content-types.ts'
import { isLocale, locales, type Locale } from '../../lib/locale.ts'
import en from '../../locales/en.ts'
import fr from '../../locales/fr.ts'
import vi from '../../locales/vi.ts'
import { OutcomeCard } from './OutcomeCard.tsx'
import { localiseAnnotation } from './annotation.ts'
import {
  OUTCOMES_ENTRY,
  OUTCOME_ASSESSMENT_LINE,
  OUTCOME_MATE_LINE,
  OUTCOME_UNEXPLORED_LINE,
} from './learn-fixtures.ts'
import { resolvePath } from './tree-path.ts'

/**
 * What a line ends in, rendered — the three outcome shapes, and the distinction the whole
 * product is built to make.
 *
 * Mounted through the real i18n provider and a real router, because two of the claims are
 * about those: every string comes out of a catalogue rather than out of this file, and the
 * proof's "how this was checked" is a real link with a real `href`.
 *
 * The outcomes are **read out of `OUTCOMES_ENTRY`** rather than written here. That fixture's
 * positions were replayed through chess.js and its mate is a real one; an outcome typed into
 * this file would be a chess claim nothing had checked, on a page whose only argument is
 * that it does not make those.
 */

const CATALOGUES: Readonly<Record<Locale, PartialTranslations>> = { vi, en, fr }
const load: LocaleLoader = (requested) =>
  Promise.resolve(isLocale(requested) ? CATALOGUES[requested] : vi)

/** Each locale's outcome copy over the source locale: the other two are subsets of `vi`. */
const COPY: Readonly<Record<Locale, typeof vi.outcome>> = {
  vi: vi.outcome,
  en: { ...vi.outcome, ...en.outcome },
  fr: { ...vi.outcome, ...fr.outcome },
}
const EN = COPY.en

type Leaf = { readonly outcome: CompiledOutcome; readonly fen: string }

/** A leaf of the fixture, resolved through the shipped walker rather than restated here. */
const leaf = (line: readonly string[]): Leaf => {
  const { node, strayedAt } = resolvePath(OUTCOMES_ENTRY.tree, line)
  if (strayedAt !== null) throw new Error(`the fixture has no ${strayedAt}`)
  if (node.outcome === undefined) throw new Error(`${line.join('_')} is not a leaf`)
  return { outcome: node.outcome, fen: node.fen }
}

const MATE = leaf(OUTCOME_MATE_LINE)
const ASSESSMENT = leaf(OUTCOME_ASSESSMENT_LINE)
const UNEXPLORED = leaf(OUTCOME_UNEXPLORED_LINE)

/**
 * The two arms a test needs to read fields off, narrowed by a check rather than by an
 * assertion. `as` is banned here as everywhere, and a fixture that stopped ending in a mate
 * should fail loudly rather than be coerced into one.
 */
const provedMate = (): Extract<CompiledOutcome, { kind: 'mate' }> => {
  if (MATE.outcome.kind !== 'mate') throw new Error('the trap branch does not end in a mate')
  return MATE.outcome
}
const assessed = (): Extract<CompiledOutcome, { kind: 'position' }> => {
  if (ASSESSMENT.outcome.kind !== 'position') throw new Error('the gambit branch is not assessed')
  return ASSESSMENT.outcome
}

const prose = (annotation: CompiledAnnotation, locale: Locale): string =>
  localiseAnnotation(annotation, locale).text

/** The heading each arm draws, which is what a test waits for while the catalogue loads. */
const headingOf = (outcome: CompiledOutcome, locale: Locale): string => {
  const copy = COPY[locale]
  if (outcome.kind === 'mate') return copy.mateHeading.replace('{{moves}}', String(outcome.inMoves))
  return outcome.kind === 'position' ? copy.assessmentHeading : copy.unexploredHeading
}

type Options = {
  readonly outcome?: CompiledOutcome
  readonly fen?: string
  readonly locale?: Locale
}

const show = async ({ outcome = MATE.outcome, fen = MATE.fen, locale = 'en' }: Options = {}) => {
  const router = createMemoryRouter(
    [
      {
        path: '/:locale/gambits/:id',
        element: (
          <I18nProvider locale={locale} load={load}>
            <OutcomeCard
              outcome={outcome}
              fen={fen}
              orientation={OUTCOMES_ENTRY.side}
              locale={locale}
            />
          </I18nProvider>
        ),
      },
    ],
    { initialEntries: [`/${locale}/gambits/${OUTCOMES_ENTRY.id}`] },
  )
  const view = render(<RouterProvider router={router} />)
  await screen.findByText(headingOf(outcome, locale))
  return view
}

/** The card itself: whichever of the three components drew it. */
const card = (container: HTMLElement): Element => {
  const section = container.querySelector('section')
  if (section === null) throw new Error('nothing rendered a card')
  return section
}

afterEach(cleanup)

/** AC 2. The count, the forced line, and how the claim was proved — in that order. */
describe('a proved forced mate', () => {
  it('states the count in moves, and the line runs to the plies that implies', async () => {
    const mate = provedMate()
    await show()

    // docs/CONTEXT.md, *Ply*: a mate in N runs to 2N - 1 plies, so the two never coincide.
    expect(mate.sequence).toHaveLength(2 * mate.inMoves - 1)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      EN.mateHeading.replace('{{moves}}', String(mate.inMoves)),
    )
  })

  it('says the mate holds however the opponent defends', async () => {
    await show()

    expect(screen.getByText(EN.mateForced)).toBeVisible()
  })

  it('shows the forced line, numbered the way a scoresheet is', async () => {
    const { container } = await show()

    expect([...container.querySelectorAll('.mate-net__ply')].map((li) => li.textContent)).toEqual([
      '7.Bxf7+',
      '7...Ke7',
      '8.Nd5#',
    ])
  })

  it('says the line is the longest defence, not that it is the whole net', async () => {
    await show()

    expect(screen.getByText(EN.netModelled)).toBeVisible()
    expect(screen.queryByText(EN.netImmediate)).toBeNull()
  })

  /**
   * `provedBy: 'search'` means the certificate had no defender node at all — the attacker
   * mates at once — so calling that line "the longest defence" would describe a choice the
   * defender never had (ADR-0005).
   */
  it('says something else where there was no defence to model', async () => {
    const mate = provedMate()
    await show({
      outcome: { ...mate, provedBy: 'search', inMoves: 1, sequence: mate.sequence.slice(-1) },
    })

    expect(screen.getByText(EN.netImmediate)).toBeVisible()
    expect(screen.queryByText(EN.netModelled)).toBeNull()
  })

  it('names the certificate a reader can fetch and replay', async () => {
    await show()

    expect(screen.getByText(provedMate().basis.certificate)).toBeVisible()
  })

  it('links to the About page’s explanation of how the claim was proved', async () => {
    await show()

    expect(screen.getByRole('link', { name: EN.howProved })).toHaveAttribute('href', '/en/about')
  })
})

/**
 * AC 3. One shared board and a SAN list — never one preview per reply.
 *
 * A defender node inside a net can have twenty-four legal replies, and twenty-four board
 * instances on a 360px phone is not a design.
 */
describe('the mate net', () => {
  const boards = (container: HTMLElement): number =>
    container.querySelectorAll('.board-preview').length

  it('draws one board, and a real one', async () => {
    const { container } = await show()

    expect(boards(container)).toBe(1)
    expect(container.querySelectorAll('.board-preview [role="gridcell"]')).toHaveLength(64)
  })

  it('draws one board for three plies, so it is not one board per ply', async () => {
    const { container } = await show()

    expect(container.querySelectorAll('.mate-net__ply')).toHaveLength(provedMate().sequence.length)
    expect(boards(container)).toBe(1)
  })

  /**
   * The same count at a different length. A renderer that drew a board per ply would still
   * satisfy the assertion above on a fixture whose line happened to be one ply long.
   */
  it('still draws one board when the line is a single ply', async () => {
    const mate = provedMate()
    const { container } = await show({
      outcome: { ...mate, provedBy: 'search', inMoves: 1, sequence: mate.sequence.slice(-1) },
    })

    expect(container.querySelectorAll('.mate-net__ply')).toHaveLength(1)
    expect(boards(container)).toBe(1)
  })

  it('reads in order, because the plies are a refutation only in this order', async () => {
    const { container } = await show()

    expect(container.querySelector('.mate-net__plies')?.tagName).toBe('OL')
  })
})

/** AC 4. The normal ending of a gambit, and not a consolation prize. */
describe('an assessed position', () => {
  it('states the evaluation and the middlegame plan, each under its own label', async () => {
    await show({ outcome: ASSESSMENT.outcome })

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(EN.assessmentHeading)
    expect(screen.getByRole('heading', { level: 4, name: EN.evaluation })).toBeVisible()
    expect(screen.getByRole('heading', { level: 4, name: EN.plan })).toBeVisible()
  })

  it('renders the author’s prose in full — material, the imbalance, and a pawn break', async () => {
    const assessment = assessed()
    await show({ outcome: ASSESSMENT.outcome })

    expect(screen.getByText(prose(assessment.evaluation, 'en'))).toBeVisible()
    const plan = screen.getByText(prose(assessment.plan, 'en'))
    expect(plan).toBeVisible()
    // AC 4 asks for concrete plans *and* pawn breaks, so the fixture carries one.
    expect(plan.textContent ?? '').toContain('f2–f4')
  })

  it('falls back to Vietnamese and marks it, rather than going blank', async () => {
    const assessment = assessed()
    const { container } = await show({
      outcome: { ...assessment, plan: { vi: 'Trắng chuẩn bị f2–f4.' } },
    })
    const blocks = container.querySelectorAll('.assessment-outcome__prose')

    expect(blocks[1]).toHaveAttribute('lang', 'vi')
    expect(blocks[1]?.textContent).toContain('Trắng chuẩn bị f2–f4.')
    expect(screen.getByText(en.untranslated?.marker ?? '')).toBeVisible()
    // The evaluation was translated, so only one of the two blocks is marked.
    expect(blocks[0]).not.toHaveAttribute('lang')
  })

  /**
   * "Must not read as a consolation prize" is a claim about weight, so it is measured as
   * one: the same heading level, the same padding and the same heading size as the proved
   * mate next door. A quieter, smaller box says "second prize" whatever the copy says.
   */
  it('carries the same weight as a proved mate', async () => {
    await show({ outcome: ASSESSMENT.outcome })

    expect(screen.getByRole('heading', { level: 3 })).toBeVisible()
    for (const declaration of ['padding: var(--space-4)', 'font-size: var(--text-lg)']) {
      expect(assessmentCss).toContain(declaration)
      expect(mateCss).toContain(declaration)
    }
  })

  it('does not colour in a direction the content never stated', async () => {
    await show({ outcome: ASSESSMENT.outcome })

    /*
     * §2 names --color-advantage, --color-equal and --color-worse, and the wire carries no
     * field that chooses between them: `evaluation` is prose. Picking one would be the UI
     * asserting a direction the author never did.
     */
    expect(assessmentCss).not.toMatch(/--color-(advantage|equal|worse)\)/)
  })
})

/** AC 5. A designed state — never a spinner and never an error. */
describe('a branch nobody has mapped', () => {
  it('says so plainly, and says the site will not guess', async () => {
    await show({ outcome: UNEXPLORED.outcome })

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(EN.unexploredHeading)
    expect(screen.getByText(EN.unexploredBody)).toBeVisible()
  })

  /**
   * Each of these would tell a screen-reader user that something is in flight or has gone
   * wrong, and both are untrue: nothing is loading and nothing failed. The line stops.
   */
  it('is not a spinner and not an error', async () => {
    const { container } = await show({ outcome: UNEXPLORED.outcome })

    expect(container.querySelector('[aria-busy]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})

/** AC 6. Every outcome says where its claim came from. */
describe('provenance', () => {
  const OUTCOMES = [
    { what: 'a proved mate', leaf: MATE },
    { what: 'an assessed position', leaf: ASSESSMENT },
    { what: 'an unmapped branch', leaf: UNEXPLORED },
  ]

  it.each(OUTCOMES)('$what renders one', async ({ leaf: which }) => {
    const { container } = await show({ outcome: which.outcome, fen: which.fen })

    expect(container.querySelectorAll('.provenance')).toHaveLength(1)
  })

  it('a proof names a certificate and links to how it was checked', async () => {
    const { container } = await show()
    const note = container.querySelector('.provenance')

    expect(note?.textContent).toContain(EN.proved)
    expect(note?.querySelector('.provenance__certificate')?.textContent).toBe(
      provedMate().basis.certificate,
    )
    expect(note?.querySelector('a')).not.toBeNull()
  })

  /**
   * The structural half of the distinction, and the half a stylesheet cannot fake: a
   * judgement has a person and a date and no certificate to point at, because there is none.
   */
  it('a judgement names a person and a date, and has no proof to link to', async () => {
    const { container } = await show({ outcome: ASSESSMENT.outcome })
    const note = container.querySelector('.provenance')

    expect(note?.textContent).toContain(EN.judgement)
    expect(note?.textContent).toContain('chan')
    expect(note?.querySelector('time')).toHaveAttribute('datetime', '2026-09-16')
    expect(note?.querySelector('.provenance__certificate')).toBeNull()
    expect(note?.querySelector('a')).toBeNull()
  })

  it('an unmapped branch says there is nothing to attribute, rather than going blank', async () => {
    const { container } = await show({ outcome: UNEXPLORED.outcome })
    const note = container.querySelector('.provenance')

    expect(note?.textContent).toContain(EN.noClaim)
    expect(note?.textContent).toContain(EN.noClaimNote)
  })
})

/**
 * **AC 1 and AC 6 — the assertion this ticket exists for.**
 *
 * A proof sitting beside an unlabelled opinion does not make the opinion true, only
 * convincing. So the two have to be told apart *with the colour gone*: six of the ten
 * quality-and-outcome colour pairs in this palette collapse to nearly the same grey, and a
 * distinction drawn in hue alone is one a great many readers never see.
 *
 * Everything below reads a **greyscale signal** — the words, the icon outlines, and the
 * geometry of the element's own CSS rule with every colour token stripped out of it. A
 * change that left two of these differing only in hue would collapse their signals, and the
 * probes at the end show that happening.
 */
describe('a proof and an opinion survive greyscale', () => {
  const COLOUR_PROPERTIES: ReadonlySet<string> = new Set([
    'color',
    'background-color',
    'border-color',
    'fill',
    'stroke',
  ])

  /**
   * A rule with its colour removed — both the colour *properties* and any colour token
   * inside a shorthand. Without the second half, `border: 1px solid var(--color-mate)`
   * against `border: 1px solid var(--color-worse)` would read as a difference in shape.
   */
  const geometryOf = (css: string, selector: string): readonly string[] => {
    // Only the dot needs escaping: a class name is letters, digits, hyphens and
    // underscores, and a hyphen outside a character class is already literal.
    const found = new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)
    const body = found?.[1]
    if (body === undefined) throw new Error(`no rule for ${selector}`)
    return body
      .replace(/var\(--color-[a-z-]+\)/g, ' ')
      .split(';')
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration !== '')
      .filter(
        (declaration) =>
          !COLOUR_PROPERTIES.has(declaration.slice(0, declaration.indexOf(':')).trim()),
      )
      .sort()
  }

  /** Geometry only: the element a mark draws, and the path it draws it with. */
  const shapesIn = (element: Element): readonly string[] =>
    [...element.querySelectorAll('svg *')].map(
      (shape) => `${shape.tagName}:${shape.getAttribute('d') ?? ''}`,
    )

  const modifierOf = (element: Element, block: string): string => {
    const found = [...element.classList].find((name) => name.startsWith(`${block}--`))
    if (found === undefined) throw new Error(`${block} has no modifier`)
    return found
  }

  type NoteFacts = { readonly words: string; readonly shapes: string; readonly rule: string }

  const factsFor = async (which: Leaf): Promise<NoteFacts> => {
    const { container } = await show({ outcome: which.outcome, fen: which.fen })
    const note = container.querySelector('.provenance')
    if (note === null) throw new Error('no provenance note rendered')
    const facts = {
      words: note.textContent ?? '',
      shapes: shapesIn(note).join('|'),
      rule: geometryOf(provenanceCss, `.${modifierOf(note, 'provenance')}`).join('|'),
    }
    cleanup()
    return facts
  }

  const everyNote = async (): Promise<readonly NoteFacts[]> => [
    await factsFor(MATE),
    await factsFor(ASSESSMENT),
    await factsFor(UNEXPLORED),
  ]

  it('gives the three kinds of claim three different signals', async () => {
    const signals = (await everyNote()).map((facts) =>
      [facts.words, facts.shapes, facts.rule].join('|'),
    )

    expect(new Set(signals).size).toBe(3)
    for (const signal of signals) expect(signal).not.toBe('||')
  })

  it('and the words alone would do it', async () => {
    const words = (await everyNote()).map((facts) => facts.words)

    expect(new Set(words).size).toBe(3)
    for (const word of words) expect(word).not.toBe('')
  })

  it('and the icon outlines alone would do it', async () => {
    const shapes = (await everyNote()).map((facts) => facts.shapes)

    expect(new Set(shapes).size).toBe(3)
    for (const shape of shapes) expect(shape).not.toBe('')
  })

  it('and so would the geometry of the rules they are drawn with', async () => {
    const rules = (await everyNote()).map((facts) => facts.rule)

    expect(new Set(rules).size).toBe(3)
    for (const rule of rules) expect(rule).not.toBe('')
  })

  /** The three cards themselves, on the same terms: three silhouettes, not three fills. */
  it('gives the three outcome cards three different silhouettes', async () => {
    const rules = [
      geometryOf(mateCss, '.mate-outcome').join('|'),
      geometryOf(assessmentCss, '.assessment-outcome').join('|'),
      geometryOf(unexploredCss, '.unexplored-outcome').join('|'),
    ]

    expect(new Set(rules).size).toBe(3)
  })

  /**
   * The probes. Every assertion above compares signals, so without these they would all keep
   * passing if a signal ever stopped carrying anything — which is exactly how a colour-alone
   * check rots into a comment.
   */
  describe('the detector can fail', () => {
    const element = (html: string): Element => {
      const host = document.createElement('div')
      host.innerHTML = html
      const first = host.firstElementChild
      if (first === null) throw new Error('no element in the fixture')
      return first
    }

    const CSS = [
      '.probe--one { border-inline-start: var(--border-width) solid var(--color-mate); }',
      '.probe--two { border-inline-start: var(--border-width) solid var(--color-worse); }',
      '.probe--three { border-inline-start: var(--border-width) dashed var(--color-mate); }',
    ].join('\n')

    it('reports two rules that differ only in their colour as the same geometry', () => {
      expect(geometryOf(CSS, '.probe--one')).toStrictEqual(geometryOf(CSS, '.probe--two'))
    })

    it('reports them as different once one of them changes its border style', () => {
      expect(geometryOf(CSS, '.probe--one')).not.toStrictEqual(geometryOf(CSS, '.probe--three'))
    })

    it('reports two marks drawn with the same path as the same shape', () => {
      const one = element('<p><svg><path d="M3 8 13 8"/></svg>note</p>')
      const other = element('<p><svg><path d="M3 8 13 8"/></svg>note</p>')

      expect(shapesIn(one).join('|')).toBe(shapesIn(other).join('|'))
    })

    it('reports a note with no mark at all as empty, so a missing icon cannot pass', () => {
      expect(shapesIn(element('<p>note</p>'))).toStrictEqual([])
    })
  })
})

/**
 * **AC 7. Copy never says "mate" for a position that is merely winning.**
 *
 * Read off the rendered card in all three languages, because that is where a learner meets
 * it. The word boundaries are Unicode-aware rather than `\b`: in JavaScript `\b` treats an
 * accented letter as a non-word character, so `\bmat\b` matches inside *matériel* — and
 * "material is level" is the one sentence an assessment is most likely to contain.
 */
describe('a merely winning position is never called a mate', () => {
  const MATE_WORDS: Readonly<Record<Locale, RegExp>> = {
    vi: /chiếu hết/iu,
    en: /(?<!\p{L})(mate|mated|mates|checkmate|checkmated)(?!\p{L})/iu,
    fr: /(?<!\p{L})(mat|mats|mate|maté)(?!\p{L})/iu,
  }

  it.each(locales)('the assessed position says no such thing in %s', async (locale) => {
    const { container } = await show({ outcome: ASSESSMENT.outcome, locale })

    expect(card(container).textContent ?? '').not.toMatch(MATE_WORDS[locale])
  })

  it.each(locales)('nor does the unmapped branch in %s', async (locale) => {
    const { container } = await show({ outcome: UNEXPLORED.outcome, locale })

    expect(card(container).textContent ?? '').not.toMatch(MATE_WORDS[locale])
  })

  /**
   * The control, and the reason the two above mean anything: the *mate* card trips every one
   * of these detectors, so they are looking for a word this site really does use.
   */
  it.each(locales)('while the proved mate says it plainly in %s', async (locale) => {
    const { container } = await show({ locale })

    expect(card(container).textContent ?? '').toMatch(MATE_WORDS[locale])
  })

  /** And the words that must *not* trip it, which is where a naive `\b` would fail. */
  it('does not mistake material, matériel or affirmation for a mate claim', () => {
    expect('Material is level.').not.toMatch(MATE_WORDS.en)
    expect('Matériel égal.').not.toMatch(MATE_WORDS.fr)
    expect('Aucune affirmation').not.toMatch(MATE_WORDS.fr)
    expect('Mat forcé en 2').toMatch(MATE_WORDS.fr)
  })
})

/**
 * The distinction is only ever as good as the words, in the language actually being read.
 *
 * Everything above proves the three cards differ in structure, geometry and icon outline, and
 * that the *English* copy names them apart. None of it would notice a translation that called a
 * proof and an opinion by the same name, or by names that differ only where a skimming reader
 * stops looking. The stylesheets are identical in every locale, so the greyscale tests would stay
 * green; the DOM tests read `EN` and would not look.
 *
 * That gap matters more than it sounds. A learner reading Vietnamese or French would get two
 * cards that look different and say the same thing — the proof machinery lending its weight to an
 * opinion, which is the one failure this ticket exists to prevent (docs/CONTEXT.md, *Provenance*).
 * Two thirds of this site's languages are ones its author does not write natively, so "the words
 * are obviously different" is exactly the assumption that should be a test.
 */
describe('the words alone tell a proof from an opinion, in every language', () => {
  const labelsOf = (locale: Locale) => {
    const { proved, judgement, noClaim } = COPY[locale]
    return { proved, judgement, noClaim }
  }

  it.each(locales)('gives the three a name of their own in %s', (locale) => {
    const { proved, judgement, noClaim } = labelsOf(locale)
    const names = [proved, judgement, noClaim]

    expect(new Set(names).size).toBe(names.length)

    // Nor may one contain another. "Proved" sitting inside "Not proved" is the same claim to
    // anyone skimming, and a screen reader reaches none of the border styles or icon outlines
    // the sighted tests fall back on — the word is the whole signal it gets.
    const pairs: readonly (readonly [string, string])[] = [
      [proved, judgement],
      [judgement, noClaim],
      [noClaim, proved],
    ]
    for (const [a, b] of pairs) {
      expect(a.toLocaleLowerCase(locale)).not.toContain(b.toLocaleLowerCase(locale))
      expect(b.toLocaleLowerCase(locale)).not.toContain(a.toLocaleLowerCase(locale))
    }
  })

  it.each(locales)('puts each name on the right card, and only there, in %s', async (locale) => {
    const { proved, judgement, noClaim } = labelsOf(locale)

    const read = async (which: Leaf): Promise<string> => {
      const { container } = await show({ outcome: which.outcome, fen: which.fen, locale })
      const text = card(container).textContent ?? ''
      cleanup()
      return text
    }

    const onMate = await read(MATE)
    const onAssessment = await read(ASSESSMENT)
    const onUnmapped = await read(UNEXPLORED)

    expect(onMate).toContain(proved)
    expect(onMate).not.toContain(judgement)
    expect(onMate).not.toContain(noClaim)

    expect(onAssessment).toContain(judgement)
    expect(onAssessment).not.toContain(proved)
    expect(onAssessment).not.toContain(noClaim)

    expect(onUnmapped).toContain(noClaim)
    expect(onUnmapped).not.toContain(proved)
    expect(onUnmapped).not.toContain(judgement)
  })
})
