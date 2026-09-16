import type { PartialTranslations } from '../i18n/translations.ts'

/**
 * English. Typed as a *subset* of the Vietnamese catalogue, so this file may legitimately
 * be incomplete — every key it omits renders the Vietnamese text with a visible marker
 * (requirement F9) rather than blocking the release on a translator.
 *
 * The `untranslated` group is the one group that is never allowed to be incomplete here:
 * it is the wording the marker itself uses, and a marker that appeared in Vietnamese on an
 * English page would be reporting its own failure in the language it was reporting about.
 */
const en: PartialTranslations = {
  skip: {
    toContent: 'Skip to content',
  },
  nav: {
    primary: 'Primary',
    menu: 'Menu',
    catalogue: 'Catalogue',
    about: 'About',
    language: 'Language',
  },
  appearance: {
    label: 'Appearance',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
  footer: {
    source: 'Source on GitHub',
    code: 'Code:',
    content: 'Content:',
    openingData: 'Opening names and ECO codes from',
    mateProof: 'How mate claims are proved',
  },
  untranslated: {
    marker: 'not translated',
    inVietnamese: 'Shown in Vietnamese.',
    bundleFailed: 'The translation for this language could not be loaded.',
  },
  board: {
    label: 'Chessboard',
    emptySquare: 'empty square',
    whiteKing: 'white king',
    whiteQueen: 'white queen',
    whiteRook: 'white rook',
    whiteBishop: 'white bishop',
    whiteKnight: 'white knight',
    whitePawn: 'white pawn',
    blackKing: 'black king',
    blackQueen: 'black queen',
    blackRook: 'black rook',
    blackBishop: 'black bishop',
    blackKnight: 'black knight',
    blackPawn: 'black pawn',
  },
}

export default en
