import type { ContentIssue } from './issue.ts'
import { joinDataPath } from './issue.ts'
import type { YamlSource } from './yaml-source.ts'

/**
 * Refuse text that has been through the wrong encoding and come out the other side.
 *
 * `content/kings-gambit.yaml` shipped thirty-one of these to production: the French
 * annotations read `le mÃªme plan` where they should read `le même plan`, and the site served
 * that for as long as the file existed. Nothing noticed. `validate.ts` replays every move and
 * derives every position, so it has a great deal to say about the chess and nothing at all to
 * say about the prose; and the locale it happened in is the one nobody on this project reads,
 * which is exactly why it needs a machine to read it.
 *
 * ## What the damage looks like
 *
 * Text that is already UTF-8, read as if it were a single-byte encoding and written back out
 * as UTF-8, comes out with each of its bytes promoted to its own character. `é` is the two
 * bytes `C3 A9`; seen one byte at a time those are the characters `Ã` and `©`, and re-encoding
 * them gives `Ã©`. The original is recoverable exactly — put the characters back into bytes
 * and decode those bytes as UTF-8 — and this file both detects the damage and shows the repair
 * in the error, because a maintainer who cannot see what the text should say will not fix it.
 *
 * ## Why this is not a search for `Ã`
 *
 * Because that would only find the damage in the languages this project cares about least.
 * The Latin-1 letters used by French and English are two bytes and lead with `Ã`; Vietnamese
 * is mostly three, and `ế` degrades to `ế`, which leads with `ê` — a perfectly ordinary
 * French letter. A check written around the character it was first seen with would pass the
 * primary locale's version of the same bug.
 *
 * So the test is structural instead, and is the one a decoder would apply: a run of characters
 * that *looks* like a UTF-8 sequence read byte-wise — a lead character in U+00C2–U+00F4
 * followed by continuation characters in U+0080–U+00BF — and that really does decode as UTF-8
 * when its characters are put back into bytes. Both halves matter. The first alone would fire
 * on a letter that happens to precede a `«` or a `°`; requiring a clean decode as well makes
 * the odds of a false positive vanishingly small, and the check is run over every locale of
 * every entry in `validate.test.ts` to keep that claim honest rather than asserted.
 */

/** A lead character has to be one a UTF-8 sequence could start with: `C2`–`F4`. */
const LEAD = 'Â-ô'

/** A continuation character has to be one a UTF-8 sequence could continue with: `80`–`BF`. */
const CONTINUATION = '-¿'

const SUSPECT = new RegExp(`[${LEAD}][${CONTINUATION}]{1,3}`, 'gu')

const decoder = new TextDecoder('utf-8', { fatal: true })

/**
 * The text those characters were before, or `undefined` if they were never bytes.
 *
 * Longest-first: `ế` is three characters and its first two are a complete two-character
 * sequence of their own, so a shortest-match reading would repair half of it and leave the
 * rest as a character that no longer means anything.
 */
const repairOf = (suspect: string): string | undefined => {
  for (let length = suspect.length; length >= 2; length -= 1) {
    const run = suspect.slice(0, length)
    try {
      const decoded = decoder.decode(Buffer.from(run, 'latin1'))
      return `${decoded}${suspect.slice(length)}`
    } catch {
      continue
    }
  }
  return undefined
}

/** Every repairable run in one string, in the order they appear. */
const damageIn = (value: string): readonly { readonly found: string; readonly repair: string }[] =>
  [...value.matchAll(SUSPECT)].flatMap((match) => {
    const repair = repairOf(match[0])
    return repair === undefined ? [] : [{ found: match[0], repair }]
  })

const issueAt = (
  source: YamlSource,
  path: readonly (string | number)[],
  message: string,
): ContentIssue => ({
  file: source.file,
  code: 'text-double-encoded',
  dataPath: joinDataPath(path),
  nodePath: undefined,
  at: source.locate(path),
  message,
})

export const findEncodingDamage = (source: YamlSource): readonly ContentIssue[] => {
  const issues: ContentIssue[] = []
  const stack: { value: unknown; path: readonly (string | number)[] }[] = [
    { value: source.data, path: [] },
  ]

  while (stack.length > 0) {
    const frame = stack.pop()
    if (frame === undefined) break
    const { value, path } = frame

    if (typeof value === 'string') {
      const damage = damageIn(value)
      if (damage.length > 0) {
        const shown = damage
          .slice(0, 4)
          .map(({ found, repair }) => `\`${found}\` → \`${repair}\``)
          .join(', ')
        const rest = damage.length > 4 ? `, and ${damage.length - 4} more` : ''
        issues.push(
          issueAt(
            source,
            path,
            `This text has been through the wrong encoding: ${damage.length} run(s) of it are the UTF-8 bytes of some other text, one character per byte — ${shown}${rest}. Replace each run with the text on the right of the arrow. Whatever wrote this file read it as single-byte text first; read and write it as UTF-8.`,
          ),
        )
      }
      continue
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => stack.push({ value: item, path: [...path, index] }))
      continue
    }

    if (typeof value === 'object' && value !== null) {
      for (const [key, item] of Object.entries(value)) {
        stack.push({ value: item, path: [...path, key] })
      }
    }
  }

  return issues
}
