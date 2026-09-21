import { cleanup, render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fixtureCatalogue,
  nothingTaughtCatalogue,
} from '../components/catalogue/catalogue-fixtures.ts'
import viStrings from '../locales/vi.ts'
import { routes } from '../router.tsx'

/**
 * **AC 7: the home page routes to a taught entry, never to the raw catalogue.**
 *
 * The rule exists because dropping a first-time visitor into seven hundred rows, of which
 * none is a lesson, is the exact failure this product was designed against
 * (docs/design-system.md, *The catalogue defaults to depth, not to breadth*).
 *
 * Both halves are covered, because today only one of them is reachable: there is no taught
 * entry in any locale, so what ships is the honest state — and the link has to appear on
 * its own the day content earns it, without anybody editing this page.
 */

/**
 * Stubs the one fetch this page makes: the catalogue. The home board's own position comes
 * from a `chess.js` instance created synchronously (#131), not from a fetch, so there is
 * nothing left to route by URL here the way #129's version had to.
 */
const respond = (catalogueBody: unknown): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalogueBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('the home page', () => {
  it('keeps the site name as its heading, in every language', async () => {
    respond(fixtureCatalogue())
    renderAt('/fr/')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Chess Gambit Trainer',
    )
  })

  it('explains what this is before it offers anywhere to go', async () => {
    respond(fixtureCatalogue())
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    expect(within(main).getByText(viStrings.home.tagline)).toBeInTheDocument()
    expect(within(main).getByText(viStrings.home.intro)).toBeInTheDocument()
  })
})

describe('when something is taught in depth', () => {
  it('routes straight to that entry rather than to the index', async () => {
    respond(fixtureCatalogue())
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    const start = await within(main).findByRole('link', { name: 'Ván cờ Ý: Gambit Evans' })
    expect(start).toHaveAttribute('href', '/vi/gambits/italian-game-evans-gambit')
  })

  /**
   * The gambit's own name is the link text, not "start here": a screen-reader user running
   * through a page's links hears the names, and "start here" names nothing.
   */
  it('labels the destination with the gambit name, under a heading that says why', async () => {
    respond(fixtureCatalogue())
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    expect(
      await within(main).findByRole('heading', { level: 2, name: viStrings.home.startHere }),
    ).toBeInTheDocument()
  })
})

describe('when nothing is taught in depth yet — the site today', () => {
  it('says so, rather than linking to a gambit that does not exist', async () => {
    respond(nothingTaughtCatalogue())
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    expect(await within(main).findByText(viStrings.home.nothingTaughtYet)).toBeInTheDocument()
    // No "start here" heading: that one only appears once something is actually taught.
    // The opening explorer's own `h2` (issue #129) is unconditional and expected here.
    expect(
      within(main).queryByRole('heading', { level: 2, name: viStrings.home.startHere }),
    ).toBeNull()
  })

  it('still offers the index to anybody who wants it anyway', async () => {
    respond(nothingTaughtCatalogue())
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    expect(
      within(main).getByRole('link', { name: viStrings.home.browseCatalogue }),
    ).toHaveAttribute('href', '/vi/gambits')
  })

  it('links to what the coverage tiers mean, which is what makes the number honest', async () => {
    respond(nothingTaughtCatalogue())
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    expect(within(main).getByRole('link', { name: viStrings.home.whatTiersMean })).toHaveAttribute(
      'href',
      '/vi/about#tiers',
    )
  })
})

describe('when the catalogue cannot be reached at all', () => {
  /**
   * Deliberately quiet. Nothing on this page failed to *render*; a sentence failed to be
   * added, and an error banner over the paragraph explaining what the site is would make a
   * first visit read as a broken product. The catalogue page is where the failure is named
   * and where a retry can do something.
   */
  it('says nothing about coverage rather than putting an error over the introduction', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 503 }))),
    )
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    expect(within(main).getByText(viStrings.home.intro)).toBeInTheDocument()
    expect(within(main).queryByRole('alert')).toBeNull()
    expect(within(main).queryByText(viStrings.home.nothingTaughtYet)).toBeNull()
  })

  it('still offers the catalogue, which is where the failure can be acted on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 503 }))),
    )
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    expect(
      await within(main).findByRole('link', { name: viStrings.home.browseCatalogue }),
    ).toBeInTheDocument()
  })
})

describe('before the catalogue has answered', () => {
  /**
   * Nothing on this page waits for the fetch. Stating "nothing is taught yet" while the
   * file is still in flight would assert something the page does not know and then take it
   * back a moment later.
   */
  it('renders its own copy without claiming anything about coverage', async () => {
    // A fetch that never settles, which is what a dropped mobile connection looks like.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )
    renderAt('/vi/')
    const main = await screen.findByRole('main')

    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Chess Gambit Trainer',
    )
    expect(within(main).getByText(viStrings.home.intro)).toBeInTheDocument()
    expect(within(main).queryByText(viStrings.home.nothingTaughtYet)).toBeNull()
  })
})
