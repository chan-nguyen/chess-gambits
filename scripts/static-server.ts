import { readFile, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

/**
 * A static file server for the end-to-end tests, standing in for GitHub Pages.
 *
 * The one thing it must not do is fall back to `index.html` for an unknown path. Vite's
 * own `preview` does, and that would make every deep-link assertion in this project
 * vacuous: `/chess-gambits/fr/about` would answer 200 whether or not a shell was ever
 * emitted there. Here a 200 means a file exists at that path, which is exactly the claim
 * ADR-0009 makes.
 *
 * The other thing it must do is **compress**, which was added by #19 and is not a
 * convenience. GitHub Pages serves text assets gzipped, and Lighthouse computes LCP from
 * the bytes that actually crossed the wire: against an uncompressed stand-in the bundle
 * is 425KB rather than 132KB, and the measured LCP was 4.2s for a site that ships 1.5s.
 * A budget measured against a host that behaves differently from the real one is not a
 * budget, it is a number. `content-encoding` is negotiated from `accept-encoding` like a
 * real host's, so a client that asks for identity still gets identity.
 *
 * It is deliberately dependency-free. A static file server is sixty lines, and this
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

/**
 * What GitHub Pages compresses: text, and nothing already compressed. An SVG is text and
 * this site's favicon is 9KB of it, so it belongs on the list.
 */
const compressible = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt'])

/**
 * Compressed bytes, remembered — which is not an optimisation for its own sake but the
 * other half of behaving like the host this stands in for.
 *
 * Compressing at all was #19's change, and without a cache it makes every request re-gzip
 * the file: tens of milliseconds of blocking work before the first byte of the 165KB
 * catalogue goes out, on a server that answers a few thousand requests per suite run. A
 * CDN compresses once, so that delay would be this server's invention and would land in
 * every latency number measured against it.
 *
 * Keyed by size and modification time, so a rebuilt file is never served from a stale
 * entry: `reuseExistingServer` means a developer's server outlives several builds.
 */
const compressed = new Map<string, Buffer>()

const gzipOnce = (file: string, raw: Buffer, stamp: string): Buffer => {
  const key = `${file}:${stamp}`
  const remembered = compressed.get(key)
  if (remembered !== undefined) return remembered

  const bytes = gzipSync(raw)
  compressed.set(key, bytes)
  return bytes
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

  const extension = extname(file)
  const contentType = mimeTypes[extension] ?? 'application/octet-stream'
  const [raw, stats] = await Promise.all([readFile(file), stat(file)])

  const wanted = req.headers['accept-encoding'] ?? ''
  const gzip = compressible.has(extension) && wanted.includes('gzip')
  const body = gzip ? gzipOnce(file, raw, `${stats.size}:${stats.mtimeMs}`) : raw

  res.writeHead(200, {
    'content-type': contentType,
    'content-length': String(body.byteLength),
    // Always, whether or not this response was compressed: the representation depends on
    // the request header, and a cache that did not know that would serve the wrong one.
    vary: 'accept-encoding',
    ...(gzip ? { 'content-encoding': 'gzip' } : {}),
  })
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
