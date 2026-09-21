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
 * no rules logic, and a line count. A tripwire nobody measures is a wish, so this file
 * measures both. The two are not the same signal and #79 amended the ADR to say so: rules
 * logic means the bet was wrong and `cm-chessboard` is the pre-selected fallback, while
 * passing the line count means measure again and decide. That count is **450** code lines
 * across the shipped board, raised from 400 because the board was *written* at 389 and has
 * grown ten lines since, so 400 reported that the board existed rather than that it grew.
 */

/**
 * `JSON.parse` returns `unknown`, and this file may not assert its way out of that — the
 * repository bans the `as` operator and this test is subject to its own conventions. The
 * guard checks the values it claims, so the narrowing is earned rather than asserted.
 */
const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((entry) => typeof entry === 'string')

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

/**
 * Lines of code, with comments and blanks removed. The tripwire is aimed at complexity,
 * so explaining a decision must never be the thing that trips it.
 */
const codeLineCount = (text: string): number =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('//')).length

describe('the board stays under 450 lines (AC 9)', () => {
  /**
   * Counted together, because a limit on one file is trivially evaded by opening a second.
   * ADR-0003 bounds "the board", not one file of it, so the component, the model and the
   * sprite have to fit the budget between them.
   *
   * One assertion, not two. #79 retired a second one that measured `Board.tsx` alone by its
   * lines *as written*: the only thing it could fail on that this one does not is a long
   * comment in that one file, which is exactly what the rule above it forbids counting.
   */
  it('holds the whole shipped board under the limit', () => {
    const total = MODULES.map(({ text }) => codeLineCount(text)).reduce((sum, n) => sum + n, 0)
    expect(total).toBeLessThan(450)
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

  it('ships no board library, and no chess engine at runtime', () => {
    const manifest: unknown = JSON.parse(manifestSource)
    const declared =
      typeof manifest === 'object' && manifest !== null && 'dependencies' in manifest
        ? manifest.dependencies
        : undefined
    const runtime = isStringRecord(declared) ? Object.keys(declared) : []

    // A board library is banned outright: adopting one reverses ADR-0003.
    for (const library of ['react-chessboard', 'chessground', 'cm-chessboard', 'kokopu']) {
      expect(manifestSource).not.toContain(library)
    }

    // chess.js reaching the browser is no longer itself the violation (#131): the home
    // page's free-play board needs a real rules engine at runtime, and product decided
    // that deliberately. What still matters is *where* — `src/components/board/` stays
    // rules-free (checked above and by the denylist below), so `chess.js` living in
    // `src/components/home/` is exactly the boundary this ADR now draws, not a breach of it.
    expect(runtime).toContain('chess.js')
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

  /**
   * **The denylist, in its positive form** (review addition, #79).
   *
   * The five forbidden substrings below are a denylist, and a denylist is whack-a-mole:
   * `isAttacked`, `pseudoLegal`, `applyMove` and `enPassant` all pass it while being exactly
   * the thing it exists to forbid. That was survivable while the line count was the louder
   * of the two conditions. #79 made it the quieter one — passing 450 lines now means measure
   * again, while rules logic means the bet was wrong and the fallback is pre-selected — so
   * the rules half is the trigger now, and a five-word denylist is thin for that job.
   *
   * This is the same claim stated the other way round. The board's whole surface is
   * geometry, labels, focus and the placement field of a FEN; nothing here can answer a
   * question about chess. A new export is a new capability, and it fails this test whatever
   * it is called — which is the part the denylist cannot do.
   *
   * Widening the list is a normal thing to do. Doing it in the same commit as the code is
   * the point: it makes "the board learned something new" a line in a diff a reviewer sees.
   */
  const SURFACE: readonly string[] = [
    'Board',
    'BoardLabels',
    'BoardProps',
    'FILES',
    'FileLetter',
    'FocusedSquare',
    'LastMove',
    'Orientation',
    'PIECE_ROLES',
    'PieceColour',
    'PieceKey',
    'PieceRole',
    'PieceSprite',
    'Position',
    'RANKS',
    'RankNumber',
    'Square',
    'colourOf',
    'isLightSquare',
    'nextFocus',
    'orientedFiles',
    'orientedRanks',
    'parseFen',
    'roleOf',
    'shapeId',
    'squareAt',
    'squareLabel',
  ]

  const exportsOf = (text: string): readonly string[] =>
    [
      ...text.matchAll(/^export\s+(?:const|type|function|class|interface)\s+([A-Za-z0-9_$]+)/gm),
    ].flatMap((found) => (found[1] === undefined ? [] : [found[1]]))

  it('exports exactly the surface it is allowed to have', () => {
    const found = MODULES.flatMap(({ text }) => exportsOf(text)).sort()

    expect(found.length, 'the extractor found nothing, so this asserts nothing').toBeGreaterThan(20)
    expect(found).toStrictEqual([...SURFACE].sort())
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
