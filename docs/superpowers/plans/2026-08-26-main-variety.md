# 메인 화면 — 더 다양한 팝업이 보이게 + 화면이 거짓말하지 않게

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인의 네 자리가 같은 8곳을 돌려 쓰는 것을 멈추고, **배치를 하나도 안 바꾸면서** 첫 화면 노출을 8곳 → 16곳 이상으로 넓힌다. 겸사겸사 화면이 근거 없이 단정하는 문구 둘을 없앤다.

**Architecture:** UI·디자인은 손대지 않는다(소유자 지시). 섹션을 지우거나 옮기거나 크기를 바꾸지 않는다. **자리는 그대로 두고 각 자리가 먹는 목록을 다르게 한다** — 순수 데이터 변경이다.

**Tech Stack:** Next.js App Router(커스텀 빌드), React 19, Tailwind v4, TypeScript strict, vitest 4.

---

## 지금 무슨 일이 벌어지는가 — 실측

`hotPopups`(`HomeClient.tsx:506-514`)는 `dedupedPopups → hasRealMapLocation → viewCount desc → slice(0, 8)` 이다. 이 여덟이 **네 자리**에 들어간다:

| 자리                | 줄            | 먹는 것                                                        |
| ------------------- | ------------- | -------------------------------------------------------------- |
| 게스트 히어로 2×2   | `:1457-1459`  | `hotPopups.slice(0,4)`                                         |
| 벤토 실시간 랭킹    | `:1627`       | `popups={hotPopups}` (안에서 4만 그림)                         |
| POP-LOOK 대표 + 7곳 | `:517`·`:522` | `hotPopups[0]` + `hotPopups.slice(1)`                          |
| 레일 30곳           | `:452`        | 기본 정렬이 **인기순 = viewCount desc** → 상위 8곳이 위와 동일 |

즉 **네 번째 중복은 원안이 놓쳤다.** 레일이 30곳을 보여 주긴 하지만 그 머리가 같은 8곳이다.

**그런데 순위의 근거인 viewCount 가 사람 조회수가 아니다.** 인증 없이 같은 상세를 세 번 GET 하니 `108 → 109 → 110` 으로 올랐다(2026-08-26 실측). 세션·중복제거·봇필터가 없다. 총 40,152뷰인데 이 사이트 인간 방문 최고치는 하루 187명이다.

---

## Global Constraints

이 절은 **모든 태스크의 요구사항에 자동으로 포함된다.**

- **UI·디자인 변경 금지.** 섹션을 지우거나 옮기거나 크기·간격·색을 바꾸지 않는다. 카드 수가 바뀌어 높이가 달라지는 것도 피한다 — 각 자리가 받는 **개수는 유지**하고 **내용만** 바꾼다.
- **백엔드 변경 금지.** 수동 jar 배포가 필요해 프론트 배포에 못 얹는다. Task 5 는 프론트에서 할 수 있는 것까지만 한다.
- **새 의존성 금지.**
- **`npm run format` 금지.** 무관한 깨진 JSON 을 건드린다. 파일 단위로 `npx prettier --write <path>` 만 쓴다.
- `npm run format:check` 는 시작 전부터 **이미 빨갛다**(`src/data/emergency/popups-2026-08-11.json`). 네 탓이 아니다.
- Prettier: singleQuote, semi, printWidth 100, trailingComma "all", arrowParens "always", endOfLine **lf**.
- 테스트는 **`node`** 환경, **`globals: false`** — `import { describe, expect, it } from 'vitest';` 를 명시한다. DOM 이 진짜 필요할 때만 `// @vitest-environment jsdom`.
- 주석은 한국어 JSDoc(`<b>`/`<p>`)으로 **왜** 그런지 적는다. `it()` 문자열은 완결된 한국어 평서문.
- 게이트: `npm run typecheck` · `npm run lint` · `npx vitest run` · **`npm run build`**.
- **줄 번호는 매 태스크마다 다시 확인한다.** 저장소에 `.claude/worktrees/…/HomeClient.tsx` 라는 **옛 사본**이 있다. `popspot-frontend/app/HomeClient.tsx` 만 읽는다.
- 날짜 판정에 `src/lib/dday.ts` 를 쓰지 마라 — 로컬 `setHours` 라 Vercel(UTC)에서 KST 00:00–09:00 동안 하루가 어긋난다. `kstTodayStart()`(`src/lib/popupSlices.ts`)를 쓴다.
- 브랜치는 `claude/main-variety` 를 `main` 에서 딴다. **푸시하지 않는다.**

---

## File Structure

| 파일                                             | 책임                                          |
| ------------------------------------------------ | --------------------------------------------- |
| `app/HomeClient.tsx` (수정)                      | 자리별 목록 분배, 개수 프롭, 스크롤 저장 호출 |
| `src/lib/homeSurfaces.ts` (신규)                 | 자리별로 겹치지 않게 나누는 순수 함수         |
| `src/lib/homeSurfaces.test.ts` (신규)            | 위 함수의 테스트                              |
| `src/lib/popupLocale.ts` (수정)                  | 근거 없는 "영업중" 폴백 제거                  |
| `src/features/popup/AllTrendingModal.tsx` (수정) | 열림 상태를 history 에 남김                   |

---

### Task 1: "전체" 가 한 화면에서 두 숫자로 나오는 것 — 한 단어

가장 싸고 가장 안전하다. 먼저 한다.

**Files:**

- Modify: `popspot-frontend/app/HomeClient.tsx:1628`

**Interfaces:** 없음.

**실측:** `allPopups.length` = 1002, `mappablePopupCount`(`:497`) = 850. 같은 화면에 「지금 서울에 … 850」·「전체 팝업 850」·「전체 1002」가 함께 나온다. 격차 152(15.2%). 게다가 **「전체 1002」라고 적힌 칩이 여는 모달은 `popups={mappablePopups}`(`:2713`) 로 850짜리다** — 같은 컨트롤이 1002 를 광고하고 850 을 연다.

- [ ] **Step 1: 프롭을 바꾼다**

`:1628` 의 `total={allPopups.length}` → `total={mappablePopupCount}`.

바로 위에 왜인지 한 줄 남긴다:

```tsx
{
  /* 히어로·POP-LOOK 과 같은 기준(mappablePopupCount)을 쓴다. 예전엔 여기만 allPopups.length
    라 한 화면에서 "전체" 가 1002 와 850 두 숫자로 나왔고, 이 칩이 여는 모달은 정작 850
    짜리(mappablePopups)였다 — 광고한 수와 여는 수가 달랐다. */
}
```

- [ ] **Step 2: 폴백도 함께 본다**

수신 쪽에 `total || popups.length` 같은 폴백이 있는지 확인한다. 있으면 **진짜 0 일 때 "전체 8" 이 되는 버그**다 — `total ?? popups.length` 로 바꾸거나 폴백을 없앤다. 없으면 그냥 넘어간다.

- [ ] **Step 3: 게이트**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

- [ ] **Step 4: 눈으로 확인**

홈에서 「전체」가 나오는 세 자리가 **같은 숫자**인지, 칩의 전체보기가 여는 모달 개수와도 맞는지 본다.

- [ ] **Step 5: 커밋**

```bash
git add popspot-frontend/app/HomeClient.tsx
git commit -m "fix(home): make every '전체' on one screen say the same number"
```

---

### Task 2: 근거 없이 "영업중" 이라고 단정하는 것

**Files:**

- Modify: `popspot-frontend/src/lib/popupLocale.ts:17-23`
- Test: `popspot-frontend/src/lib/popupLocale.test.ts` (없으면 신규)

**Interfaces:**

- Produces: `popupStatusLabel(status, t): string | null` — **반환 타입이 바뀐다.** 모르면 `null`.

**실측:** `/api/map/markers` 에 `status` 필드가 **아예 없고**, 상세 응답도 표본 6건 전부 `status: null` 이다. 그런데 `popupLocale.ts:20` 이 `if (!normalized) return t('status.open')` — 즉 **모든 랭킹 행이 근거 0 으로 "영업중"** 을 단다.

**이건 어제 상세페이지에서 고친 것과 같은 버그다.** 그때 만든 `src/lib/popupDetailStatus.ts` 가 날짜에서 파생하고, 날짜조차 없을 때만 "정보 없음" 을 쓴다. **먼저 그 파일을 읽어라** — 여기서도 같은 판단을 재사용할 수 있는지 보고, 재사용이 맞으면 새 규칙을 만들지 말고 그걸 쓴다.

**부수 효과 주의:** 「혼잡」 칩(`HomeBento1a.tsx:52`)이 `p.status === '혼잡'` 을 거는데 status 가 늘 null 이라 **구조적으로 영원히 0건**이다. 이 태스크에서 칩을 없애지는 마라 — 화면에서 컨트롤이 사라지는 것은 소유자 판단 영역이다. 보고서에 사실만 적는다.

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

  it('모르는 코드는 원문 그대로 둔다 — 임의로 바꾸지 않는다', () => {
    expect(popupStatusLabel('점검중', t)).toBe('점검중');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/popupLocale.test.ts
```

Expected: FAIL — 첫 테스트가 `'status.open'` 을 받는다.

- [ ] **Step 3: 구현**

`if (!normalized) return t('status.open');` → `if (!normalized) return null;` 로 바꾸고 반환 타입을 `string | null` 로 넓힌다. 왜인지 JSDoc 에 남긴다:

```ts
/**
 * <p>예전엔 값이 없으면 "영업중" 을 돌려줬다. 그런데 라이브에서 <b>status 는 전 행이 null</b>
 * 이다 — 마커 피드엔 필드조차 없다. 즉 그 폴백은 모든 행에 근거 0 인 단정을 찍고 있었다.
 * 모르면 {@code null} 을 주고, 부르는 쪽이 그 줄을 안 그린다.
 */
```

- [ ] **Step 4: 통과 확인 + 호출부 정리**

`tsc` 가 `string` 을 기대하는 호출부에서 깨진다 — 그게 안전망이다. 각 호출부에서 **null 이면 그 배지/문구를 안 그리게** 한다. `null` 을 빈 문자열로 눌러 없애지 마라(빈 배지가 남는다).

- [ ] **Step 5: 게이트 + 사보타주 증명**

`return null;` 을 다시 `return t('status.open');` 으로 되돌려 첫 테스트가 **실패하는 것을 눈으로 본 뒤** 복원한다. 두 출력을 보고서에 붙인다.

- [ ] **Step 6: 커밋**

```bash
git add popspot-frontend/src/lib/popupLocale.ts popspot-frontend/src/lib/popupLocale.test.ts popspot-frontend/app/HomeClient.tsx
git commit -m "fix(home): stop asserting 영업중 for pop-ups whose status we never received"
```

---

### Task 3: 목록에서 상세로 갔다 오면 맨 위로 튀는 것

**Files:**

- Modify: `popspot-frontend/app/HomeClient.tsx` — 저장 호출부(현재 `:952` 한 곳), 복원부(`:968-969`)

**Interfaces:** 없음(기존 `MAP_RETURN_STATE_KEY` 재사용).

**실측:** 저장은 지도 마커 경로 **한 곳뿐**(`:952`, 소비 `:962`). 그런데 홈에서 상세로 가는 `router.push('/popup/...')` 는 **8곳**이다(`:962`·`:1465`·`:1767`·`:1824`·`:1830`·`:1889` 등). 나머지 경로는 저장을 안 하므로 돌아올 때 맨 위로 간다. 30개짜리 레일에서 14번째를 눌러 본 사람은 매번 처음부터 스크롤한다.

- [ ] **Step 1: 저장을 함수로 꺼낸다**

`:952` 의 저장 로직을 `saveMapReturnState()` 같은 이름의 지역 함수로 묶는다. 로직은 그대로 옮긴다 — 이 스텝에서 동작을 바꾸지 않는다.

- [ ] **Step 2: 나머지 경로에 같은 호출을 붙인다**

`/popup/` 로 가는 모든 `router.push` **직전에** 그 함수를 부른다. `grep -n "router.push(localizedPath(\`/popup/" app/HomeClient.tsx` 로 전부 찾아 하나도 빠뜨리지 않는다.

- [ ] **Step 3: 복원부의 조기 삭제를 고친다**

`:968-969` 가 **검증 전에** `removeItem` 을 한다. 그래서 locale 전환이나 React StrictMode 재마운트가 유효한 항목을 태운다. `removeItem` 을 **복원에 성공한 뒤로** 옮긴다.

- [ ] **Step 4: 게이트**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

- [ ] **Step 5: 눈으로 확인 — 이 태스크의 진짜 검증**

레일을 아래로 스크롤해 14번째쯤 카드를 누르고 → 상세에서 뒤로가기 → **그 자리로 돌아오는지** 본다. 벤토 카드·POP-LOOK 카드·지도 마커 세 경로 모두 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add popspot-frontend/app/HomeClient.tsx
git commit -m "fix(home): come back to where you were, not to the top"
```

---

### Task 4: 랭킹 전체보기에서 뒤로가기가 사이트를 떠나는 것

**Files:**

- Modify: `popspot-frontend/src/features/popup/AllTrendingModal.tsx`
- Modify: `popspot-frontend/app/HomeClient.tsx:2713` (필요한 경우만)

**Interfaces:** 없음.

**실측:** `AllTrendingModal` 은 Radix Dialog 이고 열림 상태가 `useState` 다. URL 도 history 항목도 없다. **모바일에서 뒤로가기는 목록을 닫는 게 아니라 홈을 떠난다.** v2.44 에서 랭킹 **카드**는 Link 로 고쳤는데 전체보기 버튼은 button 으로 남았다.

**이번엔 history 만 넣는다.** 공유 가능한 URL 은 라우트가 필요해 범위가 커진다 — 뒤로가기부터 고치고 라우트는 나중에.

- [ ] **Step 1: 열 때 history 항목을 하나 넣는다**

모달이 열릴 때 `history.pushState`, `popstate` 에서 닫는다. 닫기 버튼으로 닫을 때는 `history.back()` 을 불러 항목이 쌓이지 않게 한다.

**이 코드베이스에 이미 `?tab=` 패턴이 있다**(`HomeClient.tsx:1170`, `src/lib/tabAccess.ts`). 그 방식이 더 맞다고 판단되면 그쪽을 따르고, 보고서에 어느 쪽을 왜 골랐는지 적는다.

- [ ] **Step 2: 마크업은 건드리지 않는다**

`AllTrendingModal.tsx` 의 화면 요소는 그대로 둔다. 상태 관리만 바꾼다.

- [ ] **Step 3: 게이트**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

- [ ] **Step 4: 눈으로 확인**

모바일 폭에서 전체보기를 열고 **뒤로가기** → 홈이 아니라 **목록이 닫히는지**. 두 번 열었다 닫아도 history 가 이상해지지 않는지.

- [ ] **Step 5: 커밋**

```bash
git add popspot-frontend/src/features/popup/AllTrendingModal.tsx popspot-frontend/app/HomeClient.tsx
git commit -m "fix(home): make the back button close the ranking list, not the site"
```

---

### Task 5: viewCount 위생 — 순위의 근거가 봇 시계인 것

**Files:**

- Modify: `popspot-frontend/app/popup/[id]/serverData.ts` (SSR fetch)
- 필요시 `popspot-frontend/src/lib/api.ts`

**Interfaces:** 없음.

**실측(2026-08-26):** 인증 없이 같은 상세를 세 번 GET 하니 `108 → 109 → 110`. 세션·중복제거·봇필터·레이트리밋 없음. 총 40,152뷰인데 인간 방문 최고치는 하루 187명. 이 값이 `hotPopups`·레일 인기순·POP-LOOK·랭킹 모달 **네 자리의 정렬 근거**다.

**프론트에서 할 수 있는 것은 하나다 — 우리가 스스로 올리는 것을 멈추는 것.** SSR/ISR 이 `revalidate: 300`(`serverData.ts:91`)으로 상세를 가져올 때마다 +1 이 된다. 이건 사람이 본 게 아니다.

**할 수 없는 것은 정직하게 적는다:** 봇 필터·세션 dedupe·레이트리밋은 백엔드다. 이미 쌓인 40k 는 소급 정화가 안 된다. **기존 컬럼을 고치려 들지 마라.**

- [ ] **Step 1: SSR fetch 가 카운터를 올리지 않게 한다**

`serverData.ts:91` 의 fetch 에 우리 요청임을 알리는 헤더를 싣는다(예: `X-Popspot-Prefetch: 1`). **백엔드가 아직 그 헤더를 안 보므로 이것만으로는 안 줄어든다** — 그래도 넣는다. 백엔드 배포 때 한 줄로 받을 수 있게 하는 준비이고, 지금 당장은 무해하다.

보고서에 **"이 스텝은 백엔드가 헤더를 볼 때까지 효과가 없다"** 를 분명히 적어라. 효과 있는 척하면 안 된다.

- [ ] **Step 2: 이미 있는 사람-기준 신호를 확인한다**

`PopupDetailClient.tsx:222` 가 이미 `trackVisitEvent('detail_view', ...)` 를 쏜다. **이게 브라우저에서만 도는 사람 기준 신호다.** 이 값이 어디에 쌓이는지, 정렬에 쓸 수 있는 형태로 읽을 수 있는지 조사해 보고서에 적는다.

읽을 수 있으면 그것이 진짜 해법이다 — 다만 **이 태스크에서 정렬을 갈아타지는 마라.** 먼저 두 값을 나란히 관찰할 수 있어야 한다. 조사 결과만 남긴다.

- [ ] **Step 3: 게이트**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

- [ ] **Step 4: 커밋**

```bash
git add "popspot-frontend/app/popup/[id]/serverData.ts"
git commit -m "chore(home): stop our own server renders from inflating the ranking signal"
```

---

### Task 6: 같은 8곳이 네 자리를 돌려 쓰는 것 — 다양성

**이 계획의 목적이다.** 팝업은 1,000곳 넘게 모아 놓고 첫 화면에 여덟 곳만 보여 주고 있다.

**Files:**

- Create: `popspot-frontend/src/lib/homeSurfaces.ts`, `popspot-frontend/src/lib/homeSurfaces.test.ts`
- Modify: `popspot-frontend/app/HomeClient.tsx:506-522`(목록 계산), `:1459`·`:1627`(프롭 전달)

**Interfaces:**

- Consumes: `PopupStore[]`, `kstTodayStart()` from `src/lib/popupSlices.ts`
- Produces:

```ts
export interface HomeSurfaces {
  /** 벤토 랭킹 — 인기순 상위. */
  ranked: PopupStore[];
  /** POP-LOOK 대표 + 아래 목록 — 최근 들어온 것 중 위와 겹치지 않는 것. */
  fresh: PopupStore[];
  /** 게스트 히어로 2×2 — 마감 임박 중 위 둘과 겹치지 않는 것. */
  closing: PopupStore[];
}
export function homeSurfaces(
  pool: PopupStore[],
  today: Date,
  sizes: { ranked: number; fresh: number; closing: number },
): HomeSurfaces;
```

**설계 — 배치는 하나도 안 바꾼다.** 각 자리가 **받는 개수는 지금과 같게** 두고 **내용만** 다르게 한다. 카드 수가 그대로라 높이·간격이 변하지 않는다.

| 자리          | 지금             | 바꾼 뒤                                  | 개수 |
| ------------- | ---------------- | ---------------------------------------- | ---- |
| 벤토 랭킹     | hotPopups 상위 4 | **인기순 상위 4** (그대로)               | 4    |
| POP-LOOK      | hotPopups[0] + 7 | **최근 들어온 것 8**(벤토와 겹치지 않게) | 8    |
| 게스트 히어로 | hotPopups 상위 4 | **마감 임박 4**(위 둘과 겹치지 않게)     | 4    |

첫 화면 서로 다른 팝업: **8곳 → 16곳.** 레일 30곳은 그 아래에 그대로.

**⚠️ 소유자 판단이 필요한 것 — 실행자가 정하지 마라.** 어느 자리에 어느 축을 줄지는 취향이다. 위 배정은 제안이고, 소유자가 뒤집으면 그대로 따른다. 다만 **겹치지 않게 한다는 원칙**은 유지한다.

**레일 기본 정렬은 이 태스크에서 건드리지 않는다.** 지금 `인기순`이라 상위 8곳이 벤토와 겹치지만, 기본값을 바꾸는 것은 사용자가 보는 첫 목록의 성격을 바꾸는 일이라 별도 결정이다. 보고서에 사실만 적는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';

import type { PopupStore } from '@/types/popup';
import { homeSurfaces } from './homeSurfaces';

const TODAY = new Date('2026-08-26T00:00:00+09:00');

const p = (
  id: number,
  viewCount: number,
  startDate: string | null,
  endDate: string | null,
): PopupStore => ({ id, name: `p${id}`, viewCount, startDate, endDate }) as unknown as PopupStore;

const SIZES = { ranked: 2, fresh: 2, closing: 2 };

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
    const ids = [...s.ranked, ...s.fresh, ...s.closing].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('벤토는 인기순 상위를 받는다', () => {
    const pool = [
      p(1, 100, '2026-08-01', '2026-12-31'),
      p(2, 90, '2026-08-02', '2026-12-31'),
      p(3, 10, '2026-08-25', '2026-12-31'),
      p(4, 9, '2026-08-24', '2026-12-31'),
    ];
    const s = homeSurfaces(pool, TODAY, SIZES);
    expect(s.ranked.map((x) => x.id)).toEqual([1, 2]);
  });

  it('POP-LOOK 은 최근 들어온 것을 받되 벤토가 가져간 것은 뺀다', () => {
    const pool = [
      p(1, 100, '2026-08-25', '2026-12-31'),
      p(2, 90, '2026-08-24', '2026-12-31'),
      p(3, 10, '2026-08-23', '2026-12-31'),
      p(4, 9, '2026-08-22', '2026-12-31'),
    ];
    const s = homeSurfaces(pool, TODAY, SIZES);
    expect(s.ranked.map((x) => x.id)).toEqual([1, 2]);
    expect(s.fresh.map((x) => x.id)).toEqual([3, 4]);
  });

  it('풀이 모자라면 채우다 만다 — 같은 것을 두 번 넣어 칸을 채우지 않는다', () => {
    const pool = [p(1, 100, '2026-08-25', '2026-12-31'), p(2, 90, '2026-08-24', '2026-12-31')];
    const s = homeSurfaces(pool, TODAY, SIZES);
    expect(s.ranked).toHaveLength(2);
    expect(s.fresh).toHaveLength(0);
    expect(s.closing).toHaveLength(0);
  });

  it('빈 풀이면 세 자리 모두 빈 배열이다', () => {
    const s = homeSurfaces([], TODAY, SIZES);
    expect(s).toEqual({ ranked: [], fresh: [], closing: [] });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/homeSurfaces.test.ts
```

Expected: FAIL — `Failed to resolve import "./homeSurfaces"`

- [ ] **Step 3: 구현**

`homeSurfaces.ts` 를 쓴다. 뼈대:

```ts
/**
 * 메인의 세 자리에 <b>서로 겹치지 않는</b> 목록을 나눠 준다.
 *
 * <p>예전엔 네 자리가 모두 {@code hotPopups}(viewCount desc 상위 8) 하나를 먹었다. 그래서 세
 * 화면을 내려도 서로 다른 팝업은 여덟 곳뿐이었다 — 팝업은 1,000곳 넘게 모아 놓고서다.
 *
 * <p>고치는 방식은 <b>배치를 바꾸지 않는 것</b>이다. 각 자리가 받는 개수는 그대로 두고 축만
 * 다르게 준다: 벤토는 인기순, POP-LOOK 은 최근 들어온 것, 게스트 히어로는 마감 임박. 앞에서
 * 가져간 것은 뒤에서 뺀다.
 *
 * <p>칸을 채우려고 같은 것을 두 번 넣지 않는다 — 그러면 고치려던 중복이 그대로 돌아온다.
 * 풀이 모자라면 <b>덜 채운 채로 둔다.</b>
 */
export function homeSurfaces(
  pool: PopupStore[],
  today: Date,
  sizes: { ranked: number; fresh: number; closing: number },
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
    ranked: take(byPopular, sizes.ranked),
    fresh: take(byLatest, sizes.fresh),
    closing: take(byDeadline, sizes.closing),
  };
}
```

**세 정렬은 새로 만든 것이 아니라 레일의 규칙 그대로다**(`HomeClient.tsx:434-451`). 화면마다 "최신" 의 뜻이 다르면 그것 자체가 새 결함이므로, **구현 전에 그 줄들을 읽고 위 코드와 어긋나지 않는지 대조하라.** 어긋나면 레일 쪽이 정답이다.

`parseDate` 는 레일이 쓰는 것과 같은 것을 import 한다 — 달력 실재성까지 검증해 이월을 막는다.

**호출 순서가 곧 우선권이다.** `ranked` 가 먼저 집어가고, `fresh` 는 남은 것에서, `closing` 은 그 나머지에서 고른다. 순서를 바꾸면 결과가 바뀌므로 임의로 바꾸지 마라.

- [ ] **Step 4: 통과 확인**

```bash
cd popspot-frontend && npx vitest run src/lib/homeSurfaces.test.ts
```

Expected: PASS (5개)

- [ ] **Step 5: HomeClient 에 붙인다**

`:506-522` 에서 `homeSurfaces(...)` 를 부르고, 세 자리에 각각 넘긴다:

- 게스트 히어로(`:1459`) ← `closing` (4개)
- 벤토(`:1627`) ← `ranked` (**4개를 넘긴다**)
- POP-LOOK(`:517`·`:522`) ← `fresh[0]` + `fresh.slice(1)`

**벤토에 4개를 넘기는 이유:** 지금은 8개를 넘겨 놓고 안에서 `slice(0,4)` 로 4개만 그린다. `HOT_POPUP_COUNT` 주석(`:182-184`)이 하지 말라고 적어둔 패턴이다. 넘기는 쪽을 4로 맞추면 **화면은 전혀 안 변하면서** 계약이 맞는다.

**게스트 히어로 2×2 는 4개 그대로 둔다** — 주석(`:186-187`)이 280px 카드의 2×2 라 늘리면 무너진다고 명시했다. 개수는 유지하고 내용만 바꾼다.

- [ ] **Step 6: 게이트**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

- [ ] **Step 7: 사보타주 증명**

`take()` 의 `if (used.has(item.id)) continue;` 를 지우고 「세 자리가 서로 겹치지 않는다」 가 **실패하는 것을 눈으로 본 뒤** 되돌린다. 두 출력을 보고서에 붙인다.

- [ ] **Step 8: 눈으로 세어 본다 — 이 태스크의 진짜 검증**

홈을 열어 **첫 화면부터 레일 직전까지 서로 다른 팝업 이름이 몇 개인지 직접 센다.** 8개면 실패다. 16개 근처여야 한다. 로그인·로그아웃 양쪽에서 센다(게스트 히어로는 로그아웃에서만 나온다).

같은 이름이 두 자리에 나오면 **개수가 아니라 그것이 실패다.**

- [ ] **Step 9: 커밋**

```bash
git add popspot-frontend/src/lib/homeSurfaces.ts popspot-frontend/src/lib/homeSurfaces.test.ts popspot-frontend/app/HomeClient.tsx
git commit -m "feat(home): show sixteen different pop-ups where we showed the same eight"
```

---

## 넣지 않는 것 — 그리고 왜

원안 아홉 결함 중 셋은 뺀다.

**검색을 맨 위로 · 기능소개를 위로** — 순수 레이아웃이다. 소유자가 UI 를 안 건드린다고 정했다.

**모바일 게스트 D-N 상시 노출** — 768px 아래에 없던 요소를 만들어야 하므로 UI 다. **다만 UI 없이 되는 조각이 하나 있다**: 게스트를 다이얼로그로 시작하는 경로(`HomeClient.tsx:743-745`)가 로그인 경로(`login/page.tsx:171-179`)와 달리 **아무 알림도 안 띄운다.** 이미 있는 `notify` 를 불러 같은 토스트를 띄우면 새 요소 없이 "시작됐다" 는 사실은 전달된다. 작아서 이 계획에 넣지 않았지만 지나가는 길에 할 만하다.

## 원안이 틀렸던 것 — 기록

다음 사람이 같은 문서를 읽을 때를 위해 남긴다.

- **"조회수는 상세를 열어야 오른다"** — 틀렸다. 아무 GET 이나 오른다(실측 `108→109→110`). 그래서 원안이 그린 「노출→조회→순위」 폐루프는 성립하기 어렵다. SSR 이 `revalidate: 300` 이라 오히려 **사람 클릭이 카운터에 거의 안 잡힌다.** 진짜 문제는 루프가 아니라 카운터가 크롤 빈도를 잰다는 것이고, 처방이 다르다.
- **"0회 28.4% · 2회 이하 63.5%"** — 2026-08-05 값이다. 2026-08-26 재측정은 **0.6% / 10.9%**(n=1,169). 21일 만에 6배 움직였으므로 이 숫자를 근거로 든 문장은 무효다. (참고: 그 재측정 자체가 상세 엔드포인트를 1,169건 호출해 카운터를 그만큼 올렸다. 카운터가 얼마나 무른지 보여 주는 셈이다.)
- **"1위는 3회, 2~4위는 2회"** — 틀렸다. **2~4위도 3회**다. 그리고 이 셈은 **로그아웃 상태에서만** 참이다(`:1370` 이 로그인 여부로 갈린다).
- **"주석이 렌더에서 또 자르지 말라고 경고한다"** — 절반만 맞다. 바로 다음 문단(`:186-187`)이 게스트 히어로 격자를 **명시적으로 예외 처리**해 뒀다. 그 자리는 결함이 아니라 문서화된 의도다.
- **원안이 놓친 네 번째 중복** — 레일 기본 정렬이 인기순이라 그 상위 8곳이 벤토와 같다.
- **줄 번호가 7~22줄씩 어긋난다** — 저장소에 `.claude/worktrees/…/HomeClient.tsx` 옛 사본이 있다. 인용 전에 어느 트리에서 읽었는지 확인할 것.

## 백엔드 배포와 함께 올릴 것 (이번 계획 밖)

- **viewCount 위생의 나머지** — 봇 필터·세션 dedupe·레이트리밋. `GET /api/popups/{id}` 가 지금 인증·중복제거 없이 +1 한다. 이미 쌓인 40k 는 소급 정화가 안 되니 **깨끗한 카운터를 따로 세워 병행 관찰 후 정렬을 갈아타는 편**이 안전하다.
- **`PopupStore.java:265`** 의 외부 map 이 viewCount 를 덮어쓰는 경로 — 지금은 호출자가 없지만 크롤러에 물리는 순간 지뢰다.
- **혼잡 데이터** — 「혼잡」 칩이 `p.status === '혼잡'` 을 거는데 백엔드가 popup.status 에 혼잡도를 넣는 경로가 없다. 채우거나, 칩을 없애거나 — 후자는 화면이 바뀌므로 소유자 판단.
