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
    shortcutsHint:
      'Utilisez les flèches gauche et droite pour parcourir la ligne, et les touches 1 à 9 pour choisir une réponse.',
    branchNotFound: 'Ce gambit n’a pas ce coup ; la position la plus proche est affichée :',
    capture: 'prise',
    check: 'échec',
    checkmate: 'échec et mat',
    branchHeading: 'Les réponses auxquelles il faut être prêt',
    noRepliesModelled: 'Aucune réponse n’est encore modélisée ici.',
    nextGoesHere: 'Le bouton suivant mène ici',
    replyQuality: 'Qualité de la réponse',
    frequency: 'Fréquence',
    notStated: 'non renseignée',
    qualityBest: 'meilleur coup',
    qualityGood: 'bon coup',
    qualityInaccuracy: 'imprécision',
    qualityMistake: 'erreur',
    qualityBlunder: 'gaffe',
    frequencyCommon: 'fréquente',
    frequencyOccasional: 'occasionnelle',
    frequencyRare: 'rare',
    judgementNote:
      'La qualité et la fréquence indiquées ici relèvent du jugement d’une personne, pas de statistiques :',
    provedBy: 'Prouvé par la machine, d’après le certificat',
    otherReply: 'autre réponse',
    otherReplies: 'autres réponses',
    coveredReplies: 'Cette réponse couvre exactement les coups suivants :',
    dismissedReply: 'réponse n’est pas modélisée',
    dismissedReplies: 'réponses ne sont pas modélisées',
    maintainerNote:
      'Note de mainteneur, dans la langue où elle a été écrite. Elle n’a pas été rédigée pour un lecteur.',
    planHeading: 'Le gambit laisse le choix du plan ici',
    planNote:
      'Les deux sont des lignes principales. Ce sont vos options, pas les réponses de l’adversaire.',
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
  outcome: {
    mateHeading: 'Mat forcé en {{moves}}',
    mateForced: 'L’adversaire est mat quelle que soit sa défense.',
    netModelled:
      'Toutes les défenses légales ont été énumérées et réfutées. Voici la ligne où la défense résiste le plus longtemps :',
    netImmediate: 'Il n’y a aucune défense à modéliser : le mat tombe immédiatement.',

    assessmentHeading: 'Où mène cette ligne',
    evaluation: 'Évaluation',
    plan: 'Plan de milieu de partie',

    unexploredHeading: 'Cette branche n’est pas encore cartographiée',
    unexploredBody:
      'La ligne s’arrête ici. Le site n’a encore ni évaluation ni plan pour cette position, et il n’en inventera pas.',

    proved: 'Prouvé par la machine',
    provedNote: 'Le compte et la ligne ci-dessus ont été générés puis rejoués contre le certificat',
    howProved: 'Comment un mat est prouvé',
    judgement: 'Le jugement d’un auteur',
    judgementNote:
      'L’évaluation et le plan ci-dessus sont le jugement d’une personne, vérifié par aucune machine :',
    noClaim: 'Aucune affirmation',
    noClaimNote: 'Personne n’a évalué cette position ; il n’y a donc rien à attribuer ici.',
  },
}

export default fr
