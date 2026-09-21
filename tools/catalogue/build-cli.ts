import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { build } from './build.ts'
import { kb } from './budget.ts'
import type { Exclusion } from './classify.ts'
import { EXCLUSION_CODES } from './source.ts'
import type { CatalogueIssue } from './types.ts'

/**
 * `npm run catalogue` — build the per-locale catalogue files.
 *
 * Runs in `npm run build`, after the content compile step and before Vite, so that a
 * catalogue that fails a gate fails the build before anything is bundled.
 *
 * Output goes to `public/catalogue/`, which Vite copies verbatim into `dist/`. Like
 * compiled content it is a **static file addressed by a URL** and is generated, never
 * committed.
 */

const DEFAULT_DATASET = join('tools', 'catalogue', 'dataset')
const DEFAULT_SOURCE = join('tools', 'catalogue', 'source')
const DEFAULT_CONTENT = 'content'
const DEFAULT_OUT = join('public', 'catalogue')

const fail = (message: string): number => {
  process.stderr.write(`catalogue: ${message}\n`)
  return 1
}

const formatIssues = (issues: readonly CatalogueIssue[]): string =>
  issues.map((issue) => `FAIL ${issue.where}\n  ${issue.message}`).join('\n\n')

/** Widest rule, so the three loudest reasons are named rather than just counted. */
const LOUDEST = 3

/**
 * The exclusion list, printed every build (issue #36, criterion 5).
 *
 * A bare total says 217 rows are out and invites nobody to ask which. Grouped by reason
 * it says what kind of decision was taken 217 times — and the day a refreshed dataset adds
 * rows that nobody can prove a side for, the count against that code moves where somebody
 * is looking rather than disappearing into one number.
 */
const exclusionAudit = (exclusions: readonly Exclusion[]): readonly string[] => {
  if (exclusions.length === 0) return []
  return [
    '  by reason:',
    ...EXCLUSION_CODES.flatMap((code) => {
      const matching = exclusions.filter((exclusion) => exclusion.code === code)
      if (matching.length === 0) return []
      const rows = matching.reduce((total, exclusion) => total + exclusion.rows, 0)
      const widest = [...matching]
        .sort((a, b) => b.rows - a.rows)
        .slice(0, LOUDEST)
        .map((exclusion) => `${exclusion.match} ${exclusion.rows}`)
      const rest = matching.length > LOUDEST ? `, +${matching.length - LOUDEST} more rules` : ''
      return [
        `    ${code.padEnd(23)}${String(rows).padStart(4)} rows over ` +
          `${matching.length} rule${matching.length === 1 ? '' : 's'} — ${widest.join('; ')}${rest}`,
      ]
    }),
  ]
}

/** Same refusal as the content compile step: never delete a directory we did not fill. */
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
      options: {
        out: { type: 'string' },
        dataset: { type: 'string' },
        source: { type: 'string' },
        content: { type: 'string' },
      },
    }))
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }

  const out = values.out ?? DEFAULT_OUT
  const result = build({
    datasetDir: values.dataset ?? DEFAULT_DATASET,
    sourceDir: values.source ?? DEFAULT_SOURCE,
    contentDir: values.content ?? DEFAULT_CONTENT,
  })

  if (!result.ok) {
    process.stderr.write(`${formatIssues(result.issues)}\n\n`)
    return fail(`${result.issues.length} issue(s). Nothing was written.`)
  }

  const refusal = clean(out)
  if (refusal !== undefined) return fail(refusal)
  mkdirSync(out, { recursive: true })

  for (const { locale, json } of result.value.payloads) {
    writeFileSync(join(out, `catalogue.${locale}.json`), json, 'utf8')
  }

  const { records, sizes, renamed } = result.value
  const gambits = records.filter((record) => record.category === 'gambit').length
  const traps = records.filter((record) => record.category === 'trap').length
  const families = new Set(records.map((record) => record.family)).size
  const tier = (name: string): number => records.filter((record) => record.tier === name).length

  const lines = [
    `Read ${result.value.datasetRows} dataset rows from ${result.value.source.commit.slice(0, 10)}, ` +
      `folded to ${result.value.foldedRows} distinct names.`,
    `Wrote ${records.length} entries to ${out}/ — ${gambits} gambits, ${traps} ` +
      `${traps === 1 ? 'trap' : 'traps'}, ${families} families.`,
    `Excluded ${result.value.excludedGambitRows} rows the dataset names a gambit, by a written rule.`,
    ...exclusionAudit(result.value.exclusions),
    `Tiers: ${tier('listed')} listed · ${tier('mapped')} mapped · ${tier('taught')} taught.`,
    '',
    ...sizes.map(
      (size) =>
        `  catalogue.${size.locale}.json  ${kb(size.bytes).padStart(8)} raw  ` +
        `${kb(size.gzippedBytes).padStart(8)} gzipped`,
    ),
  ]

  if (renamed.length > 0) {
    lines.push(
      '',
      `${renamed.length} ${renamed.length === 1 ? 'entry was' : 'entries were'} renamed upstream ` +
        'since they were frozen. The ids are unchanged, which is the whole point:',
      ...renamed
        .slice(0, 10)
        .map((rename) => `  ${rename.id}\n    was ${rename.was}\n    now ${rename.now}`),
    )
  }

  process.stdout.write(`${lines.join('\n')}\n`)
  return 0
}

process.exitCode = run(process.argv.slice(2))
