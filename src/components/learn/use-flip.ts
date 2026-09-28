import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { flipParam, parseFlip, withFlip } from '../../lib/flip.ts'

/**
 * Whether the gambit page's board is flipped, and a way to carry that into a link.
 *
 * Every link on this page builds its search from an address alone (`walk.ts`, `line.ts`),
 * which knows nothing about orientation and should not have to. Read out of the URL here,
 * by each component that builds a link, rather than passed down through `OutcomeCard` and
 * `MateOutcome` to reach `MateNet`: the URL is already the single source of truth, and a
 * prop threaded through components that never read it is a second copy of it.
 */
export const useFlip = (): {
  readonly flipped: boolean
  readonly keepFlip: (search: string) => string
} => {
  const [searchParams] = useSearchParams()
  const flipped = parseFlip(searchParams.get(flipParam))
  const keepFlip = useCallback((search: string) => withFlip(search, flipped), [flipped])
  return { flipped, keepFlip }
}
