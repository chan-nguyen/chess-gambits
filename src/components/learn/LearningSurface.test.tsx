import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'
import type { LocaleLoader } from '../../i18n/i18n.ts'
import type { PartialTranslations } from '../../i18n/translations.ts'
import type { CompiledEntry } from '../../lib/content-types.ts'
import { lineSearch } from '../../lib/line.ts'
import { isLocale, type Locale } from '../../lib/locale.ts'
import en from '../../locales/en.ts'
import fr from '../../locales/fr.ts'
import viCatalogue from '../../locales/vi.ts'
import { GambitRoute } from '../../routes/gambit.tsx'
import {
  EVANS_ENTRY,
  MAIN_LINE,
  MAPPED_ENTRY,
  OUTCOMES_ENTRY,
  OUTCOME_ASSESSMENT_LINE,
  OUTCOME_MATE_LINE,
  OUTCOME_UNEXPLORED_LINE,
  PLAN_LINE,
  WIDE_ENTRY,
} from './learn-fixtures.ts'
import { shortcutStorageKey } from './shortcuts.ts'

/**
 * The core loop, through the real route, the real router and the real loader.
 *
 * Mounted as a route rather than as a component on purpose: the `line` parameter is the
 * only state this surface has, so a test that handed it `requested` as a prop would be
 * testing a different program — one where pressing next changes a variable instead of
 * changing the URL, which is the thing acceptance criterion 3 is about.
 */

const VI = viCatalogue.learn
/** English and French over the source locale: both are typed as subsets of `vi.ts`. */
const EN = { ...viCatalogue.learn, ...en.learn }
const FR = { ...viCatalogue.learn, ...fr.learn }

/** The surface's landmark, per locale, so a test can wait for the page it asked for. */
const NAVIGATION: Readonly<Record<Locale, string>> = {
  vi: VI.navigation,
  en: EN.navigation,
  fr: FR.navigation,
}

const CATALOGUES: Readonly<Record<Locale, PartialTranslations>> = { vi: viCatalogue, en, fr }

const load: LocaleLoader = (requested) =>
  Promise.resolve(isLocale(requested) ? CATALOGUES[requested] : viCatalogue)

const serve = (entry: CompiledEntry | null): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      entry === null
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(
            new Response(JSON.stringify(entry), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          ),
    ),
  )
}

type Options = {
  readonly locale?: Locale
  readonly line?: readonly string[]
  /**
   * A fixture to serve in place of the default. The URL follows it, because `loadEntry`
   * refuses a file that names a different entry — correctly, since that is a misconfigured
   * host. Left out, the fetch stub `beforeEach` installed is the one that answers, which is
   * what the tests that stub a *failure* depend on.
   */
  readonly entry?: CompiledEntry
}

const renderGambit = ({ locale = 'vi', line = [], entry }: Options = {}) => {
  if (entry !== undefined) serve(entry)
  const id = entry?.id ?? MAPPED_ENTRY.id
  const router = createMemoryRouter(
    [
      {
        path: '/:locale',
        element: (
          <I18nProvider locale={locale} load={load}>
            <Outlet />
          </I18nProvider>
        ),
        children: [{ path: 'gambits/:id', element: <GambitRoute /> }],
      },
    ],
    { initialEntries: [`/${locale}/gambits/${id}${lineSearch(line)}`] },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** Resolves once the tree has arrived and the surface is on screen. */
const surface = async (options: Options = {}) => {
  const router = renderGambit(options)
  await screen.findByRole('navigation', { name: NAVIGATION[options.locale ?? 'vi'] })
  return router
}

const control = (name: string) => screen.getByRole('link', { name })

beforeEach(() => {
  window.localStorage.clear()
  serve(MAPPED_ENTRY)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('previous and next (AC 1)', () => {
  it('offers next at the root and steps one ply', async () => {
    const router = await surface()

    fireEvent.click(control(VI.nextPly))

    await waitFor(() => expect(router.state.location.search).toBe(lineSearch(['fxe5'])))
  })

  it('offers previous once there is somewhere to go back to', async () => {
    const router = await surface({ line: ['fxe5'] })

    fireEvent.click(control(VI.previousPly))

    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('disables previous at the root, and says so rather than only greying it', async () => {
    await surface()
    const previous = control(VI.previousPly)

    expect(previous).toHaveAttribute('aria-disabled', 'true')
    expect(previous).not.toHaveAttribute('href')
    expect(previous).toHaveAccessibleDescription(VI.atStart)
  })

  it('disables next at a leaf, and says so', async () => {
    await surface({ line: MAIN_LINE })
    const next = control(VI.nextPly)

    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(next).toHaveAccessibleDescription(VI.atEnd)
  })

  it('says both when the whole tree is one node', async () => {
    serve({ ...MAPPED_ENTRY, tree: { kind: 'opponent', fen: MAPPED_ENTRY.tree.fen } })
    await surface()

    expect(control(VI.previousPly)).toHaveAccessibleDescription(`${VI.atStart} ${VI.atEnd}`)
    expect(control(VI.nextPly)).toHaveAccessibleDescription(`${VI.atStart} ${VI.atEnd}`)
  })

  it('enables both in the middle of a line', async () => {
    await surface({ line: ['fxe5', 'Qh5+'] })

    expect(control(VI.previousPly)).toHaveAttribute('href')
    expect(control(VI.nextPly)).toHaveAttribute('href')
    expect(screen.queryByText(VI.atStart)).toBeNull()
    expect(screen.queryByText(VI.atEnd)).toBeNull()
  })

  it('jumps back to the start from deep in a line', async () => {
    const router = await surface({ line: MAIN_LINE })

    fireEvent.click(control(VI.toStart))

    await waitFor(() => expect(router.state.location.search).toBe(''))
  })
})

/**
 * §4: navigating between tree nodes is a link, not a button. A learner must be able to
 * middle-click the next position into a new tab and copy its address out of the context
 * menu, because every position in this product is a URL.
 */
describe('the controls are links', () => {
  it('renders a real anchor with a real href, not a button', async () => {
    await surface()
    const next = control(VI.nextPly)

    expect(next.tagName).toBe('A')
    expect(next.getAttribute('href')).toBe(`/vi/gambits/${MAPPED_ENTRY.id}${lineSearch(['fxe5'])}`)
    expect(screen.queryByRole('button', { name: VI.nextPly })).toBeNull()
  })

  it('carries the link relation a browser can act on', async () => {
    await surface({ line: ['fxe5'] })

    expect(control(VI.nextPly)).toHaveAttribute('rel', 'next')
    expect(control(VI.previousPly)).toHaveAttribute('rel', 'prev')
  })
})

describe('the line parameter and history (AC 3)', () => {
  it('writes the path into the URL, percent-encoded whole', async () => {
    const router = await surface()

    fireEvent.click(control(VI.nextPly))
    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5'))

    fireEvent.click(control(VI.nextPly))
    // `+` survives only because the value is encoded as a whole (docs/CONTEXT.md, *Path*).
    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5_Qh5%2B'))
  })

  it('steps back through the path with browser back, and forward again', async () => {
    const router = await surface()

    fireEvent.click(control(VI.nextPly))
    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5'))
    fireEvent.click(control(VI.nextPly))
    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5_Qh5%2B'))

    await act(async () => {
      await router.navigate(-1)
    })
    expect(router.state.location.search).toBe('?line=fxe5')

    await act(async () => {
      await router.navigate(1)
    })
    expect(router.state.location.search).toBe('?line=fxe5_Qh5%2B')
  })

  it('renders the position the URL names, not the one a click produced', async () => {
    await surface({ line: MAIN_LINE })

    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent('6.Bc4+')
  })
})

describe('the arrow keys (AC 2)', () => {
  it('steps forward on right and back on left', async () => {
    const router = await surface()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5'))

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('does nothing at an edge rather than wrapping round', async () => {
    const router = await surface()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    expect(router.state.location.search).toBe('')
  })

  it('leaves the arrow keys to the board when focus is inside it', async () => {
    const router = await surface()
    const cell = screen.getAllByRole('gridcell')[0]

    fireEvent.keyDown(cell ?? window, { key: 'ArrowRight' })

    expect(router.state.location.search).toBe('')
  })

  it('ignores a press that carries a modifier, so browser shortcuts still work', async () => {
    const router = await surface()

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })

    expect(router.state.location.search).toBe('')
  })
})

/**
 * WCAG 2.2 *2.1.4 Character Key Shortcuts* is Level A. The switch is the mechanism, and a
 * mechanism that forgets is not one — so the persistence is asserted here as well as in
 * `shortcuts.test.ts`, at the level a visitor actually meets it.
 */
describe('turning the shortcuts off', () => {
  const toggle = () => screen.getByRole('checkbox', { name: VI.shortcuts })

  it('is on by default, and labelled', async () => {
    await surface()

    expect(toggle()).toBeChecked()
    expect(toggle()).toHaveAccessibleDescription(VI.shortcutsHint)
  })

  it('stops the arrow keys navigating', async () => {
    const router = await surface()

    fireEvent.click(toggle())

    expect(toggle()).not.toBeChecked()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(router.state.location.search).toBe('')
  })

  it('leaves the controls themselves working, so nothing becomes unreachable', async () => {
    const router = await surface()

    fireEvent.click(toggle())
    fireEvent.click(control(VI.nextPly))

    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5'))
  })

  it('persists, so the next page does not turn them back on', async () => {
    await surface()

    fireEvent.click(screen.getByRole('checkbox', { name: VI.shortcuts }))
    expect(window.localStorage.getItem(shortcutStorageKey)).toBe('off')

    cleanup()
    const router = await surface()

    expect(screen.getByRole('checkbox', { name: VI.shortcuts })).not.toBeChecked()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(router.state.location.search).toBe('')
  })

  it('turns them back on again', async () => {
    window.localStorage.setItem(shortcutStorageKey, 'off')
    const router = await surface()

    fireEvent.click(screen.getByRole('checkbox', { name: VI.shortcuts }))
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5'))
  })
})

describe('where focus goes after navigating (AC 5)', () => {
  const heading = () => screen.getByRole('heading', { level: 2 })

  it('lands on the annotation heading, not back at the top of the page', async () => {
    await surface()

    fireEvent.click(control(VI.nextPly))

    await waitFor(() => expect(heading()).toHaveFocus())
  })

  it('does not steal focus when the page is merely opened', async () => {
    await surface({ line: ['fxe5'] })

    expect(heading()).not.toHaveFocus()
    expect(document.body).toHaveFocus()
  })

  it('lands there after an arrow key too', async () => {
    await surface()

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    await waitFor(() => expect(heading()).toHaveFocus())
  })

  it('lands there after browser back, which is also a move to a different node', async () => {
    const router = await surface({ line: ['fxe5'] })

    fireEvent.click(control(VI.nextPly))
    await waitFor(() => expect(heading()).toHaveFocus())

    await act(async () => {
      await router.navigate(-1)
    })

    await waitFor(() => expect(heading()).toHaveFocus())
  })

  it('is a focus destination, not a tab stop', async () => {
    await surface()

    expect(heading()).toHaveAttribute('tabindex', '-1')
  })
})

describe('the annotation panel (AC 4)', () => {
  it('shows the prose in the active locale', async () => {
    await surface({ locale: 'en' })

    expect(screen.getByText(/White has just offered the knight/)).toBeVisible()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(EN.startingPosition)
    expect(screen.getByRole('link', { name: EN.nextPly })).toBeVisible()
  })

  it('falls back to Vietnamese, marks it, and gives it its own lang', async () => {
    await surface({ locale: 'en', line: ['fxe5'] })

    const prose = screen.getByText(/Ăn mã là nước thua/)
    expect(prose).toHaveAttribute('lang', 'vi')
    expect(within(prose).getByText(en.untranslated?.marker ?? '')).toBeVisible()
  })

  it('does not mark Vietnamese prose on a Vietnamese page', async () => {
    await surface({ locale: 'vi', line: ['fxe5'] })

    expect(screen.getByText(/Ăn mã là nước thua/)).not.toHaveAttribute('lang')
    expect(screen.queryByText(viCatalogue.untranslated.marker)).toBeNull()
  })

  it('has a designed empty state for a node nobody has annotated', async () => {
    await surface({ line: ['Qe7'] })

    expect(screen.getByText(VI.noAnnotation)).toBeVisible()
  })

  it('names the position in its heading, so focus lands on what changed', async () => {
    await surface({ line: ['fxe5', 'Qh5+'] })

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(`${VI.after} 4.Qh5+`)
  })

  it('calls the root the starting position rather than showing a bare number', async () => {
    await surface()

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(VI.startingPosition)
  })
})

describe('the move list (AC 8)', () => {
  const list = () => screen.getByRole('navigation', { name: VI.plyList })

  it('shows every ply of the current path, numbered the way a scoresheet is', async () => {
    await surface({ line: MAIN_LINE })

    expect(
      within(list())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toStrictEqual([
      VI.startingPosition,
      '3...fxe5',
      '4.Qh5+',
      '4...Ke7',
      '5.Qxe5+',
      '5...Kf7',
      '6.Bc4+',
    ])
  })

  it('marks the current ply for assistive technology', async () => {
    await surface({ line: ['fxe5', 'Qh5+'] })

    expect(within(list()).getByRole('link', { name: '4.Qh5+' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(list()).getByRole('link', { name: '3...fxe5' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('marks the start when that is where the learner is', async () => {
    await surface()

    expect(within(list()).getByRole('link', { name: VI.startingPosition })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('jumps to a ply when one is clicked', async () => {
    const router = await surface({ line: MAIN_LINE })

    fireEvent.click(within(list()).getByRole('link', { name: '4.Qh5+' }))

    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5_Qh5%2B'))
  })

  it('is made of links, so any ply on the path can be shared', async () => {
    await surface({ line: MAIN_LINE })

    for (const link of within(list()).getAllByRole('link')) {
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href')
    }
  })
})

describe('a line that is not in this gambit', () => {
  it('recovers to the nearest node, names the ply, and still shows a position', async () => {
    await surface({ line: ['fxe5', 'Qh4+', 'Ke7'] })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(VI.branchNotFound)
    expect(alert).toHaveTextContent('Qh4+')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('3...fxe5')
    expect(screen.getByRole('grid')).toBeVisible()
  })

  it('self-heals: the next press writes a URL that is valid', async () => {
    const router = await surface({ line: ['fxe5', 'Qh4+'] })

    fireEvent.click(control(VI.nextPly))

    await waitFor(() => expect(router.state.location.search).toBe('?line=fxe5_Qh5%2B'))
  })

  it('says nothing when the whole path was followed', async () => {
    await surface({ line: MAIN_LINE })

    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('the board it puts in front of the learner', () => {
  it('shows the position of the node the URL names', async () => {
    await surface({ line: ['fxe5', 'Qh5+'] })

    // The white queen has arrived on h5 in this position and nowhere earlier.
    expect(screen.getByRole('gridcell', { name: /h5/ })).toHaveAccessibleName(
      `h5, ${viCatalogue.board.whiteQueen}`,
    )
  })

  it('puts the learner side at the bottom', async () => {
    await surface()

    // White is the learner here; a1 is the bottom-left cell of a white-oriented board.
    const cells = screen.getAllByRole('gridcell')
    expect(cells[0]).toHaveAccessibleName(/^a8/)
    expect(cells[cells.length - 1]).toHaveAccessibleName(/^h1/)
  })

  it('announces the ply that produced the position, including what it does', async () => {
    await surface({ line: ['fxe5', 'Qh5+'] })

    expect(screen.getByRole('status')).toHaveTextContent(`Qh5+, ${VI.check}`)
  })

  it('says nothing at the root, where no ply has been played', async () => {
    await surface()

    expect(screen.getByRole('status')).toHaveTextContent('')
  })
})

describe('while the tree is still arriving, and when it never does', () => {
  it('reserves the board box rather than collapsing the page', async () => {
    // A request that never settles, so the state under test cannot be raced past.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )
    renderGambit()

    expect(await screen.findByText(VI.loading)).toBeVisible()
  })

  it('shows the designed failure and keeps the heading', async () => {
    serve(null)
    renderGambit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MAPPED_ENTRY.id)
  })

  it('names the gambit once the tree has arrived', async () => {
    await surface()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MAPPED_ENTRY.name)
  })
})

/**
 * The feature the product exists for, through the whole surface: the URL, the keyboard and
 * the choices, wired to each other rather than each tested against a stub.
 */
const choice = (name: RegExp) => screen.getByRole('link', { name })

describe('choosing a reply (AC 5)', () => {
  it('renders every modelled reply at a branch point, not just the first', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en' })

    for (const ply of ['Ba5', 'Bc5', 'Be7', 'Bd6']) {
      expect(choice(new RegExp(ply))).toBeVisible()
    }
  })

  it('navigates into the branch and writes it into the URL', async () => {
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en' })

    fireEvent.click(choice(/Be7/))

    await waitFor(() => expect(router.state.location.search).toBe(lineSearch(['Be7'])))
  })

  it('moves focus to what changed, exactly as every other route to a node does', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en' })

    fireEvent.click(choice(/Bd6/))

    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveFocus())
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('5...Bd6')
  })

  it('agrees with next about which reply next leads to', async () => {
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en' })
    const marked = choice(/Ba5/)

    expect(within(marked).getByText(EN.nextGoesHere)).toBeVisible()
    fireEvent.click(control(EN.nextPly))

    await waitFor(() => expect(router.state.location.search).toBe(lineSearch(['Ba5'])))
  })

  it('offers the omissions at a node with a single modelled reply, where there is no branch', async () => {
    const singleReply: CompiledEntry = {
      ...EVANS_ENTRY,
      tree: {
        ...EVANS_ENTRY.tree,
        children: (EVANS_ENTRY.tree.children ?? []).slice(0, 1),
      },
    }
    await surface({ entry: singleReply, locale: 'en' })

    expect(screen.getAllByRole('link', { name: /Ba5/ })).toHaveLength(1)
    // The catch-all is not a branch-point feature: this node has one reply and 28 answers.
    expect(screen.getByText(EN.coveredReplies)).toBeInTheDocument()
  })

  it('says nothing about replies at a learner node with a single prescribed move', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en', line: ['Bc5'] })

    expect(screen.queryByText(EN.branchHeading)).toBeNull()
    expect(screen.queryByText(EN.planHeading)).toBeNull()
  })
})

/**
 * AC 6. Nine keys, and — the half that matters — the rest of the branches reachable
 * without them. A numeric shortcut is never the only route to a branch.
 */
describe('the number keys (AC 6)', () => {
  it('selects the first branch on 1 and the second on 2', async () => {
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en' })

    fireEvent.keyDown(window, { key: '2' })

    await waitFor(() => expect(router.state.location.search).toBe(lineSearch(['Bc5'])))
  })

  it('reaches the ninth and stops there', async () => {
    const router = await surface({ entry: WIDE_ENTRY, locale: 'en' })

    fireEvent.keyDown(window, { key: '9' })

    await waitFor(() => expect(router.state.location.search).toBe(lineSearch(['d5'])))
  })

  it('leaves the tenth, eleventh and twelfth reachable by link, with a real href', async () => {
    await surface({ entry: WIDE_ENTRY, locale: 'en' })

    for (const ply of ['Bd4', 'Be3', 'Bxf2+']) {
      const link = choice(new RegExp(ply.replace('+', '\\+')))
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href')
      expect(within(link).queryByText(/^\d+$/)).toBeNull()
    }
  })

  it('draws a key cap on exactly the branches a key reaches', async () => {
    await surface({ entry: WIDE_ENTRY, locale: 'en' })

    const caps = [...document.querySelectorAll('.choice-link__shortcut')].map((k) => k.textContent)
    expect(caps).toStrictEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(document.querySelectorAll('.choice-link--reply')).toHaveLength(12)
  })

  it('does nothing on 0, which is not one of the nine', async () => {
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en' })

    fireEvent.keyDown(window, { key: '0' })

    expect(router.state.location.search).toBe('')
  })

  it('does nothing where there is no branch to choose', async () => {
    const router = await surface({ line: ['fxe5'] })

    fireEvent.keyDown(window, { key: '1' })

    expect(router.state.location.search).toBe(lineSearch(['fxe5']))
  })

  /**
   * WCAG 2.2 *2.1.4 Character Key Shortcuts* is Level A, and `1`-`9` are the character keys
   * it is actually about — the arrow keys are not. So the switch has to reach them, and it
   * has to take the key caps with it: a cap printed on a control that no key reaches is a
   * promise the page does not keep.
   */
  it('is switched off by the same setting the arrow keys read, key caps and all', async () => {
    window.localStorage.setItem(shortcutStorageKey, 'off')
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en' })

    fireEvent.keyDown(window, { key: '2' })

    expect(router.state.location.search).toBe('')
    expect(document.querySelectorAll('.choice-link__shortcut')).toHaveLength(0)
    expect(choice(/Bc5/)).toHaveAttribute('href')
  })

  it('leaves the shortcut alone when focus is inside the board grid', async () => {
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en' })
    const cell = screen.getAllByRole('gridcell')[0]

    fireEvent.keyDown(cell ?? window, { key: '2' })

    expect(router.state.location.search).toBe('')
  })

  it('ignores a digit that carries a modifier, so browser tab-switching still works', async () => {
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en' })

    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    fireEvent.keyDown(window, { key: '2', metaKey: true })

    expect(router.state.location.search).toBe('')
  })
})

/**
 * AC 7. The Evans after `5...Ba5`, where `6.d4` and `6.O-O` are both main lines.
 *
 * These are the learner's options, not the opponent's threats, and the difference is
 * carried by the words and the markup rather than only by a colour.
 */
describe('a learner node with more than one plan (AC 7)', () => {
  it('renders the plans', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en', line: PLAN_LINE })

    expect(screen.getByText(EN.planHeading)).toBeVisible()
    expect(choice(/6\.d4/)).toBeVisible()
    expect(choice(/6\.O-O/)).toBeVisible()
    expect(document.querySelectorAll('.choice-link--plan')).toHaveLength(2)
  })

  it('is not the opponent-replies region, and does not borrow its wording', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en', line: PLAN_LINE })

    expect(screen.queryByText(EN.branchHeading)).toBeNull()
    expect(document.querySelector('.branch-choices')).toBeNull()
    expect(document.querySelectorAll('.choice-link--reply')).toHaveLength(0)
    expect(screen.getByText(EN.planNote)).toBeVisible()
  })

  it('grades nothing: a prescribed move has no reply quality to show', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en', line: PLAN_LINE })

    expect(document.querySelectorAll('.quality-badge')).toHaveLength(0)
    expect(document.querySelectorAll('.frequency-tag')).toHaveLength(0)
  })

  it('navigates into the plan the learner picks', async () => {
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en', line: PLAN_LINE })

    fireEvent.click(choice(/6\.O-O/))

    await waitFor(() => expect(router.state.location.search).toBe(lineSearch(['Ba5', 'O-O'])))
  })

  it('is reachable by its own number key', async () => {
    const router = await surface({ entry: EVANS_ENTRY, locale: 'en', line: PLAN_LINE })

    fireEvent.keyDown(window, { key: '2' })

    await waitFor(() => expect(router.state.location.search).toBe(lineSearch(['Ba5', 'O-O'])))
  })
})

/**
 * AC 9. The choice control is in the tab order; the picture inside it is not.
 *
 * jsdom does not implement `inert`, so what is asserted here is that the attribute is on
 * the element — the behaviour it produces is measured in a real browser by
 * `e2e/branch-choices.spec.ts`, which tabs through the page and checks where focus lands.
 */
describe('preview boards are out of the way (AC 9)', () => {
  it('marks every preview inert and hidden from assistive technology', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en' })

    const previews = [...document.querySelectorAll('.board-preview')]
    expect(previews).toHaveLength(4)
    for (const preview of previews) {
      expect(preview).toHaveAttribute('inert')
      expect(preview).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('leaves exactly one board in the accessibility tree — the position being studied', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en' })

    expect(screen.getAllByRole('grid')).toHaveLength(1)
    expect(screen.getAllByRole('gridcell')).toHaveLength(64)
  })

  it('puts the choice itself in the tab order instead', async () => {
    await surface({ entry: EVANS_ENTRY, locale: 'en' })

    const link = choice(/Ba5/)
    link.focus()
    expect(link).toHaveFocus()
  })
})

/**
 * Where a line ends (#11), wired into the surface.
 *
 * `OutcomeCard.test.tsx` holds the three components; what is asserted here is the one
 * condition this file owns — a leaf's outcome is drawn, and a position that is still in the
 * middle of a line draws nothing. A card that appeared mid-line would be telling a learner
 * that the position they are standing in is where the line ends.
 */
describe('what the line ends in (#11)', () => {
  const ENDINGS = [
    { what: 'a proved mate', line: OUTCOME_MATE_LINE, card: '.mate-outcome' },
    { what: 'an assessed position', line: OUTCOME_ASSESSMENT_LINE, card: '.assessment-outcome' },
    { what: 'an unmapped branch', line: OUTCOME_UNEXPLORED_LINE, card: '.unexplored-outcome' },
  ]

  it.each(ENDINGS)('draws $what at the leaf that carries it', async ({ line, card }) => {
    await surface({ entry: OUTCOMES_ENTRY, locale: 'en', line })

    expect(document.querySelector(card)).not.toBeNull()
    // And only that one: the three cards never appear together.
    expect(document.querySelectorAll('section[class$="-outcome"]')).toHaveLength(1)
  })

  it('draws nothing at a position the line runs on from', async () => {
    await surface({ entry: OUTCOMES_ENTRY, locale: 'en', line: OUTCOME_MATE_LINE.slice(0, 2) })

    expect(document.querySelectorAll('section[class$="-outcome"]')).toHaveLength(0)
    expect(document.querySelector('.provenance')).toBeNull()
  })

  it('draws it below the replies and above the move list, where §1 puts it', async () => {
    await surface({ entry: OUTCOMES_ENTRY, locale: 'en', line: OUTCOME_MATE_LINE })

    const context = document.querySelector('.learning-surface__context')
    const order = [...(context?.children ?? [])].map((child) => child.className)
    expect(order.findIndex((name) => name.includes('mate-outcome'))).toBeLessThan(
      order.findIndex((name) => name.includes('move-list')),
    )
  })

  it('plays the proved line from the leaf, not from wherever the board happens to be', async () => {
    await surface({ entry: OUTCOMES_ENTRY, locale: 'en', line: OUTCOME_MATE_LINE })

    // 6...Bxd1 was the last ply played, so the proof runs 7.Bxf7+ onwards.
    expect([...document.querySelectorAll('.mate-net__ply')].map((li) => li.textContent)).toEqual([
      '7.Bxf7+',
      '7...Ke7',
      '8.Nd5#',
    ])
  })
})

/**
 * **What changed, on every board that shows a move (issue #54).**
 *
 * `Board` has drawn a last-ply highlight since #4 — tinted squares plus a dashed ring on
 * the square the ply left and a solid one on the square it reached — behind an optional
 * `lastMove` prop that no caller passed for four waves. So these assertions are deliberately
 * about the *surface* and not about `Board`: a test that handed `Board` a move and checked
 * it drew one would have passed on every day of those four waves.
 *
 * `last-ply.test.ts` holds the other end — that no board anywhere in `src/` is mounted
 * without the prop, so a fifth wave cannot reopen the gap by adding a caller.
 */
describe('the ply that produced the position', () => {
  const FILES = 'abcdefgh'

  /**
   * Which square a highlight sits on, read back off the rect's own geometry.
   *
   * Off its `x`/`y` rather than off its index among the 64 squares, because the index would
   * agree with a board that drew the ring in the right slot of the wrong board — and
   * because the arithmetic here is the inverse of the arithmetic the component does, so a
   * ring drawn half a square out fails rather than rounding into the right answer. Both
   * fixtures used below are White entries, so the board is unflipped: file a is at x=0 and
   * rank 8 at y=0.
   */
  const squareOf = (rect: Element): string => {
    const x = Math.round(Number(rect.getAttribute('x')) - 0.06)
    const y = Math.round(Number(rect.getAttribute('y')) - 0.06)
    return `${FILES[x] ?? '?'}${8 - y}`
  }

  /** `f6-e5`, or the empty string for a board that marks nothing. */
  const marks = (board: Element | null | undefined): string => {
    const from = board?.querySelector('.board__last-ply--from') ?? null
    const to = board?.querySelector('.board__last-ply--to') ?? null
    return from === null || to === null ? '' : `${squareOf(from)}-${squareOf(to)}`
  }

  const mainBoard = () => document.querySelector('.learning-surface__board')
  const previews = () => [...document.querySelectorAll('.choice-link .board-preview')]

  it('marks the two squares the ply used (AC 1)', async () => {
    await surface({ line: ['fxe5'] })

    // 3...fxe5: the pawn left f6 and arrived on e5, capturing the knight that was there.
    expect(marks(mainBoard())).toBe('f6-e5')
  })

  it('tells the square left from the square reached, and not only by colour', async () => {
    await surface({ line: ['fxe5'] })
    const board = mainBoard()

    expect(board?.querySelectorAll('.board__square--from')).toHaveLength(1)
    expect(board?.querySelectorAll('.board__square--to')).toHaveLength(1)
    expect(board?.querySelectorAll('.board__last-ply')).toHaveLength(2)
  })

  it('marks nothing at the root, where nothing has been stepped to (AC 2)', async () => {
    await surface()

    expect(mainBoard()?.querySelectorAll('.board__last-ply')).toHaveLength(0)
  })

  it('marks the ply that produced *that* position when stepping back (AC 2)', async () => {
    await surface({ line: ['fxe5', 'Qh5+'] })
    expect(marks(mainBoard())).toBe('d1-h5')

    fireEvent.click(control(VI.previousPly))
    await waitFor(() => expect(marks(mainBoard())).toBe('f6-e5'))

    fireEvent.click(control(VI.previousPly))
    await waitFor(() => expect(mainBoard()?.querySelectorAll('.board__last-ply')).toHaveLength(0))
  })

  /**
   * AC 3, and the case that decided it. Every reply to 5.c3 is the same bishop leaving the
   * same square, so four previews differ from one another by one piece on one square — the
   * hardest find-the-difference on the site, repeated once per reply. Unmarked they are four
   * near-identical pictures; marked, each says where its own bishop went.
   */
  it('marks each preview with its own candidate reply (AC 3)', async () => {
    await surface({ entry: EVANS_ENTRY })

    expect(previews().map(marks)).toStrictEqual(['b4-a5', 'b4-c5', 'b4-e7', 'b4-d6'])
  })

  it('marks a plan the same way, castling included', async () => {
    await surface({ entry: EVANS_ENTRY, line: PLAN_LINE })

    // 6.O-O moves two pieces; the highlight names the king's two squares, as SAN does.
    expect(previews().map(marks)).toStrictEqual(['d2-d4', 'e1-g1'])
  })

  /**
   * The one board that marks nothing on purpose. `MateNet`'s board is an anchor for a line
   * played *from* the position, and it repeats the position the main board is already
   * showing — so the decision there is "none", stated in the call rather than fallen into.
   */
  it('leaves the mate net’s board unmarked, and the main board marked', async () => {
    await surface({ entry: OUTCOMES_ENTRY, locale: 'en', line: OUTCOME_MATE_LINE })
    const net = document.querySelector('.mate-net .board-preview')

    expect(net).not.toBeNull()
    expect(net?.querySelectorAll('.board__last-ply')).toHaveLength(0)
    // 6...Bxd1 — the bishop came from h5, where 4...Bh5 put it earlier in this line.
    expect(marks(mainBoard())).toBe('h5-d1')
  })
})
