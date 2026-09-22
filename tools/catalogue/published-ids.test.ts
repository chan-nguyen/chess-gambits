import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishedGambitIds } from './published-ids.ts'

/**
 * The list the shell generator works from, and every way a file can fail to be one.
 *
 * This is the input to a loop that writes 2,100 files into `dist/`, so the refusals below
 * are not defensive decoration. An id with a `..` in it would write outside the output
 * directory; a file that parses but has no entries would emit no gambit shells at all and
 * print a cheerful success line while every link on the catalogue page 404s.
 */

const catalogue = (entries: readonly unknown[]): string =>
  JSON.stringify({ locale: 'vi', families: [{ id: 'f', name: 'F', entries }] })

const entry = (id: string): unknown => ({ id, variation: '', eco: 'C51' })

describe('reading published ids', () => {
  it('returns every entry id across every family, in file order', () => {
    const json = JSON.stringify({
      families: [
        { id: 'a', entries: [entry('evans-gambit'), entry('italian-game')] },
        { id: 'b', entries: [entry('kings-gambit')] },
      ],
    })

    expect(publishedGambitIds(json)).toEqual({
      ok: true,
      ids: ['evans-gambit', 'italian-game', 'kings-gambit'],
    })
  })

  it('accepts a family with no entries rather than calling the file broken', () => {
    expect(publishedGambitIds(JSON.stringify({ families: [{ id: 'a', entries: [] }] }))).toEqual({
      ok: true,
      ids: [],
    })
  })
})

describe('a file that is not a catalogue', () => {
  /**
   * The realistic one. A static host answering a missing file with an HTML 404 page, or a
   * half-written file from an interrupted build, both arrive here as a string.
   */
  it('refuses an HTML page', () => {
    const result = publishedGambitIds('<!doctype html><title>404</title>')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('not JSON')
  })

  it('refuses JSON with no families', () => {
    const result = publishedGambitIds('{"locale":"vi"}')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('families')
  })

  it('refuses a family with no entries array', () => {
    const result = publishedGambitIds(JSON.stringify({ families: [{ id: 'a' }] }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('entries')
  })

  it('refuses an entry with no id', () => {
    const result = publishedGambitIds(catalogue([{ variation: 'Evans Gambit' }]))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('`id`')
  })
})

describe('an id that is not a slug', () => {
  /**
   * Each of these would become a path segment under `dist/`. The first two escape the
   * output directory outright; the rest are simply not ids this project mints, and an id
   * shape that is checked only sometimes is a shape that is not checked.
   */
  it.each([
    '..',
    '../../etc/passwd',
    'a/b',
    'Evans-Gambit',
    'evans_gambit',
    '-evans',
    'evans-',
    '',
    'a'.repeat(65),
  ])('refuses %p', (id) => {
    const result = publishedGambitIds(catalogue([entry(id)]))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('slug')
  })

  it('accepts the shape the id minter produces', () => {
    expect(publishedGambitIds(catalogue([entry('a'.repeat(64))])).ok).toBe(true)
    expect(publishedGambitIds(catalogue([entry('kings-gambit-accepted-1')])).ok).toBe(true)
  })
})

describe('duplicate ids', () => {
  it('are refused, because the reported shell count would stop meaning anything', () => {
    const result = publishedGambitIds(catalogue([entry('evans-gambit'), entry('evans-gambit')]))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain('distinct')
  })
})

describe('the catalogue this repository builds', () => {
  /**
   * Run against the real generated file rather than a fixture, because the thing being
   * checked is that the shell generator can read *this* build's output. It is generated,
   * so a missing file means `npm run catalogue` has not run — which is what the message
   * says rather than a cryptic ENOENT.
   */
  const path = join('public', 'catalogue', 'catalogue.vi.json')
  let json: string
  try {
    json = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`${path} is missing. Run \`npm run catalogue\` first.`)
  }

  it('reads back 1024 published ids', () => {
    const result = publishedGambitIds(json)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.ids).toHaveLength(1024)
    expect(result.ids).toContain('italian-game-evans-gambit')
  })
})
