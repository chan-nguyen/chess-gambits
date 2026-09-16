import { isRouteErrorResponse, useRouteError } from 'react-router'

/**
 * The application performs no logging and sends nothing anywhere (docs/security.md), so
 * an error the maintainer cannot see has to be made visible and actionable to the person
 * in front of it instead.
 */
export const RouteErrorRoute = () => {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : null

  return (
    <main>
      <h1>Something went wrong</h1>
      <p>This page could not be shown. Reloading may fix it.</p>
      {detail !== null && <p>{detail}</p>}
      <p>
        <a href="https://github.com/chan-nguyen/chess-gambits/issues">Report this</a>
      </p>
    </main>
  )
}
