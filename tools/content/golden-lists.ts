/**
 * The golden lists: the three files that name every authored entry by hand, so that a content
 * change which adds, removes or renames one has to say so in a diff.
 *
 * - `tools/content/content-cli.test.ts` — the `Known ids:` string the export CLI prints, and the
 *   list of `<id>.json` files the compile step writes.
 * - `tools/catalogue/branches.test.ts` — the `AUTHORED` map (every authored id with the number of
 *   root-to-leaf lines its tree has), the counts written out in words in its comments and its
 *   test title, the number of entries in the whole catalogue, and the number still at Tier 0.
 * - `e2e/taught-entries.spec.ts` — the count in words and the sorted list of every taught id.
 *
 * Every number in those files is a fact about `content/` and the catalogue built from it. Typing
 * them by hand is how a count drifts from its list, and a content round touches four lists at
 * once, so they are derived here and written back. Nothing is loosened: the lists stay as
 * explicit as before, and the tests that read them are untouched.
 *
 * What cannot be derived is the sentence per round in the `branches.test.ts` comment that says
 * which entries landed and why. That stays a human's job, and this module leaves it alone.
 *
 * Pure: text in, text out. `golden-lists-cli.ts` does the reading and writing.
 */

export type GoldenInputs = {
  /** The id of every entry that has a content file, taught or not. */
  readonly contentIds: readonly string[]
  /** The id of every catalogue entry at the taught tier. */
  readonly taughtIds: readonly string[]
  /** Root-to-leaf lines per entry, from the catalogue's baked branch keys. */
  readonly branchCounts: ReadonlyMap<string, number>
  /** Every entry in the catalogue, taught or not. */
  readonly totalEntries: number
}

export type Regenerated =
  { readonly ok: true; readonly text: string } | { readonly ok: false; readonly message: string }

const ONES: readonly string[] = [
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

const TENS: readonly string[] = [
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

const MAX_WORDS = 9999

/**
 * A count written the way the test titles and comments write it: "five hundred and sixty-one".
 * Bounded at 9,999 because the catalogue is a thousand entries; above that the digits are
 * returned, which is visibly different from every sentence it would replace.
 */
export const numberWords = (value: number): string => {
  if (!Number.isInteger(value) || value < 0 || value > MAX_WORDS) return String(value)
  if (value < ONES.length) return ONES[value] ?? String(value)
  if (value < 100) {
    const unit = value % 10
    const tens = TENS[Math.floor(value / 10)] ?? ''
    return unit === 0 ? tens : `${tens}-${ONES[unit] ?? ''}`
  }
  const [divisor, name] = value < 1000 ? [100, 'hundred'] : [1000, 'thousand']
  const rest = value % divisor
  const head = `${numberWords(Math.floor(value / divisor))} ${name}`
  return rest === 0 ? head : `${head} and ${numberWords(rest)}`
}

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Plain code-unit order, which is what `Array.prototype.sort` does and what the tests compare
 * against. It matters for one pair: `-` (0x2d) sorts before `.` (0x2e), so
 * `benko-gambit-accepted.json` comes before `benko-gambit.json` while the bare ids come the
 * other way round. Sorting the ids and then appending `.json` gets that wrong.
 */
const codeUnitOrder = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

export const sortedIds = (ids: readonly string[]): readonly string[] => [...ids].sort(codeUnitOrder)

const quoted = (id: string, indent: number): string => `${' '.repeat(indent)}'${id}',`

const replaceOnce = (
  text: string,
  pattern: RegExp,
  replacement: string | ((match: string, head: string, tail: string) => string),
  label: string,
): Regenerated => {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const found = text.match(new RegExp(pattern.source, flags))?.length ?? 0
  if (found !== 1) {
    return {
      ok: false,
      message:
        `${label}: expected exactly one match and found ${found}. The fixture's shape has ` +
        'changed, so update golden-lists.ts to match it rather than hand-editing the list.',
    }
  }
  const replacer = typeof replacement === 'string' ? () => replacement : replacement
  return { ok: true, text: text.replace(pattern, replacer) }
}

const chain = (text: string, steps: readonly ((current: string) => Regenerated)[]): Regenerated => {
  let current = text
  for (const step of steps) {
    const next = step(current)
    if (!next.ok) return next
    current = next.text
  }
  return { ok: true, text: current }
}

const KNOWN_IDS = /'Known ids: [^']*'/
const COMPILED_FILES =
  /(expect\(\[\.\.\.readdirSync\(out\)\]\.sort\(\)\)\.toStrictEqual\(\[\n)[\s\S]*?(\n {4}\]\))/

export const regenerateContentCli = (text: string, inputs: GoldenInputs): Regenerated => {
  const known = sortedIds(inputs.contentIds)
  const files = [...known.map((id) => `${id}.json`)].sort(codeUnitOrder)
  return chain(text, [
    (current) =>
      replaceOnce(current, KNOWN_IDS, `'Known ids: ${known.join(', ')}.'`, 'content-cli known ids'),
    (current) =>
      replaceOnce(
        current,
        COMPILED_FILES,
        (_match, head, tail) => head + files.map((file) => quoted(file, 6)).join('\n') + tail,
        'content-cli compiled file list',
      ),
  ])
}

export const regenerateBranches = (text: string, inputs: GoldenInputs): Regenerated => {
  const authored = sortedIds(inputs.contentIds)
  const count = authored.length
  const entries = authored.map((id) => `    ['${id}', ${inputs.branchCounts.get(id) ?? 0}],`)
  return chain(text, [
    (current) =>
      replaceOnce(
        current,
        /\* [A-Z][a-z -]+ entries are authored/,
        `* ${capitalised(numberWords(count))} entries are authored`,
        'branches authored sentence',
      ),
    (current) =>
      replaceOnce(
        current,
        /and the\n {3}\* other \d+\n {3}\* are Tier 0/,
        `and the\n   * other ${inputs.totalEntries - count}\n   * are Tier 0`,
        'branches Tier 0 count',
      ),
    (current) =>
      replaceOnce(
        current,
        /only the authored [a-z -]+ have any/,
        `only the authored ${numberWords(count)} have any`,
        'branches test title',
      ),
    (current) =>
      replaceOnce(
        current,
        /bakes keys on all \d+ entries/,
        `bakes keys on all ${inputs.totalEntries} entries`,
        'branches entry total in the test title',
      ),
    (current) =>
      replaceOnce(
        current,
        /(expect\(result\.value\.records\)\.toHaveLength\()\d+(\))/,
        (_match, head, tail) => `${head}${inputs.totalEntries}${tail}`,
        'branches entry total assertion',
      ),
    (current) =>
      replaceOnce(
        current,
        /(new Map\(\[\n)[\s\S]*?(\n {2}\]\))/,
        (_match, head, tail) => head + entries.join('\n') + tail,
        'branches AUTHORED map',
      ),
  ])
}

const TAUGHT_TITLE =
  /test\('there are [a-z -]+ of them, and they are the ones the content tickets authored'/
const TAUGHT_LIST =
  /(expect\(taught\.map\(\(entry\) => entry\.id\)\.sort\(\)\)\.toEqual\(\[\n)[\s\S]*?(\n {4}\]\))/

export const regenerateTaughtEntries = (text: string, inputs: GoldenInputs): Regenerated => {
  const taught = sortedIds(inputs.taughtIds)
  return chain(text, [
    (current) =>
      replaceOnce(
        current,
        TAUGHT_TITLE,
        `test('there are ${numberWords(taught.length)} of them, and they are the ones the content tickets authored'`,
        'taught-entries title',
      ),
    (current) =>
      replaceOnce(
        current,
        TAUGHT_LIST,
        (_match, head, tail) => head + taught.map((id) => quoted(id, 6)).join('\n') + tail,
        'taught-entries list',
      ),
  ])
}

/** The ids the taught-entries list holds now, before it is regenerated. */
export const listedTaughtIds = (specText: string): readonly string[] => {
  const block = specText.match(TAUGHT_LIST)
  if (block === null) return []
  return [...block[0].matchAll(/^\s+'([^']+)',$/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  )
}

export type Needle = { readonly id: string; readonly name: string }

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** An id as it appears in a path, a selector or a quoted string, and not as a prefix of another. */
const idPattern = (id: string): RegExp => new RegExp(`['"\`/]${escaped(id)}(?![\\w-])`)

/**
 * Every place, outside the golden lists, that names an entry by its id or its full name.
 *
 * A spec that needs "an entry that is still listed" names a real one, and the round that teaches
 * it breaks that spec with nothing in the diff to say why. Running this over the entries a round
 * has just taught says which specs to look at before CI does.
 */
export const mentionsOf = (
  texts: ReadonlyMap<string, string>,
  needles: readonly Needle[],
): readonly string[] =>
  [...texts].flatMap(([file, text]) =>
    needles
      .filter(
        (needle) =>
          idPattern(needle.id).test(text) ||
          ["'", '"', '`'].some((quote) => text.includes(`${quote}${needle.name}${quote}`)),
      )
      .map((needle) => `${file} names ${needle.id}`),
  )
