import { describe, expect, it } from 'vitest'
import { defaultLocale, isLocale, locales, preferredLocale } from './locale'

describe('the locale set', () => {
  it('is exactly the three the product ships', () => {
    expect(locales).toEqual(['vi', 'en', 'fr'])
  })

  it('falls back to the source locale', () => {
    expect(defaultLocale).toBe('vi')
  })

  it('accepts only members of the set', () => {
    for (const locale of locales) expect(isLocale(locale)).toBe(true)
    for (const other of ['', 'VI', 'de', 'vi-VN', 'en_US', '__proto__', 'toString']) {
      expect(isLocale(other)).toBe(false)
    }
  })
})

describe('resolving a preference from browser languages', () => {
  it('takes an exact match', () => {
    expect(preferredLocale(['fr'])).toBe('fr')
  })

  it('matches on the primary subtag', () => {
    expect(preferredLocale(['fr-CA'])).toBe('fr')
    expect(preferredLocale(['en-GB', 'fr-FR'])).toBe('en')
  })

  it('ignores case', () => {
    expect(preferredLocale(['FR-ca'])).toBe('fr')
  })

  it('takes the first language the site actually has', () => {
    expect(preferredLocale(['de-DE', 'ja', 'vi-VN', 'fr'])).toBe('vi')
  })

  it('falls back to Vietnamese when nothing matches', () => {
    expect(preferredLocale(['de', 'ja', 'ko'])).toBe('vi')
    expect(preferredLocale([])).toBe('vi')
  })

  it('is not confused by junk', () => {
    expect(preferredLocale(['', '-', '---', 'constructor'])).toBe('vi')
  })
})
