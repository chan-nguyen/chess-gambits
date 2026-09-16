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
  learn: {
    loading: 'Chargement de la position…',
    navigation: 'Naviguer dans cette ligne',
    toStart: 'Revenir au début',
    previousPly: 'Coup précédent',
    nextPly: 'Coup suivant',
    atStart: 'C’est le début de la ligne.',
    atEnd: 'C’est la fin de la ligne.',
    startingPosition: 'Position de départ',
    after: 'Après',
    noAnnotation: 'Ce coup n’a pas encore d’explication.',
    plyList: 'Coups de cette ligne',
    shortcuts: 'Raccourcis clavier',
    shortcutsHint: 'Utilisez les flèches gauche et droite pour parcourir la ligne.',
    branchNotFound: 'Ce gambit n’a pas ce coup ; la position la plus proche est affichée :',
    capture: 'prise',
    check: 'échec',
    checkmate: 'échec et mat',
  },
  progress: {
    heading: 'Progression',
    count: '{{learned}} branches apprises sur {{total}}',
    learned: 'Apprise',
    unmarked: "Cette branche n'est plus marquée comme apprise.",
    undo: 'Annuler',
    atBranchEnd: "Allez à la fin d'une ligne pour la marquer comme apprise.",
    nothingToMark: "Ce gambit n'a pas encore de branche à marquer.",
    versionDiscarded:
      "Votre progression enregistrée provenait d'une version antérieure du site : elle a été supprimée. Il faudra marquer vos branches à nouveau.",
  },
  tree: {
    heading: 'Le gambit en entier',
    label: 'Arbre du gambit',
    show: 'Afficher l’arbre',
    hide: 'Masquer l’arbre',
    close: 'Fermer l’arbre',
    positions: 'Positions :',
    lines: 'Lignes :',
    mateIn: 'Mat en',
    assessment: 'Évaluation',
    unexplored: 'Pas encore cartographié',
    transposes: 'Transposition',
    showRefutation: 'Afficher la réfutation complète',
    refutation: 'La réfutation prouvée :',
  },
}

export default fr
