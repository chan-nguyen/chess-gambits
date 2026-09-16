import { cleanup, render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import viStrings from '../../locales/vi.ts'
import { routes } from '../../router.tsx'
import { fixtureCatalogue } from './catalogue-fixtures.ts'
import { numberedPlies } from './defining-line.ts'

/**
 * **Requirement F15 / AC 8**, through the real gambit route: opening a Tier 0 entry shows
 * its identity and its moves plus a designed "not yet taught in depth" state — never an
 * empty tree, never a spinner, never a 404.
 *
 * This is not an edge case. Six hundred and ninety-nine of this site's seven hundred
 * entries have no content file, so the path exercised here is the one a visitor who
 * searched for a gambit they know will almost certainly take.
 *
 * The stub answers by URL rather than answering everything the same way, because the whole
 * mechanism under test is what happens when the *content* request 404s and the *catalogue*
 * request does not.
 */

const strings = viStrings.emptyTree

const serve = (options: { readonly content?: unknown; readonly catalogue?: unknown }): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/catalogue/') ? options.catalogue : options.content

      return Promise.resolve(
        body === undefined
          ? new Response('<!doctype html><title>404</title>', { status: 404 })
          : new Response(JSON.stringify(body), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
      )
    }),
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

describe('numbering a defining line', () => {
  it('numbers it the way a scoresheet does', () => {
    expect(numberedPlies('e4 e5 Nf3 f6 Nxe5')).toEqual([
      '1.e4',
      '1...e5',
      '2.Nf3',
      '2...f6',
      '3.Nxe5',
    ])
  })

  it('survives a line with awkward spacing rather than emitting a blank move', () => {
    expect(numberedPlies('  d4   Nf6 ')).toEqual(['1.d4', '1...Nf6'])
    expect(numberedPlies('')).toEqual([])
  })

  /** SAN is SAN in all three locales (§7); there is nothing here to translate. */
  it('leaves the notation exactly as the dataset wrote it', () => {
    expect(numberedPlies('Bxf7+ Kxf7 Qd5+')).toEqual(['1.Bxf7+', '1...Kxf7', '2.Qd5+'])
  })
})

describe('opening an entry that is listed but not taught', () => {
  const open = async () => {
    serve({ catalogue: fixtureCatalogue() })
    renderAt('/vi/gambits/kings-gambit')
    return await screen.findByRole('main')
  }

  it('names the gambit in the heading rather than echoing its address', async () => {
    const main = await open()
    await within(main).findByText(strings.notTaught)

    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent('Gambit Vua')
  })

  it('says it is not taught in depth, and says what is here instead', async () => {
    const main = await open()

    expect(await within(main).findByText(strings.notTaught)).toBeInTheDocument()
    expect(within(main).getByText(strings.explain)).toBeInTheDocument()
  })

  it('shows the identity the catalogue does have', async () => {
    const main = await open()
    await within(main).findByText(strings.notTaught)

    expect(main).toHaveTextContent('C30')
    expect(main).toHaveTextContent(viStrings.catalogue.white)
  })

  it('shows the moves that define the line', async () => {
    const main = await open()
    await within(main).findByText(strings.definingLine)

    // The King's Gambit is `e4 e5 f4`, numbered here exactly as a move list numbers it.
    for (const label of numberedPlies('e4 e5 f4')) {
      expect(within(main).getByText(label)).toBeInTheDocument()
    }
  })

  /** AC 9 again: the labels on this page explain themselves, like the ones on a card. */
  it('links its badges to the About page explanation', async () => {
    const main = await open()
    await within(main).findByText(strings.notTaught)

    expect(within(main).getByRole('link', { name: /Không vững/ })).toHaveAttribute(
      'href',
      '/vi/about#soundness',
    )
    expect(within(main).getByRole('link', { name: /Mới liệt kê/ })).toHaveAttribute(
      'href',
      '/vi/about#tiers',
    )
  })

  it('offers the way back to the catalogue', async () => {
    const main = await open()

    expect(
      await within(main).findByRole('link', { name: strings.backToCatalogue }),
    ).toHaveAttribute('href', '/vi/gambits')
  })

  /** The three things AC 8 forbids. None of them is what this page settles on. */
  it('is not an error, a retry or a not-found page', async () => {
    const main = await open()
    await within(main).findByText(strings.notTaught)

    expect(within(main).queryByRole('alert')).toBeNull()
    expect(within(main).queryByRole('button', { name: /again/i })).toBeNull()
    expect(within(main).queryByText(/Page not found/)).toBeNull()
  })
})

describe('opening an address the catalogue has never heard of', () => {
  it('echoes the id back, so a stale shared link is diagnosable', async () => {
    serve({ catalogue: fixtureCatalogue() })
    renderAt('/vi/gambits/not-a-gambit')
    const main = await screen.findByRole('main')

    const alert = await within(main).findByRole('alert')
    expect(alert).toHaveTextContent('not-a-gambit')
  })

  it('still offers the catalogue rather than leaving the visitor at a dead end', async () => {
    serve({ catalogue: fixtureCatalogue() })
    renderAt('/vi/gambits/not-a-gambit')
    const main = await screen.findByRole('main')

    expect(
      await within(main).findByRole('link', { name: strings.backToCatalogue }),
    ).toBeInTheDocument()
  })
})

describe('when the catalogue itself cannot be reached', () => {
  /**
   * A missing content file plus a missing catalogue is a genuine failure and is reported as
   * one — with a retry, because retrying is the thing that can help.
   */
  it('reports the failure and offers a retry', async () => {
    serve({})
    renderAt('/vi/gambits/kings-gambit')
    const main = await screen.findByRole('main')

    const alert = await within(main).findByRole('alert')
    expect(within(alert).getByRole('button')).toBeInTheDocument()
  })
})
