// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compileEntry, compiledJson } from './compile.ts'
import type { Entry } from './types.ts'
import { validateText } from './validate.ts'
import type { CompiledNode } from '../../src/lib/content-types.ts'

/**
 * AC 3. Validated content becomes minified JSON, one file per entry, carrying the FENs, the
 * derived `kind` and the derived tier.
 *
 * The last test pins a checked-in copy of this output byte for byte. `src/lib/content.test.ts`
 * then feeds that copy to the browser's runtime guard, so the two halves — a compiler in
 * `tools/` and a guard in `src/` written against separate type declarations — are held to
 * one shape without either directory importing the other's runtime code.
 */

const fixture = (name: string): Entry => {
  const path = fileURLToPath(new URL(`./fixtures/valid/${name}`, import.meta.url))
  const report = validateText(name, readFileSync(path, 'utf8'))
  if (report.entry === undefined) throw new Error(`${name} did not validate`)
  return report.entry
}

const taught = compileEntry(fixture('taught-entry.yaml'))
const listed = compileEntry(fixture('listed-entry.yaml'))
const transposition = compileEntry(fixture('mapped-transposition.yaml'))

const everyNode = (node: CompiledNode): readonly CompiledNode[] => [
  node,
  ...(node.children ?? []).flatMap(everyNode),
]

describe('what the build derives and the content may not state', () => {
  it('gives every node a FEN', () => {
    const fens = everyNode(taught.tree).map((node) => node.fen)

    expect(fens.length).toBeGreaterThan(3)
    expect(fens.every((fen) => fen.split(' ').length === 6)).toBe(true)
  })

  it('gives every node its derived kind, alternating with the side to move', () => {
    expect(taught.tree.kind).toBe('learner')
    expect(taught.tree.children?.[0]?.kind).toBe('opponent')
    expect(everyNode(taught.tree).every((node) => node.kind !== undefined)).toBe(true)
  })

  it('carries the derived tier', () => {
    expect(taught.tier).toBe('taught')
    expect(listed.tier).toBe('listed')
    expect(transposition.tier).toBe('mapped')
  })
})

describe('what it drops, because JSON cannot say it', () => {
  it('omits an absent field rather than shipping a null', () => {
    const json = compiledJson(listed)

    expect(json).not.toContain('null')
    expect(json).not.toContain('"ply"')
  })

  it('omits an empty `dismissed` and an empty `children` on every leaf', () => {
    const json = compiledJson(taught)

    expect(json).not.toContain('[]')
    expect(json).not.toContain('"children":{}')
  })

  it('keeps `dismissed`, `replyQuality` and `frequency` where they exist', () => {
    const first = taught.tree.children?.[0]

    expect(first?.dismissed).toStrictEqual([
      {
        ply: 'Qxe8',
        reason:
          'Also takes the queen, reaching the same material balance as Kxe8, which is modelled.',
      },
    ])
    expect(first?.children?.[0]?.replyQuality).toBe('best')
    expect(first?.children?.[0]?.frequency).toBe('common')
  })

  it('keeps a transposition target', () => {
    const transposing = everyNode(transposition.tree).find(
      (node) => node.transposesTo !== undefined,
    )

    expect(transposing?.transposesTo?.length).toBeGreaterThan(0)
    expect(transposing?.children).toBeUndefined()
  })
})

describe('the payload', () => {
  it('is minified: no indentation and no spacing', () => {
    const json = compiledJson(taught)

    expect(json).not.toContain('\n')
    expect(json).not.toContain('": "')
  })

  it('round-trips through the serialiser unchanged', () => {
    expect(JSON.parse(compiledJson(taught))).toStrictEqual(taught)
  })
})

describe('the committed fixture the browser tests load', () => {
  /**
   * `src/lib/content.test.ts` feeds a checked-in copy of this output to the loader, so that
   * the browser tests never have to import the build pipeline. That copy is only worth
   * anything while it is byte-for-byte what the compiler emits today.
   */
  it('is exactly what the compiler produces from the same fixture', () => {
    const committed = readFileSync(
      fileURLToPath(new URL('./fixtures/compiled/taught-entry.json', import.meta.url)),
      'utf8',
    )

    expect(committed.trim()).toBe(compiledJson(taught))
  })
})
