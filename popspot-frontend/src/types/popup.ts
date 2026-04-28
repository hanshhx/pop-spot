/**
 * POP-SPOT 도메인 공용 타입.
 * 페이지 / 컴포넌트 / 모달이 같은 모양의 데이터를 다루도록 한 곳에서 관리.
 */

export interface User {
  userId: string;
  nickname: string;
  isPremium?: boolean;
  role?: string;
  isSocial?: boolean;
}

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
  // [V4] 자동수집/검수/저작권 메타데이터
  sourceType?: "MANUAL" | "CRAWLED" | "USER_REPORT";
  sourceUrl?: string;
  sourceName?: string;
  reviewStatus?: "AUTO_PUBLISHED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "TAKEDOWN";
  confidenceScore?: number;
}

/** GET /api/popups/calendar 응답 (가벼운 DTO) */
export interface CalendarPopup {
  id: number;
  name: string;
  location: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  sourceType?: "MANUAL" | "CRAWLED" | "USER_REPORT";
  sourceUrl?: string;
}

export interface CongestionForecast {
  time: string;
  level: string;
  population: number;
}

export interface CongestionData {
  level: string;
  message: string;
  minPop: number;
  maxPop: number;
  temp: string;
  sky: string;
  rainChance: string;
  forecast: CongestionForecast[];
  ageRates: Record<string, number>;
  aiComment?: string;
}

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

export interface MyPageData {
  nickname: string;
  isPremium: boolean;
  premiumExpiryDate: string | null;
  megaphoneCount: number;
  stampCount: number;
  likeCount: number;
  reviewCount: number;
}

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
  courseData: string; // JSON string of CourseItem[]
  createdAt?: string;
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
