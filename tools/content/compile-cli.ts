import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { compileEntry, compiledJson } from './compile.ts'
import { loadContent } from './entries.ts'
import { formatIssues } from './issue.ts'

/**
 * The compile step, run as the first thing `npm run build` does.
 *
 * It is first rather than last so that invalid content fails before anything is bundled:
 * a build that spends its time compiling an application and only then discovers the
 * content is wrong has told the author nothing sooner and cost them a minute.
 *
 * Output goes to `public/content/`, which Vite copies verbatim into `dist/`. That makes
 * each entry a **static file addressed by URL** rather than a module in the graph — which
 * is the point (ADR-0004): an `import.meta.glob` over several hundred entries grows the
 * module graph, and therefore the build, with the catalogue. Fetching by URL keeps build
 * time flat and downloads exactly the one entry a visitor opened.
 *
 * The directory is generated, never committed (`.gitignore`).
 */

const DEFAULT_SOURCE = 'content'
const DEFAULT_OUT = join('public', 'content')

const fail = (message: string): number => {
  process.stderr.write(`compile-content: ${message}\n`)
  return 1
}

/**
 * The output directory is deleted before it is written, so an entry removed from `content/`
 * cannot linger as a published JSON file. Deleting a directory a flag pointed at deserves a
 * check first: anything in there that this command did not put there means the flag is wrong.
 */
const clean = (out: string): string | undefined => {
  let existing: readonly string[]
  try {
    existing = readdirSync(out)
  } catch {
    return undefined
  }
  const foreign = existing.filter((name) => !name.endsWith('.json'))
  if (foreign.length > 0) {
    return `\`${out}\` holds files this command did not write (${foreign.join(', ')}). Refusing to delete it.`
  }
  rmSync(out, { recursive: true, force: true })
  return undefined
}

const run = (argv: readonly string[]): number => {
  let values
  try {
    ;({ values } = parseArgs({
      args: [...argv],
      options: { out: { type: 'string' }, source: { type: 'string' } },
    }))
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }

  const source = values.source ?? DEFAULT_SOURCE
  const out = values.out ?? DEFAULT_OUT

  let loaded
  try {
    loaded = loadContent(source)
  } catch {
    return fail(`cannot read \`${source}\`.`)
  }

  if (!loaded.ok) {
    process.stderr.write(`${formatIssues(loaded.issues)}\n\n`)
    return fail(
      `${loaded.issues.length} issue(s). Nothing was compiled: content that fails the gate never ` +
        'reaches a browser (ADR-0004).',
    )
  }

  const refusal = clean(out)
  if (refusal !== undefined) return fail(refusal)
  mkdirSync(out, { recursive: true })

  let bytes = 0
  for (const { entry } of loaded.entries) {
    const json = compiledJson(compileEntry(entry))
    bytes += Buffer.byteLength(json, 'utf8')
    writeFileSync(join(out, `${entry.id}.json`), json, 'utf8')
  }

  const tiers = loaded.entries
    .map(({ entry }) => entry.tier)
    .reduce<Record<string, number>>((acc, tier) => ({ ...acc, [tier]: (acc[tier] ?? 0) + 1 }), {})
  const tierText = Object.keys(tiers)
    .sort()
    .map((tier) => `${tiers[tier] ?? 0} ${tier}`)
    .join(' · ')

  process.stdout.write(
    `Compiled ${loaded.entries.length} entr${loaded.entries.length === 1 ? 'y' : 'ies'} to ${out}/ ` +
      `(${bytes} bytes total${tierText === '' ? '' : `; ${tierText}`})\n`,
  )
  return 0
}

process.exitCode = run(process.argv.slice(2))
