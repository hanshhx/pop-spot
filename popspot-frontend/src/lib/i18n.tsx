'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * 화면 문구 다국어 — 서울에 온 외국인이 사이트를 읽을 수 있게 한다.
 *
 * <p>라이브러리를 쓰지 않고 사전 하나로 시작한다. 지금 필요한 것은 <b>홈 화면의 첫 인상</b>뿐이고,
 * 주소 체계(/en · /ja)와 검색 노출은 다음 단계라 그때 구조를 정하는 편이 낫다. 미리 큰 틀을 들이면
 * 아직 정해지지 않은 요구에 맞춰 설계하게 된다.
 *
 * <p><b>팝업 이름·설명은 번역하지 않는다.</b> 크롤링한 한국어 원문이라 기계 번역하면 고유명사가
 * 엉뚱해지고(성수 → Castle Water), 새 팝업마다 비용이 계속 든다. 현지에서 간판·지도 앱과 대조할 때는
 * 오히려 한국어 원문이 쓸모 있다. 대신 <b>지역명은 옮긴다</b>(regions.ts 의 labelEn/labelJa) —
 * 어느 동네인지 모르면 목록 자체가 읽히지 않는다.
 */

export type Locale = 'ko' | 'en' | 'ja';

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
];

const STORAGE_KEY = 'popspot:locale';

/** 사전. 키는 화면 위치를 알 수 있게 짓는다(점 표기). */
const DICT = {
  ko: {
    'nav.map': '지도',
    'nav.browse': '둘러보기',
    'nav.calendar': '캘린더',
    'nav.course': 'AI 코스',
    'hero.title': '서울 팝업스토어를 한 화면에',
    'hero.subtitle': '지도 · 마감임박순 · 카테고리별로. 로그인 없이 무료.',
    'hero.cta': '지도에서 보기',
    'stat.open': '진행 중',
    'stat.today': '오늘 오픈',
    'stat.closing': '마감 임박',
    'section.trending': '지금 뜨는 팝업',
    'section.ranking': '실시간 랭킹',
    'section.region': '지역으로 보기',
    'sort.popular': '인기순',
    'sort.deadline': '마감임박순',
    'sort.latest': '최신순',
    'filter.all': '전체',
    'card.dday': '마감',
    'card.today': '오늘 마감',
    'card.tomorrow': '내일 마감',
    'card.ongoing': '진행 중',
    'common.count': '곳',
    'common.free': '무료 · 로그인 없이',
    'lang.label': '언어',
    'cta.signup': '지금 가입하기',
    'cta.browseMap': '지도에서 둘러보기',
    'tile.congestion': '실시간 혼잡도',
    'tile.congestionSub': '· 지역별 분석',
    'tile.congestionCta': '지역별 보기 →',
    'tile.calendar': '팝업 캘린더',
    'tile.calendarSub': '· 언제 뭐가 열리나',
    'tile.calendarCta': '달력 보기 →',
    'poplook.lead': '지금 서울에서 가장 많이 찾는 팝업,',
    'poplook.sub': '진짜로 붐비는 곳만 골랐어요.',
    'poplook.first': '지금 1위',
    'poplook.rising': '인기 급상승',
    'poplook.loading': '추천할 팝업을 모으는 중이에요.',
    'feedback.title': '의견 보내기',
    'feedback.sub': '· 빠진 팝업, 틀린 정보, 불편한 점',
    'feedback.cta': '보내기 →',
    'chip.all': '전체',
    'chip.thisWeek': '이번 주',
    'chip.closing': '마감임박',
    'chip.crowded': '혼잡',
    'status.open': '영업중',
    'card.styledPhoto': '연출 이미지',
    'trending.desc': '정렬·필터로 원하는 팝업을 골라 사진으로 훑어보세요.',
    'common.viewAll': '전체 보기',
    'ranking.viewAll': '전체 랭킹 보기 →',
    'ranking.empty': '이 조건에 맞는 팝업이 없어요.',
    'chip.today': '오늘 오픈 팝업',
    'chip.weekend': '이번 주말 마감 임박',
  },
  en: {
    'nav.map': 'Map',
    'nav.browse': 'Browse',
    'nav.calendar': 'Calendar',
    'nav.course': 'AI Course',
    'hero.title': 'Every Seoul pop-up store, on one screen',
    'hero.subtitle': 'By map, closing date, or category. Free, no sign-up.',
    'hero.cta': 'Open the map',
    'stat.open': 'Open now',
    'stat.today': 'Opening today',
    'stat.closing': 'Closing soon',
    'section.trending': 'Trending now',
    'section.ranking': 'Live ranking',
    'section.region': 'Browse by area',
    'sort.popular': 'Popular',
    'sort.deadline': 'Closing soon',
    'sort.latest': 'Newest',
    'filter.all': 'All',
    'card.dday': 'left',
    'card.today': 'Closes today',
    'card.tomorrow': 'Closes tomorrow',
    'card.ongoing': 'Open',
    'common.count': '',
    'common.free': 'Free · no sign-up',
    'lang.label': 'Language',
    'cta.signup': 'Sign up',
    'cta.browseMap': 'Explore the map',
    'tile.congestion': 'Live crowd levels',
    'tile.congestionSub': '· by area',
    'tile.congestionCta': 'View by area →',
    'tile.calendar': 'Pop-up calendar',
    'tile.calendarSub': '· what opens when',
    'tile.calendarCta': 'Open calendar →',
    'poplook.lead': 'The most searched pop-ups in Seoul right now,',
    'poplook.sub': 'only the ones actually drawing crowds.',
    'poplook.first': '#1 now',
    'poplook.rising': 'Rising',
    'poplook.loading': 'Gathering recommendations…',
    'feedback.title': 'Send feedback',
    'feedback.sub': '· missing pop-ups, wrong info, anything off',
    'feedback.cta': 'Send →',
    'chip.all': 'All',
    'chip.thisWeek': 'This week',
    'chip.closing': 'Closing soon',
    'chip.crowded': 'Crowded',
    'status.open': 'Open',
    'card.styledPhoto': 'stock photo',
    'trending.desc': 'Sort and filter to find the pop-up you want, then browse by photo.',
    'common.viewAll': 'View all',
    'ranking.viewAll': 'See full ranking →',
    'ranking.empty': 'No pop-ups match this filter.',
    'chip.today': 'Opening today',
    'chip.weekend': 'Closing this weekend',
  },
  ja: {
    'nav.map': 'マップ',
    'nav.browse': '見つける',
    'nav.calendar': 'カレンダー',
    'nav.course': 'AIコース',
    'hero.title': 'ソウルのポップアップを一画面で',
    'hero.subtitle': 'マップ・終了間近・カテゴリ別に。登録不要・無料。',
    'hero.cta': 'マップを見る',
    'stat.open': '開催中',
    'stat.today': '本日オープン',
    'stat.closing': '終了間近',
    'section.trending': '話題のポップアップ',
    'section.ranking': 'リアルタイムランキング',
    'section.region': 'エリアから探す',
    'sort.popular': '人気順',
    'sort.deadline': '終了間近',
    'sort.latest': '新着順',
    'filter.all': 'すべて',
    'card.dday': '残り',
    'card.today': '本日終了',
    'card.tomorrow': '明日終了',
    'card.ongoing': '開催中',
    'common.count': '件',
    'common.free': '無料・登録不要',
    'lang.label': '言語',
    'cta.signup': '新規登録',
    'cta.browseMap': 'マップで見る',
    'tile.congestion': 'リアルタイム混雑度',
    'tile.congestionSub': '· エリア別',
    'tile.congestionCta': 'エリア別に見る →',
    'tile.calendar': 'ポップアップカレンダー',
    'tile.calendarSub': '· いつ何が開催',
    'tile.calendarCta': 'カレンダーを見る →',
    'poplook.lead': 'いまソウルで最も検索されているポップアップ、',
    'poplook.sub': '実際に賑わっている場所だけ。',
    'poplook.first': '現在1位',
    'poplook.rising': '急上昇',
    'poplook.loading': 'おすすめを集めています…',
    'feedback.title': 'ご意見を送る',
    'feedback.sub': '· 抜けているポップアップ、誤った情報など',
    'feedback.cta': '送信 →',
    'chip.all': 'すべて',
    'chip.thisWeek': '今週',
    'chip.closing': '終了間近',
    'chip.crowded': '混雑',
    'status.open': '営業中',
    'card.styledPhoto': 'イメージ写真',
    'trending.desc': '並び替え・絞り込みで気になるポップアップを写真から探せます。',
    'common.viewAll': 'すべて見る',
    'ranking.viewAll': 'ランキングをすべて見る →',
    'ranking.empty': '条件に合うポップアップがありません。',
    'chip.today': '本日オープン',
    'chip.weekend': '今週末に終了',
  },
} as const;

export type MessageKey = keyof (typeof DICT)['ko'];

function isLocale(value: string | null): value is Locale {
  return value === 'ko' || value === 'en' || value === 'ja';
}

/**
 * 브라우저 언어에서 시작 언어를 고른다.
 *
 * <p>일본어·영어 사용자만 바꾸고 <b>나머지는 한국어로 둔다.</b> 서비스가 서울 팝업이라 방문자
 * 대부분이 한국인이고, 어중간하게 영어로 넘기면 정작 주 사용자가 불편해진다.
 */
function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'ko';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of langs) {
    const lang = (raw ?? '').toLowerCase();
    if (lang.startsWith('ko')) return 'ko';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('en')) return 'en';
  }
  return 'ko';
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey) => string;
};

/**
 * 언어 상태는 <b>앱 전체가 하나를 공유해야 한다.</b>
 *
 * <p>처음에는 컨텍스트 없이 훅만 두고 각 컴포넌트가 호출하게 했는데, 훅은 <b>로직을 공유할 뿐 상태를
 * 공유하지 않는다</b> — 호출할 때마다 별도의 useState 가 생긴다. 그래서 홈에서 언어를 바꿔도 랭킹
 * 컴포넌트는 그대로 남아, 화면에 한국어와 일본어가 섞여 나왔다. 타입 검사와 빌드는 모두 통과했고
 * 브라우저에서 실제로 눌러 보고서야 드러났다.
 */
const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * 앱 최상단에 한 번 감싼다.
 *
 * <p>첫 렌더는 항상 'ko' 다 — 서버가 만든 HTML 과 다르면 화면이 깜빡이고 hydration 경고가 뜬다.
 * 브라우저에서 한 번 더 그린 뒤에 저장값·브라우저 언어를 반영한다.
 */
export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  /**
   * 주소가 언어를 정하는 경우({@code /en}, {@code /ja})에 넘긴다.
   *
   * <p>이 값이 있으면 <b>저장값·브라우저 언어를 보지 않는다.</b> 서버가 그 언어로 HTML 을 그려야
   * 검색엔진이 영어·일본어 페이지로 인식하는데, 브라우저에서 뒤늦게 바꾸면 크롤러가 보는 것은 여전히
   * 한국어다. 주소와 화면 언어가 어긋나면 공유된 링크도 엉뚱한 언어로 열린다.
   */
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? 'ko');

  useEffect(() => {
    if (initialLocale) return; // 주소가 언어를 정했다 — 저장값이 이를 덮으면 안 된다.
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setLocaleState(isLocale(saved) ? saved : detectLocale());
  }, [initialLocale]);

  // 스크린리더·검색엔진이 읽는 값이라 화면 언어와 어긋나면 안 된다.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const t = useCallback((key: MessageKey) => DICT[locale][key] ?? DICT.ko[key] ?? key, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * 현재 언어와 번역 함수.
 *
 * <p>Provider 밖에서 부르면 한국어로 동작한다 — 언어 하나 때문에 화면이 통째로 죽는 것보다, 기본
 * 언어로라도 보이는 편이 낫다.
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    locale: 'ko',
    setLocale: () => {},
    t: (key: MessageKey) => DICT.ko[key] ?? key,
  };
}

/** 지역 표시명 — 화면 언어에 맞춰 고른다. */
export function localizedRegionLabel(
  region: { label: string; labelEn: string; labelJa: string },
  locale: Locale,
): string {
  if (locale === 'en') return region.labelEn;
  if (locale === 'ja') return region.labelJa;
  return region.label;
}
