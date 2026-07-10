import type { PopupStore } from "@/types/popup";

/**
 * [redesign/test 전용] 백엔드가 없을 때(로컬 개발) 재설계 홈을 채우는 개발용 목업.
 *
 * <p>카테고리별 무료 스톡 커버(LoremFlickr — 카테고리 키워드 매칭 + popup 고정 seed)로 "각각 다른 팝업 사진"을
 * 로컬에서 즉시 시연한다. 실제 배포에선 백엔드가 준 imageUrl(관리자 등록 사진 또는 Pexels 커버)이 그대로 들어가고,
 * 이 파일은 {@code process.env.NODE_ENV === "development"} 에서만 쓰이므로 프로덕션 번들 동작에는 영향이 없다.
 *
 * <p>LoremFlickr 는 Flickr CC 이미지라 상용 배포엔 부적합 — 어디까지나 로컬 미리보기용이다. 정식 커버는 백엔드
 * Pexels(무료·상업 OK·출처 불필요)로 채운다.
 */

const cover = (seed: number, keywords: string) =>
  `https://loremflickr.com/440/560/${keywords}?lock=${seed}`;

interface Seed {
  name: string;
  location: string;
  category: string;
  keywords: string;
  daysLeft: number;
}

// keywords 는 사물·인테리어 중심(사람/얼굴 최소화). LoremFlickr 는 얼굴 필터가 없어 키워드로 회피한다.
const SEEDS: Seed[] = [
  { name: "마뗑킴 성수 팝업스토어", location: "서울 성동구 성수동", category: "FASHION", keywords: "handbag,boutique", daysLeft: 3 },
  { name: "산리오 캐릭터즈 팝업", location: "서울 송파구 잠실", category: "CHARACTER", keywords: "plush,toy", daysLeft: 0 },
  { name: "탬버린즈 한남 플래그십", location: "서울 용산구 한남동", category: "BEAUTY", keywords: "perfume,bottle", daysLeft: 12 },
  { name: "런던베이글뮤지엄 팝업", location: "서울 종로구 익선동", category: "FOOD", keywords: "bagel,bakery", daysLeft: 1 },
  { name: "젠틀몬스터 하우스 도산", location: "서울 강남구 신사동", category: "FASHION", keywords: "sunglasses,display", daysLeft: 8 },
  { name: "포켓몬 팝업 in 더현대", location: "서울 영등포구 여의도", category: "CHARACTER", keywords: "figure,toy", daysLeft: 5 },
  { name: "올리브영 성수 뷰티존", location: "서울 성동구 성수동", category: "BEAUTY", keywords: "cosmetics,shelf", daysLeft: 20 },
  { name: "노티드 도넛 팝업", location: "서울 마포구 연남동", category: "FOOD", keywords: "donut,dessert", daysLeft: 2 },
  { name: "무신사 스탠다드 홍대", location: "서울 마포구 홍대", category: "FASHION", keywords: "sneakers,shelf", daysLeft: 15 },
  { name: "디즈니 100주년 전시", location: "서울 중구 명동", category: "CULTURE", keywords: "neon,gallery", daysLeft: 30 },
  { name: "삼성 갤럭시 체험존", location: "서울 서초구 강남대로", category: "TECH", keywords: "smartphone,gadget", daysLeft: 7 },
  { name: "블루보틀 삼청 팝업", location: "서울 종로구 삼청동", category: "FOOD", keywords: "coffee,cup", daysLeft: 4 },
];

function toISODate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** 개발용 목업 팝업 목록 — 각 항목에 카테고리 매칭 커버 + 미래 종료일(D-day)이 들어있다. */
export function devMockPopups(): PopupStore[] {
  return SEEDS.map((s, i) => {
    const id = 90000 + i;
    return {
      id,
      name: s.name,
      location: s.location,
      category: s.category,
      endDate: toISODate(s.daysLeft),
      imageUrl: cover(id, s.keywords),
      viewCount: 920 - i * 41,
      status: i % 4 === 0 ? "혼잡" : "영업중",
      latitude: "37.5445",
      longitude: "127.0560",
    } as PopupStore;
  });
}
