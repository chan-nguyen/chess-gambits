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
import { MAIN_LINE, MAPPED_ENTRY } from './learn-fixtures.ts'
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

type Options = { readonly locale?: Locale; readonly line?: readonly string[] }

const renderGambit = ({ locale = 'vi', line = [] }: Options = {}) => {
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
    { initialEntries: [`/${locale}/gambits/${MAPPED_ENTRY.id}${lineSearch(line)}`] },
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
