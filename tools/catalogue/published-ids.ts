/**
 * Which gambit ids the built catalogue published, read back off the built file.
 *
 * Every one of those ids is a URL the catalogue page links to, and GitHub Pages answers a
 * URL with a file or with a 404 (ADR-0009). So the shell generator has to emit an
 * `index.html` at each of them, and the list it works from must be *the same list the
 * browser will download* — not a constant kept in step by hand, and not a second
 * derivation from the dataset that could drift from the first.
 *
 * Reading `dist/catalogue/catalogue.<locale>.json` is what makes that true: the ids come
 * from the bytes that shipped. The entry ids are locale-independent (the payloads differ
 * only in names), so one locale's file answers for all three.
 *
 * Pure, and free of the filesystem, so it can be tested on the shapes a file can actually
 * have — including the ones it should refuse.
 */

export type PublishedIds =
  | { readonly ok: true; readonly ids: readonly string[] }
  | { readonly ok: false; readonly reason: string }

/**
 * The slug shape `src/lib/content.ts` enforces before an id is put in a request path,
 * applied here before an id is put in a *file* path.
 *
 * This is a deliberate second copy of that regular expression rather than an import: that
 * module reaches for `import.meta.env` through `base-path.ts` and cannot be loaded by a
 * Node build script. Two copies of four characters is the smaller problem, and this one
 * guards a different thing — `join(dist, id, 'index.html')` with a `..` in it writes
 * outside the output directory.
 */
const GAMBIT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_ID_LENGTH = 64

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const publishedGambitIds = (json: string): PublishedIds => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'is not JSON' }
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.families)) {
    return { ok: false, reason: 'has no `families` array' }
  }

  const ids: string[] = []
  for (const family of parsed.families) {
    if (!isRecord(family) || !Array.isArray(family.entries)) {
      return { ok: false, reason: 'has a family with no `entries` array' }
    }
    for (const entry of family.entries) {
      if (!isRecord(entry) || typeof entry.id !== 'string') {
        return { ok: false, reason: 'has an entry with no string `id`' }
      }
      const id = entry.id
      if (id.length > MAX_ID_LENGTH || !GAMBIT_ID.test(id)) {
        return { ok: false, reason: `has an entry id that is not a slug: \`${id}\`` }
      }
      ids.push(id)
    }
  }

  /**
   * One shell per id, not one per row. A duplicate would only ever write the same file
   * twice, but it would also make the reported shell count a number nobody can check
   * against the catalogue's own count of entries.
   */
  const unique = [...new Set(ids)]
  if (unique.length !== ids.length) {
    return { ok: false, reason: `lists ${ids.length} entries under ${unique.length} distinct ids` }
  }

  return { ok: true, ids: unique }
}
