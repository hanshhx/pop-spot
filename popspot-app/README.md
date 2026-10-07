# POP-SPOT 앱

React Native·Expo SDK 54 기반의 모바일 앱 프로젝트이다.
현재 `main`은 팝업 목록과 상세 화면을 제공한다. 나머지 탭은 준비 화면이며 스토어 출시 여부와 구분한다.

## 실행

```bash
cd popspot-app
npm install
npx expo start
```

사용 중인 Expo SDK와 호환되는 Expo Go에서 QR 코드를 열어 확인한다.
Android 에뮬레이터는 `npm run android`, 웹 미리보기는 `npm run web`을 사용한다.
기기·운영체제별 동작은 실제 실행으로 확인해야 한다.

## 구조

| 경로                           | 역할                      |
| ------------------------------ | ------------------------- |
| `App.tsx`                      | 화면 이동과 공통 배경     |
| `src/api.ts`                   | 팝업 API 호출과 서버 주소 |
| `src/types.ts`                 | 팝업·화면 이동 타입       |
| `src/lib.ts`                   | 날짜·카테고리 표시 로직   |
| `src/theme.ts`                 | 색상 등 화면 스타일       |
| `src/navigation/Tabs.tsx`      | 하단 탭                   |
| `src/screens/HomeScreen.tsx`   | 팝업 목록                 |
| `src/screens/DetailScreen.tsx` | 팝업 상세                 |
| `src/screens/StubScreen.tsx`   | 미구현 탭의 준비 화면     |

홈은 `/api/popups`에서 목록을 받는다.
기본 API 주소는 `https://popspot.co.kr`이며, 개발 환경에서는 `EXPO_PUBLIC_API_BASE`로 바꿀 수 있다.
Android 패키지와 iOS 번들 식별자는 `kr.co.popspot`이다.

현재 브랜치에는 별도 테스트 스크립트가 없다. 타입은 `npx tsc --noEmit`으로 확인한다.
공통 기준은 [개발 안내](../docs/DEVELOPMENT.md)에 정리했다.
