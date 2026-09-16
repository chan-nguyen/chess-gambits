import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { ContentIssue } from './issue.ts'
import type { Entry } from './types.ts'
import { validateText } from './validate.ts'

/**
 * Reading the content directory, for the two commands that need entries rather than a
 * verdict: the compile step and the PGN export.
 *
 * Both run the same gate the merge gate runs (`validate.ts`), and neither is allowed to
 * proceed on a file that failed it. A compile that emitted whatever validated *mostly*
 * would put the exact class of claim this project exists to prevent in front of a learner,
 * and an export of unvalidated content would put the wrong moves on a board.
 *
 * Build-time only.
 */

export type LoadedEntry = { readonly file: string; readonly entry: Entry }

export type ContentLoad =
  | { readonly ok: true; readonly entries: readonly LoadedEntry[] }
  | { readonly ok: false; readonly issues: readonly ContentIssue[] }

const isYaml = (path: string): boolean => path.endsWith('.yaml') || path.endsWith('.yml')

/** Paths are normalised to forward slashes so an issue reads the same on every platform. */
const posix = (path: string): string => relative(process.cwd(), path).split(sep).join('/')

export const yamlFilesUnder = (dir: string): readonly string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((name) => join(dir, name))
    .filter((path) => isYaml(path) && statSync(path).isFile())
    .sort()

const duplicateIdIssue = (id: string, files: readonly string[]): ContentIssue => ({
  file: files.join(', '),
  code: 'duplicate-id',
  dataPath: 'id',
  nodePath: undefined,
  at: undefined,
  message:
    `Two entries share the id \`${id}\`. An id appears in a URL and is never reused ` +
    `(docs/CONTEXT.md, invariant 9) — and the compile step writes one \`${id}.json\`, so the ` +
    `second entry would silently replace the first.`,
})

export const loadContent = (dir: string): ContentLoad => {
  const files = yamlFilesUnder(dir)
  const reports = files.map((file) => validateText(posix(file), readFileSync(file, 'utf8')))

  const issues = reports.flatMap((report) => report.issues)
  const byId = new Map<string, string[]>()
  for (const report of reports) {
    if (report.entry === undefined) continue
    byId.set(report.entry.id, [...(byId.get(report.entry.id) ?? []), report.file])
  }
  const duplicates = [...byId]
    .filter(([, sharing]) => sharing.length > 1)
    .map(([id, sharing]) => duplicateIdIssue(id, sharing))

  if (issues.length > 0 || duplicates.length > 0) {
    return { ok: false, issues: [...issues, ...duplicates] }
  }

  const entries = reports.flatMap((report) =>
    report.entry === undefined ? [] : [{ file: report.file, entry: report.entry }],
  )
  return { ok: true, entries }
}
