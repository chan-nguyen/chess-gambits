import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { certificateFileName } from '../mate/certificate.ts'
import { describeFailure, verifyCertificate } from '../mate/verify.ts'
import type { Position } from './board.ts'
import { applyPly, replay } from './board.ts'
import type { ContentIssue, IssueCode, SourceLocation } from './issue.ts'
import { joinDataPath, joinNodePath } from './issue.ts'
import { findDerivedFields } from './derived-fields.ts'
import type {
  AuthoredAnnotation,
  AuthoredDismissRest,
  AuthoredEntry,
  AuthoredNode,
  AuthoredOutcome,
  AuthoredRoot,
} from './schema.ts'
import { parseEntry } from './schema.ts'
import type {
  Annotation,
  ContentNode,
  DismissRest,
  DismissedReply,
  Entry,
  ForcedMate,
  NodeKind,
  Outcome,
  ReplyQuality,
  Side,
  Tier,
} from './types.ts'
import { assertNever } from './types.ts'
import type { YamlSource } from './yaml-source.ts'
import { loadYaml } from './yaml-source.ts'

/**
 * The content gate (requirement F12). Implements the blocking checks of ADR-0004: schema,
 * legality, SAN canonicalisation, checkmate and non-mate assertion, reply completeness,
 * duplicates and transpositions, i18n completeness and side consistency — and the two
 * halves of ADR-0005 that belong to content rather than to a certificate: a claimed trap is
 * replaced by a proved mate or the file is refused, and a proved mate is reachable only the
 * way invariant 5 says it may be.
 *
 * Every issue names the file and the node, as a SAN path and as a data path, because an
 * error the author cannot locate is an error they will work around rather than fix.
 */

export type Coverage = {
  readonly slots: number
  readonly vi: number
  readonly en: number
  readonly fr: number
}

/**
 * One accepted `dismissRest` and what it actually covers.
 *
 * The catch-all is one line of YAML standing in for any number of replies, so the validator
 * states that number back at the author rather than letting the line hide it (issue #29,
 * AC 4). It is not an issue: a counted, reasoned omission is what invariant 7a asks for.
 */
export type DismissRestReport = {
  /** The node as a chess player reads it, e.g. `tree > Bxb4`. */
  readonly nodePath: string
  readonly dataPath: string
  readonly covers: readonly string[]
  readonly legalReplies: number
}

/**
 * One leaf marked `type: trap`, whether or not a proof was found for it.
 *
 * Reported even when the claim was refused, because that is precisely the state
 * `npm run prove:mates` exists to act on: it needs to know which leaf to send to the oracle,
 * and the only file that knows is the one the gate has just rejected.
 */
export type MateClaim = {
  readonly entryId: string
  /** Canonical SAN from the entry root, which is what names the certificate. */
  readonly nodePath: readonly string[]
  /** The whole game to this leaf: the defining line followed by the node path. */
  readonly line: readonly string[]
  /** The file a proof of this claim must live in, beside the content file. */
  readonly certificate: string
  /** The side that would deliver the mate — always the learner (invariant 5). */
  readonly attacker: Side
  readonly proved: boolean
}

export type EntryReport = {
  readonly file: string
  readonly issues: readonly ContentIssue[]
  /** Present only when the file validated; carries the derived `kind`, position and `tier`. */
  readonly entry: Entry | undefined
  readonly coverage: Coverage
  readonly nodeCount: number
  readonly dismissedCount: number
  readonly dismissRest: readonly DismissRestReport[]
  readonly mateClaims: readonly MateClaim[]
}

/**
 * How the validator gets hold of a certificate. The default reads the file that sits beside
 * the content file, which is where `prove:mates` writes it (ADR-0005, step 3).
 *
 * Injectable so a test can state a certificate inline rather than on disk, and so a caller
 * that has already loaded and verified a corpus does not pay for it twice. It returns raw
 * JSON rather than a verdict on purpose: **verification always happens here**, so there is
 * no way to hand this module a proof it has not checked itself.
 */
export type CertificateSource = (directory: string, fileName: string) => unknown

const readCertificateFile: CertificateSource = (directory, fileName) => {
  try {
    const text: string = readFileSync(join(directory, fileName), 'utf8')
    const parsed: unknown = JSON.parse(text)
    return parsed
  } catch {
    return undefined
  }
}

type Walk = {
  readonly source: YamlSource
  readonly learnerSide: Side
  readonly entryId: string
  /** Canonical, so a certificate's `line` can be compared ply for ply. Known after replay. */
  definingLine: readonly string[]
  /** Where certificates live: the directory holding the content file. */
  readonly directory: string
  readonly certificates: CertificateSource
  readonly mateClaims: MateClaim[]
  readonly issues: ContentIssue[]
  /** Canonical SAN path from the entry root -> the position there, for transposition lookup. */
  readonly byPath: Map<string, Position>
  /** First-four-FEN-fields -> the node paths that reach it, for duplicate detection. */
  readonly byPositionKey: Map<string, string[]>
  readonly transpositions: {
    readonly from: readonly string[]
    readonly to: readonly string[]
    readonly position: Position
    readonly dataPath: readonly (string | number)[]
  }[]
  coverage: { slots: number; vi: number; en: number; fr: number }
  nodeCount: number
  dismissedCount: number
  readonly dismissRest: DismissRestReport[]
}

const report = (
  walk: Walk,
  code: IssueCode,
  dataPath: readonly (string | number)[],
  sanPath: readonly string[] | undefined,
  message: string,
): void => {
  const at: SourceLocation | undefined = walk.source.locate(dataPath)
  walk.issues.push({
    file: walk.source.file,
    code,
    dataPath: joinDataPath(dataPath),
    nodePath: sanPath === undefined ? undefined : joinNodePath(sanPath),
    at,
    message,
  })
}

const toAnnotation = (authored: AuthoredAnnotation): Annotation => ({
  vi: authored.vi,
  en: authored.en,
  fr: authored.fr,
})

/**
 * The two authored outcomes that mean what they say. A `trap` claim is not one of them: it
 * is a request for a proof, answered by `proveTrap`, and the type excludes it here so that
 * forgetting to handle it is a compile error rather than a mate claim nobody checked.
 */
type StatedOutcome = Exclude<AuthoredOutcome, { type: 'trap' }>

const toOutcome = (authored: StatedOutcome): Outcome => {
  switch (authored.type) {
    case 'unexplored':
      return { kind: 'unexplored' }
    case 'position':
      return {
        kind: 'position',
        evaluation: toAnnotation(authored.evaluation),
        plan: toAnnotation(authored.plan),
        basis: {
          basis: 'judgement',
          by: authored.basis.by,
          at: authored.basis.at,
          source: authored.basis.source,
        },
      }
    default:
      return assertNever(authored)
  }
}

/** What an outcome contributes to the derived tier. Exhaustive over all three shapes. */
const outcomeReachesTier = (outcome: Outcome): { mapped: boolean; taught: boolean } => {
  switch (outcome.kind) {
    case 'mate':
      // Generated by the build (#5). A proved mate is fully mapped and fully taught.
      return { mapped: true, taught: true }
    case 'position':
      return { mapped: true, taught: true }
    case 'unexplored':
      // The honest "not yet mapped" state; it is what holds an entry below Mapped.
      return { mapped: false, taught: false }
    default:
      return assertNever(outcome)
  }
}

/**
 * Turn a claimed trap into a proved mate, or refuse it (ADR-0005; invariants 4 and 5).
 *
 * Nothing here is taken on trust. The certificate is found by name derived from the entry
 * and the node, replayed move by move by `verifyCertificate`, and then checked *again*
 * against this file: the game it proves must be this entry's defining line followed by this
 * node's path, and the side it mates with must be the learner. A certificate that proves a
 * real mate somewhere else is not a proof of anything here.
 *
 * A claim that cannot be proved is **refused**. It is never downgraded to an assessment and
 * never carried as a warning: the leaf goes back to the author, who writes what is actually
 * true about the position.
 */
const proveTrap = (
  walk: Walk,
  sanPath: readonly string[],
  dataPath: readonly (string | number)[],
  kind: NodeKind,
  reachedThroughBlunder: boolean,
): ForcedMate | undefined => {
  const at = [...dataPath, 'outcome']
  const certificate = certificateFileName(walk.entryId, sanPath)
  const line = [...walk.definingLine, ...sanPath]

  const record = (proved: boolean): undefined => {
    walk.mateClaims.push({
      entryId: walk.entryId,
      nodePath: sanPath,
      line,
      certificate,
      attacker: walk.learnerSide,
      proved,
    })
    return undefined
  }

  // The learner is the one who springs the trap, so the claimed position is one where the
  // learner is to move. A trap claimed on an opponent node says the *opponent* mates, which
  // is not a thing this site teaches and not a thing the prover can even attribute.
  if (kind !== 'learner') {
    report(
      walk,
      'kind-mismatch',
      at,
      sanPath,
      `A \`trap\` claims that the learner mates from here, so it belongs on a learner node. Here it is the opponent's turn (docs/CONTEXT.md, Outcome).`,
    )
    return record(false)
  }

  // Invariant 5, the clause the whole invariant exists for. A mate reachable through correct
  // play would mean the gambit refutes best play, which would be the most important
  // discovery in opening theory rather than a website feature.
  if (!reachedThroughBlunder) {
    report(
      walk,
      'mate-not-through-blunder',
      at,
      sanPath,
      `A forced mate is reachable only through a reply marked \`mistake\` or \`blunder\`, and no reply on the path to this leaf carries one. If the opponent reaches this position by playing well, the claim is that the gambit refutes correct play (docs/CONTEXT.md, invariant 5).`,
    )
    return record(false)
  }

  const value = walk.certificates(walk.directory, certificate)
  if (value === undefined) {
    report(
      walk,
      'mate-unproved',
      at,
      sanPath,
      `This leaf claims a trap, and there is no proof of it: \`${certificate}\` is not beside this file. Run \`npm run prove:mates\`. A mate is generated by the build or the claim is refused — it is never written by hand and never assumed (docs/CONTEXT.md, invariant 4; ADR-0005).`,
    )
    return record(false)
  }

  const verification = verifyCertificate(certificate, value)
  if (!verification.ok) {
    report(
      walk,
      'mate-unproved',
      at,
      sanPath,
      `\`${certificate}\` does not prove a mate here:\n    ${verification.failures.map(describeFailure).join('\n    ')}`,
    )
    return record(false)
  }

  const proof = verification.proof
  if (proof.certificate.line.join(' ') !== line.join(' ')) {
    report(
      walk,
      'mate-unproved',
      at,
      sanPath,
      `\`${certificate}\` proves a mate in a different game. It replays \`${proof.certificate.line.join(' ')}\`, and this leaf is reached by \`${line.join(' ')}\`. A valid proof of the wrong position proves nothing about this one.`,
    )
    return record(false)
  }

  if (proof.attacker !== walk.learnerSide) {
    report(
      walk,
      'mate-unproved',
      at,
      sanPath,
      `\`${certificate}\` proves that ${proof.attacker} mates, but the learner plays ${walk.learnerSide}.`,
    )
    return record(false)
  }

  record(true)
  return {
    kind: 'mate',
    inMoves: proof.inMoves,
    sequence: proof.sequence,
    // A net with no defender node is a mate the attacker delivers at once: there is nothing
    // modelled, and a one-ply exhaustive search is the whole proof.
    provedBy: proof.defenderNodes === 0 ? 'search' : 'modelled-net',
    basis: { basis: 'proved', by: 'certificate', certificate },
  }
}

const countAnnotation = (walk: Walk, annotation: AuthoredAnnotation | undefined): void => {
  walk.coverage.slots += 1
  if (annotation === undefined) return
  walk.coverage.vi += 1
  if (annotation.en !== undefined) walk.coverage.en += 1
  if (annotation.fr !== undefined) walk.coverage.fr += 1
}

const shapesOf = (node: AuthoredRoot | AuthoredNode): readonly string[] =>
  [
    node.children === undefined ? undefined : 'children',
    node.outcome === undefined ? undefined : 'outcome',
    node.transposesTo === undefined ? undefined : 'transposesTo',
  ].filter((name) => name !== undefined)

/**
 * Compare the authored SAN with what `chess.js` re-serialises the move as (ADR-0004 check 3).
 * A claimed checkmate that is not checkmate, and a real checkmate that was not claimed, are
 * reported as themselves rather than as a generic spelling difference — they are the two
 * halves of the error class this project was started to demonstrate.
 */
const checkCanonical = (
  walk: Walk,
  authored: string,
  canonical: string,
  after: Position,
  dataPath: readonly (string | number)[],
  sanPath: readonly string[],
): void => {
  if (authored === canonical) return

  if (authored.endsWith('#') && !after.isCheckmate) {
    report(
      walk,
      'false-mate-claim',
      dataPath,
      sanPath,
      `\`${authored}\` claims checkmate, but the position it reaches is not checkmate. The move is \`${canonical}\` (docs/CONTEXT.md, invariant 6).`,
    )
    return
  }

  if (authored.endsWith('+') && !canonical.endsWith('+') && !canonical.endsWith('#')) {
    report(
      walk,
      'false-check-claim',
      dataPath,
      sanPath,
      `\`${authored}\` claims check, but the move gives no check. The move is \`${canonical}\`.`,
    )
    return
  }

  if (canonical.endsWith('#') && !authored.endsWith('#')) {
    report(
      walk,
      'unclaimed-mate',
      dataPath,
      sanPath,
      `\`${authored}\` is checkmate and must be written \`${canonical}\`. An unmarked mate is how a line that ends the game gets published as an ordinary move.`,
    )
    return
  }

  report(
    walk,
    'san-not-canonical',
    dataPath,
    sanPath,
    `\`${authored}\` is legal but is not the canonical SAN for the move. Write \`${canonical}\`. A move that re-serialises differently corrupts the tree silently (ADR-0004, check 3).`,
  )
}

/**
 * ADR-0004 check 7. The check the product turns on.
 *
 * Returns the replies a `dismissRest` covers here — the leftovers after modelled children
 * and individual dismissals — or nothing when there is no catch-all or it was refused.
 */
const checkReplyCompleteness = (
  walk: Walk,
  position: Position,
  modelled: ReadonlySet<string>,
  dismissed: ReadonlySet<string>,
  dismissRest: AuthoredDismissRest | undefined,
  dataPath: readonly (string | number)[],
  sanPath: readonly string[],
): readonly string[] => {
  const covered = new Set([...modelled, ...dismissed])
  const rest = position.legalMoves.filter((move) => !covered.has(move))
  const both = [...modelled].filter((move) => dismissed.has(move))

  if (dismissRest === undefined) {
    if (rest.length > 0) {
      report(
        walk,
        'reply-incomplete',
        dataPath,
        sanPath,
        `${rest.length} of ${position.legalMoves.length} legal replies are neither modelled nor dismissed: ${rest.join(', ')}. At an opponent node the learner controls nothing, so every legal reply must be answered or explicitly dismissed with a reason (docs/CONTEXT.md, invariant 7a). Where the honest answer is the same for all of them, one \`dismissRest\` with a reason covers the lot.`,
      )
    }
  } else if (rest.length === 0) {
    report(
      walk,
      'dismiss-rest-covers-nothing',
      [...dataPath, 'dismissRest'],
      sanPath,
      `\`dismissRest\` covers nothing here: all ${position.legalMoves.length} legal replies are already modelled or individually dismissed. A catch-all that answers no reply is decoration, and decoration is how it ends up pasted at every node whether it says anything or not. Remove it.`,
    )
  }

  // Checked whether or not there is a catch-all. `dismissRest` covers only what is left
  // over, so an overlap between `children` and `dismissed` is arithmetically invisible to
  // it — and a catch-all that could silence this check would be a way to file a modelled
  // reply as one of the replies nobody looked at.
  if (both.length > 0) {
    report(
      walk,
      'dismissed-also-modelled',
      dataPath,
      sanPath,
      `${both.join(', ')} ${both.length === 1 ? 'is' : 'are'} both modelled as a child and listed in \`dismissed\`. A reply is one or the other.`,
    )
  }

  return dismissRest === undefined ? [] : rest
}

const walkNode = (
  walk: Walk,
  node: AuthoredRoot | AuthoredNode,
  position: Position,
  dataPath: readonly (string | number)[],
  sanPath: readonly string[],
  ply: string | undefined,
  parentKind: NodeKind | undefined,
  reachedThroughBlunder: boolean,
): ContentNode => {
  walk.nodeCount += 1
  const kind: NodeKind = position.turn === walk.learnerSide ? 'learner' : 'opponent'
  const quality: ReplyQuality | undefined = 'replyQuality' in node ? node.replyQuality : undefined
  // Invariant 5 is about the *path*, not the leaf: the opponent's error may be several plies
  // above the mate. Once a `mistake` or `blunder` has been played, everything below it is
  // reached through one.
  const throughBlunder = reachedThroughBlunder || quality === 'mistake' || quality === 'blunder'

  const existing = walk.byPositionKey.get(position.key) ?? []
  if (node.transposesTo === undefined) {
    walk.byPositionKey.set(position.key, [...existing, joinNodePath(sanPath)])
  }
  walk.byPath.set(sanPath.join(' '), position)

  const shapes = shapesOf(node)
  if (shapes.length !== 1) {
    report(
      walk,
      'node-shape',
      dataPath,
      sanPath,
      shapes.length === 0
        ? 'A node must have exactly one of `children`, `outcome` or `transposesTo`. This one has none, so the line stops with no statement about where it stopped (ADR-0004, schema decisions).'
        : `A node must have exactly one of \`children\`, \`outcome\` or \`transposesTo\`. This one has ${shapes.join(' and ')}. Only a leaf carries an outcome (docs/CONTEXT.md, invariant 3).`,
    )
  }

  countAnnotation(walk, node.annotation)

  if (quality !== undefined && parentKind !== 'opponent') {
    report(
      walk,
      'kind-mismatch',
      [...dataPath, 'replyQuality'],
      sanPath,
      `\`replyQuality\` describes how bad the opponent's reply was, so it belongs only on a child of an opponent node. \`${ply ?? '(root)'}\` is a ${walk.learnerSide} move the gambit prescribes, not a reply (docs/CONTEXT.md, Node; ADR-0004 check 12).`,
    )
  }

  if ('frequency' in node && node.frequency !== undefined && parentKind !== 'opponent') {
    report(
      walk,
      'kind-mismatch',
      [...dataPath, 'frequency'],
      sanPath,
      `\`frequency\` describes how often the opponent plays a reply, so it belongs only on a child of an opponent node.`,
    )
  }

  const dismissedReplies: DismissedReply[] = []
  const dismissedSet = new Set<string>()
  if (node.dismissed !== undefined) {
    walk.dismissedCount += node.dismissed.length
    if (kind !== 'opponent') {
      report(
        walk,
        'kind-mismatch',
        [...dataPath, 'dismissed'],
        sanPath,
        `\`dismissed\` lists opponent replies that are deliberately not modelled, so it belongs only on an opponent node. Here it is ${walk.learnerSide}'s turn, and what ${walk.learnerSide} plays is the gambit's choice (docs/CONTEXT.md, Node).`,
      )
    }
    if (node.children === undefined) {
      report(
        walk,
        'dismissed-without-children',
        [...dataPath, 'dismissed'],
        sanPath,
        '`dismissed` records the replies not modelled *beside* the ones that are. A node that models no replies is a leaf and states an `outcome` instead.',
      )
    }
    node.dismissed.forEach((entry, index) => {
      const at = [...dataPath, 'dismissed', index, 'ply']
      const played = applyPly(position, entry.ply)
      if (!played.ok) {
        report(
          walk,
          'dismissed-not-legal',
          at,
          sanPath,
          `\`${entry.ply}\` is dismissed as a reply but is not legal here. Dismissing a move that cannot be played hides a reply that can.${played.suggestions.length === 0 ? '' : ` Legal moves to that square: ${played.suggestions.join(', ')}.`}`,
        )
        return
      }
      checkCanonical(walk, entry.ply, played.canonical, played.position, at, sanPath)
      dismissedSet.add(played.canonical)
      dismissedReplies.push({ ply: played.canonical, reason: entry.reason })
    })
  }

  if (node.dismissRest !== undefined) {
    // A learner reads this reason, so it is counted as translatable prose like any other
    // learner-facing text. A catch-all left untranslated is a locale in which 34 replies
    // are answered in Vietnamese.
    countAnnotation(walk, node.dismissRest.reason)

    if (kind !== 'opponent') {
      report(
        walk,
        'kind-mismatch',
        [...dataPath, 'dismissRest'],
        sanPath,
        `\`dismissRest\` answers the opponent replies that are not modelled, so it belongs only on an opponent node. Here it is ${walk.learnerSide}'s turn, and what ${walk.learnerSide} plays is the gambit's choice, not a reply to be covered (docs/CONTEXT.md, Node).`,
      )
    }

    if (node.children === undefined) {
      report(
        walk,
        'dismissed-without-children',
        [...dataPath, 'dismissRest'],
        sanPath,
        '`dismissRest` answers the replies not modelled *beside* the ones that are. A node that models no replies is a leaf and states an `outcome` instead — a catch-all here would be silently ignored.',
      )
    }
  }

  const children: ContentNode[] = []
  const modelled = new Set<string>()
  if (node.children !== undefined) {
    const seen = new Set<string>()
    node.children.forEach((child, index) => {
      const at = [...dataPath, 'children', index]
      if (seen.has(child.ply)) {
        report(
          walk,
          'duplicate-san',
          [...at, 'ply'],
          sanPath,
          `Two children of this node are both \`${child.ply}\`. A position has one node per reply (ADR-0004, check 9).`,
        )
        return
      }
      seen.add(child.ply)

      const played = applyPly(position, child.ply)
      if (!played.ok) {
        report(
          walk,
          'illegal-move',
          [...at, 'ply'],
          sanPath,
          `\`${child.ply}\` is not a legal move in this position.${played.suggestions.length === 0 ? '' : ` Did you mean ${played.suggestions.join(' or ')}? A move that needs disambiguation must carry it.`}`,
        )
        return
      }

      checkCanonical(
        walk,
        child.ply,
        played.canonical,
        played.position,
        [...at, 'ply'],
        [...sanPath, played.canonical],
      )
      modelled.add(played.canonical)
      children.push(
        walkNode(
          walk,
          child,
          played.position,
          at,
          [...sanPath, played.canonical],
          played.canonical,
          kind,
          throughBlunder,
        ),
      )
    })
  }

  const covers =
    kind === 'opponent' && node.children !== undefined
      ? checkReplyCompleteness(
          walk,
          position,
          modelled,
          dismissedSet,
          node.dismissRest,
          dataPath,
          sanPath,
        )
      : []

  const dismissRest: DismissRest | undefined =
    node.dismissRest === undefined
      ? undefined
      : { reason: toAnnotation(node.dismissRest.reason), covers }

  if (covers.length > 0) {
    walk.dismissRest.push({
      nodePath: joinNodePath(sanPath),
      dataPath: joinDataPath([...dataPath, 'dismissRest']),
      covers,
      legalReplies: position.legalMoves.length,
    })
  }

  const outcome: Outcome | undefined =
    node.outcome === undefined
      ? undefined
      : node.outcome.type === 'trap'
        ? proveTrap(walk, sanPath, dataPath, kind, throughBlunder)
        : toOutcome(node.outcome)
  if (outcome !== undefined && outcome.kind === 'position') {
    walk.coverage.slots += 2
    walk.coverage.vi += 2
    if (outcome.evaluation.en !== undefined) walk.coverage.en += 1
    if (outcome.plan.en !== undefined) walk.coverage.en += 1
    if (outcome.evaluation.fr !== undefined) walk.coverage.fr += 1
    if (outcome.plan.fr !== undefined) walk.coverage.fr += 1

    if (position.isCheckmate || position.isStalemate) {
      report(
        walk,
        'assessment-is-terminal',
        [...dataPath, 'outcome'],
        sanPath,
        `This leaf is assessed as a playable position, but the game is over here — it is ${position.isCheckmate ? 'checkmate' : 'stalemate'}. This is the reverse of a false mate claim, and it is what mislabels a finished game as a middlegame (ADR-0004, check 5).`,
      )
    }
  }

  if (node.transposesTo !== undefined) {
    walk.transpositions.push({
      from: sanPath,
      to: node.transposesTo,
      position,
      dataPath: [...dataPath, 'transposesTo'],
    })
  }

  return {
    ply,
    kind,
    fen: position.fen,
    annotation: node.annotation === undefined ? undefined : toAnnotation(node.annotation),
    replyQuality: quality,
    frequency: 'frequency' in node ? node.frequency : undefined,
    dismissed: dismissedReplies,
    dismissRest,
    children,
    outcome,
    transposesTo: node.transposesTo,
  }
}

/** ADR-0004 check 9, scoped within one entry (docs/CONTEXT.md, invariant 12). */
const checkDuplicatePositions = (walk: Walk): void => {
  for (const [key, paths] of walk.byPositionKey) {
    if (paths.length < 2) continue
    report(
      walk,
      'duplicate-position',
      ['tree'],
      undefined,
      `${paths.length} nodes reach the same position (${key}): ${paths.join(' , ')}. Point the later one at the first with \`transposesTo\` rather than duplicating the subtree, which would drift out of sync along with its annotations (ADR-0004, check 9).`,
    )
  }
}

const checkTranspositions = (walk: Walk): void => {
  for (const transposition of walk.transpositions) {
    const targetKey = transposition.to.join(' ')
    const fromKey = transposition.from.join(' ')
    const target = walk.byPath.get(targetKey)

    if (target === undefined) {
      report(
        walk,
        'transposition-unresolved',
        transposition.dataPath,
        transposition.from,
        `No node at \`${joinNodePath(transposition.to)}\`. A \`transposesTo\` path is canonical SAN from the entry root — the position after the defining line, not the initial position (docs/CONTEXT.md, Path).`,
      )
      continue
    }

    if (targetKey === fromKey || targetKey.startsWith(`${fromKey} `)) {
      report(
        walk,
        'transposition-cycle',
        transposition.dataPath,
        transposition.from,
        'A node cannot transpose into itself or into its own subtree.',
      )
      continue
    }

    if (target.key !== transposition.position.key) {
      report(
        walk,
        'transposition-mismatch',
        transposition.dataPath,
        transposition.from,
        `These are different positions, so this is not a transposition.\n    here:   ${transposition.position.key}\n    target: ${target.key}\n  Compared on the first four FEN fields only (docs/CONTEXT.md, invariant 12).`,
      )
    }
  }
}

const hasUnexplored = (node: ContentNode): boolean => {
  if (node.outcome !== undefined && !outcomeReachesTier(node.outcome).mapped) return true
  return node.children.some(hasUnexplored)
}

const isFullyTaught = (node: ContentNode, coverage: Coverage): boolean => {
  if (coverage.slots === 0) return false
  if (coverage.vi !== coverage.slots) return false
  if (coverage.en !== coverage.slots || coverage.fr !== coverage.slots) return false
  const taughtLeaves = (candidate: ContentNode): boolean => {
    if (candidate.outcome !== undefined && !outcomeReachesTier(candidate.outcome).taught)
      return false
    return candidate.children.every(taughtLeaves)
  }
  return taughtLeaves(node)
}

/** Derived from the content, never authored (docs/CONTEXT.md, invariant 8). */
const deriveTier = (tree: ContentNode, coverage: Coverage): Tier => {
  if (tree.children.length === 0) return 'listed'
  if (hasUnexplored(tree)) return 'listed'
  return isFullyTaught(tree, coverage) ? 'taught' : 'mapped'
}

const emptyCoverage: Coverage = { slots: 0, vi: 0, en: 0, fr: 0 }

const failed = (file: string, issues: readonly ContentIssue[]): EntryReport => ({
  file,
  issues,
  entry: undefined,
  coverage: emptyCoverage,
  nodeCount: 0,
  dismissedCount: 0,
  dismissRest: [],
  mateClaims: [],
})

const buildEntry = (
  source: YamlSource,
  authored: AuthoredEntry,
  certificates: CertificateSource,
): EntryReport => {
  const walk: Walk = {
    source,
    learnerSide: authored.side,
    entryId: authored.id,
    definingLine: [],
    directory: dirname(source.file),
    certificates,
    mateClaims: [],
    issues: [],
    byPath: new Map(),
    byPositionKey: new Map(),
    transpositions: [],
    coverage: { slots: 0, vi: 0, en: 0, fr: 0 },
    nodeCount: 0,
    dismissedCount: 0,
    dismissRest: [],
  }

  const opening = replay(authored.definingLine)
  if (!opening.ok) {
    report(
      walk,
      'illegal-move',
      ['definingLine', opening.index],
      undefined,
      `\`${authored.definingLine[opening.index] ?? ''}\` is not legal at ply ${opening.index + 1} of the defining line.${opening.suggestions.length === 0 ? '' : ` Did you mean ${opening.suggestions.join(' or ')}?`}`,
    )
    return failed(source.file, walk.issues)
  }

  opening.canonical.forEach((canonical, index) => {
    const authoredPly = authored.definingLine[index]
    if (authoredPly !== undefined && authoredPly !== canonical) {
      report(
        walk,
        'san-not-canonical',
        ['definingLine', index],
        undefined,
        `\`${authoredPly}\` is legal but is not the canonical SAN. Write \`${canonical}\`.`,
      )
    }
  })

  // Invariant 5's structural half. A defining line ending on the *opponent's* ply makes the
  // root a learner node, and then the opponent's losing move sits inside the defining line
  // where no node can carry a `replyQuality` — which makes the rest of invariant 5
  // unsatisfiable for exactly the traps this site exists to teach. Reported and stopped
  // rather than reported and continued: with the root the wrong kind, every `kind` below it
  // is inverted too, and a page of consequences buries the one cause.
  if (opening.position.turn === authored.side) {
    const lastIndex = opening.canonical.length - 1
    const lastPly = opening.canonical[lastIndex] ?? ''
    const opponent = authored.side === 'white' ? 'black' : 'white'
    report(
      walk,
      'defining-line-parity',
      ['definingLine', lastIndex],
      undefined,
      `The learner plays ${authored.side}, so the defining line must end with a ${authored.side} ply and leave ${opponent} to move at the root. It ends with \`${lastPly}\` after ${opening.canonical.length} plies, which is ${opponent}'s, so the root is a learner node. Move \`${lastPly}\` out of the defining line and model it as a reply (docs/CONTEXT.md, invariant 5).`,
    )
    return failed(source.file, walk.issues)
  }

  walk.definingLine = opening.canonical
  const tree = walkNode(
    walk,
    authored.tree,
    opening.position,
    ['tree'],
    [],
    undefined,
    undefined,
    false,
  )
  checkDuplicatePositions(walk)
  checkTranspositions(walk)

  const coverage: Coverage = { ...walk.coverage }
  const entry: Entry = {
    id: authored.id,
    name: authored.name,
    eco: authored.eco,
    category: authored.category,
    side: authored.side,
    definingLine: opening.canonical,
    soundness: {
      value: authored.soundness.value,
      reviewedAt: authored.soundness.reviewedAt,
      basis: {
        basis: 'judgement',
        by: authored.soundness.basis.by,
        at: authored.soundness.basis.at,
        source: authored.soundness.basis.source,
      },
    },
    judgement: {
      basis: 'judgement',
      by: authored.judgement.by,
      at: authored.judgement.at,
      source: authored.judgement.source,
    },
    tree,
    tier: deriveTier(tree, coverage),
  }

  return {
    file: source.file,
    issues: walk.issues,
    entry: walk.issues.length === 0 ? entry : undefined,
    coverage,
    nodeCount: walk.nodeCount,
    dismissedCount: walk.dismissedCount,
    dismissRest: walk.dismissRest,
    mateClaims: walk.mateClaims,
  }
}

export const validateText = (
  file: string,
  text: string,
  certificates: CertificateSource = readCertificateFile,
): EntryReport => {
  const loaded = loadYaml(file, text)
  if (!loaded.ok) return failed(file, loaded.issues)

  const derived = findDerivedFields(loaded.source)
  if (derived.length > 0) return failed(file, derived)

  const parsed = parseEntry(loaded.source)
  if (!parsed.ok) return failed(file, parsed.issues)

  return buildEntry(loaded.source, parsed.entry, certificates)
}
