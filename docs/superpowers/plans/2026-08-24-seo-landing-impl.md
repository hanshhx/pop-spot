# SEO 랜딩 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색으로 들어온 사람이 랜딩에서 **결정**하고(곧 열리는 것까지 보고), **실행**하고(걸어서 묶어 보고), **말을 걸 수 있게**(그 자리에서 의견) 한다.

**Architecture:** 판단은 전부 `src/lib` 의 순수 함수에 두고 테스트로 고정한다(`landingStatus`, `walkGroups`). 페이지는 그 결과를 그리기만 한다. 네트워크 호출을 하나도 늘리지 않는다 — 도보 시간은 좌표만으로 계산되는 산수다. 백엔드를 건드리지 않는다.

**Tech Stack:** Next.js App Router(리포 루트의 `app/`), React 19, TypeScript strict, Tailwind v4, vitest 4.

## Global Constraints

- **인프라 비용 0원.** 새 API·새 서비스 없음. **`router.project-osrm.org` 도 `/api/tmap/route` 도 부르지 않는다** — 전자는 SLA 없는 공개 데모 서버이고 후자는 유료 키다. 도보 시간은 좌표만으로 계산한다.
- **백엔드 무변경.** 라이브 백엔드는 손으로 만든 jar 라 프론트 배포에 못 얹는다.
- **개인정보 처리방침 무변경.** 좌표 산수는 제3자 전송도 개인정보 처리도 아니다. 외부 호출을 넣는 순간 방침 수정이 따라오므로 넣지 않는다.
- **`landingCopy.ts` 는 세 언어를 한 번에 채운다.** `LANDING_COPY: Record<Locale, LandingCopy>` 라 `LandingCopy` 에 필드를 더하면 `ko`·`en`·`ja` 세 곳 모두 채워야 `tsc` 가 통과한다. 사전(`i18n.tsx`)과는 **다른 테이블**이다.
- 테스트 기본 환경은 **`node`**. `vitest.config.ts` 에 `test` 블록이 없다. 이 계획의 새 테스트는 전부 순수 함수라 `// @vitest-environment jsdom` 을 **넣지 않는다**.
- **`globals: false`** — 테스트 파일마다 `import { describe, expect, it } from 'vitest';` 를 명시한다.
- **테스트에서 `new Date()` 를 부르지 않는다.** 날짜는 모듈 상수로 고정한다. 이 기계는 KST, CI 는 UTC 다.
- **포맷은 파일 단위로**: `npx prettier --write <path>`. `npm run format` 은 이미 깨져 있는 `src/data/emergency/popups-2026-08-11.json` 까지 다시 써서 diff 를 오염시킨다.
- `npm run format:check` 는 **시작 전부터 빨갛다**(위 JSON). 내 탓이 아니다.
- Prettier: singleQuote, semi, printWidth 100, trailingComma "all", arrowParens "always", endOfLine **lf**.
- 커밋 훅이 없다. `npm run typecheck` · `npm run lint` · `npx vitest run` 을 각 태스크에서 직접 돌린다.
- 브랜치는 `claude/seo-landing-rework`. `main` 에 푸시하지 않는다.
- 모든 명령의 작업 디렉터리는 `popspot-frontend/`.

## 참고 — 이미 확인된 것

```ts
// src/lib/mapMarkers.ts:3 — 랜딩이 다루는 팝업의 실제 모양
export interface PublicMapMarker {
  id: number;
  name: string;
  location: string | null;
  latitude: string | null; // ← 문자열이다. Number() 로 바꿔 쓴다
  longitude: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  nameEn?: string | null;
  nameJa?: string | null;
  locationEn?: string | null;
  locationJa?: string | null;
}
```

```ts
// app/popups/[slug]/page.tsx:292 — 지금의 버그
function ddayOf(endDate: string | null, today: Date): number | null; // 종료일만 본다
function ddayBadge(dday: number | null, copy: LandingCopy): { text: string; cls: string } | null;
// dday > 7 이면 라임색 copy.ddayOngoing('진행 중')
```

```ts
// app/planning/page.tsx:190 — 옮겨올 산수. 모듈 상수라 밖에서 못 쓴다.
const calculateRouteInfo = (lat1, lng1, lat2, lng2) => {
  /* 하버사인 → distKm; walkingDist = distKm * 1.3; minutes = round(walkingDist*1000/67) */
  return { dist: string, time: number };
};
```

`FeedbackForm` (`src/features/feedback/FeedbackForm.tsx:45`) 는 `{ userId, onSubmitted }` 를 받고 `userId: null` 이면 게스트 모드다. `POST /api/feedback` 은 공개라 **백엔드 변경이 필요 없다.**

## 파일 구조

| 파일                            | 책임                                                                |
| ------------------------------- | ------------------------------------------------------------------- |
| `src/lib/landingStatus.ts`      | 시작일·종료일로 예정/진행/종료를 가른다                             |
| `src/lib/landingStatus.test.ts` | 위의 계약 고정                                                      |
| `src/lib/walkGroups.ts`         | 도보 시간 산수 + 좌표로 묶기                                        |
| `src/lib/walkGroups.test.ts`    | 위의 계약 고정                                                      |
| `src/lib/landingCopy.ts`        | 새 문구 3종 × 3언어 (기존 파일 수정)                                |
| `app/popups/[slug]/page.tsx`    | 배지 정정 · 곧 열리는 섹션 · 걸어서 묶기 · 의견 폼 (기존 파일 수정) |
| `app/planning/page.tsx`         | 산수를 `walkGroups` 에서 가져다 쓰도록 (기존 파일 수정)             |

---

### Task 1: 시작일을 보지 않는 배지를 고친다

**Files:**

- Create: `src/lib/landingStatus.ts`
- Create: `src/lib/landingStatus.test.ts`
- Modify: `src/lib/landingCopy.ts` (`LandingCopy` 에 `ddayOpensIn` 추가 + ko/en/ja)
- Modify: `app/popups/[slug]/page.tsx` (`ddayBadge` 호출부)

**Interfaces:**

- Consumes: 없음
- Produces: `landingStatus(startDate: string | null, endDate: string | null, today: Date): LandingStatus`, `type LandingStatus = { kind: 'upcoming'; opensIn: number } | { kind: 'ongoing'; dday: number | null } | { kind: 'ended' }`

**버그:** `ddayOf` 가 **종료일만** 본다. 5일 뒤에 열고 30일 뒤에 닫는 팝업은 `dday = 30` 이 되고, `ddayBadge` 가 `dday > 7` 이므로 라임색 **"진행 중"** 을 단다. 아직 열지도 않았는데 열려 있다고 말한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/landingStatus.ts` 는 아직 없다. 먼저 테스트를 쓴다.

```ts
import { describe, expect, it } from 'vitest';

import { landingStatus } from './landingStatus';

/**
 * 랜딩 목록의 팝업이 지금 어떤 상태인가.
 *
 * <p>예전에는 종료일만 봤다. 그래서 <b>아직 열지도 않은</b> 팝업이 라임색 '진행 중' 배지를 달았다 —
 * 닷새 뒤에 열고 서른 날 뒤에 닫는 팝업은 남은 날이 30 이라 "여유 있게 진행 중" 으로 읽혔다.
 * 검색으로 들어온 사람에게 그건 "지금 가면 된다" 는 말이다.
 *
 * <p>날짜를 두 개 다 보면 세 가지로 갈린다. 그 경계를 여기서 고정한다.
 */
const TODAY = new Date('2026-08-24');

describe('landingStatus', () => {
  it('아직 열지 않았으면 upcoming 이고 며칠 남았는지 함께 준다', () => {
    expect(landingStatus('2026-08-29', '2026-09-23', TODAY)).toEqual({
      kind: 'upcoming',
      opensIn: 5,
    });
  });

  it('오늘 여는 것은 upcoming 이 아니라 ongoing 이다 — 오늘부터 갈 수 있다', () => {
    expect(landingStatus('2026-08-24', '2026-09-23', TODAY)).toEqual({
      kind: 'ongoing',
      dday: 30,
    });
  });

  it('이미 열려 있으면 ongoing 이고 마감까지 남은 날을 준다', () => {
    expect(landingStatus('2026-08-01', '2026-08-26', TODAY)).toEqual({
      kind: 'ongoing',
      dday: 2,
    });
  });

  it('마감일이 지났으면 ended 다', () => {
    expect(landingStatus('2026-08-01', '2026-08-23', TODAY)).toEqual({
      kind: 'ended',
    });
  });

  it('시작일을 모르면 열려 있는 것으로 본다 — 목록에 있다는 것 자체가 진행 중이라는 뜻이다', () => {
    expect(landingStatus(null, '2026-09-23', TODAY)).toEqual({
      kind: 'ongoing',
      dday: 30,
    });
  });

  it('종료일을 모르면 ongoing 이되 남은 날은 null 이다 — 상시 운영이 이렇게 들어온다', () => {
    expect(landingStatus('2026-08-01', null, TODAY)).toEqual({
      kind: 'ongoing',
      dday: null,
    });
  });

  it('둘 다 모르면 ongoing 이다', () => {
    expect(landingStatus(null, null, TODAY)).toEqual({
      kind: 'ongoing',
      dday: null,
    });
  });

  it('읽을 수 없는 날짜는 없는 것으로 친다 — 크롤링 원문이 그대로 들어온다', () => {
    expect(landingStatus('내일부터', '2026-09-23', TODAY)).toEqual({
      kind: 'ongoing',
      dday: 30,
    });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/landingStatus.test.ts
```

Expected: FAIL — `Failed to resolve import "./landingStatus"`

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/landingStatus.ts`:

```ts
import { parseDate, startOfDay } from './popupSlices';

/**
 * 랜딩 목록의 한 팝업이 지금 어떤 상태인가.
 *
 * <p>{@code ongoing} 이 {@code dday} 를 함께 들고 있는 것은 배지가 그 숫자로 색을 고르기
 * 때문이다(오늘 마감은 빨강, 사흘 이내는 주황, 그 밖은 라임). 상시 운영이면 셀 것이 없어 null 이다.
 */
export type LandingStatus =
  | { kind: 'upcoming'; opensIn: number }
  | { kind: 'ongoing'; dday: number | null }
  | { kind: 'ended' };

/** 두 날짜 사이의 일수. 읽을 수 없으면 null. */
function daysBetween(value: string | null, today: Date): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return Math.round((startOfDay(parsed).getTime() - today.getTime()) / 86_400_000);
}

/**
 * 시작일과 종료일을 <b>둘 다</b> 보고 가른다.
 *
 * <p>예전에는 종료일만 봤고, 그래서 아직 열지 않은 팝업이 '진행 중' 으로 나왔다. 목록에서 가장
 * 강한 신호가 배지라, 그 한 칸이 틀리면 나머지가 다 맞아도 사람은 헛걸음한다.
 *
 * <p>날짜를 모르는 쪽은 <b>열려 있는 것으로</b> 본다. 이 목록은 이미 만료·오래된 것을 걸러낸
 * 뒤이므로, 여기 있다는 사실 자체가 "지금 볼 만하다" 는 뜻이다. 모른다고 숨기면 상시 운영
 * 팝업이 통째로 사라진다.
 */
export function landingStatus(
  startDate: string | null,
  endDate: string | null,
  today: Date,
): LandingStatus {
  const toEnd = daysBetween(endDate, today);
  if (toEnd !== null && toEnd < 0) return { kind: 'ended' };

  const toStart = daysBetween(startDate, today);
  if (toStart !== null && toStart > 0) return { kind: 'upcoming', opensIn: toStart };

  return { kind: 'ongoing', dday: toEnd };
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/landingStatus.test.ts
```

Expected: PASS — 8 tests

- [ ] **Step 5: 문구를 세 언어에 넣는다**

`src/lib/landingCopy.ts` 의 `LandingCopy` 타입(38행부터)에서 `ddayOngoing: string;` 바로 아래에 더한다:

```ts
/** 아직 열지 않은 팝업의 배지. 며칠 뒤에 여는지. */
ddayOpensIn: (days: number) => string;
```

그리고 세 테이블 모두에, 각자의 `ddayOngoing` 바로 아래에:

```ts
// ko (288행 근처)
  ddayOpensIn: (d) => `${d}일 뒤 오픈`,
// en (461행 근처)
  ddayOpensIn: (d) => `Opens in ${d}d`,
// ja (618행 근처)
  ddayOpensIn: (d) => `あと${d}日で開始`,
```

**세 곳을 다 채우기 전에는 `tsc` 가 통과하지 않는다.** 그것이 이 파일의 안전장치다.

```bash
cd popspot-frontend && npm run typecheck
```

- [ ] **Step 6: 배지를 고친다**

`app/popups/[slug]/page.tsx` 의 `ddayBadge`(299행)를 상태를 받도록 바꾼다:

```ts
/** 상태 → 배지(문구·색). 종료·상시는 무배지. */
function ddayBadge(status: LandingStatus, copy: LandingCopy): { text: string; cls: string } | null {
  // 아직 안 연 것에 '진행 중' 을 달던 자리다. 색도 라임(가도 된다)이 아니라 중립으로 둔다.
  if (status.kind === 'upcoming')
    return {
      text: copy.ddayOpensIn(status.opensIn),
      cls: 'bg-gray-200 text-gray-700',
    };
  if (status.kind === 'ended') return null;
  const dday = status.dday;
  if (dday === null) return null;
  if (dday === 0) return { text: copy.ddayToday, cls: 'bg-red-500 text-white' };
  if (dday === 1) return { text: copy.ddayTomorrow, cls: 'bg-red-500 text-white' };
  // 'D-3' 표기는 한국에서만 통한다. 영어권은 '3d', 일본은 'あと3日' 로 읽는다.
  if (dday <= 3) return { text: copy.ddayValue(dday), cls: 'bg-orange-500 text-white' };
  if (dday <= 7) return { text: copy.ddayValue(dday), cls: 'bg-amber-400 text-ink-900' };
  return { text: copy.ddayOngoing, cls: 'bg-lime-300 text-ink-900' };
}
```

호출부를 찾아 `landingStatus(m.startDate, m.endDate, today)` 를 넘기도록 고친다. `ddayOf` 가 다른 곳(정렬 등)에서도 쓰이면 **그대로 둔다** — 이번에 바꾸는 것은 배지뿐이다.

- [ ] **Step 7: 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run
```

- [ ] **Step 8: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/lib/landingStatus.ts src/lib/landingStatus.test.ts src/lib/landingCopy.ts "app/popups/[slug]/page.tsx"
```

```bash
git add -A && git commit -m "fix(landing): stop calling a pop-up open before it opens"
```

---

### Task 2: 곧 열리는 팝업

**Files:**

- Modify: `src/lib/landingCopy.ts` (섹션 제목 3언어)
- Modify: `app/popups/[slug]/page.tsx`

**Interfaces:**

- Consumes: `landingStatus` (Task 1)
- Produces: 없음

Task 1 이 없으면 이 섹션은 **본문 목록과 모순된다** — 같은 팝업이 위에서는 "곧 열림", 아래에서는 "진행 중" 이 된다. 반드시 Task 1 뒤에 한다.

- [ ] **Step 1: 문구를 세 언어에 넣는다**

`LandingCopy` 에:

```ts
/** 곧 열리는 팝업 섹션의 제목. */
upcomingHeading: string;
/** 그 섹션의 한 줄 설명. */
upcomingNote: string;
```

```ts
// ko
  upcomingHeading: '곧 열리는 팝업',
  upcomingNote: '아직 열지 않았습니다. 여는 날 순서입니다.',
// en
  upcomingHeading: 'Opening soon',
  upcomingNote: 'Not open yet — sorted by opening day.',
// ja
  upcomingHeading: 'まもなく開催',
  upcomingNote: 'まだ開いていません。開始日順です。',
```

- [ ] **Step 2: 섹션을 그린다**

본문 목록(906-997행) **아래**, `FeedbackNote`(1071행) 위에 둔다. 목록이 이 페이지의 본선이므로 그 앞을 가로막지 않는다.

`landingStatus` 가 `upcoming` 인 것만 모아 **`opensIn` 오름차순**으로 정렬한다. 마감일 순이 아니다 — 이 섹션의 질문은 "언제 갈 수 있나" 다.

한 건도 없으면 **섹션 자체를 그리지 않는다**(빈 제목만 남기지 않는다).

- [ ] **Step 3: 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run
```

- [ ] **Step 4: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/lib/landingCopy.ts "app/popups/[slug]/page.tsx"
```

```bash
git add -A && git commit -m "feat(landing): show what has not opened yet, in opening order"
```

---

### Task 3: 도보 산수를 꺼내고 묶는 함수를 만든다

**Files:**

- Create: `src/lib/walkGroups.ts`
- Create: `src/lib/walkGroups.test.ts`
- Modify: `app/planning/page.tsx` (자기 사본을 지우고 새 모듈을 쓴다)

**Interfaces:**

- Consumes: 없음
- Produces: `walkInfo(lat1, lng1, lat2, lng2): { dist: string; time: number }`, `walkGroups<T>(items: T[], coord: (item: T) => { lat: number; lng: number } | null, maxMinutes?: number): { members: T[]; minutes: number }[]`

**네트워크 호출이 없다.** 하버사인 × 1.3 ÷ 분속 67m 는 좌표만으로 끝난다. OSRM 도 TMAP 도 부르지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';

import { walkGroups, walkInfo } from './walkGroups';

/**
 * 걸어서 묶기.
 *
 * <p>작전지도({@code app/planning/page.tsx})가 쓰던 산수를 그대로 꺼내 온 것이다. 그 화면의 도보
 * 시간은 <b>라우팅 API 에서 온 적이 없다</b> — OSRM 은 지도에 선을 그리려고만 부르고 응답의
 * duration·distance 는 버린다. 그래서 이 계산은 좌표만 있으면 되고, 랜딩 840 개에 얹어도 호출이
 * 0 번이다.
 *
 * <p>값을 바꾸지 않는다. 1.3 배와 분속 67m 는 작전지도가 쓰던 그대로다 — 두 화면이 같은 거리를
 * 다르게 말하면 어느 쪽도 믿을 수 없다.
 */
/*
 * 좌표는 손으로 계산해 둔 값이다. 위도 0.005° ≈ 556m 이고, 도보 보정 1.3 배를 먹이면 723m,
 * 분속 67m 로 약 11분이다 — 20분 한도 안에 들어온다. 성수와 홍대는 직선 약 11.7km 라
 * 도보 15.3km, 228분이 되어 어떤 한도로도 묶이지 않는다.
 */
const 성수 = { lat: 37.5446, lng: 127.0559 };
const 성수옆 = { lat: 37.5496, lng: 127.0559 }; // 북쪽으로 0.005° ≈ 556m
const 홍대 = { lat: 37.5563, lng: 126.9236 };
const 홍대옆 = { lat: 37.5613, lng: 126.9236 };

describe('walkInfo', () => {
  it('1km 를 넘지 않으면 미터로 말한다', () => {
    const near = walkInfo(성수.lat, 성수.lng, 성수옆.lat, 성수옆.lng);
    // endsWith('m') 로는 '2.1km' 도 통과한다. 단위 자리를 통째로 본다.
    expect(near.dist).toMatch(/^\d+m$/);
    expect(near.time).toBeGreaterThan(0);
  });

  it('1km 를 넘으면 킬로미터로 말한다', () => {
    expect(walkInfo(성수.lat, 성수.lng, 홍대.lat, 홍대.lng).dist).toMatch(/^\d+\.\dkm$/);
  });

  it('같은 자리는 0분이다', () => {
    expect(walkInfo(37.5, 127.0, 37.5, 127.0)).toEqual({ dist: '0m', time: 0 });
  });

  it('작전지도와 같은 값을 낸다 — 1.3 배와 분속 67m', () => {
    // 위도 1도 = 6371km × π/180 = 111.1949km. × 1.3 = 144.5534km = 144553.4m.
    // 144553.4 / 67 = 2157.51 → 반올림 2158. 이 숫자가 두 상수를 동시에 붙잡는다.
    expect(walkInfo(37.0, 127.0, 38.0, 127.0).time).toBe(2158);
  });
});

describe('walkGroups', () => {
  const coord = (p: { lat: number; lng: number } | null) => p;

  it('걸어갈 만한 것끼리 한 묶음이 된다', () => {
    const groups = walkGroups([성수, 성수옆], coord, 20);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toEqual([성수, 성수옆]);
  });

  it('걸어갈 수 없는 거리면 묶이지 않는다', () => {
    // 성수↔홍대는 도보 228분이다. 20분 한도에서 둘 다 혼자 남으므로 묶음이 하나도 없다.
    expect(walkGroups([성수, 홍대], coord, 20)).toEqual([]);
  });

  it('좌표가 없는 것은 어느 묶음에도 안 들어간다 — 지어내지 않는다', () => {
    const groups = walkGroups([성수, null, 성수옆], coord, 20);
    expect(groups.flatMap((g) => g.members)).toEqual([성수, 성수옆]);
  });

  it('혼자인 것은 묶음이 되지 않는다 — "걸어서 묶기" 는 둘 이상일 때만 뜻이 있다', () => {
    expect(walkGroups([성수], coord, 20)).toEqual([]);
  });

  it('한도를 넘기면 갈라진다 — 경계가 실제로 작동한다', () => {
    // 성수↔성수옆은 약 11분이다. 한도를 10분으로 낮추면 갈라져 묶음이 사라진다.
    expect(walkGroups([성수, 성수옆], coord, 20)).toHaveLength(1);
    expect(walkGroups([성수, 성수옆], coord, 10)).toEqual([]);
  });

  it('묶어도 항목이 사라지거나 겹치지 않는다', () => {
    const members = walkGroups([성수, 성수옆, 홍대, 홍대옆], coord, 20).flatMap((g) => g.members);
    expect(members).toHaveLength(4);
    expect(new Set(members).size).toBe(4);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/walkGroups.test.ts
```

Expected: FAIL — `Failed to resolve import "./walkGroups"`

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/walkGroups.ts`. `walkInfo` 의 본문은 `app/planning/page.tsx:190-204` 를 **값 하나 바꾸지 말고** 옮긴다.

묶는 방식은 단순 탐욕법이다: 아직 안 묶인 첫 항목을 잡고, 그로부터 `maxMinutes` 이내인 것을 모으고, 반복한다. 최적 군집화가 아니다 — 그럴 필요가 없고, 결과가 입력 순서에 대해 결정적이어야 테스트가 선다. 그 이유를 JSDoc 에 적는다.

`maxMinutes` 기본값은 **15** 로 둔다. 근거를 주석에 적을 것: 작전지도의 분속 67m 로 15분이면 약 1km 이고, 그보다 멀면 "걸어서" 라고 부르기 어렵다.

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/walkGroups.test.ts
```

Expected: PASS — 8 tests

- [ ] **Step 5: 작전지도가 새 모듈을 쓰게 한다**

`app/planning/page.tsx` 의 `calculateRouteInfo`(190-204행)를 지우고 `import { walkInfo } from '@/lib/walkGroups';` 로 바꾼다. 호출부는 이름만 바뀐다.

**화면에 나오는 숫자가 하나도 달라지면 안 된다.** 같은 함수를 옮긴 것뿐이다.

- [ ] **Step 6: 사보타주로 감시선을 확인한다**

`walkInfo` 의 `1.3` 을 `1.0` 으로 잠깐 바꾸고 `npx vitest run src/lib/walkGroups.test.ts` 를 돌려 **"작전지도와 같은 값을 낸다" 테스트가 실패하는 것**을 확인한 뒤 되돌린다. 두 출력을 보고에 적는다.

- [ ] **Step 7: 게이트를 돌리고 커밋한다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run
```

```bash
cd popspot-frontend && npx prettier --write src/lib/walkGroups.ts src/lib/walkGroups.test.ts app/planning/page.tsx
```

```bash
git add -A && git commit -m "refactor(walk): lift the walking-time arithmetic out of the planning page"
```

---

### Task 4: 랜딩에 걸어서 묶기

**Files:**

- Modify: `src/lib/landingCopy.ts` (문구 3언어)
- Modify: `app/popups/[slug]/page.tsx`

**Interfaces:**

- Consumes: `walkGroups` (Task 3)
- Produces: 없음

- [ ] **Step 1: 문구를 세 언어에 넣는다**

```ts
/** 도보 묶음 제목. 예: "걸어서 12분" */
walkGroupLabel: (minutes: number) => string;
/** 묶기 섹션의 제목. */
walkHeading: string;
```

```ts
// ko
  walkGroupLabel: (m) => `걸어서 ${m}분`,
  walkHeading: '걸어서 묶어 보기',
// en
  walkGroupLabel: (m) => `${m} min walk`,
  walkHeading: 'Group them by walking distance',
// ja
  walkGroupLabel: (m) => `徒歩${m}分`,
  walkHeading: '徒歩でまとめる',
```

- [ ] **Step 2: 섹션을 그린다**

목록 위, "지금 고른다면"(843-904행) 아래에 둔다. 축이 `결정 → 실행` 이므로 고른 다음이 실행이다.

`latitude`/`longitude` 는 **문자열**이다(`PublicMapMarker`). `Number()` 로 바꾸고 `Number.isFinite` 로 거른다.

**좌표가 없는 것을 숨기지 않는다.** 성수는 98곳 중 65곳(66%)만 좌표가 있다. 묶인 것을 이 섹션에 보여주고, **본문 목록은 지금 그대로 전부 남긴다** — 묶이지 않았다고 목록에서 빠지면 안 된다.

묶음이 하나도 없으면 섹션을 그리지 않는다.

- [ ] **Step 3: 게이트를 돌리고 커밋한다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run
```

```bash
cd popspot-frontend && npx prettier --write src/lib/landingCopy.ts "app/popups/[slug]/page.tsx"
```

```bash
git add -A && git commit -m "feat(landing): group nearby pop-ups by how far you would walk"
```

---

### Task 5: 의견 보내기를 그 자리 폼으로

**Files:**

- Modify: `app/popups/[slug]/page.tsx` (`FeedbackNote`, 1170-1202행)

**Interfaces:**

- Consumes: `FeedbackForm` (`src/features/feedback/FeedbackForm.tsx`)
- Produces: 없음

`FeedbackForm` 은 `{ userId, onSubmitted }` 를 받고 `userId: null` 이면 게스트 모드다. `POST /api/feedback` 은 공개라 **백엔드 변경이 없다.**

- [ ] **Step 1: 링크를 폼으로 바꾼다**

`FeedbackNote` 안의 `<Link href="/feedback" prefetch={false}>` 를 `<FeedbackForm userId={null} />` 로 바꾼다.

`FeedbackForm` 은 `'use client'` 이고 `useLocale()` 을 쓴다. 이 페이지는 서버 컴포넌트이므로 **클라이언트 섬으로 들어간다** — 렌더 위치가 `LocaleProvider` 안인지 확인하고, 아니면 `useLocale()` 의 provider-없음 폴백(한국어)이 걸린다는 것을 보고에 적는다.

**같이 사라지는 버그**: 1193행이 `href="/feedback"` 를 하드코딩해서 `/en/popups/*` · `/ja/popups/*` 방문자가 한국어 페이지로 떨어졌다. 링크가 없어지면 이 문제도 없어진다.

- [ ] **Step 2: 접힌 채로 시작한다**

폼을 펼친 채로 두면 목록 아래에 입력칸 네 개가 늘 붙는다. 제목 줄을 누르면 펴지게 한다 — 지금 링크가 차지하던 만큼만 자리를 쓴다.

- [ ] **Step 3: 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

`npm run build` 를 여기서 돌리는 이유: 서버 컴포넌트 안에 클라이언트 컴포넌트를 넣는 변경이라 **빌드에서만 드러나는 오류**가 있다.

- [ ] **Step 4: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write "app/popups/[slug]/page.tsx"
```

```bash
git add -A && git commit -m "feat(landing): let people say something without leaving the page"
```

---

## 끝나고 확인할 것

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

브라우저(컨트롤러가 확인):

- `/popups/seongsu` 에서 **아직 안 연 팝업이 '진행 중' 배지를 달지 않는다**
- 곧 열리는 섹션이 **여는 날 순**이고, 본문 목록과 상태가 어긋나지 않는다
- 걸어서 묶기가 뜨고, **본문 목록의 개수가 줄지 않았다**
- 의견 폼이 로그인 없이 제출된다
- `/en/popups/seongsu` · `/ja/popups/seongsu` 에서 새 문구 세 종이 번역돼 나온다
- 네트워크 탭에 **`osrm` 도 `tmap` 도 없다**

## 범위 밖

- **실제 지도** — `seoul.pmtiles` 가 58.9MB 다. 대역폭 대책(줌 상한 · 지역 타일 분리 · 정적 이미지)을 정한 뒤에 한다.
- **사진 / 요일 / 입장료** — 요일·입장료는 컬럼도 DTO 도 없다. 사진은 `/api/map/markers` 가 안 준다. 셋 다 jar 배포가 필요하다.
- **`/api/tmap/route` 잠그기** — 유료 키 · 인증 없음 · 호출부 0. 별건.
- **목록 길이 · FAQ · JSON-LD** — 원안이 건드리지 말라고 했고, 근거(상관 −0.15)도 그 편이다.
