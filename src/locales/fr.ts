import type { PartialTranslations } from '../i18n/translations.ts'

/**
 * French. A subset of the Vietnamese catalogue, for the reason given in `en.ts`.
 */
const fr: PartialTranslations = {
  skip: {
    toContent: 'Aller au contenu',
  },
  nav: {
    primary: 'Principale',
    menu: 'Menu',
    catalogue: 'Catalogue',
    about: 'À propos',
    language: 'Langue',
  },
  appearance: {
    label: 'Apparence',
    system: 'Système',
    light: 'Clair',
    dark: 'Sombre',
  },
  footer: {
    source: 'Code source sur GitHub',
    code: 'Code :',
    content: 'Contenu :',
    openingData: "Noms d'ouvertures et codes ECO issus de",
    mateProof: 'Comment les mats annoncés sont prouvés',
  },
  untranslated: {
    marker: 'non traduit',
    inVietnamese: 'Affiché en vietnamien.',
    bundleFailed: "La traduction de cette langue n'a pas pu être chargée.",
  },
  board: {
    label: 'Échiquier',
    emptySquare: 'case vide',
    whiteKing: 'roi blanc',
    whiteQueen: 'dame blanche',
    whiteRook: 'tour blanche',
    whiteBishop: 'fou blanc',
    whiteKnight: 'cavalier blanc',
    whitePawn: 'pion blanc',
    blackKing: 'roi noir',
    blackQueen: 'dame noire',
    blackRook: 'tour noire',
    blackBishop: 'fou noir',
    blackKnight: 'cavalier noir',
    blackPawn: 'pion noir',
  },
}

export default fr
