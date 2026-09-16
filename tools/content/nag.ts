import type { ReplyQuality } from './types.ts'

/**
 * Numeric annotation glyphs, and the one domain field that can carry them.
 *
 * PGN annotates any move with a NAG. This model annotates only the *opponent's* reply,
 * with `replyQuality` — because a quality is a claim about how bad a reply was and what
 * the learner therefore gets, which is meaningless on a move the gambit prescribes
 * (`docs/CONTEXT.md`, *Reply quality*).
 *
 * So the mapping is deliberately lossy in one direction: a NAG on a learner's move has
 * nowhere to go. The importer keeps it as a YAML comment beside the ply rather than
 * inventing a field for it, and says so in its summary. Build-time only.
 */

/** `!!` and `!` are different claims; `!?` is an author liking a move, which is `good`. */
const QUALITY_FOR_NAG: Readonly<Record<string, ReplyQuality>> = {
  $1: 'good',
  $2: 'mistake',
  $3: 'best',
  $4: 'blunder',
  $5: 'good',
  $6: 'inaccuracy',
}

/**
 * The canonical NAG for each quality, for export. `good` maps back to `$1` rather than
 * `$5`: the round trip through a board GUI preserves the *quality*, which is the field
 * this model owns, not the glyph the original author happened to type.
 */
const NAG_FOR_QUALITY: Readonly<Record<ReplyQuality, string>> = {
  best: '$3',
  good: '$1',
  inaccuracy: '$6',
  mistake: '$2',
  blunder: '$4',
}

/** How a chess player reads the glyph, used only in the comment the importer leaves behind. */
const SYMBOL_FOR_NAG: Readonly<Record<string, string>> = {
  $1: '!',
  $2: '?',
  $3: '!!',
  $4: '??',
  $5: '!?',
  $6: '?!',
}

/**
 * The first NAG on a move that names a reply quality. A move can carry several — `4...f6??`
 * with an explicit `$4` parses as `['$4', '$4']`, and `$11` (equal position) is not a
 * quality at all — so the first one that maps is the answer and the rest stay in the comment.
 */
export const qualityForNags = (nags: readonly string[]): ReplyQuality | undefined => {
  for (const nag of nags) {
    const quality = QUALITY_FOR_NAG[nag]
    if (quality !== undefined) return quality
  }
  return undefined
}

export const nagForQuality = (quality: ReplyQuality): string => NAG_FOR_QUALITY[quality]

/** `'$2'` -> `'$2 (?)'`, or the bare NAG when it has no familiar glyph. */
export const describeNag = (nag: string): string => {
  const symbol = SYMBOL_FOR_NAG[nag]
  return symbol === undefined ? nag : `${nag} (${symbol})`
}
