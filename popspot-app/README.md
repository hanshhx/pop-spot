# 팝스팟 앱 (popspot-app)

popspot 서울 팝업스토어 서비스의 **React Native + Expo** 모바일 앱.
기존 Spring Boot 백엔드(API)를 그대로 재사용한다. 목표: **Google Play 스토어 배포**.

## 실행 (폰에서 바로 보기)

```bash
cd popspot-app
npm install            # 최초 1회 (이미 설치돼 있으면 생략)
npx expo start         # QR 코드가 뜸
```

1. 폰에 **Expo Go** 앱 설치 (Play 스토어 / App Store)
2. 터미널의 **QR 코드**를 Expo Go(안드로이드) / 카메라(아이폰)로 스캔
3. 폰에서 앱이 바로 실행됨 (코드 저장하면 즉시 리로드)

> 안드로이드 에뮬레이터: `npm run android` · 웹 미리보기(지도 등 일부 미지원): `npm run web`

## 구조

```
App.tsx              내비게이션(목록 ↔ 상세, native-stack)
src/
  api.ts             백엔드 호출 (API_BASE 상수만 바꾸면 서버 전환)
  types.ts           Marker 타입 · 내비 파라미터
  lib.ts             카테고리 라벨 · D-day · 지역 축약 헬퍼
  theme.ts           브랜드 컬러(라임/잉크/크림)
  screens/
    ListScreen.tsx   팝업 목록 (마감 임박 순, 당겨서 새로고침)
    DetailScreen.tsx 팝업 상세 (+ 지도 앱 열기)
```

현재 MVP: `/api/map/markers`(진행 중 팝업 121곳)를 불러와 **목록 → 상세**. 백엔드는 재작업 0.

## 플레이스토어까지 로드맵

- [x] **1. MVP** — 팝업 목록 · 상세 (지금 여기)
- [ ] **2. 지도** — `react-native-maps`로 팝업 위치 지도
- [ ] **3. 위시 + 마감 푸시 알림** — `expo-notifications`. 위시한 팝업 D-3 알림 → 앱의 킬러 기능
- [ ] **4. 로그인** — 기존 JWT 인증 재사용
- [ ] **5. 음악/AI 검색** — 웹 기능 이식
- [ ] **6. EAS 빌드** — `eas build -p android` → `.aab` (클라우드 빌드, 안드로이드 스튜디오 불필요)
- [ ] **7. 스토어 출시** — Google Play Console 개발자 등록($25, 1회) → 내부 테스트 → 프로덕션 심사 → 출시

## 메모

- 백엔드 API 베이스는 `src/api.ts`의 `API_BASE`. 지금은 GCP VM 직접 호출.
- Android 패키지: `kr.co.popspot` (스토어 등록 식별자).
- 아이콘/스플래시는 `assets/`의 기본 이미지 → 출시 전 브랜드 이미지로 교체 필요.
