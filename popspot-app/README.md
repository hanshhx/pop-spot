# popspot-app

POP-SPOT 안드로이드·iOS 앱. React Native + Expo (SDK 54).

시안 `Popspot Mobile App Design2.zip` 의 17개 화면을 옮긴 것이고, **기술 구조는 `popspot-frontend`(웹)와 같게 맞춰 두었다.**

## 실행

```bash
npm install
npx expo start        # 폰의 Expo Go 로 QR 스캔
npm test              # 순수 로직 테스트
npx tsc --noEmit      # 타입
npm run web           # 브라우저에서 렌더 확인(실 API 는 CORS 로 막힌다 — 폰은 됨)
```

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

## 밟으면 아픈 곳

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
- **진짜 지도** — 지금은 `components/main/MapCanvas.tsx` 가 도로·블록을 그린 바닥이다. 핀 위치는
  실제 좌표로 계산하므로, 이 파일 안만 MapLibre 로 바꾸면 핀 코드는 그대로 산다.
- **2단계 인증(TOTP)** — 로그인 응답이 `totpRequired` 를 주면 지금은 "웹에서 로그인해 주세요" 로
  안내한다.
