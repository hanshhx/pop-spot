/** 백엔드 /api/map/markers 응답 1건. 좌표는 문자열로 내려온다. */
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

/** 목록/상세에서 함께 쓰는 네비게이션 파라미터. */
export type RootStackParamList = {
  List: undefined;
  Detail: { popup: Marker };
};
