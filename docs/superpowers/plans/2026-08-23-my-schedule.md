# 일정 탭 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 일정 탭이 캘린더 모달의 복사본이 아니라 "내가 본 팝업이 언제 닫히는가" 와 "이 날 무엇이 바뀌는가" 에 답하게 만든다.

**Architecture:** 계산은 전부 `src/lib` · `src/features` 의 **순수 함수**에 두고 테스트로 고정한다(`dday.ts`, `dayBuckets.ts`, `selectMySchedule`). 컴포넌트는 그 결과를 그리기만 한다. 달력 본문(`PopupCalendar`)은 화면과 모달이 공유하므로 한 곳만 고치면 둘 다 좋아진다. 새 컴포넌트 `MySchedule` 은 `localStorage` 의 최근 방문 기록을 팝업 목록과 `popupId` 로 조인해 만들며, 서버 요청을 추가하지 않는다.

**Tech Stack:** Next.js App Router(리포 루트의 `app/`), React 19, TypeScript strict, Tailwind v4, vitest 4, lucide-react, framer-motion(기존 탭 섹션).

## Global Constraints

- **인프라 비용 0원.** 새 API·새 백엔드 엔드포인트·새 외부 서비스를 만들지 않는다. 이 계획의 모든 데이터는 이미 받아오는 `/api/popups` 응답과 `localStorage` 안에 있다.
- **백엔드를 건드리지 않는다.** 배포가 수동 jar 배포라 프론트와 함께 나갈 수 없다. 행동 계측(`calendar_save` 등)은 이번 범위 밖 — `VisitEvent.ALLOWED_TYPES` 에 없는 타입은 서버가 조용히 버린다.
- **작업 브랜치는 `claude/popspot-seasonal-theme-kz72ho`.** `main` 에 푸시하지 않는다.
- **사전 키는 세 언어에 동시에 넣는다.** `MessageKey` 는 `keyof (typeof DICT)['ko']` 라서 ko 에만 넣으면 `tsc` 가 `_localeParity` 줄에서 TS2322 로 막는다. 반대로 **en·ja 에만 넣으면 아무 에러도 안 난다** — 고아 번역이 조용히 남는다. 세 곳 모두, 같은 상대 위치에 넣는다.
- **테스트 기본 환경은 `node` 다.** `vitest.config.ts` 에 `test` 블록 자체가 없다. DOM 을 만지는 파일만 1행에 `// @vitest-environment jsdom` 를 넣는다. 이 계획의 새 테스트는 전부 순수 함수라 **넣지 않는다**(넣으면 파일당 ~2.5초를 그냥 쓴다).
- **`globals: false` 다.** 모든 테스트 파일은 `import { describe, expect, it } from 'vitest';` 를 명시해야 한다.
- **날짜는 절대 `new Date()` 로 만들지 않는다.** 모듈 상수로 고정한다. 이 리포는 KST 기준이고 CI 는 UTC 라, 로컬 시각으로 만든 픽스처는 여기서 통과하고 CI 에서 깨진다.
- **포맷은 파일 단위로.** `npm run format` 은 이미 깨져 있는 `src/data/emergency/popups-2026-08-11.json` 까지 다시 써서 diff 를 오염시킨다. `npx prettier --write <path>` 만 쓴다.
- **커밋 훅이 없다.** husky·lint-staged 모두 없다. `npm run typecheck` · `npm run lint` · `npm test` 를 각 태스크에서 직접 돌린다.
- Prettier: `singleQuote`, `semi`, `printWidth 100`, `trailingComma "all"`, `arrowParens "always"`, `endOfLine "lf"`.
- 모든 명령의 작업 디렉터리는 `popspot-frontend/` 다.

## 파일 구조

| 파일                                          | 책임                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/dday.ts`                             | 마감까지 남은 날 계산 한 곳. 화면 전체가 여기를 쓴다                                          |
| `src/lib/dday.test.ts`                        | 위의 계약 고정                                                                                |
| `src/features/popup/dayBuckets.ts`            | 하루를 마감·오픈·진행으로 가르고, 마감을 지역별로 묶는다. 로케일을 모른다                     |
| `src/features/popup/dayBuckets.test.ts`       | 위의 계약 고정                                                                                |
| `src/features/popup/PopupCalendar.tsx`        | 격자에 마감 수, 상세 영역을 세 덩어리로 (기존 파일 수정)                                      |
| `src/features/schedule/useMySchedule.ts`      | 최근 방문 × 팝업 목록 조인. 순수 선택 함수 + 훅                                               |
| `src/features/schedule/useMySchedule.test.ts` | 조인·제외·정렬 규칙 고정                                                                      |
| `src/features/schedule/MySchedule.tsx`        | 위 목록의 화면                                                                                |
| `app/HomeClient.tsx`                          | 달력에 걸러지지 않은 카탈로그를 넘기고, SCHEDULE 탭에 `MySchedule` 을 얹는다 (기존 파일 수정) |
| `src/lib/i18n.tsx`                            | 새 문구 키 (기존 파일 수정)                                                                   |

`src/lib/recentVisits.ts` · `src/lib/calendar.ts` · `src/lib/regions.ts` · `src/features/popup/PopupCalendarModal.tsx` 는 **변경하지 않는다.**

## 참고 — 이미 확인된 사실

구현 중 다시 조사하지 않아도 되도록 정찰 결과를 옮겨 둔다.

```ts
// src/lib/recentVisits.ts — 저장 형태에 팝업 날짜가 없다. visitedAt 은 "본 시각" 이다.
export interface RecentVisit {
  popupId: number
  popupName: string
  popupImage?: string
  visitedAt: string
}
export function readVisits(): RecentVisit[] // localStorage, 최대 10개, 실패 시 [] 를 삼킨다
```

```ts
// src/lib/calendar.ts — CalendarEvent 는 export 가 아니다. 필요하면 ReturnType<typeof toCalendarEvent> 를 쓴다.
export interface CalendarInput {
  id: string | number
  name: string
  address?: string | null
  startDate?: string | null
  endDate?: string | null
}
export function toCalendarEvent(input: CalendarInput): CalendarEvent | null // 날짜가 정확히 YYYY-MM-DD 가 아니거나 start > end 이면 null
export function addToCalendar(input: CalendarInput): boolean // window.open 을 부른다 — onClick 안에서만 호출할 것
```

`PopupStore` 는 `id: number`, `name: string`, `location: string`, `startDate?: string`, `endDate?: string`, `address?: string` 를 가지므로 **구조적으로 `CalendarInput` 에 그대로 들어간다.** 변환 함수를 새로 만들지 말 것.

```ts
// src/lib/regions.ts
export type RegionCode =
  | "seongsu"
  | "hannam"
  | "apgujeong"
  | "hongdae"
  | "gangnam"
  | "itaewon"
  | "jamsil"
  | "yeouido"
  | "myeongdong"
  | "seongbuk"
  | "mapo"
  | "yongsan"
  | "other"
export const REGIONS: RegionDef[] // 'other' 는 이 배열에 없다
export function classifyRegion(location: string | null | undefined): RegionCode
```

```ts
// src/lib/i18n.tsx — 지역 표시명은 사전이 아니라 정의에 붙어 있다.
export function localizedLabel(
  def: { label: string; labelEn: string; labelJa: string },
  locale: Locale
): string
```

기존 D-day 문구 키(그대로 재사용, 새로 만들지 말 것): `'card.today'`, `'misc.cardEnded'`, `'misc.cardDdayPrefix'`, `'misc.cardDdaySuffix'`.

---

### Task 1: 날짜 산수를 `src/lib/dday.ts` 한 곳으로

**Files:**

- Create: `src/lib/dday.ts`
- Create: `src/lib/dday.test.ts`
- Modify: `src/components/main/PopupCard.tsx` (20-46행의 `DdayBadge` 인터페이스와 `ddayBadge` 함수를 지우고 import 로 대체)

**Interfaces:**

- Consumes: `MessageKey` (`@/lib/i18n`, 타입만)
- Produces: `daysUntilEnd(endDate?: string | null, now?: Date): number | null`, `ddayBadge(endDate?: string | null, now?: Date): DdayBadge | null`, `interface DdayBadge { labelKey: MessageKey | null; days: number; ended: boolean }`

**배경(구현자가 알아야 할 것):** 같은 산수가 다섯 곳에 복사돼 있다. 셋은 글자까지 같고(`PopupCard:42`, `HomeBento1a:28`, `PopupDetailClient:105`), 둘은 계산이 다르다(`popups/[slug]/page.tsx:295`, `MusicTab.tsx:144` — 후자는 자정 정렬을 안 한다). 게다가 `PopupCard.tsx:35` 의 `ddayBadge` 와 `popups/[slug]/page.tsx:299` 의 `ddayBadge` 는 **이름만 같고 시그니처가 다른 함수**다. 이 태스크는 **글자까지 같은 것만** 합친다. 계산이 다른 둘은 손대지 않는다 — 같아 보이지만 다른 것을 정리하다 화면이 바뀌는 쪽이 더 나쁘다.

**동작을 바꾸지 않는다.** `new Date(endDate)` 는 'YYYY-MM-DD' 를 UTC 자정으로 읽고 `setHours(0,0,0,0)` 는 로컬 자정으로 내린다. UTC-5 같은 시간대에서 하루가 밀리는 성질이 있지만, 그건 지금도 그렇다. 이 태스크는 **추출**이지 수정이 아니다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/dday.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { daysUntilEnd, ddayBadge } from "./dday"

/**
 * 마감까지 남은 날 — 화면 전체가 이 한 곳을 본다.
 *
 * <p>예전에는 같은 산수가 다섯 곳에 복사돼 있었다. 셋은 글자까지 같았고 둘은 계산이 달랐다.
 * 복사본이 늘어나면 "홈은 D-2 인데 상세는 D-1" 이 되는 날이 오고, 그때 어느 쪽이 옳은지
 * 아무도 모른다.
 *
 * <p>기준 시각을 인자로 받는 것은 <b>테스트 때문이 아니라 시간대 때문</b>이다. 날짜 문자열과
 * 기준 시각을 같은 방식으로 만들면(둘 다 'YYYY-MM-DD' 파싱) 두 값이 함께 밀리므로 차이는
 * 어느 시간대에서든 같다 — CI(UTC)와 이 기계(KST)가 다른 답을 내지 않는다.
 */
const TODAY = new Date("2026-08-23")

describe("daysUntilEnd", () => {
  it("마감일이 미래면 남은 날 수를 준다", () => {
    expect(daysUntilEnd("2026-08-31", TODAY)).toBe(8)
  })

  it("오늘 마감이면 0 이다", () => {
    expect(daysUntilEnd("2026-08-23", TODAY)).toBe(0)
  })

  it("이미 지난 마감일은 음수다", () => {
    expect(daysUntilEnd("2026-08-20", TODAY)).toBe(-3)
  })

  it("마감일이 없거나 읽을 수 없으면 null 이다 — 0 이 아니다", () => {
    expect(daysUntilEnd(undefined, TODAY)).toBeNull()
    expect(daysUntilEnd(null, TODAY)).toBeNull()
    expect(daysUntilEnd("", TODAY)).toBeNull()
    expect(daysUntilEnd("내일까지", TODAY)).toBeNull()
  })
})

describe("ddayBadge", () => {
  it("끝난 팝업은 ended 로 표시한다 — 문구가 아니라 이 값으로 색을 고르라고 나눠 둔 것이다", () => {
    expect(ddayBadge("2026-08-20", TODAY)).toEqual({
      labelKey: "misc.cardEnded",
      days: -3,
      ended: true,
    })
  })

  it("오늘 마감은 정해진 문구를 쓴다", () => {
    expect(ddayBadge("2026-08-23", TODAY)).toEqual({
      labelKey: "card.today",
      days: 0,
      ended: false,
    })
  })

  it("남은 날이 있으면 문구 대신 일수를 준다", () => {
    expect(ddayBadge("2026-08-31", TODAY)).toEqual({
      labelKey: null,
      days: 8,
      ended: false,
    })
  })

  it("마감일을 모르면 배지 자체가 없다", () => {
    expect(ddayBadge(undefined, TODAY)).toBeNull()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/dday.test.ts
```

Expected: FAIL — `Failed to resolve import "./dday"`

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/dday.ts`:

```ts
import type { MessageKey } from "./i18n"

/**
 * 남은 기간 배지에 필요한 것 — 무엇을 쓸지(labelKey · days)와 어떤 색으로 그릴지(ended).
 *
 * <p>문구와 <b>종료 여부를 나눠서</b> 돌려준다. 예전에는 '종료' 같은 문자열 하나만 주고 배지 색을
 * 고르는 쪽이 {@code dday === '종료'} 로 되물었는데, 그러면 문구를 옮기는 순간 비교가 빗나가
 * 끝난 팝업까지 라임색 배지를 달게 된다 — 보이는 글자와 판단 기준이 같은 값이면 늘 이렇게 된다.
 */
export interface DdayBadge {
  /** 정해진 문구가 있는 경우의 사전 키. 남은 일수를 세어 보여줄 때는 null. */
  labelKey: MessageKey | null
  days: number
  ended: boolean
}

/**
 * 마감까지 남은 날. 마감일을 모르거나 읽을 수 없으면 null.
 *
 * <p>같은 산수가 카드·홈 벤토·상세에 각각 복사돼 있던 것을 여기로 모았다. 세 벌은 글자까지
 * 같았지만, 그렇게 둔 이상 언젠가 한 벌만 고쳐진다.
 *
 * <p>{@code now} 를 받는 이유는 두 값을 <b>같은 방식으로</b> 만들어야 시간대에 흔들리지 않기
 * 때문이다. 'YYYY-MM-DD' 는 UTC 자정으로 파싱되고 setHours 는 로컬 자정으로 내리므로, 두 날짜가
 * 함께 밀려 차이는 보존된다.
 */
export function daysUntilEnd(
  endDate?: string | null,
  now: Date = new Date()
): number | null {
  if (!endDate) return null
  const end = new Date(endDate)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date(now.getTime())
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / 86_400_000)
}

/** 마감까지 남은 기간을 배지가 쓸 형태로. */
export function ddayBadge(
  endDate?: string | null,
  now: Date = new Date()
): DdayBadge | null {
  const days = daysUntilEnd(endDate, now)
  if (days === null) return null
  if (days < 0) return { labelKey: "misc.cardEnded", days, ended: true }
  if (days === 0) return { labelKey: "card.today", days: 0, ended: false }
  return { labelKey: null, days, ended: false }
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/dday.test.ts
```

Expected: PASS — 8 tests

- [ ] **Step 5: `PopupCard` 를 옮긴다**

`src/components/main/PopupCard.tsx` 에서 **20-46행(주석 포함 `DdayBadge` 인터페이스와 `ddayBadge` 함수 전체)을 삭제**하고, import 블록에 아래 한 줄을 더한다:

```ts
import { ddayBadge } from "@/lib/dday"
```

`import { useLocale, type MessageKey } from '@/lib/i18n';` 는 `MessageKey` 가 파일 안에서 더 안 쓰이면 `import { useLocale } from '@/lib/i18n';` 로 줄인다(`CATEGORY_LABEL_KEY` 가 `MessageKey` 를 쓰므로 **남겨 두는 것이 맞다** — 지우기 전에 확인할 것).

102행 `const dday = ddayBadge(popup.endDate);` 는 **그대로 둔다.** 시그니처가 같다.

- [ ] **Step 6: 전체 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run
```

Expected: typecheck 무출력, lint 무출력(경고는 허용), 41 files / 249 tests PASS

- [ ] **Step 7: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/lib/dday.ts src/lib/dday.test.ts src/components/main/PopupCard.tsx
```

```bash
git add popspot-frontend/src/lib/dday.ts popspot-frontend/src/lib/dday.test.ts popspot-frontend/src/components/main/PopupCard.tsx && git commit -m "refactor(dday): give the countdown one home"
```

---

### Task 2: 나머지 두 복사본을 같은 곳으로

**Files:**

- Modify: `src/components/main/HomeBento1a.tsx` (21-29행 `ddayNum` 삭제, 53·58행 호출부 교체)
- Modify: `app/popup/[id]/PopupDetailClient.tsx` (100-107행 근처의 지역 함수 삭제, 호출부 교체)

**Interfaces:**

- Consumes: `daysUntilEnd` (Task 1)
- Produces: 없음

**이 태스크는 독립적으로 거절 가능하다.** Task 1 이 스펙이 요구한 "홈 카드와 같은 함수" 를 이미 만족시킨다. 이건 남은 두 벌을 마저 없애는 것이라, 리뷰어가 범위를 좁히고 싶으면 여기만 빼면 된다.

- [ ] **Step 1: `HomeBento1a` 를 옮긴다**

21-29행의 `ddayNum` 함수(주석 없음, 9줄)를 삭제하고 import 를 더한다:

```ts
import { daysUntilEnd } from "@/lib/dday"
```

53행과 58행의 `const d = ddayNum(p.endDate);` 를 각각 `const d = daysUntilEnd(p.endDate);` 로 바꾼다.

- [ ] **Step 2: `PopupDetailClient` 를 옮긴다**

이 파일의 함수는 **`daysUntilEnd` 의 복사본이 아니다.** `ddayLabel(closeDate, ended, todayClosing): string | null` 로, 옮겨진 문구를 받아 문자열을 돌려준다. 함수는 남기고 **안에 든 날짜 산수만** 뺀다.

94-109행의 함수를 아래로 바꾼다:

```ts
function ddayLabel(
  closeDate: string | undefined,
  ended: string,
  todayClosing: string
): string | null {
  const diff = daysUntilEnd(closeDate)
  if (diff === null) return null
  if (diff < 0) return ended
  if (diff === 0) return todayClosing
  return `D-${diff}`
}
```

import 를 더한다:

```ts
import { daysUntilEnd } from "@/lib/dday"
```

421행의 호출부 `const dday = ddayLabel(popup.closeDate, t('detail.ended'), t('detail.todayClosing'));` 는 **그대로 둔다.**

**주의:** 이 파일은 자체 `PopupDetail` 타입을 쓰고 날짜 필드 이름이 `openDate`/`closeDate` 다(`PopupStore` 의 `startDate`/`endDate` 가 아니다). 230행 페치 경계에서 `closeDate: data.endDate || data.closeDate` 로 정규화한다. `daysUntilEnd` 에 넘기는 것은 **`closeDate`** 다 — `endDate` 를 넘기면 그 타입에 없는 필드라 `undefined` 가 되고, 에러 없이 배지만 사라진다.

- [ ] **Step 3: 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npx vitest run
```

Expected: 무출력 / 41 files PASS

- [ ] **Step 4: 화면으로 확인한다**

홈 카드의 D-day 배지와 상세 페이지의 남은 기간이 **바꾸기 전과 같은 숫자**인지 눈으로 대조한다. 이건 리팩터링이므로 숫자가 하나라도 달라지면 실패다.

- [ ] **Step 5: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/components/main/HomeBento1a.tsx "app/popup/[id]/PopupDetailClient.tsx"
```

```bash
git add popspot-frontend/src/components/main/HomeBento1a.tsx "popspot-frontend/app/popup/[id]/PopupDetailClient.tsx" && git commit -m "refactor(dday): retire the last two identical copies"
```

---

### Task 3: 하루를 마감·오픈·진행으로 가른다

**Files:**

- Create: `src/features/popup/dayBuckets.ts`
- Create: `src/features/popup/dayBuckets.test.ts`

**Interfaces:**

- Consumes: `PopupStore` (`@/types/popup`)
- Produces: `bucketByDay(popups: PopupStore[], date: string): DayBuckets`, `interface DayBuckets { closing: PopupStore[]; opening: PopupStore[]; runningCount: number }`, `closingCountsByDate(popups: PopupStore[]): Map<string, number>`

**판정 규칙(스펙에서 그대로 옮김):**

|         | 조건                                                            |
| ------- | --------------------------------------------------------------- |
| 마감    | `(endDate ?? startDate) === date`                               |
| 오픈    | `startDate === date`                                            |
| 진행 중 | `startDate` 가 있고 `startDate ≤ date ≤ (endDate ?? startDate)` |

마감만 `startDate` 를 요구하지 않는다. 종료일만 있고 시작일이 없는 팝업이 실측 24곳 있는데, 지금 `getPopupsForDate` 는 `!p.startDate` 면 곧바로 버려서 **그 24곳은 달력의 어느 날짜에도 안 나온다.** 진행 중 조건은 기존 `getPopupsForDate` 와 글자 그대로 같아야 한다 — 그래야 지금 보이던 숫자가 그대로 내려앉는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/popup/dayBuckets.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { bucketByDay, closingCountsByDate } from "./dayBuckets"
import type { PopupStore } from "@/types/popup"

/**
 * 달력에서 하루가 뜻하는 것.
 *
 * <p>예전 달력은 날짜를 누르면 그날 <b>진행 중인</b> 팝업을 전부 보여줬다. 실측으로 8월 23일에
 * 508곳이었고, 팝업은 몇 주씩 하니 다음 날을 눌러도 비슷한 500곳이었다 — 날짜를 고르는 의미가
 * 없으면 그건 달력이 아니라 목록이다. 날짜마다 실제로 달라지는 것은 그날 열리고 닫히는 것이다
 * (같은 사흘에 59 · 22 · 153).
 *
 * <p>아래 표본은 손으로 만든 것이다. 살아 있는 데이터로 세면 내일 팝업 하나가 끝나는 순간
 * 빨개지는데, 그건 회귀가 아니라 세상이 변한 것이다.
 */
const p = (
  o: Partial<PopupStore> & { id: number; name: string }
): PopupStore => ({
  location: "서울 성동구 성수동",
  status: "보통",
  viewCount: 0,
  ...o,
})

const DAY = "2026-08-31"

describe("bucketByDay", () => {
  it("그날 끝나는 것은 마감이고, 그날 시작하는 것은 오픈이다", () => {
    const list = [
      p({
        id: 1,
        name: "오늘 닫는 팝업",
        startDate: "2026-08-01",
        endDate: DAY,
      }),
      p({
        id: 2,
        name: "오늘 여는 팝업",
        startDate: DAY,
        endDate: "2026-09-15",
      }),
    ]
    const got = bucketByDay(list, DAY)
    expect(got.closing.map((x) => x.id)).toEqual([1])
    expect(got.opening.map((x) => x.id)).toEqual([2])
  })

  it("하루짜리 팝업은 오픈과 마감 양쪽에 든다 — 그날 열고 그날 닫는 것이 사실이다", () => {
    const list = [p({ id: 3, name: "하루 팝업", startDate: DAY, endDate: DAY })]
    const got = bucketByDay(list, DAY)
    expect(got.closing.map((x) => x.id)).toEqual([3])
    expect(got.opening.map((x) => x.id)).toEqual([3])
    expect(got.runningCount).toBe(1)
  })

  it("종료일만 있고 시작일이 없어도 마감에는 든다 — 예전 달력은 이런 팝업을 어느 날짜에도 안 보여줬다", () => {
    const list = [p({ id: 4, name: "시작일 미상", endDate: DAY })]
    const got = bucketByDay(list, DAY)
    expect(got.closing.map((x) => x.id)).toEqual([4])
    expect(got.opening).toHaveLength(0)
    expect(got.runningCount).toBe(0)
  })

  it("종료일이 없으면 시작일을 끝으로 본다", () => {
    const list = [p({ id: 5, name: "종료일 미상", startDate: DAY })]
    const got = bucketByDay(list, DAY)
    expect(got.closing.map((x) => x.id)).toEqual([5])
    expect(got.runningCount).toBe(1)
  })

  it("기간이 그날을 감싸면 진행 중으로 센다 — 마감·오픈에는 안 든다", () => {
    const list = [
      p({
        id: 6,
        name: "진행 중",
        startDate: "2026-08-01",
        endDate: "2026-09-30",
      }),
    ]
    const got = bucketByDay(list, DAY)
    expect(got.runningCount).toBe(1)
    expect(got.closing).toHaveLength(0)
    expect(got.opening).toHaveLength(0)
  })

  it("날짜가 아예 없는 항목은 어디에도 안 든다", () => {
    const got = bucketByDay([p({ id: 7, name: "날짜 없음" })], DAY)
    expect(got.closing).toHaveLength(0)
    expect(got.opening).toHaveLength(0)
    expect(got.runningCount).toBe(0)
  })

  it("진행 중 판정은 예전 getPopupsForDate 와 같은 답을 낸다", () => {
    // 예전 구현을 그대로 옮겨 온 것 — 이 줄이 회귀 감시선이다.
    const legacy = (list: PopupStore[], date: string) =>
      list.filter((x) => {
        if (!x.startDate) return false
        const end = x.endDate || x.startDate
        return date >= x.startDate && date <= end
      })
    const list = [
      p({ id: 1, name: "a", startDate: "2026-08-01", endDate: "2026-09-30" }),
      p({ id: 2, name: "b", startDate: DAY, endDate: DAY }),
      p({ id: 3, name: "c", endDate: DAY }),
      p({ id: 4, name: "d", startDate: "2026-09-01" }),
      p({ id: 5, name: "e" }),
    ]
    expect(bucketByDay(list, DAY).runningCount).toBe(legacy(list, DAY).length)
  })
})

describe("closingCountsByDate", () => {
  it("마감일마다 몇 곳이 닫히는지 센다", () => {
    const counts = closingCountsByDate([
      p({ id: 1, name: "a", startDate: "2026-08-01", endDate: DAY }),
      p({ id: 2, name: "b", startDate: "2026-08-02", endDate: DAY }),
      p({ id: 3, name: "c", startDate: "2026-08-03", endDate: "2026-09-05" }),
    ])
    expect(counts.get(DAY)).toBe(2)
    expect(counts.get("2026-09-05")).toBe(1)
  })

  it("마감이 없는 날은 키가 아예 없다 — 0 이 아니다", () => {
    const counts = closingCountsByDate([p({ id: 1, name: "a", endDate: DAY })])
    expect(counts.has("2026-08-30")).toBe(false)
    expect(counts.get("2026-08-30")).toBeUndefined()
  })

  it("날짜를 하나도 모르는 항목은 세지 않는다", () => {
    expect(closingCountsByDate([p({ id: 1, name: "날짜 없음" })]).size).toBe(0)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/features/popup/dayBuckets.test.ts
```

Expected: FAIL — `Failed to resolve import "./dayBuckets"`

- [ ] **Step 3: 최소 구현을 쓴다**

`src/features/popup/dayBuckets.ts`:

```ts
import type { PopupStore } from "@/types/popup"

/**
 * 달력에서 하루가 뜻하는 것 — 그날 <b>바뀌는</b> 것과 그저 <b>있는</b> 것을 가른다.
 *
 * <p>예전 달력은 둘을 섞어서 "그날 진행 중인 것" 만 보여줬다. 팝업은 몇 주씩 하므로 그 목록은
 * 날짜를 바꿔도 거의 그대로였다(8월 23일 508곳 → 25일 462곳). 반대로 열리고 닫히는 수는 날마다
 * 크게 다르다(59 · 22 · 153). 날짜를 고르는 의미는 후자에 있다.
 */
export interface DayBuckets {
  /** 그날 문을 닫는 팝업. */
  closing: PopupStore[]
  /** 그날 문을 여는 팝업. */
  opening: PopupStore[]
  /**
   * 그날 문이 열려 있던 팝업의 수. <b>목록이 아니라 수만</b> 돌려준다 — 500개짜리 목록은
   * 정보가 아니라 벽이라서, 화면도 숫자 한 줄로만 쓴다.
   */
  runningCount: number
}

/**
 * 하루치를 세 덩어리로 가른다.
 *
 * <p>마감만 {@code startDate} 를 요구하지 않는다. 종료일만 있고 시작일이 없는 팝업이 실측 24곳
 * 있는데, 예전 {@code getPopupsForDate} 는 시작일이 없으면 곧바로 버려서 <b>그 24곳은 달력의 어느
 * 날짜에도 나오지 않았다.</b>
 *
 * <p>하루짜리 팝업(시작 = 종료)은 마감과 오픈 양쪽에 든다. 그날 열고 그날 닫는 것이 사실이다.
 */
export function bucketByDay(popups: PopupStore[], date: string): DayBuckets {
  const closing: PopupStore[] = []
  const opening: PopupStore[] = []
  let runningCount = 0

  for (const popup of popups) {
    if (!popup) continue
    const start = popup.startDate
    // ?? 가 아니라 || 다. 크롤링 결과에 빈 문자열이 들어오면 ?? 는 그것을 값으로 인정해
    // 종료일이 '' 인 팝업을 어느 덩어리에도 넣지 못한다. 예전 getPopupsForDate 도 || 를 썼다.
    const end = popup.endDate || popup.startDate
    if (end === date) closing.push(popup)
    if (start === date) opening.push(popup)
    if (start && end && date >= start && date <= end) runningCount += 1
  }

  return { closing, opening, runningCount }
}

/**
 * 날짜별 마감 수 — 격자 칸에 적을 숫자.
 *
 * <p>칸마다 {@link bucketByDay} 를 부르면 한 달에 31 × 1,167 번을 돈다. 마감일은 팝업당 하나뿐이라
 * 한 번 훑어 세어 두면 끝난다.
 *
 * <p>마감이 없는 날은 <b>키가 아예 없다.</b> 0 을 넣어 두면 그리는 쪽이 "0곳" 이라고 적을 수 있고,
 * 그건 아무 일도 없는 날을 시끄럽게 만든다.
 */
export function closingCountsByDate(popups: PopupStore[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const popup of popups) {
    if (!popup) continue
    const end = popup.endDate || popup.startDate
    if (!end) continue
    counts.set(end, (counts.get(end) ?? 0) + 1)
  }
  return counts
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/features/popup/dayBuckets.test.ts
```

Expected: PASS — 10 tests

- [ ] **Step 5: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/features/popup/dayBuckets.ts src/features/popup/dayBuckets.test.ts && npm run typecheck
```

```bash
git add popspot-frontend/src/features/popup/dayBuckets.ts popspot-frontend/src/features/popup/dayBuckets.test.ts && git commit -m "feat(calendar): split a day into what changes and what merely is"
```

---

### Task 4: 마감이 길면 지역별로 묶는다

**Files:**

- Modify: `src/features/popup/dayBuckets.ts` (덧붙이기)
- Modify: `src/features/popup/dayBuckets.test.ts` (덧붙이기)

**Interfaces:**

- Consumes: `classifyRegion`, `RegionCode` (`@/lib/regions`), `PopupStore`
- Produces: `groupByRegion(popups: PopupStore[]): RegionGroup[] | null`, `interface RegionGroup { code: RegionCode; popups: PopupStore[] }`, `const REGION_GROUP_THRESHOLD = 12`

**로케일을 모른다.** 지역 **코드**만 돌려주고 표시명은 그리는 쪽이 `localizedLabel` 로 고른다. 표시명을 여기서 붙이면 순수 함수가 한국어에 묶여 테스트도 한국어에 묶인다.

**정렬:** 개수 내림차순, `other` 만 맨 뒤. 실측으로 8월 31일 마감 153곳이 `기타 61 · 성수 28 · 잠실 15 · 강남 13 · 명동 8 · 홍대 6 · 용산 6 · 여의도 5 · 마포 3 · 압구정 3 · 이태원 3 · 한남 2` 로 갈린다 — **가장 많은 것이 기타인데도 뒤로 보낸다.** 지역이 확실한 것을 먼저 보여주는 편이 읽힌다.

- [ ] **Step 1: 실패하는 테스트를 덧붙인다**

`src/features/popup/dayBuckets.test.ts` 의 import 를 바꾼다. **`closingCountsByDate` 를 빠뜨리지 말 것** — Task 3 의 마지막 세 테스트가 그걸 쓴다:

```ts
import {
  REGION_GROUP_THRESHOLD,
  bucketByDay,
  closingCountsByDate,
  groupByRegion,
} from './dayBuckets';
```

파일 끝에 덧붙인다:

```ts
/**
 * 마감이 긴 날을 읽을 수 있게 자른다.
 *
 * <p>월말에 몰린다. 8월 31일 실측 마감이 153곳이었고, 지역으로 묶으면 가장 큰 덩어리가 61(기타)로
 * 줄고 나머지는 2~28곳이 된다. 그런데 3곳짜리 날을 지역으로 접는 것은 도움이 아니라 방해다 —
 * 그래서 임계값이 있다.
 */
describe("groupByRegion", () => {
  const many = (n: number, location: string, from: number) =>
    Array.from({ length: n }, (_, i) =>
      p({ id: from + i, name: `${location} ${i}`, location })
    )

  it("임계값 이하면 묶지 않는다 — 묶지 않았다는 것을 null 로 알린다", () => {
    expect(
      groupByRegion(many(REGION_GROUP_THRESHOLD, "서울 성동구 성수동", 1))
    ).toBeNull()
  })

  it("임계값을 넘으면 묶는다", () => {
    const groups = groupByRegion(
      many(REGION_GROUP_THRESHOLD + 1, "서울 성동구 성수동", 1)
    )
    expect(groups).not.toBeNull()
    expect(groups).toHaveLength(1)
    expect(groups?.[0]).toMatchObject({ code: "seongsu" })
    expect(groups?.[0].popups).toHaveLength(REGION_GROUP_THRESHOLD + 1)
  })

  it("덩어리가 큰 지역이 앞에 온다", () => {
    const groups = groupByRegion([
      ...many(3, "서울 마포구 연남동", 100),
      ...many(9, "서울 성동구 성수동", 200),
      ...many(5, "서울 송파구 잠실동", 300),
    ])
    expect(groups?.map((g) => g.code)).toEqual(["seongsu", "jamsil", "mapo"])
  })

  it("기타는 가장 많아도 맨 뒤다 — 지역이 확실한 것부터 보여준다", () => {
    const groups = groupByRegion([
      ...many(20, "서울", 400),
      ...many(3, "서울 성동구 성수동", 500),
    ])
    expect(groups?.map((g) => g.code)).toEqual(["seongsu", "other"])
    expect(groups?.[1].popups).toHaveLength(20)
  })

  it("묶어도 팝업이 사라지거나 겹치지 않는다", () => {
    const list = [
      ...many(7, "서울 강남구 역삼동", 600),
      ...many(7, "서울 중구 명동", 700),
    ]
    const groups = groupByRegion(list)
    const ids = groups?.flatMap((g) => g.popups.map((x) => x.id)) ?? []
    expect(ids).toHaveLength(list.length)
    expect(new Set(ids).size).toBe(list.length)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/features/popup/dayBuckets.test.ts
```

Expected: FAIL — `groupByRegion is not a function`

- [ ] **Step 3: 최소 구현을 덧붙인다**

`src/features/popup/dayBuckets.ts` 의 import 에 더한다:

```ts
import { classifyRegion, type RegionCode } from "@/lib/regions"
```

파일 끝에 덧붙인다:

```ts
/**
 * 이보다 많으면 지역으로 묶는다.
 *
 * <p>3곳을 지역으로 접는 것은 도움이 아니라 방해다. 반대로 월말에는 하루 153곳이 닫힌다 —
 * 실측 분포는 12곳 근처가 "그냥 나열해도 읽히는" 경계였다.
 */
export const REGION_GROUP_THRESHOLD = 12

/** 한 지역 덩어리. 표시명이 아니라 <b>코드</b>를 담는다 — 언어는 그리는 쪽이 고른다. */
export interface RegionGroup {
  code: RegionCode
  popups: PopupStore[]
}

/**
 * 마감 목록을 지역으로 묶는다. 묶을 만큼 길지 않으면 {@code null}.
 *
 * <p>{@code null} 은 "지역이 하나뿐" 이 아니라 <b>"묶지 않았다"</b> 는 뜻이다. 빈 배열로 돌려주면
 * 그리는 쪽이 "지역이 없다" 와 구별할 수 없다.
 *
 * <p>기타는 개수와 무관하게 맨 뒤다. 실측으로 전체 1,167곳 중 524곳(45%)이 기타이고 — 위치
 * 문자열의 59%에 구 이름이 없다 — 앞에 두면 지역이 확실한 나머지가 안 보인다.
 */
export function groupByRegion(popups: PopupStore[]): RegionGroup[] | null {
  if (popups.length <= REGION_GROUP_THRESHOLD) return null

  const byRegion = new Map<RegionCode, PopupStore[]>()
  for (const popup of popups) {
    const code = classifyRegion(popup.location)
    const bucket = byRegion.get(code)
    if (bucket) bucket.push(popup)
    else byRegion.set(code, [popup])
  }

  return [...byRegion.entries()]
    .map(([code, list]) => ({ code, popups: list }))
    .sort((a, b) => {
      if (a.code === "other") return 1
      if (b.code === "other") return -1
      return b.popups.length - a.popups.length
    })
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/features/popup/dayBuckets.test.ts
```

Expected: PASS — 15 tests

- [ ] **Step 5: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/features/popup/dayBuckets.ts src/features/popup/dayBuckets.test.ts && npm run typecheck
```

```bash
git add popspot-frontend/src/features/popup/dayBuckets.ts popspot-frontend/src/features/popup/dayBuckets.test.ts && git commit -m "feat(calendar): group a crowded closing day by neighbourhood"
```

---

### Task 5: 달력에 걸러지지 않은 카탈로그를 넘긴다

**Files:**

- Modify: `app/HomeClient.tsx` (상태 추가, 하이드레이션 효과 3곳, 렌더 2곳)

**Interfaces:**

- Consumes: 없음
- Produces: `catalogPopups: PopupStore[]` (HomeClient 내부 상태)

**왜 필요한가.** `PopupCalendar` 는 지금 `allPopups` 를 받는데, 그건 `keepOpenNow()` 가 "오늘 문이 열려 있는 것" 만 남긴 508곳이다. 전체 카탈로그는 1,167곳(종료 543 + 진행 508 + 시작 전 92)이다. 그래서:

| 날짜         | 전체 기준 마감/오픈 | 지금 달력이 받는 것 |
| ------------ | ------------------- | ------------------- |
| 08-23 (오늘) | 59 / 11             | 56 / 11             |
| 08-31        | 153 / 4             | 147 / **0**         |
| 09-05        | 12 / 1              | 12 / **0**          |

**오픈은 오늘을 빼면 구조적으로 항상 0이다.** 미래에 시작하는 팝업은 정의상 "지금 진행 중" 이 아니라 걸러진다. Task 6·7 을 이대로 얹으면 오픈 덩어리가 영원히 비어 있다. 다음 달로 넘기면 격자가 비는 것도 같은 이유다.

**`allPopups` 는 건드리지 않는다.** 홈 목록·랭킹·지도는 "지금 열린 것" 이 맞다. 달력에만 별도 배열을 준다.

- [ ] **Step 1: 상태를 더한다**

`const [allPopups, setAllPopups] = useState<PopupStore[]>(() => keepOpenNow(initialPopups));` (357행 근처) **바로 아래**에:

```ts
/**
 * 달력 전용 — 걸러지지 않은 전체 카탈로그.
 *
 * <p>{@link keepOpenNow} 는 홈 목록·랭킹을 위해 "오늘 문이 열려 있는 것" 만 남긴다. 그건 그
 * 화면들에는 맞지만 달력에는 틀리다: 다음 주에 여는 팝업이 통째로 빠지므로 <b>오늘이 아닌
 * 날짜의 '오픈' 은 언제나 0</b> 이 되고, 다음 달로 넘기면 격자가 빈다(실측 1,167곳 중 92곳이
 * 아직 시작 전, 543곳이 이미 종료).
 *
 * <p>SSR 이 성공하면 이 값은 첫 렌더부터 완전하다. 실패했을 때만 아래 효과가 채우는데, 그
 * 경로의 localStorage 캐시는 이미 걸러진 목록이라 네트워크 응답이 올 때까지는 달력도 걸러진
 * 상태다 — 비어 보이는 것보다 낫고, 응답이 오면 온전해진다.
 */
const [catalogPopups, setCatalogPopups] = useState<PopupStore[]>(initialPopups)
```

- [ ] **Step 2: 하이드레이션 효과의 세 갈래에 반영한다**

1002행에서 시작하는 `useEffect` 의 `else` 갈래에서:

캐시 복구 부분 — 지금은 파싱과 필터가 한 줄에 붙어 있다. 파싱을 떼어 둘 다 쓴다:

```ts
if (cachedPopups) {
  try {
    const parsed = JSON.parse(cachedPopups)
    setAllPopups(keepOpenNow(parsed))
    setCatalogPopups(Array.isArray(parsed) ? parsed : [])
  } catch {
    localStorage.removeItem("cached_popups")
  }
}
```

네트워크 응답 부분:

```ts
        .then((raw) => {
          const data = keepOpenNow(raw);
          setAllPopups(data);
          setCatalogPopups(Array.isArray(raw) ? raw : []);
```

개발용 목업 부분:

```ts
if (process.env.NODE_ENV === "development") {
  const mock = devMockPopups()
  setAllPopups(mock)
  setCatalogPopups(mock)
}
```

- [ ] **Step 3: 달력 두 곳에 넘긴다**

SCHEDULE 탭(2669행 근처):

```tsx
<PopupCalendar popups={catalogPopups} />
```

캘린더 모달(2740-2744행) — 2743행 `popups={allPopups}` 를 바꾼다:

```tsx
<PopupCalendarModal
  open={isCalendarOpen}
  onOpenChange={setIsCalendarOpen}
  popups={catalogPopups}
/>
```

`PopupCalendarModal.tsx` 자체는 수정하지 않는다 — 받은 것을 그대로 `PopupCalendar` 에 넘기는 얇은 껍데기다.

- [ ] **Step 4: 타입을 확인한다**

```bash
cd popspot-frontend && npm run typecheck
```

Expected: 무출력

- [ ] **Step 5: 화면으로 확인한다**

```bash
cd popspot-frontend && npm run dev
```

브라우저에서 일정 탭을 연 뒤 **다음 달로 넘긴다.** 바꾸기 전에는 격자가 거의 비어 있었고, 지금은 날짜에 표시가 있어야 한다. 지난 달로 넘겨도 마찬가지다(7월 15일 기준 진행 134곳).

- [ ] **Step 6: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write app/HomeClient.tsx && npm run lint
```

```bash
git add popspot-frontend/app/HomeClient.tsx && git commit -m "fix(calendar): hand it the catalogue it is drawn against"
```

---

### Task 6: 격자에 마감 수를 적는다

**Files:**

- Modify: `src/features/popup/PopupCalendar.tsx`

**Interfaces:**

- Consumes: `closingCountsByDate` (Task 3), `PopupStore`
- Produces: 없음 (컴포넌트 내부)

**왜.** 지금 격자는 "팝업이 있음" 을 뜻하는 초록 점 하나뿐이라 8월 31일(마감 153곳)과 9월 5일(12곳)이 똑같아 보인다. 격자의 목적은 **어느 날을 눌러야 하는지 고르는 것**이고, 그러려면 크기가 보여야 한다.

- [ ] **Step 1: 마감 수를 한 번에 센다**

import 를 더한다:

```ts
import { closingCountsByDate } from "./dayBuckets"
```

`PopupCalendar` 안, `days` useMemo 아래에 더한다:

```ts
/** 날짜별 마감 수 — 격자에 적을 숫자. 목록이 바뀔 때만 다시 센다. */
const closingByDate = useMemo(() => closingCountsByDate(popups), [popups])
```

- [ ] **Step 2: 날짜 키를 만드는 곳을 함수로 뺀다**

`getPopupsForDate` 안에 인라인으로 들어 있는 날짜 조립을 컴포넌트 안의 헬퍼로 올린다(같은 문자열을 격자와 상세가 함께 쓴다):

```ts
const dateKey = useCallback(
  (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  [year, month]
)
```

`getPopupsForDate` 는 이 함수를 쓰도록 고친다(동작은 그대로).

- [ ] **Step 3: 점을 숫자로 바꾼다**

격자 버튼 안의 아래 블록을

```tsx
{
  hasPopups && day && (
    <span
      aria-hidden
      className={cn(
        "size-1.5 rounded-full mt-0.5",
        isSelected ? "bg-cream-200 dark:bg-ink-900" : "bg-lime-500"
      )}
    />
  )
}
```

이렇게 바꾼다:

```tsx
{
  /* 점이 아니라 숫자다 — 마감 153곳인 날과 12곳인 날이 점으로는 똑같아 보인다. */
}
{
  day && closingCount > 0 && (
    <span
      className={cn(
        "mt-0.5 text-[10px] font-bold leading-none tabular-nums",
        isSelected ? "text-cream-200 dark:text-ink-900" : "text-hot-500"
      )}
    >
      {closingCount}
    </span>
  )
}
```

같은 `map` 안에서 `dailyPopups`/`hasPopups` 를 계산하던 줄을 아래로 바꾼다:

```tsx
const closingCount = day ? (closingByDate.get(dateKey(day)) ?? 0) : 0
```

`getPopupsForDate(day)` 를 격자에서 부르던 호출은 지운다 — 칸마다 전체 목록을 훑던 것이 이 태스크로 없어진다.

`aria-label` 은 **이 태스크에서 건드리지 않는다.** 마감 수를 읽어 주려면 `cal.closing` 문구 키가 필요한데 그건 Task 7 에서 추가한다 — 여기서 미리 쓰면 `MessageKey` 에 없는 키라 타입 에러가 난다. Task 7 Step 4 에서 함께 한다.

- [ ] **Step 5: 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npx vitest run
```

Expected: 무출력 / 전체 PASS

- [ ] **Step 6: 화면으로 확인한다**

일정 탭에서 8월 격자를 본다. **31일 칸에 세 자리 숫자**가 있어야 하고, 마감이 없는 날에는 아무것도 없어야 한다.

- [ ] **Step 7: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/features/popup/PopupCalendar.tsx
```

```bash
git add popspot-frontend/src/features/popup/PopupCalendar.tsx && git commit -m "feat(calendar): let the grid show which day matters"
```

---

### Task 7: 상세 영역을 세 덩어리로

**Files:**

- Modify: `src/lib/i18n.tsx` (ko·en·ja 세 곳)
- Modify: `src/features/popup/PopupCalendar.tsx`

**Interfaces:**

- Consumes: `bucketByDay`, `groupByRegion`, `REGION_GROUP_THRESHOLD`, `RegionGroup` (Task 3·4), `REGIONS`, `localizedLabel`
- Produces: 없음

- [ ] **Step 1: 사전 키를 세 언어에 넣는다**

**`ja` → `en` → `ko` 순서로 넣는다.** 위에서부터 넣으면 아래 표의 줄 번호가 밀린다.

`ja` 테이블의 `'pmodal.cal.detail': '詳細',` (1930행) **바로 아래**:

```ts
    'cal.closing': '終了',
    'cal.opening': 'オープン',
    'cal.running': '開催中',
    'cal.countSuffix': '件',
    'cal.regionOther': 'その他',
```

`en` 테이블의 `'pmodal.cal.detail': 'Details',` (1156행) **바로 아래**:

```ts
    'cal.closing': 'Closing',
    'cal.opening': 'Opening',
    'cal.running': 'Running',
    'cal.countSuffix': '',
    'cal.regionOther': 'Other',
```

`ko` 테이블의 `'pmodal.cal.detail': '상세',` (389행) **바로 아래**:

```ts
    'cal.closing': '마감',
    'cal.opening': '오픈',
    'cal.running': '진행 중',
    'cal.countSuffix': '곳',
    'cal.regionOther': '기타',
```

`'cal.countSuffix'` 가 영어에서 빈 문자열인 것은 의도다 — 사전의 `??` 는 `||` 가 아니라 빈 문자열을 보존한다(`'pmodal.cal.dayHeadPrefix'` 가 같은 방식이다). `'misc.catEtc'`(카테고리 '기타')를 재사용하지 **않는** 이유는, 카테고리 문구를 고치면 지역 칩이 함께 바뀌기 때문이다.

```bash
cd popspot-frontend && npm run typecheck
```

Expected: 무출력. 에러가 나면 세 테이블 중 하나를 빠뜨린 것이다.

- [ ] **Step 2: 지역 표시명 헬퍼를 더한다**

`PopupCalendar.tsx` 의 import 에:

```ts
import { REGIONS, type RegionCode } from "@/lib/regions"
import {
  localizedLabel,
  useLocale,
  type Locale,
  type MessageKey,
} from "@/lib/i18n"
import { bucketByDay, closingCountsByDate, groupByRegion } from "./dayBuckets"
```

`useLocale`·`MessageKey` 는 이미 있고 `closingCountsByDate` 는 Task 6 에서 이미 넣었다 — **한 줄로 합친다**(같은 모듈을 두 번 import 하면 lint 가 잡는다). `REGION_GROUP_THRESHOLD` 는 컴포넌트에서 쓰지 않는다. 묶었는지 여부는 `groupByRegion` 이 `null` 인지로 알 수 있고, 임계값을 화면이 다시 아는 순간 두 곳이 어긋날 수 있다.

컴포넌트 위에 모듈 함수로:

```ts
/**
 * 지역 코드 → 화면 언어 표시명.
 *
 * <p>'other' 는 {@link REGIONS} 에 없다(슬라이스 카드를 만들지 않는 값이라 정의가 없다).
 * 그래서 그 하나만 사전에서 꺼낸다 — 코드 문자열 'other' 가 화면에 그대로 나오면 안 된다.
 */
function regionChipLabel(
  code: RegionCode,
  locale: Locale,
  t: (key: MessageKey) => string
): string {
  const region = REGIONS.find((r) => r.code === code)
  return region ? localizedLabel(region, locale) : t("cal.regionOther")
}
```

- [ ] **Step 3: 펼친 지역을 기억할 상태를 더한다**

```ts
/** 펼친 지역. 처음에는 전부 접혀 있다 — 12덩어리 머리글만 보이는 것이 이 화면의 요약이다. */
const [openRegion, setOpenRegion] = useState<RegionCode | null>(null)
```

달을 넘기거나 날짜를 바꿀 때 닫는다. `setSelectedDay` 를 부르는 세 곳(`handlePrevMonth`, `handleNextMonth`, 격자 `onClick`)에 `setOpenRegion(null);` 을 함께 넣는다.

- [ ] **Step 4: 상세 영역을 다시 쓴다**

`selectedPopups` 를 계산하던 줄을 아래로 바꾼다:

```ts
const selectedKey = selectedDay ? dateKey(selectedDay) : null
const buckets = useMemo(
  () => (selectedKey ? bucketByDay(popups, selectedKey) : null),
  [popups, selectedKey]
)
const closingGroups = useMemo(
  () => (buckets ? groupByRegion(buckets.closing) : null),
  [buckets]
)
```

상세 영역(199행부터 끝까지)을 아래로 교체한다:

```tsx
<div className="mt-6 border-t border-[var(--color-border)] pt-4 max-h-[280px] overflow-y-auto custom-scrollbar">
  <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
    <span
      aria-hidden
      className="size-2 bg-lime-500 rounded-full animate-pulse"
    />
    {/* 날짜가 앞뒤 어디에 붙는지가 언어마다 달라(7월 28일 진행 팝업 · Pop-ups on July 28) 앞뒤를 나눠 둔다. */}
    {t("pmodal.cal.dayHeadPrefix")}
    {selectedDay ? formatDay(selectedDay) : ""}
    {t("pmodal.cal.dayHeadSuffix")}
  </h4>

  {/*
          진행 중까지 0 이어야 빈 날이다. 마감·오픈만 보고 판단하면 379곳이 문을 연 8월 31일 같은
          날에 "일정이 없습니다" 가 뜬다 — 세 덩어리로 나눈 순간 생기는 함정이다.
        */}
  {!buckets ||
  (buckets.closing.length === 0 &&
    buckets.opening.length === 0 &&
    buckets.runningCount === 0) ? (
    <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-[var(--color-border-strong)] rounded-md">
      {t("pmodal.cal.empty")}
    </div>
  ) : (
    <div className="space-y-4">
      {buckets.closing.length > 0 && (
        <section>
          <h5 className="mb-2 text-xs font-bold text-hot-500">
            {t("cal.closing")} {buckets.closing.length}
            {t("cal.countSuffix")}
          </h5>
          {closingGroups ? (
            <div className="flex flex-wrap gap-1.5">
              {closingGroups.map((group) => (
                <button
                  key={group.code}
                  type="button"
                  onClick={() =>
                    setOpenRegion((prev) =>
                      prev === group.code ? null : group.code
                    )
                  }
                  aria-expanded={openRegion === group.code}
                  className={cn(
                    "rounded-pill px-2.5 py-1 text-[11px] font-bold transition-colors",
                    openRegion === group.code
                      ? "bg-ink-900 text-cream-200 dark:bg-cream-200 dark:text-ink-900"
                      : "bg-cream-300 text-foreground hover:bg-cream-400 dark:bg-ink-800 dark:hover:bg-ink-700"
                  )}
                >
                  {regionChipLabel(group.code, locale, t)} {group.popups.length}
                </button>
              ))}
            </div>
          ) : (
            <PopupRows
              popups={buckets.closing}
              locale={locale}
              t={t}
              onNavigate={onNavigate}
            />
          )}
          {closingGroups && openRegion && (
            <div className="mt-2">
              <PopupRows
                popups={
                  closingGroups.find((g) => g.code === openRegion)?.popups ?? []
                }
                locale={locale}
                t={t}
                onNavigate={onNavigate}
              />
            </div>
          )}
        </section>
      )}

      {buckets.opening.length > 0 && (
        <section>
          <h5 className="mb-2 text-xs font-bold text-lime-600 dark:text-lime-400">
            {t("cal.opening")} {buckets.opening.length}
            {t("cal.countSuffix")}
          </h5>
          {/* 오픈은 묶지 않는다 — 실측 최대가 하루 11곳이라 묶을 이유가 없다. */}
          <PopupRows
            popups={buckets.opening}
            locale={locale}
            t={t}
            onNavigate={onNavigate}
          />
        </section>
      )}

      {/*
              진행 중은 숫자 한 줄이고 링크가 없다. 500곳을 스크롤시키는 것은 정보가 아니라 벽이고,
              "지도에서 보기" 도 걸 수 없다 — 지도는 오늘 열려 있는 것을 보여줄 뿐 고른 날짜의
              목록을 재현하지 못한다. 누르면 다른 목록이 나오는 링크는 없느니만 못하다.
            */}
      {buckets.runningCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("cal.running")} {buckets.runningCount}
          {t("cal.countSuffix")}
        </p>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 5: 행을 그리는 부분을 컴포넌트로 뺀다**

같은 행 마크업이 세 곳에서 쓰이므로 파일 안에 둔다. 기존 `selectedPopups.map(...)` 의 `<Link>` 블록을 **그대로** 옮긴다(마크업을 바꾸지 않는다):

```tsx
/**
 * 팝업 한 줄 — 마감·오픈·펼친 지역이 같은 모양을 쓴다.
 *
 * <p>마크업은 예전 상세 영역의 것을 글자 그대로 옮긴 것이다. 세 곳이 같은 줄을 그리게 됐으니
 * 한 벌만 둔다 — 붙여 넣으면 한쪽만 고쳐지는 날이 온다.
 */
function PopupRows({
  popups,
  locale,
  t,
  onNavigate,
}: {
  popups: PopupStore[]
  locale: Locale
  t: (key: MessageKey) => string
  onNavigate?: () => void
}) {
  return (
    <div className="space-y-2">
      {popups.map((popup) => (
        <Link
          href={localizedPath(`/popup/${popup.id}`, locale)}
          key={popup.id}
          onClick={onNavigate}
        >
          <article className="p-3 bg-cream-300 dark:bg-ink-800 rounded-md border border-[var(--color-border)] flex justify-between items-center hover:border-lime-300/60 transition-colors group cursor-pointer">
            <div className="min-w-0 flex-1">
              <h5 className="font-semibold text-sm text-foreground group-hover:text-lime-500 transition-colors truncate flex items-center gap-1.5">
                {popup.name}
                {/* [V4] 자동수집 정보임을 한눈에 알리는 뱃지 — 정확성 면책의 가시성 확보 */}
                {popup.sourceType === "CRAWLED" && (
                  <span
                    title={t("pmodal.cal.aiBadgeTip")}
                    className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-pill"
                  >
                    <Sparkles className="size-2.5" aria-hidden />
                    AI
                  </span>
                )}
              </h5>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {popup.location}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 bg-surface border border-[var(--color-border)] text-foreground rounded-pill shrink-0 ml-3 group-hover:bg-lime-300 group-hover:text-ink-900 group-hover:border-lime-300 transition-colors">
              {t("pmodal.cal.detail")}
            </span>
          </article>
        </Link>
      ))}
    </div>
  )
}
```

이 컴포넌트를 더하고 나면 기존 `getPopupsForDate` 와 `selectedPopups` 는 **더 이상 쓰이지 않는다. 둘 다 지운다** — 남겨 두면 `no-unused-vars` 경고와 함께 "어느 쪽이 진짜인가" 가 남는다.

- [ ] **Step 5b: 격자의 `aria-label` 에 마감 수를 넣는다**

Task 6 에서 미뤄 둔 것이다. 이제 문구 키가 있다. 숫자만 보이면 화면 낭독기 사용자에게는 뜻이 없다:

```tsx
              aria-label={
                day
                  ? closingCount > 0
                    ? `${formatDay(day)} — ${t('cal.closing')} ${closingCount}${t('cal.countSuffix')}`
                    : formatDay(day)
                  : undefined
              }
```

- [ ] **Step 6: 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run
```

Expected: 무출력 / 전체 PASS

- [ ] **Step 7: 화면으로 확인한다**

일정 탭에서:

1. **8월 31일** — 마감 153곳이 지역 칩으로 나오고 칩 마지막이 기타여야 한다. 칩을 누르면 그 지역만 펼쳐진다.
2. **9월 5일** — 마감 12곳이라 칩 없이 평평한 목록이어야 한다.
3. **오늘(8월 23일)** — 오픈 11곳이 보여야 한다. Task 5 를 건너뛰었다면 이 항목이 0이다.
4. 진행 중 줄에 **링크가 없어야** 한다.
5. 홈 지도 탭의 **캘린더 모달**을 열어 같은 화면이 나오는지 확인한다.
6. 언어를 English·日本語로 바꿔 문구가 바뀌는지 확인한다.

- [ ] **Step 8: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/features/popup/PopupCalendar.tsx src/lib/i18n.tsx
```

```bash
git add popspot-frontend/src/features/popup/PopupCalendar.tsx popspot-frontend/src/lib/i18n.tsx && git commit -m "feat(calendar): answer what changes on a day, not what merely exists"
```

---

### Task 8: 내가 본 팝업 중 진행 중인 것을 고른다

**Files:**

- Create: `src/features/schedule/useMySchedule.ts`
- Create: `src/features/schedule/useMySchedule.test.ts`

**Interfaces:**

- Consumes: `readVisits`, `RecentVisit` (`@/lib/recentVisits`), `daysUntilEnd` (Task 1), `PopupStore`
- Produces: `selectMySchedule(visits: Pick<RecentVisit, 'popupId'>[], popups: PopupStore[], now?: Date): PopupStore[]`, `useMySchedule(popups: PopupStore[]): PopupStore[]`

**핵심:** `RecentVisit` 에는 **팝업 날짜가 없다**(`{popupId, popupName, popupImage?, visitedAt}` 뿐이고 `visitedAt` 은 본 시각이다). 마감일은 `popupId` 로 팝업 목록과 맞춰서 얻는다. 넘겨받는 목록은 `allPopups`(오늘 열린 것)라 **종료된 팝업은 애초에 그 배열에 없다** — "종료된 것 제외" 가 조인만으로 지켜진다. 추가 요청은 하지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/schedule/useMySchedule.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { selectMySchedule } from "./useMySchedule"
import type { PopupStore } from "@/types/popup"

/**
 * "내가 본 팝업 중 곧 닫히는 것".
 *
 * <p>재방문율이 28일 기준 1.7%(2,752명 중 46명)다. 다시 올 이유가 화면에 없었다. 찜은 3주간
 * 0건인데 로그인이 필요해서다 — 그래서 로그인 없이 쌓이는 최근 방문 기록을 쓴다.
 *
 * <p>최근 방문 기록에는 <b>팝업 날짜가 없다</b>. visitedAt 은 본 시각이지 팝업 기간이 아니라서,
 * 마감일은 팝업 목록과 popupId 로 맞춰야 나온다.
 */
const p = (
  o: Partial<PopupStore> & { id: number; name: string }
): PopupStore => ({
  location: "서울 성동구 성수동",
  status: "보통",
  viewCount: 0,
  ...o,
})

const TODAY = new Date("2026-08-23")
const v = (popupId: number) => ({ popupId })

describe("selectMySchedule", () => {
  it("본 팝업을 마감일 순으로 준다 — 오늘 마감이 맨 위다", () => {
    const popups = [
      p({ id: 1, name: "나중", endDate: "2026-09-10" }),
      p({ id: 2, name: "오늘", endDate: "2026-08-23" }),
      p({ id: 3, name: "모레", endDate: "2026-08-25" }),
    ]
    const got = selectMySchedule([v(1), v(2), v(3)], popups, TODAY)
    expect(got.map((x) => x.id)).toEqual([2, 3, 1])
  })

  it("본 적 없는 팝업은 안 나온다", () => {
    const popups = [p({ id: 1, name: "안 본 것", endDate: "2026-08-25" })]
    expect(selectMySchedule([], popups, TODAY)).toEqual([])
  })

  it("목록에 없는 팝업은 조용히 건너뛴다 — 종료돼 목록에서 빠진 것이 여기로 온다", () => {
    const popups = [p({ id: 1, name: "살아 있음", endDate: "2026-08-25" })]
    const got = selectMySchedule([v(99), v(1)], popups, TODAY)
    expect(got.map((x) => x.id)).toEqual([1])
  })

  it("이미 마감일이 지난 것은 뺀다 — 갈 수 없는 곳을 내 일정이라 부를 수 없다", () => {
    const popups = [
      p({ id: 1, name: "어제 끝남", endDate: "2026-08-22" }),
      p({ id: 2, name: "진행 중", endDate: "2026-08-25" }),
    ]
    expect(
      selectMySchedule([v(1), v(2)], popups, TODAY).map((x) => x.id)
    ).toEqual([2])
  })

  it("마감일을 모르는 것도 뺀다 — 언제 사라지는지 모르면 마감일 순 목록에 놓을 자리가 없다", () => {
    const popups = [
      p({ id: 1, name: "마감일 없음" }),
      p({ id: 2, name: "있음", endDate: "2026-08-25" }),
    ]
    expect(
      selectMySchedule([v(1), v(2)], popups, TODAY).map((x) => x.id)
    ).toEqual([2])
  })

  it("같은 팝업을 여러 번 봤어도 한 번만 나온다", () => {
    const popups = [p({ id: 1, name: "두 번 본 것", endDate: "2026-08-25" })]
    expect(selectMySchedule([v(1), v(1)], popups, TODAY)).toHaveLength(1)
  })

  it("저장소가 망가져 popupId 가 숫자가 아니어도 터지지 않는다", () => {
    const popups = [p({ id: 1, name: "정상", endDate: "2026-08-25" })]
    const broken = [{ popupId: undefined }, { popupId: "1" }] as unknown as {
      popupId: number
    }[]
    expect(() => selectMySchedule(broken, popups, TODAY)).not.toThrow()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/features/schedule/useMySchedule.test.ts
```

Expected: FAIL — `Failed to resolve import "./useMySchedule"`

- [ ] **Step 3: 최소 구현을 쓴다**

`src/features/schedule/useMySchedule.ts`:

```ts
"use client"

import { useEffect, useMemo, useState } from "react"

import { daysUntilEnd } from "@/lib/dday"
import { readVisits, type RecentVisit } from "@/lib/recentVisits"
import type { PopupStore } from "@/types/popup"

/**
 * 본 팝업 중 아직 진행 중인 것을 마감일 순으로.
 *
 * <p>최근 방문 기록에는 팝업 날짜가 없다 — {@code visitedAt} 은 본 시각이다. 그래서 마감일은
 * {@code popupId} 로 팝업 목록과 맞춰서 얻는다. 넘겨받는 목록이 "지금 열린 것" 이면 종료된
 * 팝업은 애초에 거기 없으므로, <b>제외 규칙이 조인만으로 지켜진다.</b>
 *
 * <p>{@code readVisits} 가 돌려주는 값은 검증되지 않은 localStorage 내용이다(모양 검사 없이
 * 캐스팅한다). 손으로 고친 저장소나 옛 형식이 들어와도 화면이 죽지 않게 항목마다 막는다.
 */
export function selectMySchedule(
  visits: Pick<RecentVisit, "popupId">[],
  popups: PopupStore[],
  now: Date = new Date()
): PopupStore[] {
  const byId = new Map<number, PopupStore>()
  for (const popup of popups) {
    if (popup) byId.set(popup.id, popup)
  }

  const seen = new Set<number>()
  const picked: { popup: PopupStore; days: number }[] = []

  for (const visit of visits) {
    const id = Number(visit?.popupId)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)

    const popup = byId.get(id)
    if (!popup) continue

    const days = daysUntilEnd(popup.endDate, now)
    if (days === null || days < 0) continue

    picked.push({ popup, days })
  }

  return picked.sort((a, b) => a.days - b.days).map((x) => x.popup)
}

/**
 * 위를 화면에서 쓰기 위한 훅.
 *
 * <p>{@code readVisits} 를 렌더 중에 부르지 않고 효과로 미룬다. localStorage 는 서버에 없으므로
 * 렌더 중에 읽으면 서버가 그린 것과 첫 클라이언트 렌더가 어긋난다 — 처음에는 서버와 같은 빈
 * 목록으로 그리고, 붙은 뒤에 채운다.
 */
export function useMySchedule(popups: PopupStore[]): PopupStore[] {
  const [visits, setVisits] = useState<RecentVisit[]>([])

  useEffect(() => {
    setVisits(readVisits())
  }, [])

  return useMemo(() => selectMySchedule(visits, popups), [visits, popups])
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/features/schedule/useMySchedule.test.ts
```

Expected: PASS — 7 tests

- [ ] **Step 5: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/features/schedule/useMySchedule.ts src/features/schedule/useMySchedule.test.ts && npm run typecheck
```

```bash
git add popspot-frontend/src/features/schedule && git commit -m "feat(schedule): pick what the visitor already looked at"
```

---

### Task 9: 화면을 붙인다

**Files:**

- Create: `src/features/schedule/MySchedule.tsx`
- Modify: `src/lib/i18n.tsx` (ko·en·ja 세 곳)
- Modify: `app/HomeClient.tsx` (SCHEDULE 탭)

**Interfaces:**

- Consumes: `useMySchedule` (Task 8), `ddayBadge` (Task 1), `toCalendarEvent`·`addToCalendar` (`@/lib/calendar`)
- Produces: `MySchedule({ popups }: { popups: PopupStore[] })`

**주의 두 가지.**

1. **SCHEDULE 탭 섹션에는 `overflow-hidden` 이 걸려 있다**(다른 탭에는 없다). 툴팁·팝오버·sticky·음수 마진은 카드 가장자리에서 잘린다. 흐름 안에 두는 마크업만 쓴다.
2. **SCHEDULE 은 로그인 없이 보이는 탭이다**(`USER_ONLY_TABS` 에 없다). `user` 를 참조하면 처음 온 사람에게 탭이 깨진다.

- [ ] **Step 1: 사전 키를 세 언어에 넣는다**

**`ja` → `en` → `ko` 순서로.** Task 7 에서 넣은 `cal.*` 블록 바로 아래에 이어 붙인다.

`ja`:

```ts
    'sched.mineTitle': '見たポップアップ',
    'sched.save': '予定に保存',
    'sched.allTitle': 'すべてのポップアップ',
```

`en`:

```ts
    'sched.mineTitle': 'Popups you viewed',
    'sched.save': 'Add to calendar',
    'sched.allTitle': 'All popups',
```

`ko`:

```ts
    'sched.mineTitle': '내가 본 팝업',
    'sched.save': '일정 저장',
    'sched.allTitle': '전체 팝업 달력',
```

- [ ] **Step 2: 컴포넌트를 쓴다**

`src/features/schedule/MySchedule.tsx`:

```tsx
"use client"

import Link from "next/link"
import { CalendarPlus } from "lucide-react"

import { addToCalendar, toCalendarEvent } from "@/lib/calendar"
import { ddayBadge } from "@/lib/dday"
import { useLocale } from "@/lib/i18n"
import { localizedPath } from "@/lib/localePath"
import { bilingual } from "@/lib/bilingual"
import type { PopupStore } from "@/types/popup"
import { useMySchedule } from "./useMySchedule"

/**
 * 내가 본 팝업 중 진행 중인 것 — 마감일 순.
 *
 * <p>일정 탭이 홈의 캘린더 모달과 <b>같은 컴포넌트</b>를 열고 있었다. 같은 것을 두 곳에서 열 수
 * 있게 된 것뿐이면 핵심 네 칸 중 하나를 쓸 이유가 없다. 달력이 "무엇이 열려 있나" 에 답한다면
 * 이 블록은 <b>"내가 관심 뒀던 것이 언제 사라지나"</b> 에 답한다.
 *
 * <p>기록이 없으면 <b>아무것도 그리지 않는다.</b> 유입의 93%가 검색으로 들어와 이력이 없는
 * 사람들이라, 그들에게 빈 칸을 보여주면 동행이 비어 있던 자리를 또 빈 화면으로 채우는 셈이 된다.
 */
export function MySchedule({ popups }: { popups: PopupStore[] }) {
  const { t, locale } = useLocale()
  const mine = useMySchedule(popups)

  if (mine.length === 0) return null

  return (
    <section className="mb-6 border-b border-[var(--color-border)] pb-6">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground lg:text-lg">
        {t("sched.mineTitle")}
      </h3>

      <ul className="space-y-2">
        {mine.map((popup) => {
          const dday = ddayBadge(popup.endDate)
          const shownName = bilingual(
            popup.name,
            locale === "en"
              ? popup.nameEn
              : locale === "ja"
                ? popup.nameJa
                : null
          )
          // 날짜가 정확히 YYYY-MM-DD 가 아니면 null 이다. 지어낸 일정을 남의 달력에 넣는 것은
          // 정보가 없는 것보다 나쁘므로, null 이면 버튼 자체를 그리지 않는다.
          const canSave = toCalendarEvent(popup) !== null

          return (
            <li
              key={popup.id}
              className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-cream-300 p-3 dark:bg-ink-800"
            >
              {dday && (
                <span className="shrink-0 rounded-pill bg-lime-300 px-2 py-1 text-[11px] font-bold text-ink-900 tabular-nums">
                  {dday.labelKey
                    ? t(dday.labelKey)
                    : `${t("misc.cardDdayPrefix")}${dday.days}${t("misc.cardDdaySuffix")}`}
                </span>
              )}

              <Link
                href={localizedPath(`/popup/${popup.id}`, locale)}
                className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground hover:text-lime-500"
              >
                {shownName.display || popup.name}
              </Link>

              {canSave && (
                <button
                  type="button"
                  // addToCalendar 는 window.open 을 부른다 — onClick 안에서만 안전하다.
                  // 데스크톱·안드로이드에서는 팝업 차단기를 무시하고 true 를 돌려주므로,
                  // 돌려받은 값으로 "저장됨" 을 알리지 않는다.
                  onClick={() => addToCalendar(popup)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-pill border border-[var(--color-border)] bg-surface px-2.5 py-1 text-[11px] font-bold text-foreground transition-colors hover:bg-lime-300 hover:text-ink-900"
                >
                  <CalendarPlus className="size-3" aria-hidden />
                  {t("sched.save")}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default MySchedule
```

`ddayBadge` 는 종료된 것을 이미 걸러낸 뒤라 `ended` 가 참일 수 없다 — 그래서 배지 색 분기를 두지 않는다.

- [ ] **Step 3: SCHEDULE 탭에 얹는다**

`app/HomeClient.tsx` 의 SCHEDULE 블록에서 `<PopupCalendar popups={catalogPopups} />` 를 아래로 바꾼다:

```tsx
              <MySchedule popups={allPopups} />
              <h3 className="mb-3 text-base font-bold text-foreground lg:text-lg">
                {t('sched.allTitle')}
              </h3>
              <PopupCalendar popups={catalogPopups} />
```

**`MySchedule` 에는 `allPopups`(오늘 열린 것), 달력에는 `catalogPopups`(전체)** 를 넘긴다. 서로 다른 배열인 것이 의도다 — 내 일정은 갈 수 있는 곳만이고, 달력은 날짜를 고르는 도구다.

import 를 더한다:

```ts
import { MySchedule } from "../src/features/schedule/MySchedule"
```

(이 파일의 `BottomDock` import 가 상대 경로를 쓰므로 맞춘다. `@/features/...` 도 동작하지만 주변과 다르다.)

- [ ] **Step 4: 게이트를 돌린다**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run
```

Expected: 무출력 / 전체 PASS

- [ ] **Step 5: 화면으로 확인한다**

1. **저장소를 비운 상태**로 일정 탭을 연다 → 내 블록이 **안 보이고** 달력만 나와야 한다.

```js
localStorage.removeItem("popspot:recent-visits")
```

2. 팝업 상세를 두세 개 본 뒤 일정 탭으로 돌아온다 → 그 팝업들이 **마감일 순**으로 맨 위에 있어야 한다.
3. **일정 저장**을 누른다 → 데스크톱·안드로이드는 구글 캘린더 새 탭, iOS 는 `.ics` 내려받기.
4. 모바일 폭(375px)에서 마지막 줄이 하단 메뉴에 가리지 않는지 본다.
5. 다크·라이트를 전환해 대비가 유지되는지 본다.

- [ ] **Step 6: 포맷하고 커밋한다**

```bash
cd popspot-frontend && npx prettier --write src/features/schedule/MySchedule.tsx src/lib/i18n.tsx app/HomeClient.tsx
```

```bash
git add popspot-frontend/src/features/schedule/MySchedule.tsx popspot-frontend/src/lib/i18n.tsx popspot-frontend/app/HomeClient.tsx && git commit -m "feat(schedule): give the tab a reason to come back to"
```

---

## 끝나고 확인할 것

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

`npm run format:check` 는 **이미 빨갛다** — `src/data/emergency/popups-2026-08-11.json` 이 커밋 시점부터 포맷되지 않은 채 들어 있다. 이 계획과 무관하므로, 실패하면 **어떤 파일 때문인지 읽고** 내 파일이 아니면 넘어간다. 고치겠다고 `npm run format` 을 돌리면 그 JSON 까지 다시 써서 diff 가 오염된다.

## 범위 밖 (건드리지 않는다)

- **행동 계측.** `VisitEvent.ALLOWED_TYPES` 에 없는 타입은 서버가 조용히 버리고, 타입 추가는 jar 재배포가 필요하다.
- **`MusicTab.tsx` 와 `popups/[slug]/page.tsx` 의 D-day.** 계산이 다르다. 합치면 화면이 바뀐다.
- **시간대 버그.** `dday.ts` 는 UTC-5 같은 시간대에서 하루가 밀린다. 추출 전에도 그랬다 — 이 계획은 동작을 보존한다.
- **위치 문자열 품질.** 전체의 45%가 지역 미분류다. 수집 단계 문제이고, 고치면 이 화면·지역 랜딩·지도가 함께 좋아진다.
- **로그인 동기화.** `recentVisits` 는 브라우저 단위다. 폰과 PC 가 따로 쌓이고 저장소를 지우면 사라진다. 기기를 넘어가는 것은 일정 저장이 맡는다.
