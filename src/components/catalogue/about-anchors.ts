/**
 * The fragments on the About page that explain the catalogue's vocabulary.
 *
 * Here rather than inside `Badges.tsx` so that the badge and its destination are the same
 * two strings: `AboutRoute` sets these as element ids and the badges link to them, and a
 * rename that touched only one of the two would produce a link that scrolls nowhere —
 * silently, because a fragment that matches nothing is not an error in any browser.
 *
 * Its own module because a file that exports both components and constants loses fast
 * refresh, which the lint gate treats as a failure.
 */
export const aboutAnchors = { tiers: 'tiers', soundness: 'soundness' } as const
