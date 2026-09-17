import type { Locale } from './types.ts'

/**
 * A whole number, written out in words, in each of the three learner-facing locales.
 *
 * This exists for one reason: ADR-0011 makes a counted claim in a lesson a *derived* number,
 * and the sentence around it is prose a learner reads. "23 of the 42 legal replies" is a
 * different sentence from "Twenty-three of the forty-two legal replies", and the second one
 * is what the entries already say. A count that could only be rendered as a digit would have
 * forced every existing sentence to be rewritten, and a rewrite is a change to what a lesson
 * says — which is the thing the gate was supposed to make unnecessary.
 *
 * Build-time only. The spelled word is baked into the compiled entry, so nothing here ships.
 *
 * Bounded at 99 deliberately. The counts are legal-move counts in opening positions, which
 * run to the low forties; the theoretical maximum for any legal position is 218, but a
 * three-digit count in a gambit line would be a sign that the claim is wrong rather than an
 * occasion to spell "one hundred and forty-two" in three languages. `spellNumber` returns
 * `undefined` above 99 and the validator refuses the claim, which is the honest failure.
 */

const EN_ONES: readonly string[] = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]

const EN_TENS: readonly string[] = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
]

const spellEn = (value: number): string | undefined => {
  if (value < 20) return EN_ONES[value]
  const tens = EN_TENS[Math.floor(value / 10)]
  const unit = value % 10
  if (tens === undefined) return undefined
  return unit === 0 ? tens : `${tens}-${EN_ONES[unit] ?? ''}`
}

const FR_ONES: readonly string[] = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
]

const FR_TENS: readonly string[] = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

/**
 * French is the irregular one. 70–79 is "soixante" plus 10–19, 80–99 is "quatre-vingt" plus
 * 0–19, and 21/31/41/51/61/71 take "et". "quatre-vingts" carries its plural `s` only when it
 * stands alone. Traditional hyphenation is used rather than the 1990 rectified spelling,
 * because it is what the existing French annotations are written in.
 */
const spellFr = (value: number): string | undefined => {
  if (value < 20) return FR_ONES[value]
  if (value >= 80) {
    const rest = value - 80
    if (rest === 0) return 'quatre-vingts'
    return `quatre-vingt-${FR_ONES[rest] ?? ''}`
  }
  if (value >= 70) {
    const rest = value - 60
    if (rest === 11) return 'soixante et onze'
    return `soixante-${FR_ONES[rest] ?? ''}`
  }
  const tens = FR_TENS[Math.floor(value / 10)]
  const unit = value % 10
  if (tens === undefined || tens === '') return undefined
  if (unit === 0) return tens
  if (unit === 1) return `${tens} et un`
  return `${tens}-${FR_ONES[unit] ?? ''}`
}

const VI_ONES: readonly string[] = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
]

/**
 * Vietnamese is regular in structure and irregular in three units. After a tens word, 1
 * becomes `mốt`, 4 becomes `tư` and 5 becomes `lăm`; in the teens only the 5 changes, so 15
 * is `mười lăm` but 14 stays `mười bốn`. Getting those wrong is the difference between
 * Vietnamese and a foreigner's Vietnamese, and Vietnamese is this project's source locale.
 */
const viUnit = (unit: number, afterTens: boolean): string => {
  if (unit === 5) return 'lăm'
  if (!afterTens) return VI_ONES[unit] ?? ''
  if (unit === 1) return 'mốt'
  if (unit === 4) return 'tư'
  return VI_ONES[unit] ?? ''
}

const spellVi = (value: number): string | undefined => {
  if (value < 10) return VI_ONES[value]
  if (value < 20) {
    const unit = value - 10
    return unit === 0 ? 'mười' : `mười ${viUnit(unit, false)}`
  }
  const tens = VI_ONES[Math.floor(value / 10)]
  const unit = value % 10
  if (tens === undefined) return undefined
  return unit === 0 ? `${tens} mươi` : `${tens} mươi ${viUnit(unit, true)}`
}

/** The largest count that can be written in words. See the note at the top of this file. */
export const MAX_SPELLED = 99

/**
 * The number written out in `locale`, or `undefined` when it is not a whole number in
 * `0..99`. Returning `undefined` rather than falling back to digits is deliberate: a
 * sentence that silently switches from words to digits is a sentence nobody proof-read.
 */
export const spellNumber = (value: number, locale: Locale): string | undefined => {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SPELLED) return undefined
  switch (locale) {
    case 'vi':
      return spellVi(value)
    case 'en':
      return spellEn(value)
    case 'fr':
      return spellFr(value)
    default:
      return undefined
  }
}

/**
 * The same word with its first letter capitalised, for a count that opens a sentence.
 *
 * `toLocaleUpperCase` with the locale tag rather than `toUpperCase`, so the rule is the
 * locale's own. None of vi, en or fr has a casing special case here today; naming the locale
 * costs nothing and means the one place capitalisation happens is not quietly English.
 */
export const capitalise = (word: string, locale: Locale): string =>
  `${word.slice(0, 1).toLocaleUpperCase(locale)}${word.slice(1)}`
