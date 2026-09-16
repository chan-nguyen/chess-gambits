import { Link, useLocation } from 'react-router'
import './LanguageSwitcher.css'
import { isLocale, locales, type Locale } from '../../lib/locale.ts'
import { routePath } from '../../lib/routes.ts'

type LanguageSwitcherProps = { readonly locale: Locale }

/** Each language in its own language, never translated into the current one. */
const languageNames: Readonly<Record<Locale, string>> = {
  vi: 'Tiếng Việt',
  en: 'English',
  fr: 'Français',
}

const languageCodes: Readonly<Record<Locale, string>> = { vi: 'VI', en: 'EN', fr: 'FR' }

/**
 * The same page in another language: the locale segment is swapped and everything else —
 * the rest of the path, the query and the fragment — is carried across untouched, which
 * is what keeps `line` and the catalogue filters intact (§3).
 */
const withLocale = (pathname: string, locale: Locale): string => {
  const segments = pathname.split('/')
  if (!isLocale(segments[1] ?? '')) return routePath(locale)
  return segments.map((segment, index) => (index === 1 ? locale : segment)).join('/')
}

/**
 * Renders the choice. It does not translate anything yet — the UI strings and the
 * remembered preference are #7 — but each option is a real link, because changing
 * language changes the URL and a URL is middle-clickable and copyable (§4).
 */
export const LanguageSwitcher = ({ locale }: LanguageSwitcherProps) => {
  const { pathname, search, hash } = useLocation()

  return (
    <nav className="language-switcher" aria-label="Language">
      <ul className="language-switcher__list">
        {locales.map((candidate) => (
          <li key={candidate}>
            <Link
              className="language-switcher__option"
              to={`${withLocale(pathname, candidate)}${search}${hash}`}
              lang={candidate}
              hrefLang={candidate}
              aria-current={candidate === locale ? 'true' : undefined}
            >
              <span aria-hidden="true">{languageCodes[candidate]}</span>
              <span className="visually-hidden">{languageNames[candidate]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
