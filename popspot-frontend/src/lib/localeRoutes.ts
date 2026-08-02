import type { Metadata } from 'next';
import type { Locale } from './i18n';

/**
 * 언어별 주소와 검색엔진 연결(hreflang).
 *
 * <p>한 주소에서 화면 언어만 바꾸면 검색엔진은 영어·일본어 페이지가 있다는 사실을 <b>알 수 없다.</b>
 * 크롤러가 받는 HTML 은 한국어 한 벌뿐이기 때문이다. 언어마다 주소를 따로 두고, 서로를 가리키게
 * 선언해야 "같은 내용의 다른 언어 판" 으로 인식된다.
 *
 * <p>한국어를 {@code /ko} 가 아니라 루트({@code /})에 두는 이유: 이미 244개 페이지와 사이트맵·검색
 * 색인이 루트 기준으로 쌓여 있다. 주소를 옮기면 그동안의 색인을 스스로 버리는 셈이다.
 */

export const SITE_URL = 'https://popspot.co.kr';

/** 언어 → 주소. 한국어만 루트다. */
export const LOCALE_PATH: Record<Locale, string> = {
  ko: '/',
  en: '/en',
  ja: '/ja',
};

/** hreflang 에 쓰는 지역 포함 코드. 검색엔진은 언어만이 아니라 지역까지 본다. */
const HREFLANG: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en',
  ja: 'ja-JP',
};

/**
 * 언어별 대체 주소 선언.
 *
 * <p>{@code x-default} 는 "어느 언어에도 해당하지 않는 방문자에게 보여줄 판" 이다. 한국어 루트를
 * 지정한다 — 서울 팝업 서비스라 기본값이 한국어인 편이 자연스럽고, 지정하지 않으면 검색엔진이
 * 임의로 고른다.
 */
export function localeAlternates(locale: Locale): Metadata['alternates'] {
  return {
    canonical: `${SITE_URL}${LOCALE_PATH[locale]}`.replace(/\/$/, '') || SITE_URL,
    languages: {
      [HREFLANG.ko]: SITE_URL,
      [HREFLANG.en]: `${SITE_URL}${LOCALE_PATH.en}`,
      [HREFLANG.ja]: `${SITE_URL}${LOCALE_PATH.ja}`,
      'x-default': SITE_URL,
    },
  };
}

/**
 * 검색 랜딩 페이지({@code /popups/<slug>})의 언어별 대체 주소.
 *
 * <p>슬러그는 세 언어가 <b>같은 값을 쓴다.</b> 주소까지 언어별로 번역하면(seongsu → ソンス) 이미
 * 색인된 한국어 주소와 짝이 맞지 않고, 같은 곳을 가리키는 문서인지 검색엔진이 알 수 없다.
 */
export function slugAlternates(slug: string, locale: Locale): Metadata['alternates'] {
  const at = (l: Locale) => `${SITE_URL}${l === 'ko' ? '' : LOCALE_PATH[l]}/popups/${slug}`;
  return {
    canonical: at(locale),
    languages: {
      [HREFLANG.ko]: at('ko'),
      [HREFLANG.en]: at('en'),
      [HREFLANG.ja]: at('ja'),
      'x-default': at('ko'),
    },
  };
}

/** 검색 결과에 뜨는 제목·설명. 번역이 아니라 그 언어 사용자가 실제로 검색할 말로 쓴다. */
export const LOCALE_META: Record<Locale, { title: string; description: string }> = {
  ko: {
    title: '서울 팝업스토어 일정·지도 | 오늘·이번주 여는 팝업 한눈에',
    description:
      '서울 팝업스토어 일정·위치를 지도 한 장에. 오늘·이번 주·주말 여는 성수·홍대·강남 팝업과 마감 임박까지 무료로 한눈에.',
  },
  en: {
    // "pop-up store" 는 영어권에서 이 형태로 검색한다. Seoul 을 앞에 두어 지역을 명확히 한다.
    title: 'Seoul Pop-up Stores — Map, Dates & What’s Open Today',
    description:
      'Find pop-up stores in Seoul on one map. See what’s open today, this week and closing soon in Seongsu, Hongdae, Gangnam and more. Free, no sign-up.',
  },
  ja: {
    // 일본어권은 "ポップアップストア" 와 "ソウル" 조합으로 검색한다.
    title: 'ソウルのポップアップストア — マップ・開催日程・本日オープン',
    description:
      'ソウルのポップアップストアをマップでまとめて。本日・今週・週末オープン、終了間近まで。ソンス・ホンデ・カンナムなどエリア別に無料で確認できます。',
  },
};
