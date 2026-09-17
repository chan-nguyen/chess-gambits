/**
 * The performance budgets from `docs/design-system.md` §6, in one place.
 *
 * They are written here rather than in each spec because two files enforce them and a
 * budget that disagrees with itself is not a budget. §6 remains the source of truth: a
 * number may not be changed here without changing it there first, which is the rule that
 * document states about itself.
 *
 * Note which comparison each one is. §6 writes the JavaScript budgets as `<` and the
 * catalogue payload as `≤`, and the difference is not pedantry — it is the difference
 * between a build at exactly 100KB passing and failing.
 */
export const BUDGET_BYTES = {
  /** `< 200KB` gzipped. Every script a route downloads on a cold load, per route. */
  initialJavaScript: 200 * 1024,
  /** `< 50KB` gzipped. What a route adds over the JavaScript the entry route already got. */
  routeIncrementalJavaScript: 50 * 1024,
  /** `≤ 100KB` gzipped, regardless of catalogue size. Also the budget for any route's data. */
  routePayload: 100 * 1024,
} as const

/**
 * `< 200ms` of interaction latency pressing next, on a CPU-throttled context against the
 * built output. Measured with `PerformanceObserver` in `e2e/interaction-latency.spec.ts`,
 * and **not** with Lighthouse, which cannot measure INP: it is a field metric over real
 * interactions and a lab run has none, so anything Lighthouse reported under that name
 * would be Total Blocking Time.
 */
export const INP_BUDGET_MS = 200

export const asKb = (bytes: number): string => `${(bytes / 1024).toFixed(1)}KB`
