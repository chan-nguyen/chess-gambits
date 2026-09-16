import { useEffect, useState, type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import './I18nProvider.css'
import { defaultLocale, type Locale } from '../lib/locale.ts'
import { bundleStatus, createI18n, type LocaleBundleStatus, type LocaleLoader } from './i18n.ts'
import { LocaleBundleContext } from './locale-bundle-context.ts'

/**
 * The one string in the application that cannot live in a catalogue, because it is what the
 * page says when no catalogue loaded at all. Vietnamese, because Vietnamese is the source
 * locale — there is no better guess available at the moment it is needed.
 */
const NOTHING_LOADED =
  'Không tải được nội dung hiển thị của trang. Vui lòng kiểm tra kết nối và tải lại trang.'

type I18nProviderProps = {
  /** From the route. `/:locale` is the single source of truth for the active language. */
  readonly locale: Locale
  readonly children: ReactNode
  /** Injected by tests that need a catalogue with a string taken out of it. */
  readonly load?: LocaleLoader | undefined
}

/**
 * Holds the i18next instance and drives it from the route (acceptance criterion 1).
 *
 * The instance is created once and kept, so switching language is a `changeLanguage` rather
 * than a new instance and a second download of the fallback catalogue.
 *
 * Three states, all of them designed rather than incidental:
 *
 * - **loading** — the first paint only. Until a catalogue is in hand, `t` returns raw keys,
 *   and a raw key on screen is exactly what acceptance criterion 3 forbids. A later
 *   *switch* never lands here: `status` is only reassigned once a load settles, so the
 *   previous language stays on screen until the next one can replace it, which is also why
 *   changing language does not flash.
 * - **fallback** — the active catalogue failed; Vietnamese is standing in, and
 *   `LocaleBundleNotice` says so.
 * - **unavailable** — nothing loaded, not even Vietnamese. There is no labelled interface
 *   to show, so the page says that plainly instead of rendering a shell full of raw keys.
 */
export const I18nProvider = ({ locale, children, load }: I18nProviderProps) => {
  const [instance] = useState(() => createI18n(locale, load))
  const [status, setStatus] = useState<LocaleBundleStatus>('loading')

  useEffect(() => {
    let live = true
    const settle = () => {
      if (live) setStatus(bundleStatus(instance, locale))
    }

    // Settles on both outcomes: a rejected chunk is a state to render, not an error to throw.
    void instance.changeLanguage(locale).then(settle, settle)

    return () => {
      live = false
    }
  }, [instance, locale])

  /**
   * `aria-busy` rather than a label, because the word for "loading" is in the file that has
   * not arrived. It reserves height so the swap to the real page is not a layout shift.
   */
  if (status === 'loading') return <div className="i18n-loading" aria-busy="true" />

  if (status === 'unavailable')
    return (
      <p className="i18n-unavailable" role="alert" lang={defaultLocale}>
        {NOTHING_LOADED}
      </p>
    )

  return (
    <I18nextProvider i18n={instance}>
      <LocaleBundleContext.Provider value={status}>{children}</LocaleBundleContext.Provider>
    </I18nextProvider>
  )
}
