/**
 * POP-SPOT 도메인 공용 타입.
 *
 * <p>페이지 / 컴포넌트 / 모달이 같은 모양의 데이터를 다루도록 한 곳에서 관리한다.
 * 백엔드 DTO 와 1:1 대응되는 모양이며, V4 에서 추가된 자동수집 메타데이터는 옵셔널로 둔다
 * (수동 등록 데이터와의 호환 위해).
 */

/* ============================== Enums ============================== */

export type SourceType = 'MANUAL' | 'CRAWLED' | 'USER_REPORT';

export type ReviewStatus =
  | 'AUTO_PUBLISHED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'TAKEDOWN';

/* ============================== User ============================== */

export interface User {
  userId: string;
  /** 호환 alias — 일부 API 응답이 {@code id} 키로 내려준다. 화면에서는 {@code userId} 우선 사용. */
  id?: string;
  nickname: string;
  /** v2.15.3 — 회원 식별용 이메일. OAuth 첫 로그인 시 네이버/카카오/구글이 제공. */
  email?: string;
  /** v2.15.3 — 프로필 사진 URL. 소셜 로그인의 picture / 기본 아바타 fallback. */
  picture?: string;
  isPremium?: boolean;
  role?: string;
  isSocial?: boolean;
  /** 메이트 확성기 보유량 — 상점 폐기 후 신규 발급은 없지만 기존 보유분 표시용. */
  megaphoneCount?: number;
}

export interface MyPageData {
  nickname: string;
  isPremium: boolean;
  premiumExpiryDate: string | null;
  megaphoneCount: number;
  stampCount: number;
  likeCount: number;
  reviewCount: number;
}

/* ============================== Popup ============================== */

export interface PopupStore {
  id: number;
  name: string;
  location: string;
  status: string;
  viewCount: number;
  prevRank?: number;
  latitude?: string;
  longitude?: string;
  category?: string;
  rankChange?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  imageUrl?: string;
  /**
   * 사진 출처(CRAWLED/USER/PEXELS/PLACEHOLDER). 목록 API 는 PopupStore 엔티티를 그대로 직렬화하므로
   * 이 필드가 함께 내려온다. PEXELS는 연출 이미지 고지·출처와 함께 노출하고 PLACEHOLDER는 정보형 UI로 바꾼다.
   */
  photoOrigin?: string;
  photoSourceUrl?: string;
  photoCreditName?: string;
  photoCreditUrl?: string;
  reporterId?: string;

  /* === V4 자동수집 / 검수 / 저작권 메타데이터 === */
  sourceType?: SourceType;
  sourceUrl?: string;
  sourceName?: string;
  reviewStatus?: ReviewStatus;
  confidenceScore?: number;
}

/** {@code GET /api/popups/calendar} 응답 (가벼운 DTO). */
export interface CalendarPopup {
  id: number;
  name: string;
  location: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  sourceType?: SourceType;
  sourceUrl?: string;
}

export interface PopupReportPayload {
  name: string;
  category: string;
  location: string;
  address: string;
  startDate: string;
  endDate: string;
  description: string;
  reporterId: string;
}

/* ============================== Congestion ============================== */

export interface CongestionForecast {
  time: string;
  level: string;
  population: number;
}

export interface CongestionData {
  /** 지역명 — "성수/서울숲" 등. 백엔드가 핫스팟별로 키를 다르게 내려줌. */
  areaName?: string;
  level: string;
  message: string;
  minPop: number;
  maxPop: number;
  temp: string;
  sky: string;
  rainChance: string;
  /** 12시간 예측 시계열. */
  forecast: CongestionForecast[];
  /** 일부 백엔드 응답에서 사용하는 alias — 정식 키는 forecast. */
  forecasts?: CongestionForecast[];
  ageRates: Record<string, number>;
  aiComment?: string;
}

/* ============================== Trend / OOTD ============================== */

export interface TrendOotdData {
  keyword: string;
  photographer: string;
  videoUrl: string;
  thumbnail: string;
}

export interface TrendOotd {
  type: string;
  comment: string;
  data: TrendOotdData | null;
}

/* ============================== Wishlist / Course ============================== */

export interface WishlistItem {
  wishlistId: number;
  popupId: number;
  popupName: string;
  popupImage: string;
  location: string;
  startDate: string;
  endDate: string;
}

export interface CourseItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  reason?: string;
}

export interface SavedCourse {
  id: number;
  userId: string;
  courseName: string;
  /** JSON 문자열 — JSON.parse 하면 CourseItem[]. */
  courseData: string;
  createdAt?: string;
}
