import { gzipSync } from 'node:zlib'
import type { CatalogueIssue, Locale } from './types.ts'

/**
 * The catalogue payload budget: 100KB gzipped, **regardless of catalogue size**
 * (`docs/design-system.md` §6, and acceptance criterion 8 of issue #12).
 *
 * It is measured over the whole generated file, not a sample and not an estimate
 * extrapolated from one. An estimate is exactly what fails silently as coverage grows,
 * because the thing that blows the budget is a field nobody thought about repeating 1,500
 * times.
 *
 * `gzipSync` at its default level stands in for what a static host serves. GitHub Pages
 * compresses on the fly and its level is not ours to choose, so this is a proxy — a
 * conservative one, since a host tuned for bandwidth compresses at least this well.
 * Brotli would read smaller still and is not assumed.
 */

export const BUDGET_BYTES = 100 * 1024

/** The size the ticket names, so the tripwire is checked where it is claimed to hold. */
export const BUDGET_ENTRIES = 1500

export type PayloadSize = {
  readonly locale: Locale
  readonly entries: number
  readonly bytes: number
  readonly gzippedBytes: number
}

export const measure = (locale: Locale, entries: number, json: string): PayloadSize => ({
  locale,
  entries,
  bytes: Buffer.byteLength(json, 'utf8'),
  gzippedBytes: gzipSync(Buffer.from(json, 'utf8')).byteLength,
})

export const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)}KB`

export const checkBudget = (sizes: readonly PayloadSize[]): readonly CatalogueIssue[] =>
  sizes
    .filter((size) => size.gzippedBytes > BUDGET_BYTES)
    .map((size) => ({
      where: `public/catalogue/catalogue.${size.locale}.json`,
      message:
        `is ${kb(size.gzippedBytes)} gzipped over ${size.entries} entries, above the ` +
        `${kb(BUDGET_BYTES)} catalogue budget (docs/design-system.md §6). The budget does not ` +
        'scale with coverage: a catalogue that outgrows it has to get smaller per entry, not be ' +
        'allowed to get larger.',
    }))
