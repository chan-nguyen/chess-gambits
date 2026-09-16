/**
 * The only place in the application that touches `localStorage` (docs/security.md, B5,
 * and the "Never" list in docs/definition-of-done.md).
 *
 * Storage is not available everywhere it looks available. A private window, storage
 * disabled by policy, a full quota or a `localStorage` getter that throws on access are
 * all normal conditions, not exceptional ones, and none of them may break the page. So
 * every read and write is wrapped and every failure degrades to "no stored value".
 *
 * Reads take a validator rather than returning a raw string, because stored data is
 * editable by hand and by any script on the origin. Data that no longer satisfies its
 * own schema is discarded, not trusted.
 */

/** Read a stored value, or null if it is absent, unreadable or no longer valid. */
export const readStored = <T extends string>(
  key: string,
  isValid: (value: string) => value is T,
): T | null => {
  try {
    const stored = window.localStorage.getItem(key)
    return stored !== null && isValid(stored) ? stored : null
  } catch {
    return null
  }
}

/** Store a value. Failing to store is not an error the caller can do anything about. */
export const writeStored = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Quota exceeded, storage disabled, or a private window. Nothing stored here is
    // worth interrupting the visitor over.
  }
}
