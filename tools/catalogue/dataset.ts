import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import type { CatalogueIssue, CatalogueResult } from './types.ts'

/**
 * Reading the vendored `lichess-org/chess-openings` snapshot (ADR-0008).
 *
 * The dataset is a list of opening **variations**: five tab-separated files of
 * `eco`, `name`, `pgn`. Two things about it are load-bearing downstream and are
 * established here rather than assumed.
 *
 * **Names are not unique.** 3810 rows carry 3174 distinct names — "Italian Game: Evans
 * Gambit" alone appears on 41 rows, each a deeper line of the same opening. A catalogue
 * built one-entry-per-row would publish 41 entries with identical names and no way to
 * tell them apart, which is the "scores of near-identical rows" failure the family
 * grouping exists to prevent, reproduced one level down. Rows are therefore folded by
 * name, keeping the **shortest** line: that is the line that identifies the opening, and
 * it is what `definingLine` means (docs/CONTEXT.md, Gambit).
 *
 * **Move sequences are replayed, never trusted.** Every line is played out on a board and
 * re-spelled in the canonical SAN `chess.js` produces, so the catalogue and the content
 * pipeline cannot disagree about how a move is written. A row whose moves are not legal
 * fails the build naming the file and the line number.
 *
 * Build-time only.
 */

export type DatasetRow = {
  readonly eco: string
  /** The canonical English name, exactly as upstream spells it. */
  readonly name: string
  /** Canonical SAN, replayed from the standard start position. */
  readonly line: readonly string[]
  readonly where: string
}

export type DatasetSource = {
  readonly repository: string
  readonly commit: string
}

const FILES: readonly string[] = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']

const MOVE_NUMBER = /^\d+\.(?:\.\.)?$/

/** `1. e4 e5 2. Nf3` -> `['e4', 'e5', 'Nf3']`, before any legality is checked. */
const splitMoveText = (pgn: string): readonly string[] =>
  pgn.split(/\s+/).filter((token) => token.length > 0 && !MOVE_NUMBER.test(token))

/** A replayed line, in canonical SAN, plus whose turn it is at the end of it. */
export type ReplayedLine = {
  readonly line: readonly string[]
  readonly sideToMove: 'white' | 'black'
}

export const replayLine = (moves: readonly string[]): ReplayedLine | undefined => {
  const board = new Chess()
  const played: string[] = []
  for (const move of moves) {
    try {
      played.push(board.move(move).san)
    } catch {
      return undefined
    }
  }
  return { line: played, sideToMove: board.turn() === 'w' ? 'white' : 'black' }
}

const replay = (moves: readonly string[]): readonly string[] | undefined => replayLine(moves)?.line

const parseFile = (
  file: string,
  text: string,
): { readonly rows: readonly DatasetRow[]; readonly issues: readonly CatalogueIssue[] } => {
  const rows: DatasetRow[] = []
  const issues: CatalogueIssue[] = []

  text.split('\n').forEach((raw, index) => {
    const lineNumber = index + 1
    const where = `${file}:${lineNumber}`
    if (raw.trim().length === 0) return
    const columns = raw.split('\t')
    if (lineNumber === 1 && columns[0] === 'eco') return

    const [eco, name, pgn] = columns
    if (columns.length !== 3 || eco === undefined || name === undefined || pgn === undefined) {
      issues.push({
        where,
        message: `expected three tab-separated columns (eco, name, pgn), found ${columns.length}.`,
      })
      return
    }

    const line = replay(splitMoveText(pgn))
    if (line === undefined || line.length === 0) {
      issues.push({
        where,
        message:
          `\`${name}\` has a move sequence that is not legal from the starting position: ` +
          `\`${pgn}\`. The snapshot is corrupt or upstream has changed format; nothing is ` +
          'imported from a row whose moves cannot be replayed.',
      })
      return
    }

    rows.push({ eco, name, line, where })
  })

  return { rows, issues }
}

/**
 * Rows folded to one per distinct name, keeping the shortest line. Ties — which the
 * snapshot does not currently contain — break on the line itself so the choice is
 * deterministic across machines and across dataset refreshes.
 */
export const foldByName = (rows: readonly DatasetRow[]): readonly DatasetRow[] => {
  const byName = new Map<string, DatasetRow>()
  for (const row of rows) {
    const existing = byName.get(row.name)
    if (existing === undefined) {
      byName.set(row.name, row)
      continue
    }
    const shorter =
      row.line.length !== existing.line.length
        ? row.line.length < existing.line.length
        : row.line.join(' ') < existing.line.join(' ')
    if (shorter) byName.set(row.name, row)
  }
  // Ordered by codepoint rather than by locale: this ordering decides which of two names
  // that slug alike is minted first, and a build artefact may not depend on the ICU data
  // the machine happens to ship.
  return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

const sourceIssue = (message: string): CatalogueIssue => ({
  where: 'tools/catalogue/dataset/source.json',
  message,
})

export const readDatasetSource = (dir: string): CatalogueResult<DatasetSource> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(join(dir, 'source.json'), 'utf8'))
  } catch (error) {
    return {
      ok: false,
      issues: [sourceIssue(error instanceof Error ? error.message : String(error))],
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, issues: [sourceIssue('expected a JSON object.')] }
  }
  const record: Record<string, unknown> = { ...parsed }
  const { repository, commit } = record
  if (typeof repository !== 'string' || typeof commit !== 'string') {
    return {
      ok: false,
      issues: [sourceIssue('`repository` and `commit` must both be strings.')],
    }
  }
  return { ok: true, value: { repository, commit } }
}

export const readDataset = (dir: string): CatalogueResult<readonly DatasetRow[]> => {
  const rows: DatasetRow[] = []
  const issues: CatalogueIssue[] = []

  for (const file of FILES) {
    const path = join(dir, file)
    let text: string
    try {
      text = readFileSync(path, 'utf8')
    } catch {
      issues.push({
        where: path,
        message: 'missing from the vendored snapshot. Run `npm run catalogue:fetch`.',
      })
      continue
    }
    const parsed = parseFile(path, text)
    rows.push(...parsed.rows)
    issues.push(...parsed.issues)
  }

  if (issues.length > 0) return { ok: false, issues }
  if (rows.length === 0) {
    return {
      ok: false,
      issues: [
        {
          where: dir,
          message:
            'no rows were read. An empty dataset would silently produce an empty catalogue, ' +
            'which is not the same as a catalogue that passed.',
        },
      ],
    }
  }
  return { ok: true, value: rows }
}
