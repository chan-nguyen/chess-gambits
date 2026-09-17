import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ALLOWED_INLINE_SCRIPTS, contentSecurityPolicy, inlineScriptHashes } from './csp.ts'

/**
 * The policy, and the two ways it could be wrong while looking right.
 *
 * A hash computed over the wrong bytes produces a policy that passes every assertion about
 * its shape and refuses the one script the site needs — in production only, because nothing
 * before deployment runs the document the hash was taken from. And a lookahead that missed
 * an inline script would let the build hash a second one silently, which is the widening
 * `docs/security.md` says may not happen without a decision.
 */

const sha256 = (source: string): string =>
  `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`

describe('finding the inline scripts in a built document', () => {
  it('hashes the script body exactly, byte for byte', () => {
    const body = '\n      try { theme() } catch {}\n    '

    expect(inlineScriptHashes(`<head><script>${body}</script></head>`)).toStrictEqual([
      sha256(body),
    ])
  })

  /**
   * The difference a single space makes, which is the whole reason the hash is computed
   * from the emitted file rather than from `index.html` in the repository.
   */
  it('gives reindented bytes a different hash', () => {
    const [tight] = inlineScriptHashes('<script>theme()</script>')
    const [loose] = inlineScriptHashes('<script> theme() </script>')

    expect(tight).not.toBe(loose)
  })

  it('ignores a script with a src, which needs no hash', () => {
    const html = '<script type="module" crossorigin src="/assets/index.js"></script>'

    expect(inlineScriptHashes(html)).toStrictEqual([])
  })

  /**
   * The lookahead is bounded to the opening tag. Without the bound, a later element's `src`
   * would exempt an earlier inline script from being hashed at all — and the build's
   * "exactly one" check would then pass on a document with two.
   */
  it('still finds an inline script that is followed by one with a src', () => {
    const html = '<script>theme()</script><script src="/assets/index.js"></script>'

    expect(inlineScriptHashes(html)).toStrictEqual([sha256('theme()')])
  })

  it('finds both when a document has two, which is what stops the build', () => {
    const html = '<script>a()</script><script>b()</script>'

    expect(inlineScriptHashes(html)).toHaveLength(2)
    expect(inlineScriptHashes(html).length).toBeGreaterThan(ALLOWED_INLINE_SCRIPTS)
  })
})

describe('the policy', () => {
  const policy = contentSecurityPolicy([sha256('theme()')])
  const directives = new Map(
    policy.split('; ').map((part) => {
      const [name, ...sources] = part.split(' ')
      return [name ?? '', sources]
    }),
  )

  it('denies everything it does not name', () => {
    expect(policy.startsWith("default-src 'none'; ")).toBe(true)
  })

  it('allows the bundle and the hashed script, and nothing else, as script', () => {
    expect(directives.get('script-src')).toStrictEqual(["'self'", sha256('theme()')])
  })

  it.each([
    ['style-src', "'self'"],
    ['img-src', "'self'"],
    ['connect-src', "'self'"],
    ['font-src', "'none'"],
    ['base-uri', "'none'"],
    ['form-action', "'none'"],
  ])('sets %s to %s', (name, expected) => {
    expect(directives.get(name)).toStrictEqual([expected])
  })

  /**
   * The assertion the rest of this file exists to support. Each of these is a way to make
   * a page work by widening the policy rather than by fixing the page.
   */
  it.each(["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", 'data:', '*', 'http'])(
    'never contains %s',
    (token) => {
      expect(policy).not.toContain(token)
    },
  )

  /**
   * A `<meta>` policy cannot express `frame-ancestors` and browsers ignore it there, so
   * emitting it would read as protection the site does not have. `docs/security.md` records
   * the acceptance instead.
   */
  it('does not pretend to carry frame-ancestors', () => {
    expect(policy).not.toContain('frame-ancestors')
  })
})
