# Security baseline and threat model

Last updated: 2026-09-16
ASVS level: **L1**. There is no authentication, no personal data and no money. L1 is the honest
level; claiming L2 for a site with no user data would be theatre.

---

## What this project is, from a security point of view

A static bundle of public content, built by CI from a public repository, served by a CDN, running
entirely in the visitor's browser, storing nothing but a per-browser progress marker.

This removes most of the usual attack surface by construction: **no server to compromise, no
database to inject into, no session to steal, no secret in production, no personal data to leak, no
account to take over.** That is ADR-0001's real payoff, and this document exists mostly to protect
that property rather than to defend a perimeter.

What is left is genuine and is mostly about **the supply chain and the integrity of the content** —
not about the running site.

---

## Trust boundaries

| #   | Boundary                      | What crosses it                                          | Who could tamper                                        |
| --- | ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| B1  | Content author → repository   | Chess content files                                      | The maintainer; any future contributor via pull request |
| B2  | npm registry → build          | Third-party packages and their transitive dependencies   | A compromised package or maintainer account             |
| B3  | GitHub Actions → GitHub Pages | The built bundle                                         | Anyone who can run a privileged workflow or alter one   |
| B4  | Visitor's URL → application   | `line`, `q`, `side`, `soundness`, `tier`, `flip`, locale | Anyone who can get a visitor to open a link             |
| B5  | Application → `localStorage`  | Progress data                                            | Any script running on the origin                        |

There is deliberately no browser-to-server boundary, and no server-to-database boundary.

---

## STRIDE

| Threat                     | Assessment and control                                                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Spoofing**               | No identity exists, so there is nothing to impersonate. The one spoofing risk is _the site itself_ being impersonated; HTTPS is enforced by the host and a custom domain, if adopted, must have HSTS                                                                                                  |
| **Tampering**              | The real one. Two forms: tampering with the **content** (B1) and with the **build** (B2, B3). Controls below                                                                                                                                                                                          |
| **Repudiation**            | Every change is a signed-off commit in a public repository with a full, public audit trail. Adequate for the risk                                                                                                                                                                                     |
| **Information disclosure** | Nothing confidential exists. No secrets in production, no personal data, no analytics, no third-party requests (N8). Progress in `localStorage` is not sensitive and never leaves the device. The remaining risk is a secret being _committed_ to a public repository — controlled by secret scanning |
| **Denial of service**      | Out of scope. The site is static files on a CDN; the host absorbs this and there is nothing to exhaust                                                                                                                                                                                                |
| **Elevation of privilege** | No privilege levels exist in the application. The meaningful version is a pull request gaining the ability to publish — controlled at B3                                                                                                                                                              |

---

## Controls

### B1 — Content integrity (the highest-value control in the project)

The product's whole claim is that what it teaches is true. A false "mate in 4" is this project's
equivalent of a data breach, so content validation is a security control and not merely a test.

- Every modelled ply is legal from its parent position, verified by replaying from the standard
  starting position.
- Every checkmate claim is verified against the derived position.
- Every `ForcedMate` outcome is **generated by search, never authored** (`CONTEXT.md` invariant 4).
  There is no code path by which a human's assertion of a mate reaches the published site.
- A `ForcedMate` reachable through a reply marked `best` or `good` is rejected as a content error.
- Content files are data, never executable. No content file may contain code, and the loader must
  not be capable of evaluating one.
- **The content parser is a denial-of-service surface on pull requests.** Build workflows parse
  content from a branch, and the assumption that only one person authors content is already recorded
  as possibly wrong. A YAML alias bomb or a pathologically deep tree can exhaust the runner. Parsing
  is therefore bounded — maximum document size, maximum nesting depth, aliases disabled — and a fork
  pull request never runs with elevated permissions (B3).
- Annotation prose is rendered as **text, not HTML**. No `dangerouslySetInnerHTML`, no markdown-to-
  HTML pipeline, no raw SVG from content. If rich text is ever wanted, it goes through an
  allow-listed renderer, and that is a change to this document first.
- Branch protection on the default branch: no direct pushes, CI required to pass before merge.

### B2 — Dependency supply chain

- Lockfile committed; CI installs from the lockfile only, never resolving fresh versions.
- Minimal dependency count is an explicit design goal, not a side effect. Every new runtime
  dependency is a decision with a named reason, and adding one is outside any agent's authority.
- Automated vulnerability scanning on every pull request and on a schedule. **Critical and high
  findings are fixed or mitigated within 7 days; a fix that cannot be applied is recorded as a known
  issue with a decision, never silently ignored.**
- Automated dependency updates, reviewed rather than auto-merged.
- Licence check in CI: every dependency's licence is recorded, and a copyleft licence appearing in
  the runtime dependency tree fails the build rather than quietly changing the project's licensing
  obligations.

### B3 — Build and deployment integrity

- Workflows declare least-privilege `permissions:` explicitly at the top of every file; the
  repository default is read-only.
- Third-party actions are **pinned to a full commit SHA**, never to a moving tag.
- No workflow triggered by `pull_request_target`, and no secret is exposed to any workflow that runs
  untrusted pull-request code.
- Only the default branch deploys. Deployment uses the repository's Pages environment so the
  publishing identity is scoped and auditable.
- Secret scanning runs in CI and blocks the build. The repository is public and its history is
  permanent — a leaked secret cannot be un-leaked by a later commit.

### B4 — Untrusted URL input

Every URL parameter is attacker-controlled, because a link can be sent to anyone.

- Parsed and validated at the boundary against a schema. Locale, `side`, `soundness` and `tier` are
  closed sets. `line` is validated by replaying it against the actual gambit tree.
- An invalid `line` recovers to the nearest valid node and says so. It never throws, never renders
  a blank screen, and never round-trips unvalidated text into the DOM.
- No URL parameter is ever interpolated into HTML or used to choose a module to load.
- **One parameter does build a URL for a request, and it is bounded rather than forbidden**: the
  gambit id, which selects the compiled entry to fetch. Per-entry lazy loading is impossible
  otherwise. The id is matched against the schema's slug shape and a 64-character bound **before any
  fetch is issued**, so no dot, slash or percent survives, and a refused id makes no request at all
  rather than a request that fails. Added by #6; asserted by test.

### B5 — Client storage

- `localStorage` holds progress only — never anything sensitive, because nothing sensitive exists.
- Every read and write is wrapped: a private window, disabled storage, a quota error or corrupt
  stored data degrades to "no saved progress" and never breaks the page.
- Stored data is validated on read against the same schema as on write. Data that has been edited by
  hand is discarded rather than trusted.
- **One documented exemption to "no `localStorage` access outside the wrapped helper"**: the
  theme-override read in `index.html`, added by #2. It cannot go through `src/lib/storage.ts`,
  because it has to run before any module does — a deferred module script would paint the wrong
  theme and then correct it in front of the visitor. It is wrapped in the same `try`/`catch` the
  helper uses, validates against the same closed set, degrades to the system preference on any
  failure, and reads one key holding one of three words. `src/styles/theme.test.ts` asserts the key
  and the attribute still match `src/styles/theme.ts`, so the two spellings cannot drift.

### Transport and browser-level controls

- HTTPS enforced by the host.
- **Constraint of the hosting choice:** a static host serves fixed response headers that the project
  cannot configure. A Content Security Policy is therefore delivered via `<meta http-equiv>`, which
  covers most directives but **cannot express `frame-ancestors`**, so clickjacking protection by
  header is unavailable.
  **Accepted**, with the reasoning recorded: the site has no authenticated state, no destructive
  action and no form, so there is nothing for a clickjacking frame to capture. If any of those three
  ever becomes untrue, this acceptance is void and hosting must be revisited (ADR-0007).
  _The exact set of headers the host does send is to be verified in Phase 2 and recorded here._
- CSP is restrictive by default: no third-party origins are allowed at all, which is enforcement of
  requirement N8 rather than a separate rule.
- **In place since #19.** `tools/shells/csp.ts` builds the policy from the emitted `index.html` and
  `scripts/generate-shells.ts` stamps it into all 2,111 documents, immediately after `<meta charset>`
  — a `<meta>` policy governs only what the parser reads after it, so one emitted lower in the head
  would leave the inline script below ungoverned. The policy as published:

  ```
  default-src 'none'; script-src 'self' 'sha256-…'; style-src 'self'; img-src 'self';
  connect-src 'self'; font-src 'none'; base-uri 'none'; form-action 'none'
  ```

  `font-src 'none'` is redundant under `default-src` and written out anyway: `docs/design-system.md`
  §6 budgets zero downloaded fonts, and a budget in the policy is enforced on every visitor rather
  than only on CI. `frame-ancestors` is absent because a `<meta>` policy cannot express it, which is
  the acceptance recorded above rather than an omission.

- **`script-src` has one inline script to account for**: the pre-paint theme read described under
  B5. It must be allowed by its **hash**, never by `'unsafe-inline'` — a policy that permits inline
  script wholesale gives away most of what a CSP buys, and one four-line script is not worth that.
  Whoever writes the policy computes the hash at build time from the emitted HTML. Done: the hash is
  computed from `dist/index.html`, never written down, and **a second inline script stops the
  build** rather than earning itself a second hash. `e2e/content-security-policy.spec.ts` shows the
  distinction is real — an injected inline script with different bytes does not run.
- **`style-src` must be genuinely checked, not assumed.** A CSP that ends up needing
  `'unsafe-inline'` for styles has given away most of what a CSP buys, and inline `style` attributes
  are governed by `style-src`. Owning the board renderer (ADR-0003) is what makes a strict policy
  reachable — a third-party board setting inline transforms would have forced the exemption. The
  policy is asserted by a test, so a future inline style fails the build rather than quietly
  widening the policy. Checked, not assumed: the application sets no `style` attribute and injects
  no `<style>` element, `style-src 'self'` ships, and every published route is walked under the real
  policy and required to render _and_ report zero violations.
- No cookies are set. No cookie banner is needed, because there is nothing to consent to.

---

## Logging and data retention

- The application performs no logging and no telemetry. There is no error-reporting service, because
  adding one would be a third-party request and would break N8.
- Consequence, stated honestly: **production errors are invisible to the maintainer** unless a user
  reports them. Accepted for v1 given zero budget and zero personal data. The mitigation is that
  errors are made visible _to the user_ with specific, actionable messages and a link to file an
  issue.
- Retention: nothing is retained anywhere except the visitor's own `localStorage`, which they can
  clear at any time through normal browser controls. There is no deletion request to honour because
  there is no data held.

---

## Review checklist for every pull request

- [ ] No new runtime dependency without a recorded reason
- [ ] No content rendered as HTML
- [ ] Every new URL parameter validated against a closed schema at the boundary
- [ ] No `localStorage` access outside the wrapped helper
- [ ] Workflow changes keep least privilege and SHA-pinned actions
- [ ] No secret, token, or personal data in code, content, tests, or fixtures
