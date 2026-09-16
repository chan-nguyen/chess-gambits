import { describe, expect, it } from 'vitest'
import { basePath, withBasePath } from './base-path'

describe('base path', () => {
  it('is defined and ends with a slash', () => {
    expect(basePath).toMatch(/\/$/)
  })

  it('joins a route without doubling the separator', () => {
    expect(withBasePath('/vi/gambits')).toBe(`${basePath.replace(/\/$/, '')}/vi/gambits`)
    expect(withBasePath('vi/gambits')).toBe(`${basePath.replace(/\/$/, '')}/vi/gambits`)
  })

  it('never produces a double slash', () => {
    expect(withBasePath('/vi/')).not.toMatch(/\/\//)
  })
})
