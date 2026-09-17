import { render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAIN_LINE, MAPPED_ENTRY } from './components/learn/learn-fixtures'
import { storedLocaleKey } from './lib/locale'
import { lineSearch } from './lib/line'
import viCatalogue from './locales/vi'
import { routes } from './router'

const setBrowserLanguages = (languages: readonly string[]): void => {
  Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true })
}

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  window.localStorage.clear()
  setBrowserLanguages(['en-US'])
})

afterEach(() => {
  window.localStorage.clear()
})

describe('the route tree', () => {
  it('renders the home route for a locale', async () => {
    renderAt('/vi/')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Chess Gambit Trainer',
    )
  })

  it('renders the home route without the trailing slash too', async () => {
    renderAt('/vi')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Chess Gambit Trainer',
    )
  })

  it('renders the catalogue route', async () => {
    renderAt('/en/gambits')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Catalogue')
  })

  it('renders the about route', async () => {
    renderAt('/fr/about')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('About')
  })

  it('renders a gambit route and names the gambit', async () => {
    renderAt('/vi/gambits/evans-gambit')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('evans-gambit')
  })

  it('renders not-found for an unknown path', async () => {
    renderAt('/vi/gambits/evans-gambit/extra/segments')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Page not found')
  })
})

describe('an unknown locale', () => {
  it('renders not-found rather than a blank page', async () => {
    renderAt('/de/about')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Page not found')
  })

  it('does so on every route under it', async () => {
    for (const path of ['/de/', '/de/gambits', '/de/gambits/evans-gambit']) {
      const { unmount } = render(
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />,
      )
      expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Page not found')
      unmount()
    }
  })

  it('offers a way back into the site', async () => {
    renderAt('/xx/')

    expect(await screen.findByRole('link', { name: 'Go to the catalogue' })).toBeVisible()
  })
})

describe('the locale-less root', () => {
  it('redirects to the browser preference', async () => {
    setBrowserLanguages(['fr-FR', 'en'])
    const router = renderAt('/')

    await waitFor(() => expect(router.state.location.pathname).toBe('/fr/'))
  })

  it('falls back to Vietnamese for a language the site does not have', async () => {
    setBrowserLanguages(['de-DE'])
    const router = renderAt('/')

    await waitFor(() => expect(router.state.location.pathname).toBe('/vi/'))
  })

  it('redirects once, replacing rather than stacking a history entry', async () => {
    setBrowserLanguages(['fr-FR'])
    const router = renderAt('/')

    await waitFor(() => expect(router.state.location.pathname).toBe('/fr/'))
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('remembers the resolution', async () => {
    setBrowserLanguages(['fr-FR'])
    const router = renderAt('/')

    await waitFor(() => expect(router.state.location.pathname).toBe('/fr/'))
    expect(window.localStorage.getItem(storedLocaleKey)).toBe('fr')
  })

  it('honours the remembered locale over the browser on a return visit', async () => {
    window.localStorage.setItem(storedLocaleKey, 'vi')
    setBrowserLanguages(['fr-FR'])
    const router = renderAt('/')

    await waitFor(() => expect(router.state.location.pathname).toBe('/vi/'))
  })
})

describe('the line parameter on a gambit route', () => {
  /*
   * #8 replaced the gambit route's placeholder with the learning surface, so the parsed
   * line is now read back off the move list — which is the real claim anyway: what matters
   * is that a shared link puts the learner on the node it names, not that some element
   * holds the right string. The tree is served from a fixture so these stay tests of the
   * router and the URL rather than of what happens to be in `content/`.
   */
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ...MAPPED_ENTRY, id: 'evans-gambit' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  const plies = async () => {
    const list = await screen.findByRole('navigation', { name: viCatalogue.learn.plyList })
    return within(list)
      .getAllByRole('link')
      .map((link) => link.textContent)
  }

  /** Which entry in the move list is marked current — that is, which position is on screen. */
  const currentPly = async (): Promise<string | null> => {
    const list = await screen.findByRole('navigation', { name: viCatalogue.learn.plyList })
    const marked = within(list)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'true')
    expect(marked).toHaveLength(1)
    return marked[0]?.textContent ?? null
  }

  /**
   * The defining line of the entry served as `evans-gambit` here, as the move list numbers
   * it. Since #70 the list starts at the initial position and walks the defining line before
   * the `?line=` path, so these five labels precede every path below (AC 1).
   */
  const DEFINING = ['1.e4', '1...e5', '2.Nf3', '2...f6', '3.Nxe5']

  /*
   * The Damiano refutation rather than the mate fixture, since #46. A `+` is the form encoding
   * for a space, so a path carrying one is the path that proves the parameter is encoded and
   * decoded rather than merely passed along — and this line carries three. A `#` cannot appear
   * in any path at all: a mate is claimed on the leaf *before* the mating move, so the mating
   * move is a ply in the proof and never a node with a URL. The unencoded `#` is still covered,
   * as the corruption it causes, by `line.test.ts` and `e2e/line-parameter.spec.ts`.
   */
  it('restores a path whose plies carry checks', async () => {
    renderAt(`/vi/gambits/evans-gambit${lineSearch(MAIN_LINE)}`)

    expect(await plies()).toStrictEqual([
      viCatalogue.learn.startingPosition,
      ...DEFINING,
      '3...fxe5',
      '4.Qh5+',
      '4...Ke7',
      '5.Qxe5+',
      '5...Kf7',
      '6.Bc4+',
    ])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('recovers to the nearest valid node and says what was wrong', async () => {
    renderAt('/vi/gambits/evans-gambit?line=e4_e5_not-a-move_Nf3')

    // `e4` and `e5` read as SAN, so the parser keeps them and stops at the third segment;
    // the tree then rejects `e4` as well, and the page says both things rather than one.
    expect(await plies()).toStrictEqual([viCatalogue.learn.startingPosition, ...DEFINING])
    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent ?? '')
    expect(alerts.join(' ')).toContain('not-a-move')
    expect(alerts.join(' ')).toContain(viCatalogue.learn.branchNotFound)
  })

  /**
   * **AC 3, at the router.** A URL with no parameters is every published link to a gambit's
   * own page, and it still names the gambit root: the move list now shows the defining line
   * that reaches it, and the position marked current is the end of that line, not its start.
   */
  it('reads a missing parameter as the gambit root', async () => {
    renderAt('/vi/gambits/evans-gambit')

    expect(await plies()).toStrictEqual([viCatalogue.learn.startingPosition, ...DEFINING])
    expect(await currentPly()).toBe('3.Nxe5')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  /** And the new half: a `prelude` count stands inside the defining line, not at its end. */
  it('reads a prelude count as a position inside the defining line', async () => {
    renderAt('/vi/gambits/evans-gambit?prelude=2')

    expect(await plies()).toStrictEqual([viCatalogue.learn.startingPosition, '1.e4', '1...e5'])
    expect(await currentPly()).toBe('1...e5')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  /**
   * A `prelude` that is not a count is reported and the page falls back to the root, which is
   * where a link with no `prelude` has always landed. It never becomes a blank page.
   */
  it('reports a prelude that is not a count and shows the gambit root', async () => {
    renderAt('/vi/gambits/evans-gambit?prelude=../../etc')

    expect(await plies()).toStrictEqual([viCatalogue.learn.startingPosition, ...DEFINING])
    expect(await currentPly()).toBe('3.Nxe5')
    expect(screen.getByRole('alert').textContent ?? '').toContain('../../etc')
  })
})
