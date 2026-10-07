# POP-SPOT 앱

POP-SPOT의 Android·iOS용 React Native·Expo 프로젝트이다.
Expo SDK 54를 사용하며, 정확한 의존성 버전은 `package.json`과 `package-lock.json`에서 확인한다.
웹과 같은 백엔드 API를 사용한다.

## 실행

```bash
npm install
npx expo run:android  # 개발 빌드 설치 후 실행
npm test              # 순수 로직 테스트
npx tsc --noEmit      # 타입
```

MapLibre가 네이티브 모듈이므로 Expo Go 대신 개발 빌드가 필요하다.
개발 빌드를 설치한 뒤에는 `npx expo start`로 개발 서버를 실행한다.
원격 Android 기기용 개발 빌드는 `eas build --profile development -p android`로 만든다.

## 구조

| 폴더             | 역할                                      |
| ---------------- | ----------------------------------------- |
| `src/lib`        | 날짜·좌표·팝업 표시 등 공용 로직과 테스트 |
| `src/features`   | 기능별 화면, 훅, API 호출                 |
| `src/components` | 지도와 공용 UI                            |
| `src/store`      | Zustand 상태와 로컬 저장                  |
| `src/types`      | 도메인 타입                               |
| `src/theme`      | 색상과 글꼴                               |

웹과 공유하는 규칙은 양쪽 코드와 테스트를 함께 확인한다.
플랫폼에 따른 구현 차이가 있으므로 모든 파일이 동일하다고 가정하지 않는다.

## 지도와 팝업 목록

`src/components/Map/MapCanvas.tsx`는 MapLibre로 지도를 그린다.
타일 주소와 스타일은 `mapStyle.ts`에서 구성하며, PMTiles 파일을 사용한다.
팝업 핀은 GeoJSON 소스와 레이어로 표시하고, 축소 상태에서는 가까운 핀을 묶는다.

## 목록은 한 곳에서만 거른다

`src/store/usePopupStore.ts`가 `/api/popups` 응답을 보관하고 표시용 목록을 계산한다.
`inFlight`로 동시 요청을 합치고, 5분 동안 저장된 목록을 재사용한다.
화면별로 다음 목록을 선택한다.

| 목록       | 용도                                     |
| ---------- | ---------------------------------------- |
| `catalog`  | API에서 받은 전체 목록                   |
| `open`     | 운영 기간 규칙을 통과한 목록             |
| `mappable` | 좌표와 서울 범위 조건을 통과한 목록      |
| `popAll`   | 지도 표시 대상에서 같은 행사를 합친 목록 |

수집한 팝업은 게시 상태, 서버·앱 캐시, 날짜·좌표 조건에 따라 노출된다.
관리자가 수집을 실행해도 모든 항목이 즉시 모든 화면에 표시되는 것은 아니다.

## 소셜 로그인

앱은 웹 로그인 경로를 거쳐 일회용 코드를 받는다.

```text
앱 → 웹 /oauth/start/{provider} → 제공자 로그인
   → 웹 콜백 → /app/auth 또는 popspot://auth
   → POST /api/v1/auth/oauth/exchange → 사용자 정보 조회
```

`src/features/auth/socialAuth.ts`와 `useSocialLogin.ts`가 로그인 요청과 응답의 난수를 비교한다.
저장된 난수가 없거나 응답과 다르면 코드를 교환하지 않는다.
토큰 교환 요청에는 이전 로그인 토큰을 붙이지 않도록 `anonymous: true`를 사용한다.
같은 코드를 다시 처리하지 않도록 중복 콜백도 확인한다.

Android App Links는 설치된 앱의 서명과 서버의 `/.well-known/assetlinks.json`이 일치해야 한다.
`ANDROID_CERT_FINGERPRINTS`는 웹 배포 환경에서 설정하며, 실제 기기에서 링크 검증 결과를 확인한다.
설정 파일만으로 스토어 배포나 실기기 검증이 완료됐다고 판단하지 않는다.

## 개발 시 주의할 점

- PMTiles 응답과 캐시 정책을 바꾸면 웹과 네이티브 지도를 함께 확인한다. 타일 버전 처리는 `mapStyle.ts`에 있다.
- 로컬 상태 저장은 `src/store/persist.ts`를 사용한다. 웹 빌드 호환성을 함께 확인한다.
- 길찾기 시간은 공개 OSRM 응답을 보행 시간으로 간주하지 않고 `src/lib/routing.ts`의 규칙으로 계산한다.
- 글꼴은 `src/theme/typography.ts`의 굵기별 설정을 사용한다.
- 앱 권한과 데이터 전송 항목이 바뀌면 개인정보 안내와 스토어 제출 정보를 함께 확인한다.

공통 작업 기준은 [개발 안내](../docs/DEVELOPMENT.md)에 정리했다.
