import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { build } from '../catalogue/build.ts'
import type { CatalogueIssue } from '../catalogue/types.ts'
import { loadContent } from './entries.ts'
import { formatIssues } from './issue.ts'
import type { GoldenInputs, Regenerated } from './golden-lists.ts'
import {
  listedTaughtIds,
  mentionsOf,
  regenerateBranches,
  regenerateContentCli,
  regenerateTaughtEntries,
} from './golden-lists.ts'

/**
 * `npm run fixtures:golden` — rewrite the golden lists from `content/` and the catalogue.
 *
 * Run it after any change that adds, removes or renames a content file, after merging `main`
 * into a content branch (two content branches never conflict on their own files, only on these
 * lists), and again if `main` moved while the pull request was waiting. `--check` writes nothing
 * and exits 1 if a list is stale, naming the file.
 *
 * Afterwards it lists every spec or test that names an entry this run newly taught: a spec that
 * needs "an entry that is still listed" names a real one, and teaching it breaks that spec.
 * The sentence per round in the `branches.test.ts` comment is not generated; add it by hand.
 *
 * See `golden-lists.ts` for what each file holds.
 */

const GOLDEN_FILES = {
  contentCli: join('tools', 'content', 'content-cli.test.ts'),
  branches: join('tools', 'catalogue', 'branches.test.ts'),
  taughtEntries: join('e2e', 'taught-entries.spec.ts'),
} as const

const SCANNED_ROOTS: readonly string[] = ['e2e', 'tools', 'src']

const fail = (message: string): number => {
  process.stderr.write(`fixtures:golden: ${message}\n`)
  return 1
}

const formatCatalogueIssues = (issues: readonly CatalogueIssue[]): string =>
  issues.map((issue) => `FAIL ${issue.where}\n  ${issue.message}`).join('\n\n')

const isSpecFile = (path: string): boolean => /\.(test|spec)\.tsx?$/.test(path)

const specTextsOutsideTheLists = (): ReadonlyMap<string, string> => {
  const own = new Set<string>([
    ...Object.values(GOLDEN_FILES),
    join('tools', 'content', 'golden-lists.test.ts'),
  ])
  const files = SCANNED_ROOTS.flatMap((root) =>
    readdirSync(root, { recursive: true, encoding: 'utf8' })
      .map((name) => join(root, name))
      .filter((path) => isSpecFile(path) && !own.has(path) && statSync(path).isFile()),
  )
  return new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))
}

const main = (): number => {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } })

  const content = loadContent('content')
  if (!content.ok) return fail(`content does not validate.\n${formatIssues(content.issues)}`)

  const catalogue = build({
    datasetDir: join('tools', 'catalogue', 'dataset'),
    sourceDir: join('tools', 'catalogue', 'source'),
    contentDir: 'content',
  })
  if (!catalogue.ok)
    return fail(`the catalogue does not build.\n${formatCatalogueIssues(catalogue.issues)}`)

  const records = catalogue.value.records
  const inputs: GoldenInputs = {
    contentIds: content.entries.map(({ entry }) => entry.id),
    taughtIds: records.filter((record) => record.tier === 'taught').map((record) => record.id),
    branchCounts: new Map(records.map((record) => [record.id, record.branchKeys.length])),
    totalEntries: records.length,
  }

  const targets: readonly {
    readonly file: string
    readonly regenerate: (text: string, from: GoldenInputs) => Regenerated
  }[] = [
    { file: GOLDEN_FILES.contentCli, regenerate: regenerateContentCli },
    { file: GOLDEN_FILES.branches, regenerate: regenerateBranches },
    { file: GOLDEN_FILES.taughtEntries, regenerate: regenerateTaughtEntries },
  ]

  const before = readFileSync(GOLDEN_FILES.taughtEntries, 'utf8')
  const alreadyTaught = new Set(listedTaughtIds(before))

  const stale: string[] = []
  for (const { file, regenerate } of targets) {
    const current = readFileSync(file, 'utf8')
    const next = regenerate(current, inputs)
    if (!next.ok) return fail(`${file}: ${next.message}`)
    if (next.text === current) continue
    stale.push(file)
    if (!values.check) writeFileSync(file, next.text)
  }

  process.stdout.write(
    `${inputs.contentIds.length} authored, ${inputs.taughtIds.length} taught, ` +
      `${inputs.totalEntries - inputs.contentIds.length} at Tier 0.\n`,
  )

  if (values.check) {
    if (stale.length === 0) return 0
    return fail(
      `stale: ${stale.join(', ')}. Run \`npm run fixtures:golden\` and commit the result.`,
    )
  }
  process.stdout.write(
    stale.length === 0
      ? 'The golden lists were already up to date.\n'
      : `Rewrote ${stale.join(', ')}.\n`,
  )

  const newlyTaught = records
    .filter((record) => record.tier === 'taught' && !alreadyTaught.has(record.id))
    .map((record) => ({ id: record.id, name: record.name }))
  const mentions = mentionsOf(specTextsOutsideTheLists(), newlyTaught)
  if (mentions.length > 0) {
    process.stdout.write(
      'These specs or tests name an entry this run newly taught. If one of them needs an entry ' +
        'that is still listed, swap in another:\n' +
        mentions.map((line) => `  ${line}`).join('\n') +
        '\n',
    )
  }
  return 0
}

process.exitCode = main()
