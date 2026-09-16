import { readStored, writeStored } from '../../lib/storage.ts'

/**
 * The persisted switch for single-key navigation shortcuts (AC 2).
 *
 * WCAG 2.2 **2.1.4 Character Key Shortcuts is Level A**, and the exemption everyone reaches
 * for — "we ignore the key inside text inputs" — is not one of the three the success
 * criterion offers. The three are: turn the shortcut off, remap it, or make it active only
 * on focus. This is the first, and it persists, because a visitor who has turned it off has
 * said something about how they use a keyboard and not something about this page view.
 *
 * Note what this switch governs, which is *more* than 2.1.4 requires. Left and right arrows
 * are not character keys, so the criterion does not reach them; they are switched off here
 * anyway. The alternative is a setting that today controls nothing at all — `f` and `1`-`9`
 * are #9's and #14's — and a control that does nothing when you use it is worse than no
 * control, especially this one, whose whole purpose is to be believed.
 *
 * Modelled on `src/styles/theme.ts`, including reading through the wrapped storage helper:
 * `localStorage` may throw on access, and a setting that crashed the page it belongs to
 * would be a poor advertisement for accessibility work.
 */

export type ShortcutSetting = 'on' | 'off'

export const shortcutSettings: readonly ShortcutSetting[] = ['on', 'off']

/** On by default: arrow keys are what a returning learner reaches for first. */
export const defaultShortcutSetting: ShortcutSetting = 'on'

export const shortcutStorageKey = 'chess-gambits.shortcuts'

const settingSet: ReadonlySet<string> = new Set(shortcutSettings)

export const isShortcutSetting = (value: string): value is ShortcutSetting => settingSet.has(value)

/** The remembered setting, or `on` if there is none or it has been tampered with. */
export const readShortcutSetting = (): ShortcutSetting =>
  readStored(shortcutStorageKey, isShortcutSetting) ?? defaultShortcutSetting

export const rememberShortcutSetting = (setting: ShortcutSetting): void =>
  writeStored(shortcutStorageKey, setting)
