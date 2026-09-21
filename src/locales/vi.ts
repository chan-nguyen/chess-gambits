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
    traps: 'Bẫy',
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
    /**
     * Two separate destinations since #70, and the labels have to keep them apart. Before it
     * the walk began at the gambit root and "về đầu biến" was the only start there was; now
     * the initial position is a real board on the same page, so one control names each.
     *
     * Both are short on purpose, and it is a layout constraint rather than taste. The
     * navigator is one row at every width including 360px (`MoveNavigator.css`), and a fourth
     * control takes the share of each from ~104px to ~60px — at which "Revenir à la position
     * de départ" wrapped onto five lines and pushed the controls 15px below a 640px fold,
     * breaking the one rule §1 will not bend. Measured, in French, by
     * `e2e/move-navigation.spec.ts`.
     */
    toStart: 'Đầu ván',
    toRoot: 'Đầu biến',
    previousPly: 'Nước trước',
    nextPly: 'Nước sau',
    atStart: 'Đây là thế xuất phát.',
    atRoot: 'Đây là đầu biến.',
    atEnd: 'Đây là cuối biến.',
    startingPosition: 'Thế xuất phát',
    gambitRoot: 'Đầu biến',
    preludePly: 'Nước này thuộc loạt nước mở đầu dẫn tới gambit. Phần giảng bắt đầu từ đầu biến.',
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
  /**
   * Danh mục (#13). Một nghìn lẻ ba mục, trong đó hôm nay chưa mục nào được dạy sâu — nên lời văn
   * ở đây phải nói đúng điều đó thay vì để người đọc tự suy ra.
   *
   * `counts` và `showing` có chỗ trống vì trật tự từ không giống nhau giữa ba thứ tiếng;
   * một câu ghép từ nhiều mảnh chỉ đúng trong thứ tiếng đã ghép ra nó.
   */
  catalogue: {
    heading: 'Danh mục',
    intro:
      'Mọi gambit chúng tôi biết tên đều có ở đây. Phần lớn mới chỉ được liệt kê: có tên, mã ECO và nước đi mở đầu, chưa có cây biến.',
    coverage: 'Mức độ bao phủ',
    counts: '{{listed}} đã liệt kê · {{mapped}} đã dựng cây · {{taught}} đã dạy sâu',
    search: 'Tìm theo tên hoặc mã ECO',
    searchHint: 'Gõ không dấu vẫn tìm được.',
    filters: 'Lọc danh mục',
    side: 'Bên chơi gambit',
    category: 'Loại',
    soundness: 'Độ vững',
    depth: 'Độ sâu',
    any: 'Tất cả',
    white: 'Trắng',
    black: 'Đen',
    gambit: 'Gambit',
    trap: 'Bẫy',
    depthTaught: 'Đã dạy sâu',
    depthMapped: 'Đã dựng cây trở lên',
    depthAll: 'Tất cả mục đã liệt kê',
    showing: 'Đang hiện {{shown}} trong {{total}} mục',
    loading: 'Đang tải danh mục…',
    nothingHere: 'Không có mục nào khớp với bộ lọc này.',
    nothingTaught:
      'Chưa có gambit nào được dạy sâu. Danh mục vẫn liệt kê đầy đủ, kèm tên, mã ECO và nước đi mở đầu.',
    showEverything: 'Hiện tất cả mục đã liệt kê',
    clear: 'Xoá bộ lọc',
    entriesInFamily: '{{entries}} mục',
    eco: 'ECO',
  },
  /**
   * Nhãn mức độ bao phủ. Mức độ được suy ra từ chính nội dung, không ai tự viết
   * (docs/CONTEXT.md, bất biến 8), nên nhãn này là lời trang nói về chính nó.
   */
  tier: {
    label: 'Mức độ bao phủ:',
    listed: 'Mới liệt kê',
    mapped: 'Đã dựng cây',
    taught: 'Đã dạy sâu',
  },
  /**
   * Nhãn độ vững, nói thẳng (docs/design-system.md §7). Một gambit không vững thì gọi là
   * không vững, rồi mới giải thích giá trị thực chiến của nó — ở trang Giới thiệu.
   */
  soundness: {
    label: 'Độ vững:',
    sound: 'Vững',
    dubious: 'Đáng ngờ',
    unsound: 'Không vững',
  },
  /**
   * Trang Giới thiệu, phần mà `TierBadge` và `SoundnessBadge` trỏ tới (F14, tiêu chí 9).
   * Nhãn nào cũng phải giải thích được ở đâu đó, nếu không thì nó chỉ là một từ.
   */
  about: {
    tiersHeading: 'Các mức độ bao phủ',
    tiersIntro:
      'Mức độ được suy ra từ chính nội dung, không ai tự gán. Một mục không thể tự nhận là đã dạy sâu; chỉ có nội dung của nó mới nói lên điều đó.',
    tierListed:
      'Mới liệt kê — có tên, mã ECO, bên chơi, nước đi mở đầu và nhãn độ vững. Chưa có cây biến.',
    tierMapped: 'Đã dựng cây — cây biến đã có và không còn nhánh nào bỏ ngỏ.',
    tierTaught: 'Đã dạy sâu — đã dựng cây, và có chú giải đủ cả tiếng Việt, tiếng Anh, tiếng Pháp.',
    soundnessHeading: 'Độ vững nghĩa là gì',
    soundnessIntro:
      'Nhãn độ vững nói thẳng. Một gambit không vững thì gọi là không vững, rồi mới nói tới giá trị thực chiến của nó.',
    soundnessSound: 'Vững — trụ được trước cách chơi đúng. Phần vật chất thí ra có đền bù.',
    soundnessDubious:
      'Đáng ngờ — nếu bên kia chơi đúng nhất thì họ hơn, nhưng cơ hội thực chiến là có thật và các cạm bẫy vẫn nguy hiểm.',
    soundnessUnsound:
      'Không vững — đã bị bác bỏ bằng cách chơi đúng đã biết. Học nó như một cái bẫy để giăng, và cũng để nhận ra khi bị giăng lại.',
  },
  /** Trạng thái Tier 0 (F15): không bao giờ là cây rỗng, vòng quay chờ hay 404. */
  emptyTree: {
    notTaught: 'Gambit này chưa được dạy sâu.',
    explain:
      'Ở đây có tên, mã ECO, bên chơi, nhãn độ vững và nước đi mở đầu. Cây biến — các nước trả lời, lời giải thích và kết cục — thì chưa có. Liệt kê đầy đủ để bạn biết gambit này tồn tại vẫn thật hơn là giả vờ rằng nó đã được dạy.',
    definingLine: 'Nước đi mở đầu',
    backToCatalogue: 'Về danh mục',
    loading: 'Đang tra danh mục…',
    unknown:
      'Danh mục không có mục nào mang địa chỉ “{{id}}”. Liên kết này có thể đến từ một phiên bản cũ của trang.',
  },
  /** Trang chủ. Dẫn vào chiều sâu, không dẫn thẳng vào danh mục thô. */
  home: {
    tagline: 'Học gambit và bẫy khai cuộc như một cây biến.',
    intro:
      'Mỗi gambit là một cây nước đi: bạn đi nước của mình, đối thủ có vài cách trả lời, và mỗi cách dẫn tới một kết cục được nói rõ. Thế chiếu hết thì do máy chứng minh, không phải do người khẳng định.',
    startHere: 'Bắt đầu ở đây',
    nothingTaughtYet:
      'Chưa có gambit nào được dạy sâu. Danh mục đã liệt kê đầy đủ tên, mã ECO và nước đi mở đầu, và mỗi trang đều tự nói rõ nó đang ở mức nào.',
    browseCatalogue: 'Xem danh mục đầy đủ',
    whatTiersMean: 'Các mức độ bao phủ nghĩa là gì',
    /**
     * The interactive opening board. As of #131, any legal move can be played — a real
     * `chess.js` instance runs in the browser (`src/components/home/chess-engine.ts`),
     * reversing #129's catalogue-only restriction by product decision. `Board` itself is
     * still untouched (ADR-0003, amended for #131).
     */
    tryHeading: 'Thử đi vài nước',
    tryIntro:
      'Đi thử một nước trên bàn cờ dưới đây — đi tự do, miễn là đúng luật. Danh sách sẽ tự lọc theo đúng những nước bạn đã đi.',
    undo: 'Đi lại',
    reset: 'Về đầu',
    playToFilter: 'Đi một nước trên bàn cờ để xem danh sách các gambit và bẫy khớp với nước đó.',
    matchCount: 'Khớp {{count}} mục',
    noMatch: 'Không có gambit/trap nào tìm thấy.',
    continueIn: 'Học tiếp: {{name}}',
    movePlayed: 'Đã đi {{san}}',
    checkmate: 'Chiếu hết.',
    stalemate: 'Hết nước đi, hoà cờ.',
    draw: 'Hoà cờ.',
    choosePromotion: 'Chọn quân để phong cấp',
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
  /**
   * Một lá cây và điều nó khẳng định (#11). Ba hình dạng của `Outcome`, và **hai loại
   * nguồn gốc**: một thế chiếu hết do máy chứng minh, và một đánh giá do người viết nhận
   * định. Hai thứ đó không cùng loại khẳng định và không bao giờ được trông giống nhau
   * (docs/CONTEXT.md, *Provenance*).
   *
   * Không có khoá nào ngoài nhóm chiếu hết được phép chứa chữ "chiếu hết": một thế cờ chỉ
   * đang thắng thì không phải là chiếu hết (docs/design-system.md §7), và
   * `outcome-distinction.test.ts` đọc chính ba cuốn từ điển này để kiểm.
   */
  outcome: {
    mateHeading: 'Chiếu hết bắt buộc sau {{moves}} nước',
    mateForced: 'Đối thủ bị chiếu hết dù chống đỡ cách nào.',
    netModelled:
      'Mọi nước chống đỡ hợp lệ đều đã được liệt kê và bác bỏ. Đây là biến đối thủ cầm cự lâu nhất:',
    netImmediate: 'Không có nước chống đỡ nào để dựng: chiếu hết đến ngay.',
    /**
     * The board's own accessible flag once the reader has stepped all the way to the final
     * position (#121) — a standalone sentence, not a reuse of `learn.checkmate`. That key is
     * a word fragment built to sit inside a live-region sentence ("Nd5#, chiếu hết"); read
     * alone as a badge it would be a noun with no verb, which is not what this states.
     */
    mateReached: 'Chiếu hết.',

    assessmentHeading: 'Biến này dẫn đến đâu',
    evaluation: 'Đánh giá',
    plan: 'Kế hoạch trung cuộc',

    unexploredHeading: 'Nhánh này chưa được dựng',
    unexploredBody:
      'Biến dừng ở đây. Trang chưa có đánh giá hay kế hoạch cho thế cờ này, và sẽ không đoán.',

    proved: 'Máy chứng minh',
    provedNote: 'Số nước và biến ở trên do máy sinh ra rồi kiểm lại bằng chứng chỉ',
    howProved: 'Cách chứng minh một thế chiếu hết',
    judgement: 'Nhận định của người viết',
    judgementNote: 'Đánh giá và kế hoạch ở trên là nhận định của một người, không máy nào kiểm:',
    noClaim: 'Chưa khẳng định gì',
    noClaimNote: 'Chưa ai đánh giá thế cờ này, nên ở đây không có gì để quy cho ai.',
  },
}

export default vi
