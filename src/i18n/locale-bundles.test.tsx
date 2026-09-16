import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import en from '../locales/en.ts'
import fr from '../locales/fr.ts'
import vi from '../locales/vi.ts'
import { I18nProvider } from './I18nProvider.tsx'
import { LocaleBundleNotice } from './LocaleBundleNotice.tsx'
import { Translated } from './Translated.tsx'
import { loadLocaleBundle, type LocaleLoader } from './i18n.ts'

/**
 * Acceptance criteria 2 and 7: what is downloaded, and what the page says when it is not.
 */

afterEach(cleanup)

const CATALOGUES: Readonly<Record<string, unknown>> = { vi, en, fr }

/** Resolves the real catalogues, rejects the named ones, and records every request. */
const recordingLoader = (requested: string[], failing: readonly string[] = []): LocaleLoader => {
  return (locale) => {
    requested.push(locale)
    return failing.includes(locale)
      ? Promise.reject(new Error(`chunk for ${locale} failed`))
      : Promise.resolve(CATALOGUES[locale])
  }
}

const page = (locale: 'vi' | 'en' | 'fr', load: LocaleLoader) =>
  render(
    <I18nProvider locale={locale} load={load}>
      <LocaleBundleNotice />
      <p>
        <Translated id="nav.catalogue" />
      </p>
    </I18nProvider>,
  )

describe('what a visitor downloads (AC 2)', () => {
  it('emits one loadable chunk per locale, and all three resolve', async () => {
    for (const locale of ['vi', 'en', 'fr']) {
      expect(await loadLocaleBundle(locale)).toHaveProperty('default.nav.catalogue')
    }
  })

  it('fetches the active locale and the fallback, and no other language', async () => {
    const requested: string[] = []
    page('fr', recordingLoader(requested))

    await screen.findByText('Catalogue')
    // Vietnamese comes too, and must: showing Vietnamese fallback text requires having it.
    expect([...new Set(requested)].sort()).toStrictEqual(['fr', 'vi'])
    expect(requested).not.toContain('en')
  })

  it('fetches only Vietnamese for a Vietnamese visitor, which is the whole point', async () => {
    const requested: string[] = []
    page('vi', recordingLoader(requested))

    await screen.findByText(vi.nav.catalogue)
    expect([...new Set(requested)]).toStrictEqual(['vi'])
  })
})

describe('while the first catalogue is still in flight', () => {
  it('shows a busy placeholder rather than a page full of raw keys (AC 3)', () => {
    const { container } = page('fr', () => new Promise(() => {}))

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText('nav.catalogue')).toBeNull()
  })
})

describe('a locale bundle that fails to load (AC 7)', () => {
  it('falls back to Vietnamese and says so, in the untranslated vocabulary', async () => {
    page('fr', recordingLoader([], ['fr']))
    const notice = await screen.findByRole('status')

    expect(notice).toHaveTextContent(vi.untranslated.bundleFailed)
    expect(notice).toHaveTextContent(vi.untranslated.inVietnamese)
    expect(screen.getByText(vi.nav.catalogue)).toBeVisible()
  })

  it('marks the notice itself as Vietnamese, since that is what it is written in (AC 5)', async () => {
    page('fr', recordingLoader([], ['fr']))

    expect(await screen.findByRole('status')).toHaveAttribute('lang', 'vi')
  })

  it('states it once instead of marking every string on the page', async () => {
    page('fr', recordingLoader([], ['fr']))

    await screen.findByRole('status')
    expect(screen.queryByText('non traduit')).toBeNull()
    expect(screen.queryByText(vi.untranslated.marker)).toBeNull()
  })

  it('says nothing at all when the bundle loaded, which is the companion to the above', async () => {
    page('fr', recordingLoader([]))

    await screen.findByText('Catalogue')
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('when nothing loads, not even the source locale', () => {
  it('says so plainly rather than rendering an interface labelled with raw keys', async () => {
    page('fr', recordingLoader([], ['fr', 'vi']))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('lang', 'vi')
    expect(alert.textContent).not.toBe('')
    expect(screen.queryByText('nav.catalogue')).toBeNull()
  })
})
