import '@testing-library/jest-dom/vitest'

/**
 * jsdom implements no CSS media queries at all — `window.matchMedia` is simply absent from
 * it — and a component that asks which of §1's three layouts it is in throws before it
 * renders anything. The capability is supplied here rather than per suite for the same
 * reason `jest-dom` is: every test that renders the gambit page needs it, and one that had
 * to remember is one that breaks when somebody forgets.
 *
 * It is the narrowest stand-in that is still honest. `(min-width: Npx)` is answered from
 * jsdom's own `window.innerWidth`, which a test sets to the viewport it means, and every
 * other query answers false rather than guessing. It is read afresh on every call, so a
 * component that re-reads its media query sees the width the test last set. What it does
 * not do is *report* a change: nothing in jsdom resizes, so a subscription has nothing to
 * fire, and the resize behaviour is measured in Playwright against a browser that has a
 * viewport at all.
 *
 * This file is also loaded into the suites that opt out of jsdom with
 * `// @vitest-environment node` — the whole of `tools/` does — where there is no `window`
 * to give anything to. That is why the assignment is guarded: not for a case that cannot
 * happen, but for the fifteen suites where it does.
 */

const MIN_WIDTH = /^\(min-width:\s*(\d+)px\)$/

const widthMatches = (query: string): boolean => {
  const width = MIN_WIDTH.exec(query)?.[1]
  return width === undefined ? false : window.innerWidth >= Number(width)
}

if (typeof window !== 'undefined') {
  window.matchMedia = (query: string): MediaQueryList => ({
    media: query,
    matches: widthMatches(query),
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  })
}
