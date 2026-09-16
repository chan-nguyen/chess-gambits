import type { DatasetRow } from './dataset.ts'
import type { Classification, ClassificationRule } from './source.ts'
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

export type ClassifiedRow = {
  readonly row: DatasetRow
  readonly family: string
  readonly variation: string
  readonly side: Side
  readonly soundness: SoundnessValue
}

export type Classified = {
  readonly included: readonly ClassifiedRow[]
  /** Rows the dataset names a gambit and a rule deliberately keeps out. */
  readonly excluded: number
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
  const contributed = new Map<string, number>()
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
      if (named) excluded += 1
      continue
    }

    // A broad include rule admits the gambits inside an opening and nothing else, unless
    // it says outright that the dataset does not use the word here.
    if (!named && rule.unnamed !== true) continue

    contributed.set(rule.match, (contributed.get(rule.match) ?? 0) + 1)
    included.push({
      row,
      family: familyOf(row.name),
      variation: variationOf(row.name),
      side: rule.side,
      soundness: rule.soundness,
    })
  }

  const issues: CatalogueIssue[] = []

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

  return { classified: { included, excluded }, issues }
}
