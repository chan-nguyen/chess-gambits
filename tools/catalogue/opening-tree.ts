import { Chess } from 'chess.js'

/**
 * The opening tree: a trie over every distinct prefix of every published catalogue
 * entry's defining line (issue #129).
 *
 * The lightweight catalogue already ships each entry's defining line as space-joined SAN
 * (`CatalogueEntry.line`), which is enough to *filter* by a played-move prefix. It is not
 * enough to *render* a board at each prefix or to know which squares are legally
 * clickable next — that needs a FEN and each move's from/to squares, and none of that can
 * be produced in the browser without a rules engine (ADR-0003). So this is computed once,
 * at build time, with `chess.js` (already a build-time-only dependency, ADR-0004/0005),
 * and shipped as a static, locale-independent JSON file.
 *
 * Distinct lines sharing a prefix collapse onto one node: two gambits that agree for their
 * first four plies are one path down to the point where they diverge. The tree is exactly
 * as deep as the deepest defining line and no deeper — it holds no reply the catalogue does
 * not, and no move beyond where a defining line ends.
 */

export type OpeningTreeNode = {
  readonly fen: string
  /** The square of the king in check here, or null. `Board`'s `check` prop takes exactly this. */
  readonly check: string | null
  readonly children: readonly OpeningTreeChild[]
}

export type OpeningTreeChild = {
  readonly san: string
  readonly from: string
  readonly to: string
  readonly node: OpeningTreeNode
}

type MutableNode = {
  readonly fen: string
  readonly check: string | null
  readonly children: Map<
    string,
    { readonly from: string; readonly to: string; readonly node: MutableNode }
  >
}

/** The square of the side-to-move's king, when that side is in check; null otherwise. */
const checkedKingSquare = (chess: Chess): string | null => {
  if (!chess.isCheck()) return null
  const toMove = chess.turn()
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell !== null && cell.type === 'k' && cell.color === toMove) return cell.square
    }
  }
  return null
}

const makeNode = (chess: Chess): MutableNode => ({
  fen: chess.fen(),
  check: checkedKingSquare(chess),
  children: new Map(),
})

/**
 * Build the tree from every entry's defining line.
 *
 * Every line is expected to already be legal from the starting position — the catalogue
 * build validates this for every gambit and trap before a line ever reaches here
 * (`dataset.ts`'s `replayLine`, `trapIssues`) — so a line that fails to replay is skipped
 * rather than thrown: this stays a pure, non-throwing builder, and an upstream validation
 * gap is that gate's failure to report, not this function's.
 */
export const buildOpeningTree = (lines: readonly (readonly string[])[]): OpeningTreeNode => {
  const root = makeNode(new Chess())

  for (const line of lines) {
    const chess = new Chess()
    let node = root

    for (const san of line) {
      let move
      try {
        move = chess.move(san)
      } catch {
        break
      }

      const existing = node.children.get(move.san)
      if (existing !== undefined) {
        node = existing.node
        continue
      }

      const child = { from: move.from, to: move.to, node: makeNode(chess) }
      node.children.set(move.san, child)
      node = child.node
    }
  }

  const freeze = (node: MutableNode): OpeningTreeNode => ({
    fen: node.fen,
    check: node.check,
    children: [...node.children.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([san, child]) => ({ san, from: child.from, to: child.to, node: freeze(child.node) })),
  })

  return freeze(root)
}
