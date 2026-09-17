# Performance budgets

Every number here is measured against the **built** output on a static host that gzips, and
every one of them can fail a pull request.

| Budget                       | Threshold | Enforced by                                                       |
| ---------------------------- | --------- | ----------------------------------------------------------------- |
| Initial JavaScript per route | < 200KB   | `e2e/route-budgets.spec.ts`                                       |
| Per-route incremental JS     | < 50KB    | `e2e/route-budgets.spec.ts`                                       |
| Route data payload           | ≤ 100KB   | `e2e/route-budgets.spec.ts`                                       |
| Pressing next, throttled     | < 200ms   | `e2e/interaction-latency.spec.ts`, two measures                   |
| LCP, mid-tier mobile         | < 2.5s    | `lighthouserc.json`, blocking                                     |
| CLS, mid-tier mobile         | < 0.1     | `lighthouserc.json`, blocking, and `e2e/layout-stability.spec.ts` |
| Third-party requests, fonts  | 0         | `e2e/route-budgets.spec.ts`, and the CSP                          |

`tools/perf/lighthouse-budget.test.ts` reads the two Lighthouse rows back out of
`lighthouserc.json` and fails if a threshold has moved or an assertion has stopped blocking.
The CLS row is why it exists: that assertion sat at `warn` from #19 until #57 fixed the shift
under it, and nothing but a ticket was holding it there.

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

## How CLS is measured, and why Lighthouse is not the only instrument

It was the one budget this site did not meet, and the story is worth keeping because the
_measurement_ was the harder half.

`#root { min-block-size: 100svh }` parked `footer.site-footer` at the bottom of the viewport
whenever the content was shorter than one — which is every route for as long as its JSON is
in flight. The footer painted inside the viewport and was then pushed a full screen down
when the list or the tree arrived. The fix (#57) moves that floor down one level onto the
content region, so the footer's top edge starts below the fold and content arriving pushes
it further out of sight instead of out of the viewport. It is deliberately unconditional:
a reservation released when the content turns out to be shorter than it would pull the
footer back up, which is the same shift in the other direction.

The number was **intermittent in the measurement and not in the site**. Over ten Lighthouse
runs of `/:locale/gambits` it read 0.216 five times and 0.000 five times: the shift always
happened, and whether it landed inside the measured window depended on whether the JSON
resolved before or after the first paint. A median of three therefore failed roughly half of
pull requests on identical code, which is why the assertion sat at `warn` until the shift
itself was fixed.

Two things follow, and both are in the suite rather than in this paragraph:

- **Lighthouse cannot be the only instrument.** It measures one width — its own mid-tier
  mobile profile — and it measures whichever of the two races it happens to win.
  `e2e/layout-stability.spec.ts` measures at 360px and 1280px with every request for route
  data **held** until the loading state has painted, so the loading state is always what
  paints first. That is the worst case rather than a sample of it.
- **Cumulative layout shift is not the assertion with teeth.** On the broken build the home
  page measured 0.037 at 360px and the catalogue 0.069 at 1280px: real shifts of a real
  footer, both under a 0.1 budget. So the spec asserts the thing that actually stopped
  happening — the footer's top edge is at or below the fold while the data is in flight and
  once it has landed, and never moves back up the page — and asserts the budget as well.

The footer is **not** hidden while the data is in flight, and the spec asserts that too. It
carries the CC BY-SA attribution `LICENSE-CONTENT` requires to stay visible, so trading a
shift for a flash would not have been a fix.

**The threshold never moved.** Widening the budget to 0.25 so that the site passed was
considered and rejected in #19: a budget adjusted to whatever the site happens to do is not a
budget. 0.1 is the Core Web Vitals figure and it is what both instruments read.

LCP is unaffected and blocks today at 2.5s; it measures 2106ms on the worst route.
