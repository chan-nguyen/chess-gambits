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
 * anyway. The alternative is a setting that today controls nothing at all — `f` is #13's —
 * and a control that does nothing when you use it is worse than no control, especially this
 * one, whose whole purpose is to be believed.
 *
 * `1`-`9` (#9) are the character keys 2.1.4 is actually about, and they read this same
 * setting rather than a second one: a visitor who switched single-key shortcuts off said
 * something about how they use a keyboard, not something about one family of keys.
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

/**
 * How many branches a numeric shortcut can reach (docs/design-system.md §4).
 *
 * Nine, because there are nine single digits and `10` is two presses with no way to tell a
 * finished number from an unfinished one. Where more than nine replies are modelled the
 * rest are reachable by tab and by click, and #9's acceptance criterion 6 states the rule
 * this constant exists to keep honest: **a numeric shortcut is never the only route to a
 * branch.**
 */
const branchShortcutKeys = '123456789'

export const maxShortcutBranches = branchShortcutKeys.length

/**
 * Which branch a key press selects, counting from zero, or null when the press is not one
 * of `1`-`9`.
 *
 * Read from `event.key` rather than `event.code`, so the digit a visitor actually typed is
 * the digit that is acted on: on an AZERTY keyboard the unshifted top-row key reports
 * `code: 'Digit1'` and `key: '&'`, and matching on the code would fire a shortcut nobody
 * pressed. The length check is not decoration — `''.indexOf` answers 0 for the empty
 * string, which would make "no key at all" select the first branch.
 */
export const branchShortcutIndex = (key: string): number | null => {
  if (key.length !== 1) return null
  const index = branchShortcutKeys.indexOf(key)
  return index === -1 ? null : index
}
