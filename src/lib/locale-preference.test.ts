import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { storedLocaleKey } from './locale'
import { readStoredLocale, rememberLocale, resolveLocale } from './locale-preference'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('remembering a locale', () => {
  it('reads back what it remembered', () => {
    rememberLocale('fr')

    expect(readStoredLocale()).toBe('fr')
  })

  it('reads null when nothing was remembered', () => {
    expect(readStoredLocale()).toBeNull()
  })

  it('discards a value that is no longer a locale', () => {
    window.localStorage.setItem(storedLocaleKey, 'klingon')

    expect(readStoredLocale()).toBeNull()
  })
})

describe('resolving where / should send a visitor', () => {
  it('uses the browser preference on a first visit', () => {
    expect(resolveLocale(['fr-FR', 'en'])).toBe('fr')
  })

  it('remembers what it resolved', () => {
    resolveLocale(['fr-FR'])

    expect(window.localStorage.getItem(storedLocaleKey)).toBe('fr')
  })

  it('honours the remembered value over the browser on a return visit', () => {
    rememberLocale('vi')

    expect(resolveLocale(['fr-FR', 'en-GB'])).toBe('vi')
  })

  it('re-resolves when the remembered value has been tampered with', () => {
    window.localStorage.setItem(storedLocaleKey, 'klingon')

    expect(resolveLocale(['en-GB'])).toBe('en')
  })

  it('still resolves when storage is unavailable, just without remembering', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })

    expect(resolveLocale(['fr-FR'])).toBe('fr')
  })
})
