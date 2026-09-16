import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishedGambitIds, shellPaths } from '../src/lib/routes.ts'

/**
 * Post-build step for ADR-0009: emit a real `index.html` at every route path so GitHub
 * Pages answers a deep link with a genuine HTTP 200 instead of the `404.html` trick's
 * 404, and without a hash in the URL.
 *
 * This is file copying, not rendering — the route set is finite and known at build time.
 * Per-shell `lang`, `<title>` and link-preview metadata are #17; the shells are emitted
 * here and that ticket gives each one its own head.
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

const main = async (): Promise<void> => {
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

  const paths = shellPaths(publishedGambitIds)

  for (const path of paths) {
    await writeShell(indexHtml, join(distDir, path, 'index.html'))
  }

  // A genuinely unknown path gets this, and now the 404 status it is served with is true.
  await writeShell(indexHtml, join(distDir, '404.html'))

  // Ships from `public/`. Without it GitHub Pages runs Jekyll over the output and drops
  // Vite's underscore-prefixed chunk filenames.
  if (!(await exists(join(distDir, '.nojekyll')))) {
    throw new Error('dist/.nojekyll is missing. It should be copied from public/.nojekyll.')
  }

  process.stdout.write(`Emitted ${paths.length} route shells, 404.html, and verified .nojekyll\n`)
}

await main()
