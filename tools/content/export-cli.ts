import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { loadContent } from './entries.ts'
import { formatIssues } from './issue.ts'
import { exportPgn } from './pgn-export.ts'

/**
 * `npm run export-pgn -- <id>` — regenerate a PGN so a line can be checked on a board.
 *
 * The output is **generated and never committed** (ADR-0004). The YAML stays the only
 * source of truth, so this writes to standard output by default and refuses to write into
 * `content/`, where a committed `.pgn` beside its `.yaml` would be a second source of truth
 * for the same gambit — the exact objection this export path had to answer to exist.
 */

const SOURCE = 'content'

const fail = (message: string): number => {
  process.stderr.write(`export-pgn: ${message}\n`)
  return 1
}

const run = (argv: readonly string[]): number => {
  let parsed
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { out: { type: 'string' } },
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }

  const [id, ...extra] = parsed.positionals
  if (id === undefined || extra.length > 0) {
    return fail('usage: npm run export-pgn -- <gambit-id> [--out <file.pgn>]')
  }

  let loaded
  try {
    loaded = loadContent(SOURCE)
  } catch {
    return fail(`cannot read \`${SOURCE}\`.`)
  }

  if (!loaded.ok) {
    process.stderr.write(`${formatIssues(loaded.issues)}\n\n`)
    return fail(
      'content does not pass the gate, so no PGN was written. Exporting unvalidated content would ' +
        'put unchecked moves on a board, which is the one thing this command exists to prevent.',
    )
  }

  const found = loaded.entries.find(({ entry }) => entry.id === id)
  if (found === undefined) {
    const known = loaded.entries.map(({ entry }) => entry.id).sort()
    return fail(
      `no entry with id \`${id}\`.` +
        (known.length === 0 ? '' : ` Known ids: ${known.join(', ')}.`),
    )
  }

  const pgn = exportPgn(found.entry)
  const { out } = parsed.values

  if (out === undefined) {
    process.stdout.write(pgn)
    return 0
  }

  const target = resolve(out)
  const contentDir = resolve(SOURCE)
  if (target === contentDir || target.startsWith(`${contentDir}${sep}`)) {
    return fail(
      `refusing to write into \`${SOURCE}/\`. The export is generated and never committed, and a ` +
        '`.pgn` beside its `.yaml` is a second source of truth for the same gambit (ADR-0004).',
    )
  }

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, pgn, 'utf8')
  process.stderr.write(
    `Wrote ${relative(process.cwd(), target)} from ${found.file}. Do not commit it.\n`,
  )
  return 0
}

process.exitCode = run(process.argv.slice(2))
