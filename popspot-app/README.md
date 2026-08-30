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
`popupCover` `colorMix` `season` `seasonPalette` `dday` `stamps` `walkGroups` `periodText` `policyVersions`
`mappable` `seoulGuard` `locationPrecision` `groupSameEvent` `homeSurfaces` `popAllPreview` `nearby`
`nearestStation` `rank` `boost` `popupVibe` `visitedAgo` `dayBuckets` `useMySchedule`.
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

## 목록은 한 곳에서만 거른다

`usePopups()` 가 웹 `HomeClient` 의 네 단계를 그대로 계산해서 **이름 붙은 결과**로 준다.
화면은 자기에게 맞는 것을 고르기만 하고, **거르는 코드를 따로 쓰지 않는다.**

| 무엇 | 규칙 | 쓰는 곳 | 실측(2026-08-30) |
|---|---|---|---|
| `catalog` | 원본 그대로 | 달력·상세·여권·찜 | 1,455 |
| `open` | `isOpenNow` | 검색·서치존·음악·일정 | 1,268 |
| `mappable` | 좌표 있음 + 가짜위치 제외 + 서울박스 | 지도 핀 | 1,077 |
| `popAll` | 같은 행사 합침 | 전체보기 · **화면이 말하는 개수** | 1,001 |

예전에는 `openPopups()` 를 내주고 화면마다 부르게 했다. 홈만 불렀고 전체보기·검색·상세·여권·
마이 다섯 곳이 빠져서, 홈은 1,268곳인데 전체보기에는 2023년 팝업까지 1,455곳이 있었다.
웹이 `isOpenNow` 문서에 적어 둔 "홈 659곳 / 지도 623곳" 과 같은 병이다 — **거르는 책임을
소비자에게 나눠 주면 언젠가 한 곳이 빠진다.**

`isOpenNow` 가 빼는 것은 넷이다: 이미 종료 · 아직 시작 전 · 날짜가 아예 없음 · 종료일 없이
시작일만 90일 지남(`isStale`). **종료일만 없는 팝업은 안 뺀다** — 웹도 안 뺀다(상시 운영이거나
종료일만 못 뽑은 경우이고, 적어도 "문을 열었다" 는 근거는 있다).

**웹과 다른 곳은 하나뿐이다.** `mappable` 에 서울박스(`isCoordOutsideSeoul`)를 건다 —
웹 홈은 안 건다(웹 1,036 / 앱 1,001). 우리 타일이 서울만 담고 있어 수원·판교 좌표의 핀은
아무것도 없는 회색 위에 찍히고, 그건 "지도에서 찾을 수 있는 곳" 이 아니다. 웹도 같은 판정을
`mappable.ts` 에 만들어 두고 랜딩에는 쓴다 — 홈에만 안 걸려 있다.

## 화면과 웹의 대응

| 앱 화면 | 웹에서 온 것 |
|---|---|
| 홈 서치존 | `SearchBox.tsx` 의 `SearchZone` — 로컬 후보 6개(이름·장소 6칸) + AI 검색 |
| 홈 혼잡도·캘린더 타일 | 웹 지도 아래 두 칸짜리 지름길 |
| 홈 「최근 오픈한 팝업」 | 웹 레일 — 기본 최신순(`startDate` 내림차순), 정렬 3종 |
| 일정 탭 | 웹 SCHEDULE 탭 = `MySchedule` + `PopupCalendar` |
| 코스 탭 지도 | 웹 COURSE 탭의 `InteractiveMap showPath` — 회색 점선, 순번 핀 |

## 소셜 로그인 — 웹을 한 번 거친다

백엔드 `OAuth2SuccessHandler` 는 로그인이 끝나면 `app.oauth2.redirect-uri` **한 곳으로만** 되돌린다.
그 값이 웹 주소라 앱은 결과를 받을 방법이 없었다. 백엔드를 고치는 대신 **웹을 브릿지로 쓴다** —
백엔드 배포는 수동 jar 교체라 대기 중이고, 웹은 push 하면 바로 나간다.

```
앱  → popspot.co.kr/oauth/start/kakao?n=<난수>   난수를 쿠키에 담고 백엔드로 302
    → 카카오 로그인
    → 백엔드 → popspot.co.kr/oauth/callback?code=…
    → 그 페이지가 쿠키를 보고 popspot://auth?code=…&n=<난수> 로 앱을 깨운다
앱  → POST /api/v1/auth/oauth/exchange {code} → 토큰 → GET /me → 프로필
```

**백엔드도 앱 빌드도 안 건드린다.** `scheme: "popspot"` 은 이미 app.json 에 있고, `Linking` 은
RN 코어다. `expo-web-browser` 를 안 쓴 것도 그것이 새 네이티브 모듈이라 스토어 빌드를 다시 만들어야
하기 때문이다.

### 난수(nonce)가 하는 일 — 빼면 계정이 털린다

안드로이드 커스텀 스킴은 **독점이 아니다.** 짝 맞추기 값이 없으면 피해자가 아무 웹페이지에서
링크 하나만 눌러도 `popspot://auth?code=<공격자 코드>` 가 앱에 배달되고, 앱은 그것을 자기 로그인으로
알고 **공격자 계정으로 조용히 갈아탄다.** 웹 콜백이 `?token=` 경로를 지운 것과 같은 위협이다.

그래서 앱이 난수를 만들어 시작 주소에 싣고 → 웹이 쿠키에 담았다가 → 돌아올 때 되돌려 주고 →
앱이 자기 값과 **다르면 코드를 버린다.** 저장한 값이 없어도 버린다("확인할 게 없으니 통과" 는
자물쇠가 없는 것과 같다). 난수는 `SecureStore` 에 30분 유효로 둔다 — 브라우저에 다녀오는 동안
안드로이드가 앱을 죽여도 살아남아야 한다.

**진짜 해법은 App Links** (`https://popspot.co.kr/…` 를 `.well-known/assetlinks.json` 로 검증)다.
서명 인증서 지문과 새 네이티브 빌드가 필요해서 **스토어 제출 때 함께 넣는다.**

### 밟은 함정들

- **만료 토큰이 교환을 막는다.** `apiFetch` 는 저장된 토큰을 모든 요청에 붙이고, 백엔드
  `JwtAuthenticationFilter` 는 헤더가 있는데 토큰이 무효면 **공개 경로라도** 컨트롤러 전에 401 을
  쏜다. 어제 앱을 켰던 사람은 오늘 소셜 로그인이 **무조건** 실패하고, 다시 눌러도 같은 토큰이
  다시 붙어 영영 안 풀린다. → `apiFetch(path, init, { anonymous: true })`.
- **취소는 콜백으로 오지 않는다.** 카카오 동의 화면에서 '취소' 를 누르면 스프링 `failureUrl` 이
  `/login?error` 로 보낸다 — 콜백이 아니다. 그래서 **로그인 페이지도** 앱 표시를 보고
  `popspot://auth?error=denied` 로 되돌린다. 쿠키 `Path` 가 `/` 인 이유가 이것이다(`/oauth` 로
  좁히면 로그인 페이지에서 못 읽는다).
- **`location.replace` 로 바로 넘기면 대비 화면이 안 그려진다.** 앱이 없으면 크롬이
  `ERR_UNKNOWN_URL_SCHEME` 로 덮어 버려서 "여기를 누르세요" 링크가 화면에 선 적조차 없다.
  한 프레임 뒤에 `href` 로 넘긴다.
- **`getInitialURL` 은 콜드 스타트 뒤 계속 같은 값을 준다.** 훅이 다시 마운트될 때마다 읽으면
  이미 쓴 코드를 또 교환한다. 모듈 스코프 `Set` 으로 한 번만 처리한다.
- **개발 빌드에서는 콜드 경로가 안 된다.** `expo-dev-launcher` 가 번들이 뜨기 전의 인텐트를 가로채
  개발자 런처를 띄운다. **개발 빌드에서 안 된다고 코드를 고치지 말 것** — preview/릴리스에서 확인한다.
- **웹 로그인은 한 글자도 안 바뀐다.** 쿠키가 없으면 콜백은 지금 코드 그대로 돌고 로그인 페이지의
  effect 는 즉시 return 한다(배포 후 브라우저로 확인함).

### 아직 남은 것

- **2단계 인증** — 교환이 `{totpRequired, challengeToken}` 을 주면 앱은 "웹에서 로그인해 주세요" 로
  끝낸다. 6자리 화면이 없다. 이 서비스의 주 관리자가 '카카오 + 관리자' 라 **앱에서 관리자 로그인은
  아직 안 된다.**
- **App Links** — 위 참고. 스토어 제출 전 필수.

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

- **2단계 인증(TOTP)** — 로그인 응답이 `totpRequired` 를 주면 지금은 "웹에서 로그인해 주세요" 로
  안내한다.
