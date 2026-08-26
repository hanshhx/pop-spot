# 메인 화면 — 세 자리에 각자의 일을 주고, 850곳으로 들어가는 문을 낸다

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세 목록이 같은 팝업을 돌려 쓰는 것을 멈춘다. 각 자리에 **다른 일**을 주고, 850곳으로 들어가는 **여러 개의 문**을 낸다. 배치·크기는 그대로 둔다.

**Architecture:** 정렬 축만 바꾸는 것으로는 부족하다 — 이름과 내용이 어긋나 있는 게 근본이다. **자리마다 역할을 재정의**하되 화면 배치는 안 건드린다.

**Tech Stack:** Next.js App Router(커스텀 빌드), React 19, Tailwind v4, TypeScript strict, vitest 4.

---

## 소유자가 정한 것

- **POP-LOOK(1+7칸) = 인기 랭킹.** 가장 큰 자리가 랭킹을 맡는다.
- **벤토 4칸 = 전체 둘러보기 입구.** 850곳으로 들어가는 문.
- **레일 30칸 = 「지금 뜨는」.** 진짜 트렌딩. 다만 신호가 백엔드에 있어 **이번엔 프론트만** 하고 다음 배포에 갈아끼운다.
- **모든 개수를 850으로 통일한다.**
- **가장 중요한 것은 편의성과 가독성** — 몇백 곳으로 **다양하게 들어갈 수 있어야** 한다.

---

## 지금 무슨 일이 벌어지는가 — 실측 (2026-08-26)

`hotPopups`(`HomeClient.tsx:506-514`) = `dedupedPopups → hasRealMapLocation → viewCount desc → slice(0,8)`. 이 여덟이 **네 자리**에 들어간다:

| 자리                | 줄            | 먹는 것                                       |
| ------------------- | ------------- | --------------------------------------------- |
| 게스트 히어로 2×2   | `:1457-1459`  | `hotPopups.slice(0,4)`                        |
| 벤토 실시간 랭킹    | `:1627`       | `popups={hotPopups}` (안에서 4만 그림)        |
| POP-LOOK 대표 + 7곳 | `:517`·`:522` | `hotPopups[0]` + `hotPopups.slice(1)`         |
| 레일 30곳           | `:452`        | 기본 정렬이 인기순 → **상위 8곳이 위와 동일** |

**네 번째 중복(레일)은 원안이 놓쳤다.**

### 데이터는 충분하다

|                                              |                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| 전체 피드                                    | 1,169곳                                                                    |
| 오늘 열려 있는 것(`keepOpenNow`)             | 1,002곳                                                                    |
| **그중 지도에 찍히는 것 = 화면이 말할 숫자** | **850곳**                                                                  |
| **이번 주 새로 시작(08-20~26)**              | **154곳**                                                                  |
| 일주일 안 마감(~09-02)                       | 285곳                                                                      |
| 앞으로 열릴 것                               | 90곳                                                                       |
| 카테고리                                     | 패션 267 · 캐릭터 248 · 푸드 248 · 뷰티 154 · 문화 130 · 기타 90 · 테크 32 |
| 지역                                         | 강남 103 · 성동 88 · 성수 66 · 용산 48 · 잠실 43 · 마포 32                 |

**매주 154곳이 새로 들어오는데** 화면은 오염된 누적 카운터 하나로만 정렬돼 그게 안 보인다. "어제 온 사람이 오늘 와도 같은 화면" 의 진짜 원인이다.

### 순위의 근거가 사람 조회수가 아니다

인증 없이 같은 상세를 세 번 GET 하니 `108 → 109 → 110` 으로 올랐다(실측). 세션·중복제거·봇필터가 없다. 총 40,152뷰인데 인간 방문 최고치는 하루 187명이다.

**진짜 신호는 이미 있다** — `visit_event` 표에 `popup_id` + `created_at` 이 있고 인덱스 주석이 _"어떤 팝업이 많이 눌렸나 — 이 표를 만든 첫 번째 이유"_ 라고 적혀 있다. `VisitEventRepository.topPopups(since, type, limit)` 와 `VisitService.topOpenedPopups(days, limit)` 도 이미 있고 **고유 방문자와 총 열람을 구분**한다. 다만 `AdminVisitController`(`@PreAuthorize("hasAnyRole('ADMIN','ANALYTICS')")`) 뒤에 있어 공개 경로가 없다.

공개 `/api/popups/trending` 은 `ORDER BY COALESCE(p.viewCount,0) DESC` — 똑같이 오염된 값이다.

---

## Global Constraints

이 절은 **모든 태스크의 요구사항에 자동으로 포함된다.**

- **배치·크기 변경 금지.** 섹션을 옮기거나 지우지 않는다. 각 자리가 받는 **카드 수를 유지**해 높이·간격이 변하지 않게 한다. 바뀌는 것은 **내용과 이름**이다.
- **백엔드 변경 금지.** 수동 jar 배포가 필요하다. Task 6 은 프론트에서 되는 것까지만 하고 나머지는 문서로 남긴다.
- **새 의존성 금지.**
- **화면이 말하는 팝업 수는 850(`mappablePopupCount`) 하나로 통일한다.** `allPopups.length`(1,002)를 화면에 쓰지 않는다.
- **`npm run format` 금지.** 파일 단위로 `npx prettier --write <path>` 만.
- `npm run format:check` 는 시작 전부터 **이미 빨갛다**(`src/data/emergency/popups-2026-08-11.json`). 네 탓이 아니다.
- Prettier: singleQuote, semi, printWidth 100, trailingComma "all", arrowParens "always", endOfLine **lf**.
- 테스트는 **`node`** 환경, **`globals: false`** — `import { describe, expect, it } from 'vitest';` 명시.
- 주석은 한국어 JSDoc(`<b>`/`<p>`)으로 **왜** 그런지. `it()` 문자열은 완결된 평서문.
- 게이트: `npm run typecheck` · `npm run lint` · `npx vitest run` · **`npm run build`**.
- **줄 번호는 매 태스크마다 다시 확인한다.** 저장소에 `.claude/worktrees/…/HomeClient.tsx` **옛 사본**이 있다. `popspot-frontend/app/HomeClient.tsx` 만 읽는다.
- 날짜 판정에 `src/lib/dday.ts` 금지 — 로컬 `setHours` 라 Vercel(UTC)에서 KST 00:00–09:00 하루가 어긋난다. `kstTodayStart()`(`src/lib/popupSlices.ts`)를 쓴다.
- **측정할 수 없는 것을 이름으로 약속하지 않는다.** 이 계획의 핵심 원칙이다.
- 브랜치 `claude/main-variety`(이미 있음). **푸시하지 않는다.**

---

## 세 자리의 새 역할

| 자리          | 칸  | 지금        | 바꾼 뒤                                                    | 왜                           |
| ------------- | --- | ----------- | ---------------------------------------------------------- | ---------------------------- |
| POP-LOOK      | 1+7 | 인기 랭킹   | **인기 랭킹**(그대로, 여기가 유일한 랭킹)                  | 가장 큰 자리가 랭킹을 맡는다 |
| 벤토          | 4   | 인기 상위 4 | **850곳으로 들어가는 문 4개**                              | 몇백 곳을 훑는 입구          |
| 레일          | 30  | 인기순 30   | **이번 주 새로 시작한 것**(잠정) → 다음 배포에 진짜 트렌딩 | 매주 154곳이 새로 들어온다   |
| 게스트 히어로 | 4   | 인기 상위 4 | **마감 임박 4**                                            | 로그아웃 첫 화면의 긴급성    |

첫 화면 서로 다른 팝업: **8곳 → 16곳 + 입구 4개.**

---

## File Structure

| 파일                                             | 책임                                  |
| ------------------------------------------------ | ------------------------------------- |
| `src/lib/homeSurfaces.ts` (신규)                 | 자리별로 겹치지 않게 나누는 순수 함수 |
| `src/lib/homeSurfaces.test.ts` (신규)            | 위 함수의 테스트                      |
| `src/lib/catalogDoors.ts` (신규)                 | 벤토 입구 4개(라벨·개수·링크) 계산    |
| `src/lib/catalogDoors.test.ts` (신규)            | 위 함수의 테스트                      |
| `app/HomeClient.tsx` (수정)                      | 자리별 분배, 850 통일, 스크롤 저장    |
| `src/lib/popupLocale.ts` (수정)                  | 근거 없는 "영업중" 폴백 제거          |
| `src/features/popup/AllTrendingModal.tsx` (수정) | 열림 상태를 history 에                |

---

### Task 1: 화면이 말하는 개수를 850 하나로 통일

가장 싸고 안전하다. 먼저 한다.

**Files:** Modify `popspot-frontend/app/HomeClient.tsx`

**실측:** `allPopups.length` = 1,002 vs `mappablePopupCount`(`:497`) = 850. 한 화면에 「지금 서울에 … 850」·「전체 팝업 850」·「전체 1002」가 함께 나온다. 게다가 **「전체 1002」라고 적힌 칩이 여는 모달은 `popups={mappablePopups}`(`:2713`) 로 850짜리**다 — 광고한 수와 여는 수가 다르다.

- [ ] **Step 1: 화면에 쓰이는 개수를 전부 찾는다**

```bash
cd popspot-frontend && grep -n "allPopups.length\|mappablePopupCount" app/HomeClient.tsx
```

`allPopups.length` 가 **화면에 보이는 숫자**로 쓰이는 곳을 전부 `mappablePopupCount` 로 바꾼다. **계산에만 쓰이는 곳은 건드리지 마라** — 화면 문구만 대상이다. 어느 것이 화면용인지 하나씩 확인한다.

- [ ] **Step 2: 850 의 뜻을 주석으로 못박는다**

`:497` 옆에 남긴다:

```ts
/**
 * 화면이 말하는 팝업 수는 <b>이 하나</b>다. allPopups(1,002)는 오늘 열려 있는 전부이고, 그중
 * 지도에 찍히는 것이 850 이다. 예전엔 벤토 칩만 1,002 를 써서 한 화면에 두 숫자가 나왔고, 그
 * 칩이 여는 모달은 정작 850 짜리였다 — 광고한 수와 여는 수가 달랐다.
 *
 * <p>850 을 고른 이유는 이미 이 파일에 적혀 있다: 지도에 핀이 없는 팝업은 순위에서 눌러도
 * 사용자가 찾을 수 없다. <b>셀 수 있는 것이 아니라 갈 수 있는 것을 센다.</b>
 */
```

- [ ] **Step 3: 폴백 확인**

수신 쪽에 `total || popups.length` 폴백이 있으면 **진짜 0 일 때 "전체 8"** 이 된다. `total ?? popups.length` 로 바꾸거나 없앤다.

- [ ] **Step 4: 게이트 + 눈으로 확인**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

홈에서 개수가 나오는 **모든 자리가 850** 인지, 모달을 열었을 때 항목 수와도 맞는지 센다.

- [ ] **Step 5: 커밋**

```bash
git add popspot-frontend/app/HomeClient.tsx
git commit -m "fix(home): say 850 everywhere, and mean the ones you can actually go to"
```

---

### Task 2: 근거 없이 "영업중" 이라고 단정하는 것

**Files:** Modify `popspot-frontend/src/lib/popupLocale.ts:17-23`, Test `popupLocale.test.ts`(신규)

**Produces:** `popupStatusLabel(status, t): string | null` — **반환 타입이 바뀐다.**

**실측:** `/api/map/markers` 에 `status` 필드가 **아예 없고** 상세 표본 6건 전부 `status: null` 이다. 그런데 `popupLocale.ts:20` 이 `if (!normalized) return t('status.open')` — **모든 랭킹 행이 근거 0 으로 "영업중"** 을 단다.

**이건 어제 상세페이지에서 고친 것과 같은 버그다.** `src/lib/popupDetailStatus.ts` 가 날짜에서 파생하고 날짜조차 없을 때만 "정보 없음" 을 쓴다. **먼저 그 파일을 읽고** 재사용이 맞는지 판단한다.

**부수 사실(고치지는 마라):** 「혼잡」 칩(`HomeBento1a.tsx:52`)이 `p.status === '혼잡'` 을 거는데 status 가 늘 null 이라 **구조적으로 영원히 0건**이다. 이 태스크에서 칩을 없애지 않는다 — 보고서에 사실만 적는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';

import { popupStatusLabel } from './popupLocale';

const t = ((k: string) => k) as never;

describe('popupStatusLabel', () => {
  it('상태를 모르면 null 이다 — 근거 없이 "영업중" 이라고 단정하지 않는다', () => {
    expect(popupStatusLabel(null, t)).toBeNull();
    expect(popupStatusLabel('', t)).toBeNull();
    expect(popupStatusLabel('   ', t)).toBeNull();
  });

  it('백엔드가 실제로 준 상태는 그대로 옮긴다', () => {
    expect(popupStatusLabel('영업중', t)).toBe('status.open');
    expect(popupStatusLabel('EXPIRED', t)).toBe('misc.cardEnded');
  });

  it('모르는 코드는 원문 그대로 둔다', () => {
    expect(popupStatusLabel('점검중', t)).toBe('점검중');
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/popupLocale.test.ts` → 첫 테스트가 `'status.open'` 을 받는다.

- [ ] **Step 3: 구현** — `return t('status.open')` → `return null`, 반환 타입 `string | null`. 왜인지 JSDoc 에 남긴다.

- [ ] **Step 4: 호출부 정리** — `tsc` 가 깨지는 곳이 안전망이다. **null 이면 그 배지를 안 그린다.** 빈 문자열로 눌러 없애지 마라(빈 배지가 남는다).

- [ ] **Step 5: 게이트 + 사보타주 증명** — `return null` 을 되돌려 첫 테스트가 실패하는 것을 **눈으로 본 뒤** 복원. 두 출력을 보고서에.

- [ ] **Step 6: 커밋**

```bash
git commit -m "fix(home): stop asserting 영업중 for pop-ups whose status we never received"
```

---

### Task 3: 목록에서 상세로 갔다 오면 맨 위로 튀는 것

**Files:** Modify `popspot-frontend/app/HomeClient.tsx` — 저장부(`:952`), 복원부(`:968-969`)

**실측:** 저장은 지도 마커 경로 **한 곳뿐**(`:952`, 소비 `:962`). 그런데 홈에서 상세로 가는 `router.push('/popup/...')` 는 **8곳**이다. 30개짜리 레일에서 14번째를 눌러 본 사람은 돌아올 때마다 처음부터 스크롤한다.

**편의성 항목이다.** 몇백 곳을 훑게 만들려면 훑던 자리로 돌아와야 한다.

- [ ] **Step 1: 저장을 함수로 꺼낸다** — `:952` 로직을 `saveMapReturnState()` 로 묶는다. 이 스텝에서 동작을 바꾸지 않는다.

- [ ] **Step 2: 나머지 경로에 붙인다** — `/popup/` 로 가는 모든 `router.push` **직전**에 부른다.

```bash
grep -n "router.push(localizedPath(\`/popup/" app/HomeClient.tsx
```

하나도 빠뜨리지 않는다.

- [ ] **Step 3: 조기 삭제를 고친다** — `:968-969` 가 **검증 전에** `removeItem` 을 한다. locale 전환·StrictMode 재마운트가 유효한 항목을 태운다. `removeItem` 을 **복원 성공 뒤로** 옮긴다.

- [ ] **Step 4: 게이트**

- [ ] **Step 5: 눈으로 확인 — 이 태스크의 진짜 검증**

레일을 내려 14번째쯤 카드를 누르고 → 상세에서 뒤로가기 → **그 자리로 돌아오는지**. 레일·벤토·POP-LOOK·지도 마커 네 경로 모두.

- [ ] **Step 6: 커밋**

```bash
git commit -m "fix(home): come back to where you were, not to the top"
```

---

### Task 4: 랭킹 전체보기에서 뒤로가기가 사이트를 떠나는 것

**Files:** Modify `popspot-frontend/src/features/popup/AllTrendingModal.tsx`, 필요시 `HomeClient.tsx:2713`

**실측:** Radix Dialog + `useState`. URL 도 history 항목도 없다. **모바일에서 뒤로가기는 목록이 아니라 홈을 떠난다.** v2.44 에서 랭킹 **카드**는 Link 로 고쳤는데 전체보기 버튼은 button 으로 남았다.

**이번엔 history 만.** 공유 URL 은 라우트가 필요해 범위가 커진다.

- [ ] **Step 1: 열 때 history 항목 하나** — `pushState`, `popstate` 에서 닫기. 닫기 버튼은 `history.back()` 을 불러 항목이 쌓이지 않게.

이 코드베이스에 이미 `?tab=` 패턴이 있다(`HomeClient.tsx:1170`, `src/lib/tabAccess.ts`). 그쪽이 맞다고 판단되면 따르고 **어느 쪽을 왜 골랐는지** 보고서에 적는다.

- [ ] **Step 2: 마크업은 안 건드린다** — 상태 관리만.

- [ ] **Step 3: 게이트**

- [ ] **Step 4: 눈으로 확인** — 모바일 폭에서 열고 **뒤로가기** → 홈이 아니라 목록이 닫히는지. 두 번 열었다 닫아도 history 가 이상해지지 않는지.

- [ ] **Step 5: 커밋**

```bash
git commit -m "fix(home): make the back button close the ranking list, not the site"
```

---

### Task 5: 세 자리에 각자의 일을 준다 — 이 계획의 목적

**Files:**

- Create `src/lib/homeSurfaces.ts` + `.test.ts`
- Modify `app/HomeClient.tsx:506-522`(계산), `:1459`·`:1627`(전달)

**Interfaces:**

```ts
export interface HomeSurfaces {
  /** POP-LOOK 대표 + 아래 목록 — 인기 랭킹. 여기가 유일한 랭킹이다. */
  ranking: PopupStore[];
  /** 레일 — 이번 주 새로 시작한 것(잠정). 백엔드 신호가 오면 진짜 트렌딩으로 바뀐다. */
  fresh: PopupStore[];
  /** 게스트 히어로 2×2 — 마감 임박. */
  closing: PopupStore[];
}
export function homeSurfaces(
  pool: PopupStore[],
  today: Date,
  sizes: { ranking: number; fresh: number; closing: number },
): HomeSurfaces;
```

**핵심 규칙:** 앞에서 가져간 것은 뒤에서 뺀다. **칸을 채우려고 같은 것을 두 번 넣지 않는다** — 그러면 고치려던 중복이 그대로 돌아온다. 풀이 모자라면 **덜 채운 채로 둔다.**

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';

import type { PopupStore } from '@/types/popup';
import { homeSurfaces } from './homeSurfaces';

const TODAY = new Date('2026-08-26T00:00:00+09:00');

const p = (id: number, viewCount: number, startDate: string, endDate: string): PopupStore =>
  ({ id, name: `p${id}`, viewCount, startDate, endDate }) as unknown as PopupStore;

const SIZES = { ranking: 2, fresh: 2, closing: 2 };

describe('homeSurfaces', () => {
  it('세 자리가 서로 겹치지 않는다 — 같은 팝업이 두 자리에 나오지 않는다', () => {
    const pool = [
      p(1, 100, '2026-08-01', '2026-12-31'),
      p(2, 90, '2026-08-02', '2026-12-31'),
      p(3, 10, '2026-08-25', '2026-12-31'),
      p(4, 9, '2026-08-24', '2026-12-31'),
      p(5, 1, '2026-01-01', '2026-08-27'),
      p(6, 0, '2026-01-01', '2026-08-28'),
    ];
    const s = homeSurfaces(pool, TODAY, SIZES);
    const ids = [...s.ranking, ...s.fresh, ...s.closing].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('POP-LOOK 은 인기순 상위를 받는다 — 여기가 유일한 랭킹이다', () => {
    const pool = [
      p(1, 100, '2026-08-01', '2026-12-31'),
      p(2, 90, '2026-08-02', '2026-12-31'),
      p(3, 10, '2026-08-25', '2026-12-31'),
      p(4, 9, '2026-08-24', '2026-12-31'),
    ];
    expect(homeSurfaces(pool, TODAY, SIZES).ranking.map((x) => x.id)).toEqual([1, 2]);
  });

  it('레일은 최근 시작한 것을 받되 랭킹이 가져간 것은 뺀다', () => {
    const pool = [
      p(1, 100, '2026-08-25', '2026-12-31'),
      p(2, 90, '2026-08-24', '2026-12-31'),
      p(3, 10, '2026-08-23', '2026-12-31'),
      p(4, 9, '2026-08-22', '2026-12-31'),
    ];
    const s = homeSurfaces(pool, TODAY, SIZES);
    expect(s.ranking.map((x) => x.id)).toEqual([1, 2]);
    expect(s.fresh.map((x) => x.id)).toEqual([3, 4]);
  });

  it('이미 끝난 것은 마감 임박이 아니다', () => {
    const pool = [p(1, 1, '2026-01-01', '2026-08-20'), p(2, 1, '2026-01-01', '2026-08-27')];
    expect(homeSurfaces(pool, TODAY, SIZES).closing.map((x) => x.id)).toEqual([2]);
  });

  it('풀이 모자라면 채우다 만다 — 같은 것을 두 번 넣어 칸을 채우지 않는다', () => {
    const pool = [p(1, 100, '2026-08-25', '2026-12-31'), p(2, 90, '2026-08-24', '2026-12-31')];
    const s = homeSurfaces(pool, TODAY, SIZES);
    expect(s.ranking).toHaveLength(2);
    expect(s.fresh).toHaveLength(0);
  });

  it('빈 풀이면 세 자리 모두 빈 배열이다', () => {
    expect(homeSurfaces([], TODAY, SIZES)).toEqual({ ranking: [], fresh: [], closing: [] });
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/homeSurfaces.test.ts` → `Failed to resolve import`

- [ ] **Step 3: 구현**

```ts
export function homeSurfaces(
  pool: PopupStore[],
  today: Date,
  sizes: { ranking: number; fresh: number; closing: number },
): HomeSurfaces {
  const used = new Set<number>();
  const take = (sorted: PopupStore[], n: number) => {
    const out: PopupStore[] = [];
    for (const item of sorted) {
      if (out.length >= n) break;
      if (used.has(item.id)) continue;
      used.add(item.id);
      out.push(item);
    }
    return out;
  };

  const byPopular = [...pool].sort(
    (a, b) => (b.viewCount || 0) - (a.viewCount || 0) || b.id - a.id,
  );
  const startOf = (p: PopupStore) => parseDate(p.startDate)?.getTime() ?? -Infinity;
  const byLatest = [...pool].sort((a, b) => startOf(b) - startOf(a) || b.id - a.id);
  const endOf = (p: PopupStore) => parseDate(p.endDate)?.getTime() ?? Infinity;
  // 이미 끝난 것은 "마감 임박" 이 아니다 — today 를 받는 유일한 이유다.
  const byDeadline = pool
    .filter((p) => {
      const e = parseDate(p.endDate);
      return e ? e.getTime() >= today.getTime() : false;
    })
    .sort((a, b) => endOf(a) - endOf(b) || (b.viewCount || 0) - (a.viewCount || 0));

  return {
    ranking: take(byPopular, sizes.ranking),
    fresh: take(byLatest, sizes.fresh),
    closing: take(byDeadline, sizes.closing),
  };
}
```

**세 정렬은 새로 만든 것이 아니라 레일의 규칙 그대로다**(`HomeClient.tsx:434-451`). **구현 전에 그 줄들을 읽고 대조하라.** 어긋나면 레일 쪽이 정답이다. `parseDate` 도 레일이 쓰는 것을 import 한다(달력 실재성 검증으로 이월 방지).

**호출 순서가 곧 우선권이다** — `ranking` 이 먼저 집어간다. 임의로 바꾸지 마라.

- [ ] **Step 4: 통과 확인** (6개)

- [ ] **Step 5: HomeClient 에 붙인다**

- POP-LOOK(`:517`·`:522`) ← `ranking[0]` + `ranking.slice(1)` (8개)
- 레일 ← `fresh` (30개) — **레일의 카테고리·정렬 칩은 그대로 둔다.** 그게 몇백 곳을 훑는 힘이다
- 게스트 히어로(`:1459`) ← `closing` (**4개 그대로**)

**게스트 히어로는 4개를 유지한다** — 주석(`:186-187`)이 280px 카드의 2×2 라 늘리면 무너진다고 명시했다. 개수는 유지하고 내용만 바꾼다.

- [ ] **Step 6: 이름을 내용과 맞춘다**

레일이 「지금 뜨는 팝업」인데 내용이 최신순이면 **이름이 거짓말이 된다.** 이번 단계에서는 **측정할 수 있는 것만 약속한다** — 「이번 주 새로 열린 곳」처럼 사실인 이름으로 바꾼다. 3개 로케일 모두. 백엔드 신호가 오면 Task 6 에서 되돌린다.

**이 스텝을 건너뛰지 마라.** 이름과 내용이 어긋난 것이 이 계획이 존재하는 이유다.

- [ ] **Step 7: 게이트 + 사보타주 증명**

`take()` 의 `if (used.has(item.id)) continue;` 를 지우고 「세 자리가 서로 겹치지 않는다」 가 실패하는 것을 **눈으로 본 뒤** 되돌린다.

- [ ] **Step 8: 눈으로 세어 본다 — 이 태스크의 진짜 검증**

홈을 열어 **첫 화면부터 레일 끝까지 서로 다른 팝업 이름이 몇 개인지 직접 센다.** 8개면 실패다. 로그인·로그아웃 양쪽에서 센다.

**같은 이름이 두 자리에 나오면 개수가 아니라 그것이 실패다.**

- [ ] **Step 9: 커밋**

```bash
git commit -m "feat(home): give each of the three lists its own job"
```

---

### Task 6: 벤토 4칸 = 850곳으로 들어가는 문

**소유자가 가장 중요하다고 한 것** — "몇백 건에 다양하게 들어갈 수 있어야 한다".

**Files:** Create `src/lib/catalogDoors.ts` + `.test.ts`, Modify `app/HomeClient.tsx:1627` 및 `HomeBento1a`

**설계.** 벤토 4칸이 지금은 인기 팝업 카드 넷이다. **팝업 넷 대신 문 넷**을 둔다 — 각 문은 라벨·개수·링크를 갖는다. 카드 수(4)가 그대로라 격자가 안 변한다.

**문은 이미 만들어 둔 랜딩으로 보낸다.** 어제 `/popups/[slug]` 랜딩 840여 개에 지도까지 붙였다. 지역·카테고리·기간 슬러그가 전부 살아 있다. **새로 만들 것이 없다.**

**Produces:**

```ts
export interface CatalogDoor {
  /** 화면 라벨. i18n 키가 아니라 슬러그다 — 부르는 쪽이 t() 로 바꾼다. */
  key: string;
  /** 이 문 뒤에 몇 곳 있는지. 0 이면 문을 만들지 않는다. */
  count: number;
  /** /popups/[slug] 로 가는 경로. */
  href: string;
}
export function catalogDoors(pool: PopupStore[], today: Date, limit: number): CatalogDoor[];
```

**어떤 문 넷인가 — 넓이가 서로 다른 축을 고른다.** 같은 축으로 넷을 만들면(예: 카테고리 넷) 그것도 한 종류의 반복이다.

권장 조합(실측 기준):

1. **가장 큰 지역** — 강남구 103곳
2. **가장 큰 카테고리** — 패션 267곳
3. **이번 주 새로** — 154곳
4. **곧 마감** — 285곳

**⚠️ 어떤 축을 쓸지는 소유자 판단이다.** 위는 제안이고, 소유자가 바꾸면 따른다. 다만 **네 문의 축이 서로 달라야 한다**는 원칙은 지킨다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';

import type { PopupStore } from '@/types/popup';
import { catalogDoors } from './catalogDoors';

const TODAY = new Date('2026-08-26T00:00:00+09:00');
const p = (id: number, category: string, location: string, start: string, end: string) =>
  ({
    id,
    name: `p${id}`,
    category,
    location,
    startDate: start,
    endDate: end,
  }) as unknown as PopupStore;

describe('catalogDoors', () => {
  it('문 뒤에 아무것도 없으면 그 문을 만들지 않는다 — 눌렀더니 빈 목록인 문은 고장이다', () => {
    const doors = catalogDoors([], TODAY, 4);
    expect(doors).toEqual([]);
  });

  it('각 문은 자기 뒤에 몇 곳 있는지 정확히 센다', () => {
    const pool = [
      p(1, 'FASHION', '서울 강남구', '2026-08-01', '2026-12-31'),
      p(2, 'FASHION', '서울 강남구', '2026-08-01', '2026-12-31'),
      p(3, 'FOOD', '서울 마포구', '2026-08-01', '2026-12-31'),
    ];
    const doors = catalogDoors(pool, TODAY, 4);
    const fashion = doors.find((d) => d.key.includes('fashion'));
    expect(fashion?.count).toBe(2);
  });

  it('네 문의 축이 서로 다르다 — 같은 종류를 넷 늘어놓지 않는다', () => {
    const pool = Array.from({ length: 20 }, (_, i) =>
      p(i, i % 2 ? 'FASHION' : 'FOOD', '서울 강남구', '2026-08-25', '2026-08-28'),
    );
    const doors = catalogDoors(pool, TODAY, 4);
    const axes = new Set(doors.map((d) => d.href.split('/')[2]?.split('-')[0]));
    expect(axes.size).toBeGreaterThan(1);
  });

  it('limit 을 넘지 않는다', () => {
    const pool = Array.from({ length: 50 }, (_, i) =>
      p(i, 'FASHION', '서울 강남구', '2026-08-25', '2026-08-28'),
    );
    expect(catalogDoors(pool, TODAY, 4).length).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

**슬러그는 새로 만들지 마라.** `src/lib/regions.ts`(`REGIONS`)와 `src/lib/popupSlices.ts`(`CATEGORIES`·`getPeriods`)에 이미 있다. 그 슬러그로 `/popups/{slug}` 를 만든다. `classifyRegion`·`classifyCategory` 도 이미 있다 — 분류 규칙을 새로 쓰면 랜딩 페이지가 세는 수와 어긋난다.

**개수가 0 인 문은 만들지 않는다.** 눌렀더니 빈 목록인 문은 기능이 아니라 고장이다.

- [ ] **Step 4: 통과 확인**

- [ ] **Step 5: 벤토에 붙인다**

`HomeBento1a` 의 랭킹 타일을 문 넷으로 바꾼다. **격자·타일 크기는 그대로.** 팝업 카드 대신 「라벨 + 개수 + →」 가 들어간다.

**여권·일정 타일은 건드리지 마라** — 그 자리에 있는 이유가 주석에 남아 있다.

- [ ] **Step 6: 가독성 확인 — 이 태스크의 진짜 검증**

홈 첫 화면만 보고 **"850곳을 어떻게 훑지?" 에 답이 보이는지** 확인한다. 문 넷의 라벨과 개수만 읽고 어디로 갈지 정할 수 있으면 성공이다. 숫자가 없거나 라벨이 모호하면 실패다.

각 문을 실제로 눌러 **랜딩이 열리고 그 개수가 문에 적힌 수와 맞는지** 확인한다. 어긋나면 분류 규칙이 다른 것이다.

- [ ] **Step 7: 게이트 + 커밋**

```bash
git commit -m "feat(home): put four doors into the catalog where four ranked cards used to be"
```

---

### Task 7: viewCount 위생 + 다음 배포 준비

**Files:** Modify `app/popup/[id]/serverData.ts`

**실측:** 인증 없이 GET 세 번에 `108 → 109 → 110`. 총 40,152뷰인데 인간 방문 최고치는 하루 187명. 이 값이 POP-LOOK 랭킹의 근거다.

**프론트에서 할 수 있는 것은 하나 — 우리가 스스로 올리는 것을 멈추는 것.** SSR/ISR 이 `revalidate: 300`(`serverData.ts:91`)으로 상세를 가져올 때마다 +1 된다. 사람이 본 게 아니다.

- [ ] **Step 1: SSR fetch 에 표식을 단다**

`serverData.ts:91` fetch 에 `X-Popspot-Prefetch: 1` 같은 헤더를 싣는다.

**백엔드가 아직 그 헤더를 안 보므로 지금은 효과가 없다.** 보고서에 그 사실을 분명히 적어라 — 효과 있는 척하면 안 된다. 다음 jar 배포 때 한 줄로 받을 수 있게 하는 준비다.

- [ ] **Step 2: 다음 배포용 명세를 남긴다**

`docs/superpowers/plans/` 에 백엔드 할 일을 적는다. 조사해 둔 것:

- **공개 트렌딩 엔드포인트** — `VisitService.topOpenedPopups(days, limit)` 가 이미 있고 `visit_event(popup_id, created_at)` 인덱스도 있다. 지금은 `AdminVisitController`(`@PreAuthorize("hasAnyRole('ADMIN','ANALYTICS')")`) 뒤다. **공개 래퍼 하나면 레일이 진짜 「지금 뜨는」이 된다.**
- **viewCount 위생** — `GET /api/popups/{id}` 가 인증·세션 dedupe·봇 필터 없이 +1 한다. 이미 쌓인 40k 는 소급 정화가 안 되니 **깨끗한 카운터를 따로 세워 병행 관찰 후 갈아타는 편**이 안전하다.
- **`PopupStore.java:265`** 의 외부 map 이 viewCount 를 덮어쓰는 경로 — 지금 호출자가 없지만 크롤러에 물리는 순간 지뢰다.
- **혼잡 데이터** — 「혼잡」 칩이 `p.status === '혼잡'` 을 거는데 백엔드가 popup.status 에 혼잡도를 넣는 경로가 없다.

- [ ] **Step 3: 게이트 + 커밋**

```bash
git commit -m "chore(home): stop our own server renders from inflating the ranking signal"
```

---

## 이 계획이 지키는 원칙

**측정할 수 없는 것을 이름으로 약속하지 않는다.** 레일이 「지금 뜨는」인데 뜨는 것을 측정할 수 없으면, 신호가 올 때까지 **사실인 이름**을 쓴다. 이름과 내용이 어긋난 것이 애초에 이 계획이 생긴 이유다.

**셀 수 있는 것이 아니라 갈 수 있는 것을 센다.** 850 은 오늘 열려 있고 **지도에서 찾을 수 있는** 곳이다. 1,002 곳이 열려 있지만 152 곳은 눌러도 위치를 모른다.

**칸을 채우려고 같은 것을 두 번 넣지 않는다.** 풀이 모자라면 덜 채운 채로 둔다.

## 원안이 틀렸던 것 — 기록

- **"조회수는 상세를 열어야 오른다"** — 틀렸다. 아무 GET 이나 오른다(실측 `108→109→110`). 원안의 「노출→조회→순위」 폐루프는 성립하기 어렵다 — SSR `revalidate: 300` 때문에 오히려 **사람 클릭이 카운터에 거의 안 잡힌다.** 진짜 문제는 루프가 아니라 카운터가 크롤 빈도를 잰다는 것이고 처방이 다르다.
- **"0회 28.4% · 2회 이하 63.5%"** — 2026-08-05 값이다. 2026-08-26 재측정은 **0.6% / 10.9%**(n=1,169). 21일 만에 6배 움직였다. (그 재측정 자체가 상세를 1,169건 호출해 카운터를 그만큼 올렸다 — 카운터가 얼마나 무른지 보여 주는 셈이다.)
- **"1위는 3회, 2~4위는 2회"** — 틀렸다. **2~4위도 3회**다. 그리고 **로그아웃 상태에서만** 참이다(`:1370`).
- **"주석이 렌더에서 또 자르지 말라고 경고한다"** — 절반만 맞다. 다음 문단(`:186-187`)이 게스트 격자를 **명시적으로 예외 처리**해 뒀다. 그 자리는 문서화된 의도다.
- **원안이 놓친 네 번째 중복** — 레일 기본 정렬이 인기순이라 상위 8곳이 벤토와 같다.
- **줄 번호가 7~22줄씩 어긋난다** — `.claude/worktrees/…/HomeClient.tsx` 옛 사본이 있다.

## 넣지 않는 것

**검색을 맨 위로 · 기능소개를 위로** — 순수 레이아웃이다.

**모바일 게스트 D-N 상시 노출** — 768px 아래에 없던 요소를 만들어야 한다. **다만 UI 없이 되는 조각이 하나 있다**: 게스트를 다이얼로그로 시작하는 경로(`HomeClient.tsx:743-745`)가 로그인 경로(`login/page.tsx:171-179`)와 달리 아무 알림도 안 띄운다. 이미 있는 `notify` 로 같은 토스트를 띄우면 새 요소 없이 "시작됐다" 는 전달된다.
