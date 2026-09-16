import { Outlet, useParams } from 'react-router'
import { isLocale } from '../lib/locale.ts'
import { NotFoundRoute } from './not-found.tsx'

/**
 * The boundary where the locale path segment is validated. `locale` is a closed set of
 * three and every URL is attacker-controlled (docs/security.md, B4), so an unknown value
 * renders not-found here rather than reaching a route that assumes it is a language.
 */
export const LocaleLayout = () => {
  const { locale } = useParams()

  if (locale === undefined || !isLocale(locale)) return <NotFoundRoute />

  return <Outlet />
}
