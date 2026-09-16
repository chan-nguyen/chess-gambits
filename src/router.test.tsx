import { render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MATE_ENTRY, MATE_LINE } from './components/learn/learn-fixtures'
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
          new Response(JSON.stringify({ ...MATE_ENTRY, id: 'evans-gambit' }), {
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

  it('restores a path that contains a check and a mate', async () => {
    renderAt(`/vi/gambits/evans-gambit${lineSearch(MATE_LINE)}`)

    expect(await plies()).toStrictEqual([
      viCatalogue.learn.startingPosition,
      '5...Bh5',
      '6.Nxe5',
      '6...Bxd1',
      '7.Bxf7+',
      '7...Ke7',
      '8.Nd5#',
    ])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('recovers to the nearest valid node and says what was wrong', async () => {
    renderAt('/vi/gambits/evans-gambit?line=e4_e5_not-a-move_Nf3')

    // `e4` and `e5` read as SAN, so the parser keeps them and stops at the third segment;
    // the tree then rejects `e4` as well, and the page says both things rather than one.
    expect(await plies()).toStrictEqual([viCatalogue.learn.startingPosition])
    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent ?? '')
    expect(alerts.join(' ')).toContain('not-a-move')
    expect(alerts.join(' ')).toContain(viCatalogue.learn.branchNotFound)
  })

  it('reads a missing parameter as the gambit root', async () => {
    renderAt('/vi/gambits/evans-gambit')

    expect(await plies()).toStrictEqual([viCatalogue.learn.startingPosition])
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
