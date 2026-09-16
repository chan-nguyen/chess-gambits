import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultShortcutSetting,
  isShortcutSetting,
  readShortcutSetting,
  rememberShortcutSetting,
  shortcutSettings,
  shortcutStorageKey,
} from './shortcuts.ts'

/**
 * AC 2's persistence. WCAG 2.2 *2.1.4* is Level A and the mechanism it asks for is only a
 * mechanism if it survives the page it was used on.
 */

beforeEach(() => window.localStorage.clear())

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('the setting', () => {
  it('is on until somebody turns it off', () => {
    expect(readShortcutSetting()).toBe('on')
    expect(defaultShortcutSetting).toBe('on')
  })

  it('survives being written and read back', () => {
    rememberShortcutSetting('off')

    expect(readShortcutSetting()).toBe('off')
  })

  it('is stored under a key nothing else in the project uses', () => {
    rememberShortcutSetting('off')

    expect(window.localStorage.getItem(shortcutStorageKey)).toBe('off')
    expect(shortcutStorageKey).toBe('chess-gambits.shortcuts')
  })

  it.each([...shortcutSettings])('round-trips %s', (setting) => {
    rememberShortcutSetting(setting)

    expect(readShortcutSetting()).toBe(setting)
  })
})

describe('when the stored value cannot be trusted', () => {
  it('discards a value that is not a setting', () => {
    window.localStorage.setItem(shortcutStorageKey, 'maybe')

    expect(readShortcutSetting()).toBe('on')
  })

  it.each(['', 'ON', 'true', '{"on":true}'])('discards %o', (stored) => {
    window.localStorage.setItem(shortcutStorageKey, stored)

    expect(readShortcutSetting()).toBe('on')
  })

  it('recognises only the two settings that exist', () => {
    expect(isShortcutSetting('on')).toBe(true)
    expect(isShortcutSetting('off')).toBe(true)
    expect(isShortcutSetting('disabled')).toBe(false)
  })
})

describe('when storage itself is unavailable', () => {
  /**
   * A private window, storage disabled by policy, or a full quota. None of them is
   * exceptional and none of them may break the page — least of all this page, whose whole
   * purpose is to be the accessible way out of a keyboard trap.
   */
  it('reads the default rather than throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access is denied for this document.')
    })

    expect(readShortcutSetting()).toBe('on')
  })

  it('writes without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => rememberShortcutSetting('off')).not.toThrow()
  })
})
