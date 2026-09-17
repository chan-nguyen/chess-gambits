import { describe, expect, it } from 'vitest'
import { MAX_SPELLED, capitalise, spellNumber } from './numerals.ts'
import type { Locale } from './types.ts'

/**
 * **The last step between a verified number and the word a learner reads** (review addition).
 *
 * ADR-0011 makes a counted claim derived: the validator replays the position, refuses a
 * figure the board disagrees with, and substitutes the real one into the sentence. Every part
 * of that is checked except the last — `spellNumber` turns the verified integer into prose,
 * and it had no test of its own.
 *
 * The failure that matters here is not a missing entry, which would be loud: `spellNumber`
 * returning `undefined` makes the validator refuse the claim. It is a **collision**. Two
 * different counts spelling the same word renders a wrong figure in a lesson with every gate
 * green — which is #77's own defect, moved one layer down and made invisible to the gate
 * built to catch it.
 *
 * So uniqueness within a locale is the assertion with teeth. Totality and the bound are here
 * because they are cheap and they keep the uniqueness check honest: a table that answered
 * `undefined` for most of its range would be trivially collision-free.
 */
describe('a count is spelled before a learner reads it', () => {
  const locales: readonly Locale[] = ['vi', 'en', 'fr']
  const ALL = [...Array.from({ length: MAX_SPELLED + 1 }).keys()]

  it.each([...locales])('%s spells every count a legal position can produce', (locale) => {
    const missing = ALL.filter((n) => (spellNumber(n, locale) ?? '').trim() === '')

    expect(missing, 'a gap makes the validator refuse a claim that is actually true').toStrictEqual(
      [],
    )
  })

  /** The one that renders a wrong number with nothing going red. */
  it.each([...locales])('%s spells no two counts the same', (locale) => {
    const byWord = new Map<string, number>()
    const clashes: string[] = []

    for (const n of ALL) {
      const word = spellNumber(n, locale) ?? ''
      const first = byWord.get(word)
      if (first === undefined) byWord.set(word, n)
      else clashes.push(`${first} and ${n} are both "${word}"`)
    }

    expect(clashes).toStrictEqual([])
  })

  it.each([...locales])('%s refuses a count past the bound, rather than falling back', (locale) => {
    expect(spellNumber(MAX_SPELLED + 1, locale)).toBeUndefined()
    expect(spellNumber(218, locale)).toBeUndefined()
  })

  /**
   * The irregular forms, named rather than swept up by the sweeps above. Each is a place the
   * language stops being `tens + ones`, and a table can be complete and collision-free while
   * being wrong at exactly these points.
   */
  it('writes the forms that are not tens plus ones', () => {
    expect(spellNumber(15, 'vi')).toBe('mười lăm')
    expect(spellNumber(21, 'vi')).toBe('hai mươi mốt')
    expect(spellNumber(24, 'vi')).toBe('hai mươi tư')
    expect(spellNumber(21, 'fr')).toBe('vingt et un')
    expect(spellNumber(71, 'fr')).toBe('soixante et onze')
    expect(spellNumber(80, 'fr')).toBe('quatre-vingts')
    expect(spellNumber(81, 'fr')).toBe('quatre-vingt-un')
  })

  it('capitalises a word that opens a sentence without touching the rest of it', () => {
    expect(capitalise('twenty-three', 'en')).toBe('Twenty-three')
    expect(capitalise('hai mươi ba', 'vi')).toBe('Hai mươi ba')
    expect(capitalise('vingt-trois', 'fr')).toBe('Vingt-trois')
  })
})
