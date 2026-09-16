import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import compiledEntry from '../../../tools/content/fixtures/compiled/taught-entry.json?raw'
import type { EntryLoad, EntryLoadFailure } from '../../lib/content'
import { loadEntry } from '../../lib/content'
import { ContentLoadError } from './ContentLoadError'

/**
 * AC 5. A failed content fetch renders a designed state that names what failed, offers a
 * retry, and leaves the rest of the page usable.
 *
 * The second half of that is asserted against a page, not against the component in
 * isolation, because "leaves the header, footer and language switcher usable" is a claim
 * about what the component *does not* do. A full-page takeover would satisfy every
 * assertion about the error text and still be the failure this state exists to prevent.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** The four failures that carry nothing but their reason; `unavailable` also carries a status. */
type PlainReason = 'offline' | 'missing' | 'malformed' | 'unknown-id'

const failure = (reason: PlainReason): EntryLoadFailure => ({ reason })

/** Typed rather than asserted, so `reason` stays the closed set without an `as const`. */
const WORDING: readonly (readonly [PlainReason, string])[] = [
  ['offline', 'the connection dropped'],
  ['missing', 'older version of the site'],
  ['malformed', 'arrived damaged'],
  ['unknown-id', 'not an address this site can look up'],
]

describe('what it says', () => {
  it('names the thing that failed, in the heading', () => {
    render(<ContentLoadError what="Evans Gambit" failure={failure('offline')} onRetry={() => {}} />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Could not load Evans Gambit',
    )
  })

  it('announces itself, so a screen-reader user is not left on a silent page', () => {
    render(<ContentLoadError what="Evans Gambit" failure={failure('offline')} onRetry={() => {}} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  /** "Errors are specific" (docs/design-system.md §4): three problems, three next steps. */
  it.each(WORDING)('tells a %s failure apart from the others', (reason, says) => {
    render(<ContentLoadError what="Evans Gambit" failure={failure(reason)} onRetry={() => {}} />)

    expect(screen.getByRole('alert')).toHaveTextContent(says)
  })

  it('reports the status when the site answered with one', () => {
    render(
      <ContentLoadError
        what="Evans Gambit"
        failure={{ reason: 'unavailable', status: 503 }}
        onRetry={() => {}}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('(503)')
  })
})

describe('the retry it offers', () => {
  it('calls back when pressed', () => {
    const onRetry = vi.fn()
    render(<ContentLoadError what="Evans Gambit" failure={failure('offline')} onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('is reachable and operable from the keyboard', () => {
    const onRetry = vi.fn()
    render(<ContentLoadError what="Evans Gambit" failure={failure('offline')} onRetry={onRetry} />)
    const button = screen.getByRole('button', { name: 'Try again' })

    act(() => button.focus())
    expect(button).toHaveFocus()
    // A real <button>, so Enter and Space activate it without any handler of ours.
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('says it is working and does not fire twice while it is', () => {
    const onRetry = vi.fn()
    render(
      <ContentLoadError
        what="Evans Gambit"
        failure={failure('offline')}
        onRetry={onRetry}
        retrying
      />,
    )
    const button = screen.getByRole('button', { name: 'Trying again…' })

    fireEvent.click(button)

    expect(onRetry).not.toHaveBeenCalled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  /**
   * `aria-disabled` rather than `disabled`: a disabled button leaves the tab order, which
   * throws a keyboard user's focus back to the top of the page at the exact moment they
   * are waiting for something to finish.
   */
  it('keeps focus while it is working', () => {
    const { rerender } = render(
      <ContentLoadError what="Evans Gambit" failure={failure('offline')} onRetry={() => {}} />,
    )
    const button = screen.getByRole('button')
    act(() => button.focus())

    rerender(
      <ContentLoadError
        what="Evans Gambit"
        failure={failure('offline')}
        onRetry={() => {}}
        retrying
      />,
    )

    expect(screen.getByRole('button')).toHaveFocus()
  })
})

/**
 * A page with the three things AC 5 says must survive: a header with navigation, a language
 * switcher, and a footer. The gambit region is the only part that loads anything, and it is
 * wired to the real loader rather than to a stub, so this exercises the whole failure path.
 */
const GambitRegion = ({ id }: { readonly id: string }) => {
  const [result, setResult] = useState<EntryLoad | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    let live = true
    void loadEntry(id).then((next) => {
      if (!live) return
      setResult(next)
      setRetrying(false)
    })
    return () => {
      live = false
    }
    // `attempt` is the retry: bumping it re-runs the effect without a page reload.
  }, [id, attempt])

  if (result === undefined) return <p>Loading…</p>
  if (result.ok) return <h2>{result.entry.name}</h2>

  return (
    <ContentLoadError
      what={id}
      failure={result.failure}
      retrying={retrying}
      onRetry={() => {
        setRetrying(true)
        setAttempt(attempt + 1)
      }}
    />
  )
}

const Page = ({ id }: { readonly id: string }) => {
  const [locale, setLocale] = useState('vi')

  return (
    <>
      <header>
        <nav aria-label="Main">
          <a href="/vi/gambits">Catalogue</a>
        </nav>
        <button type="button" onClick={() => setLocale(locale === 'vi' ? 'fr' : 'vi')}>
          Language: {locale}
        </button>
      </header>
      <main>
        <h1>Damiano Defence</h1>
        <GambitRegion id={id} />
      </main>
      <footer>
        <a href="/vi/about">Content licence</a>
      </footer>
    </>
  )
}

const offline = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
  )
}

describe('on a page, when the fetch really fails', () => {
  it('replaces the region that failed and nothing else', async () => {
    offline()
    render(<Page id="fixture-taught-entry" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Damiano Defence')
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Catalogue' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Content licence' })).toBeVisible()
  })

  it('leaves the language switcher working', async () => {
    offline()
    render(<Page id="fixture-taught-entry" />)
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Language: vi' }))

    expect(screen.getByRole('button', { name: 'Language: fr' })).toBeVisible()
    // And the error is still there: switching language did not clear the problem.
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('recovers when the retry succeeds, without a page reload', async () => {
    offline()
    render(<Page id="fixture-taught-entry" />)
    await screen.findByRole('alert')

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(compiledEntry, {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 2, name: /queen offer/ })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the error again when the retry fails again, rather than a blank region', async () => {
    offline()
    render(<Page id="fixture-taught-entry" />)
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load')
  })
})
