import { useId, useState } from 'react'
import { Link } from 'react-router'
import './Header.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import type { Locale } from '../../lib/locale.ts'
import { routePath, routeSegments } from '../../lib/routes.ts'
import { LanguageSwitcher } from './LanguageSwitcher.tsx'
import { ThemeControl } from './ThemeControl.tsx'

type HeaderProps = { readonly locale: Locale }

/**
 * Site name, the two destinations, the language switcher and the appearance control
 * (docs/design-system.md §1).
 *
 * Below 768px the destinations and the appearance control collapse behind one button and
 * the language switcher stays out: it is the one control a visitor may need *before* they
 * can read a menu. The collapse is CSS, so it needs no resize listener and cannot be
 * wrong at a width nobody tested; `e2e/shell.spec.ts` checks it at three of them.
 *
 * "Chess Gambit Trainer" is not translated. It is the site's name — the thing a visitor
 * types into a search engine and reads in a shared link — and a name that changed with the
 * interface language would make the same site look like three different ones.
 */
export const Header = ({ locale }: HeaderProps) => {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const translated = useTranslated()

  // The panel pushes the page down while it is open, so following a link closes it.
  const close = () => setOpen(false)

  return (
    <header className="site-header">
      <div className="site-header__bar">
        <Link className="site-header__name" to={routePath(locale)}>
          Chess Gambit Trainer
        </Link>
        <LanguageSwitcher locale={locale} />
        <button
          type="button"
          className="site-header__menu-button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(!open)}
        >
          <Translated id="nav.menu" />
        </button>
        <div className="site-header__menu" id={menuId} data-open={open}>
          <nav className="site-header__nav" aria-label={translated('nav.primary').text}>
            <Link to={routePath(locale, routeSegments.catalogue)} onClick={close}>
              <Translated id="nav.catalogue" />
            </Link>
            <Link to={routePath(locale, routeSegments.about)} onClick={close}>
              <Translated id="nav.about" />
            </Link>
          </nav>
          <ThemeControl />
        </div>
      </div>
    </header>
  )
}
