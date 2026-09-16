import { useState } from 'react'
import { Navigate } from 'react-router'
import { resolveLocale } from '../lib/locale-preference.ts'
import { routePath } from '../lib/routes.ts'

/**
 * `/` carries no locale, so it resolves one and redirects once — `replace`, so the back
 * button leaves the site instead of bouncing off this route.
 *
 * The resolution is read in a `useState` initialiser rather than during render because
 * it is a command as well as a question: it remembers its answer so a return visit skips
 * the guessing.
 */
export const LocaleRedirect = () => {
  const [locale] = useState(() => resolveLocale(navigator.languages))

  return <Navigate to={routePath(locale)} replace />
}
