import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

/**
 * A translation that is a copy of the source is worse than no translation at all.
 *
 * The content gate measures translation *coverage* and reports `vi 100% en 100% fr 100%`. That
 * counts whether a slot is filled, which is not the same question. Pasting the Vietnamese into
 * the `en:` slot scores the same 100%, and it is the cheapest way for any author — or any agent
 * asked to "translate the file" — to make the number go green.
 *
 * What makes that worse than leaving the slot empty is this project's own design: an untranslated
 * string falls back with a **visible marker**, driven by `returnDetails.usedLng`, so a reader can
 * see they are being shown another language and the site is not pretending otherwise. A copied
 * string defeats that silently. The English reader gets Vietnamese, with no marker, and the site
 * now claims a translation it does not have — on a page whose whole argument is that its claims
 * are checkable.
 *
 * The YAML is walked directly rather than through the loader, because the shortcut would be taken
 * in the authored file and this should keep working as the schema moves.
 */

const CONTENT_DIR = 'content'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Chess notation reads the same in every language — `Nf3` is `Nf3` in Hanoi and in Lyon — so an
 * identical pair that is nothing but notation is correct rather than lazy. Nothing in the content
 * today matches this; it exists so the rule below can stay strict about prose without one day
 * being wrong about a move.
 */
const isBareNotation = (text: string): boolean => /^[KQRBNa-h1-8x+#=O\-\s,.]{1,16}$/.test(text)

type Slot = {
  readonly file: string
  readonly path: string
  readonly locale: 'en' | 'fr'
  readonly text: string
}

const slotsIn = (file: string): readonly Slot[] => {
  const found: Slot[] = []

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        walk(child, `${path}[${index}]`)
      })
      return
    }
    if (!isRecord(node)) return

    const source = node.vi
    if (typeof source === 'string') {
      for (const locale of ['en', 'fr'] as const) {
        const translated = node[locale]
        if (typeof translated === 'string' && translated.trim() === source.trim()) {
          found.push({ file, path: path === '' ? '/' : path, locale, text: source })
        }
      }
    }

    for (const [key, child] of Object.entries(node)) walk(child, `${path}/${key}`)
  }

  walk(parse(readFileSync(join(CONTENT_DIR, file), 'utf8')), '')
  return found
}

const FILES = readdirSync(CONTENT_DIR).filter((name) => name.endsWith('.yaml'))

describe('an annotation is translated, not copied', () => {
  it('has content to check, so a green run means something', () => {
    expect(FILES.length).toBeGreaterThan(0)
  })

  it.each(FILES)('%s says something different in each language', (file) => {
    const copied = slotsIn(file)
      .filter(({ text }) => !isBareNotation(text))
      .map(({ path, locale, text }) => `${path} [${locale}] repeats the Vietnamese: ${text}`)

    expect(copied).toStrictEqual([])
  })

  it('recognises a copy when it sees one', () => {
    // The detector, on a shape it must reject and one it must allow. Without this, the rule
    // above would pass just as happily if the walk found nothing at all.
    expect(isBareNotation('Nf3')).toBe(true)
    expect(isBareNotation('O-O')).toBe(true)
    expect(isBareNotation('Trắng hơn quân và có thế tấn công.')).toBe(false)
    expect(isBareNotation('White is a piece up with an attack.')).toBe(false)
  })
})
