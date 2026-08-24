# 랜딩 지도 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/popups/[slug]` 이 "지도 한눈에" 라고 세 번 말하면서 지도가 없던 것을 없앤다. 좌표가 있는 팝업만 찍고, 몇 곳 중 몇 곳인지 화면에 적는다.

**Architecture:** 새 지도를 만들지 않는다. `DeferredInteractiveMap` 이 이미 `IntersectionObserver` 로 화면에 들어올 때만 마운트하고 `dynamic()` 으로 maplibre-gl 을 그때 받는다. 랜딩은 좌표 있는 마커만 걸러 `initialMarkers` 로 넘긴다 — 타입이 이미 같아 변환이 없다.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Tailwind v4, maplibre-gl 5 + pmtiles 4 (이미 의존성), vitest 4.

## 재고 조사 결과 — 새로 만들 것이 거의 없다

착수 전에 재 본 것들이다. 이 숫자들이 이 계획의 근거다.

- **대역폭은 막는 요인이 아니다.** `public/seoul.pmtiles` 는 58.9MB 지만 그건 파일 크기다.
  헤더를 읽으니 타일 **3,909개 · 평균 15,082B**, 줌 0–15. 범위 요청이 `206` 으로 동작하는 것도
  확인했다(`content-range: bytes 0-126/58967083`). 한 화면은 타일 10~25장이라 **150~400KB** 다.
  월 5,600명이 전원 지도를 봐도 약 1.7GB — Vercel 무료 한도 100GB 의 1.7%.
- **지연 로딩은 이미 있다.** `src/components/Map/DeferredInteractiveMap.tsx` — `IntersectionObserver`
  로 뷰포트 진입 시에만 `dynamic(() => import('./InteractiveMap'))`, 그전에는 `MapLoadingSurface`.
  스크롤이 지도까지 닿지 않은 방문자는 **한 바이트도 받지 않는다.**
- **데이터 변환이 없다.** `InteractiveMapProps.initialMarkers?: PublicMapMarker[]` 이고, 랜딩이
  다루는 것이 바로 그 타입이다.
- **계절 어긋남은 없다.** `MapGL:65` 가 `useSeason()` 으로 루트 `<html data-season>` 을 읽어서
  랜딩의 `<main data-season>` 과 다를까 걱정했는데, `seasonFromSlug` 는 슬러그에 계절 이름이나
  `N월` 이 직접 들어 있을 때만 값을 낸다. **생성되는 슬러그 101개 중 해당하는 것이 0건**이라
  `landingSeason` 은 모든 랜딩에서 `seasonOfNow()` — 루트와 같은 값이다. 손댈 것이 없다.

## 남은 문제 둘

**좌표 공백.** 성수는 98곳 중 65곳(66%)만 좌표가 있고, `other` 는 284곳 중 170곳(60%)이다.
숨기면 지도가 3분의 1 없는 채로 "한눈에" 라고 말하게 된다. **숨기지 않고 센다** — "98곳 중
65곳 표시". 그 숫자가 화면에 떠 있으면 좌표 채우기가 얼마나 급한지 매일 보인다.

**LCP.** 검색 유입 페이지라 첫 화면을 지도가 잡으면 순위에 불리하다. `IntersectionObserver` 가
마운트를 늦추지만 **어디에 두는지**는 따로 정해야 한다.

## Global Constraints

- **인프라 비용 0원.** 새 서비스·새 엔드포인트 없음. 지도는 이미 있는 정적 자산과 이미 있는
  의존성만 쓴다.
- **백엔드 무변경.**
- **새 지도 컴포넌트를 만들지 않는다.** `DeferredInteractiveMap` 을 쓴다. 그 안의 `InteractiveMap`
  · `MapGL` 은 홈 지도와 공유하므로 **prop 을 더하는 것 말고는 고치지 않는다** — 고치면 홈이
  같이 바뀐다.
- **본문 목록을 줄이지 않는다.** 좌표가 없어 지도에 못 찍히는 팝업도 목록에는 그대로 있다.
- **`landingCopy.ts` 는 사전이 아니다.** `LANDING_COPY: Record<Locale, LandingCopy>` — `ko`·`en`·`ja`
  세 손글씨 객체다. 타입에 필드를 더하면 셋 다 채워야 `tsc` 가 통과한다. 그 실패가 안전장치다.
- 테스트 기본 환경은 **`node`**. 순수 함수 테스트에 `// @vitest-environment jsdom` 을 넣지 않는다.
- **`globals: false`** — `import { describe, expect, it } from 'vitest';` 를 명시한다.
- **`npm run build` 가 필수다.** 서버 컴포넌트 안에 클라이언트 섬을 넣는 변경이라 타입체크와
  vitest 를 모두 통과하고도 빌드에서만 깨진다. Task 5(의견 폼)에서 같은 경계를 이미 넘었다.
- **포맷은 파일 단위로**: `npx prettier --write <path>`. `npm run format` 금지.
- `npm run format:check` 는 시작 전부터 빨갛다(`src/data/emergency/popups-2026-08-11.json`).
- Prettier: singleQuote, semi, printWidth 100, trailingComma "all", arrowParens "always", endOfLine **lf**.
- 브랜치를 새로 판다. `main` 은 지금 배포 상태와 같아야 한다.

## 파일 구조

| 파일                         | 책임                                          |
| ---------------------------- | --------------------------------------------- |
| `src/lib/mappable.ts`        | 마커에서 좌표 있는 것만 고르고 몇 곳인지 센다 |
| `src/lib/mappable.test.ts`   | 위의 계약 고정                                |
| `src/lib/landingCopy.ts`     | 지도 제목·개수 문구 3언어 (기존 파일 수정)    |
| `app/popups/[slug]/page.tsx` | 지도 마운트 (기존 파일 수정)                  |

---

### Task 1: 좌표 있는 것만 고르고, 몇 곳인지 센다

**Files:**

- Create: `src/lib/mappable.ts`
- Create: `src/lib/mappable.test.ts`

**Interfaces:**

- Consumes: `PublicMapMarker` (`@/lib/mapMarkers`)
- Produces: `mappable(markers: PublicMapMarker[]): { shown: PublicMapMarker[]; total: number }`

좌표는 **문자열**이다(`latitude: string | null`). `Number()` 로 바꾸고 `Number.isFinite` 로 거른다.
공백만 든 문자열(`' '`)은 `Number(' ') === 0` 이라 통과해 버리므로 **`trim()` 을 먼저** 한다 —
걸어서 묶기에서 리뷰가 잡았던 것과 같은 함정이다.

`(0, 0)` 은 서아프리카 앞바다다. 좌표가 깨진 행이 전부 거기 모이면 지도 한가운데가 텅 비고
아프리카에 핀이 뭉친다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';

import { mappable } from './mappable';
import type { PublicMapMarker } from './mapMarkers';

/**
 * 지도에 찍을 수 있는 것만 고른다.
 *
 * <p>랜딩은 "지도 한눈에" 라고 말하지만 좌표는 3분의 1 가까이 비어 있다(성수 98곳 중 65곳).
 * 없는 것을 숨기면 지도가 조용히 짧아지고, 방문자는 목록에 있는 팝업이 왜 지도에 없는지 알 수
 * 없다. 그래서 <b>고르되 센다</b> — 화면이 "98곳 중 65곳" 이라고 적을 수 있게 둘 다 돌려준다.
 *
 * <p>{@code (0, 0)} 은 서아프리카 앞바다다. 좌표가 깨진 행이 그리로 모이면 서울 지도는 비고
 * 대서양에 핀이 뭉친다 — 빈 값보다 나쁜 종류의 거짓말이다.
 */
const m = (o: Partial<PublicMapMarker> & { id: number }): PublicMapMarker => ({
  name: `팝업 ${o.id}`,
  location: '서울 성동구',
  latitude: null,
  longitude: null,
  category: null,
  startDate: null,
  endDate: null,
  ...o,
});

describe('mappable', () => {
  it('좌표가 있는 것만 고르고, 전체 개수는 그대로 센다', () => {
    const got = mappable([
      m({ id: 1, latitude: '37.5446', longitude: '127.0559' }),
      m({ id: 2 }),
      m({ id: 3, latitude: '37.5444', longitude: '127.0374' }),
    ]);
    expect(got.shown.map((x) => x.id)).toEqual([1, 3]);
    expect(got.total).toBe(3);
  });

  it('한쪽만 있으면 못 찍는다', () => {
    const got = mappable([m({ id: 1, latitude: '37.5446' })]);
    expect(got.shown).toEqual([]);
    expect(got.total).toBe(1);
  });

  it('공백만 든 문자열은 좌표가 아니다 — Number(" ") 가 0 이라 그냥 두면 통과한다', () => {
    const got = mappable([m({ id: 1, latitude: ' ', longitude: ' ' })]);
    expect(got.shown).toEqual([]);
  });

  it('숫자가 아닌 글자는 거른다', () => {
    expect(mappable([m({ id: 1, latitude: '서울', longitude: '성수' })]).shown).toEqual([]);
  });

  it('빈 목록은 0 중 0 이다', () => {
    expect(mappable([])).toEqual({ shown: [], total: 0 });
  });

  it('원본 순서를 흔들지 않는다 — 부모가 정한 순서를 여기서 다시 정하지 않는다', () => {
    const got = mappable([
      m({ id: 9, latitude: '37.5', longitude: '127.0' }),
      m({ id: 2, latitude: '37.6', longitude: '127.1' }),
    ]);
    expect(got.shown.map((x) => x.id)).toEqual([9, 2]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/mappable.test.ts
```

Expected: FAIL — `Failed to resolve import "./mappable"`

- [ ] **Step 3: 최소 구현을 쓴다**

`trim()` 을 먼저 하고 `Number.isFinite` 로 거른다. `total` 은 **거르기 전** 길이다.
Korean JSDoc 을 house style 로 붙인다.

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/mappable.test.ts
```

Expected: PASS — 6 tests

- [ ] **Step 5: 감시선을 확인한다**

`trim()` 을 잠깐 빼고 focused 테스트를 돌려 **"공백만 든 문자열은 좌표가 아니다"** 가 실패하는
것을 본 뒤 되돌린다. 두 출력을 보고에 적는다. 실패를 본 적 없는 테스트는 감시선이 아니다.

- [ ] **Step 6: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/lib/mappable.ts src/lib/mappable.test.ts && npm run typecheck
```

```bash
git add -A && git commit -m "feat(landing): pick the pop-ups a map can actually show, and count the rest"
```

---

### Task 2: 지도를 얹는다

**Files:**

- Modify: `src/lib/landingCopy.ts` (문구 2종 × 3언어)
- Modify: `app/popups/[slug]/page.tsx`

**Interfaces:**

- Consumes: `mappable` (Task 1), `DeferredInteractiveMap` (`@/components/Map/DeferredInteractiveMap`)
- Produces: 없음

- [ ] **Step 1: 문구를 세 언어에 넣는다**

```ts
/** 지도 섹션 제목. */
mapHeading: string;
/** 몇 곳 중 몇 곳을 찍었는지. 좌표가 없어 못 찍은 것을 숨기지 않는다. */
mapShownOf: (shown: number, total: number) => string;
```

```ts
// ko
  mapHeading: '어디에 모여 있나',
  mapShownOf: (s, t) => `${t}곳 중 ${s}곳 표시 — 나머지는 위치 정보가 아직 없습니다`,
// en
  mapHeading: 'Where they cluster',
  mapShownOf: (s, t) => `${s} of ${t} shown — the rest have no location yet`,
// ja
  mapHeading: 'どこに集まっているか',
  mapShownOf: (s, t) => `${t}件中${s}件を表示 — 残りは位置情報がまだありません`,
```

세 곳을 다 채우기 전에는 `tsc` 가 통과하지 않는다.

```bash
cd popspot-frontend && npm run typecheck
```

- [ ] **Step 2: 지도를 그린다**

**"걸어서 묶어 보기" 바로 위**에 둔다. 읽는 순서가 `여기 모여 있다 → 걸어서 묶으면 이렇다` 로
이어진다. 첫 화면이 아니므로 LCP 를 잡지 않는다.

`mappable(...)` 로 고른 것을 `initialMarkers` 로 넘긴다. 변환하지 않는다 — 타입이 같다.

`shown.length === 0` 이면 **섹션 자체를 그리지 않는다**. 찍을 것이 없는 지도는 서울 전체를
보여주는 빈 화면일 뿐이다.

제목은 `<h3>` 이다. 이 페이지의 규칙은 본문 섹션이 `<h2>` + `text-lg/xl`, 부수 섹션이 `<h3>` +
`text-sm/base` 이고, 이건 목록을 돕는 쪽이다. Task 2 에서 이 규칙을 어겼다가 고쳤다.

개수 문구(`mapShownOf`)는 지도 **아래**에 둔다. 지도를 본 뒤에 "아, 다 있는 건 아니구나" 를
읽는 순서가 맞다.

- [ ] **Step 3: 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

`npm run build` 가 이 태스크의 진짜 관문이다 — 클라이언트 섬을 서버 컴포넌트에 넣는 변경은
타입체크와 vitest 를 통과하고도 빌드에서 깨진다.

- [ ] **Step 4: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/lib/landingCopy.ts "app/popups/[slug]/page.tsx"
```

```bash
git add -A && git commit -m "feat(landing): put a map on the page that says 지도 한눈에"
```

---

## 끝나고 확인할 것

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

브라우저(컨트롤러가 확인):

- `/popups/seongsu` 에 지도가 뜨고 핀이 찍힌다
- 개수 문구가 실제와 맞는다 (성수 기준 98곳 중 65곳 언저리)
- **스크롤이 지도에 닿기 전에는 타일 요청이 없다** — 네트워크 탭에서 `pmtiles` 가 0건이어야 한다
- 본문 목록의 행 수가 지도 도입 전과 같다
- 좌표가 하나도 없는 슬러그에서 섹션이 아예 없다
- `/en` · `/ja` 에서 제목과 개수 문구가 번역된다
- 지도 색이 페이지의 계절과 맞는다 (어긋날 일이 없어야 정상)

## 범위 밖

- **좌표 채우기.** 크롤러·백엔드 일이라 프론트 배포에 못 얹는다. 이번 개수 문구가 그 급한 정도를
  화면에 드러내는 역할을 한다.
- **`MapGL`·`InteractiveMap` 내부.** 홈 지도와 공유한다. 고치면 홈이 같이 바뀐다.
- **사진 / 요일 / 입장료.** 컬럼이 없다.
- **`/api/tmap/route` 잠그기.** 유료 키·인증 없음·호출부 0. 별건.
