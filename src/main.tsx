import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import './styles/global.css'
import { basePath } from './lib/base-path.ts'
import { routes } from './router.tsx'

const container = document.getElementById('root')

if (container === null) throw new Error('No #root element to mount into')

/**
 * The base path is configuration, not a constant: GitHub Pages serves this from
 * `/<repo>/` today and a custom domain would move it to `/` (ADR-0007). It reaches the
 * router here and nowhere else.
 */
createRoot(container).render(
  <StrictMode>
    <RouterProvider router={createBrowserRouter(routes, { basename: basePath })} />
  </StrictMode>,
)
