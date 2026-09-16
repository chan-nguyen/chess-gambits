import { LineCounter, isAlias, isMap, isPair, isScalar, isSeq, parseDocument } from 'yaml'
import type { ContentIssue, SourceLocation } from './issue.ts'
import { joinDataPath } from './issue.ts'

/**
 * Bounded YAML loading (docs/security.md, B1).
 *
 * The content parser is a denial-of-service surface: build workflows parse content from a
 * branch, and a fork pull request runs this code. Parsing is therefore bounded on document
 * size and nesting depth, and anchors and aliases are refused outright.
 *
 * Verified by experiment against `yaml` 2.9.1: the `maxAliasCount` option does **not**
 * reject an alias when set to 0 — `parseDocument` reports no error and `toJS()` happily
 * expands it. Alias refusal is therefore done here, by walking the document tree before
 * `toJS()` is ever called, which is also the only point at which an expansion bomb can
 * still be stopped cheaply.
 */

/** Generous for a gambit with a fully modelled tree; far below what can hurt a runner. */
export const MAX_DOCUMENT_BYTES = 1024 * 1024

/**
 * Each modelled ply costs two levels (a `children` sequence and a node map), so this
 * allows a line roughly 48 plies deep — well past any opening, and a hard stop on a
 * pathologically nested document.
 */
export const MAX_NESTING_DEPTH = 100

export type YamlSource = {
  readonly file: string
  readonly data: unknown
  /** Best-effort line and column for a data path, falling back to the nearest ancestor. */
  readonly locate: (path: readonly (string | number)[]) => SourceLocation | undefined
}

export type LoadResult =
  | { readonly ok: true; readonly source: YamlSource }
  | { readonly ok: false; readonly issues: readonly ContentIssue[] }

const issue = (
  file: string,
  code: ContentIssue['code'],
  dataPath: string,
  message: string,
  at: SourceLocation | undefined,
): ContentIssue => ({ file, code, dataPath, nodePath: undefined, at, message })

const rangeStart = (value: unknown): number | undefined => {
  if (typeof value !== 'object' || value === null || !('range' in value)) return undefined
  const { range } = value
  if (!Array.isArray(range)) return undefined
  const [start] = range
  return typeof start === 'number' ? start : undefined
}

const anchorOf = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null || !('anchor' in value)) return undefined
  const { anchor } = value
  return typeof anchor === 'string' && anchor !== '' ? anchor : undefined
}

/** Count nesting depth and refuse anchors and aliases, iteratively so the walk cannot recurse away. */
const scanTree = (
  root: unknown,
  file: string,
  locate: (offset: number | undefined) => SourceLocation | undefined,
): readonly ContentIssue[] => {
  const issues: ContentIssue[] = []
  const stack: { node: unknown; depth: number; path: readonly (string | number)[] }[] = [
    { node: root, depth: 1, path: [] },
  ]

  while (stack.length > 0) {
    const frame = stack.pop()
    if (frame === undefined) break
    const { node, depth, path } = frame

    if (isAlias(node)) {
      issues.push(
        issue(
          file,
          'yaml-alias',
          joinDataPath(path),
          `YAML alias \`*${node.source}\` is refused. Content files are data with no indirection: aliases make a document able to expand far beyond its own size, and this parser runs on pull requests (docs/security.md, B1).`,
          locate(rangeStart(node)),
        ),
      )
      continue
    }

    const anchor = anchorOf(node)
    if (anchor !== undefined) {
      issues.push(
        issue(
          file,
          'yaml-alias',
          joinDataPath(path),
          `YAML anchor \`&${anchor}\` is refused. Anchors exist only to be referenced by aliases, which are disabled (docs/security.md, B1). Write the value out in full.`,
          locate(rangeStart(node)),
        ),
      )
      continue
    }

    if (depth > MAX_NESTING_DEPTH) {
      issues.push(
        issue(
          file,
          'yaml-too-deep',
          joinDataPath(path),
          `Nesting is deeper than the limit of ${MAX_NESTING_DEPTH} levels. A tree this deep is not an opening, and an unbounded one exhausts the build runner (docs/security.md, B1).`,
          locate(rangeStart(node)),
        ),
      )
      // One report is enough; everything below is the same document.
      return issues
    }

    if (isMap(node)) {
      for (const item of node.items) {
        if (!isPair(item)) continue
        const key = isScalar(item.key) ? item.key.value : undefined
        const segment = typeof key === 'string' ? key : '?'
        stack.push({ node: item.key, depth: depth + 1, path: [...path, segment] })
        stack.push({ node: item.value, depth: depth + 1, path: [...path, segment] })
      }
      continue
    }

    if (isSeq(node)) {
      node.items.forEach((item, index) => {
        stack.push({ node: item, depth: depth + 1, path: [...path, index] })
      })
    }
  }

  return issues
}

export const loadYaml = (file: string, text: string): LoadResult => {
  const bytes = new TextEncoder().encode(text).length
  if (bytes > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      issues: [
        issue(
          file,
          'yaml-too-large',
          '',
          `Document is ${bytes} bytes, over the ${MAX_DOCUMENT_BYTES} byte limit. Checked before parsing, because parsing is the expensive step (docs/security.md, B1).`,
          undefined,
        ),
      ],
    }
  }

  const lineCounter = new LineCounter()
  const locateOffset = (offset: number | undefined): SourceLocation | undefined => {
    if (offset === undefined) return undefined
    const { line, col } = lineCounter.linePos(offset)
    return { line, col }
  }

  // `merge: false` keeps `<<` a literal key rather than a merge directive; it would need an
  // alias to be useful anyway, and a literal `<<` is then rejected as an unknown field.
  const doc = parseDocument(text, { lineCounter, merge: false, keepSourceTokens: false })

  if (doc.errors.length > 0) {
    return {
      ok: false,
      issues: doc.errors.map((error) =>
        issue(file, 'yaml-syntax', '', error.message, locateOffset(error.pos[0])),
      ),
    }
  }

  const structural = scanTree(doc.contents, file, locateOffset)
  if (structural.length > 0) return { ok: false, issues: structural }

  const locate = (path: readonly (string | number)[]): SourceLocation | undefined => {
    for (let end = path.length; end >= 0; end -= 1) {
      const found = locateOffset(rangeStart(doc.getIn(path.slice(0, end), true)))
      if (found !== undefined) return found
    }
    return undefined
  }

  return { ok: true, source: { file, data: doc.toJS(), locate } }
}
