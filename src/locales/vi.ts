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
    shortcutsHint: 'Dùng phím mũi tên trái và phải để đi trong biến.',
    branchNotFound: 'Gambit này không có nước sau đây, nên trang hiển thị thế gần nhất:',
    capture: 'ăn quân',
    check: 'chiếu',
    checkmate: 'chiếu hết',
  },
  /**
   * Progress (#14). A **count**, never a percentage (docs/design-system.md §3): a percentage
   * falls when content improves, and a learner cannot tell an improvement from a regression.
   *
   * `count` is the one string in this catalogue with holes in it, and it has to be: the three
   * languages do not agree on where the total goes — French puts it at the end of the
   * sentence — so a sentence built from fragments would be right in one language only.
   *
   * `learned` is the marker's label and it never changes with the state. The state is
   * `aria-pressed`; a control that changes both says two things at once and a screen reader
   * reads the pair as a contradiction.
   */
  progress: {
    heading: 'Tiến độ',
    count: 'Đã thuộc {{learned}} trên {{total}} nhánh',
    learned: 'Đã thuộc',
    unmarked: 'Đã bỏ đánh dấu nhánh này.',
    undo: 'Hoàn tác',
    atBranchEnd: 'Đi đến cuối một biến để đánh dấu đã thuộc.',
    nothingToMark: 'Gambit này chưa có nhánh nào để đánh dấu.',
    versionDiscarded:
      'Tiến độ đã lưu thuộc một phiên bản cũ của trang nên đã bị xoá. Bạn cần đánh dấu lại.',
  },
  tree: {
    heading: 'Toàn bộ cây biến',
    label: 'Cây biến của gambit',
    show: 'Mở cây biến',
    hide: 'Thu gọn cây biến',
    close: 'Đóng cây biến',
    positions: 'Số thế:',
    lines: 'Số biến:',
    mateIn: 'Chiếu hết sau',
    assessment: 'Đánh giá thế cờ',
    unexplored: 'Chưa dựng',
    transposes: 'Chuyển vị',
    showRefutation: 'Hiện toàn bộ đòn chiếu hết',
    refutation: 'Đòn chiếu hết đã được chứng minh:',
  },
}

export default vi
