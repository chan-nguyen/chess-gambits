// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'
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
    expect(taught.tree.kind).toBe('opponent')
    expect(taught.tree.children?.[0]?.kind).toBe('learner')
    expect(everyNode(taught.tree).every((node) => node.kind !== undefined)).toBe(true)
  })

  /**
   * The prelude (#70): the boards for the walk from the initial position to the root.
   *
   * Derived here for the same reason every node's FEN is — the browser has no rules engine,
   * so a position it is not handed is a position it cannot draw, and a position it is handed
   * by anything other than the replay that validated the line is a position that can drift
   * from the moves beside it.
   */
  it('gives the defining line a board per ply, plus the initial position', () => {
    expect(taught.prelude).toHaveLength(taught.definingLine.length + 1)
    expect(taught.prelude[0]).toStrictEqual({ fen: new Chess().fen() })
    expect(taught.prelude.every((step) => step.fen.split(' ').length === 6)).toBe(true)
  })

  /**
   * The join. The root *is* the position after the defining line, so if these two disagree
   * the walk has a hole in it precisely where the two halves are supposed to meet — and a
   * learner pressing next at the last defining-line ply would arrive at a different board
   * from the one the ply produced.
   */
  it('ends the prelude exactly where the tree begins', () => {
    for (const entry of [taught, listed, transposition]) {
      expect(entry.prelude[entry.prelude.length - 1]?.fen).toBe(entry.tree.fen)
    }
  })

  /** And every board in between is the board its own ply produces, replayed independently. */
  it('derives each prelude board from the ply that reaches it', () => {
    const board = new Chess()

    for (const [index, ply] of taught.definingLine.entries()) {
      board.move(ply)
      expect(taught.prelude[index + 1]).toStrictEqual({ ply, fen: board.fen() })
    }
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

    /*
     * The *root* carries no ply, and the check is scoped to the tree since #70: the prelude
     * is a list of plies and every one of them is present, so a whole-document search for
     * `"ply"` stopped answering the question this test is asking. The prelude's own absent
     * ply — the initial position, which no move reached — is asserted directly below.
     */
    expect(JSON.stringify(listed.tree)).not.toContain('"ply"')
    expect(listed.prelude[0]).toStrictEqual({ fen: listed.prelude[0]?.fen })
  })

  it('omits an empty `dismissed` and an empty `children` on every leaf', () => {
    const json = compiledJson(taught)

    expect(json).not.toContain('[]')
    expect(json).not.toContain('"children":{}')
  })

  it('keeps `dismissed`, `replyQuality` and `frequency` where they exist', () => {
    const first = taught.tree.children?.[0]?.children?.[0]

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
