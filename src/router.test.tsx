import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { storedLocaleKey } from './lib/locale'
import { lineSearch } from './lib/line'
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
  it('restores a path that contains a check and a mate', async () => {
    const plies = ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#']
    renderAt(`/vi/gambits/evans-gambit${lineSearch(plies)}`)

    expect(await screen.findByTestId('line-plies')).toHaveTextContent(plies.join(' '))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('recovers to the nearest valid node and says what was wrong', async () => {
    renderAt('/vi/gambits/evans-gambit?line=e4_e5_not-a-move_Nf3')

    expect(await screen.findByTestId('line-plies')).toHaveTextContent('e4 e5')
    expect(screen.getByRole('alert')).toHaveTextContent('not-a-move')
  })

  it('reads a missing parameter as the gambit root', async () => {
    renderAt('/vi/gambits/evans-gambit')

    expect(await screen.findByTestId('line-plies')).toHaveTextContent('the gambit root')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
