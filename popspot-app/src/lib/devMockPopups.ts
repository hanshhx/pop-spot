import type { PopupStore } from '@/types/popup';

/**
 * 백엔드가 없을 때 화면을 채우는 목업 — 시안({@code 팝스팟 앱.dc.html})의 28곳을 그대로 옮긴 것.
 *
 * <p>웹의 {@code lib/devMockPopups.ts} 와 같은 자리다. 다른 점은 <b>언제 쓰이느냐</b>다. 웹은
 * {@code NODE_ENV === 'development'} 에서만 쓰지만, 앱은 요청이 실패했을 때도 이걸로 그린다 —
 * 지하철에서 켜는 앱이라 연결이 끊기는 일이 화면을 비워 두기엔 너무 흔하다.
 *
 * <p><b>대신 부르는 쪽이 출처를 안다.</b> {@code usePopups} 가 {@code source} 를 함께 돌려주므로,
 * 목업이 실서비스에서 진짜 팝업인 척하지 않게 만들 수 있다. 여기 있는 곳들은 <b>실재하지 않는다</b> —
 * 이 저장소가 {@code isOpenNow} 주석에 적어 둔 것처럼, 찾아갔는데 없는 경험은 되돌릴 수 없다.
 *
 * <p>사진은 Pexels(상업 무료·출처 불필요). 웹 목업과 같은 방식이다.
 */

/** Pexels CDN 직접 URL(키 불필요). */
const px = (id: number, w = 800) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

/** 시안의 {@code IMG_POOL} — 사진 12장을 28곳이 돌려 쓴다. */
const IMG_POOL = [
  15306470, 19599222, 3965545, 2529157, 291762, 934070, 2983101, 1267320, 6205791, 1884581,
  1005638, 3277808,
];

/**
 * 지역별 대표 좌표.
 *
 * <p><b>지어낸 값이다.</b> 목업에는 주소가 동네 이름뿐이라 정확한 좌표가 없고, 그렇다고 비워 두면
 * 지도와 최단 동선 플래너를 개발 중에 아예 못 본다. 각 동네의 중심 근처에 흩어 두되, 이 좌표로
 * 길찾기를 실행해도 <b>실재하는 가게로 안내되지 않도록</b> 일부러 번지 수준의 정밀도를 주지 않는다.
 */
const REGION_CENTER: Record<string, [number, number]> = {
  seongsu: [37.5445, 127.0557],
  hannam: [37.5346, 127.0016],
  apgujeong: [37.5271, 127.0286],
  hongdae: [37.5563, 126.9236],
  jamsil: [37.5133, 127.1],
  myeongdong: [37.5636, 126.9827],
  other: [37.53, 126.96],
};

/** [이름, 보조명, 분야, 지역, 주소, 남은 일수, 조회, 사진] — 시안의 {@code POPALL} 그대로. */
const SEEDS: [string, string, string, string, string, number, number, number][] = [
  ['무드살롱 성수', 'MOOD SALON', 'FASHION', 'seongsu', '성수동2가', 3, 2410, 0],
  ['라임어니언 팝업', 'LIME ONION', 'FOOD', 'seongsu', '성수동1가', 7, 1980, 7],
  ['스튜디오 오프닝', 'STUDIO OPENING', 'CULTURE', 'seongsu', '서울숲2길', 0, 860, 2],
  ['브릭 캐릭터 하우스', 'BRICK CHARACTER', 'CHARACTER', 'seongsu', '연무장길', 14, 3120, 3],
  ['글라스 뷰티바', 'GLASS BEAUTY BAR', 'BEAUTY', 'seongsu', '성수이로', 5, 1540, 5],
  ['아카이브 셀렉트', 'ARCHIVE SELECT', 'FASHION', 'seongsu', '성수동2가', 2, 2760, 1],
  ['한남 코트룸', 'COAT ROOM', 'FASHION', 'hannam', '한남동', 9, 1120, 4],
  ['이태원 스파이스랩', 'SPICE LAB', 'FOOD', 'hannam', '이태원로', 4, 980, 8],
  ['청담 실버라인', 'SILVER LINE', 'FASHION', 'apgujeong', '청담동', 21, 1660, 0],
  ['압구정 포토살롱', 'PHOTO SALON', 'CULTURE', 'apgujeong', '압구정로', 6, 740, 11],
  ['연남 도넛클럽', 'DONUT CLUB', 'FOOD', 'hongdae', '연남동', 1, 3410, 6],
  ['홍대 사운드박스', 'SOUND BOX', 'TECH', 'hongdae', '와우산로', 12, 620, 9],
  ['잠실 미니어처랜드', 'MINIATURE LAND', 'CHARACTER', 'jamsil', '잠실동', 30, 2210, 3],
  ['송파 그린마켓', 'GREEN MARKET', 'FOOD', 'jamsil', '석촌호수로', 8, 540, 10],
  ['명동 스킨스튜디오', 'SKIN STUDIO', 'BEAUTY', 'myeongdong', '명동길', 3, 1290, 5],
  ['을지로 프린트룸', 'PRINT ROOM', 'CULTURE', 'myeongdong', '을지로3가', 11, 470, 2],
  ['성수 백 아카이브', 'BAG ARCHIVE', 'FASHION', 'seongsu', '성수동1가', 16, 1830, 9],
  ['서울숲 플랜트바', 'PLANT BAR', 'FOOD', 'seongsu', '뚝섬로', 0, 390, 7],
  ['한남 젤라토랩', 'GELATO LAB', 'FOOD', 'hannam', '한남대로', 5, 1470, 8],
  ['논현 가구쇼룸', 'FURNITURE SHOWROOM', 'CULTURE', 'other', '논현동', 19, 310, 11],
  ['성수 러너스클럽', 'RUNNERS CLUB', 'FASHION', 'seongsu', '성수동2가', 2, 2050, 4],
  ['문래 메탈샵', 'METAL SHOP', 'CULTURE', 'other', '문래동', 24, 260, 2],
  ['연남 캣카페 팝업', 'CAT CAFE', 'CHARACTER', 'hongdae', '연남동', 7, 1720, 3],
  ['청담 향수연구소', 'PERFUME LAB', 'BEAUTY', 'apgujeong', '청담동', 13, 1350, 5],
  ['성수 커피로스터', 'COFFEE ROASTER', 'FOOD', 'seongsu', '성수동1가', 4, 2380, 6],
  ['여의도 테크바', 'TECH BAR', 'TECH', 'other', '여의도동', 10, 410, 9],
  ['홍대 빈티지위크', 'VINTAGE WEEK', 'FASHION', 'hongdae', '홍익로', 1, 2900, 1],
  ['잠실 캔디스토어', 'CANDY STORE', 'FOOD', 'jamsil', '올림픽로', 6, 1140, 10],
];

/** {@code Date} → {@code yyyy-MM-dd}. {@code parseDate} 가 읽는 모양. */
function iso(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function shift(from: Date, days: number): Date {
  const next = new Date(from.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * 좌표를 지역 중심에서 조금씩 흩는다.
 *
 * <p>인덱스로만 계산해서 <b>같은 목업이 늘 같은 자리에</b> 온다. 난수를 쓰면 앱을 다시 켤 때마다
 * 핀이 움직여서, 지도를 고치는 중에 무엇이 내 코드 탓인지 알 수 없게 된다.
 */
function scatter(region: string, index: number): [string, string] {
  const [lat, lng] = REGION_CENTER[region] ?? REGION_CENTER.other;
  return [
    (lat + ((index % 5) - 2) * 0.0016).toFixed(6),
    (lng + ((Math.floor(index / 5) % 5) - 2) * 0.0021).toFixed(6),
  ];
}

/**
 * 목업 팝업 28곳.
 *
 * <p>날짜는 <b>부르는 시점 기준</b>으로 만든다. 고정 날짜를 박아 두면 며칠만 지나도 전부 '종료' 가
 * 되어, 마감 배지·오늘 오픈·마감임박 필터를 개발 중에 확인할 수 없다.
 *
 * <p>시안의 {@code dday:0} 은 "오늘 오픈" 을 뜻했는데, 같은 칸을 {@code D-0}(오늘 마감)으로도 쓰고
 * 있어 앞뒤가 맞지 않았다. 여기서는 웹의 {@code popupBadge} 규칙에 맞춰 갈랐다 — 0 은 오늘 <b>시작</b>
 * 하는 곳으로 두고, 나머지는 남은 일수만큼 뒤에 끝나는 곳으로 둔다. 배지 판정은 웹과 같은 함수가 한다.
 */
export function devMockPopups(now: Date = new Date()): PopupStore[] {
  return SEEDS.map(([name, brand, category, region, area, daysLeft, viewCount, img], i) => {
    const opensToday = daysLeft === 0;
    const [latitude, longitude] = scatter(region, i);
    return {
      id: 90_000 + i,
      name,
      nameEn: brand,
      location: `서울 ${area}`,
      status: 'ONGOING',
      viewCount,
      category,
      latitude,
      longitude,
      startDate: iso(opensToday ? now : shift(now, -10)),
      endDate: iso(shift(now, opensToday ? 20 : daysLeft)),
      imageUrl: px(IMG_POOL[img]),
      photoOrigin: 'PEXELS',
      photoSourceUrl: `https://www.pexels.com/photo/${IMG_POOL[img]}/`,
    } satisfies PopupStore;
  });
}
