import { readFile, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A static file server for the end-to-end tests, standing in for GitHub Pages.
 *
 * The one thing it must not do is fall back to `index.html` for an unknown path. Vite's
 * own `preview` does, and that would make every deep-link assertion in this project
 * vacuous: `/chess-gambits/fr/about` would answer 200 whether or not a shell was ever
 * emitted there. Here a 200 means a file exists at that path, which is exactly the claim
 * ADR-0009 makes.
 *
 * It is deliberately dependency-free. A static file server is fifty lines, and this
 * project's dependency count is a design goal rather than an accident
 * (docs/security.md, B2).
 */

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const basePath = process.env.BASE_PATH ?? '/chess-gambits/'
const port = Number(process.env.PORT ?? '4173')

/** `/chess-gambits/` -> `/chess-gambits`, `/` -> `''`. */
const basePrefix = basePath.replace(/\/$/, '')

const mimeTypes: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const isFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** The file a request path maps to, or null if nothing is there. No fallback. */
const resolveFile = async (pathname: string): Promise<string | null> => {
  if (pathname !== basePrefix && !pathname.startsWith(`${basePrefix}/`)) return null

  const relative = pathname.slice(basePrefix.length).replace(/^\//, '')
  const candidate = resolve(distDir, relative)

  // A percent-encoded `..` must not escape the output directory.
  if (candidate !== distDir && !candidate.startsWith(`${distDir}${sep}`)) return null

  if (await isFile(candidate)) return candidate

  // GitHub Pages serves `<path>/index.html` for a directory. It answers the extensionless
  // form with a 301 to the trailing slash first; serving it directly keeps the status
  // assertions in the tests about the shell existing rather than about redirects.
  const indexFile = join(candidate, 'index.html')
  return (await isFile(indexFile)) ? indexFile : null
}

const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end()
    return
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Bad request')
    return
  }

  const file = await resolveFile(pathname)

  if (file === null) {
    const notFoundPage = join(distDir, '404.html')
    const body = (await isFile(notFoundPage)) ? await readFile(notFoundPage) : Buffer.from('404')
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
    res.end(req.method === 'HEAD' ? undefined : body)
    return
  }

  const contentType = mimeTypes[extname(file)] ?? 'application/octet-stream'
  const body = await readFile(file)
  res.writeHead(200, { 'content-type': contentType })
  res.end(req.method === 'HEAD' ? undefined : body)
}

const server = createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Internal error')
  })
})

server.listen(port, () => {
  process.stdout.write(`Serving ${distDir} at http://localhost:${port}${basePath}\n`)
})
