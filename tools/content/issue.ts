/**
 * A validation failure, and how it is printed.
 *
 * Every issue names the file and the node. "Invalid content" is not an acceptable error
 * from this tool: the person reading it is one maintainer editing YAML at night, and an
 * error they cannot locate is an error they will work around rather than fix.
 */

export type IssueCode =
  /* Bounded parsing (docs/security.md B1) */
  | 'yaml-too-large'
  | 'yaml-too-deep'
  | 'yaml-alias'
  | 'yaml-syntax'
  /* Derived fields that a file may never state (invariants 1, 2, 8) */
  | 'derived-field'
  /* Prose that has been through the wrong encoding */
  | 'text-double-encoded'
  /* Shape */
  | 'schema'
  | 'node-shape'
  | 'duplicate-id'
  /* Chess (ADR-0004 checks 2, 3, 4, 5) */
  | 'illegal-move'
  | 'san-not-canonical'
  | 'false-check-claim'
  | 'false-mate-claim'
  | 'unclaimed-mate'
  | 'assessment-is-terminal'
  /* Reply completeness (ADR-0004 check 7) — the check the product turns on */
  | 'reply-incomplete'
  | 'dismissed-not-legal'
  | 'dismissed-also-modelled'
  | 'dismissed-without-children'
  | 'dismiss-rest-covers-nothing'
  /* Duplicates and transpositions (ADR-0004 check 9) */
  | 'duplicate-san'
  | 'duplicate-position'
  | 'transposition-unresolved'
  | 'transposition-mismatch'
  | 'transposition-cycle'
  /* Side consistency (ADR-0004 check 12) */
  | 'kind-mismatch'
  /* Counted claims in prose (ADR-0011) */
  | 'count-mismatch'
  | 'count-unspellable'
  | 'count-unused'
  | 'count-locale-gap'
  | 'unknown-count'
  /* Mate proving (ADR-0005, docs/CONTEXT.md invariants 4 and 5) */
  | 'defining-line-parity'
  | 'mate-unproved'
  | 'mate-not-through-blunder'

export type SourceLocation = { readonly line: number; readonly col: number }

export type ContentIssue = {
  /** Path of the offending file, as given to the validator. */
  readonly file: string
  readonly code: IssueCode
  /** Where the value lives in the document, e.g. `tree.children[0].ply`. */
  readonly dataPath: string
  /** The node as a chess player reads it, e.g. `tree > Ke7 > Qxe5+`. */
  readonly nodePath: string | undefined
  readonly at: SourceLocation | undefined
  readonly message: string
}

/** Render a data path the way a YAML author navigates it. */
export const joinDataPath = (segments: readonly (string | number)[]): string =>
  segments.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`
    return acc === '' ? segment : `${acc}.${segment}`
  }, '')

/** Render the SAN path from the entry root, which is how the node is named in the UI and in URLs. */
export const joinNodePath = (plies: readonly string[]): string =>
  plies.length === 0 ? 'tree' : ['tree', ...plies].join(' > ')

/** Keep a pathological path readable: a hundred identical segments help nobody. */
const abbreviate = (dataPath: string): string =>
  dataPath.length <= 80 ? dataPath : `${dataPath.slice(0, 40)} … ${dataPath.slice(-24)}`

export const formatIssue = (issue: ContentIssue): string => {
  const where =
    issue.at === undefined ? issue.file : `${issue.file}:${issue.at.line}:${issue.at.col}`
  const path = issue.dataPath === '' ? '(document root)' : abbreviate(issue.dataPath)
  const node =
    issue.nodePath === undefined || issue.nodePath === path ? path : `${issue.nodePath}  (${path})`
  return `${where}\n  [${issue.code}] ${node}\n  ${issue.message}`
}

export const formatIssues = (issues: readonly ContentIssue[]): string =>
  issues.map(formatIssue).join('\n\n')
