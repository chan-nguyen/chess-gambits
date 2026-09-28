import { describe, expect, it } from 'vitest'
import { flipParam, orient, parseFlip, withFlip } from './flip.ts'
import { lineSearch } from './line.ts'

describe('reading `flip`', () => {
  it('flips on exactly `1`', () => {
    expect(parseFlip('1')).toBe(true)
  })

  it.each([null, '', '0', 'true', 'yes', '11'])('reads %j as the default', (raw) => {
    expect(parseFlip(raw)).toBe(false)
  })
})

describe('the side at the bottom', () => {
  it("is the page's default until flipped", () => {
    expect(orient('white', false)).toBe('white')
    expect(orient('black', false)).toBe('black')
  })

  it('is the other side when flipped, whichever side the default was', () => {
    expect(orient('white', true)).toBe('black')
    expect(orient('black', true)).toBe('white')
  })
})

describe('writing `flip` into a search', () => {
  it('adds nothing to an unflipped board', () => {
    expect(withFlip('', false)).toBe('')
    expect(withFlip('?line=e4', false)).toBe('?line=e4')
  })

  it('starts the query string when there is none, and joins it when there is', () => {
    expect(withFlip('', true)).toBe(`?${flipParam}=1`)
    expect(withFlip('?line=e4', true)).toBe(`?line=e4&${flipParam}=1`)
  })

  it('replaces a flip already there rather than adding a second', () => {
    expect(withFlip('?flip=1&line=e4', true)).toBe('?line=e4&flip=1')
    expect(withFlip('?line=e4&flip=1', false)).toBe('?line=e4')
    expect(withFlip('?flip=0', true)).toBe('?flip=1')
    expect(withFlip('?flip', false)).toBe('')
  })

  /**
   * The reason it does not round-trip through `URLSearchParams`: `line` is percent-encoded as
   * a whole, and a check move's `+` must stay `%2B` or it reads back as a space.
   */
  it('leaves every other parameter spelled exactly as it was', () => {
    const search = lineSearch(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'])
    expect(withFlip(search, true)).toBe(`${search}&flip=1`)
    expect(withFlip(`${search}&flip=1`, false)).toBe(search)
  })

  it('does not mistake a parameter that merely starts with the same letters', () => {
    expect(withFlip('?flipped=1', false)).toBe('?flipped=1')
  })
})
