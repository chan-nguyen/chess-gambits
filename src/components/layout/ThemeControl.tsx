import { useState, useSyncExternalStore } from 'react'
import './ThemeControl.css'
import { Translated } from '../../i18n/Translated.tsx'
import { useTranslated } from '../../i18n/useTranslated.ts'
import {
  applyThemeSetting,
  darkSchemeQuery,
  readThemeSetting,
  rememberThemeSetting,
  resolveTheme,
  systemTheme,
  toggledSetting,
  type ThemeSetting,
} from '../../styles/theme.ts'

const subscribeToScheme = (onChange: () => void): (() => void) => {
  const list = window.matchMedia(darkSchemeQuery)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

/**
 * Dark mode follows the system preference and is overridable, and the override persists
 * (§2). One icon button since 2026-09-29, by user request, where there were three: it
 * toggles between light and dark, and `toggledSetting` drops the override again whenever
 * the toggle lands on what the system paints, so "follow my system" is still reachable.
 *
 * `aria-pressed` says whether the page is dark, and the icon draws the theme on screen — a
 * moon when dark, a sun when light. What the system prefers is read live, so a page that
 * follows it and changes with it at sunset shows the right icon and toggles from the right
 * theme.
 *
 * The current setting is read once, on mount, and is already on the document by then: the
 * pre-paint script in `index.html` applied it before anything rendered. So this component
 * never has to correct the page it is mounted into, which is what makes the first paint
 * flash-free rather than fast.
 */
export const ThemeControl = () => {
  const [setting, setSetting] = useState<ThemeSetting>(readThemeSetting)
  const system = useSyncExternalStore(subscribeToScheme, systemTheme)
  const translated = useTranslated()
  const dark = resolveTheme(setting, system) === 'dark'

  const toggle = (): void => {
    const next = toggledSetting(setting, system)
    setSetting(next)
    applyThemeSetting(next)
    rememberThemeSetting(next)
  }

  return (
    <button
      type="button"
      className="theme-control"
      aria-pressed={dark}
      title={translated('appearance.dark').text}
      onClick={toggle}
    >
      <svg className="theme-control__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {dark ? (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
      <span className="visually-hidden">
        <Translated id="appearance.dark" />
      </span>
    </button>
  )
}
