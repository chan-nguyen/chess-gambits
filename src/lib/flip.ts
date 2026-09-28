import type { Side } from './content-types.ts'

/**
 * The `flip` URL parameter: the board turned round, so the other side sits at the bottom
 * (requirement F2; docs/design-system.md §1 lists it as the gambit page's view state).
 *
 * **A toggle against the page's own default, not a colour.** The gambit page opens with the
 * learner's side at the bottom and the home page opens with White there, and `flip=1` means
 * "the other one" on both. Naming a colour instead would make one address mean "as it
 * opens" on a White entry and "turned round" on a Black one.
 *
 * Only `flip=1` flips. Anything else — `flip=0`, `flip=yes`, a bare `flip` — reads as the
 * default, which is what a hand-edited or truncated address should fall back to, and it is
 * never written: an unflipped board carries no parameter at all.
 */
export const flipParam = 'flip'

/** Read a decoded `flip` value, as `URLSearchParams.get` returns it. */
export const parseFlip = (raw: string | null): boolean => raw === '1'

/** The side at the bottom: the page's default, or the other one when flipped. */
export const orient = (side: Side, flipped: boolean): Side =>
  !flipped ? side : side === 'white' ? 'black' : 'white'

const isFlipPart = (part: string): boolean => part === flipParam || part.startsWith(`${flipParam}=`)

/**
 * `search` with the flip set to `flipped` and every other parameter left byte for byte as it
 * was. Split on `&` rather than round-tripped through `URLSearchParams`, which re-encodes
 * what it did not write: `line` is percent-encoded as a whole by `lib/line.ts`, and a
 * re-serialised copy of it would be a second spelling of the same address.
 */
export const withFlip = (search: string, flipped: boolean): string => {
  const kept = search
    .replace(/^\?/, '')
    .split('&')
    .filter((part) => part !== '' && !isFlipPart(part))
  const parts = flipped ? [...kept, `${flipParam}=1`] : kept
  return parts.length === 0 ? '' : `?${parts.join('&')}`
}
