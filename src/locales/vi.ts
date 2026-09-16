/**
 * Vietnamese: the source locale and the fallback (ADR-0006, docs/CONTEXT.md *Annotation*).
 *
 * This file is the shape of the catalogue. `en.ts` and `fr.ts` are typed as subsets of it,
 * so a key that exists here may be missing there — that is the point, because the release
 * strategy ships untranslated strings with a marker rather than blocking on translation —
 * but a key that exists *nowhere* here cannot be referenced at all: `t()` is typed off this
 * object by module augmentation, so a typo is a compile error (`src/i18n/translations.ts`).
 *
 * Two levels, never three. `PartialTranslations` is a hand-written one-level-deep partial
 * rather than a recursive one, and keeping the catalogue flat is what lets it stay that
 * simple and stay readable.
 *
 * Chess notation is never localised (docs/design-system.md §7): there is no key here for a
 * piece *letter*, only for a piece *name*, which is what a screen reader speaks. SAN stays
 * SAN in all three locales.
 */
const vi = {
  skip: {
    toContent: 'Chuyển đến nội dung',
  },
  nav: {
    /** Accessible name of the primary navigation landmark. */
    primary: 'Điều hướng chính',
    menu: 'Trình đơn',
    catalogue: 'Danh mục',
    about: 'Giới thiệu',
    /** Accessible name of the language switcher landmark. */
    language: 'Ngôn ngữ',
  },
  appearance: {
    label: 'Giao diện',
    system: 'Theo hệ thống',
    light: 'Sáng',
    dark: 'Tối',
  },
  footer: {
    source: 'Mã nguồn trên GitHub',
    code: 'Mã nguồn:',
    content: 'Nội dung:',
    openingData: 'Tên khai cuộc và mã ECO lấy từ',
    mateProof: 'Cách chứng minh một thế chiếu hết',
  },
  /**
   * One vocabulary for one idea (docs/design-system.md §3). The inline marker, the
   * sentence that explains it and the sentence shown when a whole bundle fails to load all
   * say the same thing, so a visitor who has met one recognises the others.
   */
  untranslated: {
    marker: 'chưa dịch',
    inVietnamese: 'Hiển thị bằng tiếng Việt.',
    bundleFailed: 'Không tải được bản dịch cho ngôn ngữ này.',
  },
  board: {
    label: 'Bàn cờ',
    emptySquare: 'ô trống',
    whiteKing: 'vua trắng',
    whiteQueen: 'hậu trắng',
    whiteRook: 'xe trắng',
    whiteBishop: 'tượng trắng',
    whiteKnight: 'mã trắng',
    whitePawn: 'tốt trắng',
    blackKing: 'vua đen',
    blackQueen: 'hậu đen',
    blackRook: 'xe đen',
    blackBishop: 'tượng đen',
    blackKnight: 'mã đen',
    blackPawn: 'tốt đen',
  },
  /**
   * The learning surface (#8). Chess notation is never localised, so there is no key here
   * for a SAN move or a move number; what is localised is the prose around them, and the
   * words a screen reader speaks when the position changes.
   *
   * `ply` in a key name is deliberate (docs/CONTEXT.md, *Ply*): navigation steps by one
   * side's single move. Vietnamese "nước" and French "coup" already mean exactly that;
   * English "move" does not, so the English copy says "position" rather than quietly
   * calling a ply a move.
   */
  learn: {
    loading: 'Đang tải thế cờ…',
    navigation: 'Điều hướng trong biến',
    toStart: 'Về đầu biến',
    previousPly: 'Nước trước',
    nextPly: 'Nước sau',
    atStart: 'Đây là đầu biến.',
    atEnd: 'Đây là cuối biến.',
    startingPosition: 'Thế xuất phát',
    after: 'Sau',
    noAnnotation: 'Nước này chưa có giải thích.',
    plyList: 'Các nước trong biến',
    shortcuts: 'Phím tắt bàn phím',
    shortcutsHint:
      'Dùng phím mũi tên trái và phải để đi trong biến, và phím 1–9 để chọn một nước trả lời.',
    branchNotFound: 'Gambit này không có nước sau đây, nên trang hiển thị thế gần nhất:',
    capture: 'ăn quân',
    check: 'chiếu',
    checkmate: 'chiếu hết',

    /**
     * Các nước trả lời của đối thủ (#9). Ký hiệu nước đi không bao giờ được dịch
     * (docs/design-system.md §7); cái được dịch là lời văn quanh nó.
     *
     * `otherReply` và `otherReplies` là hai khoá chứ không phải một, vì tiếng Anh và tiếng
     * Pháp phân biệt số ít với số nhiều, còn `useTranslated` không nhận tham số `count` —
     * và thêm tham số đó vào là việc của #7, không phải của phiếu này.
     */
    branchHeading: 'Những nước đối thủ có thể đi',
    noRepliesModelled: 'Chưa có nước trả lời nào được dựng ở đây.',
    nextGoesHere: 'Nút tiếp theo dẫn đến đây',
    replyQuality: 'Chất lượng nước đi',
    frequency: 'Mức độ thường gặp',
    notStated: 'chưa ghi',
    qualityBest: 'hay nhất',
    qualityGood: 'tốt',
    qualityInaccuracy: 'thiếu chính xác',
    qualityMistake: 'sai lầm',
    qualityBlunder: 'sai lầm nặng',
    frequencyCommon: 'thường gặp',
    frequencyOccasional: 'thỉnh thoảng',
    frequencyRare: 'hiếm gặp',
    judgementNote:
      'Chất lượng và mức độ thường gặp ở đây là nhận định của người viết, không phải thống kê:',
    provedBy: 'Được máy chứng minh, theo chứng chỉ',
    otherReply: 'nước trả lời khác',
    otherReplies: 'nước trả lời khác',
    coveredReplies: 'Câu trả lời trên áp dụng cho đúng những nước sau:',
    dismissedReply: 'nước không được dựng',
    dismissedReplies: 'nước không được dựng',
    maintainerNote:
      'Ghi chú của người bảo trì, giữ nguyên ngôn ngữ đã viết. Đây không phải lời văn viết cho người học.',
    planHeading: 'Gambit cho phép chọn kế hoạch ở đây',
    planNote: 'Cả hai đều là biến chính. Đây là lựa chọn của bạn, không phải nước của đối thủ.',
  },
}

export default vi
