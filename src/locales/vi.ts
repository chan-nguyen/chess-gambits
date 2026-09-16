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
}

export default vi
