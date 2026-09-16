# Definition of done

Binding on every pull request. A ticket's own acceptance criteria are _additional_ to this, never
instead of it.

## Always

- [ ] Every acceptance criterion in the ticket is met and demonstrated — not asserted
- [ ] Unit tests cover the new logic, including its failure paths
- [ ] `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` and `npm run build`
      all pass locally before the pull request is opened
- [ ] No new `any`, no `as` assertion, no non-null `!`, no new lint suppression. If the types are
      fighting you, the model is wrong — say so in the pull request rather than silencing it
- [ ] No new runtime dependency without a stated reason in the pull request description. Adding one
      is outside an implementing agent's authority
- [ ] Nothing in `docs/` contradicted. If a decision has to change, change the ADR in the same pull
      request and say why

## When the change is user-facing

- [ ] Keyboard reachable and operable; focus visible; focus goes somewhere sensible after an action
- [ ] Labelled for assistive technology, and any state change announced
- [ ] No information conveyed by colour alone
- [ ] Works from 360px wide with no horizontal scroll
- [ ] Empty, loading and error states exist — "this one cannot be empty" is a claim to verify,
      not to assume
- [ ] End-to-end coverage for the flow that changed

## When the change touches content or its pipeline

- [ ] Every invariant in `docs/CONTEXT.md` still holds
- [ ] No chess claim is authored by a human where the build could prove it
- [ ] Content validation still fails on the adversarial fixtures, and the failure message names the
      file and the node

## When the change touches the build or CI

- [ ] Workflow permissions stay least-privilege; third-party actions stay pinned to a commit SHA
- [ ] Standard runners only — larger runners are billed even on a public repository
- [ ] The build stays under the performance budgets in `docs/design-system.md` §6

## Never

- No secret, token, credential or personal data in code, content, tests, fixtures or logs
- No third-party network request at runtime (requirement N8)
- No `dangerouslySetInnerHTML`, and no content rendered as HTML
- No `localStorage` access outside the wrapped helper, except the single pre-paint theme read
  recorded in `docs/security.md` B5
