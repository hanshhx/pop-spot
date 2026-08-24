/**
 * 좌표로 "서울이 아님이 증명된 것" 만 골라낸다.
 *
 * <p>수집 단계가 location 앞에 "서울" 을 기계적으로 붙인다. 그래서 라이브 965건 중 960건이
 * "서울" 로 시작하는데, 그중 <b>실제로 서울이 아닌 것이 21건(2.2%)</b> 이다. 최악은
 * {@code "서울 경기도 성남시 판교역로146번길 20 현대백화점 판교점 B층"} 처럼 자기모순인 값이다.
 *
 * <p><b>숨기지 않는다.</b> 목록에서 조용히 빼면 "왜 안 뜨지" 가 되고, 그건 이 저장소가 방금
 * 대대적으로 걷어낸 "실패를 데이터 없음으로 위장" 과 같은 짓이다. 대신 <b>표시를 다르게</b> 하고,
 * 기계가 사실로 받아들이는 자리(JSON-LD 주소)에서만 뺀다.
 *
 * <p>근본 수정은 백엔드(수집 단계 판정)다. 여기는 그때까지의 가림막이자, 고친 뒤에도 남겨 둘
 * 마지막 확인선이다.
 */

/**
 * 서울 행정구역을 감싸는 사각형. 실제 4극단(원지동 37.428 · 도봉동 37.715 · 오곡동 126.764 ·
 * 강일동 127.184)에 1.5~3km 여유를 뒀다.
 *
 * <p><b>이 사각형은 "서울이 아님" 을 증명할 뿐, "서울임" 을 증명하지 못한다.</b> 하남·광명·과천·
 * 부천·고양은 이 안에 들어온다. 그래서 여기 걸리는 것은 <b>확실히</b> 서울 밖이고, 안 걸린다고
 * 서울인 것은 아니다 — 판정을 이 함수 하나에 의존하면 안 되는 이유다.
 */
const SEOUL_BOX = { minLat: 37.4, maxLat: 37.72, minLng: 126.73, maxLng: 127.22 };

/**
 * 주소 표기만으로 서울이 아님이 드러나는 형태.
 *
 * <p><b>좌표만으로는 부족하다.</b> 실측에서 "서울 대전신세계" 3건은 좌표가 아예 없고, "서울 판교"
 * 8건은 좌표가 37.51(서울 한복판)로 <b>잘못</b> 지오코딩돼 있다. 지오코더 질의에 팝업 이름이
 * 섞여 들어가 엉뚱한 곳을 문 결과다.
 *
 * <p>반대로 문자열만 보면 <b>건물 이름에 섞인 지명</b>에 걸린다 — "서울 성북구 성북로 108
 * 창원빌딩 3층" 은 진짜 서울이다. 그래서 맨 지명은 보지 않고, 아래 넷만 본다.
 *
 * <ol>
 *   <li>행정 단위가 붙은 것 — 수원<b>시</b> · 성남<b>시</b> · 경기<b>도</b> · 부산<b>광역시</b>
 *   <li>도시 + 백화점 브랜드 — 대<b>전신세계</b> · <b>판교현대백화점</b> (지점 이름 관례)
 *   <li>백화점 브랜드 + 도시 — 스타필드 <b>수원</b>
 *   <li>서울에 같은 이름이 없는 곳 — 제주 · 세종
 * </ol>
 *
 * <p>맨 "부산"·"대구"·"대전" 은 일부러 뺐다. "대구탕골목"·"부산집" 같은 상호가 서울에도 있어서,
 * 걸러 봐야 얻는 것보다 잃는 것이 많다.
 */
const CITY =
  '수원|성남|판교|분당|용인|고양|일산|하남|광명|과천|안양|부천|시흥|파주|남양주|의정부|순천|천안|청주|전주|포항|강릉|춘천|원주|부산|대구|대전|광주|울산|인천|세종|제주';
const STORE = '신세계|현대백화점|롯데백화점|롯데몰|스타필드|AK플라자|갤러리아|타임빌라스|아울렛';

const OUTSIDE_TEXT: RegExp[] = [
  // ① 행정 단위. "시" 뒤에 오는 글자가 '장·청·민' 이면 시장·시청·시민이라 지명이 아니다.
  new RegExp(`(${CITY})\\s*(시(?![장청민])|군(?![데])|구청)`),
  new RegExp(
    '(경기|강원|충청북|충청남|전라북|전라남|경상북|경상남|충북|충남|전북|전남|경북|경남)\\s*도(?![시심장])',
  ),
  new RegExp(`(${CITY})\\s*(광역시|특별자치시|특별자치도)`),
  // ② · ③ 도시 + 백화점 브랜드 (양쪽 순서 모두)
  new RegExp(`(${CITY})\\s*(${STORE})`),
  new RegExp(`(${STORE})\\s*(${CITY})`),
  // ④ 서울에 같은 이름이 없는 곳
  /제주|세종특별/,
];

export type MaybeLocated = {
  latitude?: string | number | null;
  longitude?: string | number | null;
  location?: string | null;
};

/**
 * 좌표만으로 서울 밖임이 드러나는가 — 주소 표기는 보지 않는다.
 *
 * <p>{@link isProvenOutsideSeoul} 의 좌표 절반이다. 배지는 표기까지 봐야 하지만 <b>지도 카메라는
 * 좌표만 봐야 한다</b>: 표기 규칙에 걸리는 것 중에 좌표는 서울 한복판인 것이 섞여 있어서(실측
 * "서울 부산광역시" 가 37.4847/127.0317, "서울 제주공항" 이 37.5591/126.8028) 그것까지 빼면
 * 사각형이 필요 이상으로 좁아져 멀쩡한 핀이 화면 밖으로 밀린다.
 */
export function isCoordOutsideSeoul(m: MaybeLocated): boolean {
  const lat = toNumber(m.latitude);
  const lng = toNumber(m.longitude);
  if (lat === null || lng === null) return false;
  return (
    lat < SEOUL_BOX.minLat ||
    lat > SEOUL_BOX.maxLat ||
    lng < SEOUL_BOX.minLng ||
    lng > SEOUL_BOX.maxLng
  );
}

/**
 * 서울 밖임이 <b>확실한가</b>. 좌표와 주소 표기를 함께 본다.
 *
 * <p>어느 쪽도 증명하지 못하면 false — <b>모르는 것은 밖이 아니다.</b> 이 판정은 목록에서 빼는
 * 데 쓰지 않고 배지를 다는 데 쓰므로, 놓치는 쪽이 잘못 다는 쪽보다 낫다.
 */
export function isProvenOutsideSeoul(m: MaybeLocated): boolean {
  if (isCoordOutsideSeoul(m)) return true;

  const text = m.location ?? '';
  return text !== '' && OUTSIDE_TEXT.some((re) => re.test(text));
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
