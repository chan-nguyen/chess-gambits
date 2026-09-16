import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import './AppShell.css'
import { defaultLocale, isLocale, type Locale } from '../../lib/locale.ts'
import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'

/**
 * The frame every route renders inside: header, content, footer.
 *
 * The locale comes from the path rather than from `useParams`, because this component
 * sits above `/:locale` in the route tree and has to work on the two routes that have no
 * locale segment at all — the redirect at `/` and the catch-all 404.
 */
const localeOf = (pathname: string): Locale => {
  const first = pathname.split('/')[1] ?? ''
  return isLocale(first) ? first : defaultLocale
}

export const AppShell = () => {
  const locale = localeOf(useLocation().pathname)

  /**
   * WCAG 3.1.1: the document says which language it is in. The shells ship with
   * `lang="en"` until #17 gives each one its own head, so until then this is the only
   * thing telling a screen reader that a Vietnamese page is Vietnamese.
   */
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header locale={locale} />
      <div className="app-shell__content" id="main-content" tabIndex={-1}>
        <Outlet />
      </div>
      <Footer locale={locale} />
    </>
  )
}
