import type { PopupStore } from "@/types/popup";

/**
 * [redesign/test 전용] 백엔드가 없을 때(로컬 개발) 재설계 홈을 채우는 개발용 목업.
 *
 * <p>각 팝업의 <b>느낌에 맞춰 직접 큐레이션한</b> Pexels 사진(사람 없는 인테리어/제품 컷)을 1:1로 배정한다.
 * 랜덤 이미지가 아니라 특정 URL 고정이라 "막 넣은" 느낌이 없다. Pexels License = 상업 무료·출처 불필요.
 * {@code process.env.NODE_ENV === "development"} 에서만 쓰이며, 실배포에선 백엔드가 준 imageUrl 이 들어간다.
 */

/** Pexels CDN 직접 URL(키 불필요). 4:5 크롭. */
const PX = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200&h=1500&fit=crop`;

interface Seed {
  name: string;
  location: string;
  category: string;
  img: string;
  daysLeft: number;
}

// img 는 팝업 느낌에 맞게 손으로 고른 사람-없는 Pexels 컷(부티크·제품·인테리어).
const SEEDS: Seed[] = [
  { name: "마뗑킴 성수 팝업스토어", location: "서울 성동구 성수동", category: "FASHION", img: PX(8386651), daysLeft: 3 },
  { name: "산리오 캐릭터즈 팝업", location: "서울 송파구 잠실", category: "CHARACTER", img: PX(311268), daysLeft: 0 },
  { name: "탬버린즈 한남 플래그십", location: "서울 용산구 한남동", category: "BEAUTY", img: PX(32645088), daysLeft: 12 },
  { name: "런던베이글뮤지엄 팝업", location: "서울 종로구 익선동", category: "FOOD", img: PX(17057406), daysLeft: 1 },
  { name: "젠틀몬스터 하우스 도산", location: "서울 강남구 신사동", category: "FASHION", img: PX(5202048), daysLeft: 8 },
  { name: "포켓몬 팝업 in 더현대", location: "서울 영등포구 여의도", category: "CHARACTER", img: PX(4491702), daysLeft: 5 },
  { name: "올리브영 성수 뷰티존", location: "서울 성동구 성수동", category: "BEAUTY", img: PX(15096784), daysLeft: 20 },
  { name: "노티드 도넛 팝업", location: "서울 마포구 연남동", category: "FOOD", img: PX(10513887), daysLeft: 2 },
  { name: "무신사 스탠다드 홍대", location: "서울 마포구 홍대", category: "FASHION", img: PX(7679757), daysLeft: 15 },
  { name: "디즈니 100주년 전시", location: "서울 중구 명동", category: "CULTURE", img: PX(35719467), daysLeft: 30 },
  { name: "삼성 갤럭시 체험존", location: "서울 서초구 강남대로", category: "TECH", img: PX(3945679), daysLeft: 7 },
  { name: "블루보틀 삼청 팝업", location: "서울 종로구 삼청동", category: "FOOD", img: PX(6612572), daysLeft: 4 },
];

function toISODate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** 개발용 목업 팝업 목록 — 각 항목에 느낌 맞춤 커버 + 미래 종료일(D-day)이 들어있다. */
export function devMockPopups(): PopupStore[] {
  return SEEDS.map((s, i) => {
    const id = 90000 + i;
    return {
      id,
      name: s.name,
      location: s.location,
      category: s.category,
      endDate: toISODate(s.daysLeft),
      imageUrl: s.img,
      viewCount: 920 - i * 41,
      status: i % 4 === 0 ? "혼잡" : "영업중",
      latitude: "37.5445",
      longitude: "127.0560",
    } as PopupStore;
  });
}
