import { afterEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import {
  applyThemeSetting,
  defaultThemeSetting,
  isThemeSetting,
  readThemeSetting,
  rememberThemeSetting,
  themeAttribute,
  themeSettings,
  themeStorageKey,
  type ThemeSetting,
} from './theme.ts'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  document.documentElement.removeAttribute(themeAttribute)
})

describe('the remembered theme setting', () => {
  it('is system when nothing has ever been chosen', () => {
    expect(readThemeSetting()).toBe('system')
  })

  it.each(themeSettings)('round-trips %s', (setting) => {
    rememberThemeSetting(setting)

    expect(readThemeSetting()).toBe(setting)
  })

  it('discards a value that has been tampered with', () => {
    window.localStorage.setItem(themeStorageKey, 'midnight')

    expect(readThemeSetting()).toBe(defaultThemeSetting)
  })

  it('degrades to the system preference when storage is unreachable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })

    expect(readThemeSetting()).toBe('system')
  })

  it('does not break the page when storage refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => rememberThemeSetting('dark')).not.toThrow()
  })

  it('recognises exactly the three settings', () => {
    expect(themeSettings.filter(isThemeSetting)).toStrictEqual(themeSettings)
    expect(isThemeSetting('midnight')).toBe(false)
  })
})

describe('applying a setting', () => {
  const overrides: readonly ThemeSetting[] = ['light', 'dark']

  it.each(overrides)('puts %s on the document', (setting) => {
    applyThemeSetting(setting)

    expect(document.documentElement.getAttribute(themeAttribute)).toBe(setting)
  })

  /**
   * `system` removes the attribute rather than setting a third value, so the media query
   * in `tokens.css` is the only thing deciding. Two mechanisms could disagree; one cannot.
   */
  it('removes the attribute for system, rather than naming a third theme', () => {
    applyThemeSetting('dark')
    applyThemeSetting('system')

    expect(document.documentElement.hasAttribute(themeAttribute)).toBe(false)
  })
})

describe('the pre-paint script in index.html', () => {
  /**
   * AC 8 has two halves. That the right theme is applied is checked here; that it is
   * applied *before the first paint* is checked in `e2e/shell.spec.ts`, against a real
   * browser, because no unit test can see a flash.
   *
   * What this file protects is the seam. The script cannot import anything — it has to run
   * before any module does — so it spells the key and the attribute out by hand, and these
   * assertions are what stop those spellings drifting away from `theme.ts`.
   */
  const head = indexHtml.slice(indexHtml.indexOf('<head>'), indexHtml.indexOf('</head>'))
  const script = head.slice(head.indexOf('<script>'), head.indexOf('</script>'))

  it('is in the head, so it runs before the body renders', () => {
    expect(head).toContain('<script>')
  })

  it('is not deferred, which a module script would be', () => {
    expect(script).not.toContain('type="module"')
    expect(indexHtml.indexOf('<script>')).toBeLessThan(indexHtml.indexOf('type="module"'))
  })

  it('reads the same storage key theme.ts writes', () => {
    expect(script).toContain(`'${themeStorageKey}'`)
  })

  it('sets the same attribute theme.ts sets', () => {
    expect(script).toContain(`'${themeAttribute}'`)
  })

  it('applies only the two values tokens.css styles, never a stored system or a typo', () => {
    expect(script).toContain("choice === 'light'")
    expect(script).toContain("choice === 'dark'")
  })

  it('is wrapped, because a private window can make reading storage throw', () => {
    expect(script).toContain('try {')
    expect(script).toContain('} catch')
  })
})
