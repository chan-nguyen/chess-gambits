import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStored, writeStored } from './storage'

const isWord = (value: string): value is 'yes' | 'no' => value === 'yes' || value === 'no'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('wrapped localStorage', () => {
  it('reads back what it wrote', () => {
    writeStored('key', 'yes')

    expect(readStored('key', isWord)).toBe('yes')
  })

  it('reads null when nothing was ever stored', () => {
    expect(readStored('key', isWord)).toBeNull()
  })

  it('discards stored data that no longer satisfies its own schema', () => {
    window.localStorage.setItem('key', 'maybe')

    expect(readStored('key', isWord)).toBeNull()
  })

  it('degrades to no stored value when reading throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })

    expect(() => readStored('key', isWord)).not.toThrow()
    expect(readStored('key', isWord)).toBeNull()
  })

  it('degrades silently when writing throws on quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => writeStored('key', 'yes')).not.toThrow()
  })

  it('degrades when localStorage itself is unreachable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('Access is denied for this document.')
      },
    })

    try {
      expect(readStored('key', isWord)).toBeNull()
      expect(() => writeStored('key', 'yes')).not.toThrow()
    } finally {
      if (descriptor !== undefined) Object.defineProperty(window, 'localStorage', descriptor)
    }
  })
})
