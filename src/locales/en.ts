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
  learn: {
    loading: 'Loading the position…',
    navigation: 'Navigate this line',
    toStart: 'Back to the start',
    previousPly: 'Previous position',
    nextPly: 'Next position',
    atStart: 'This is the start of the line.',
    atEnd: 'This is the end of the line.',
    startingPosition: 'Starting position',
    after: 'After',
    noAnnotation: 'This move has no explanation yet.',
    plyList: 'Moves in this line',
    shortcuts: 'Keyboard shortcuts',
    shortcutsHint:
      'Use the left and right arrow keys to move through the line, and 1 to 9 to pick a reply.',
    branchNotFound: 'This gambit has no such move, so the nearest position is shown:',
    capture: 'capture',
    check: 'check',
    checkmate: 'checkmate',
    branchHeading: 'Replies you have to be ready for',
    noRepliesModelled: 'No reply is modelled here yet.',
    nextGoesHere: 'Next goes here',
    replyQuality: 'Reply quality',
    frequency: 'Frequency',
    notStated: 'not stated',
    qualityBest: 'best',
    qualityGood: 'good',
    qualityInaccuracy: 'inaccuracy',
    qualityMistake: 'mistake',
    qualityBlunder: 'blunder',
    frequencyCommon: 'common',
    frequencyOccasional: 'occasional',
    frequencyRare: 'rare',
    judgementNote: 'Reply quality and frequency here are one person’s judgement, not statistics:',
    provedBy: 'Machine-proved, against certificate',
    otherReply: 'other reply',
    otherReplies: 'other replies',
    coveredReplies: 'That answer covers exactly these replies:',
    dismissedReply: 'reply is not modelled',
    dismissedReplies: 'replies are not modelled',
    maintainerNote:
      'A maintainer’s note, in the language it was written in. It was not written for a reader.',
    planHeading: 'The gambit offers a choice of plans here',
    planNote: 'Both are main lines. These are your options, not the opponent’s replies.',
  },
  progress: {
    heading: 'Progress',
    count: '{{learned}} of {{total}} branches learned',
    learned: 'Learned',
    unmarked: 'This branch is no longer marked learned.',
    undo: 'Undo',
    atBranchEnd: 'Go to the end of a line to mark it learned.',
    nothingToMark: 'This gambit has no branches to mark yet.',
    versionDiscarded:
      'Your saved progress came from an older version of this site, so it was discarded. You will need to mark your branches again.',
  },
  /**
   * The catalogue (#13). Seven hundred entries, none of them taught in depth today — so
   * the wording here has to say that rather than leave a reader to work it out.
   *
   * `counts` and `showing` have holes in them because word order is not the same in the
   * three languages; a sentence glued together from fragments is only ever right in the
   * language it was glued together in.
   */
  catalogue: {
    heading: 'Catalogue',
    intro:
      'Every gambit we know the name of is here. Most of them are only listed: a name, an ECO code and the opening moves, with no tree behind them yet.',
    coverage: 'Coverage',
    counts: '{{listed}} listed · {{mapped}} mapped · {{taught}} taught',
    search: 'Search by name or ECO code',
    searchHint: 'Typing without diacritics still matches.',
    filters: 'Filter the catalogue',
    side: 'Side playing the gambit',
    category: 'Kind',
    soundness: 'Soundness',
    depth: 'Depth',
    any: 'Any',
    white: 'White',
    black: 'Black',
    gambit: 'Gambit',
    trap: 'Trap',
    depthTaught: 'Taught in depth',
    depthMapped: 'Mapped or better',
    depthAll: 'Everything listed',
    showing: 'Showing {{shown}} of {{total}} entries',
    loading: 'Loading the catalogue…',
    nothingHere: 'No entry matches these filters.',
    nothingTaught:
      'No gambit is taught in depth yet. The catalogue still lists every one of them, with its name, ECO code and opening moves.',
    showEverything: 'Show everything listed',
    clear: 'Clear the filters',
    entriesInFamily: '{{entries}} entries',
    eco: 'ECO',
  },
  /**
   * Coverage-tier labels. The tier is derived from the content itself and never written by
   * hand (docs/CONTEXT.md, invariant 8), so this label is the page describing itself.
   */
  tier: {
    label: 'Coverage:',
    listed: 'Listed',
    mapped: 'Mapped',
    taught: 'Taught',
  },
  /**
   * Soundness labels, stated without euphemism (docs/design-system.md §7). An unsound
   * gambit is called unsound, and its practical value is then explained — on the About page.
   */
  soundness: {
    label: 'Soundness:',
    sound: 'Sound',
    dubious: 'Dubious',
    unsound: 'Unsound',
  },
  /**
   * The About page sections the two badges link to (F14, AC 9). Every label has to be
   * explained somewhere, or it is just a word.
   */
  about: {
    tiersHeading: 'What the coverage tiers mean',
    tiersIntro:
      'A tier is derived from the content itself; nobody assigns one. An entry cannot claim to be taught in depth — only its content can say so.',
    tierListed:
      'Listed — a name, an ECO code, the side, the opening moves and a soundness label exist. There is no tree yet.',
    tierMapped: 'Mapped — a tree exists and no leaf of it is left unexplored.',
    tierTaught: 'Taught — mapped, plus complete annotation in Vietnamese, English and French.',
    soundnessHeading: 'What soundness means',
    soundnessIntro:
      'The soundness label is blunt. An unsound gambit is called unsound, and its practical value is explained afterwards.',
    soundnessSound: 'Sound — it holds up against correct play. The sacrifice is compensated.',
    soundnessDubious:
      'Dubious — with best play the defender comes out ahead, but the practical chances are real and the traps are dangerous.',
    soundnessUnsound:
      'Unsound — refuted by known correct play. Learned as a trap to spring, and equally as one to recognise when it is sprung on you.',
  },
  /** The Tier 0 state (F15): never an empty tree, never a spinner, never a 404. */
  emptyTree: {
    notTaught: 'This gambit is not taught in depth yet.',
    explain:
      'What is here is the name, the ECO code, the side, the soundness label and the opening moves. The tree — the replies, the explanations and the outcomes — is not. Listing it so you know it exists is still more honest than pretending it has been taught.',
    definingLine: 'Opening moves',
    backToCatalogue: 'Back to the catalogue',
    loading: 'Looking this up in the catalogue…',
    unknown:
      'The catalogue has no entry at the address “{{id}}”. This link may be from an older version of the site.',
  },
  /** The home page. It leads into depth, never straight into the raw index. */
  home: {
    tagline: 'Learn gambits and opening traps as a branching move tree.',
    intro:
      'A gambit is a tree of moves: you play yours, your opponent has a handful of replies, and each one leads to an outcome that is spelled out. Checkmates are proved by machine, not asserted by a person.',
    startHere: 'Start here',
    nothingTaughtYet:
      'No gambit is taught in depth yet. The catalogue lists every name, ECO code and opening line, and each page says for itself where it stands.',
    browseCatalogue: 'Browse the full catalogue',
    whatTiersMean: 'What the coverage tiers mean',
  },
  tree: {
    heading: 'The whole gambit',
    label: 'Gambit tree',
    show: 'Show the tree',
    hide: 'Hide the tree',
    close: 'Close the tree',
    positions: 'Positions:',
    lines: 'Lines:',
    mateIn: 'Mate in',
    assessment: 'Assessment',
    unexplored: 'Not yet mapped',
    transposes: 'Transposes',
    showRefutation: 'Show the full refutation',
    refutation: 'The proved refutation:',
  },
  outcome: {
    mateHeading: 'Forced mate in {{moves}}',
    mateForced: 'The opponent is checkmated however they defend.',
    netModelled:
      'Every legal defence was enumerated and refuted. This is the line the defence holds out longest in:',
    netImmediate: 'There is no defence to model: the mate is delivered at once.',

    assessmentHeading: 'Where this line leaves you',
    evaluation: 'Evaluation',
    plan: 'Middlegame plan',

    unexploredHeading: 'This branch is not mapped yet',
    unexploredBody:
      'The line stops here. This site has no evaluation and no plan for this position yet, and it will not guess one.',

    proved: 'Machine-proved',
    provedNote: 'The count and the line above were generated and replayed against certificate',
    howProved: 'How a mate is proved',
    judgement: 'One author’s judgement',
    judgementNote:
      'The evaluation and the plan above are one person’s judgement, checked by no machine:',
    noClaim: 'Nothing claimed',
    noClaimNote: 'Nobody has assessed this position, so there is nothing here to attribute.',
  },
}

export default en
