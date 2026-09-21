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
    traps: 'Pièges',
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
    toStart: 'Départ',
    toRoot: 'Le gambit',
    previousPly: 'Coup précédent',
    nextPly: 'Coup suivant',
    atStart: 'C’est la position de départ.',
    atRoot: 'C’est le début de la ligne.',
    atEnd: 'C’est la fin de la ligne.',
    startingPosition: 'Position de départ',
    gambitRoot: 'Début de la ligne',
    preludePly:
      'Ce coup fait partie des coups d’ouverture qui mènent au gambit. L’explication commence au début de la ligne.',
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
  /**
   * Le catalogue (#13). Sept cents entrées, dont aucune n'est encore enseignée en
   * profondeur — la formulation doit donc le dire, et non le laisser deviner.
   *
   * `counts` et `showing` comportent des trous parce que l'ordre des mots diffère d'une
   * langue à l'autre ; une phrase assemblée à partir de fragments n'est juste que dans la
   * langue où elle a été assemblée.
   */
  catalogue: {
    heading: 'Catalogue',
    intro:
      'Tous les gambits dont nous connaissons le nom sont ici. La plupart ne sont que répertoriés : un nom, un code ECO et les coups d’ouverture, sans arbre derrière.',
    coverage: 'Couverture',
    counts: '{{listed}} répertoriés · {{mapped}} cartographiés · {{taught}} enseignés',
    search: 'Rechercher par nom ou code ECO',
    searchHint: 'La saisie sans accents fonctionne aussi.',
    filters: 'Filtrer le catalogue',
    side: 'Camp qui joue le gambit',
    category: 'Type',
    soundness: 'Solidité',
    depth: 'Profondeur',
    any: 'Tous',
    white: 'Blancs',
    black: 'Noirs',
    gambit: 'Gambit',
    trap: 'Piège',
    depthTaught: 'Enseignés en profondeur',
    depthMapped: 'Cartographiés ou mieux',
    depthAll: 'Tout ce qui est répertorié',
    showing: 'Affichage de {{shown}} entrées sur {{total}}',
    loading: 'Chargement du catalogue…',
    nothingHere: 'Aucune entrée ne correspond à ces filtres.',
    nothingTaught:
      'Aucun gambit n’est encore enseigné en profondeur. Le catalogue les répertorie tous, avec leur nom, leur code ECO et leurs coups d’ouverture.',
    showEverything: 'Tout afficher',
    clear: 'Effacer les filtres',
    entriesInFamily: '{{entries}} entrées',
    eco: 'ECO',
  },
  /**
   * Étiquettes de couverture. Le niveau est déduit du contenu lui-même et n'est jamais
   * écrit à la main (docs/CONTEXT.md, invariant 8) : cette étiquette est la page qui parle
   * d'elle-même.
   */
  tier: {
    label: 'Couverture :',
    listed: 'Répertorié',
    mapped: 'Cartographié',
    taught: 'Enseigné',
  },
  /**
   * Étiquettes de solidité, sans euphémisme (docs/design-system.md §7). Un gambit non
   * solide est dit non solide, et sa valeur pratique est expliquée ensuite.
   */
  soundness: {
    label: 'Solidité :',
    sound: 'Solide',
    dubious: 'Douteux',
    unsound: 'Non solide',
  },
  /**
   * Les sections de la page À propos vers lesquelles pointent les deux étiquettes (F14,
   * critère 9). Toute étiquette doit être expliquée quelque part, sinon ce n'est qu'un mot.
   */
  about: {
    tiersHeading: 'Ce que signifient les niveaux de couverture',
    tiersIntro:
      'Le niveau est déduit du contenu lui-même ; personne ne l’attribue. Une entrée ne peut pas se déclarer enseignée en profondeur — seul son contenu peut le dire.',
    tierListed:
      'Répertorié — le nom, le code ECO, le camp, les coups d’ouverture et une étiquette de solidité existent. Il n’y a pas encore d’arbre.',
    tierMapped:
      'Cartographié — un arbre existe et aucune de ses feuilles n’est laissée inexplorée.',
    tierTaught:
      'Enseigné — cartographié, plus une annotation complète en vietnamien, en anglais et en français.',
    soundnessHeading: 'Ce que signifie la solidité',
    soundnessIntro:
      'L’étiquette de solidité est directe. Un gambit non solide est dit non solide, et sa valeur pratique est expliquée ensuite.',
    soundnessSound: 'Solide — il tient face au jeu correct. Le sacrifice est compensé.',
    soundnessDubious:
      'Douteux — avec le meilleur jeu, le défenseur s’en sort mieux, mais les chances pratiques sont réelles et les pièges dangereux.',
    soundnessUnsound:
      'Non solide — réfuté par un jeu correct connu. On l’apprend comme un piège à tendre, et tout autant comme un piège à reconnaître quand il vous est tendu.',
  },
  /** L’état de niveau 0 (F15) : jamais un arbre vide, jamais un spinner, jamais un 404. */
  emptyTree: {
    notTaught: 'Ce gambit n’est pas encore enseigné en profondeur.',
    explain:
      'Ce qui est ici : le nom, le code ECO, le camp, l’étiquette de solidité et les coups d’ouverture. L’arbre — les réponses, les explications et les issues — ne l’est pas. Le répertorier pour que vous sachiez qu’il existe reste plus honnête que faire comme s’il avait été enseigné.',
    definingLine: 'Coups d’ouverture',
    backToCatalogue: 'Retour au catalogue',
    loading: 'Recherche dans le catalogue…',
    unknown:
      'Le catalogue n’a aucune entrée à l’adresse « {{id}} ». Ce lien provient peut-être d’une version antérieure du site.',
  },
  /** La page d’accueil. Elle mène vers la profondeur, jamais vers l’index brut. */
  home: {
    tagline: 'Apprenez les gambits et les pièges d’ouverture sous forme d’arbre de coups.',
    intro:
      'Un gambit est un arbre de coups : vous jouez le vôtre, l’adversaire dispose de quelques réponses, et chacune mène à une issue énoncée clairement. Les mats sont prouvés par la machine, pas affirmés par une personne.',
    startHere: 'Commencer ici',
    nothingTaughtYet:
      'Aucun gambit n’est encore enseigné en profondeur. Le catalogue répertorie tous les noms, codes ECO et lignes d’ouverture, et chaque page dit elle-même où elle en est.',
    browseCatalogue: 'Parcourir tout le catalogue',
    whatTiersMean: 'Ce que signifient les niveaux de couverture',
    tryHeading: 'Essayez quelques coups',
    tryIntro:
      'Jouez un coup sur l’échiquier ci-dessous. La liste se filtre exactement selon les coups joués.',
    undo: 'Annuler',
    reset: 'Réinitialiser',
    boardLoading: 'Chargement de l’arbre d’ouverture…',
    boardUnavailable:
      'Impossible de charger l’arbre d’ouverture pour essayer des coups ici. Le catalogue complet reste disponible.',
    retry: 'Réessayer',
    retrying: 'Nouvelle tentative…',
    playToFilter:
      'Jouez un coup sur l’échiquier pour voir les gambits et pièges qui lui correspondent.',
    matchCount: '{{count}} correspondance(s)',
    noMatch: 'Aucun gambit ni piège ne correspond à ces coups.',
    continueIn: 'Continuer dans : {{name}}',
    movePlayed: 'Coup joué : {{san}}',
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
    mateReached: 'Échec et mat.',

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
