import { parseGames } from '@mliebelt/pgn-parser'
import type { ParseTree } from '@mliebelt/pgn-parser'
import { Document, isNode } from 'yaml'
import type { Position } from './board.ts'
import { applyPly, replay } from './board.ts'
import { describeNag, qualityForNags } from './nag.ts'
import type { AuthoredEntry, AuthoredNode, AuthoredOutcome, AuthoredRoot } from './schema.ts'
import type { Category, ReplyQuality, Side, SoundnessValue } from './types.ts'

/**
 * `npm run import-pgn` — a PGN authored in a board GUI becomes the YAML that is from then
 * on the only source of truth (ADR-0004).
 *
 * `@mliebelt/pgn-parser` supplies the *structure*, including recursive variations, and
 * `chess.js` (through `board.ts`) supplies the *rules*. That split is not a preference:
 * `chess.js`'s own `loadPgn()` walks the mainline and silently discards every variation,
 * so a two-branch PGN round-trips through it with neither branch left (ADR-0004, verified
 * by experiment). The parser is never asked whether a move is legal, and the engine is
 * never asked what the tree looks like.
 *
 * What this produces is a *skeleton*, and the word is meant literally. It carries the
 * moves, the branch structure, the comments and the reply qualities, and it does not carry
 * a single judgement the tool is not entitled to make: no `dismissed` reasons, no
 * assessments, no soundness it was not told. The import runs the content gate over its own
 * output and prints what is still missing rather than filling it in, because a `dismissed`
 * entry auto-generated with a manufactured reason would satisfy ADR-0004 check 7 while
 * meaning nothing — which is the one check the product actually turns on.
 *
 * Build-time only. Neither the parser nor the engine reaches a browser.
 */

type PgnMove = ParseTree['moves'][number]
type Tags = ParseTree['tags']

export type ImportProblem = {
  readonly message: string
  readonly at: { readonly line: number; readonly column: number } | undefined
}

export type ImportSummary = {
  readonly definingLine: readonly string[]
  readonly nodeCount: number
  /** Nodes with more than one child — the branch structure this whole pipeline exists for. */
  readonly branchPoints: number
  readonly annotations: number
  readonly qualities: number
  /** NAGs kept only as a YAML comment because the domain has nowhere to put them. */
  readonly keptNags: number
}

export type ImportResult =
  | { readonly ok: true; readonly yaml: string; readonly summary: ImportSummary }
  | { readonly ok: false; readonly problem: ImportProblem }

export type ImportOptions = {
  readonly id: string
  readonly name: string | undefined
  readonly eco: string | undefined
  /** The side the learner plays. Never guessed: it decides every derived `kind`. */
  readonly side: Side
  readonly category: Category
  /** A judgement, so it is always supplied rather than defaulted (docs/CONTEXT.md, Soundness). */
  readonly soundness: SoundnessValue
  readonly author: string | undefined
  /** ISO date recorded as when these judgements were made. */
  readonly today: string
  /** Overrides the derived defining line. */
  readonly definingPlies: number | undefined
}

/** One ply of the PGN, with the alternatives at that ply as siblings rather than as a side list. */
type PgnNode = {
  readonly san: string
  readonly nags: readonly string[]
  readonly comment: string | undefined
  readonly children: readonly PgnNode[]
}

type Level = readonly PgnNode[]

const problem = (message: string): ImportResult => ({
  ok: false,
  problem: { message, at: undefined },
})

const textOf = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * `Tags` declares every tag as present, which the parser does not honour — a PGN without
 * an `ECO` tag yields no `ECO` key at all. Read through `unknown` so the absence is real.
 */
const tagValue = (
  tags: Tags,
  key: 'ECO' | 'Event' | 'Opening' | 'Annotator' | 'FEN',
): string | undefined => {
  if (tags === undefined) return undefined
  const value: unknown = tags[key]
  return typeof value === 'string' ? textOf(value) : undefined
}

/** `nag` is declared `string[]` and is `null` on a move that carries none. */
const nagsOf = (move: PgnMove): readonly string[] => (Array.isArray(move.nag) ? move.nag : [])

/** A comment before the move and one after it are both about this ply; the node keeps both. */
const commentOf = (move: PgnMove): string | undefined => {
  const before = textOf(move.commentMove)
  const after = textOf(move.commentAfter)
  if (before === undefined) return after
  return after === undefined ? before : `${before} ${after}`
}

/**
 * The parser hangs a move's alternatives off the move they replace. The domain wants them
 * as siblings under the shared parent, because that is what a branch *is* — so the first
 * move of a sequence and every variation of it become one level.
 */
const toNodes = (moves: readonly PgnMove[]): Level => {
  const [head, ...rest] = moves
  if (head === undefined) return []
  const node: PgnNode = {
    san: head.notation.notation,
    nags: nagsOf(head),
    comment: commentOf(head),
    children: toNodes(rest),
  }
  return [node, ...head.variations.flatMap(toNodes)]
}

/** How many plies pass before the first branch. */
const unbranchedDepth = (roots: Level): number => {
  let depth = 0
  let level: Level = roots
  while (level.length === 1) {
    const only = level[0]
    if (only === undefined) break
    depth += 1
    level = only.children
  }
  return depth
}

/**
 * Invariant 5: a defining line ends with the learner's own ply, so the root is always an
 * opponent node and the opponent's error is always a modelled reply carrying a quality.
 * Ply 1 is White's, so the learner's plies are the odd ones when the learner is White.
 */
const trimToLearnerPly = (depth: number, side: Side): number => {
  const endsOnLearner = depth % 2 === (side === 'white' ? 1 : 0)
  return endsOnLearner ? depth : depth - 1
}

const walkMainline = (roots: Level, depth: number): { nodes: readonly PgnNode[]; level: Level } => {
  const nodes: PgnNode[] = []
  let level: Level = roots
  while (nodes.length < depth) {
    const first = level[0]
    if (first === undefined) break
    nodes.push(first)
    level = first.children
  }
  return { nodes, level }
}

type Build = {
  readonly learnerSide: Side
  readonly comments: { readonly path: readonly (string | number)[]; readonly text: string }[]
  nodeCount: number
  branchPoints: number
  annotations: number
  qualities: number
  keptNags: number
  failure: ImportProblem | undefined
}

const UNEXPLORED: AuthoredOutcome = { type: 'unexplored' }

/**
 * NAGs that survived into `replyQuality` are in the data; the rest are recorded beside the
 * ply so that nothing the author wrote disappears without saying so.
 */
const noteNags = (
  build: Build,
  nags: readonly string[],
  applied: ReplyQuality | undefined,
  path: readonly (string | number)[],
  learnerMove: boolean,
): void => {
  if (nags.length === 0) return
  if (applied !== undefined && nags.length === 1) return
  build.keptNags += 1
  const glyphs = nags.map(describeNag).join(', ')
  const why = learnerMove
    ? 'a move the gambit prescribes carries no `replyQuality` (docs/CONTEXT.md, Reply quality)'
    : 'kept from the source PGN'
  build.comments.push({ path, text: ` PGN NAG ${glyphs} — ${why}` })
}

const buildChildren = (
  build: Build,
  nodes: Level,
  position: Position,
  parentPath: readonly (string | number)[],
  sanPath: readonly string[],
): AuthoredNode[] => {
  if (nodes.length > 1) build.branchPoints += 1
  const children: AuthoredNode[] = []

  nodes.forEach((node, index) => {
    if (build.failure !== undefined) return
    const path = [...parentPath, 'children', index]
    const played = applyPly(position, node.san)
    if (!played.ok) {
      const where = sanPath.length === 0 ? 'the gambit root' : sanPath.join(' ')
      build.failure = {
        message:
          `\`${node.san}\` is not a legal move after ${where}. The parser reads PGN structure and ` +
          `never checks a move; chess.js does, and it refuses this one.` +
          (played.suggestions.length === 0
            ? ''
            : ` Legal moves to that square: ${played.suggestions.join(', ')}.`),
        at: undefined,
      }
      return
    }

    build.nodeCount += 1
    const learnerMove = position.turn === build.learnerSide
    const quality = learnerMove ? undefined : qualityForNags(node.nags)
    if (quality !== undefined) build.qualities += 1
    noteNags(build, node.nags, quality, [...path, 'ply'], learnerMove)
    if (node.comment !== undefined) build.annotations += 1

    const nextSanPath = [...sanPath, played.canonical]
    const grandchildren = buildChildren(build, node.children, played.position, path, nextSanPath)

    children.push({
      ply: played.canonical,
      ...(node.comment === undefined ? {} : { annotation: { vi: node.comment } }),
      ...(quality === undefined ? {} : { replyQuality: quality }),
      ...(grandchildren.length === 0 ? { outcome: UNEXPLORED } : { children: grandchildren }),
    })
  })

  return children
}

const HEADER =
  ' Imported from PGN by `npm run import-pgn`. From here this file is the only source of\n' +
  ' truth; the PGN is not kept (ADR-0004). Regenerate one for a board GUI with\n' +
  ' `npm run export-pgn`.\n' +
  '\n' +
  ' This is a skeleton. `npm run validate:content` lists what it cannot state for you:\n' +
  ' every legal reply at an opponent node is either modelled or dismissed with a real\n' +
  ' reason, and every leaf that is not `unexplored` needs an assessment you write.'

const toYaml = (entry: AuthoredEntry, comments: Build['comments']): string => {
  /**
   * `aliasDuplicateObjects` is on by default and would emit `&a1`/`*a1` the moment two
   * fields share an object — `soundness.basis` and `judgement` are the same author on the
   * same date, and every `unexplored` outcome is the same value. The loader refuses
   * anchors and aliases outright (docs/security.md, B1), so the importer would otherwise
   * produce a file its own content gate rejects.
   */
  const doc = new Document(entry, { aliasDuplicateObjects: false })
  doc.commentBefore = HEADER
  for (const { path, text } of comments) {
    const node = doc.getIn(path, true)
    // Appended, never replaced: two notes can land on the same field — a NAG on a defining
    // line that also needs an invariant-5 note — and assigning would silently drop one.
    if (isNode(node))
      node.comment = typeof node.comment === 'string' ? `${node.comment} ·${text}` : text
  }
  return doc.toString({ lineWidth: 100, singleQuote: true })
}

const syntaxProblem = (error: unknown): ImportResult => {
  const message = error instanceof Error ? error.message : String(error)
  const location: unknown =
    error instanceof Error && 'location' in error ? error.location : undefined
  if (typeof location !== 'object' || location === null || !('start' in location)) {
    return { ok: false, problem: { message, at: undefined } }
  }
  const start: unknown = location.start
  if (typeof start !== 'object' || start === null || !('line' in start) || !('column' in start)) {
    return { ok: false, problem: { message, at: undefined } }
  }
  const { line, column } = start
  return {
    ok: false,
    problem: {
      message,
      at: typeof line === 'number' && typeof column === 'number' ? { line, column } : undefined,
    },
  }
}

export const importPgn = (pgn: string, options: ImportOptions): ImportResult => {
  let games: readonly ParseTree[]
  try {
    games = parseGames(pgn)
  } catch (error) {
    return syntaxProblem(error)
  }

  const [game, ...extra] = games
  if (game === undefined) return problem('The file contains no game.')
  if (extra.length > 0) {
    return problem(
      `The file contains ${games.length} games. One PGN file becomes one entry, so split it first.`,
    )
  }
  if (tagValue(game.tags, 'FEN') !== undefined) {
    return problem(
      'This PGN starts from a `FEN` tag. Every position in this model is derived by replaying ' +
        'from the standard starting position (docs/CONTEXT.md, invariant 1), so a set-up position ' +
        'has no defining line to name it.',
    )
  }

  const eco = options.eco ?? tagValue(game.tags, 'ECO')
  if (eco === undefined) {
    return problem('No ECO code. The PGN carries no `ECO` tag, so pass `--eco`, e.g. `--eco C40`.')
  }
  const author = options.author ?? tagValue(game.tags, 'Annotator')
  if (author === undefined) {
    return problem(
      'No author. Every judgement in this file is attributed (docs/CONTEXT.md, invariant 7b), ' +
        'so pass `--author`, or give the PGN an `Annotator` tag.',
    )
  }

  const roots = toNodes(game.moves)
  if (roots.length === 0) return problem('The game has no moves.')
  if (roots.length > 1) {
    return problem(
      'The PGN branches at the very first ply, so there is no defining line to derive.',
    )
  }

  const depth = options.definingPlies ?? trimToLearnerPly(unbranchedDepth(roots), options.side)
  if (depth < 1) {
    return problem(
      'The defining line would be empty: the PGN branches before the learner has played a ply. ' +
        'A defining line ends with the learner’s own move (docs/CONTEXT.md, invariant 5), so ' +
        'pass `--defining-plies` if the branch really does belong at the root.',
    )
  }

  const { nodes, level } = walkMainline(roots, depth)
  const plies = nodes.map((node) => node.san)
  if (plies.length < depth) {
    return problem(
      `The game is ${plies.length} plies long, so it has no ${depth}-ply defining line.`,
    )
  }

  const opening = replay(plies)
  if (!opening.ok) {
    return problem(
      `\`${plies[opening.index] ?? ''}\` is not legal at ply ${opening.index + 1} of the defining line.`,
    )
  }
  /**
   * Invariant 5 wants a defining line that ends with the learner's own ply, so the root is
   * an opponent node and the opponent's error is always a modelled reply carrying a
   * quality. The derivation above always produces one. An explicitly pinned
   * `--defining-plies` can still land the other way, and that stays the author's call
   * rather than a refusal: the check is not in the content gate, and merged fixtures in
   * this repository sit on the other side of it. It is recorded in the file instead.
   */
  const rootIsLearnerNode = opening.position.turn === options.side

  const build: Build = {
    learnerSide: options.side,
    comments: [],
    nodeCount: 1,
    branchPoints: 0,
    annotations: 0,
    qualities: 0,
    keptNags: 0,
    failure: undefined,
  }
  const children = buildChildren(build, level, opening.position, ['tree'], [])
  if (build.failure !== undefined) return { ok: false, problem: build.failure }

  /**
   * A comment on a defining-line ply describes the position the root *is*, so it becomes
   * the root's annotation rather than being dropped. AC 1 says comments are preserved, and
   * "except the ones before the branch point" is not preserving them.
   */
  const openingComment = nodes
    .map((node) => node.comment)
    .filter((comment) => comment !== undefined)
    .join(' ')
  if (openingComment !== '') build.annotations += 1

  const judgement = { by: author, at: options.today }
  const tree: AuthoredRoot = {
    ...(openingComment === '' ? {} : { annotation: { vi: openingComment } }),
    ...(children.length === 0 ? { outcome: UNEXPLORED } : { children }),
  }

  if (rootIsLearnerNode) {
    build.comments.push({
      path: ['definingLine'],
      text:
        ` This line ends with the opponent's ply, so the root is a ${options.side} (learner) node.` +
        ' docs/CONTEXT.md invariant 5 expects a defining line to end with the learner\u2019s own move.',
    })
  }

  // A NAG on a defining-line ply has no node of its own to sit beside, and the defining
  // line is not a reply, so there is no `replyQuality` for it either. It is recorded here
  // rather than discarded.
  const openingNags = nodes.flatMap((node, index) =>
    node.nags.length === 0 ? [] : [`${index + 1}:${node.nags.map(describeNag).join('/')}`],
  )
  if (openingNags.length > 0) {
    build.keptNags += 1
    build.comments.push({
      path: ['definingLine'],
      text: ` PGN NAGs on the defining line, by ply: ${openingNags.join(', ')}`,
    })
  }

  const entry: AuthoredEntry = {
    id: options.id,
    name:
      options.name ?? tagValue(game.tags, 'Opening') ?? tagValue(game.tags, 'Event') ?? options.id,
    eco,
    category: options.category,
    side: options.side,
    definingLine: [...opening.canonical],
    soundness: { value: options.soundness, reviewedAt: options.today, basis: judgement },
    judgement,
    tree,
  }

  return {
    ok: true,
    yaml: toYaml(entry, build.comments),
    summary: {
      definingLine: [...opening.canonical],
      nodeCount: build.nodeCount,
      branchPoints: build.branchPoints,
      annotations: build.annotations,
      qualities: build.qualities,
      keptNags: build.keptNags,
    },
  }
}
