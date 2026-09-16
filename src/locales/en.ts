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
