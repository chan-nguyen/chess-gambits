import { withBasePath } from './base-path.ts'

/**
 * Fetching the opening tree (issue #129).
 *
 * A trie over every published catalogue entry's defining line, built at compile time by
 * `tools/catalogue/opening-tree.ts` from the same defining lines the lightweight catalogue
 * ships. Locale-independent — a FEN and a square name are the same in every language — so
 * there is exactly one file, `catalogue/opening-tree.json`, unlike the per-locale
 * catalogue.
 *
 * Mirrors `catalogue.ts` deliberately, for the same reasons stated there: nothing throws,
 * and the response is checked field by field rather than trusted, because it has crossed a
 * network and our own build having written it correctly does not mean the byte a browser
 * receives is what was written.
 */

export type OpeningTreeNode = {
  readonly fen: string
  /** The square of the king in check here, or null. */
  readonly check: string | null
  readonly children: readonly OpeningTreeChild[]
}

export type OpeningTreeChild = {
  readonly san: string
  readonly from: string
  readonly to: string
  readonly node: OpeningTreeNode
}

export const openingTreeUrl = (): string => withBasePath('catalogue/opening-tree.json')

const isString = (value: unknown): value is string => typeof value === 'string'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isOpeningTreeNode = (value: unknown): value is OpeningTreeNode =>
  isRecord(value) &&
  isString(value.fen) &&
  (value.check === null || isString(value.check)) &&
  Array.isArray(value.children) &&
  value.children.every(isOpeningTreeChild)

function isOpeningTreeChild(value: unknown): value is OpeningTreeChild {
  return (
    isRecord(value) &&
    isString(value.san) &&
    isString(value.from) &&
    isString(value.to) &&
    isOpeningTreeNode(value.node)
  )
}

export const isOpeningTree = isOpeningTreeNode

export type OpeningTreeLoadFailure =
  | { readonly reason: 'offline' }
  | { readonly reason: 'missing' }
  | { readonly reason: 'unavailable'; readonly status: number }
  | { readonly reason: 'malformed' }

export type OpeningTreeLoad =
  | { readonly ok: true; readonly tree: OpeningTreeNode }
  | { readonly ok: false; readonly failure: OpeningTreeLoadFailure }

export const loadOpeningTree = async (): Promise<OpeningTreeLoad> => {
  let response: Response
  try {
    response = await fetch(openingTreeUrl(), { headers: { accept: 'application/json' } })
  } catch {
    return { ok: false, failure: { reason: 'offline' } }
  }

  if (response.status === 404) return { ok: false, failure: { reason: 'missing' } }
  if (!response.ok) {
    return { ok: false, failure: { reason: 'unavailable', status: response.status } }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, failure: { reason: 'malformed' } }
  }

  if (!isOpeningTree(body)) return { ok: false, failure: { reason: 'malformed' } }

  return { ok: true, tree: body }
}

/**
 * Walk a decoded move sequence down the tree, stopping at the first ply that is not one of
 * the current node's actual children.
 *
 * This is the validation issue #129 asks for: stricter than a shape-only check, because it
 * asks the opening tree itself whether a move was ever offered here, rather than whether it
 * merely looks like a move. `plies` is the longest prefix that resolved — the same "as far
 * as it makes sense" recovery `line.ts`'s `parseLine` uses for a malformed link.
 */
export type OpeningWalk = {
  readonly node: OpeningTreeNode
  /** The prefix that actually resolved, which may be shorter than what was requested. */
  readonly plies: readonly string[]
}

export const walkOpeningTree = (
  tree: OpeningTreeNode,
  requested: readonly string[],
): OpeningWalk => {
  let node = tree
  const plies: string[] = []

  for (const ply of requested) {
    const child = node.children.find((candidate) => candidate.san === ply)
    if (child === undefined) break
    node = child.node
    plies.push(ply)
  }

  return { node, plies }
}
