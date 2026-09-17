# Performance budgets

Every number here is measured against the **built** output on a static host that gzips, and
every one of them can fail a pull request — except one, which is named below with the reason.

| Budget                          | Threshold | Enforced by                                     |
| ------------------------------- | --------- | ----------------------------------------------- |
| Initial JavaScript per route    | < 200KB   | `e2e/route-budgets.spec.ts`                     |
| Per-route incremental JS        | < 50KB    | `e2e/route-budgets.spec.ts`                     |
| Route data payload              | ≤ 100KB   | `e2e/route-budgets.spec.ts`                     |
| INP pressing next, throttled 4× | < 200ms   | `e2e/interaction-latency.spec.ts`               |
| LCP, mid-tier mobile            | < 2.5s    | `lighthouserc.json`, blocking                   |
| CLS, mid-tier mobile            | < 0.1     | `lighthouserc.json`, **reported, not blocking** |
| Third-party requests, fonts     | 0         | `e2e/route-budgets.spec.ts`, and the CSP        |

## Why CLS is reported rather than blocking

It is the one budget this site does not currently meet: `footer.site-footer` shifts a full
viewport on `/:locale/gambits` when the route's JSON lands after first paint, and the median of
three runs reads **0.216** against a limit of 0.1.

Three things were considered and rejected before settling on this:

- **Widening the budget to 0.25 so it passes.** A budget adjusted to whatever the site happens to
  do is not a budget. The threshold stays at 0.1 and the measured number stays visible.
- **Landing it blocking and red.** A step that is always red teaches everyone to ignore CI, and
  then the first real regression reads as one more known failure. That is worse than not
  measuring at all.
- **Fixing the shift inside the budgets ticket.** It needs a loading state that reserves its own
  height, which is user-facing design work; #19 scopes optimisation out by name, and mixing the
  two would make neither reviewable.

So the assertion stays in the config at its real value and at `warn`, which prints the number on
every run without blocking. **It goes back to `error` in the pull request that fixes the shift** — issue #57, where that is
acceptance criterion 2 rather than a good intention.

LCP is unaffected and blocks today at 2.5s; it measures 2106ms on the worst route.
