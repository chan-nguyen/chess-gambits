# Performance budgets

Every number here is measured against the **built** output on a static host that gzips, and
every one of them can fail a pull request — except one, which is named below with the reason.

| Budget                       | Threshold | Enforced by                                     |
| ---------------------------- | --------- | ----------------------------------------------- |
| Initial JavaScript per route | < 200KB   | `e2e/route-budgets.spec.ts`                     |
| Per-route incremental JS     | < 50KB    | `e2e/route-budgets.spec.ts`                     |
| Route data payload           | ≤ 100KB   | `e2e/route-budgets.spec.ts`                     |
| Pressing next, throttled     | < 200ms   | `e2e/interaction-latency.spec.ts`, two measures |
| LCP, mid-tier mobile         | < 2.5s    | `lighthouserc.json`, blocking                   |
| CLS, mid-tier mobile         | < 0.1     | `lighthouserc.json`, **reported, not blocking** |
| Third-party requests, fonts  | 0         | `e2e/route-budgets.spec.ts`, and the CSP        |

## Why pressing next is measured twice

The budget is one number, 200ms, and there are two measurements under it because one of them
could not see the thing the budget is for.

`next` is a `<Link>`, so pressing it is a route navigation and React renders it in a
transition: the browser paints, the interaction ends, and the render happens afterwards. The
Event Timing entry closes before that work starts. So the original assertion — the worst
`event` entry with an `interactionId` — measures the handling of the click and not the cost of
what the click causes.

That was not a theory. A 300ms main-thread block was injected into `LearningSurface`, which
re-renders on every navigation (confirmed by counter: four renders for one mount and three
presses). In a single run, on the same build and the same throttle:

| Measurement                      | Reading | Verdict |
| -------------------------------- | ------- | ------- |
| Worst interaction entry          | 32.0ms  | green   |
| Click to the next node on screen | 335.4ms | **red** |

A gate that stays green while every press costs a third of a second is the same instrument
this project has already retired twice — the jsdom board-performance ratio, removed in #19
after injecting a quadratic DOM scan moved it from 27.2 to 27.0. An instrument that cannot see
the defect it claims to catch is worse than no gate, because it certifies.

So the entries are still collected and still asserted — that half is a real Core Web Vitals
figure and #19 put it there deliberately — and a second measurement covers the transition:
from the real click to the frame after the next control points somewhere new, timed in the
page's own clock from a capture listener on the click, so none of the number is the test
runner's round trip.

It is also the quieter of the two, which is what #61 asked the instrument to become. It is a
deterministic span rather than a worst-of sample, and it reads 28–31ms on the fixture line and
~55ms on published content against a 200ms budget.

**The threshold did not move.** 200ms is the Core Web Vitals figure; #61 changed the
instrument, as its acceptance criterion 2 required, and proved the result can fail by making
the interaction genuinely slow and watching both assertions go red.

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
