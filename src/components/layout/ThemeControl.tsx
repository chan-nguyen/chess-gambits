import { useState } from 'react'
import './ThemeControl.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { TranslationKey } from '../../i18n/translations.ts'
import { useTranslated } from '../../i18n/useTranslated.ts'
import {
  applyThemeSetting,
  readThemeSetting,
  rememberThemeSetting,
  themeSettings,
  type ThemeSetting,
} from '../../styles/theme.ts'

/** A `Record` over the closed set, so a new appearance setting cannot ship unlabelled. */
const labelKeys: Readonly<Record<ThemeSetting, TranslationKey>> = {
  system: 'appearance.system',
  light: 'appearance.light',
  dark: 'appearance.dark',
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
  const translated = useTranslated()

  const choose = (next: ThemeSetting): void => {
    setSetting(next)
    applyThemeSetting(next)
    rememberThemeSetting(next)
  }

  return (
    <div className="theme-control" role="group" aria-label={translated('appearance.label').text}>
      {themeSettings.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className="theme-control__option"
          aria-pressed={candidate === setting}
          onClick={() => choose(candidate)}
        >
          <Translated id={labelKeys[candidate]} />
        </button>
      ))}
    </div>
  )
}
