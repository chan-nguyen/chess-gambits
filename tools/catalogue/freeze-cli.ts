import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { collectMintables } from './build.ts'
import { freeze } from './ids.ts'
import { frozenIdsPath, readFrozenIds, serialiseFrozenIds } from './source.ts'

/**
 * `npm run catalogue:freeze` — mint ids for entries that do not have one yet.
 *
 * This is the only thing that writes `ids.json`, and it only ever appends. It is a
 * separate command rather than a step of the build on purpose: minting an id is
 * publishing a URL, and a URL this site promises to keep working forever should appear in
 * a diff a person read, not in a generated file nobody looks at (docs/CONTEXT.md,
 * invariant 9).
 */

const DEFAULT_DATASET = join('tools', 'catalogue', 'dataset')
const DEFAULT_SOURCE = join('tools', 'catalogue', 'source')

const run = (argv: readonly string[]): number => {
  let values
  try {
    ;({ values } = parseArgs({
      args: [...argv],
      options: { dataset: { type: 'string' }, source: { type: 'string' } },
    }))
  } catch (error) {
    process.stderr.write(
      `catalogue:freeze: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    return 1
  }

  const sourceDir = values.source ?? DEFAULT_SOURCE
  const options = { datasetDir: values.dataset ?? DEFAULT_DATASET, sourceDir }

  const mintables = collectMintables(options)
  const existing = readFrozenIds(sourceDir)
  if (!mintables.ok || !existing.ok) {
    const issues = [
      ...(mintables.ok ? [] : mintables.issues),
      ...(existing.ok ? [] : existing.issues),
    ]
    for (const issue of issues) process.stderr.write(`FAIL ${issue.where}\n  ${issue.message}\n\n`)
    return 1
  }

  const before = Object.keys(existing.value.entries)
  const frozen = freeze(existing.value, mintables.value)
  const added = Object.keys(frozen.entries).filter((id) => !before.includes(id))

  if (added.length === 0) {
    process.stdout.write(`Nothing to freeze: all ${before.length} entries already have an id.\n`)
    return 0
  }

  writeFileSync(frozenIdsPath(sourceDir), serialiseFrozenIds(frozen), 'utf8')
  process.stdout.write(
    `Froze ${added.length} new id(s); the map now holds ${Object.keys(frozen.entries).length}.\n` +
      `${added
        .slice(0, 20)
        .map((id) => `  ${id}`)
        .join('\n')}\n` +
      (added.length > 20 ? `  … and ${added.length - 20} more\n` : '') +
      'Review the diff before committing. An id in this file is a promise that a URL keeps working.\n',
  )
  return 0
}

process.exitCode = run(process.argv.slice(2))
