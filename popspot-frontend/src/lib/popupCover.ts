/**
 * 팝업 커버 이미지 결정 로직.
 *
 * <p>배경: 백엔드가 (정책상 팝업 본문 사진을 스크랩하지 않으므로) 모든 팝업에 <b>동일한 기본 이미지</b>
 * (Unsplash 나이키 운동화 한 장)를 imageUrl 로 박아 내려준다. 그대로 쓰면 모든 팝업 커버가 똑같아진다.
 *
 * <p>해결: 진짜 사진(그 기본 이미지가 아닌 URL)이면 그대로 쓰고, 없거나 기본 플레이스홀더면
 * <b>카테고리·id 로 결정적 배정한 큐레이션 스톡 사진</b>을 돌려준다. 결과적으로 모든 팝업이 사진을 갖고,
 * 서로 다르며(같은 팝업은 항상 같은 사진), 얼굴이 없고, 카테고리 무드에 맞는다. 미래 수집분도 자동 적용된다.
 *
 * <p>사진 출처: Pexels(License = 상업 무료·출처 불필요). 전부 사람 얼굴이 없는 인테리어/제품/전시 컷으로 큐레이션.
 */

/** Pexels CDN 직접 URL(키 불필요). w 로 크기 조절. */
function px(id: number, w: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
}

/**
 * 카테고리별 큐레이션 커버 풀(사람 얼굴 없음). 각 id 는 실제 로드 확인(HTTP 200)된 값.
 * 팝업 수가 풀보다 많으면 해시 분포로 겹칠 수 있으나, 단일 기본 이미지 대비 충분히 다양하다.
 */
const COVERS: Record<string, number[]> = {
  FASHION: [
    8386651, 5202048, 7679757, 18699670, 31168538, 16470015, 5418892, 38283677,
    38269427, 26292716, 12191199, 11911863, 4903412,
  ],
  FOOD: [
    17057406, 10513887, 6612572, 30948318, 24549022, 18832554, 30915537, 7934522,
    18721982, 29833130, 34746696, 34006322, 34104248, 34839408, 29273043,
  ],
  BEAUTY: [
    32645088, 15096784, 30836145, 30408335, 12969358, 20849460, 4938498, 4938508,
    29229021, 2536009, 3552894, 7712466, 2732197, 14649431,
  ],
  CULTURE: [35719467, 35336001, 26605624, 11489989, 11489991, 15138863, 15138850],
  CHARACTER: [
    311268, 4491702, 4491703, 4491711, 6693300, 6990411, 8289844, 6743161, 1329305,
    5217758, 5217759, 29820833,
  ],
  TECH: [
    3945679, 682933, 9984695, 12743408, 6373212, 32583519, 4267775, 3981749,
    14666036, 6969676, 5208774, 12116184, 6372998,
  ],
  ETC: [8386654, 5531541, 5531709, 1884579, 18699686, 8306359, 8311878, 17293347],
};

/**
 * 백엔드가 모든 팝업에 박아 내려주는 단일 기본 이미지(Unsplash 나이키 운동화).
 * 이 마커가 포함된 URL 은 "진짜 사진"이 아니라고 보고 큐레이션 커버로 교체한다.
 */
const PLACEHOLDER_MARKERS = ["photo-1542291026-7eec264c27ff"];

/** imageUrl 이 그대로 쓸 만한 진짜 사진인가(비어있지 않고, 단일 기본 플레이스홀더가 아니고, http URL). */
function isRealImage(url?: string | null): boolean {
  if (!url) return false;
  const u = url.trim();
  if (!u) return false;
  if (PLACEHOLDER_MARKERS.some((m) => u.includes(m))) return false;
  return /^https?:\/\//.test(u);
}

/** 문자열/숫자 id → 안정적 해시(같은 팝업은 항상 같은 사진). */
function hashId(id: string | number): number {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export interface CoverInput {
  id: string | number;
  category?: string | null;
  imageUrl?: string | null;
}

/**
 * 팝업 커버 이미지 URL. 진짜 사진이면 그대로, 아니면 카테고리·id 로 결정적 배정한 큐레이션 스톡 사진.
 * @param w 요청 이미지 폭(px). 카드 기본 800, 상세 히어로 등 큰 곳은 1200 권장.
 */
export function popupCoverUrl(popup: CoverInput, w = 800): string {
  if (isRealImage(popup.imageUrl)) return popup.imageUrl as string;
  const cat = (popup.category || "ETC").toUpperCase();
  const pool = COVERS[cat]?.length ? COVERS[cat] : COVERS.ETC;
  const id = pool[hashId(popup.id) % pool.length];
  return px(id, w);
}
