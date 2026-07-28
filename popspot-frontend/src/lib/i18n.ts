'use client';

import { useCallback, useEffect, useState } from 'react';

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

/**
 * 현재 언어와 번역 함수.
 *
 * <p>첫 렌더는 항상 'ko' 다 — 서버가 만든 HTML 과 다르면 화면이 깜빡이고 콘솔에 hydration 경고가
 * 뜬다. 브라우저에서 한 번 더 그린 뒤에 저장값·브라우저 언어를 반영한다.
 */
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>('ko');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setLocaleState(isLocale(saved) ? saved : detectLocale());
  }, []);

  // 스크린리더·검색엔진이 읽는 값이라 화면 언어와 어긋나면 안 된다.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const t = useCallback((key: MessageKey) => DICT[locale][key] ?? DICT.ko[key] ?? key, [locale]);

  return { locale, setLocale, t };
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
