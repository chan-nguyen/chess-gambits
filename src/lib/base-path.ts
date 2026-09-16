/**
 * The path the site is served from. Vite replaces `import.meta.env.BASE_URL` at build
 * time, but only when it appears literally — bracket access is not substituted, so this
 * must stay a direct property read.
 */
export const basePath: string = import.meta.env.BASE_URL

/** Join a route onto the base path without producing a double slash. */
export const withBasePath = (route: string): string =>
  `${basePath.replace(/\/$/, '')}/${route.replace(/^\//, '')}`
