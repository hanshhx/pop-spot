import { describe, expect, it } from 'vitest';

import { coreBounds, mappable, markerBounds, openMappable } from './mappable';
import type { PublicMapMarker } from './mapMarkers';
import { isProvenOutsideSeoul } from './seoulGuard';

/**
 * 지도에 찍을 수 있는 것만 고른다.
 *
 * <p>랜딩은 "지도 한눈에" 라고 말하지만 좌표는 3분의 1 가까이 비어 있다(성수 98곳 중 65곳).
 * 없는 것을 숨기면 지도가 조용히 짧아지고, 방문자는 목록에 있는 팝업이 왜 지도에 없는지 알 수
 * 없다. 그래서 <b>고르되 센다</b> — 화면이 "98곳 중 65곳" 이라고 적을 수 있게 둘 다 돌려준다.
 *
 * <p>{@code (0, 0)} 은 서아프리카 앞바다다. 좌표가 깨진 행이 그리로 모이면 서울 지도는 비고
 * 대서양에 핀이 뭉친다 — 빈 값보다 나쁜 종류의 거짓말이다.
 */
const m = (o: Partial<PublicMapMarker> & { id: number }): PublicMapMarker => ({
  name: `팝업 ${o.id}`,
  location: '서울 성동구',
  latitude: null,
  longitude: null,
  category: null,
  startDate: null,
  endDate: null,
  ...o,
});

describe('mappable', () => {
  it('좌표가 있는 것만 고르고, 전체 개수는 그대로 센다', () => {
    const got = mappable([
      m({ id: 1, latitude: '37.5446', longitude: '127.0559' }),
      m({ id: 2 }),
      m({ id: 3, latitude: '37.5444', longitude: '127.0374' }),
    ]);
    expect(got.shown.map((x) => x.id)).toEqual([1, 3]);
    expect(got.total).toBe(3);
  });

  it('한쪽만 있으면 못 찍는다', () => {
    const got = mappable([m({ id: 1, latitude: '37.5446' })]);
    expect(got.shown).toEqual([]);
    expect(got.total).toBe(1);
  });

  it('공백만 든 문자열은 좌표가 아니다 — Number(" ") 가 0 이라 그냥 두면 통과한다', () => {
    const got = mappable([m({ id: 1, latitude: ' ', longitude: ' ' })]);
    expect(got.shown).toEqual([]);
  });

  it('숫자가 아닌 글자는 거른다', () => {
    expect(mappable([m({ id: 1, latitude: '서울', longitude: '성수' })]).shown).toEqual([]);
  });

  it('빈 목록은 0 중 0 이다', () => {
    expect(mappable([])).toEqual({ shown: [], total: 0 });
  });

  it('원본 순서를 흔들지 않는다 — 부모가 정한 순서를 여기서 다시 정하지 않는다', () => {
    const got = mappable([
      m({ id: 9, latitude: '37.5', longitude: '127.0' }),
      m({ id: 2, latitude: '37.6', longitude: '127.1' }),
    ]);
    expect(got.shown.map((x) => x.id)).toEqual([9, 2]);
  });
});

/**
 * {@link openMappable} — 지도가 실제로 찍는 것과 페이지가 세는 것을 같은 기준으로 묶는다.
 *
 * <p>랜딩 페이지의 {@code filtered} 는 아직 열지 않은 팝업도 남긴다("곧 열리는 팝업" 절이 따로
 * 쓰기 때문이다). 그런데 지도를 그리는 {@code InteractiveMap} 은 받은 마커를 자기 안에서
 * {@code isOpenNow} 로 한 번 더 걸러 지금 열려 있는 것만 핀으로 찍는다. {@code mappable()} 만
 * 쓰면(v2.44 이전 버그의 재발) 서울 안·좌표 있음까지는 통과했지만 아직 시작 전인 팝업이 개수
 * (M)에는 들어가는데 지도에는 찍히지 않는다 — this-week 실측 393(문구) vs 376(핀), seongsu
 * 119 vs 113 으로 갈렸다. {@code openMappable} 은 {@code mappable()} 앞에 같은
 * {@code isOpenNow} 를 먼저 걸어 이 어긋남을 막는다.
 */
describe('openMappable — 서울 안이고 좌표가 있어도 아직 열지 않았으면 shown·total 양쪽에서 뺀다', () => {
  const today = new Date(2026, 7, 24); // 고정된 "오늘" — 실제 kstTodayStart() 는 페이지가 넘긴다.

  it('시작일이 미래인 서울 마커는 좌표가 있어도 shown 과 total 모두에서 빠진다', () => {
    const notYetOpen = m({
      id: 1,
      latitude: '37.5446',
      longitude: '127.0559',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    const got = openMappable([notYetOpen], today);
    expect(got.shown).toEqual([]);
    expect(got.total).toBe(0);
  });

  it('지금 열려 있는 서울 마커는 그대로 shown 과 total 에 남는다', () => {
    const openNow = m({
      id: 2,
      latitude: '37.5446',
      longitude: '127.0559',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    const got = openMappable([openNow], today);
    expect(got.shown.map((x) => x.id)).toEqual([2]);
    expect(got.total).toBe(1);
  });

  it('열린 것과 아직 안 연 것이 섞이면 연 것만 남기고 total 도 그만큼만 센다', () => {
    const openNow = m({
      id: 2,
      latitude: '37.5446',
      longitude: '127.0559',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });
    const notYetOpen = m({
      id: 1,
      latitude: '37.55',
      longitude: '127.05',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    const got = openMappable([openNow, notYetOpen], today);
    expect(got.shown.map((x) => x.id)).toEqual([2]);
    expect(got.total).toBe(1);
  });
});

/**
 * 좌표가 서울 경계 사각형 밖으로 증명된 마커는 지도에서 완전히 빠진다 — shown 뿐 아니라
 * total 에서도.
 *
 * <p>실측: this-week 406곳 중 부산 서면 1건이 사각형의 남쪽·동쪽 끝을 혼자 정해 282x213km 짜리
 * 화면(다음으로 가까운 마커가 위도 234km·경도 170km 떨어져 있다)을 만들었다. 좌표 자체가 잘못은
 * 아니다 — 크롤러가 location 문자열 앞에 "서울" 을 기계적으로 붙일 뿐, 순천·부산·판교처럼 실재하는
 * 지역 팝업이다. 문제는 {@code public/seoul.pmtiles} 가 서울 언저리만 담고 있어 MapLibre 가 그
 * 범위 밖 타일 요청은 아예 하지 않는다는 것 — 화면 밖 핀은 지도 없는 배경색 위에 찍혀 애초에
 * 유의미하게 보여줄 방법이 없다.
 *
 * <p>아래는 {@link isCoordOutsideSeoul} (seoulGuard, {@code SEOUL_BOX} 그대로)만 쓴다 —
 * {@link isProvenOutsideSeoul} 전체를 쓰지 않는다. 판교 8건은 표기로는 서울 밖인데 좌표는
 * 37.51(서울 한복판)로 잘못 지오코딩돼 있어 우리 타일 위에 멀쩡히(다만 엉뚱한 자리에) 찍힌다 —
 * 지도가 물어야 할 질문은 "표기가 맞는가" 가 아니라 "이 점이 우리 타일 위에 있는가" 뿐이다.
 * {@code isProvenOutsideSeoul} 로 바꾸면 판교 8건도 지도에서 사라져, 정말로 못 찍는 것이 아닌데도
 * 빠지게 된다.
 */
describe('mappable — 서울 밖으로 증명된 좌표는 shown 과 total 모두에서 뺀다', () => {
  it('부산 서면(실측 3003)은 shown 과 total 양쪽에서 빠진다', () => {
    const got = mappable([
      m({ id: 3003, latitude: '35.1557085419427', longitude: '129.05846119682' }),
    ]);
    expect(got).toEqual({ shown: [], total: 0 });
  });

  it('순천(실측 1257)도 shown 과 total 양쪽에서 빠진다', () => {
    const got = mappable([
      m({ id: 1257, latitude: '34.94139970471998', longitude: '127.50930110415489' }),
    ]);
    expect(got).toEqual({ shown: [], total: 0 });
  });

  it('스타필드 고양(실측)은 위도 37.7096 이 SEOUL_BOX.maxLat 37.72 보다 작아 사각형 안이라 남는다', () => {
    // seoulGuard.ts 가 이미 밝힌 SEOUL_BOX 의 한계 그대로다: "하남·광명·과천·부천·고양은 이 안에
    // 들어온다." 계산: 37.7095729528467 < 37.72 → 사각형 안. 그래서 이 좌표는 서울이 아닌데도
    // 지도 계산에서는 제외되지 않는다 — 알고 넘어가는 오탐(false negative)이다.
    const got = mappable([
      m({ id: 9001, latitude: '37.7095729528467', longitude: '126.815731305755' }),
    ]);
    expect(got.shown.map((x) => x.id)).toEqual([9001]);
    expect(got.total).toBe(1);
  });

  it('평범한 서울 마커는 그대로 남는다', () => {
    const got = mappable([m({ id: 1, latitude: '37.5447', longitude: '127.0557' })]);
    expect(got.shown.map((x) => x.id)).toEqual([1]);
    expect(got.total).toBe(1);
  });

  it('좌표 없는 서울 팝업은 total 에 남고, 좌표가 부산인 팝업은 total 에서도 빠진다', () => {
    const got = mappable([
      m({ id: 1, latitude: null, longitude: null }), // 좌표 없음 — 서울일 수도 있다, 그냥 못 찍을 뿐
      m({ id: 3003, latitude: '35.1557085419427', longitude: '129.05846119682' }), // 부산 — 서울 밖 증명됨
    ]);
    expect(got.shown).toEqual([]);
    expect(got.total).toBe(1);
  });
});

/**
 * 찍히는 마커가 전부 화면에 들어오도록 사각형(최소/최댓값)을 구한다.
 *
 * <p>예전엔 좌표 평균(중심점) 하나만 지도에 넘겼다 — 지도는 그 중심으로 <b>이동</b>만 하고
 * <b>줌</b>은 고정된 채였다. 성수처럼 좁은 지역은 우연히 다 들어왔지만, this-week 처럼 서울
 * 전역에 흩어진 마커는 중심이 한강 한복판이라 나머지 대부분이 화면 밖이었다 — "488곳 중 406곳
 * 표시" 라고 적어놓고 실제로 보이는 건 9곳뿐이었다.
 *
 * <p>중심 대신 <b>사각형</b>을 돌려준다 — 호출하는 쪽이 지도의 fitBounds 에 그대로 넘기면 지도가
 * 줌까지 알아서 맞춘다.
 */
describe('markerBounds', () => {
  it('여러 마커의 최소·최댓값으로 사각형을 만든다', () => {
    const got = markerBounds([
      m({ id: 1, latitude: '37.50', longitude: '127.00' }),
      m({ id: 2, latitude: '37.60', longitude: '126.90' }),
      m({ id: 3, latitude: '37.55', longitude: '127.10' }),
    ]);
    expect(got).toEqual({ minLat: 37.5, maxLat: 37.6, minLng: 126.9, maxLng: 127.1 });
  });

  it('마커가 하나면 그 좌표가 네 꼭짓점 모두다 — 넓이 0 인 사각형', () => {
    const got = markerBounds([m({ id: 1, latitude: '37.5446', longitude: '127.0559' })]);
    expect(got).toEqual({
      minLat: 37.5446,
      maxLat: 37.5446,
      minLng: 127.0559,
      maxLng: 127.0559,
    });
  });

  it('여러 마커가 같은 좌표를 공유해도 넓이 0 인 사각형을 돌려준다', () => {
    const got = markerBounds([
      m({ id: 1, latitude: '37.50', longitude: '127.00' }),
      m({ id: 2, latitude: '37.50', longitude: '127.00' }),
    ]);
    expect(got).toEqual({ minLat: 37.5, maxLat: 37.5, minLng: 127.0, maxLng: 127.0 });
  });

  it('좌표 없는 마커는 사각형 계산에서 빠진다', () => {
    const got = markerBounds([m({ id: 1 }), m({ id: 2, latitude: '37.50', longitude: '127.00' })]);
    expect(got).toEqual({ minLat: 37.5, maxLat: 37.5, minLng: 127.0, maxLng: 127.0 });
  });

  it('찍을 마커가 하나도 없으면 undefined 다', () => {
    expect(markerBounds([])).toBeUndefined();
    expect(markerBounds([m({ id: 1 })])).toBeUndefined();
  });
});

/**
 * 카메라 사각형 — 부산 팝업 한 건이 서울 지도를 한반도로 넓히던 자리.
 *
 * <p>예전엔 별도 함수 {@code seoulCameraBounds} (seoulGuard.ts) 가 있었는데, 이미 {@link mappable}
 * 이 서울 밖 좌표를 {@code shown} 에서 빼 놓은 뒤라 그 안에서 다시 걸러 봐야 아무것도 바뀌지
 * 않았다 — {@code markerBounds(mappable(...).shown)} 과 완전히 같은 값이면서 순환 참조
 * (seoulGuard → mappable → seoulGuard)까지 만들고 있었다. 그래서 지우고, 실제 서비스 경로
 * ({@code markerBounds(mappable(markers).shown)})를 그대로 실행하는 테스트만 남긴다.
 *
 * <p>입력은 전부 라이브 {@code /api/map/markers} 실측값이다.
 */
const pin = (
  id: number,
  latitude: string,
  longitude: string,
  location: string,
): PublicMapMarker => ({
  id,
  name: `팝업 ${id}`,
  location,
  latitude,
  longitude,
  category: null,
  startDate: null,
  endDate: null,
});

const SEONGSU = pin(1, '37.5446', '127.0559', '서울 성동구 연무장길');
const GANGNAM = pin(2, '37.4979', '127.0276', '서울 강남구 강남대로');
// 실측 3003 — 부산 서면. this-week 사각형의 남쪽 끝과 동쪽 끝을 혼자 정하던 마커.
const BUSAN = pin(3003, '35.1557085419427', '129.05846119682', '서울 서면');

describe('markerBounds(mappable(...).shown) — 서울 밖 마커가 카메라를 넓히지 않는다', () => {
  it('부산 팝업 한 건이 서울 화면을 한반도로 넓히지 않는다', () => {
    const got = markerBounds(mappable([SEONGSU, GANGNAM, BUSAN]).shown);
    expect(got).toEqual({
      minLat: 37.4979,
      maxLat: 37.5446,
      minLng: 127.0276,
      maxLng: 127.0559,
    });
  });

  it('실측 네 극단을 넣어도 사각형은 서울 경계 안이다', () => {
    const got = markerBounds(
      mappable([
        SEONGSU,
        BUSAN,
        pin(3910, '37.41668435615771', '126.68401236414716', '서울 연수구'), // 인천
        pin(3106, '37.267038390760796', '126.96178554756972', '서울 수원시'), // 수원
        pin(1257, '34.94139970471998', '127.50930110415489', '서울 순천시'), // 순천
      ]).shown,
    )!;
    expect(got.minLat).toBeGreaterThanOrEqual(37.4);
    expect(got.maxLat).toBeLessThanOrEqual(37.72);
    expect(got.minLng).toBeGreaterThanOrEqual(126.73);
    expect(got.maxLng).toBeLessThanOrEqual(127.22);
  });

  it('표기만 서울 밖인 것은 사각형을 좁히지 않는다 — 좌표가 서울이면 화면 안에 둔다', () => {
    // 실측 3735 "서울 부산광역시" 는 좌표가 서초 한복판이다. 배지는 붙지만 카메라는 무시하면 안 된다.
    const mislabelled = pin(3735, '37.4846504739722', '127.031724192797', '서울 부산광역시');
    expect(isProvenOutsideSeoul(mislabelled)).toBe(true);
    const got = markerBounds(mappable([SEONGSU, mislabelled]).shown)!;
    expect(got.minLat).toBeLessThanOrEqual(37.4846504739722);
    expect(got.minLng).toBeLessThanOrEqual(127.031724192797);
  });

  it('전부 서울 밖이면 shown 이 비고, total 도 0 이다 — page.tsx 는 이럴 때 지도 섹션 자체를 그린다', () => {
    const outside = [BUSAN, pin(1257, '34.94139970471998', '127.50930110415489', '서울 순천시')];
    const got = mappable(outside);
    expect(got.shown).toEqual([]);
    expect(got.total).toBe(0);
  });
});

/**
 * coreBounds — 극단값 몇 개가 아니라 마커 대다수가 화면에 들어오도록 사각형을 좁힌다.
 *
 * <p>아래 좌표는 전부 실측(라이브 {@code /api/map/markers}, 2026-08-25)이다. 성수 묶음은 실제
 * 슬라이스 파이프라인(classifyRegion → groupSameEvent → openMappable)을 그대로 태운 뒤 중앙값
 * 좌표에 가장 가까운 38곳을 뽑은 것이고, 극단값 두 곳(뉴발란스 덕진점·캐릭터 올스타전)은 같은
 * 파이프라인의 p95 자르기에서 실제로 빠졌던 마커다 — 주소 텍스트에 "성수" 가 섞였을 뿐 중심에서
 * 3~8km 떨어져 있다. this-week 묶음은 열두 개 동네(성수·홍대·강남·잠실·이태원·한남·용산·압구정·
 * 명동·여의도·마포·성북)와 분류 안 되는 곳 하나에서 하나씩 고른 실제 마커에, 실제로 서울 전역에
 * 흩어진(마곡·노원·은평·하남·고양) 마커 열여덟 곳을 더한 것 — this-week 슬라이스가 "성수의
 * 확대판"이 아니라 정말로 도시 전체에 퍼진 슬라이스임을 그대로 보여준다.
 */
describe('coreBounds', () => {
  // 성수 중앙값(37.5426, 127.0549)에서 가장 가까운 38곳. 실측 거리 0.0005~0.0022(도) —
  // 성수 core 가 실제로 1km 안팎이라는 근거다.
  const seongsuCore: PublicMapMarker[] = [
    pin(101, '37.54249211190676', '127.05430588821001', '서울 성동구 성수동'), // 신라면 팝업
    pin(102, '37.54249211190676', '127.05430588821001', '서울 성동구 성수동'), // 신라면 분식 더 팩토리
    pin(103, '37.54249211190676', '127.05430588821001', '서울 성동구 성수동'), // 성수 신라면분식더팩토리
    pin(104, '37.5429652522547', '127.054053896917', '서울 성동구 성수동'), // 성수_오리지널비어컴퍼니 팝업
    pin(105, '37.5425580884382', '127.05580183008381', '서울 성동구 성수동'), // 켄트로얄 케이팝 데몬 헌터스 에디션
    pin(106, '37.54222565019513', '127.05573708490287', '서울 성동구 성수동'), // 러쉬 성수점
    pin(107, '37.54222565019513', '127.05573708490287', '서울 성동구 성수동'), // 러쉬 성수 팝업씨어터
    pin(108, '37.5423129121868', '127.056022296655', '서울 성동구 성수동'), // 이솝
    pin(109, '37.541993970260535', '127.05599716434692', '서울 성동구 성수동'), // 라인프렌즈 스퀘어 성수
    pin(110, '37.5425006030077', '127.053468556449', '서울 성동구 성수동'), // 이토준지 × 산리오캐릭터즈 팝업스토어
    pin(111, '37.5430799454922', '127.053468970191', '서울 성동구 성수동'), // 0 STEP
    pin(112, '37.54243256842165', '127.05639353022181', '서울 성동구 성수동'), // 붕괴:스타레일 전시
    pin(113, '37.54243256842165', '127.05639353022181', '서울 성동구 성수동'), // 조선미녀 무빙 팝업스토어
    pin(114, '37.54243256842165', '127.05639353022181', '서울 성동구 성수동'), // 디올 향수매장 헤트라스
    pin(115, '37.54243256842165', '127.05639353022181', '서울 성동구 성수동'), // 토이스토리X피스마이너스원 팝업
    pin(116, '37.54243256842165', '127.05639353022181', '서울 성동구 성수동'), // EQL 팝업스토어
    pin(117, '37.54243256842165', '127.05639353022181', '서울 성동구 성수동'), // 암행천문: 별을 헤다
    pin(118, '37.54243256842165', '127.05639353022181', '서울 성동구 성수동'), // 무신사 킥스
    pin(119, '37.54243256842165', '127.05639353022181', '서울 성동구 성수동'), // CU 성수디저트파크점
    pin(120, '37.5416147036863', '127.055882596736', '서울 성동구 성수동'), // 쿠에른 썸머 팝업
    pin(121, '37.5411841962511', '127.055521321238', '서울 성동구 성수동'), // 캘빈클라인 성수 팝업스토어
    pin(122, '37.5411841962511', '127.055521321238', '서울 성동구 성수동'), // 캘빈클라인 성수 캐릭터 팝업
    pin(123, '37.5441714976058', '127.054473446127', '서울 성동구 성수동'), // BEAUTY GUARD SHELTER
    pin(124, '37.5441805075889', '127.054473452683', '서울 성동구 성수동'), // 토리든 DEEP DIVE NEWS 팝업 스토어
    pin(125, '37.5441733194254', '127.054430448058', '서울 성동구 성수동'), // 토리든 팝업 26.07.15~12.31
    pin(126, '37.5441733194254', '127.054430448058', '서울 성동구 성수동'), // 토리든 팝업스토어
    pin(127, '37.5441733194254', '127.054430448058', '서울 성동구 성수동'), // AHC 뮤뷰페 in 성수
    pin(128, '37.5420710605128', '127.05682550286', '서울 성동구 성수동'), // 마르디 메크르디 팝업
    pin(129, '37.5420710605128', '127.05682550286', '서울 성동구 성수동'), // 마르디 메크르디 × 권철화 아트 팝업
    pin(130, '37.543647925274925', '127.05658454691944', '서울 성동구 성수동'), // NCT 127 팝업스토어
    pin(131, '37.543647925274925', '127.05658454691944', '서울 성동구 성수동'), // NEO LOST&FOUND CENTER
    pin(132, '37.541485585740105', '127.05646070830274', '서울 성동구 성수동'), // 무신사 스토어 성수
    pin(133, '37.541485585740105', '127.05646070830274', '서울 성동구 성수동'), // 모코코 스트릿 팝업스토어
    pin(134, '37.541485585740105', '127.05646070830274', '서울 성동구 성수동'), // 무신사 성수 치이카와 스시 팝업
    pin(135, '37.5409106700344', '127.05471208612', '서울 성동구 성수동'), // 스트레이 키즈 케넥트 성수
    pin(136, '37.5414251673391', '127.056568157281', '서울 성동구 성수동'), // 로스트아크 x 무신사 모코코 스트릿 팝업
    pin(137, '37.5434155351638', '127.052537942924', '서울 성동구 성수동'), // 더퍼스트팬
    pin(138, '37.5434263542066', '127.052522108793', '서울 성동구 성수동'), // 토이스토리 × 피스마이너스원 팝업스토어
  ];
  // p95 자르기에서 실제로 제외됐던 두 곳 — 주소는 성수지만 중심에서 각각 약 8.1km·4.2km 떨어져
  // 있다.
  const NEWBALANCE = pin(201, '37.5711239967768', '126.959076994031', '서울 성동구 성산로'); // 뉴발란스 덕진점 팝업스토어
  const CHARACTER_ALLSTAR = pin(
    202,
    '37.584280388332715',
    '127.05007927139084',
    '서울 중랑구 성수동',
  ); // 캐릭터 올스타전

  it('밀집한 성수 코어 38곳에 멀리 떨어진 2곳이 섞이면, 사각형은 코어만으로 계산한 것과 같다', () => {
    const got = coreBounds([...seongsuCore, NEWBALANCE, CHARACTER_ALLSTAR]);
    expect(got).toEqual(markerBounds(seongsuCore));
  });

  it('먼 두 곳의 좌표는 잘라낸 사각형 안에 들어오지 않는다', () => {
    const got = coreBounds([...seongsuCore, NEWBALANCE, CHARACTER_ALLSTAR])!;
    for (const far of [NEWBALANCE, CHARACTER_ALLSTAR]) {
      const lat = Number(far.latitude);
      const lng = Number(far.longitude);
      const inside =
        lat >= got.minLat && lat <= got.maxLat && lng >= got.minLng && lng <= got.maxLng;
      expect(inside).toBe(false);
    }
  });

  it('잘라낸 사각형은 원래 사각형(markerBounds)보다 절대 크지 않다', () => {
    const full = [...seongsuCore, NEWBALANCE, CHARACTER_ALLSTAR];
    const trimmed = coreBounds(full)!;
    const untrimmed = markerBounds(full)!;
    expect(trimmed.minLat).toBeGreaterThanOrEqual(untrimmed.minLat);
    expect(trimmed.maxLat).toBeLessThanOrEqual(untrimmed.maxLat);
    expect(trimmed.minLng).toBeGreaterThanOrEqual(untrimmed.minLng);
    expect(trimmed.maxLng).toBeLessThanOrEqual(untrimmed.maxLng);
  });

  // this-week 실측 — 열두 동네 + 분류 안 되는 곳 하나에서 하나씩(중심 근처) + 실제로 서울
  // 전역에 흩어진 열여덟 곳.
  const thisWeekSpread: PublicMapMarker[] = [
    pin(301, '37.5647662214748', '126.98362743468', '서울'), // LG전자 베스트샵
    pin(302, '37.54674310919087', '127.05003943808386', '서울 성동구'), // 더얀 얀카페트 (성수)
    pin(303, '37.5542683641458', '126.92331494603', '서울 마포구'), // 명탐정 코난 추리게임 팝업 (마포)
    pin(304, '37.52878306771425', '126.96363677205855', '서울 용산구'), // 민음사 x 오늘의 귀여움 팝업 (용산)
    pin(305, '37.5369688440826', '127.001588561792', '서울 한남동'), // 조니워커 블루 웍스아웃 팝업 (한남)
    pin(306, '37.5372103115644', '126.998365043311', '서울 이태원동'), // 조니워커 블루 팝업 (이태원)
    pin(307, '37.56869544838762', '127.00769149156201', '서울 여의도동'), // 승리의 여신: 니케 팝업스토어 (여의도)
    pin(308, '37.5510992559773', '126.921489418275', '서울 홍대'), // 구해줘! 탄소0향력 세포마을 (홍대)
    pin(309, '37.4843461041682', '127.105761941483', '서울 강남구'), // ELBATEGEV 팝업스토어 (강남)
    pin(310, '37.51327392775211', '127.09938943376696', '서울 잠실동'), // 오우라링 5 팝업스토어 (잠실)
    pin(311, '37.52737270067088', '127.0274681898568', '서울 압구정동'), // 마이림 플리츠 팝업 (압구정)
    pin(312, '37.55658072049463', '126.98403099725546', '서울 명동'), // 라네즈 팝업스토어 (명동)
    pin(313, '37.58079664277135', '127.00863578989066', '서울 성북구'), // 무신사역 팝업 스토어 (성북)
    pin(314, '37.55867678737794', '126.80278135337612', '서울 김포공항'), // 토이스토리5 굿즈
    pin(315, '37.5693958477101', '126.835037244018', '서울 마곡'), // 코코힐리 만들기
    pin(316, '37.5693958477101', '126.835037244018', '서울 마곡'), // 반다이 펀 엑스포 2026
    pin(317, '37.5693958477101', '126.835037244018', '서울 마곡'), // 라크루뜨 및 베이글리스트 팝업
    pin(318, '37.65888882945633', '127.00902108350806', '서울특별시'), // 더 현대 K리그 x 산리오 팝업스토어
    pin(319, '37.678914078918574', '127.06066041449286', '서울 노원구'), // 롯데백화점 노원점 크리스피크림 도넛 팝업
    pin(320, '37.5693958477101', '126.835037244018', '서울 마곡'), // 케일페 서포터즈 2026 마곡
    pin(321, '37.6501939626763', '127.013131171723', '서울'), // 무민
    pin(322, '37.55911656965196', '126.8028390471799', '서울 제주공항'), // 지브리 도토리숲
    pin(323, '37.7095729528467', '126.815731305755', '서울 고양시 덕양구'), // 스타필드 고양 박뚜기소금빵 팝업
    pin(324, '37.56758745458617', '126.81957246941296', '서울'), // 동물의숲
    pin(325, '37.4801564858275', '127.148416828645', '서울 스타필드 하남'), // 코리아보드게임즈 써머 컬렉션 팝업
    pin(326, '37.6525077125839', '126.94787257335727', '서울 은평구'), // 민음사빵
    pin(327, '37.65888882945633', '127.00902108350806', '서울특별시'), // tamaverde
    pin(328, '37.56110995518217', '126.83097417878128', '서울 강서구 마곡중앙8로 32'), // 헤이팝
    pin(329, '37.55911656965196', '126.8028390471799', '서울 제주국제공항'), // 도토리숲 팝업스토어
    pin(330, '37.4801564858275', '127.148416828645', '서울 하남스타필드'), // 지커 7X 팝업스토어
    pin(331, '37.655010663068154', '127.06144216617906', '서울 노원구'), // 똑순이알탕 팝업스토어
  ];

  it('서울 전역에 흩어진 실측 슬라이스(this-week)는 자른 뒤에도 강남·홍대·잠실이 화면 안에 남는다', () => {
    const got = coreBounds(thisWeekSpread)!;
    const gangnam = thisWeekSpread[8]; // ELBATEGEV 팝업스토어
    const hongdae = thisWeekSpread[7]; // 구해줘! 탄소0향력 세포마을
    const jamsil = thisWeekSpread[9]; // 오우라링 5 팝업스토어
    for (const landmark of [gangnam, hongdae, jamsil]) {
      const lat = Number(landmark.latitude);
      const lng = Number(landmark.longitude);
      expect(lat).toBeGreaterThanOrEqual(got.minLat);
      expect(lat).toBeLessThanOrEqual(got.maxLat);
      expect(lng).toBeGreaterThanOrEqual(got.minLng);
      expect(lng).toBeLessThanOrEqual(got.maxLng);
    }
  });

  it('서울 전역에 흩어진 실측 슬라이스는 자른 뒤에도 도시 규모로 넓다 — 성수 규모로 뭉개지지 않는다', () => {
    const got = coreBounds(thisWeekSpread)!;
    const latSpanKm = (got.maxLat - got.minLat) * 111;
    const lngSpanKm = (got.maxLng - got.minLng) * 111 * Math.cos((got.minLat * Math.PI) / 180);
    // 성수 코어(위 테스트)는 자른 뒤 2km 안팎이다. this-week 는 그보다 한 자릿수 이상 넓어야
    // "성수 규모로 뭉개지지 않았다" 고 말할 수 있다.
    expect(latSpanKm).toBeGreaterThan(10);
    expect(lngSpanKm).toBeGreaterThan(10);
  });

  it('마커가 CORE_MIN_COUNT(20) 보다 적으면 markerBounds 와 완전히 같다 — 3개 중 1개를 버리는 건 3분의 1을 버리는 것이다', () => {
    const few = [
      pin(1, '37.5446', '127.0559', '서울 성동구'), // 성수
      pin(2, '37.5', '127.0', '서울'),
      NEWBALANCE, // 멀리 떨어진 것 하나가 섞여도, 20개 미만이면 자르지 않는다
    ];
    expect(coreBounds(few)).toEqual(markerBounds(few));
  });

  it('마커가 전부 같은 좌표면 markerBounds 처럼 넓이 0 인 사각형을 돌려준다', () => {
    const samePoint = Array.from({ length: 25 }, (_, i) =>
      pin(i + 1, '37.5446', '127.0559', '서울 성동구'),
    );
    expect(coreBounds(samePoint)).toEqual(markerBounds(samePoint));
    expect(coreBounds(samePoint)).toEqual({
      minLat: 37.5446,
      maxLat: 37.5446,
      minLng: 127.0559,
      maxLng: 127.0559,
    });
  });

  it('마커가 하나도 없으면 undefined 다', () => {
    expect(coreBounds([])).toBeUndefined();
  });
});
