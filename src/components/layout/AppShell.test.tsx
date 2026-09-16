import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../router.tsx'
import { themeAttribute, themeStorageKey } from '../../styles/theme.ts'

/**
 * AC 3 and AC 4, and the parts of AC 8 that do not need a browser.
 *
 * What is *not* here: the 768px collapse itself. It is a media query, jsdom does not
 * evaluate media queries into computed style, and a test that pretended otherwise would
 * pass while the header was broken at every real width. That claim is `e2e/shell.spec.ts`,
 * at 360, 768 and 1280.
 */

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  document.documentElement.removeAttribute(themeAttribute)
})

const header = () => screen.getByRole('banner')
const footer = () => screen.getByRole('contentinfo')

/**
 * jsdom applies plain class selectors, so the collapsed state — `display: none` — is real
 * here and the destinations are genuinely absent from the accessibility tree until the
 * button is pressed. It does *not* apply media conditions, so what is exercised below is
 * the narrow header at every width. The wide one is the e2e's.
 */
const openMenu = async (): Promise<HTMLElement> => {
  const button = await within(header()).findByRole('button', { name: 'Menu' })
  fireEvent.click(button)
  return button
}

describe('the header', () => {
  it('names the site and links it home, in the current locale', async () => {
    renderAt('/fr/about')

    const name = await within(header()).findByRole('link', { name: 'Chess Gambit Trainer' })
    expect(name).toHaveAttribute('href', '/fr/')
  })

  it('collapses the destinations out of the accessibility tree, not merely out of sight', async () => {
    renderAt('/fr/about')

    const button = await within(header()).findByRole('button', { name: 'Menu' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(within(header()).queryByRole('navigation', { name: 'Primary' })).toBeNull()
    expect(within(header()).queryByRole('link', { name: 'Catalogue' })).toBeNull()
  })

  it('keeps the language switcher out of the collapse (AC 3)', async () => {
    renderAt('/fr/about')

    // Collapsed, and the switcher is still there: it is the one control a visitor may
    // need before they can read the menu.
    await within(header()).findByRole('button', { name: 'Menu' })
    expect(within(header()).getByRole('navigation', { name: 'Language' })).toBeVisible()
  })

  it('offers the two destinations once expanded', async () => {
    renderAt('/fr/about')
    const button = await openMenu()

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const primary = within(header()).getByRole('navigation', { name: 'Primary' })
    expect(within(primary).getByRole('link', { name: 'Catalogue' })).toHaveAttribute(
      'href',
      '/fr/gambits',
    )
    expect(within(primary).getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '/fr/about',
    )
  })

  it('points aria-controls at the panel it actually expands', async () => {
    renderAt('/fr/about')
    const button = await openMenu()

    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeNull()
    expect(panel).toContainElement(within(header()).getByRole('navigation', { name: 'Primary' }))
  })
})

describe('the language switcher', () => {
  it('offers all three languages, each named in its own language', async () => {
    renderAt('/vi/about')

    const language = await screen.findByRole('navigation', { name: 'Language' })
    expect(within(language).getByRole('link', { name: 'Tiếng Việt' })).toBeVisible()
    expect(within(language).getByRole('link', { name: 'English' })).toBeVisible()
    expect(within(language).getByRole('link', { name: 'Français' })).toBeVisible()
  })

  it('marks the current language for assistive technology', async () => {
    renderAt('/vi/about')

    const language = await screen.findByRole('navigation', { name: 'Language' })
    expect(within(language).getByRole('link', { name: 'Tiếng Việt' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(language).getByRole('link', { name: 'English' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('keeps the route, the query and the fragment exactly (§3)', async () => {
    renderAt('/vi/gambits/evans-gambit?line=e4_e5_Nf3#tree')

    const language = await screen.findByRole('navigation', { name: 'Language' })
    expect(within(language).getByRole('link', { name: 'Français' })).toHaveAttribute(
      'href',
      '/fr/gambits/evans-gambit?line=e4_e5_Nf3#tree',
    )
  })

  it('falls back to the locale home from a route with no locale at all', async () => {
    renderAt('/nothing/here')

    const language = await screen.findByRole('navigation', { name: 'Language' })
    expect(within(language).getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/')
  })
})

describe('the appearance control', () => {
  it('starts on system, and says so', async () => {
    renderAt('/vi/about')
    await openMenu()

    const group = await screen.findByRole('group', { name: 'Appearance' })
    expect(within(group).getByRole('button', { name: 'System' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('applies a choice to the document and remembers it', async () => {
    renderAt('/vi/about')
    await openMenu()

    const group = await screen.findByRole('group', { name: 'Appearance' })
    fireEvent.click(within(group).getByRole('button', { name: 'Dark' }))

    expect(document.documentElement.getAttribute(themeAttribute)).toBe('dark')
    expect(window.localStorage.getItem(themeStorageKey)).toBe('dark')
    expect(within(group).getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('goes back to following the system, which a two-way toggle could not', async () => {
    window.localStorage.setItem(themeStorageKey, 'dark')
    renderAt('/vi/about')
    await openMenu()

    const group = await screen.findByRole('group', { name: 'Appearance' })
    fireEvent.click(within(group).getByRole('button', { name: 'System' }))

    expect(document.documentElement.hasAttribute(themeAttribute)).toBe(false)
    expect(window.localStorage.getItem(themeStorageKey)).toBe('system')
  })
})

describe('the footer', () => {
  it('links the repository', async () => {
    renderAt('/vi/about')

    expect(await within(footer()).findByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/chan-nguyen/chess-gambits',
    )
  })

  it('names both licences, because they differ', async () => {
    renderAt('/vi/about')

    expect(await within(footer()).findByRole('link', { name: 'MIT' })).toBeVisible()
    expect(within(footer()).getByRole('link', { name: 'CC BY-SA 4.0' })).toBeVisible()
  })

  it('credits the openings dataset, which is CC0 and needs no credit', async () => {
    renderAt('/vi/about')

    expect(
      await within(footer()).findByRole('link', { name: 'lichess-org/chess-openings' }),
    ).toHaveAttribute('href', 'https://github.com/lichess-org/chess-openings')
    expect(within(footer()).getByText(/CC0/)).toBeVisible()
  })

  it('points at the About page for how a mate is proved (§1)', async () => {
    renderAt('/vi/about')

    expect(
      await within(footer()).findByRole('link', { name: 'How mate claims are proved' }),
    ).toHaveAttribute('href', '/vi/about')
  })
})

describe('the shell itself', () => {
  it('offers a skip link before anything else in the tab order', async () => {
    renderAt('/vi/about')

    const skip = await screen.findByRole('link', { name: 'Skip to content' })
    expect(skip).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).toContainElement(
      screen.getByRole('heading', { level: 1 }),
    )
  })

  it('tells the document which language it is in (WCAG 3.1.1)', async () => {
    renderAt('/fr/about')

    await waitFor(() => expect(document.documentElement.lang).toBe('fr'))
  })

  it('still frames a page whose locale does not exist', async () => {
    renderAt('/de/about')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Page not found')
    expect(screen.getByRole('banner')).toBeVisible()
    expect(screen.getByRole('contentinfo')).toBeVisible()
  })
})
