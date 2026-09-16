import { describe, expect, it } from 'vitest'
import type { CompiledAnnotation } from '../../lib/content-types.ts'
import { locales } from '../../lib/locale.ts'
import { announcementOf, localiseAnnotation } from './annotation.ts'

const ALL_THREE: CompiledAnnotation = { vi: 'tiếng Việt', en: 'English', fr: 'français' }
const VIETNAMESE_ONLY: CompiledAnnotation = { vi: 'chỉ tiếng Việt' }

describe('choosing the language a node speaks (AC 4)', () => {
  it.each([...locales])('uses %s when %s is there', (locale) => {
    expect(localiseAnnotation(ALL_THREE, locale)).toStrictEqual({
      text: ALL_THREE[locale],
      locale,
      untranslated: false,
    })
  })

  it('falls back to Vietnamese and says so', () => {
    expect(localiseAnnotation(VIETNAMESE_ONLY, 'fr')).toStrictEqual({
      text: 'chỉ tiếng Việt',
      locale: 'vi',
      untranslated: true,
    })
  })

  it('does not mark Vietnamese as untranslated on a Vietnamese page', () => {
    expect(localiseAnnotation(VIETNAMESE_ONLY, 'vi')).toStrictEqual({
      text: 'chỉ tiếng Việt',
      locale: 'vi',
      untranslated: false,
    })
  })

  /**
   * A translator who empties a field has not translated it. Rendering the empty string
   * would leave a blank panel, which is the one outcome requirement F9 rules out.
   */
  it('treats an emptied translation as absent rather than as a translation', () => {
    expect(localiseAnnotation({ vi: 'có', en: '' }, 'en')).toStrictEqual({
      text: 'có',
      locale: 'vi',
      untranslated: true,
    })
  })

  it('never returns a blank string, whatever is asked for', () => {
    for (const locale of locales) {
      expect(localiseAnnotation(VIETNAMESE_ONLY, locale).text).not.toBe('')
    }
  })
})

describe('what the live region says when the position changes', () => {
  const WORDS = { capture: 'capture', check: 'check', checkmate: 'checkmate' }

  it('says the ply, and nothing else, for a quiet move', () => {
    expect(announcementOf('Nf3', WORDS)).toBe('Nf3')
  })

  it('says a capture', () => {
    expect(announcementOf('Nxe5', WORDS)).toBe('Nxe5, capture')
  })

  it('says a check', () => {
    expect(announcementOf('Qh5+', WORDS)).toBe('Qh5+, check')
  })

  it('says a capture that checks, in that order', () => {
    expect(announcementOf('Qxe5+', WORDS)).toBe('Qxe5+, capture, check')
  })

  /** Never "mate" for something that is merely check (docs/design-system.md §7). */
  it('says checkmate rather than check when the ply mates', () => {
    expect(announcementOf('Nd5#', WORDS)).toBe('Nd5#, checkmate')
    expect(announcementOf('Nd5#', WORDS)).not.toContain('check,')
  })

  it('says a capture that mates', () => {
    expect(announcementOf('Qxf7#', WORDS)).toBe('Qxf7#, capture, checkmate')
  })

  it('speaks the visitor language around notation that is never localised', () => {
    expect(
      announcementOf('Qh5+', { capture: 'ăn quân', check: 'chiếu', checkmate: 'chiếu hết' }),
    ).toBe('Qh5+, chiếu')
  })

  it('does not call castling a capture', () => {
    expect(announcementOf('O-O-O', WORDS)).toBe('O-O-O')
  })
})
