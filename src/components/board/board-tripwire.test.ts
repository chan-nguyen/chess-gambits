import { describe, expect, it } from 'vitest'
import boardSource from './Board.tsx?raw'
import modelSource from './board-model.ts?raw'
import spriteSource from './piece-sprite.tsx?raw'
import styleSource from './Board.css?raw'
import manifestSource from '../../../package.json?raw'

/**
 * ADR-0003's tripwire, measured.
 *
 * The ADR accepted a real maintenance obligation on the condition that it stays bounded:
 * "if the board exceeds roughly 400 lines or starts growing rules logic, that is the
 * signal it was the wrong call", with `cm-chessboard` pre-selected as the fallback. A
 * tripwire nobody measures is a wish, so this file measures it.
 */

/** Everything the application ships. The rest of the directory is tests and fixtures. */
const SHIPPED: Readonly<Record<string, string>> = {
  'Board.tsx': boardSource,
  'board-model.ts': modelSource,
  'piece-sprite.tsx': spriteSource,
  'Board.css': styleSource,
}

const MODULES = Object.entries(SHIPPED)
  .filter(([file]) => !file.endsWith('.css'))
  .map(([file, text]) => ({ file, text }))

const lineCount = (text: string): number => text.split('\n').length

/**
 * Lines of code, with comments and blanks removed. The tripwire is aimed at complexity,
 * so explaining a decision must never be the thing that trips it.
 */
const codeLineCount = (text: string): number =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('//')).length

describe('the board stays under 400 lines (AC 9)', () => {
  it('holds the component itself under the limit', () => {
    expect(lineCount(boardSource)).toBeLessThan(400)
  })

  /**
   * Counted together as well as separately, because a limit on one file is trivially
   * evaded by opening a second. ADR-0003 bounds "the board", not one file of it, so the
   * component, the model and the sprite have to fit the budget between them.
   */
  it('holds the whole shipped board under the limit', () => {
    const total = MODULES.map(({ text }) => codeLineCount(text)).reduce((sum, n) => sum + n, 0)
    expect(total).toBeLessThan(400)
  })

  /** So a fourth module cannot appear and quietly carry the overflow. */
  it('ships exactly the modules this test measures', () => {
    const present = Object.keys(import.meta.glob('./*.{ts,tsx,css}'))
      .map((path) => path.replace('./', ''))
      .filter((file) => !file.includes('.test.'))
      .filter((file) => !file.includes('fixtures'))
      .sort()
    expect(present).toStrictEqual(Object.keys(SHIPPED).sort())
  })
})

describe('the board does not know chess (AC 8)', () => {
  it.each(MODULES)('$file imports no chess engine', ({ text }) => {
    expect(text).not.toMatch(/from\s+['"]chess\.js['"]/)
    expect(text).not.toMatch(/require\(['"]chess\.js['"]\)/)
  })

  it('declares no dependency on a chess library', () => {
    for (const library of ['chess.js', 'react-chessboard', 'chessground', 'cm-chessboard']) {
      expect(manifestSource).not.toContain(library)
    }
  })

  it.each(MODULES)('$file wires up no drag and no move input', ({ text }) => {
    for (const forbidden of [
      'onDragStart',
      'onDragOver',
      'onDragEnd',
      'onDrop',
      'draggable',
      'PointerEvent',
      'onMouseDown',
      'onTouchStart',
    ]) {
      expect(text).not.toContain(forbidden)
    }
  })

  it.each(MODULES)('$file carries no rules logic', ({ text }) => {
    for (const forbidden of ['legalMove', 'isCheck', 'generateMoves', 'makeMove', 'castl']) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })
})

describe('the conventions this repository sets', () => {
  it.each(MODULES)('$file uses no assertion, no any and no non-null', ({ text }) => {
    expect(text).not.toMatch(/\bas\s+[A-Z]/)
    expect(text).not.toMatch(/\bas\s+const\b/)
    expect(text).not.toMatch(/:\s*any\b/)
    expect(text).not.toMatch(/\beslint-disable\b/)
    expect(text).not.toMatch(/@ts-(ignore|expect-error)/)
  })

  it('uses only design tokens for colour, and no raw values', () => {
    const withoutComments = styleSource.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(withoutComments).not.toMatch(/\brgba?\(/)
    expect(withoutComments).not.toMatch(/\d+px/)
  })
})
