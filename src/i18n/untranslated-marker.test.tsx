import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { afterEach, describe, expect, it } from 'vitest'
import en from '../locales/en.ts'
import fr from '../locales/fr.ts'
import vi from '../locales/vi.ts'
import { I18nProvider } from './I18nProvider.tsx'
import { Translated } from './Translated.tsx'
import type { LocaleLoader } from './i18n.ts'
import type { PartialTranslations } from './translations.ts'

/**
 * Acceptance criteria 3, 4 and 5 — and the one gate this ticket cannot ship without.
 *
 * A marker that never appears passes every test that only ever asks "is the marker absent
 * when the string is translated?". That is precisely how a `missingKeyHandler`
 * implementation would have failed: silently, invisibly, and green. So the marker is proved
 * **both ways** here — capable of appearing, and capable of not appearing — and neither
 * test means anything without the other.
 */

afterEach(cleanup)

/**
 * The real French catalogue with one string taken out of it. Derived from the shipped file
 * rather than hand-written, so it cannot drift from what visitors actually get.
 */
const withoutNavCatalogue = (source: PartialTranslations): PartialTranslations => {
  const nav = { ...source.nav }
  delete nav.catalogue
  return { ...source, nav }
}

const loader =
  (french: PartialTranslations): LocaleLoader =>
  (locale) =>
    Promise.resolve(locale === 'vi' ? vi : locale === 'en' ? en : french)

const renderInFrench = (french: PartialTranslations) =>
  render(
    <I18nProvider locale="fr" load={loader(french)}>
      <p>
        <Translated id="nav.catalogue" />
      </p>
    </I18nProvider>,
  )

const MARKER = 'non traduit'

describe('a string with no translation in the active locale', () => {
  it('renders the Vietnamese text with a visible marker (AC 3, AC 4)', async () => {
    renderInFrench(withoutNavCatalogue(fr))

    expect(await screen.findByText(vi.nav.catalogue)).toBeVisible()
    expect(screen.getByText(MARKER)).toBeVisible()
  })

  it('carries its own lang, so it is not read aloud with a French voice (AC 5)', async () => {
    renderInFrench(withoutNavCatalogue(fr))

    expect(await screen.findByText(vi.nav.catalogue)).toHaveAttribute('lang', 'vi')
  })

  it('is never blank and never a raw key (AC 3)', async () => {
    renderInFrench(withoutNavCatalogue(fr))

    const shown = await screen.findByText(vi.nav.catalogue)
    expect(shown.textContent).not.toBe('')
    expect(shown.textContent).not.toBe('nav.catalogue')
  })
})

describe('the same string once it is translated', () => {
  /**
   * The companion. Without it the pair above would pass just as well on a component that
   * marked *everything*, which is a different way of telling the visitor nothing.
   */
  it('renders the French text and no marker at all', async () => {
    renderInFrench(fr)

    expect(await screen.findByText('Catalogue')).toBeVisible()
    expect(screen.queryByText(MARKER)).toBeNull()
  })

  it('does not wrap it in a lang of its own, because there is nothing to override', async () => {
    renderInFrench(fr)

    expect(await screen.findByText('Catalogue')).not.toHaveAttribute('lang')
  })
})

describe('the trap ADR-0006 exists for', () => {
  /**
   * Not a test of our code — a test of the assumption underneath it, which is worth more.
   *
   * `missingKeyHandler` and `saveMissing` do not fire when a key resolves through
   * `fallbackLng`; they fire only when it is absent from every language. If a future
   * i18next ever changed that, this test fails and somebody revisits ADR-0006 deliberately,
   * rather than discovering the difference through a page that quietly presents Vietnamese
   * as French.
   */
  const instrumented = async () => {
    const reported: string[] = []
    const instance = i18next.createInstance()

    await instance.use(resourcesToBackend(loader(withoutNavCatalogue(fr)))).init({
      lng: 'fr',
      fallbackLng: 'vi',
      supportedLngs: ['vi', 'en', 'fr'],
      saveMissing: true,
      missingKeyHandler: (_lngs, _ns, key) => reported.push(key),
      interpolation: { escapeValue: false },
    })

    return { instance, reported }
  }

  it('reports nothing through missingKeyHandler when a key falls back', async () => {
    const { instance, reported } = await instrumented()

    expect(instance.t('nav.catalogue')).toBe(vi.nav.catalogue)
    expect(reported, 'a marker built on this would never have appeared').toStrictEqual([])
  })

  it('reports it exactly through returnDetails, which is what the marker uses', async () => {
    const { instance } = await instrumented()

    expect(instance.t('nav.catalogue', { returnDetails: true }).usedLng).toBe('vi')
    expect(instance.t('nav.about', { returnDetails: true }).usedLng).toBe('fr')
  })
})
