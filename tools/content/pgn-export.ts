import { nagForQuality } from './nag.ts'
import type { ContentNode, Entry, Outcome } from './types.ts'
import { assertNever } from './types.ts'

/**
 * `npm run export-pgn` — regenerate a PGN from the YAML so a line can be replayed in a
 * board GUI.
 *
 * This exists because of an admission in ADR-0004. The ADR rejects hand-written YAML on
 * the grounds that SAN typed without a board in front of you is the largest class of
 * authoring error — and then made exactly that the permanent steady state, because the
 * GUI protected only the first import. The gate catches illegal moves and mis-disambiguated
 * ones; it cannot catch a legal move that is the wrong move, which is precisely what a
 * board prevents and a text editor invites.
 *
 * The output is **generated and never committed**. The YAML remains the only source of
 * truth, so nothing here needs to round-trip back: what the author checks in a GUI is the
 * moves, and what they then fix is the YAML.
 *
 * Build-time only.
 */

/**
 * A PGN comment is delimited by braces and cannot contain a closing one. Content prose is
 * arbitrary text written by a human, so the braces go rather than the comment.
 */
const commentText = (text: string): string => text.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()

const outcomeComment = (outcome: Outcome): string => {
  switch (outcome.kind) {
    case 'mate':
      return `Forced mate in ${outcome.inMoves} (proved by ${outcome.provedBy}): ${outcome.sequence.join(' ')}`
    case 'position':
      return `Assessment: ${outcome.evaluation.vi} Plan: ${outcome.plan.vi}`
    case 'unexplored':
      return 'Not yet mapped.'
    default:
      return assertNever(outcome)
  }
}

/**
 * Everything the model carries that PGN has no field for, written into the comment rather
 * than dropped. A dismissal in particular is the omission the learner is entitled to see,
 * so it is not allowed to vanish just because the format has nowhere for it.
 */
const commentsFor = (node: ContentNode): readonly string[] => {
  const parts: string[] = []
  if (node.annotation !== undefined) parts.push(node.annotation.vi)
  if (node.outcome !== undefined) parts.push(outcomeComment(node.outcome))
  if (node.transposesTo !== undefined) parts.push(`Transposes to: ${node.transposesTo.join(' ')}`)
  if (node.dismissed.length > 0) {
    const listed = node.dismissed.map((reply) => `${reply.ply} — ${reply.reason}`).join('; ')
    parts.push(`Dismissed replies: ${listed}`)
  }
  const text = commentText(parts.join(' '))
  return text === '' ? [] : [`{${text}}`]
}

/**
 * Every ply carries its move number, including Black's. The bare form is the usual export
 * style, but it is only unambiguous when the reader tracks which side moved last across
 * comments and variation brackets — and a tree of nested variations is exactly where that
 * bookkeeping goes wrong. `4... Ke7` is valid PGN and needs no bookkeeping at all.
 */
const plyToken = (plyIndex: number, san: string): string =>
  plyIndex % 2 === 0 ? `${plyIndex / 2 + 1}. ${san}` : `${(plyIndex - 1) / 2 + 1}... ${san}`

const parenthesise = (tokens: readonly string[]): readonly string[] =>
  tokens.map((token, index) => {
    const opened = index === 0 ? `(${token}` : token
    return index === tokens.length - 1 ? `${opened})` : opened
  })

const nodeTokens = (node: ContentNode, plyIndex: number): readonly string[] => {
  const san = node.ply
  if (san === undefined) return commentsFor(node)
  const nag = node.replyQuality === undefined ? [] : [nagForQuality(node.replyQuality)]
  return [plyToken(plyIndex, san), ...nag, ...commentsFor(node)]
}

/**
 * The first child continues the line and every other child becomes a variation, placed
 * immediately after the move it replaces — which is where the parser puts them and where a
 * board GUI expects to find them.
 */
const levelTokens = (nodes: readonly ContentNode[], plyIndex: number): readonly string[] => {
  const [head, ...rest] = nodes
  if (head === undefined) return []
  return [
    ...nodeTokens(head, plyIndex),
    ...rest.flatMap((alternative) =>
      parenthesise([
        ...nodeTokens(alternative, plyIndex),
        ...levelTokens(alternative.children, plyIndex + 1),
      ]),
    ),
    ...levelTokens(head.children, plyIndex + 1),
  ]
}

/** The PGN export format wraps movetext at 80 columns. Tokens are never split. */
const wrap = (tokens: readonly string[]): string => {
  const lines: string[] = []
  let current = ''
  for (const token of tokens) {
    if (current === '') current = token
    else if (current.length + 1 + token.length <= 80) current = `${current} ${token}`
    else {
      lines.push(current)
      current = token
    }
  }
  if (current !== '') lines.push(current)
  return lines.join('\n')
}

const tagPair = (name: string, value: string): string => `[${name} "${value.replace(/"/g, "'")}"]`

export const exportPgn = (entry: Entry): string => {
  const tags = [
    // The seven tag roster, in its required order. Nothing in this model is a played game,
    // so the fields that describe an event are filled with the spec's unknown markers.
    tagPair('Event', entry.name),
    tagPair('Site', '?'),
    tagPair('Date', '????.??.??'),
    tagPair('Round', '-'),
    tagPair('White', '?'),
    tagPair('Black', '?'),
    tagPair('Result', '*'),
    tagPair('ECO', entry.eco),
    tagPair('Annotator', entry.judgement.by),
  ]

  const defining = entry.definingLine.map((san, index) => plyToken(index, san))
  const movetext = [
    ...defining,
    ...commentsFor(entry.tree),
    ...levelTokens(entry.tree.children, entry.definingLine.length),
    '*',
  ]

  return `${tags.join('\n')}\n\n${wrap(movetext)}\n`
}
