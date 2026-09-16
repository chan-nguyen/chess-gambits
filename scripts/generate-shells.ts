import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultLocale } from '../src/lib/locale.ts'
import { shellPaths } from '../src/lib/routes.ts'
import { publishedGambitIds } from '../tools/catalogue/published-ids.ts'

/**
 * Post-build step for ADR-0009: emit a real `index.html` at every route path so GitHub
 * Pages answers a deep link with a genuine HTTP 200 instead of the `404.html` trick's
 * 404, and without a hash in the URL.
 *
 * This is file copying, not rendering — the route set is finite and known at build time.
 * Per-shell `lang`, `<title>` and link-preview metadata are #17; the shells are emitted
 * here and that ticket gives each one its own head.
 *
 * **The gambit ids come from the built catalogue.** Until #13 nothing linked to a gambit,
 * so no shell for one had to exist and none was emitted. The catalogue page links to
 * every published entry, and on a static host a link to a path with no file behind it is
 * an HTTP 404 — so the moment that page shipped, 700 links would have become 700 broken
 * ones. Reading the ids back off `dist/catalogue/` rather than from a committed list is
 * what makes the shells and the links the same set by construction.
 */

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const writeShell = async (source: string, target: string): Promise<void> => {
  await mkdir(dirname(target), { recursive: true })
  await copyFile(source, target)
}

/**
 * Entry ids are locale-independent — the three payloads differ only in names — so one
 * file answers for all three locales. It is read from `dist/` rather than from `public/`
 * because `dist/` is what was published: a stale `public/catalogue/` that Vite had not
 * copied would otherwise produce shells for a catalogue nobody downloads.
 */
const gambitIds = async (): Promise<readonly string[]> => {
  const path = join(distDir, 'catalogue', `catalogue.${defaultLocale}.json`)

  if (!(await exists(path))) {
    throw new Error(
      `No ${path}. Run \`npm run catalogue\` and \`vite build\` before this script — ` +
        'without it every gambit link on the catalogue page would 404 on the host.',
    )
  }

  const result = publishedGambitIds(await readFile(path, 'utf8'))
  if (!result.ok) throw new Error(`${path} ${result.reason}.`)

  if (result.ids.length === 0) {
    throw new Error(
      `${path} published no entries. The catalogue page links to whatever is in that file, ` +
        'so an empty one means either the catalogue build failed silently or this script is ' +
        'reading the wrong file.',
    )
  }

  return result.ids
}

const main = async (): Promise<void> => {
  const startedAt = performance.now()
  const indexHtml = join(distDir, 'index.html')

  if (!(await exists(indexHtml))) {
    throw new Error(`No ${indexHtml} to copy. Run \`vite build\` before this script.`)
  }

  // Asset URLs in the built index.html are absolute and already carry the base path, so
  // the same bytes work at any depth. Assert it rather than trust it: a relative asset
  // URL would load on `/vi/about` and 404 on `/vi/gambits/evans-gambit`.
  const html = await readFile(indexHtml, 'utf8')
  const relativeAsset = /(?:src|href)="(?!https?:|\/|data:|#)/.exec(html)
  if (relativeAsset !== null) {
    throw new Error(
      `dist/index.html contains a relative asset URL (${relativeAsset[0]}), which would ` +
        `break in a shell at a deeper path. Check the Vite \`base\` setting.`,
    )
  }

  const ids = await gambitIds()
  const paths = shellPaths(ids)

  /**
   * Written concurrently rather than one at a time. At 700 entries this is 2,100 gambit
   * shells, and serially that is seconds of wall clock on every build, nearly all of it
   * spent waiting on the filesystem rather than doing anything.
   */
  await Promise.all(paths.map((path) => writeShell(indexHtml, join(distDir, path, 'index.html'))))

  // A genuinely unknown path gets this, and now the 404 status it is served with is true.
  await writeShell(indexHtml, join(distDir, '404.html'))

  // Ships from `public/`. Without it GitHub Pages runs Jekyll over the output and drops
  // Vite's underscore-prefixed chunk filenames.
  if (!(await exists(join(distDir, '.nojekyll')))) {
    throw new Error('dist/.nojekyll is missing. It should be copied from public/.nojekyll.')
  }

  const bytes = Buffer.byteLength(html, 'utf8') * (paths.length + 1)
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(2)

  process.stdout.write(
    `Emitted ${paths.length} route shells for ${ids.length} published gambits, 404.html, and ` +
      `verified .nojekyll — ${(bytes / 1024 / 1024).toFixed(2)}MB of HTML in ${seconds}s\n`,
  )
}

await main()
