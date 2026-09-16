import { describe, expect, it } from 'vitest'
import { defaultFilter, type CatalogueFilter } from './filter.ts'
import { maxQueryLength, readFilter, writeFilter } from './filter-url.ts'

/**
 * The filter is in the URL and nowhere else, so this module is the filter's entire state.
 * Everything below is therefore a claim about what a *visitor* can do: share a view, press
 * Back, or hand-edit the address bar — which is the case that matters, because a URL is
 * attacker-controlled (docs/security.md, B4).
 */

const read = (search: string): CatalogueFilter => readFilter(new URLSearchParams(search))
const write = (filter: CatalogueFilter): string => writeFilter(filter).toString()

describe('reading a filter out of a URL', () => {
  it('reads every parameter', () => {
    expect(read('q=evans&side=black&category=trap&soundness=unsound&tier=all')).toEqual({
      q: 'evans',
      side: 'black',
      category: 'trap',
      soundness: 'unsound',
      tier: 'all',
    })
  })

  it('reads a bare catalogue URL as the default view', () => {
    expect(read('')).toEqual(defaultFilter)
  })

  /**
   * **AC 5, at the boundary that decides it.** `/vi/gambits` with nothing on it is the
   * depth-first view; the breadth of the index is something a visitor asks for.
   */
  it('defaults the depth to Taught when the parameter is absent', () => {
    expect(read('q=evans').tier).toBe('taught')
  })

  it('defaults the depth to Taught when the parameter is nonsense, rather than erroring', () => {
    expect(read('tier=everything').tier).toBe('taught')
    expect(read('tier=').tier).toBe('taught')
  })

  /**
   * A hand-edited value reads as "not filtered". A person who typed `?side=wihte` wants the
   * catalogue, not a diagnostic — and a value outside the closed set must not reach a
   * comparison that would silently match nothing forever.
   */
  it.each([
    'side=wihte',
    'side=WHITE',
    'side[]=white',
    'category=opening',
    'soundness=great',
    'side=__proto__',
  ])('reads %p as unfiltered', (search) => {
    expect(read(search)).toMatchObject({ side: null, category: null, soundness: null })
  })

  it('truncates a query long enough to be a payload rather than a term', () => {
    const long = 'a'.repeat(maxQueryLength + 500)

    expect(read(`q=${long}`).q).toHaveLength(maxQueryLength)
  })

  it('takes the first value when a parameter is repeated', () => {
    expect(read('side=white&side=black').side).toBe('white')
  })
})

describe('writing a filter back into a URL', () => {
  it('omits every default, so a shared link is short and canonical', () => {
    expect(write(defaultFilter)).toBe('')
  })

  it('writes only what is set', () => {
    expect(write({ ...defaultFilter, side: 'black' })).toBe('side=black')
  })

  it('writes the depth only when it is not the default', () => {
    expect(write({ ...defaultFilter, tier: 'all' })).toBe('tier=all')
    expect(write({ ...defaultFilter, tier: 'taught' })).toBe('')
  })

  /**
   * The regression this module was rewritten for. The URL is the search box's only state,
   * so a trim on the way out deletes the space in "evans gambit" the instant it is typed
   * and leaves the next letter stuck to the previous word.
   */
  it('keeps a space the visitor typed in the middle of a term', () => {
    expect(read(write({ ...defaultFilter, q: 'evans ' })).q).toBe('evans ')
    expect(read(write({ ...defaultFilter, q: 'evans gambit' })).q).toBe('evans gambit')
  })

  it('still leaves a blank query out of the URL', () => {
    expect(write({ ...defaultFilter, q: '   ' })).toBe('')
  })
})

describe('round-tripping', () => {
  const filters: readonly CatalogueFilter[] = [
    defaultFilter,
    { q: 'phòng thủ', side: 'black', category: 'trap', soundness: 'dubious', tier: 'all' },
    { q: '', side: null, category: null, soundness: null, tier: 'mapped' },
    { q: 'C51', side: 'white', category: 'gambit', soundness: 'sound', tier: 'taught' },
    { q: 'a b c', side: null, category: null, soundness: null, tier: 'all' },
  ]

  /**
   * What makes a filtered view a link. If this ever failed, the language switcher — which
   * carries the query string across untouched — would silently change the view as well as
   * the language.
   */
  it.each(filters)('survives a write and a read: %o', (filter) => {
    expect(read(write(filter))).toEqual(filter)
  })
})
