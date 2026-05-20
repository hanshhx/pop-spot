/**
 * 환경변수 단일 진입점.
 *
 * <p>중앙에서 한 번만 읽고 형 검사 + 폴백 + 사용 가능 여부 플래그를 노출한다.
 * 호출부에서 {@code process.env.NEXT_PUBLIC_X!} non-null assertion 을 쓰는 패턴
 * (런타임에서야 깨지는 패턴) 을 모두 이 모듈로 우회시킨다.
 *
 * <p>주의:
 * <ul>
 *   <li>Next 는 빌드시 {@code NEXT_PUBLIC_*} 만 인라인 치환한다. 동적 키 접근(예:
 *       {@code process.env[name]}) 은 치환되지 않으므로 키 이름은 반드시 리터럴로 적는다.</li>
 *   <li>서버 전용 변수가 필요하면 prefix 없이 추가하고 클라이언트 export 에서 제외한다.</li>
 * </ul>
 */

const LOCAL_API_FALLBACK = 'http://localhost:8080';

/** 빈 문자열을 undefined 로 정규화 (".env 에 KEY= 만 있는 경우" 대비). */
const trim = (v: string | undefined): string | undefined => {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
};

const API_URL = trim(process.env.NEXT_PUBLIC_API_URL);
const SOCKET_URL = trim(process.env.NEXT_PUBLIC_SOCKET_URL);
const KAKAO_MAP_KEY = trim(process.env.NEXT_PUBLIC_KAKAO_MAP_KEY);
const ALGOLIA_APP_ID = trim(process.env.NEXT_PUBLIC_ALGOLIA_APP_ID);
const ALGOLIA_SEARCH_KEY = trim(process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY);

/**
 * Algolia App ID 는 영문 대문자 + 숫자, 길이 6 이상.
 * 잘못된 더미값이 들어와도 클라이언트 초기화 자체를 막아 런타임 폭발을 피한다.
 */
const isAlgoliaValid =
  !!ALGOLIA_APP_ID &&
  !!ALGOLIA_SEARCH_KEY &&
  ALGOLIA_APP_ID.length >= 6 &&
  ALGOLIA_SEARCH_KEY.length >= 10 &&
  /^[A-Z0-9]+$/.test(ALGOLIA_APP_ID);

export const env = {
  /** API base URL — 미지정시 로컬 8080 폴백. */
  apiUrl: API_URL ?? LOCAL_API_FALLBACK,
  /** WebSocket base URL — SOCKET_URL → API_URL → 로컬 순. */
  socketUrl: SOCKET_URL ?? API_URL ?? LOCAL_API_FALLBACK,
  /** Kakao Map JS SDK key — 부재시 빈 문자열 (지도 미초기화). */
  kakaoMapKey: KAKAO_MAP_KEY ?? '',
  /** Algolia: 검증 통과시에만 값 반환, 아니면 null (호출부에서 fallback UI). */
  algolia: isAlgoliaValid
    ? { appId: ALGOLIA_APP_ID!, searchKey: ALGOLIA_SEARCH_KEY! }
    : null,
} as const;

export type Env = typeof env;
