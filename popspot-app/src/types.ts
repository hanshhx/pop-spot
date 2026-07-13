/** 팝업 (백엔드 /api/popups). 카드 피드·상세에서 사용. imageUrl 은 크롤/폴백 커버 이미지. */
export type Popup = {
  id: number;
  name: string;
  location: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  latitude?: string | null;
  longitude?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
  viewCount?: number | null;
  content?: string | null;
  description?: string | null;
};

/** 지도용 경량 마커(/api/map/markers). 좌표 포함. */
export type Marker = {
  id: number;
  name: string;
  location: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  latitude: string | null;
  longitude: string | null;
};

/** 루트 스택: 탭 화면 + 그 위로 뜨는 상세. */
export type RootStackParamList = {
  Main: undefined;
  Detail: { popup: Popup };
};

/** 하단 탭. */
export type TabParamList = {
  Map: undefined;
  Course: undefined;
  Music: undefined;
  Passport: undefined;
  My: undefined;
};
