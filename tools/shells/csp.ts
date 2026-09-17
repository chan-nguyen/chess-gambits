import { createHash } from 'node:crypto'

/**
 * The Content Security Policy every published document carries (#19, AC 6).
 *
 * **Why it rides in the document.** GitHub Pages serves a fixed set of response headers
 * that this project cannot configure (ADR-0007), so the policy is delivered as
 * `<meta http-equiv>`. `docs/security.md` records what that costs: a meta policy cannot
 * express `frame-ancestors`, and the clickjacking risk is accepted there on the grounds
 * that the site has no authenticated state, no destructive action and no form. That
 * acceptance is void the day any of the three stops being true.
 *
 * **Why the hash.** `index.html` carries exactly one inline script — the pre-paint theme
 * read documented at `docs/security.md` B5, which cannot be a module because it has to
 * run before any module does. `'unsafe-inline'` would buy that one script at the price of
 * every other inline script an attacker could ever inject, so the policy names it by the
 * SHA-256 of its own bytes instead. The hash is computed from the **emitted** document at
 * build time, never written down: a literal would keep passing on the day the script
 * changed, and the browser would then refuse to run it in production only.
 *
 * **What makes it a gate rather than a decoration.** A second inline script would need a
 * second hash, and `inlineScriptHashes` returning two is what `scripts/generate-shells.ts`
 * refuses to build. Adding one is therefore a conversation, not a quiet widening — which
 * is the property this ticket exists to buy.
 */

/**
 * An inline `<script>`: an opening tag with no `src` attribute, and its body.
 *
 * `(?![^>]*\ssrc=)` is what separates the theme read from Vite's own module tag. The
 * lookahead is bounded to the opening tag by `[^>]*`, so a later element's `src` cannot
 * reach back and exempt this one.
 */
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g

/**
 * One `'sha256-…'` source expression per inline script in the document, in order.
 *
 * Hashed over the element's text content exactly as it appears — CSP hashes the bytes
 * between the tags, so a single space of reindentation is a different script as far as
 * the browser is concerned. That is why this reads the built file rather than the source
 * one: Vite is what decides the final bytes.
 */
export const inlineScriptHashes = (html: string): readonly string[] =>
  [...html.matchAll(INLINE_SCRIPT)].map(
    (match) =>
      `'sha256-${createHash('sha256')
        .update(match[1] ?? '', 'utf8')
        .digest('base64')}'`,
  )

/**
 * The policy itself.
 *
 * `default-src 'none'` first, so every fetch destination this list does not name is
 * refused rather than allowed. What follows is the complete set of things the site
 * actually does, and nothing else:
 *
 * - `script-src 'self'` plus the hashes — the bundle and the theme read.
 * - `style-src 'self'` — the one stylesheet Vite emits. **No `'unsafe-inline'`**: the
 *   application sets no `style` attribute and injects no `<style>` element, which is a
 *   property of owning the board renderer (ADR-0003) rather than an accident, and
 *   `e2e/content-security-policy.spec.ts` is what keeps it true.
 * - `img-src 'self'` — the SVG favicon. The pieces are inline SVG, not images.
 * - `connect-src 'self'` — the catalogue and gambit JSON, which are files on this origin.
 * - `font-src 'none'` — `docs/design-system.md` §6 budgets **zero** downloaded fonts, and
 *   `src/styles/tokens.css` uses system stacks. Redundant under `default-src 'none'` and
 *   written out anyway, because a budget the policy states is a budget the browser
 *   enforces on every visitor rather than only on CI.
 * - `base-uri 'none'` and `form-action 'none'` — neither is covered by `default-src`, and
 *   the site has no `<base>` and no form.
 *
 * `frame-ancestors` is deliberately absent: a `<meta>` policy cannot express it and
 * browsers ignore it there, so listing it would read as protection that is not present.
 */
export const contentSecurityPolicy = (scriptHashes: readonly string[]): string =>
  [
    "default-src 'none'",
    ["script-src 'self'", ...scriptHashes].join(' '),
    "style-src 'self'",
    "img-src 'self'",
    "connect-src 'self'",
    "font-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')

/**
 * How many inline scripts the policy is allowed to name, and why it is one.
 *
 * Every hash in the policy is a hole in it, however small. One is the documented
 * exemption; a second means somebody added an inline script, and a build that silently
 * hashed it would have widened the policy without anyone deciding to.
 */
export const ALLOWED_INLINE_SCRIPTS = 1
