import { useId } from 'react'
import './ShortcutToggle.css'
import { Translated } from '../../i18n/Translated.tsx'
import type { ShortcutSetting } from './shortcuts.ts'

/**
 * The mechanism WCAG 2.2 *2.1.4 Character Key Shortcuts* (Level A) requires: a way to turn
 * single-key shortcuts off (AC 2). See `shortcuts.ts` for why it persists and why it
 * governs the arrow keys as well.
 *
 * It sits on the page the shortcuts act on rather than behind a settings route, because
 * the person who needs it is the person who has just triggered one by accident, and a
 * control they have to go looking for is one they will not find.
 */
export type ShortcutToggleProps = {
  readonly setting: ShortcutSetting
  readonly onChange: (setting: ShortcutSetting) => void
}

export const ShortcutToggle = ({ setting, onChange }: ShortcutToggleProps) => {
  const inputId = useId()
  const hintId = useId()

  return (
    <div className="shortcut-toggle">
      <input
        type="checkbox"
        id={inputId}
        className="shortcut-toggle__input"
        checked={setting === 'on'}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.currentTarget.checked ? 'on' : 'off')}
      />
      <label className="shortcut-toggle__label" htmlFor={inputId}>
        <Translated id="learn.shortcuts" />
      </label>
      <p className="shortcut-toggle__hint" id={hintId}>
        <Translated id="learn.shortcutsHint" />
      </p>
    </div>
  )
}
