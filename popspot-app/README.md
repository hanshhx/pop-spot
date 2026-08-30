# popspot-app

POP-SPOT 안드로이드·iOS 앱. React Native + Expo (SDK 54).

시안 `Popspot Mobile App Design2.zip` 의 17개 화면을 옮긴 것이고, **기술 구조는 `popspot-frontend`(웹)와 같게 맞춰 두었다.**

## 실행

```bash
npm install
npx expo run:android  # 개발 빌드 설치 후 실행
npm test              # 순수 로직 테스트
npx tsc --noEmit      # 타입
```

> **Expo Go 로는 더 이상 안 돈다.** 지도(MapLibre)가 네이티브 모듈이라 Expo Go 에 들어 있지 않다.
> 한 번 `npx expo run:android` 로 개발 빌드를 폰/에뮬레이터에 설치하면, 그 뒤로는 `npx expo start` 만
> 해도 그 앱이 붙는다. 원격 기기라면 `eas build --profile development -p android` 로 apk 를 받는다.

## 구조 — 웹과 같은 자리에 같은 것

| 폴더 | 무엇 |
|---|---|
| `src/lib` | 순수 로직 + 동명 테스트. **웹 `src/lib` 에서 그대로 가져온 것이 14개** |
| `src/features/<도메인>` | 화면과 그 화면만 쓰는 훅·API |
| `src/components/{layout,ui,main}` | 공용 컴포넌트 |
| `src/store` | zustand |
| `src/types` | 도메인 타입(`popup.ts` 는 웹과 동일 파일) |
| `src/theme` | 웹의 `globals.css` 가 하던 일 |

웹에서 **무수정 이식**한 모듈: `popupSlices` `regions` `popAllQuery` `popupBadges` `landingStatus`
`popupCover` `colorMix` `season` `seasonPalette` `dday` `stamps` `walkGroups` `periodText` `policyVersions`.
이 파일들은 웹과 `diff` 가 나면 안 된다 — 한쪽만 고치면 "웹엔 있는데 앱엔 없는 팝업" 이 생긴다.

앱에서 새로 만든 것: `optimizeRoute`(웹 `planning/page.tsx` 의 최근접이웃을 모듈로 승격) ·
`routing`(OSRM) · `notifyRules` · `moods` · `i18n`(ko 축소판).

## 지도

`components/Map/MapCanvas.tsx` — MapLibre 로 웹과 **같은 타일**을 그린다.
`popspot.co.kr/seoul.pmtiles`(59MB, Protomaps basemap v4)를 `pmtiles://` 로 직접 읽는다.
MapLibre Native 가 그 스킴을 네이티브로 지원해서(Android 11.7.0+ / iOS 6.10.0+) 타일 서버가 따로 필요 없고
비용도 0원 그대로다. 스타일은 `components/Map/mapStyle.ts` — 웹에서 그대로 옮겼고 다른 곳은 타입 import 와
`window.location.origin` → `API_BASE_URL` 두 줄뿐이다.

핀은 `<Marker>` 가 아니라 GeoJSON 소스 + 레이어로 그린다. 지금 열려 있는 팝업이 1,268곳이라 그만큼의
네이티브 뷰는 지도를 움직일 때마다 다시 자리를 잡아 스크롤이 멈춘다. 멀리서는 묶어서 개수로 보여 주고
(`cluster`), 확대하면 낱개와 이름이 나온다.

## 밟으면 아픈 곳

- **`.pmtiles` 는 `immutable` 로 서빙해야 한다.** 웹은 견디지만 **MapLibre Native 는 앱을 강제종료시킨다.**
  `max-age=0, must-revalidate` 면 Range 요청마다 재검증 → 본문 없는 304 → `PMTilesFileSource` 스레드에서
  SIGSEGV. 지도가 뜨는 순간 앱이 닫힌다. `popspot-frontend/next.config.ts` 의 `/:all*(pmtiles)` 헤더가
  그것을 막고 있으니 지우지 말 것. 대신 **타일 파일을 갱신할 땐 파일명을 바꿔야 한다**(1년 불변 캐시).
- **`zustand/middleware` 를 가져오지 말 것.** `persist` 만 써도 devtools 가 딸려 오고 그 안의
  `import.meta.env` 가 **웹 번들을 통째로 깨뜨린다**. 네이티브는 멀쩡해서 안드로이드만 빌드하면
  끝까지 안 보인다. 영속은 `src/store/persist.ts` 로 붙인다.
- **OSRM 공개 서버는 프로필을 무시한다.** `/foot/` 이든 `/driving/` 이든 자동차 속도를 준다
  (실측: 779m → 123초 = 시속 22.8km). `duration` 을 쓰지 말고 거리에서 직접 센다
  (`src/lib/routing.ts`).
- **글꼴은 굵기마다 파일이 다르다.** 안드로이드는 `fontFamily` + `fontWeight` 를 함께 주면 굵기를
  무시하고 시스템 폰트로 떨어진다. `theme/typography.ts` 의 `font()` 를 쓴다.
- **JetBrains Mono 는 굵기별 하위 경로로 가져온다.** 패키지 루트에서 가져오면 16종 1.9MB 가
  전부 번들에 실린다.

## 앱이 수집·전송하는 것 (개인정보 처리방침 반영 필요)

웹 방침(`popspot-frontend/app/privacy/page.tsx`)에 **없는 항목이 있다.** 스토어 심사 전에 확인이 필요하다.

| 항목 | 어디로 | 웹 방침에 있나 |
|---|---|---|
| 기기 현재 위치(GPS) — 최단 동선 출발점, 길찾기 | 기기 안에서만 계산. 서버로 보내지 않음 | **없음** — 웹은 "사용자가 *선택한* 좌표" 만 적혀 있고, 앱은 기기 위치를 읽는다. 위치정보법 대상이라 문구가 필요하다 |
| 출발·도착 좌표 | FOSSGIS e.V. OSRM 공개 서버(독일) | 있음 |
| 알림 권한 | 로컬 알림만. 서버 푸시 토큰은 아직 안 씀 | **없음** |
| 로그인 토큰·프로필 | 기기 `SecureStore`(암호화) | 해당 |
| 찜·스탬프 | popspot 백엔드 | 있음 |
| 최근 본 팝업·검색어 | **기기 안에만.** 서버로 보내지 않음 | 해당 없음 |

## 아직 안 되는 것

- **소셜 로그인(카카오·네이버·구글)** — 화면은 시안대로 있지만 동작하지 않는다.
  백엔드가 OAuth2 성공 후 `app.oauth2.redirect-uri` **한 곳으로만** 리다이렉트하는데
  (`OAuth2SuccessHandler.java`), 그 값이 웹 주소다. 앱이 받으려면 백엔드가 앱 스킴
  (`popspot://auth`)을 허용 목록에 추가해야 한다. **백엔드 변경이 선행 조건이라 앱만 고쳐서는
  안 된다.**
- **2단계 인증(TOTP)** — 로그인 응답이 `totpRequired` 를 주면 지금은 "웹에서 로그인해 주세요" 로
  안내한다.
