import { describe, expect, it } from 'vitest'
import { locales } from './locale'
import { routePath, routeSegments, shellPaths } from './routes'

describe('route paths', () => {
  it('puts the locale first on every route', () => {
    expect(routePath('vi')).toBe('/vi/')
    expect(routePath('en', routeSegments.catalogue)).toBe('/en/gambits')
    expect(routePath('fr', routeSegments.about)).toBe('/fr/about')
    expect(routePath('vi', routeSegments.catalogue, 'evans-gambit')).toBe(
      '/vi/gambits/evans-gambit',
    )
  })

  it('gives the locale home a trailing slash, matching its shell directory', () => {
    expect(routePath('vi')).toMatch(/\/$/)
  })
})

describe('the shells a build must emit', () => {
  it('covers every static route in every locale', () => {
    const paths = shellPaths([])

    expect(paths).toHaveLength(locales.length * 3)
    for (const locale of locales) {
      expect(paths).toContain(locale)
      expect(paths).toContain(`${locale}/gambits`)
      expect(paths).toContain(`${locale}/about`)
    }
  })

  it('excludes the site root, which Vite already writes', () => {
    expect(shellPaths([])).not.toContain('')
  })

  it('adds one shell per gambit per locale', () => {
    const paths = shellPaths(['evans-gambit', 'kings-gambit'])

    expect(paths).toHaveLength(locales.length * 5)
    expect(paths).toContain('fr/gambits/evans-gambit')
    expect(paths).toContain('vi/gambits/kings-gambit')
  })

  /**
   * The shape of the real build, at the real size. 1,003 published entries is 3,009 gambit
   * shells plus the nine static ones — and a link on the catalogue page to an id with no
   * shell behind it is an HTTP 404 on the host while every test here passes, which is the
   * failure this module exists to make impossible.
   */
  it('scales to the whole catalogue: three locales times every published id', () => {
    const ids = Array.from({ length: 1003 }, (_, index) => `gambit-${index}`)
    const paths = shellPaths(ids)

    expect(paths).toHaveLength(locales.length * (3 + ids.length))
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('emits no path that would escape the output directory', () => {
    for (const path of shellPaths(['evans-gambit'])) {
      expect(path).not.toMatch(/^\/|\.\./)
    }
  })
})
