import { cleanup, render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import designSystem from '../../../docs/design-system.md?raw'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'
import type { LocaleLoader } from '../../i18n/i18n.ts'
import type {
  CompiledDismissRest,
  CompiledDismissal,
  CompiledProvenance,
  ReplyQuality,
} from '../../lib/content-types.ts'
import { isLocale, type Locale } from '../../lib/locale.ts'
import en from '../../locales/en.ts'
import fr from '../../locales/fr.ts'
import vi from '../../locales/vi.ts'
import { BranchChoices } from './BranchChoices.tsx'
import { EVANS_ENTRY, WIDE_ENTRY } from './learn-fixtures.ts'
import { branchChoices, type BranchChoice } from './tree-path.ts'

/**
 * `BranchChoices` on its own: the replies, the omissions, and the rule that the quality of
 * a reply is never something only a colour says.
 *
 * Rendered through the real i18n provider and a real router, because two of the claims
 * being made are about those: every choice is an anchor with an `href` (§4), and every
 * label comes out of the catalogue rather than out of this file.
 */

const CATALOGUES: Readonly<Record<Locale, typeof en>> = { vi, en, fr }
const load: LocaleLoader = (requested) =>
  Promise.resolve(isLocale(requested) ? CATALOGUES[requested] : vi)

const EN = { ...vi.learn, ...en.learn }

const JUDGEMENT: CompiledProvenance = {
  basis: 'judgement',
  by: 'chan',
  at: '2026-09-16',
  source: 'No engine and no opening explorer.',
}

/**
 * `dismissRest` is `null` for "there is no catch-all" rather than `undefined`, because a
 * default parameter cannot tell `undefined` from absent — a test that passed `undefined`
 * would silently get the fixture's catch-all back and assert that it is missing while
 * looking at it.
 */
type Options = {
  readonly choices?: readonly BranchChoice[]
  readonly fen?: string
  readonly dismissed?: readonly CompiledDismissal[]
  readonly dismissRest?: CompiledDismissRest | null
  readonly judgement?: CompiledProvenance
  readonly locale?: Locale
}

const EVANS_CHOICES = branchChoices(EVANS_ENTRY.tree, [])

const show = async ({
  choices = EVANS_CHOICES,
  fen = EVANS_ENTRY.tree.fen,
  dismissed = EVANS_ENTRY.tree.dismissed ?? [],
  dismissRest = EVANS_ENTRY.tree.dismissRest ?? null,
  judgement = JUDGEMENT,
  locale = 'en',
}: Options = {}) => {
  const router = createMemoryRouter(
    [
      {
        path: '/:locale/gambits/:id',
        element: (
          <I18nProvider locale={locale} load={load}>
            <BranchChoices
              choices={choices}
              fen={fen}
              dismissed={dismissed}
              dismissRest={dismissRest ?? undefined}
              orientation="white"
              locale={locale}
              judgement={judgement}
              shortcuts="on"
            />
          </I18nProvider>
        ),
      },
    ],
    { initialEntries: ['/en/gambits/evans-gambit'] },
  )
  const view = render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 3 })
  return view
}

const choiceLinks = () => screen.getAllByRole('link')

/** The "28 other replies" / "1 reply is not modelled" phrase, as one readable string. */
const omittedLabel = (container: HTMLElement, which: 'rest' | 'dismissed'): string =>
  container.querySelector(`.omitted--${which} .omitted__label`)?.textContent ?? ''

afterEach(cleanup)

/** AC 1. Every reply, with everything the learner needs to decide what it means. */
describe('every modelled reply renders as a choice', () => {
  it('renders one per reply and none left out', async () => {
    await show()

    expect(choiceLinks().map((link) => link.textContent)).toHaveLength(4)
    expect(EVANS_ENTRY.tree.children).toHaveLength(4)
  })

  it('names each one by its SAN, numbered the way a scoresheet is', async () => {
    await show()

    expect(screen.getByRole('link', { name: /5\.\.\.Ba5/ })).toBeVisible()
    expect(screen.getByRole('link', { name: /5\.\.\.Bd6/ })).toBeVisible()
  })

  it('shows a preview board for each, drawn from that reply’s own position', async () => {
    const { container } = await show()
    const previews = container.querySelectorAll('.board-preview')

    expect(previews).toHaveLength(4)
    // Eight ranks of eight cells, so these really are boards and not empty boxes.
    expect(container.querySelectorAll('.board-preview [role="gridcell"]')).toHaveLength(4 * 64)
  })

  it('carries a quality as a word, not only as a colour', async () => {
    await show()
    const first = screen.getByRole('link', { name: /Ba5/ })

    expect(within(first).getByText(EN.qualityBest)).toBeVisible()
    expect(first).toHaveAccessibleName(expect.stringContaining(EN.replyQuality))
  })

  it('carries a frequency, and says what the word is measuring', async () => {
    await show()
    const first = screen.getByRole('link', { name: /Ba5/ })

    expect(within(first).getByText(EN.frequencyCommon)).toBeVisible()
    expect(first).toHaveAccessibleName(expect.stringContaining(EN.frequency))
  })

  it('has a real state for a reply whose quality or frequency was never written', async () => {
    await show()
    // `Bd6` in the fixture carries a quality and no frequency, on purpose.
    const unstated = screen.getByRole('link', { name: /Bd6/ })

    expect(within(unstated).getByText(EN.qualityMistake)).toBeVisible()
    expect(within(unstated).getByText(EN.notStated)).toBeVisible()
  })

  it('attributes those judgements, on every choice, to where they came from', async () => {
    await show()

    expect(screen.getByText(new RegExp(EN.judgementNote))).toBeVisible()
    for (const link of choiceLinks()) {
      expect(link).toHaveAccessibleDescription(expect.stringContaining(EN.judgementNote))
      expect(link).toHaveAccessibleDescription(expect.stringContaining('chan'))
    }
  })

  it('renders a proved provenance differently from an opinion, rather than hiding it', async () => {
    await show({
      judgement: { basis: 'proved', by: 'certificate', certificate: 'legal-trap.Bxd1.mate.json' },
    })

    expect(screen.getByText(/legal-trap\.Bxd1\.mate\.json/)).toBeVisible()
    expect(screen.queryByText(new RegExp(EN.judgementNote))).toBeNull()
  })

  it('is a link, so a reply can be middle-clicked and copied (§4)', async () => {
    await show()

    for (const link of choiceLinks()) {
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href')
    }
    expect(screen.getByRole('link', { name: /Ba5/ })).toHaveAttribute(
      'href',
      '/en/gambits/evans-gambit?line=Ba5',
    )
  })

  it('marks the one that next also leads to, so the two controls do not disagree', async () => {
    await show()

    expect(
      within(screen.getByRole('link', { name: /Ba5/ })).getByText(EN.nextGoesHere),
    ).toBeVisible()
    expect(
      within(screen.getByRole('link', { name: /Bc5/ })).queryByText(EN.nextGoesHere),
    ).toBeNull()
  })

  it('prints a key cap on the first nine and on no more than that (AC 6)', async () => {
    const { container } = await show({ choices: branchChoices(WIDE_ENTRY.tree, []) })

    expect(choiceLinks()).toHaveLength(12)
    expect(
      [...container.querySelectorAll('.choice-link__shortcut')].map((k) => k.textContent),
    ).toStrictEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('has a designed empty state when nothing is modelled yet', async () => {
    await show({ choices: [] })

    expect(screen.getByText(EN.noRepliesModelled)).toBeVisible()
    expect(screen.queryByText(new RegExp(EN.judgementNote))).toBeNull()
  })
})

/**
 * AC 4, and the criterion this ticket was reopened for.
 *
 * "34 other replies" is not a nicety. One truthful answer covering thirty-four replies is
 * an answer **only** if the learner is shown that it covers thirty-four, so the count, the
 * reason and the covered list are each asserted — and the last of the three is asserted by
 * comparing against the fixture's own `covers`, not against a number typed here.
 */
describe('the catch-all the learner actually sees (AC 4)', () => {
  const covers = EVANS_ENTRY.tree.dismissRest?.covers ?? []

  it('renders at all, which is what #29 could not do', async () => {
    const { container } = await show()

    expect(covers.length).toBe(28)
    expect(omittedLabel(container, 'rest')).toBe(`${covers.length} ${EN.otherReplies}`)
  })

  it('states the reason, in the active locale', async () => {
    await show()

    expect(screen.getByText(/Neither keeps the pawn nor challenges the gambit/)).toBeVisible()
  })

  it('falls back to Vietnamese and marks it, rather than going blank', async () => {
    await show({
      dismissRest: { reason: { vi: 'Không thách thức gambit.' }, covers: ['a6', 'h6'] },
    })

    const reason = screen.getByText('Không thách thức gambit.')
    expect(reason).toHaveAttribute('lang', 'vi')
    expect(screen.getByText(en.untranslated?.marker ?? '')).toBeVisible()
  })

  it('is collapsed, and expands to the exact SAN the build derived', async () => {
    const { container } = await show()
    const details = container.querySelector('.omitted--rest')

    expect(details).toBeInstanceOf(HTMLDetailsElement)
    expect(details).not.toHaveAttribute('open')

    const listed = [...(details?.querySelectorAll('.omitted__ply') ?? [])].map(
      (li) => li.textContent,
    )
    expect(listed).toStrictEqual([...covers])
  })

  it('says "other reply" rather than "other replies" when it covers exactly one', async () => {
    const { container } = await show({
      dismissRest: { reason: { vi: 'x', en: 'Only this one.' }, covers: ['Bxc3'] },
    })

    expect(omittedLabel(container, 'rest')).toBe(`1 ${EN.otherReply}`)
  })

  it('renders nothing at a node that has no catch-all', async () => {
    const { container } = await show({ dismissRest: null })

    expect(container.querySelector('.omitted--rest')).toBeNull()
  })
})

/** AC 3. An omission the learner can see is honest; one they cannot see is the failure. */
describe('the replies a maintainer set aside (AC 3)', () => {
  it('renders them, collapsed, with the reason each was set aside for', async () => {
    const { container } = await show()
    const details = container.querySelector('.omitted--dismissed')

    expect(details).toBeInstanceOf(HTMLDetailsElement)
    expect(details).not.toHaveAttribute('open')
    expect(omittedLabel(container, 'dismissed')).toBe(`1 ${EN.dismissedReply}`)
    expect(details?.querySelector('.omitted__ply')?.textContent).toBe('Bxc3')
    expect(details?.textContent).toContain('Tự nguyện trả tượng')
  })

  it('says a maintainer wrote it, rather than passing it off as copy for a reader', async () => {
    const { container } = await show()

    expect(container.querySelector('.omitted--dismissed .omitted__note')?.textContent).toBe(
      EN.maintainerNote,
    )
  })

  it('renders nothing where nothing was set aside', async () => {
    const { container } = await show({ dismissed: [] })

    expect(container.querySelector('.omitted--dismissed')).toBeNull()
  })
})

/**
 * **AC 2 — quality is never conveyed by colour alone.** The real greyscale review step.
 *
 * This is not a claim about intent, because it is not satisfiable by intent. The five
 * `--color-quality-*` tokens are chosen for hue, and two of them are *the same grey*: this
 * reads the shipped values out of `docs/design-system.md` §2 — where the design system says
 * values live — and computes WCAG relative luminance, which is a weighted sum of the three
 * channels and carries no hue at all.
 *
 * Then it takes the pair that collapses and checks that a learner who cannot see the hue is
 * still told them apart, by a word and by a shape. And the last block shows the detector
 * failing, because a greyscale check that cannot fail is worth nothing.
 */
describe('quality survives greyscale (AC 2)', () => {
  const TOKEN_ROW =
    /^\|\s*`(--color-quality-[a-z]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/gim

  const QUALITY_COLOURS = new Map(
    [...designSystem.matchAll(TOKEN_ROW)].flatMap(([, name, light, dark]) =>
      name === undefined || light === undefined || dark === undefined
        ? []
        : [[name, { light, dark }]],
    ),
  )

  const channel = (hex: string, offset: number): number => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  /** WCAG 2.2 relative luminance: hue-free, which is exactly what greyscale means. */
  const luminance = (hex: string): number =>
    0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)

  const greyDistance = (a: string, b: string): number => {
    const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
  }

  const QUALITIES: readonly ReplyQuality[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder']

  /**
   * Everything about a badge that a greyscale screenshot would still show: the words, and
   * the icon's outline. Deliberately *not* the class name and not the colour — the whole
   * question is what is left when those are gone.
   */
  const greyscaleSignal = (badge: Element): string =>
    [
      badge.textContent ?? '',
      ...[...badge.querySelectorAll('path')].map((path) => path.getAttribute('d') ?? ''),
    ].join('|')

  const badges = (container: HTMLElement): readonly Element[] => [
    ...container.querySelectorAll('.quality-badge'),
  ]

  it('reads the five quality colours the design system actually documents', () => {
    expect([...QUALITY_COLOURS.keys()].sort()).toStrictEqual(
      QUALITIES.map((quality) => `--color-quality-${quality}`).sort(),
    )
  })

  type Theme = 'light' | 'dark'
  const THEMES: readonly Theme[] = ['light', 'dark']

  it.each(THEMES)(
    'has two qualities that are the same grey in the %s theme, so colour cannot carry it',
    (theme: Theme) => {
      const pairs = QUALITIES.flatMap((a, index) =>
        QUALITIES.slice(index + 1).map((b) => ({
          pair: [a, b],
          distance: greyDistance(
            QUALITY_COLOURS.get(`--color-quality-${a}`)?.[theme] ?? '#000000',
            QUALITY_COLOURS.get(`--color-quality-${b}`)?.[theme] ?? '#ffffff',
          ),
        })),
      )
      const closest = pairs.reduce((best, candidate) =>
        candidate.distance < best.distance ? candidate : best,
      )

      expect(
        closest.distance,
        `${closest.pair.join(' and ')} are ${closest.distance.toFixed(3)}:1 apart in greyscale`,
      ).toBeLessThan(1.1)
    },
  )

  it('tells all five apart with the colour removed', async () => {
    const { container } = await show({ choices: branchChoices(WIDE_ENTRY.tree, []) })
    const signals = new Set(badges(container).map(greyscaleSignal))

    // Twelve replies, five qualities, so five distinct greyscale signals and no fewer.
    expect(signals.size).toBe(QUALITIES.length)
    for (const signal of signals) expect(signal).not.toBe('')
  })

  it('gives each quality its own silhouette, not one shape at five sizes', async () => {
    const { container } = await show({ choices: branchChoices(WIDE_ENTRY.tree, []) })
    const shapes = new Set(
      [...container.querySelectorAll('.quality-badge__icon path')].map((path) =>
        path.getAttribute('d'),
      ),
    )

    expect(shapes.size).toBe(QUALITIES.length)
  })

  it('gives each quality its own word', async () => {
    const { container } = await show({ choices: branchChoices(WIDE_ENTRY.tree, []) })
    const words = new Set(badges(container).map((badge) => badge.textContent))

    expect(words.size).toBe(QUALITIES.length)
    expect([...words].join(' ')).toContain(EN.qualityBlunder)
  })

  /**
   * The control. Every assertion above compares signals; without this, they would all keep
   * passing if `greyscaleSignal` ever started returning the class name — which is precisely
   * how a colour-alone check rots into a comment.
   */
  describe('the detector can fail', () => {
    const element = (html: string): Element => {
      const host = document.createElement('div')
      host.innerHTML = html
      const first = host.firstElementChild
      if (first === null) throw new Error('no element in the fixture')
      return first
    }

    it('reports two badges that differ only by colour as indistinguishable', () => {
      const a = element('<span class="quality-badge quality-badge--good">move</span>')
      const b = element('<span class="quality-badge quality-badge--mistake">move</span>')

      expect(greyscaleSignal(a)).toBe(greyscaleSignal(b))
      expect(new Set([a, b].map(greyscaleSignal)).size).toBe(1)
    })

    it('reports them as distinguishable once one of them carries a different word', () => {
      const a = element('<span class="quality-badge quality-badge--good">good</span>')
      const b = element('<span class="quality-badge quality-badge--mistake">mistake</span>')

      expect(new Set([a, b].map(greyscaleSignal)).size).toBe(2)
    })

    it('reports them as distinguishable once one of them carries a different shape', () => {
      const a = element('<span class="quality-badge"><svg><path d="M3 8 13 8"/></svg>x</span>')
      const b = element('<span class="quality-badge"><svg><path d="M4 4 12 12"/></svg>x</span>')

      expect(new Set([a, b].map(greyscaleSignal)).size).toBe(2)
    })

    it('would notice if the words were dropped and only the icons were left', () => {
      const a = element('<span class="quality-badge"><svg><path d="M3 8 13 8"/></svg></span>')
      const b = element('<span class="quality-badge"><svg><path d="M3 8 13 8"/></svg></span>')

      expect(new Set([a, b].map(greyscaleSignal)).size).toBe(1)
    })
  })
})

/**
 * A choice's accessible name is assembled from several strings, and one of them nearly
 * broke every existing query for the navigator.
 *
 * The Vietnamese marker on the choice `next` also leads to read "Nút 'nước sau' đi vào
 * đây", which *contains* the navigator's own label, "Nước sau". Nothing about that is
 * wrong as copy — and it made `getByRole('link', { name: 'Nước sau' })` match two elements,
 * so six merged end-to-end tests failed at once. The wording was changed; this is what
 * stops the next person changing it back, in a language they may not read.
 */
describe('a choice never borrows a navigation control’s name', () => {
  type ControlKey = 'toStart' | 'previousPly' | 'nextPly'
  const CONTROLS: readonly ControlKey[] = ['toStart', 'previousPly', 'nextPly']
  const LOCALES: readonly Locale[] = ['vi', 'en', 'fr']

  const stringFor = (locale: Locale, key: keyof typeof vi.learn): string => {
    const catalogue = CATALOGUES[locale].learn
    const value = catalogue === undefined ? undefined : catalogue[key]
    return value ?? vi.learn[key]
  }

  it.each(LOCALES)('holds in %s', (locale) => {
    const marker = stringFor(locale, 'nextGoesHere').toLowerCase()

    for (const control of CONTROLS) {
      expect(
        marker.includes(stringFor(locale, control).toLowerCase()),
        `"${marker}" contains the ${control} label, so a query for that control finds a reply too`,
      ).toBe(false)
    }
  })

  it('catches it: the wording that actually caused this is rejected', () => {
    const wasBroken = 'Nút “nước sau” đi vào đây'.toLowerCase()

    expect(wasBroken.includes(vi.learn.nextPly.toLowerCase())).toBe(true)
  })
})
