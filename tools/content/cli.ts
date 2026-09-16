import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { formatIssues } from './issue.ts'
import type { EntryReport } from './validate.ts'
import { validateText } from './validate.ts'

/**
 * `npm run validate:content` — the F12 content gate, wired into CI as a required step.
 *
 * Build-time only, run with Node's own TypeScript support so it needs no bundler and no
 * extra dependency. Exits non-zero on the first file that fails, having printed every
 * issue with its file, its node and its line.
 */

const DEFAULT_TARGETS: readonly string[] = ['content']

const isYaml = (path: string): boolean => path.endsWith('.yaml') || path.endsWith('.yml')

const filesUnder = (target: string): readonly string[] => {
  const stats = statSync(target)
  if (stats.isFile()) return isYaml(target) ? [target] : []
  return readdirSync(target, { recursive: true, encoding: 'utf8' })
    .map((name) => join(target, name))
    .filter((path) => isYaml(path) && statSync(path).isFile())
    .sort()
}

const percent = (part: number, whole: number): string =>
  whole === 0 ? 'n/a' : `${Math.round((part / whole) * 100)}%`

const summarise = (reports: readonly EntryReport[]): string => {
  const total = reports.reduce(
    (acc, entry) => ({
      slots: acc.slots + entry.coverage.slots,
      vi: acc.vi + entry.coverage.vi,
      en: acc.en + entry.coverage.en,
      fr: acc.fr + entry.coverage.fr,
      nodes: acc.nodes + entry.nodeCount,
      dismissed: acc.dismissed + entry.dismissedCount,
      issues: acc.issues + entry.issues.length,
    }),
    { slots: 0, vi: 0, en: 0, fr: 0, nodes: 0, dismissed: 0, issues: 0 },
  )

  const tiers = reports
    .map((entry) => entry.entry?.tier)
    .filter((tier) => tier !== undefined)
    .reduce<Record<string, number>>((acc, tier) => ({ ...acc, [tier]: (acc[tier] ?? 0) + 1 }), {})

  const lines = [
    '',
    `files ${reports.length}   nodes ${total.nodes}   dismissed replies ${total.dismissed}   issues ${total.issues}`,
    '',
    'Translation coverage (Vietnamese is the source locale; en and fr fall back to it and are',
    'marked untranslated, so a gap here is a number to track and never a build failure):',
    `  vi  ${percent(total.vi, total.slots).padStart(4)}  (${total.vi}/${total.slots})`,
    `  en  ${percent(total.en, total.slots).padStart(4)}  (${total.en}/${total.slots})`,
    `  fr  ${percent(total.fr, total.slots).padStart(4)}  (${total.fr}/${total.slots})`,
  ]

  const tierNames = Object.keys(tiers).sort()
  if (tierNames.length > 0) {
    lines.push('', 'Derived coverage tiers:')
    for (const name of tierNames) lines.push(`  ${name.padEnd(7)} ${tiers[name] ?? 0}`)
  }

  return lines.join('\n')
}

const duplicateIdIssues = (reports: readonly EntryReport[]): readonly string[] => {
  const byId = new Map<string, string[]>()
  for (const report of reports) {
    const id = report.entry?.id
    if (id === undefined) continue
    byId.set(id, [...(byId.get(id) ?? []), report.file])
  }
  return [...byId]
    .filter(([, files]) => files.length > 1)
    .map(
      ([id, files]) =>
        `${files.join(', ')}\n  [duplicate-id] id\n  Two entries share the id \`${id}\`. An id appears in a URL and is never reused (docs/CONTEXT.md, invariant 9).`,
    )
}

const run = (argv: readonly string[]): number => {
  const targets = argv.length > 0 ? argv : DEFAULT_TARGETS
  const files: string[] = []

  for (const target of targets) {
    try {
      files.push(...filesUnder(target))
    } catch {
      process.stderr.write(`validate:content: cannot read \`${target}\`\n`)
      return 1
    }
  }

  if (files.length === 0) {
    process.stderr.write(
      `validate:content: no .yaml files found under ${targets.join(', ')}. Nothing was checked, which is not the same as everything passing.\n`,
    )
    return 1
  }

  const reports = files.map((file) =>
    validateText(relative(process.cwd(), file).split(sep).join('/'), readFileSync(file, 'utf8')),
  )

  for (const report of reports) {
    if (report.issues.length === 0) {
      process.stdout.write(`ok   ${report.file}  (${report.entry?.tier ?? 'unknown'})\n`)
      continue
    }
    process.stdout.write(`FAIL ${report.file}\n${formatIssues(report.issues)}\n\n`)
  }

  const duplicates = duplicateIdIssues(reports)
  for (const duplicate of duplicates) process.stdout.write(`FAIL ${duplicate}\n\n`)

  process.stdout.write(`${summarise(reports)}\n`)

  const failures = reports.filter((report) => report.issues.length > 0).length + duplicates.length
  if (failures > 0) {
    process.stdout.write(`\n${failures} file(s) rejected.\n`)
    return 1
  }
  process.stdout.write(`\nAll ${reports.length} file(s) passed the content gate.\n`)
  return 0
}

process.exitCode = run(process.argv.slice(2))
