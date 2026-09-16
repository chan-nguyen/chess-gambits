// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseGames } from '@mliebelt/pgn-parser'
import { describe, expect, it } from 'vitest'
import { exportPgn } from './pgn-export.ts'
import { importPgn } from './pgn-import.ts'
import type { ImportOptions } from './pgn-import.ts'
import type { Entry } from './types.ts'
import { validateText } from './validate.ts'

/**
 * AC 2. `npm run export-pgn` regenerates a PGN from the YAML so a line can be round-tripped
 * through a board GUI.
 *
 * The thing being tested is whether a GUI could actually open the result, so the assertions
 * are about PGN the format rather than about a string: the tag roster is there, variations
 * sit where a reader expects them, and the output parses back into the same tree. Everything
 * the model carries that PGN has no field for goes into the comment, because a `dismissed`
 * reply that silently vanished on the way to a board is an omission the author would then
 * never see again.
 */

const fixture = (name: string): Entry => {
  const path = fileURLToPath(new URL(`./fixtures/valid/${name}`, import.meta.url))
  const report = validateText(name, readFileSync(path, 'utf8'))
  if (report.entry === undefined) throw new Error(`${name} did not validate`)
  return report.entry
}

const taught = fixture('taught-entry.yaml')
const transposition = fixture('mapped-transposition.yaml')

const importOptions: ImportOptions = {
  id: 'round-trip',
  name: undefined,
  eco: 'C40',
  side: 'white',
  category: 'trap',
  soundness: 'sound',
  author: 'fixture-author',
  today: '2026-09-16',
  definingPlies: undefined,
}

describe('the tag pairs', () => {
  it('writes the seven tag roster, in the order the format requires', () => {
    const names = [...exportPgn(taught).matchAll(/^\[(\w+) /gm)].map((match) => match[1])

    expect(names.slice(0, 7)).toStrictEqual([
      'Event',
      'Site',
      'Date',
      'Round',
      'White',
      'Black',
      'Result',
    ])
  })

  it('carries the entry name, its ECO code and who made the judgements', () => {
    const pgn = exportPgn(taught)

    expect(pgn).toContain(`[Event "${taught.name}"]`)
    expect(pgn).toContain('[ECO "C40"]')
    expect(pgn).toContain('[Annotator "fixture-author"]')
  })
})

describe('the movetext', () => {
  it('replays the defining line before the tree', () => {
    expect(exportPgn(taught)).toContain('1. e4 1... e5 2. Nf3 2... f6 3. Nxe5')
  })

  it('puts a branch in parentheses, immediately after the move it replaces', () => {
    const pgn = exportPgn(taught)

    // 6... Kxe8 is the modelled reply; 6... Kf6 is the other branch at the same ply.
    expect(pgn).toMatch(/6\.\.\. Kxe8 \$3\s*\{[\s\S]*?\}\s*\(6\.\.\. Kf6 \$4/)
  })

  it('writes a reply quality back as its NAG', () => {
    expect(exportPgn(taught)).toContain('$3')
    expect(exportPgn(taught)).toContain('$4')
  })

  it('writes an unexplored leaf as a comment rather than as nothing', () => {
    const pgn = exportPgn(fixture('listed-entry.yaml'))

    expect(pgn).toContain('{')
    expect(pgn).toContain('Not yet mapped.')
  })

  it('writes dismissed replies into the comment, where the author can still see them', () => {
    const pgn = exportPgn(taught)

    expect(pgn).toContain('Dismissed replies: Qxe8')
    expect(pgn).toContain('Also takes the queen')
  })

  it('writes a transposition target, which PGN has no way to express', () => {
    expect(exportPgn(transposition)).toContain('Transposes to:')
  })

  it('ends the movetext with an unfinished-game result', () => {
    expect(exportPgn(taught).trimEnd().endsWith('*')).toBe(true)
  })

  it('wraps at 80 columns, as the export format asks', () => {
    const overLong = exportPgn(taught)
      .split('\n')
      .filter((line) => line.length > 80 && !line.includes('{'))

    expect(overLong).toStrictEqual([])
  })
})

describe('prose that could break the format', () => {
  /**
   * A PGN comment is delimited by braces and cannot contain a closing one. Annotation prose
   * is written by a human in a text editor, so a stray brace is a matter of time — and one
   * closing brace early would end the comment and turn the rest of a sentence into moves.
   */
  it('strips braces out of prose rather than emitting an unparseable comment', () => {
    const yaml = readFileSync(
      fileURLToPath(new URL('./fixtures/valid/listed-entry.yaml', import.meta.url)),
      'utf8',
    ).replace(/vi: (.*)/, 'vi: Cấu trúc {tốt} bị phá vỡ }')
    const report = validateText('braces.yaml', yaml)
    if (report.entry === undefined) throw new Error(report.issues.map((i) => i.message).join('\n'))

    const pgn = exportPgn(report.entry)

    expect(pgn).toContain('Cấu trúc tốt bị phá vỡ')
    expect(() => parseGames(pgn)).not.toThrow()
  })
})

describe('the round trip a board GUI makes', () => {
  it('parses back with the parser that reads real PGN', () => {
    const games = parseGames(exportPgn(taught))

    expect(games).toHaveLength(1)
    expect(games[0]?.moves.length).toBeGreaterThan(0)
  })

  it('comes back through import with the same moves and the same branches', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./fixtures/pgn/damiano-two-branches.pgn', import.meta.url)),
      'utf8',
    )
    const first = importPgn(source, importOptions)
    if (!first.ok) throw new Error(first.problem.message)
    const entry = validateText('first.yaml', first.yaml).entry
    if (entry === undefined) throw new Error('the imported YAML did not validate')

    const again = importPgn(exportPgn(entry), importOptions)
    if (!again.ok) throw new Error(again.problem.message)
    const back = validateText('again.yaml', again.yaml).entry

    expect(back?.definingLine).toStrictEqual(entry.definingLine)
    expect(back?.tree.children.map((child) => child.ply)).toStrictEqual(['g6', 'Ke7'])
    expect(back?.tree.children.map((child) => child.replyQuality)).toStrictEqual([
      'mistake',
      'blunder',
    ])
  })

  /**
   * The lossiness is the design, not a defect: the YAML is the only source of truth, so the
   * export exists to put *moves* on a board and nothing else. Stating it as a test keeps a
   * future change from quietly treating a re-import as a way to edit content — the gate
   * would then reject the result, which is exactly what the last assertion here shows.
   */
  it('does not carry assessments or dismissals back, which is why the YAML stays the source', () => {
    const reimported = importPgn(exportPgn(taught), {
      ...importOptions,
      id: 'fixture-taught-entry',
      soundness: 'unsound',
      definingPlies: taught.definingLine.length,
    })
    if (!reimported.ok) throw new Error(reimported.problem.message)

    expect(reimported.yaml).not.toContain('type: position')
    expect(reimported.yaml).not.toContain('dismissed:')
    // And so the gate refuses it, rather than accepting a tree with replies gone missing.
    const report = validateText('reimported.yaml', reimported.yaml)
    expect(report.issues.map((issue) => issue.code)).toContain('reply-incomplete')
  })
})
