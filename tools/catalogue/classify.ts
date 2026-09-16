import type { DatasetRow } from './dataset.ts'
import { proveOffer } from './sacrifice.ts'
import type { Classification, ClassificationRule, ExclusionCode } from './source.ts'
import type { CatalogueIssue, Side, SoundnessValue } from './types.ts'

/**
 * Deciding what counts as a gambit, and which family an entry belongs to.
 *
 * Two separate things happen here and they are deliberately not the same thing.
 *
 * **Grouping is mechanical.** A family is the dataset name's head — everything before the
 * first colon — which is what `docs/CONTEXT.md` means by "Blackmar-Diemer" or "Queen's
 * Gambit", and it needs no curation to be right.
 *
 * **Classification is curated.** A rule matches a prefix of the name at a segment
 * boundary and the longest match wins, so a blanket exclusion and a narrow exception can
 * sit beside each other and the exception wins. Nothing is included by default: a
 * gambit-named row with no rule covering it **fails the build** rather than quietly
 * joining or quietly missing the catalogue. That gate only fires when the vendored
 * dataset is refreshed, which is the moment a human should be looking at it anyway.
 *
 * Build-time only.
 */

/** A name segment: `Opening: Variation, Sub-variation` splits on both marks. */
const segmentsOf = (name: string): readonly string[] => {
  const [head, ...rest] = name.split(':')
  if (head === undefined) return []
  const tail = rest.join(':')
  return [head.trim(), ...tail.split(',').map((part) => part.trim())].filter(
    (part) => part.length > 0,
  )
}

/**
 * Whether the dataset itself calls this a gambit. This is where the word "Gambit" is
 * allowed to matter, and it decides only which rows need a decision — never what the
 * decision is.
 */
export const namesAGambit = (name: string): boolean =>
  segmentsOf(name).some((segment) => /gambit/i.test(segment))

export const familyOf = (name: string): string => {
  const colon = name.indexOf(':')
  return colon === -1 ? name : name.slice(0, colon).trim()
}

export const variationOf = (name: string): string => {
  const colon = name.indexOf(':')
  return colon === -1 ? '' : name.slice(colon + 1).trim()
}

const SEPARATORS: readonly string[] = [':', ',', ' ']

const matches = (rule: ClassificationRule, name: string): boolean => {
  if (name === rule.match) return true
  if (!name.startsWith(rule.match)) return false
  const next = name.charAt(rule.match.length)
  return SEPARATORS.includes(next)
}

/** The longest matching rule, so a narrow exception beats a blanket rule. */
export const ruleFor = (
  rules: readonly ClassificationRule[],
  name: string,
): ClassificationRule | undefined =>
  rules
    .filter((rule) => matches(rule, name))
    .reduce<ClassificationRule | undefined>(
      (best, rule) => (best === undefined || rule.match.length > best.match.length ? rule : best),
      undefined,
    )

/** A soundness label with the reviewer and date behind it, never bare. */
export type SoundnessJudgement = {
  readonly value: SoundnessValue
  readonly by: string
  readonly at: string
  readonly source?: string | undefined
}

export type ClassifiedRow = {
  readonly row: DatasetRow
  readonly family: string
  readonly variation: string
  /** Derived from the rule's `sacrifice` where it has one; asserted otherwise. */
  readonly side: Side
  readonly soundness: SoundnessValue
  readonly judgement: SoundnessJudgement
}

/** One reason a set of rows is out, and how many rows it accounts for. */
export type Exclusion = {
  readonly code: ExclusionCode
  readonly match: string
  readonly rows: number
}

export type Classified = {
  readonly included: readonly ClassifiedRow[]
  /** Rows the dataset names a gambit and a rule deliberately keeps out. */
  readonly excluded: number
  /** The same rows, grouped by the rule that excluded them (issue #36, criterion 5). */
  readonly exclusions: readonly Exclusion[]
}

/**
 * A bare `soundness: dubious` inherits the file header's reviewer and date. That is the
 * pre-#36 spelling and it stays readable, but it is still a judgement by somebody on some
 * date and it is resolved into one here rather than travelling as a naked enum.
 */
const judgementOf = (
  rule: Extract<ClassificationRule, { include: true }>,
  classification: Classification,
): SoundnessJudgement =>
  typeof rule.soundness === 'string'
    ? { value: rule.soundness, by: classification.reviewedBy, at: classification.reviewedAt }
    : rule.soundness

/**
 * The side, proved where the rule names a sacrifice.
 *
 * Every row a rule admits is replayed, not just one: a rule matches a name prefix and the
 * dataset puts many lines under one prefix, so "ply 7 is 2...d5" being true of the row
 * that was checked says nothing about the other twenty. A rule whose ply does not hold for
 * all of them is a rule that would give some of its entries the wrong orientation, and
 * that is the failure this whole design exists to prevent.
 */
const verifySacrifice = (
  rule: Extract<ClassificationRule, { include: true }>,
  rows: readonly DatasetRow[],
  file: string,
): { readonly side: Side | undefined; readonly issues: readonly CatalogueIssue[] } => {
  const declared = rule.sacrifice
  if (declared === undefined) return { side: rule.side, issues: [] }

  const issues: CatalogueIssue[] = []
  let side: Side | undefined
  for (const row of rows) {
    const proof = proveOffer(row.line, declared.ply, declared.move)
    if (!proof.ok) {
      issues.push({
        where: `${file} rule \`${rule.match}\``,
        message:
          `says ply ${declared.ply} of \`${row.name}\` is the sacrifice \`${declared.move}\`, ` +
          `but ${proof.why}. The line is \`${row.line.join(' ')}\`. Name the ply that really ` +
          'gives material away, or exclude the row: a side nobody could prove is a board the ' +
          'learner sees from the wrong end.',
      })
      continue
    }
    // Every row that proves out proves the same side — whose turn it is at ply N is fixed
    // by N — so this is one value and not a vote.
    side = proof.side
  }

  return { side, issues }
}

/** Enough names to act on; the full list would bury the reason in a wall of text. */
const SAMPLE = 12

const listSample = (names: readonly string[]): string => {
  const shown = names.slice(0, SAMPLE).map((name) => `\n    ${name}`)
  const rest = names.length > SAMPLE ? `\n    … and ${names.length - SAMPLE} more` : ''
  return `${shown.join('')}${rest}`
}

export const classify = (
  rows: readonly DatasetRow[],
  classification: Classification,
  file: string,
): { readonly classified: Classified; readonly issues: readonly CatalogueIssue[] } => {
  const included: ClassifiedRow[] = []
  const undecided: string[] = []
  const wonRows = new Map<string, number>()
  const excludedRows = new Map<string, number>()
  const contributed = new Map<string, number>()
  const issues: CatalogueIssue[] = []
  const exclusions: Exclusion[] = []
  /** Grouped first, because a sacrifice is verified against every row its rule admits. */
  const admitted = new Map<string, DatasetRow[]>()
  let excluded = 0

  for (const row of rows) {
    const rule = ruleFor(classification.rules, row.name)
    const named = namesAGambit(row.name)

    if (rule === undefined) {
      if (named) undecided.push(row.name)
      continue
    }

    wonRows.set(rule.match, (wonRows.get(rule.match) ?? 0) + 1)

    if (!rule.include) {
      if (named) {
        excluded += 1
        excludedRows.set(rule.match, (excludedRows.get(rule.match) ?? 0) + 1)
      }
      continue
    }

    // A broad include rule admits the gambits inside an opening and nothing else, unless
    // it says outright that the dataset does not use the word here.
    if (!named && rule.unnamed !== true) continue

    contributed.set(rule.match, (contributed.get(rule.match) ?? 0) + 1)
    admitted.set(rule.match, [...(admitted.get(rule.match) ?? []), row])
  }

  for (const rule of classification.rules) {
    if (!rule.include) {
      const rowsExcluded = excludedRows.get(rule.match) ?? 0
      if (rowsExcluded > 0) {
        exclusions.push({ code: rule.code, match: rule.match, rows: rowsExcluded })
      }
      continue
    }
    const rowsAdmitted = admitted.get(rule.match) ?? []
    if (rowsAdmitted.length === 0) continue

    const verified = verifySacrifice(rule, rowsAdmitted, file)
    issues.push(...verified.issues)
    const side = verified.side
    if (side === undefined) continue

    const judgement = judgementOf(rule, classification)
    for (const row of rowsAdmitted) {
      included.push({
        row,
        family: familyOf(row.name),
        variation: variationOf(row.name),
        side,
        soundness: judgement.value,
        judgement,
      })
    }
  }

  if (undecided.length > 0) {
    issues.push({
      where: file,
      message:
        `${undecided.length} row(s) the dataset names a gambit have no rule covering them, so ` +
        'nobody has decided whether they belong in the catalogue. Add an include or an exclude ' +
        'rule for each. Silence is not a decision, and defaulting either way would make ' +
        'classification a substring match on the word "Gambit" again (ADR-0008).' +
        listSample(undecided),
    })
  }

  const deadExclusions = classification.rules
    .filter((rule) => !rule.include && (wonRows.get(rule.match) ?? 0) === 0)
    .map((rule) => rule.match)
  if (deadExclusions.length > 0) {
    issues.push({
      where: file,
      message:
        `${deadExclusions.length} exclude rule(s) match no row in the dataset. Either the name ` +
        'is misspelt or upstream renamed it — and an exclusion that matches nothing silently ' +
        'stops excluding anything.' +
        listSample(deadExclusions),
    })
  }

  const deadInclusions = classification.rules
    .filter((rule) => rule.include && (contributed.get(rule.match) ?? 0) === 0)
    .map((rule) => rule.match)
  if (deadInclusions.length > 0) {
    issues.push({
      where: file,
      message:
        `${deadInclusions.length} include rule(s) contribute no entry. A family that silently ` +
        'empties is how a catalogue loses the Evans Gambit and still passes every other check.' +
        listSample(deadInclusions),
    })
  }

  // Back into dataset order. Rows were grouped by rule to verify a sacrifice against all
  // of them at once, and the order entries reach `catalogue:freeze` in decides which of
  // two names that slug alike is minted first — so it may not depend on rule order.
  const ordered = [...included].sort((a, b) =>
    a.row.name < b.row.name ? -1 : a.row.name > b.row.name ? 1 : 0,
  )

  return { classified: { included: ordered, excluded, exclusions }, issues }
}
