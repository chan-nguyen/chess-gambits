import { Link, useLocation } from 'react-router'
import './LanguageSwitcher.css'
import { useTranslated } from '../../i18n/useTranslated.ts'
import { rememberLocale } from '../../lib/locale-preference.ts'
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
 * Renders the choice. Each option is a real link, because changing language changes the
 * URL and a URL is middle-clickable and copyable (§4); the route parameter it lands on is
 * what drives `changeLanguage`, so the language and the address can never disagree.
 *
 * Following one remembers it, which is what makes `/` stable on a return visit (§1). Only
 * a *click here* counts as choosing: arriving on `/fr/` from someone else's shared link
 * should show that visitor French, not silently rewrite what `/` means for them afterwards.
 */
export const LanguageSwitcher = ({ locale }: LanguageSwitcherProps) => {
  const { pathname, search, hash } = useLocation()
  const translated = useTranslated()

  return (
    <nav className="language-switcher" aria-label={translated('nav.language').text}>
      <ul className="language-switcher__list">
        {locales.map((candidate) => (
          <li key={candidate}>
            <Link
              className="language-switcher__option"
              to={`${withLocale(pathname, candidate)}${search}${hash}`}
              lang={candidate}
              hrefLang={candidate}
              aria-current={candidate === locale ? 'true' : undefined}
              onClick={() => rememberLocale(candidate)}
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
