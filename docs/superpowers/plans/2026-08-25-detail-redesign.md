# 팝스팟 상세페이지 개편 — 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/popup/[id]` 를 1440 에서 두 칸으로 펴고, 종료된 팝업에 닫힌 곳으로 보내는 버튼을 없애고, 상세를 종점이 아니라 경유지로 만든다.

**Architecture:** 원안(`팝스팟 상세 개편.dc.html`)의 일곱 블록 중 **프론트 배포만으로 되는 넷**만 넣는다. 나머지 셋은 데이터가 없거나 전제가 틀렸다(맨 아래 「넣지 않는 것」). 새 API·새 의존성·백엔드 변경 0.

**Tech Stack:** Next.js App Router(커스텀 빌드), React 19, Tailwind v4, TypeScript strict, vitest 4, MapLibre GL + Protomaps pmtiles.

## 검증 근거

이 계획의 모든 전제는 2026-08-25 에 코드·라이브 데이터로 확인했다. 원안이 주장했으나 **틀린 것**은 「넣지 않는 것」에 이유와 함께 적었다.

| 전제                         | 확인                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 한 칸 레이아웃               | `PopupDetailClient.tsx:567` `mx-auto max-w-3xl`. 파일 전체 `sticky` 0회, `lg:` 0회                            |
| 하단 바가 데스크탑에 없음    | `:797` `md:hidden` — 데스크탑은 스크롤하면 길찾기가 사라진다                                                  |
| 종료 팝업에 CTA 3종이 그대로 | `:574` 길찾기 · `:584` 방문 인증 · `:600` 캘린더, 전부 종료일 무조건부                                        |
| 근처 팝업 계산 가능          | 좌표 보유 709행 중 **604행(85.2%)** 이 도보 12분 내 이웃 3곳 이상                                             |
| 코스 시드가 이미 있음        | `app/planning/page.tsx:408` 이 `sessionStorage.planningSeedCourse` 를 읽는다. **쓰는 곳은 저장소 전체에 0개** |
| 역 이름 데이터 있음          | `public/seoul.pmtiles` 에 이름 붙은 station **447개**                                                         |

---

## Global Constraints

이 절은 **모든 태스크의 요구사항에 자동으로 포함된다.**

- **백엔드 변경 금지.** 수동 jar 배포가 필요해 프론트 배포에 못 얹는다. 새 엔드포인트·새 DTO 필드 금지.
- **새 의존성 금지.** maplibre-gl · pmtiles 는 이미 설치돼 있다.
- **`npm run format` 금지.** 무관한 깨진 JSON 을 건드린다. 파일 단위로 `npx prettier --write <path>` 만 쓴다.
- `npm run format:check` 는 시작 전부터 **이미 빨갛다**(`src/data/emergency/popups-2026-08-11.json`). 네 탓이 아니다.
- Prettier: singleQuote, semi, printWidth 100, trailingComma "all", arrowParens "always", endOfLine **lf**.
- 테스트는 **`node`** 환경, **`globals: false`** — `import { describe, expect, it } from 'vitest';` 를 명시한다. DOM 이 진짜 필요할 때만 `// @vitest-environment jsdom`.
- 주석은 한국어 JSDoc(`<b>`/`<p>`)으로 **왜** 그런지 적는다. `it()` 문자열은 완결된 한국어 평서문.
- 게이트: `npm run typecheck` · `npm run lint` · `npx vitest run` · **`npm run build`**.
- **날짜 판정에 `src/lib/dday.ts` 를 쓰지 마라.** 로컬 `setHours` 라서 Vercel(UTC)에서 KST 00:00–09:00 동안 하루가 어긋난다. `src/lib/landingStatus.ts` 의 `landingStatus()` 또는 `src/lib/popupSlices.ts` 의 `isExpired`/`kstTodayStart` 를 쓴다.
- **`:475` 의 `md:pb-24` 를 지우지 마라.** `GlobalMusicPlayer`(`src/components/music/GlobalMusicPlayer.tsx:72`, `fixed bottom-20 md:bottom-24`)가 `app/layout.tsx:149` 에서 전역 마운트된다. 그 96px 은 죽은 여백이 아니라 플레이어를 피하는 간격이다.
- **배경색은 건드리지 않는다**(소유자 지시). 원안의 색 지정은 무시한다.
- 브랜치는 `claude/detail-redesign` 을 `main` 에서 딴다. **푸시하지 않는다.**

---

## File Structure

| 파일                                          | 책임                                                |
| --------------------------------------------- | --------------------------------------------------- |
| `src/lib/nearby.ts` (신규)                    | 앵커에서 도보 N분 내 가까운 순 K개. 순수 함수.      |
| `src/lib/nearby.test.ts` (신규)               | 위 함수의 테스트.                                   |
| `src/lib/courseSeed.ts` (신규)                | 작전지도 시드 직렬화 + 파이프 문자 방어. 순수 함수. |
| `src/lib/courseSeed.test.ts` (신규)           | 위 함수의 테스트.                                   |
| `src/data/stations.json` (신규, 생성물)       | pmtiles 에서 뽑은 서울 역 447개(name/lat/lng).      |
| `scripts/extract-stations.mjs` (신규)         | 위 JSON 을 만드는 일회성 빌드 스크립트.             |
| `src/lib/nearestStation.ts` (신규)            | 좌표 → 가장 가까운 역 + 도보 분. 순수 함수.         |
| `src/lib/nearestStation.test.ts` (신규)       | 위 함수의 테스트.                                   |
| `app/popup/[id]/PopupDetailClient.tsx` (수정) | 레이아웃 2단화, 종료 스왑, 새 블록 3개 배치.        |
| `app/popup/[id]/page.tsx` (수정)              | 근처 팝업용 마커 목록을 서버에서 넘긴다.            |

---

### Task 1: 종료된 팝업에서 닫힌 곳으로 보내는 버튼을 없앤다

레이아웃과 무관한 **동작** 변경이라 먼저 한다. 2단화 이후에 하면 구조 변경과 동작 변경이 한 diff 에 섞인다.

**Files:**

- Modify: `popspot-frontend/app/popup/[id]/PopupDetailClient.tsx:574-609`
- Test: `popspot-frontend/src/lib/detailActions.test.ts` (신규)
- Create: `popspot-frontend/src/lib/detailActions.ts` (신규)

**Interfaces:**

- Consumes: `landingStatus(startDate, endDate, today)` from `src/lib/landingStatus.ts`, `kstTodayStart()` from `src/lib/popupSlices.ts`
- Produces: `export function showsVisitActions(startDate: string | null, endDate: string | null, today: Date): boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`popspot-frontend/src/lib/detailActions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { showsVisitActions } from './detailActions';

const TODAY = new Date('2026-08-25T00:00:00+09:00');

describe('showsVisitActions', () => {
  it('진행 중인 팝업에는 방문 액션을 보여준다', () => {
    expect(showsVisitActions('2026-08-01', '2026-08-31', TODAY)).toBe(true);
  });

  it('이미 끝난 팝업에는 방문 액션을 보여주지 않는다 — 닫힌 곳으로 사람을 보내는 버튼이다', () => {
    expect(showsVisitActions('2026-07-01', '2026-08-12', TODAY)).toBe(false);
  });

  it('아직 열지 않은 팝업에도 보여준다 — 갈 수 있는 곳이고 일정에 담을 수 있다', () => {
    expect(showsVisitActions('2026-09-01', '2026-09-30', TODAY)).toBe(true);
  });

  it('날짜를 모르면 보여준다 — 끝났다는 증거가 없는데 숨기면 멀쩡한 팝업이 사라진다', () => {
    expect(showsVisitActions(null, null, TODAY)).toBe(true);
  });

  it('종료일 당일에는 아직 보여준다 — 그날은 아직 열려 있다', () => {
    expect(showsVisitActions('2026-08-01', '2026-08-25', TODAY)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/detailActions.test.ts
```

Expected: FAIL — `Failed to resolve import "./detailActions"`

- [ ] **Step 3: 최소 구현**

`popspot-frontend/src/lib/detailActions.ts`:

```ts
import { landingStatus } from './landingStatus';

/**
 * 방문을 전제로 한 액션(길찾기 · 방문 인증 · 일정 담기)을 보여줄지.
 *
 * <p>끝난 팝업에 이 셋을 그대로 두면 <b>닫힌 곳으로 사람을 보내는 버튼</b>이 된다. 상세로는
 * 공유 링크와 직접 방문이 계속 들어오므로(딥링크 69% · 직접 23%) 종료된 페이지도 계속 열린다.
 *
 * <p>모르면 <b>보여주는</b> 쪽으로 기울인다 — 끝났다는 증거가 없는데 숨기면 날짜 없는 팝업
 * 619곳에서 액션이 통째로 사라진다. 숨기는 것은 끝난 것이 <b>증명된</b> 경우뿐이다.
 */
export function showsVisitActions(
  startDate: string | null,
  endDate: string | null,
  today: Date,
): boolean {
  return landingStatus(startDate, endDate, today).kind !== 'ended';
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/detailActions.test.ts
```

Expected: PASS (5개)

- [ ] **Step 5: 상세 페이지에 붙인다**

`PopupDetailClient.tsx` 에서 `kstTodayStart` 와 `showsVisitActions` 를 import 하고, 이미 선계산이 모여 있는 구간(`:411-469`)에 한 줄 더한다:

```ts
// 끝난 팝업에는 방문 전제 액션을 두지 않는다 — 닫힌 곳으로 보내는 버튼이기 때문이다.
const canVisit = showsVisitActions(popup.startDate ?? null, popup.endDate ?? null, kstTodayStart());
```

그리고 `:574`(길찾기) · `:584`(방문 인증) · `:600`(캘린더) 세 블록을 `{canVisit && ( ... )}` 로 감싼다. **세 개를 각각 감싼다** — 하나로 묶어 감싸면 그 안의 레이아웃 클래스가 함께 사라진다.

- [ ] **Step 6: 전체 게이트**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

- [ ] **Step 7: 사보타주 증명**

`showsVisitActions` 의 `!== 'ended'` 를 `=== 'ended'` 로 뒤집고 `npx vitest run src/lib/detailActions.test.ts` 를 돌려 「이미 끝난 팝업에는…」 이 **실패하는 것을 눈으로 본 뒤** 되돌린다. 두 출력을 보고서에 붙인다.

- [ ] **Step 8: 커밋**

```bash
git add popspot-frontend/src/lib/detailActions.ts popspot-frontend/src/lib/detailActions.test.ts "popspot-frontend/app/popup/[id]/PopupDetailClient.tsx"
git commit -m "fix(popup-detail): stop offering directions to a pop-up that already closed"
```

---

### Task 2: 1440 에서 두 칸으로 편다

**Files:**

- Modify: `popspot-frontend/app/popup/[id]/PopupDetailClient.tsx:567` (컨테이너), `:475` (main), `:797` (하단 바)
- Modify: `popspot-frontend/src/components/Map/DetailMap.tsx:32` (높이 결합)

**Interfaces:**

- Consumes: Task 1 의 `canVisit`
- Produces: 없음(순수 마크업)

**설계.** 오른쪽 레일에 **정보바 · CTA · 캘린더 · NowWait**, 왼쪽에 **소개 · 위치 · 음악 · 팁 · 출처**. 블록끼리 공유하는 상태가 없고(`:411-469` 에서 전부 선계산) 자유롭게 재부모화된다.

**768–1023px 밴드에 반드시 답을 준다.** 지금 `md` = 768px 에서 `max-w-3xl` 이 걸리고 하단 바가 사라진다. 2단을 `lg:` 로만 넣으면 **그 구간만 하단 바도 없고 2단도 없는 최악**이 된다. 하단 바의 `md:hidden` 을 `lg:hidden` 으로 바꿔 태블릿 구간에서도 하단 바가 살아 있게 한다.

- [ ] **Step 1: 하단 바를 태블릿까지 살린다**

`:797` 의 `md:hidden` → `lg:hidden`. 같은 줄의 다른 클래스는 건드리지 않는다.

- [ ] **Step 2: 컨테이너를 2단으로 만든다**

`:567` 의 `<div className="mx-auto max-w-3xl px-4 md:px-6">` 를 다음으로 바꾼다:

```tsx
{/* 1440 에서 max-w-3xl 한 칸은 좌우 336px 씩을 버린다. lg 이상에서만 두 칸으로 펴고,
    md(768–1023) 구간은 한 칸 그대로 두되 하단 바가 살아 있어 액션이 사라지지 않는다. */}
<div className="mx-auto max-w-3xl px-4 md:px-6 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
```

- [ ] **Step 3: 오른쪽 레일을 만든다**

정보바 · CTA 3종 · 캘린더 · NowWait 를 감싸는 `<aside>` 로 옮긴다:

```tsx
<aside className="lg:sticky lg:top-6 lg:self-start">
  {/* 데스크탑에서 하단 바가 없으므로(lg:hidden) 액션이 여기서 항상 보여야 한다. */}
  ...
</aside>
```

`lg:self-start` 가 없으면 grid item 이 세로로 늘어나 `sticky` 가 동작하지 않는다.

- [ ] **Step 4: 지도 높이 결합을 함께 고친다**

지도 박스가 좁아지므로 `PopupDetailClient` 쪽 `h-[250px] md:h-[350px]` 와 `DetailMap.tsx:32` 의 `min-h-[250px] md:min-h-[350px]` 를 **함께** 바꾼다. 한쪽만 바꾸면 MapLibre attribution 이 다시 잘린다.

- [ ] **Step 5: 게이트 + 눈으로 확인**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

그리고 **1440 · 1024 · 900 · 768 · 375 다섯 폭**에서 확인한다:

- 1440/1024: 두 칸, 오른쪽 고정, 하단 바 없음
- 900/768: 한 칸, **하단 바 있음**
- 375: 지금과 동일
- 모든 폭에서 지도 attribution 이 잘리지 않음

- [ ] **Step 6: 커밋**

```bash
git add "popspot-frontend/app/popup/[id]/PopupDetailClient.tsx" popspot-frontend/src/components/Map/DetailMap.tsx
git commit -m "feat(popup-detail): use the second half of a 1440 screen"
```

---

### Task 3: 「여기까지 왔으면」 — 도보 12분 안 3곳

**Files:**

- Create: `popspot-frontend/src/lib/nearby.ts`, `popspot-frontend/src/lib/nearby.test.ts`
- Modify: `popspot-frontend/app/popup/[id]/page.tsx` (마커 목록을 서버에서 넘긴다)
- Modify: `popspot-frontend/app/popup/[id]/PopupDetailClient.tsx` (블록 렌더)

**Interfaces:**

- Consumes: `walkInfo(lat1, lng1, lat2, lng2): WalkInfo` from `src/lib/walkGroups.ts`, `PublicMapMarker` from `src/lib/mapMarkers.ts`
- Produces: `export interface Nearby { marker: PublicMapMarker; minutes: number; text: string }` 와 `export function nearbyWithin(anchor: {lat:number; lng:number}, markers: PublicMapMarker[], maxMinutes: number, limit: number): Nearby[]`

**`walkGroups` 를 부르지 마라.** 그건 소비형 greedy 파티션이라 이웃당 시간이 아니라 그룹 최대값 하나만 준다. 재사용할 것은 그 아래의 `walkInfo` 뿐이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`popspot-frontend/src/lib/nearby.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { PublicMapMarker } from './mapMarkers';
import { nearbyWithin } from './nearby';

const pin = (id: number, name: string, lat: string, lng: string): PublicMapMarker => ({
  id,
  name,
  location: null,
  latitude: lat,
  longitude: lng,
  category: null,
  startDate: null,
  endDate: null,
});

// 실측 성수 좌표.
const ANCHOR = { lat: 37.5447, lng: 127.0557 };
const CLOSE = pin(1, '무신사 스토어 성수', '37.5414', '127.0559'); // 약 370m
const MID = pin(2, '성수연방', '37.5436', '127.0561'); // 약 130m
const FAR = pin(3, '홍대 어딘가', '37.5563', '126.9235'); // 약 12km

describe('nearbyWithin', () => {
  it('가까운 순으로 돌려준다', () => {
    const got = nearbyWithin(ANCHOR, [CLOSE, MID], 15, 3);
    expect(got.map((n) => n.marker.id)).toEqual([2, 1]);
  });

  it('도보 시간이 기준을 넘으면 뺀다', () => {
    const got = nearbyWithin(ANCHOR, [MID, FAR], 15, 3);
    expect(got.map((n) => n.marker.id)).toEqual([2]);
  });

  it('limit 만큼만 돌려준다', () => {
    const got = nearbyWithin(ANCHOR, [CLOSE, MID], 15, 1);
    expect(got).toHaveLength(1);
  });

  it('좌표가 없는 마커는 조용히 뺀다 — 거리를 계산할 수 없다', () => {
    const noCoord = pin(4, '좌표 없음', '', '');
    const got = nearbyWithin(ANCHOR, [MID, noCoord], 15, 3);
    expect(got.map((n) => n.marker.id)).toEqual([2]);
  });

  it('앵커 자기 자신은 결과에 넣지 않는다', () => {
    const self = pin(9, '나 자신', '37.5447', '127.0557');
    const got = nearbyWithin(ANCHOR, [self, MID], 15, 3, 9);
    expect(got.map((n) => n.marker.id)).toEqual([2]);
  });

  it('이웃이 하나도 없으면 빈 배열이다', () => {
    expect(nearbyWithin(ANCHOR, [FAR], 15, 3)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/nearby.test.ts
```

Expected: FAIL — `Failed to resolve import "./nearby"`

- [ ] **Step 3: 최소 구현**

`popspot-frontend/src/lib/nearby.ts`:

```ts
import type { PublicMapMarker } from './mapMarkers';
import { walkInfo } from './walkGroups';

/** {@link nearbyWithin} 이 돌려주는 이웃 하나. */
export interface Nearby {
  marker: PublicMapMarker;
  /** 앵커에서 이 마커까지 도보 분. */
  minutes: number;
  /** "도보 4분" 처럼 화면에 그대로 쓸 수 있는 문자열. */
  text: string;
}

function coord(marker: PublicMapMarker): { lat: number; lng: number } | null {
  const lat = Number(String(marker.latitude ?? '').trim());
  const lng = Number(String(marker.longitude ?? '').trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * 앵커에서 도보 {@code maxMinutes} 안에 있는 이웃을 가까운 순으로 최대 {@code limit} 개.
 *
 * <p>상세가 <b>종점이 아니라 경유지</b>가 되게 하려고 만든다. 지금은 상세에 도착하면 다음 행동이
 * 없어서 거기서 끝난다.
 *
 * <p>{@code walkGroups} 를 쓰지 않는 이유: 그건 소비형 greedy 파티션이라 마커를 그룹에 <b>한 번씩만</b>
 * 넣고, 이웃별 시간이 아니라 그룹 최대값 하나만 준다. 여기서 필요한 건 앵커 기준 개별 거리다.
 *
 * <p>{@code selfId} 를 주면 그 마커는 뺀다 — 자기 자신이 "도보 0분" 으로 목록에 들어가면 안 된다.
 */
export function nearbyWithin(
  anchor: { lat: number; lng: number },
  markers: PublicMapMarker[],
  maxMinutes: number,
  limit: number,
  selfId?: number,
): Nearby[] {
  const out: Nearby[] = [];
  for (const marker of markers) {
    if (selfId !== undefined && marker.id === selfId) continue;
    const c = coord(marker);
    if (!c) continue;
    const info = walkInfo(anchor.lat, anchor.lng, c.lat, c.lng);
    if (info.time > maxMinutes) continue;
    out.push({ marker, minutes: info.time, text: `도보 ${info.time}분` });
  }
  return out.sort((a, b) => a.minutes - b.minutes).slice(0, limit);
}
```

**`walkInfo` 는 `{ dist: string; time: number }` 를 돌려준다**(`src/lib/walkGroups.ts:14-19`) — `minutes` 가 아니라 **`time`** 이다. 우리 `Nearby` 는 `minutes` 라는 이름을 쓰므로 경계에서 한 번 갈아 끼운다. 거리 문자열이 필요하면 `info.dist` 가 이미 `'723m'` / `'1.5km'` 형태로 만들어져 있으니 직접 포맷하지 마라.

- [ ] **Step 4: 통과를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/nearby.test.ts
```

Expected: PASS (6개)

- [ ] **Step 5: 서버에서 마커 목록을 넘긴다**

`app/popup/[id]/page.tsx` 에서 `loadPublicMarkers()`(`src/lib/emergencyPopupData.ts`)를 호출해 `PopupDetailClient` 에 prop 으로 넘긴다. **클라이언트에서 부르지 마라** — 355KB 를 다시 받고 크롤러에는 보이지 않는다.

**종료된 팝업을 추천하지 않도록 반드시 거른다.** `/api/map/markers` 는 서버에서 날짜 필터를 하지 않는다(`PopupStoreService.java:196-200`). `isOpenNow(m.startDate, m.endDate, kstTodayStart())` 로 거른 뒤 넘긴다.

- [ ] **Step 6: 블록을 렌더한다**

왼쪽 칸 아래쪽(팁 다음, 출처 앞)에 놓는다. `<h3>` + `text-sm md:text-base` — 본문을 돕는 보조 섹션이다. 좌표가 없거나 이웃이 0곳이면 **섹션 자체를 그리지 않는다.**

- [ ] **Step 7: 게이트**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

- [ ] **Step 8: 사보타주 증명**

`if (info.time > maxMinutes) continue;` 를 지우고 「도보 시간이 기준을 넘으면 뺀다」 가 실패하는 것을 본 뒤 되돌린다.

- [ ] **Step 9: 커밋**

```bash
git add popspot-frontend/src/lib/nearby.ts popspot-frontend/src/lib/nearby.test.ts "popspot-frontend/app/popup/[id]/page.tsx" "popspot-frontend/app/popup/[id]/PopupDetailClient.tsx"
git commit -m "feat(popup-detail): make the page a stop on the way, not a dead end"
```

---

### Task 4: 「세 곳 묶어 코스로」 — 이미 있는 시드 리더에 쓰는 쪽을 붙인다

**Files:**

- Create: `popspot-frontend/src/lib/courseSeed.ts`, `popspot-frontend/src/lib/courseSeed.test.ts`
- Modify: `popspot-frontend/app/popup/[id]/PopupDetailClient.tsx`

**Interfaces:**

- Consumes: Task 3 의 `Nearby[]`
- Produces: `export function toCourseSeed(items: {name: string; lat: number; lng: number}[]): {name: string; lat: number; lng: number}[]`

**이미 반쯤 되어 있다.** `app/planning/page.tsx:408` 이 `sessionStorage.getItem('planningSeedCourse')` 를 읽어 방을 시드한다. **쓰는 곳이 저장소 전체에 하나도 없다.** 백엔드 변경 불필요(`:405` 주석에 그렇게 적혀 있다).

**파이프 문자가 함정이다.** 시드는 `` `${p.name}|${p.lat}|${p.lng}` `` 로 직렬화되고(`:415`) 서버가 `split("\\|")` 로 검증한다(`PlanningController.java:220-236`). 실제 데이터에 「TOY STORY | PEACEMINUSONE…」 처럼 `|` 가 든 이름이 있어 **조용히 실패한다.**

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';

import { toCourseSeed } from './courseSeed';

describe('toCourseSeed', () => {
  it('이름에 든 파이프 문자를 지운다 — 시드가 name|lat|lng 로 직렬화되기 때문이다', () => {
    const got = toCourseSeed([{ name: 'TOY STORY | PEACEMINUSONE', lat: 37.5, lng: 127.0 }]);
    expect(got[0].name).not.toContain('|');
  });

  it('파이프를 지운 뒤에도 읽을 수 있는 이름을 남긴다', () => {
    const got = toCourseSeed([{ name: 'A | B', lat: 37.5, lng: 127.0 }]);
    expect(got[0].name.trim()).not.toBe('');
  });

  it('좌표가 유한하지 않으면 통째로 뺀다', () => {
    const got = toCourseSeed([{ name: '깨진 것', lat: NaN, lng: 127.0 }]);
    expect(got).toEqual([]);
  });

  it('멀쩡한 항목은 그대로 통과시킨다', () => {
    const got = toCourseSeed([{ name: '성수연방', lat: 37.5436, lng: 127.0561 }]);
    expect(got).toEqual([{ name: '성수연방', lat: 37.5436, lng: 127.0561 }]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd popspot-frontend && npx vitest run src/lib/courseSeed.test.ts
```

- [ ] **Step 3: 최소 구현**

```ts
/**
 * 작전지도 방 시드로 넘길 형태로 다듬는다.
 *
 * <p>시드는 {@code `${name}|${lat}|${lng}`} 로 직렬화되고 서버가 {@code split("\\|")} 로 되돌린다.
 * 그래서 <b>이름에 파이프가 있으면 필드 수가 늘어 조용히 거절</b>된다 — 실제 데이터에
 * 「TOY STORY | PEACEMINUSONE」 같은 이름이 있다. 지우고 보낸다.
 */
export function toCourseSeed(
  items: { name: string; lat: number; lng: number }[],
): { name: string; lat: number; lng: number }[] {
  return items
    .filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng))
    .map((i) => ({ ...i, name: i.name.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim() }))
    .filter((i) => i.name !== '');
}
```

- [ ] **Step 4: 통과를 확인한다**

- [ ] **Step 5: 버튼을 붙인다**

「여기까지 왔으면」 블록 아래. 링크가 아니라 **버튼**이다: `sessionStorage.setItem('planningSeedCourse', JSON.stringify(toCourseSeed([...])))` → 방 생성 → 이동. 방 생성 경로는 `app/planning/page.tsx` 가 쓰는 것을 그대로 따른다.

**방 TTL 이 3시간이다**(`PlanningController.java:43`). 「코스」가 3시간 뒤 사라진다는 것을 카피에 반영하거나, 반영하지 않기로 하고 그 판단을 보고서에 적어라.

- [ ] **Step 6: 게이트 + 사보타주 증명**

`.replace(/\|/g, ' ')` 를 지우고 첫 테스트가 실패하는 것을 본 뒤 되돌린다.

- [ ] **Step 7: 커밋**

```bash
git add popspot-frontend/src/lib/courseSeed.ts popspot-frontend/src/lib/courseSeed.test.ts "popspot-frontend/app/popup/[id]/PopupDetailClient.tsx"
git commit -m "feat(popup-detail): wire the course seed that planning already reads"
```

---

### Task 5: 「가는 법」 — 가장 가까운 역과 도보 분 (가장 큰 태스크)

**Files:**

- Create: `popspot-frontend/scripts/extract-stations.mjs`
- Create: `popspot-frontend/src/data/stations.json` (스크립트 생성물, 커밋한다)
- Create: `popspot-frontend/src/lib/nearestStation.ts`, `popspot-frontend/src/lib/nearestStation.test.ts`
- Modify: `popspot-frontend/app/popup/[id]/PopupDetailClient.tsx`

**Interfaces:**

- Consumes: `walkInfo` from `src/lib/walkGroups.ts`
- Produces: `export function nearestStation(lat: number, lng: number, maxMinutes?: number): { name: string; minutes: number } | null`

**출구 번호는 넣지 않는다.** `seoul.pmtiles` 의 `subway_entrance` 2,140개 중 이름에 출구 번호가 붙은 것은 **92개(30개 역)** 뿐이다. 성수·강남은 되고 홍대입구·명동·여의도는 안 된다. 무작정 최근접 조인을 하면 홍대 좌표에서 **「신길역 3번 출구, 도보 74분」** 이 나온다. 역 이름 + 도보 분까지만 한다(447개 역 전부 이름이 있다).

- [ ] **Step 1: 역 데이터를 뽑는 스크립트를 쓴다**

> **이 스텝만 완성된 코드를 주지 못한다.** pmtiles 아카이브에서 벡터 타일을 풀어 피처를 읽는 코드는 이 저장소에 선례가 없어서, 검증 없이 적으면 틀린 코드를 주게 된다. 대신 **출력 계약과 합격 조건**을 못박는다. 스텝 2 의 확인을 통과하지 못하면 그 스크립트는 틀린 것이다.

**출력 계약** — `src/data/stations.json`:

```json
[{ "name": "성수", "lat": 37.5447, "lng": 127.0557 }]
```

- `name` 은 pmtiles 피처의 `name` 또는 `name:ko`. 빈 문자열이면 그 피처는 버린다.
- 좌표는 소수점 6자리로 반올림한다(1m 미만 정밀도는 필요 없고 파일만 커진다).
- 같은 역이 여러 타일에 걸쳐 중복으로 나온다. **`name` 기준으로 중복을 제거**하되, 좌표는 첫 번째 것을 쓴다.
- 배열은 `name` 오름차순으로 정렬해 커밋한다 — 정렬해 두지 않으면 다음에 다시 뽑을 때 diff 가 통째로 바뀐다.

**참고할 것:** `pmtiles` 패키지는 이미 dependency 이고, `src/components/Map/mapStyle.ts` 가 이 아카이브를 어떻게 열어 쓰는지 보여준다. 벡터 타일 디코딩에는 별도 패키지가 필요할 수 있는데 — **새 런타임 의존성은 금지**지만 이 스크립트는 빌드 타임 일회성이므로 `devDependencies` 는 허용한다. 추가했다면 보고서에 무엇을 왜 넣었는지 적어라.

**막히면 멈추고 보고하라.** 이 태스크는 뒤의 것을 막지 않는다 — Task 1–4 가 이미 끝나 있으면 「가는 법」 없이 배포해도 된다.

- [ ] **Step 2: 스크립트를 돌리고 결과를 눈으로 확인한다**

```bash
cd popspot-frontend && node scripts/extract-stations.mjs
```

기대: 약 447개. `성수`, `강남`, `홍대입구` 가 들어 있고 좌표가 서울 범위(위도 37.4–37.72, 경도 126.73–127.22) 안인지 확인한다. **개수가 크게 다르면 멈추고 보고하라** — 잘못 뽑은 것이다.

- [ ] **Step 3: 실패하는 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest';

import { nearestStation } from './nearestStation';

describe('nearestStation', () => {
  it('성수동 좌표에서는 성수역을 찾는다', () => {
    const got = nearestStation(37.5447, 127.0557);
    expect(got?.name).toContain('성수');
  });

  it('강남 좌표에서는 성수역을 찾지 않는다 — 최근접이지 고정값이 아니다', () => {
    const got = nearestStation(37.4979, 127.0276);
    expect(got?.name).not.toContain('성수');
  });

  it('도보 기준을 넘으면 null 이다 — 30분 걸리는 역은 가는 법이 아니다', () => {
    // 서울 경계 밖(김포 방면). 가까운 역이 없다.
    expect(nearestStation(37.62, 126.6, 15)).toBeNull();
  });

  it('좌표가 유한하지 않으면 null 이다', () => {
    expect(nearestStation(NaN, 127.0)).toBeNull();
  });
});
```

- [ ] **Step 4: 실패를 확인한다**

- [ ] **Step 5: 최소 구현**

```ts
import stations from '@/data/stations.json';

import { walkInfo } from './walkGroups';

/**
 * 좌표에서 가장 가까운 지하철역과 도보 분.
 *
 * <p>원안은 <b>출구 번호</b>까지 쓰자고 했지만(「성수역 3번 출구」) pmtiles 의 출구 2,140개 중
 * 번호가 붙은 것은 92개(30개 역)뿐이다. 홍대입구·명동·여의도가 빠져 있어 무작정 최근접 조인을
 * 하면 홍대 좌표에서 「신길역 3번 출구 · 도보 74분」 이 나온다. 그래서 <b>역 이름까지만</b> 한다.
 *
 * <p>{@code maxMinutes} 를 넘으면 {@code null} — 도보 30분 걸리는 역은 가는 법이 아니라 소음이다.
 */
export function nearestStation(
  lat: number,
  lng: number,
  maxMinutes = 15,
): { name: string; minutes: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: { name: string; minutes: number } | null = null;
  for (const s of stations as { name: string; lat: number; lng: number }[]) {
    const info = walkInfo(lat, lng, s.lat, s.lng);
    if (best === null || info.time < best.minutes) best = { name: s.name, minutes: info.time };
  }
  return best && best.minutes <= maxMinutes ? best : null;
}
```

- [ ] **Step 6: 통과를 확인한다**

- [ ] **Step 7: 블록을 렌더한다**

주소 바로 아래 한 줄. 좌표가 없거나 `nearestStation` 이 `null` 이면 **그리지 않는다** — 성수동 폴백을 없앤 것과 같은 규칙이다.

- [ ] **Step 8: 게이트**

```bash
cd popspot-frontend && npm run typecheck && npm run lint && npx vitest run && npm run build
```

`stations.json` 이 번들에 들어가므로 **빌드 크기 변화를 보고하라.** 447개 × 3필드면 대략 20KB 미만이어야 한다. 크게 넘으면 뭔가 잘못 뽑은 것이다.

- [ ] **Step 9: 사보타주 증명**

`info.time < best.minutes` 를 `>` 로 뒤집고 「성수동 좌표에서는 성수역을 찾는다」 가 실패하는 것을 본 뒤 되돌린다.

- [ ] **Step 10: 커밋**

```bash
git add popspot-frontend/scripts/extract-stations.mjs popspot-frontend/src/data/stations.json popspot-frontend/src/lib/nearestStation.ts popspot-frontend/src/lib/nearestStation.test.ts "popspot-frontend/app/popup/[id]/PopupDetailClient.tsx"
git commit -m "feat(popup-detail): say which station this is near and how far it walks"
```

---

## 넣지 않는 것 — 그리고 왜

원안의 일곱 블록 중 셋은 뺀다. **전제가 틀렸기 때문이지 우선순위 때문이 아니다.**

**「이 시간에 가면」(시간대별 혼잡도).** 원안이 "새로 물어볼 게 없다" 고 한 블록인데, 그렇지 않다. 시각은 DB 에 있지만(`Stamp.java:55-56` `LocalDateTime`) 팝업 단위로 읽을 엔드포인트가 없고(`StampController` 의 read 는 `GET /my` 하나, 클래스 레벨 `@PreAuthorize`), 무엇보다 그 시각은 **방문 시각이 아니라 버튼 누른 시각**이다 — `addStamp` 에 위치·장소·시간 창 검사가 하나도 없다. 표본도 설계상 팝업당 유저 1행이 상한이다(`uk_stamp_user_popup`). 몇 건짜리 히스토그램을 권위 있는 차트로 그리게 된다. 시간대가 정말 필요하면 `popup_wait_report`(이미 팝업별 · `created_at` 인덱스 · 게스트 공개 · 비식별)를 버킷 집계하는 쪽이 맞다.

**「들어갈 수 있나요」(입장 조건).** 소스가 통째로 없다. `PopupStore` 에 입장료 · 예약필수 · 연령 · 반려동물 컬럼이 하나도 없고 크롤러 정규화 형태에도 없다. 전 항목이 "확인 안 됨" 으로 찍히는 블록은 기능이 아니라 **다섯 줄짜리 사과문**이다. 제보 진입은 이미 `:745-765` 에 있으니 거기 붙이고, 조건 확인 경로로는 **원문 보기**를 승격한다(`sourceUrl` 은 1,181/1,181 로 유일하게 살아 있는 이탈 경로다).

**「200m 이내에서만 눌립니다」.** 그런 지오펜스가 없다. `handleStamp` 는 좌표를 보내지 않고(`POST /api/stamps?userId=&popupId=`, body 없음) 서버도 `popupId` 만 받는다. 실제 규칙은 **하루 한 곳**(`StampService.java:64`)과 **팝업당 평생 한 번**(`:70`) 둘인데 화면에 안 적혀 있다. 이건 `claude/detail-truth` 브랜치에서 이미 다뤘다.

또 하나 정정: **「SEO 트래픽이 종료 팝업에 계속 들어온다」는 메커니즘이 틀렸다.** 종료 상세는 이미 noindex 다(`indexableDetail.ts:70` → `layout.tsx:60-62`). 실제 유입은 딥링크 69% + 직접 23% 다. 종료 화면이 필요하다는 결론은 맞지만 **검색이 아니라 공유된 링크를 위해** 만드는 것이다.

## 백엔드 배포와 함께 올릴 것 (이번 계획 밖)

- 종료 화면의 「총 방문 인증 N건」 — `StampRepository.countByPopupStore_Id` + DTO 필드 하나. `viewCount` 는 페이지뷰지 인증이 아니라 그걸 갖다 쓰면 거짓말이 된다. 자리는 Task 1 에서 비워두고 나중에 채운다.
- 영문 메타의 "Hours" 오역 — `landingCopy.ts:401,409,415,419` 가 "Hours, location and closing dates" 인데 한국어 원문은 「운영 기간」(날짜 범위)이다. **지워버린 영업시간이 영문 메타에는 아직 살아 있다.** 프론트만으로 되지만 이번 개편과 파일이 겹치지 않아 따로 다룬다.
