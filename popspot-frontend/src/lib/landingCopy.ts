import type { Locale } from './i18n';

/**
 * 검색 랜딩 페이지의 문안 — 언어별로 따로 쓴다.
 *
 * <p>사전(i18n.tsx)에 넣지 않는 이유: 이 페이지는 <b>서버가 빌드 때 만든다.</b> 사전은 브라우저의
 * 언어 상태에 기대는 훅이라 서버에서 읽을 수 없다. 또 여기 문구는 대부분 슬라이스 이름·건수·마감일이
 * 문장 가운데 끼어드는 형태라, 키-값 한 줄로는 어순이 다른 언어를 담지 못한다. 그래서 함수로 둔다.
 *
 * <p><b>번역이 아니라 그 언어의 검색어로 쓴다.</b> "성수 팝업스토어 추천" 을 그대로 옮기면
 * "Seongsu pop-up store recommendation" 이 되는데, 영어권에서 그렇게 검색하는 사람은 없다.
 * 실제 검색 형태는 "pop-up stores in Seongsu" 다.
 */

export type SliceKind =
  | 'region'
  | 'period'
  | 'category'
  | 'brand'
  | 'region-category'
  | 'region-period'
  | 'category-period';

type ByKind<T> = Record<SliceKind, T>;

/** 검색 결과 설명과 추천 카드에 쓰는 한 팝업의 최소 정보. */
export type MetaPick = {
  name: string;
  /** "8/9" 처럼 짧게. 마감일이 없으면 빈 문자열. */
  deadline: string;
  /** "신세계 강남" 처럼 짧게. 없으면 빈 문자열. */
  location: string;
};

/** "지금 고른다면" 카드가 그 팝업을 고른 이유. 이유를 안 적으면 그냥 또 하나의 목록이 된다. */
export type PickReason = 'closing' | 'opened' | 'roomy';

export type LandingCopy = {
  /** 없는 슬러그로 들어왔을 때의 제목. */
  notFound: string;

  /* ── 검색 결과에 뜨는 것 ── */
  titles: ByKind<(label: string) => string>;
  /** 0곳일 때만 쓰는 설명. 건수가 있으면 아래 metaWithCount 를 쓴다. */
  descriptions: ByKind<(label: string) => string>;
  /** 건수·마감일 뒤에 붙는 짧은 꼬리. 이름을 다시 넣지 않는다 — 길이가 잘리면 이쪽이 먼저 날아간다. */
  tails: ByKind<string>;
  /**
   * 건수 문장 — <b>슬라이스 종류를 받는다.</b>
   *
   * <p>하나의 문장으로 다 덮으려다 영어에서 깨졌다. "in Seongsu" 는 장소라 말이 되지만 같은 틀로
   * 카테고리에 쓰면 "296 pop-up stores open in Fashion" 이 된다. 한국어는 이름이 앞에 붙는 구조라
   * 종류와 무관하게 자연스러워서 눈에 띄지 않았다.
   */
  metaWithCount: (label: string, count: number, kind: SliceKind) => string;
  /**
   * 검색 결과 설명 — <b>건수 대신 실제 팝업 이름으로 시작한다.</b>
   *
   * <p>"153곳 진행 중" 은 숫자일 뿐이라 뭐가 있는지 하나도 알려주지 않는다. 실측에서 대상이 특정된
   * 질의는 잘 눌리고("스트릿 레스토랑 파이터 팝업" 40%, "니케 팝업 위치" 15.2%) 두루뭉술한 쪽은
   * 안 눌린다("일정" 계열 1.64%, 7.6배 차이). 10위 안에 드는데 클릭 0인 질의가 295개다 — 순위가
   * 아니라 여기 적힌 말이 문제라는 뜻이다.
   *
   * <p>덤으로 160여 개 랜딩이 낱말 하나만 바뀐 같은 문장을 쓰던 중복도 해소된다.
   */
  metaWithNames: (items: MetaPick[], rest: number) => string;
  metaSoonest: (deadline: string) => string;
  /** 마감일 표기 — 영어권은 월 이름을, 한·일은 7/30 형태를 쓴다. */
  shortDate: (d: Date) => string;
  /** 날짜와 남은 일수를 붙이는 방식 — 영어는 괄호 앞을 띄우고, 한·일은 붙인다. */
  deadlineFormat: (date: string, dday: string) => string;
  /** 제목 안에 건수를 끼워 넣는다. 앞머리 키워드를 건드리지 않는 위치에. */
  withCount: (title: string, count: number) => string;

  /* ── 고를 근거 ── */
  /**
   * "지금 고른다면" — 전체 목록 <b>위에</b> 놓는 세 장.
   *
   * <p>목록을 없애지 않는다. 목록 길이와 상세 전환율의 상관은 -0.15 로 사실상 무관했다(성수 161곳
   * 38.6% vs 흑백요리사 9곳 38.6%). 길이가 아니라 <b>고를 근거가 없는 것</b>이 문제다. 한 장만 보고
   * 나간 322명 중 293명(91%)이 바로 이 화면에서 나갔다.
   */
  pickHeading: string;
  pickReasons: Record<PickReason, string>;
  /** 무엇을 기준으로 골랐는지 밝힌다. 안 밝히면 광고로 읽힌다. */
  pickNote: string;

  /**
   * 같은 행사가 여러 줄로 들어온 것을 묶었을 때의 배지.
   *
   * <p>조용히 줄이면 "왜 빠졌지" 가 되고, 밝히면 "여러 곳에서 확인된 행사" 라는 신뢰 신호가 된다.
   */
  mergedBadge: (sources: number) => string;

  /**
   * 좌표가 서울 밖으로 확인된 팝업에 다는 배지.
   *
   * <p>수집 단계가 주소 앞에 "서울" 을 기계적으로 붙여, 실제로는 대전·판교·수원인 것이 "서울 ○○"
   * 로 저장돼 있다. 목록에서 빼지는 않는다 — 찾아온 사람에게는 그 팝업이 존재한다는 사실 자체가
   * 정보다. 대신 적힌 주소를 그대로 믿지 않게 표시한다.
   */
  outsideSeoulBadge: string;

  /**
   * "지금 고른다면" 카드의 캘린더 담기.
   *
   * <p>주 920명이 오는데 다시 오는 사람은 7명(0.76%)이다. 알림도 구독도 없어 사람을 다시 부르는
   * 장치가 코드에 하나도 없다. 캘린더는 알림을 사용자 폰이 대신 쏘므로 운영 부담이 0 이다.
   */
  calendarCta: string;
  /** 진행 중인 곳이 0곳일 때 대신 보여 주는 것. 빈 화면을 주는 것보다 낫다. */
  altHeading: (label: string) => string;
  altNote: string;

  /* ── 본문 ── */
  h1: ByKind<(label: string, count: number) => string>;
  lead: ByKind<(label: string, refresh: string) => string>;
  urgencyWithDday: (dday: number) => string;
  urgencyPlain: (label: string) => string;
  backHome: string;
  statCount: (count: number) => string;
  statSoonest: string;
  statOpeningToday: string;
  statOpeningTodayValue: (n: number) => string;
  badgeMap: string;
  badgeSorted: string;
  badgeFree: string;
  listHeading: string;
  mapCta: string;
  detailAria: (name: string) => string;
  noLocation: string;
  ddayToday: string;
  ddayTomorrow: string;
  ddayOngoing: string;
  /** 아직 열지 않은 팝업의 배지. 며칠 뒤에 여는지. */
  ddayOpensIn: (days: number) => string;
  /** 곧 열리는 팝업 섹션의 제목. */
  upcomingHeading: string;
  /** 그 섹션의 한 줄 설명. */
  upcomingNote: string;
  todayMark: (md: string) => string;
  feedbackHeading: string;
  feedbackNote: string;
  feedbackCta: string;
  crossSellHeading: string;
  crossSellToday: string;
  crossSellClosing: string;
  crossSellOther: string;
  faqHeading: string;
  faqRefreshQ: string;
  faqRefreshA: (refresh: string) => string;
  faqSliceQ: (label: string) => string;
  faqSliceA: ByKind<string>;
  nowRunning: (count: number) => string;
  closingSoonSuffix: (n: number) => string;
  statRunning: string;
  mapCtaPrimary: (label: string) => string;
  mapCtaSecondary: (label: string) => string;
  freeAutoNote: (refresh: string) => string;
  moreCount: (n: number) => string;
  emptyHeading: (label: string) => string;
  emptyBody: (refresh: string) => string;
  emptyNote: string;
  ddayValue: (dday: number) => string;
  faqWishQ: string;
  faqWishA: (count: number) => string;
};

/* ============================== 한국어 ============================== */

const ko: LandingCopy = {
  nowRunning: (c) => `지금 진행 중 ${c}곳`,
  closingSoonSuffix: (n) => ` · 마감 임박 ${n}곳`,
  statRunning: '진행 중',
  mapCtaPrimary: (l) => `지도에서 ${l} 팝업 위치·마감일 보기 →`,
  mapCtaSecondary: (l) => `지도에서 ${l} 팝업 보기 →`,
  freeAutoNote: (r) => `가입 없이 확인 · ${r} 자동 갱신`,
  moreCount: (n) => `외 ${n}곳 더 — 메인 지도에서 전체 확인`,
  emptyHeading: (l) => `${l} 팝업은 지금 잠시 쉬어가는 중이에요`,
  emptyBody: (r) =>
    `서울 전체는 지금도 열려 있어요. 새 팝업은 ${r}에 자동 수집됩니다 — 지금 진행 중인 팝업부터 지도에서 둘러보세요.`,
  emptyNote: '가입 없이 확인 · 메인에서 위시 등록 가능',
  pickHeading: '지금 고른다면',
  pickReasons: {
    closing: '곧 끝나요',
    opened: '막 시작했어요',
    roomy: '여유 있게 볼 수 있어요',
  },
  pickNote: '마감 임박 · 신규 오픈 · 기간 여유를 기준으로 자동으로 고릅니다.',
  altHeading: (l) => `${l} 팝업은 지금 진행 중인 곳이 없어요`,
  altNote: '대신 지금 열려 있는 곳을 마감 임박순으로 보여드려요.',
  mergedBadge: (n) => `제보 ${n}곳 묶음`,
  outsideSeoulBadge: '서울 밖',
  calendarCta: '캘린더에 담기',
  ddayValue: (d) => (d === 0 ? '오늘' : `D-${d}`),
  notFound: '찾을 수 없음',
  titles: {
    region: (l) => `${l} 팝업스토어 일정·위치`,
    period: (l) => `${l} 서울 팝업스토어 일정`,
    category: (l) => `${l} 팝업스토어`,
    brand: (l) => `${l} 팝업스토어 일정·위치`,
    'region-category': (l) => `${l} 팝업 일정·위치`,
    // label 이 "이번 주 (7/27~8/2) 성수" 순서라 제목이 실제 검색어("이번주 성수 팝업")와 같은 어순이 된다.
    'region-period': (l) => `${l} 팝업스토어`,
    'category-period': (l) => `${l} 팝업스토어`,
  },
  descriptions: {
    region: (l) =>
      `${l} 팝업스토어 위치를 지도에서 한눈에. 진행 중인 팝업의 일정·마감일까지 가입 없이 확인.`,
    period: (l) => `${l} 서울에서 열리는 팝업스토어 목록. 운영 기간, 위치, 종료일까지 정리.`,
    category: (l) => `${l} 관련 팝업스토어 모음. 신상 / 인기 / 마감 임박 한눈에 보기.`,
    brand: (l) =>
      `${l} 팝업스토어 일정과 위치를 지도로 한눈에. 서울에서 진행 중인 ${l} 팝업과 마감일을 가입 없이 확인.`,
    'region-category': (l) =>
      `${l} 팝업스토어를 한눈에. 위치·일정·카테고리별 목록과 마감일을 가입 없이 확인.`,
    'region-period': (l) =>
      `${l}에서 문 여는 팝업스토어 목록. 운영 기간·위치·종료일까지 지도 한 화면에서 확인.`,
    'category-period': (l) =>
      `${l}에 서울에서 문 여는 팝업스토어 목록. 위치·운영 기간·종료일까지 한눈에 확인.`,
  },
  tails: {
    region: '일정·위치·마감일을 지도 한 화면에서 가입 없이 확인.',
    period: '서울 팝업 일정·운영 기간·위치·종료일까지.',
    category: '일정·위치와 신상·인기·마감임박순을 한눈에.',
    brand: '일정과 위치를 지도에서 가입 없이 확인.',
    'region-category': '위치·일정을 지도 한 화면에서 확인.',
    'region-period': '운영 기간·위치·마감일까지 지도에서.',
    'category-period': '위치·운영 기간·마감일까지 한눈에.',
  },
  metaWithCount: (l, c) => `${l} 팝업스토어 ${c}곳 진행 중.`,
  metaWithNames: (items, rest) =>
    `${items
      .map(
        (i) =>
          i.name +
          (i.deadline || i.location
            ? `(${[i.deadline && `~${i.deadline}`, i.location].filter(Boolean).join(' ')})`
            : ''),
      )
      .join(' · ')}${rest > 0 ? ` 외 ${rest}곳` : ''}.`,
  shortDate: (d) => `${d.getMonth() + 1}/${d.getDate()}`,
  deadlineFormat: (date, dday) => `${date}(${dday})`,
  metaSoonest: (d) => ` 가장 빠른 마감 ${d}.`,
  withCount: (title, count) => {
    const KEY = '팝업스토어';
    const i = title.indexOf(KEY);
    if (i < 0) return `${title} ${count}곳`;
    const at = i + KEY.length;
    return `${title.slice(0, at)} ${count}곳${title.slice(at)}`;
  },

  h1: {
    region: (l, c) => `${l} 팝업스토어 ${c}곳`,
    period: (l, c) => `${l} 진행 중인 팝업 ${c}곳`,
    category: (l, c) => `${l} 팝업 ${c}곳`,
    brand: (l, c) => `${l} 팝업스토어 ${c}곳`,
    'region-category': (l, c) => `${l} 팝업스토어 ${c}곳`,
    'region-period': (l, c) => `${l} 팝업 ${c}곳`,
    'category-period': (l, c) => `${l} 팝업 ${c}곳`,
  },
  lead: {
    region: (l, r) =>
      `${l}에서 진행 중인 팝업스토어를 POP-SPOT 이 자동 큐레이션 합니다. 영업 기간이 끝난 팝업은 자동으로 빠지고, 신규 팝업은 ${r} 반영됩니다.`,
    period: (l) =>
      `${l} 서울 곳곳에서 열리는 팝업스토어. 위치 · 카테고리 · 마감일을 지도 한 화면에서 확인.`,
    category: (l) => `${l} 관련 신상 / 인기 팝업스토어. 마감 임박순으로 정렬해 한눈에.`,
    brand: (l) =>
      `${l} 관련 팝업스토어를 POP-SPOT 이 자동 큐레이션. 서울에서 진행 중인 ${l} 팝업의 위치·일정을 한눈에.`,
    'region-category': (l) =>
      `${l} 팝업스토어를 POP-SPOT 이 자동 큐레이션. 해당 지역·카테고리에 맞는 팝업만 모아 위치와 일정을 한눈에.`,
    'region-period': (l) =>
      `${l}에서 여는 팝업스토어를 POP-SPOT 이 자동 큐레이션. 해당 기간에 실제로 문을 여는 팝업만 모아 위치·마감일을 한눈에.`,
    'category-period': (l) =>
      `${l}에 실제로 문을 여는 팝업만 모았습니다. 위치와 운영 기간, 마감일을 한눈에 확인할 수 있습니다.`,
  },
  urgencyWithDday: (d) =>
    `${d === 0 ? '오늘 끝나는 팝업이 있어요' : `가장 빨리 끝나는 곳은 D-${d}`}. 위치·운영 기간·마감일을 가입 없이 지도에서 확인하세요.`,
  urgencyPlain: (l) => `${l} 팝업 위치·운영 기간·마감일을 지도 한 화면에서 가입 없이 확인하세요.`,

  backHome: '메인으로',
  statCount: (c) => `${c}곳`,
  statSoonest: '가장 빠른 마감',
  statOpeningToday: '오늘 오픈',
  statOpeningTodayValue: (n) => `${n}곳`,
  badgeMap: '지도 한눈에',
  badgeSorted: '마감임박순 정렬',
  badgeFree: '가입 없이 확인',
  listHeading: '마감 임박순 팝업',
  mapCta: '지금 열린 팝업 지도에서 보기 →',
  detailAria: (n) => `${n} 상세 보기`,
  noLocation: '위치 정보 없음',
  ddayToday: '오늘 마감',
  ddayTomorrow: '내일 마감',
  ddayOngoing: '진행 중',
  ddayOpensIn: (d) => `${d}일 뒤 오픈`,
  upcomingHeading: '곧 열리는 팝업',
  upcomingNote: '아직 열지 않았습니다. 여는 날 순서입니다.',
  todayMark: (md) => `${md}(오늘)`,
  feedbackHeading: '이 목록에 빠졌거나 틀린 팝업이 있나요?',
  feedbackNote:
    '자동 수집이라 누락·오기가 있을 수 있습니다. 알려 주시면 확인해 반영합니다 — 로그인 없이 보낼 수 있어요.',
  feedbackCta: '의견 보내기',
  crossSellHeading: '이런 팝업도 지금 찾고 있나요?',
  crossSellToday: '오늘 오픈 팝업',
  crossSellClosing: '이번 주말 마감 임박',
  crossSellOther: '다른 팝업 둘러보기',
  faqHeading: '자주 묻는 질문',
  faqRefreshQ: '팝업 정보는 얼마나 자주 갱신되나요?',
  faqRefreshA: (r) =>
    `${r}에 자동 수집합니다. 신규 팝업이 등록되면 BROWSE 와 지도에 즉시 반영됩니다.`,
  // Search Console 에서 실제로 반복된 "팝업 일정"·"팝업 위치" 문장으로 묻는다. 내부 구현 용어인
  // "슬라이스" 는 사용자가 검색하지도, 이해할 필요도 없는 말이다.
  faqSliceQ: (l) => `${l} 팝업스토어 일정과 위치는 어떻게 정리되나요?`,
  faqSliceA: {
    region: '팝업 주소의 동/로 이름을 기준으로 분류합니다. 정확한 위치는 지도에서 확인하세요.',
    period: '팝업의 운영 시작일·종료일을 기준으로 해당 기간 안에 한 번이라도 열리면 포함됩니다.',
    category: '팝업 카테고리 필드의 한글/영문 키워드를 매칭해 분류합니다.',
    brand:
      '팝업 이름에 해당 브랜드/IP 이름이 포함되면 자동으로 모읍니다. 진행 중인 팝업만 표시됩니다.',
    'region-category':
      '팝업 주소로 지역을 가르고, 카테고리 키워드로 한 번 더 거릅니다. 두 조건을 모두 만족해야 포함됩니다.',
    'region-period':
      '팝업 주소로 지역을 가르고, 그중 해당 기간에 실제로 문을 여는 팝업만 남깁니다. 두 조건을 모두 만족해야 포함됩니다.',
    'category-period':
      '팝업의 카테고리를 먼저 확인하고, 그중 해당 기간에 실제로 문을 여는 팝업만 남깁니다. 두 조건을 모두 만족해야 포함됩니다.',
  },
  faqWishQ: '위시 등록은 어디서 하나요?',
  faqWishA: (c) =>
    `메인 지도의 팝업 마커를 누른 뒤 상세 페이지에서 위시 등록할 수 있습니다. 현재 ${c}곳 진행 중.`,
};

/* ============================== English ============================== */

const en: LandingCopy = {
  nowRunning: (c) => `${c} open now`,
  closingSoonSuffix: (n) => ` · ${n} closing soon`,
  statRunning: 'Open now',
  mapCtaPrimary: (l) => `See ${l} pop-ups on the map →`,
  mapCtaSecondary: (l) => `View ${l} pop-ups on the map →`,
  freeAutoNote: (r) => `No sign-up · updated ${r}`,
  moreCount: (n) => `+${n} more — see them all on the map`,
  emptyHeading: (l) => `Nothing running in ${l} right now`,
  emptyBody: (r) =>
    `The rest of Seoul is still open. New pop-ups are collected ${r} — start with what's running now on the map.`,
  emptyNote: 'No sign-up · save from the main map',
  pickHeading: 'If you had to pick',
  pickReasons: {
    closing: 'Ending soon',
    opened: 'Just opened',
    roomy: 'Plenty of time',
  },
  pickNote: 'Picked automatically by closing date, opening date and time left.',
  altHeading: (l) => `No ${l} pop-ups are running right now`,
  altNote: 'Here is what is open today instead, closing soonest first.',
  mergedBadge: (n) => `${n} sources merged`,
  outsideSeoulBadge: 'Outside Seoul',
  calendarCta: 'Add to calendar',
  ddayValue: (d) => (d === 0 ? 'Today' : `${d}d`),
  notFound: 'Not found',
  titles: {
    // 영어권은 "pop-up stores in <place>" 형태로 검색한다. Seoul 을 붙여 어느 도시인지 밝힌다.
    region: (l) => `Pop-up Stores in ${l}, Seoul`,
    period: (l) => `Seoul Pop-up Stores — ${l}`,
    category: (l) => `${l} Pop-up Stores in Seoul`,
    brand: (l) => `${l} Pop-up Store in Seoul — Dates & Location`,
    'region-category': (l) => `${l} Pop-up Stores in Seoul`,
    'region-period': (l) => `Pop-up Stores in Seoul — ${l}`,
    'category-period': (l) => `${l}: Seoul Pop-up Stores`,
  },
  descriptions: {
    region: (l) =>
      `See every pop-up store in ${l}, Seoul on one map, with opening dates and closing days. No sign-up.`,
    period: (l) =>
      `Pop-up stores open in Seoul ${l}. Hours, location and closing dates in one place.`,
    category: (l) =>
      `${l} pop-up stores in Seoul — new, popular and closing soon, all in one view.`,
    brand: (l) =>
      `Dates and location for the ${l} pop-up store in Seoul. Check what's running now and when it closes. No sign-up.`,
    'region-category': (l) =>
      `${l} pop-up stores in Seoul, with location, dates and closing days. No sign-up.`,
    'region-period': (l) =>
      `Pop-up stores open in Seoul ${l}. Hours, location and closing dates on one map.`,
    'category-period': (l) =>
      `${l} pop-up stores in Seoul, with locations, run dates and closing days in one place.`,
  },
  tails: {
    region: 'Location and closing dates on one map, no sign-up.',
    period: 'Hours, location and closing dates at a glance.',
    category: 'Sorted by new, popular and closing soon.',
    brand: 'Dates and location on one map, no sign-up.',
    'region-category': 'Location and dates on one map.',
    'region-period': 'Hours, location and closing dates on the map.',
    'category-period': 'Locations, run dates and closing days at a glance.',
  },
  metaWithCount: (l, c, kind) =>
    kind === 'region' || kind === 'region-period'
      ? `${c} pop-up stores open in ${l}, Seoul.`
      : kind === 'period'
        ? `${c} pop-up stores open in Seoul ${l}.`
        : kind === 'category-period'
          ? `${c} ${l} pop-up stores open in Seoul.`
          : `${c} ${l} pop-up stores open in Seoul.`,
  metaWithNames: (items, rest) =>
    `${items
      .map(
        (i) =>
          i.name +
          (i.deadline || i.location
            ? ` (${[i.deadline && `until ${i.deadline}`, i.location].filter(Boolean).join(', ')})`
            : ''),
      )
      .join(' · ')}${rest > 0 ? ` and ${rest} more` : ''}.`,
  shortDate: (d) =>
    `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}`,
  deadlineFormat: (date, dday) => `${date} (${dday})`,
  metaSoonest: (d) => ` Next to close: ${d}.`,
  withCount: (title, count) => {
    const KEY = 'Pop-up Stores';
    const i = title.indexOf(KEY);
    if (i < 0) return `${title} (${count})`;
    const at = i + KEY.length;
    return `${title.slice(0, at)} (${count})${title.slice(at)}`;
  },

  h1: {
    region: (l, c) => `${c} pop-up stores in ${l}`,
    period: (l, c) => `${c} pop-ups open ${l}`,
    category: (l, c) => `${c} ${l} pop-ups`,
    brand: (l, c) => `${c} ${l} pop-up stores`,
    'region-category': (l, c) => `${c} ${l} pop-up stores`,
    'region-period': (l, c) => `${c} pop-ups — ${l}`,
    'category-period': (l, c) => `${c} ${l} pop-ups in Seoul`,
  },
  lead: {
    region: (l, r) =>
      `POP-SPOT collects the pop-up stores running in ${l} automatically. Anything that has ended drops off on its own, and new openings appear ${r}.`,
    period: (l) =>
      `Pop-up stores opening across Seoul ${l}. Location, category and closing date on one map.`,
    category: (l) => `New and popular ${l} pop-up stores, sorted by what closes first.`,
    brand: (l) =>
      `POP-SPOT collects ${l} pop-up stores automatically. See where the ${l} pop-ups running in Seoul are and when they close.`,
    'region-category': (l) =>
      `${l} pop-up stores, collected automatically — only the ones matching both the area and the category.`,
    'region-period': (l) =>
      `Pop-up stores opening ${l}, collected automatically — only the ones actually open in that window.`,
    'category-period': (l) =>
      `${l} pop-up stores that are actually open in that window, with locations and closing dates in one place.`,
  },
  urgencyWithDday: (d) =>
    `${
      d === 0 ? 'One closes today' : `The next one closes in ${d} day${d === 1 ? '' : 's'}`
    }. Check locations, run dates and closing days on the map — no sign-up.`,
  urgencyPlain: (l) =>
    `Locations, run dates and closing days for ${l} pop-ups, all on one map. No sign-up.`,

  backHome: 'Home',
  statCount: (c) => `${c}`,
  statSoonest: 'Next to close',
  statOpeningToday: 'Opening today',
  statOpeningTodayValue: (n) => `${n}`,
  badgeMap: 'One map',
  badgeSorted: 'Closing first',
  badgeFree: 'No sign-up',
  listHeading: 'Closing soonest',
  mapCta: 'See what’s open on the map →',
  detailAria: (n) => `${n} — details`,
  noLocation: 'No location',
  ddayToday: 'Closes today',
  ddayTomorrow: 'Closes tomorrow',
  ddayOngoing: 'Open',
  ddayOpensIn: (d) => `Opens in ${d}d`,
  upcomingHeading: 'Opening soon',
  upcomingNote: 'Not open yet — sorted by opening day.',
  todayMark: (md) => `${md} (today)`,
  feedbackHeading: 'Something missing or wrong in this list?',
  feedbackNote:
    'Listings are collected automatically, so something may be missing or wrong. Tell us and we’ll check — no sign-up needed.',
  feedbackCta: 'Send feedback',
  crossSellHeading: 'Looking for these too?',
  crossSellToday: 'Opening today',
  crossSellClosing: 'Closing this weekend',
  crossSellOther: 'Browse other pop-ups',
  faqHeading: 'Frequently asked',
  faqRefreshQ: 'How often is this updated?',
  faqRefreshA: (r) =>
    `Collected automatically ${r}. New pop-ups show up in BROWSE and on the map as soon as they land.`,
  faqSliceQ: (l) => `How is ${l} decided?`,
  faqSliceA: {
    region: 'By the neighbourhood name in the pop-up’s address. Check the map for the exact spot.',
    period: 'By run dates — a pop-up is included if it is open at any point in that window.',
    category: 'By matching Korean and English keywords in the pop-up’s category field.',
    brand:
      'A pop-up is collected when its name contains the brand or IP name. Only ones running now are shown.',
    'region-category':
      'The address decides the area, then category keywords filter it again. Both have to match.',
    'region-period':
      'The address decides the area, then only pop-ups actually open in that window are kept. Both have to match.',
    'category-period':
      'The category is checked first, then only pop-ups actually open in that window are kept. Both have to match.',
  },
  faqWishQ: 'Where do I save one?',
  faqWishA: (c) =>
    `Tap a marker on the main map, then save it from the detail page. ${c} running right now.`,
};

/* ============================== 日本語 ============================== */

const ja: LandingCopy = {
  nowRunning: (c) => `開催中 ${c}件`,
  closingSoonSuffix: (n) => ` · 終了間近 ${n}件`,
  statRunning: '開催中',
  mapCtaPrimary: (l) => `${l}のポップアップをマップで見る →`,
  mapCtaSecondary: (l) => `${l}のポップアップをマップで →`,
  freeAutoNote: (r) => `登録不要・${r}に自動更新`,
  moreCount: (n) => `ほか${n}件 — マップですべて見る`,
  emptyHeading: (l) => `${l}のポップアップは現在お休み中です`,
  emptyBody: (r) =>
    `ソウル全体では今も開催中です。新しいポップアップは${r}に自動収集されます — まずは開催中のものをマップでご覧ください。`,
  emptyNote: '登録不要・メインから保存できます',
  pickHeading: '今選ぶなら',
  pickReasons: {
    closing: 'まもなく終了',
    opened: '始まったばかり',
    roomy: 'ゆっくり見られます',
  },
  pickNote: '終了間近・新規オープン・期間の余裕を基準に自動で選びます。',
  altHeading: (l) => `${l}のポップアップは現在開催中のものがありません`,
  altNote: '代わりに、今開催中のものを終了が近い順にご案内します。',
  mergedBadge: (n) => `${n}件の情報をまとめ`,
  outsideSeoulBadge: 'ソウル外',
  calendarCta: 'カレンダーに追加',
  ddayValue: (d) => (d === 0 ? '本日' : `あと${d}日`),
  notFound: '見つかりませんでした',
  titles: {
    region: (l) => `${l}のポップアップストア（ソウル）`,
    period: (l) => `ソウルのポップアップストア — ${l}`,
    category: (l) => `${l}のポップアップストア（ソウル）`,
    brand: (l) => `${l} ポップアップストア（ソウル）— 日程・場所`,
    'region-category': (l) => `${l}のポップアップストア（ソウル）`,
    'region-period': (l) => `ソウルのポップアップストア — ${l}`,
    'category-period': (l) => `ソウルの${l}ポップアップストア`,
  },
  descriptions: {
    region: (l) =>
      `${l}のポップアップストアをマップでまとめて。開催中の日程・終了日まで、登録不要で確認できます。`,
    period: (l) => `${l}にソウルで開催されるポップアップストア一覧。開催期間・場所・終了日まで。`,
    category: (l) => `${l}関連のポップアップストアまとめ。新着・人気・終了間近を一画面で。`,
    brand: (l) =>
      `${l}ポップアップストアの日程と場所をマップで。ソウルで開催中の${l}ポップアップと終了日を登録不要で確認。`,
    'region-category': (l) =>
      `${l}のポップアップストアを一画面で。場所・日程・カテゴリ別、終了日まで登録不要で確認。`,
    'region-period': (l) =>
      `${l}にオープンするポップアップストア一覧。開催期間・場所・終了日までマップ一画面で確認。`,
    'category-period': (l) =>
      `${l}ポップアップストア一覧。場所・開催期間・終了日まで一画面で確認できます。`,
  },
  tails: {
    region: '場所と終了日をマップ一画面で、登録不要で確認。',
    period: '開催期間・場所・終了日まで一目で。',
    category: '新着・人気・終了間近順に整理。',
    brand: '日程と場所をマップで、登録不要で確認。',
    'region-category': '場所と日程をマップ一画面で確認。',
    'region-period': '開催期間・場所・終了日までマップで。',
    'category-period': '場所・開催期間・終了日まで一目で。',
  },
  metaWithCount: (l, c) => `${l}のポップアップストア${c}件が開催中。`,
  metaWithNames: (items, rest) =>
    `${items
      .map(
        (i) =>
          i.name +
          (i.deadline || i.location
            ? `（${[i.deadline && `${i.deadline}まで`, i.location].filter(Boolean).join(' ')}）`
            : ''),
      )
      .join(' · ')}${rest > 0 ? `ほか${rest}件` : ''}。`,
  shortDate: (d) => `${d.getMonth() + 1}/${d.getDate()}`,
  deadlineFormat: (date, dday) => `${date}（${dday}）`,
  metaSoonest: (d) => ` 最短の終了は${d}。`,
  withCount: (title, count) => {
    const KEY = 'ポップアップストア';
    const i = title.indexOf(KEY);
    if (i < 0) return `${title} ${count}件`;
    const at = i + KEY.length;
    return `${title.slice(0, at)}${count}件${title.slice(at)}`;
  },

  h1: {
    // 숫자와 단위(件)가 줄 끝에서 갈라지지 않도록 둘 사이를 붙인다.
    region: (l, c) => `${l}のポップアップストア ${c}\u00a0件`,
    period: (l, c) => `${l}に開催中のポップアップ ${c}\u00a0件`,
    category: (l, c) => `${l}のポップアップ ${c}\u00a0件`,
    brand: (l, c) => `${l} ポップアップストア ${c}\u00a0件`,
    'region-category': (l, c) => `${l}のポップアップストア ${c}\u00a0件`,
    'region-period': (l, c) => `${l}のポップアップ ${c}\u00a0件`,
    'category-period': (l, c) => `${l}ポップアップ ${c}\u00a0件`,
  },
  lead: {
    region: (l, r) =>
      `${l}で開催中のポップアップストアを POP-SPOT が自動でまとめています。終了したものは自動で外れ、新しいポップアップは${r}反映されます。`,
    period: (l) =>
      `${l}にソウル各所で開かれるポップアップストア。場所・カテゴリ・終了日をマップ一画面で。`,
    category: (l) => `${l}関連の新着・人気ポップアップストア。終了間近順に並べて一目で。`,
    brand: (l) =>
      `${l}関連のポップアップストアを POP-SPOT が自動でまとめています。ソウルで開催中の${l}ポップアップの場所と日程を一目で。`,
    'region-category': (l) =>
      `${l}のポップアップストアを POP-SPOT が自動でまとめています。エリアとカテゴリの両方に合うものだけを集めました。`,
    'region-period': (l) =>
      `${l}にオープンするポップアップストアを POP-SPOT が自動でまとめています。その期間に実際に開くものだけを集めました。`,
    'category-period': (l) =>
      `${l}ポップアップのうち、その期間に実際に開くものだけをまとめました。場所・開催期間・終了日を一目で確認できます。`,
  },
  urgencyWithDday: (d) =>
    `${d === 0 ? '本日終了するものがあります' : `最短で終了するのはあと${d}日`}。場所・開催期間・終了日を、登録不要でマップからご確認ください。`,
  urgencyPlain: (l) => `${l}ポップアップの場所・開催期間・終了日をマップ一画面で。登録不要です。`,

  backHome: 'ホームへ',
  statCount: (c) => `${c}件`,
  statSoonest: '最短の終了',
  statOpeningToday: '本日オープン',
  statOpeningTodayValue: (n) => `${n}件`,
  badgeMap: 'マップで一目',
  badgeSorted: '終了間近順',
  badgeFree: '登録不要',
  listHeading: '終了間近のポップアップ',
  mapCta: '開催中のポップアップをマップで見る →',
  detailAria: (n) => `${n} の詳細`,
  noLocation: '場所情報なし',
  ddayToday: '本日終了',
  ddayTomorrow: '明日終了',
  ddayOngoing: '開催中',
  ddayOpensIn: (d) => `あと${d}日で開始`,
  upcomingHeading: 'まもなく開催',
  upcomingNote: 'まだ開いていません。開始日順です。',
  todayMark: (md) => `${md}（本日）`,
  feedbackHeading: 'この一覧に漏れや誤りがありますか？',
  feedbackNote:
    '自動収集のため、漏れや誤りがある場合があります。お知らせいただければ確認して反映します — 登録不要で送れます。',
  feedbackCta: 'ご意見を送る',
  crossSellHeading: 'こちらもお探しですか？',
  crossSellToday: '本日オープン',
  crossSellClosing: '今週末に終了間近',
  crossSellOther: '他のポップアップを見る',
  faqHeading: 'よくある質問',
  faqRefreshQ: '情報はどのくらいの頻度で更新されますか？',
  faqRefreshA: (r) =>
    `${r}に自動収集しています。新しいポップアップが登録されると BROWSE とマップにすぐ反映されます。`,
  faqSliceQ: (l) => `${l}はどう分類されていますか？`,
  faqSliceA: {
    region: 'ポップアップの住所にある町名で分類しています。正確な位置はマップでご確認ください。',
    period: '開催の開始日・終了日を基準に、その期間に一度でも開くものを含めています。',
    category: 'カテゴリ欄の韓国語・英語キーワードを照合して分類しています。',
    brand:
      'ポップアップ名にそのブランド／IP名が含まれると自動で集まります。開催中のものだけを表示します。',
    'region-category':
      '住所でエリアを分け、さらにカテゴリのキーワードで絞ります。両方に合うものだけが含まれます。',
    'region-period':
      '住所でエリアを分け、その中でその期間に実際に開くものだけを残します。両方に合うものだけが含まれます。',
    'category-period':
      'カテゴリを確認し、その中でその期間に実際に開くものだけを残します。両方に合うものだけが含まれます。',
  },
  faqWishQ: '保存はどこからできますか？',
  faqWishA: (c) =>
    `メインマップのマーカーを押して、詳細ページから保存できます。現在${c}件が開催中です。`,
};

export const LANDING_COPY: Record<Locale, LandingCopy> = { ko, en, ja };
