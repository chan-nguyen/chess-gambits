import { useState } from 'react'
import './ThemeControl.css'
import {
  applyThemeSetting,
  readThemeSetting,
  rememberThemeSetting,
  themeSettings,
  type ThemeSetting,
} from '../../styles/theme.ts'

const labels: Readonly<Record<ThemeSetting, string>> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

/**
 * Dark mode follows the system preference and is overridable, and the override persists
 * (§2). Three buttons rather than a two-way toggle, so "follow my system" stays reachable
 * after a visitor has tried the other two.
 *
 * The current setting is read once, on mount, and is already on the document by then: the
 * pre-paint script in `index.html` applied it before anything rendered. So this component
 * never has to correct the page it is mounted into, which is what makes the first paint
 * flash-free rather than fast.
 */
export const ThemeControl = () => {
  const [setting, setSetting] = useState<ThemeSetting>(readThemeSetting)

  const choose = (next: ThemeSetting): void => {
    setSetting(next)
    applyThemeSetting(next)
    rememberThemeSetting(next)
  }

  return (
    <div className="theme-control" role="group" aria-label="Appearance">
      {themeSettings.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className="theme-control__option"
          aria-pressed={candidate === setting}
          onClick={() => choose(candidate)}
        >
          {labels[candidate]}
        </button>
      ))}
    </div>
  )
}
