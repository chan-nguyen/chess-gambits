import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { MateClaim } from '../content/validate.ts'
import { validateText } from '../content/validate.ts'
import type { ContentIssue } from '../content/issue.ts'

/**
 * Finding the committed corpus: the content files that *claim* traps and the certificates
 * that *prove* them.
 *
 * Shared by `prove:mates` and `verify:mates` so the two commands can never disagree about
 * what the corpus is — a prover that looks in one place and a verifier that looks in
 * another is a gate with a hole in it.
 *
 * Build-time only.
 */

export const CERTIFICATE_SUFFIX = '.mate.json'

/** Paths are normalised to forward slashes so a message reads the same on every platform. */
const posix = (path: string): string => relative(process.cwd(), path).split(sep).join('/')

const filesUnder = (target: string, matches: (name: string) => boolean): readonly string[] => {
  const stats = statSync(target)
  if (stats.isFile()) return matches(target) ? [posix(target)] : []
  return readdirSync(target, { recursive: true, encoding: 'utf8' })
    .map((name) => join(target, name))
    .filter((path) => matches(path) && statSync(path).isFile())
    .map(posix)
    .sort()
}

const isYaml = (path: string): boolean => path.endsWith('.yaml') || path.endsWith('.yml')

export const yamlFilesUnder = (target: string): readonly string[] => filesUnder(target, isYaml)

export const certificateFilesUnder = (target: string): readonly string[] =>
  filesUnder(target, (path) => path.endsWith(CERTIFICATE_SUFFIX))

export type ClaimedFile = {
  readonly file: string
  readonly claims: readonly MateClaim[]
  /**
   * Everything the gate said about the file. A file whose *only* complaint is that its
   * traps are unproved is exactly what `prove:mates` is for, so the claims are reported
   * alongside the issues rather than instead of them.
   */
  readonly issues: readonly ContentIssue[]
}

export const claimsUnder = (targets: readonly string[]): readonly ClaimedFile[] =>
  targets
    .flatMap((target) => yamlFilesUnder(target))
    .map((file) => {
      const report = validateText(file, readFileSync(file, 'utf8'))
      return { file, claims: report.mateClaims, issues: report.issues }
    })

/** Issues that `prove:mates` is able to fix by producing a certificate. */
export const isProvable = (issue: ContentIssue): boolean => issue.code === 'mate-unproved'
