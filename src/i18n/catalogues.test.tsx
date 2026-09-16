import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PIECE_ROLES } from '../components/board/board-model.ts'
import { locales, type Locale } from '../lib/locale.ts'
import en from '../locales/en.ts'
import fr from '../locales/fr.ts'
import vi from '../locales/vi.ts'
import { I18nProvider } from './I18nProvider.tsx'
import { useBoardLabels } from './board-labels.ts'
import type { LocaleLoader } from './i18n.ts'
import type { PartialTranslations } from './translations.ts'

/**
 * What the catalogues must satisfy at runtime, over and above what their types already
 * guarantee. The types make a misspelt key impossible; these cover the claims a type cannot
 * make, because `PartialTranslations` deliberately allows every key to be absent.
 */

afterEach(cleanup)

const TRANSLATED: Readonly<Record<string, PartialTranslations>> = { en, fr }

describe('the marker speaks the visitor language', () => {
  /**
   * The one group no locale may leave incomplete. A French page whose marker read
   * "chưa dịch" would be announcing, in Vietnamese, that something is in Vietnamese.
   */
  it.each(Object.keys(TRANSLATED))('%s translates every untranslated string', (locale) => {
    const untranslated = TRANSLATED[locale]?.untranslated

    for (const key of Object.keys(vi.untranslated)) {
      expect(untranslated, `${locale} is missing untranslated.${key}`).toHaveProperty(key)
    }
  })
})

describe('the board vocabulary', () => {
  /**
   * The board takes its spoken names as a prop and cannot describe a square without them,
   * so a name that fell through to its key is a square a screen reader reads as `board.
   * whiteKnight`. Piece *names* are localised; piece *letters* never are (§7).
   */
  const CATALOGUES: Readonly<Record<Locale, PartialTranslations>> = { vi, en, fr }

  const load =
    (locale: Locale): LocaleLoader =>
    (requested) =>
      Promise.resolve(requested === locale ? CATALOGUES[locale] : vi)

  const Probe = () => {
    const labels = useBoardLabels()
    const every = [labels.board, labels.emptySquare, ...Object.values(labels.pieces)]

    return (
      <>
        <span data-testid="knight">{labels.pieces.whiteKnight}</span>
        <span data-testid="grid">{labels.board}</span>
        <span data-testid="count">{every.length}</span>
        <span data-testid="unresolved">
          {every.filter((name) => name.includes('board.')).length}
        </span>
      </>
    )
  }

  const probe = async (locale: Locale) => {
    render(
      <I18nProvider locale={locale} load={load(locale)}>
        <Probe />
      </I18nProvider>,
    )
    return {
      knight: (await screen.findByTestId('knight')).textContent,
      grid: screen.getByTestId('grid').textContent,
      count: screen.getByTestId('count').textContent,
      unresolved: screen.getByTestId('unresolved').textContent,
    }
  }

  it('names the board and all twelve pieces, in the source locale', () => {
    expect(Object.keys(vi.board)).toHaveLength(PIECE_ROLES.length * 2 + 2)
  })

  it.each([...locales])('resolves every one of them in %s', async (locale) => {
    const { count, unresolved } = await probe(locale)

    expect(count).toBe(String(PIECE_ROLES.length * 2 + 2))
    expect(unresolved, 'a piece name fell through to its key').toBe('0')
  })

  it('speaks Vietnamese to a Vietnamese reader', async () => {
    expect(await probe('vi')).toMatchObject({ knight: 'mã trắng', grid: 'Bàn cờ' })
  })

  it('speaks French to a French reader', async () => {
    expect(await probe('fr')).toMatchObject({ knight: 'cavalier blanc', grid: 'Échiquier' })
  })
})

describe('chess notation', () => {
  /**
   * SAN is SAN in all three locales (docs/design-system.md §7, ADR-0006). There is no key
   * for a piece *letter* anywhere, and this fails if somebody ever adds one.
   */
  const LETTER_KEYS = ['K', 'Q', 'R', 'B', 'N', 'P']

  it.each([...locales])('has no localised piece letter in %s', (locale) => {
    const catalogue: PartialTranslations = locale === 'vi' ? vi : (TRANSLATED[locale] ?? {})

    expect(Object.keys(catalogue.board ?? {}).filter((k) => LETTER_KEYS.includes(k))).toStrictEqual(
      [],
    )
  })
})
