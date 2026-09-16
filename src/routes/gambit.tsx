import { useParams, useSearchParams } from 'react-router'
import { describeLineProblem, lineParam, parseLine } from '../lib/line.ts'

/**
 * Placeholder for the learning surface (#4, #12). What is real here is the `line`
 * parameter: it is attacker-controlled, so it is parsed at the boundary, recovered to
 * the nearest valid node when it is wrong, and never allowed to throw
 * (docs/security.md, B4).
 */
export const GambitRoute = () => {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { plies, problem } = parseLine(searchParams.get(lineParam) ?? '')

  return (
    <main>
      <h1>{id ?? 'Unknown gambit'}</h1>
      {problem !== null && <p role="alert">{describeLineProblem(problem)}</p>}
      <p>
        Line:{' '}
        <span data-testid="line-plies">
          {plies.length === 0 ? 'the gambit root' : plies.join(' ')}
        </span>
      </p>
    </main>
  )
}
