# 최대 3곳 비교 — 개별 개발계획 (마스터 플랜 §4.3 · 작업 3)

작성 2026-09-07. 근거는 같은 날 돌린 코드 조사(4영역 + 비평)와 운영 DB 실측이다.

마스터 플랜은 이 문서 같은 것을 요구한다 — *"현재 코드·운영 상태를 다시 확인하고, 인터페이스와
테스트를 확정한 개별 개발계획을 작성한 뒤 실행"*. 아래가 그 확정본이다.

## 1. 무엇을 만들지 — 그리고 기획에서 무엇을 뺐는지

§4.3 은 비교 항목 다섯을 적었다: **주요 경험 · 입장 조건 · 운영 기간 · 비용 · 위치**.
그중 **둘은 만들 수 없다.** 값이 비어 있는 게 아니라 담을 그릇이 없다.

| 항목 | 판정 | 확인한 곳 |
|---|---|---|
| 위치 | ✅ 있음 | `PopupStore.java:63,66` · 목록/상세 DTO 둘 다 · 프론트 `PopupSummary` |
| 운영 기간 | 🟡 일부만 | `PopupStore.java:78-82` — 타입이 `String`, 결손 **64.5%** |
| 한 줄 요약 | ✅ 있음 | `description` — 실측 **99.1% 고유** |
| 입장 조건 | ❌ **없음** | 엔티티 · V1~V33 마이그레이션 · 두 DTO · **LLM 추출 프롬프트** 넷 다 없음 |
| 비용 | ❌ **없음** | `price` 계열 컬럼 자체가 없음(`Goods` 엔티티의 것은 무관) |

**결정적 근거는 LLM 프롬프트에 항목이 없다는 것이다.** 수집을 시도조차 하지 않으므로 크롤러를
다시 돌려도 채워지지 않는다. 채우려면 컬럼 추가 → 마이그레이션 → 프롬프트 개정 → DTO 노출 →
jar 배포 전 구간이고, 그러고도 검색 스니펫에 가격이 없으면 여전히 `null` 이다.

그래서 **다섯이 아니라 셋으로 만든다.** 빈 칸을 그려 두고 "정보 없음" 을 적는 것과 칸을 안 만드는
것은 다르다 — 전자는 우리가 모른다는 사실을 카드마다 반복해 보여 준다. §4.3 의
*"비교 항목이 없으면 임의 정보를 채우지 않음"* 이 이 결정의 근거다.

### 운영 DB 실측 (2026-09-07, 공개 필터 3조건 전부 적용)

```
실제노출 1,396 · 종료일없음 900(64.5%) · 시작일없음 26(1.9%)
요약종류수 1,383(99.1% 고유) · 요약평균 20.2자 · 15자미만 318(22.8%)
이름에 날짜 든 것 — 전체 9건, 공개 대상 0건
```

두 가지를 이 수치에서 읽는다.

**첫째, `description` 이 쓸 만하다.** "100% 채워져 있다" 만으로는 아무것도 증명되지 않는다 —
같은 문장이 1,396번 복사돼 있어도 채워진 것이다. **99.1% 가 서로 다르다**는 것이 세 번째 칸이
실제 비교값을 갖는다는 증거다. `count(*)` 만 세고 `count(DISTINCT)` 를 안 셌으면 놓쳤을 자리다.

**둘째, 이 수치가 서로를 검증했다.** `실제노출 1,396` 이 같은 날 `/api/map/markers` 로 센 값과
정확히 같다. 서로 다른 경로로 잰 두 값이 일치하면 둘 다 맞다.

### 종료일 64.5% 결손을 결함으로 다루지 않는다

`endDate` 결손은 사고가 아니라 **설계된 결과**다. LLM 프롬프트가 명시한다 —
*"'12월까지', '연말까지', '8월 말까지' → endDate = null. 달의 마지막 날로 바꾸지 마."*
2026-09-07 에 배포한 상설 매장 규칙도, 같은 날 3402 를 다루며 내린 판단도 같은 논리였다.

그리고 **"마감일 미정" 도 비교 정보다.** "이건 언제 끝날지 모름 / 저건 D-5" 는 방문 순서를 정할 때
쓰는 실제 구분이다. 셋 다 미정일 확률은 `0.645³ ≈ 27%`, 즉 **73% 의 비교에서 기간 칸이 구분값을 낸다.**

그릴 도구는 이미 있다 — `savedPeriodBadge` 가 `{kind:'open-undated'}` 를 따로 돌려준다.
이 종류가 존재하는 이유가 정확히 이 상황이다.

## 2. 1차 범위 — 기획에서 더 줄인 것과 그 이유

| 결정 | §4.3 원문 | 1차 | 왜 |
|---|---|---|---|
| 진입점 | 상세·랜딩·마이팝 셋 | **마이팝 하나** | 마이팝은 홈이 이미 목록을 메모리에 들고 있어 **추가 요청 0건**. 랜딩의 서버 컴포넌트 island 문제와 상세의 고정 바 3겹 문제를 둘 다 피한다 |
| 후보 풀 | 임의의 팝업 | **찜한 것 중에서** | 저장소를 네 번째로 늘리지 않는다(§3 참고) |
| 화면 | 명시 없음 | **모달** (라우트 없음) | robots.txt·`app/en`·`app/ja` 3벌·canonical/hreflang·하이드레이션 깜빡임이 전부 불필요해진다 |
| 계정 저장 후 복귀 | 있음 | **뺀다** | 서버 엔티티·엔드포인트·jar 배포가 필요한 유일한 조각. *"현재 기기의 비교는 비회원에게도 제공한다"* 만 지키면 1차 약속은 지켜진다 |

**이 축소의 부수 효과 하나 — 되돌리기가 순수해진다.** 백엔드 변경 0, 마이그레이션 0, 데이터 변경 0.
중단은 커밋 되돌리기로 끝나고 지울 것도 되살릴 것도 없다.

## 3. 저장소를 네 번째로 만들지 않는다

이것이 조사에서 나온 가장 중요한 판단이다. 데이터보다 **역할 중복이 더 위험하다.**

- 찜(`guestWishlist` / 서버 wishlist)은 이미 **후보 목록**이다.
- 코스(`myCourseItems`)는 이미 **순서 있는 다중 선택 목록**이다(중복 거절 · 드래그 정렬 · 서버 저장).

비교를 세 번째 팝업 저장소로 만들면 사용자가 고른 팝업이 세 군데로 갈라지고, 상세 화면 한 자리에
하트·코스담기·비교담기가 나란히 서게 된다. 마스터 플랜 §1.3 이 *"기존 코스나 플래너를 같은 역할로
새로 만들지 않음"* 을 못박은 지점이다.

**그래서 비교 대상을 "찜한 것 중 지금 고른 최대 3개" 로 정의한다.** 비교 목록은 후보 저장소가
아니라 **찜 위의 선택 상태**다. 따라오는 것 셋:

- 마이팝의 `wishGroups.current` 가 그대로 후보 풀이 된다.
- 비회원 지원이 공짜로 따라온다 — `guestWishlist` 가 이미 비회원 로컬 저장이고, MY 탭은
  2026-09-06(`0faba2f`)부터 비회원에게 열려 있다. `tabAccess.ts` 에서 MY 를 뺀 근거가 그대로 적용된다.
- 선택 상태만 새 키에 둔다. **비교를 `USER_ONLY_TABS` 에 넣지 않는다.**

## 4. 인터페이스 확정

### 4.1 `src/lib/compareSelection.ts` (신규)

`externalMediaConsent.ts` 를 본보기로 삼되 값이 배열이라 참조 캐싱을 더한다.

```ts
export const COMPARE_SELECTION_KEY = 'popspot:compare:selected';
export const COMPARE_SELECTION_EVENT = 'popspot:compare-selection';
export const COMPARE_MAX = 3;

export type CompareToggleResult = {
  selected: boolean; // 이 호출 뒤 담긴 상태인가
  saved: boolean; // 저장소에 실제로 적혔는가
  reason?: 'full'; // 상한이라 거절됐다
};

export function resolveCompareSelection(raw: unknown): number[]; // 순수 — 손상값 판정
export function readCompareSelection(): number[];
export function isCompared(id: number): boolean;
export function toggleCompareSelection(id: number): CompareToggleResult;
export function removeCompareSelection(id: number): boolean;
export function forgetCompareSelection(ids: number[]): void; // 찜 해제 연동용
export function clearCompareSelection(): void;
export function useCompareSelection(): number[]; // useSyncExternalStore
```

계약에서 **`guestWishlist` 와 일부러 다르게 하는 것 하나** — 상한 처리다.
`guestWishlist` 는 `.slice(-MAX)` 로 **가장 오래된 것을 말없이 버린다**(100개 상한이라 실제로
겪을 일이 드물다). 비교는 상한이 3 이라 **매일 겪는다.** 4번째를 담는 순간 1번째가 조용히 사라지면
사용자는 자기가 고른 것이 없어진 이유를 알 수 없다. 그래서 **버리지 않고 거절하고 알린다**
(`reason:'full'` → `notify` 로 "최대 3곳까지예요").

나머지는 그대로 베낀다 — `popspot:` 접두 키, id 배열 + 담은 순서, 손상값을 조용히 `[]` 로,
쓰기 성공을 boolean 으로 돌려 화면이 거짓말하지 않게 하기, try/catch 로 저장소 차단 환경 흡수.

### 4.2 `src/lib/compareRows.ts` (신규) — 순수

```ts
export type CompareRowKind = 'location' | 'period' | 'summary';
export type CompareCell = { text: string; sub?: string; urgent?: boolean };
export type CompareRow = { kind: CompareRowKind; cells: (CompareCell | null)[] };

export function buildCompareRows(items: CompareItem[], today?: Date): CompareRow[];
```

**핵심 규칙: 한 행의 모든 칸이 비면 그 행을 아예 만들지 않는다.** §4.3 의 "임의 정보를 채우지
않음" 을 비교 단위로 적용한 것이다. 셋 다 요약이 없으면 "요약" 줄 자체가 없다.

행별 값:

- `location` — `bilingual(locationXx, location)`. **서울 접두사 버그를 아는 채로 쓴다**(순천·부산·판교에
  "서울" 이 붙는 알려진 크롤러 버그. 좌표는 맞고 표기가 틀리다).
- `period` — `savedPeriodBadge` 의 kind 를 그대로. `'open-undated'` 는 "마감일 미정".
  색은 반드시 `isUrgentPeriod` 로 고르고 **보이는 글자를 되묻지 않는다**(그 함정이 주석에 있다).
  기간 문자열은 상세 헤더와 같은 `periodText` 를 써서 두 화면이 다른 말을 하지 않게 한다.
- `summary` — `description`. 비면 카테고리 라벨로 떨어지고, 그것도 없으면 그 칸은 `null`.

### 4.3 `src/features/popup/CompareModal.tsx` (신규)

`AllTrendingModal.tsx` 를 구조 그대로 따른다 — `Dialog` + `useLocale` + `useHistoryBackedModal`.
`size='full'`(모바일 전체화면) / `size='xl'`(데스크톱 3열). 비교 카드에서 상세로 이동할 때는
`onOpenChange` 대신 **`notifyNavigatingAway()` 를 먼저** 부른다(그 규칙이 이미 문서화돼 있다).

### 4.4 마이팝 진입 — `app/HomeClient.tsx`

- `renderWishGrid`(L1025) 카드에 비교 토글. **카드 덮개 `<Link>` 위에 얹어야 한다** —
  `CalendarButton.tsx` 방식(`relative z-20` + `preventDefault`/`stopPropagation`).
  `PopupCard` 는 `{href} | {onWish}` 유니온이라 둘을 동시에 못 준다(앵커 안 버튼은 잘못된 HTML).
- `handleRemoveWishlist`(L1113)에서 찜을 빼면 `forgetCompareSelection([id])` 도 부른다.
- MY 탭 찜 블록(L2953-3015)에 "담은 N곳 비교하기" 진입.

## 5. 예고된 위험 — 미리 알면 사고가 아니다

| # | 위험 | 대응 |
|---|---|---|
| 1 | **z-index 사고 선례.** 2026-09-06 에 찜 카드 해제 버튼이 안 눌렸다 — 덮개 Link 가 `z-0` 인데 버튼에 z 가 없어 `document.elementFromPoint` 3/3 이 Link 를 돌려줬다 | 비교 토글에 `z-10` 이상 + `after:absolute after:-inset-2` 로 터치 영역 확보. 같은 방법으로 고쳤던 자리다 |
| 2 | **좌상단 배지가 버튼을 덮는다.** 배지가 `max-w-[calc(100%-3.25rem)]` 로 우측 22px 만 비워 뒀다(320px 실측 주석) | 비교 버튼을 그 자리에 또 넣지 않는다. 넣으려면 배지 `max-w` 를 함께 줄인다 |
| 3 | **고정 바가 이미 둘이다.** 상세의 빠른 실행 nav 와 `BottomDock` 이 같은 자리를 놓고 겹친다 | 비교 트레이를 `fixed` 로 붙이지 않는다. 1차가 마이팝 모달인 이유의 하나 |
| 4 | **`useSyncExternalStore` 배열 스냅샷 → 무한 렌더.** 선례(`externalMediaConsent`)는 boolean 이라 문제가 없었다 | `getSnapshot` 참조 캐싱 필수. 시험으로 못박는다 |
| 5 | **i18n 키를 ko 에만 넣으면 `typecheck` 가 막는다**(2600행 `_localeParity`). 그게 의도다. 반대로 `t()` 는 런타임에 ko 로 폴백해 화면만 보고는 누락을 못 찾는다 | DICT ko/en/ja 세 블록에 동시에 넣는다 |
| 6 | **`GET /api/popups/{id}` 는 쓰기다** — 조회수 증가 + YouTube 호출 | 비교 카드는 `readSummaries` 경로로만 그린다. 담는 순간 `rememberSavedPopup` 을 함께 불러 요청을 0 으로 만든다 |
| 7 | **`BottomDock` 이 이미 꽉 찼다**(4칸 + 더보기) | 비교를 7번째 탭으로 만들지 않는다. v2.17 에서 해결한 "모바일에서 너무 좁아짐" 이 재발한다 |

### 소스 텍스트를 세는 시험 셋

기능과 무관하게 깨질 수 있다. **정규식으로 소스를 읽는 시험**이라 그렇다.

| 시험 | 세는 것 | 1차 영향 |
|---|---|---|
| `ReturnToPlacement.test.ts` | `rememberLockedTab(` 정확히 4개, 상세 `rememberReturnTo` 정확히 2개 | **없음** — 1차에서 계정 저장 후 복귀를 뺐으므로 `returnTo` 를 안 건드린다 |
| `WishLookupCost.test.ts` | HomeClient 에 `readSummaries`/`rememberSummaries`/`AbortController` 잔존 | **없음** — 지우지 않는다 |
| `MyTabOrder.test.ts` | `{/* Wishlist */}` 마커 위치, `'{user && ('` 3000자 이내 | ⚠️ **있음** — MY 탭에 비교 진입을 끼우면 오프셋이 밀린다. 착수 첫 단계에서 이 시험부터 돌려 기준을 확인한다 |

**1·2 가 영향받지 않는 것은 우연이 아니라 §2 범위 축소의 결과다.** 계정 저장 후 복귀를 뺀 덕에
`returnTo` 를 안 건드리게 됐다.

## 6. 시험 — 실패를 먼저 재현한다

TDD 로 간다. 각 항목은 **구현 전에 빨간불**이어야 하고, 구현 후 **사보타주로 되돌려 다시 빨간불**임을
확인한다(이 저장소의 확립된 절차).

### `src/lib/compareSelection.test.ts`

- [ ] 빈 저장소에서 `[]` 를 준다
- [ ] 담은 순서를 유지한다
- [ ] **3개일 때 4번째는 거절되고 기존 셋이 그대로 남는다** ← `.slice(-MAX)` 로 만들면 실패
- [ ] 거절 시 `reason:'full'`, `selected:false`
- [ ] 손상값(문자열·음수·0·소수·비배열·parse 실패)을 전부 흡수해 `[]`
- [ ] 저장소 차단 환경에서 던지지 않고 `saved:false`
- [ ] `forgetCompareSelection` 이 **호출 시점에 다시 읽어** 지정 id 만 뺀다
- [ ] `getSnapshot` 이 내용이 같으면 **같은 참조**를 준다 ← 무한 렌더 방지

### `src/lib/compareRows.test.ts`

- [ ] 셋 다 요약이 없으면 **summary 행이 생기지 않는다**
- [ ] 하나라도 있으면 행이 생기고 없는 칸은 `null`
- [ ] `open-undated` 가 "마감일 미정" 으로 그려진다
- [ ] `endDate` 만 없는 것과 둘 다 없는 것을 구분한다
- [ ] 긴급 색은 `isUrgentPeriod` 로 정해진다(글자를 되묻지 않는다)
- [ ] 1개·2개만 넘겨도 터지지 않는다

### 검증 명령

```
npm run typecheck && npm run lint && npm test
npx prettier --write <바꾼 파일들>
```

## 7. 배포와 중단

- **프론트 전용.** 백엔드 변경 0 · 마이그레이션 0 · 데이터 변경 0.
- `main` 푸시 → Vercel 자동 배포.
- **중단 = 커밋 되돌리기.** 지울 데이터도 되살릴 것도 없다. 사용자 기기의
  `popspot:compare:selected` 는 남지만 읽는 코드가 사라지면 무해하다.
- 배포 확인: 마이팝에서 찜 2개를 골라 비교가 열리는지 · 4번째 거절 안내가 뜨는지 ·
  요약 없는 조합에서 그 행이 안 그려지는지. 비회원 상태로도 같은 것을 건다.

## 8. 착수 순서

- [ ] 1. `MyTabOrder.test.ts` 를 먼저 돌려 현재 기준을 확인한다(위험 표 참고)
- [ ] 2. `compareSelection.ts` + 시험 — 저장소 계약부터. 상한 거절이 핵심
- [ ] 3. `compareRows.ts` + 시험 — 순수 함수. 행 삭제 규칙이 핵심
- [ ] 4. i18n 키를 ko/en/ja 세 곳에 동시에 추가
- [ ] 5. `CompareModal.tsx` — `AllTrendingModal` 복사에서 시작
- [ ] 6. 마이팝 진입 — 카드 토글(z-index 주의) + 블록 진입
- [ ] 7. 검증 4종 + 사보타주 확인
- [ ] 8. 배포 후 운영에서 회원·비회원 양쪽 확인

## 9. 이 계획이 답하지 않는 것

- **상세·랜딩 진입점**(2차). 랜딩은 서버 컴포넌트라 `CalendarButton` 식 island 가 필요하고,
  상세는 고정 바 3겹 문제를 먼저 풀어야 한다.
- **계정 저장·기기 간 동기화**(3차). 서버 엔티티부터 필요하다.
- **비용·입장 조건 칸.** 백엔드 전 구간 작업이고, 그러고도 원문에 없으면 여전히 비어 있다.
  만들기 전에 "검색 스니펫에 가격이 몇 % 나오는가" 를 먼저 세야 한다.
- **3칸 비교가 실제로 쓰이는가.** 이것이 1차를 마이팝 하나로 좁힌 진짜 이유다 —
  세 곳에 다 붙이기 전에 한 곳에서 확인한다.
