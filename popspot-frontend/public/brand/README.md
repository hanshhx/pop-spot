# popspot 브랜드 에셋 (공식 CI)

popspot(팝스팟) — 서울 팝업스토어 발견 서비스 — 의 공식 CI 로고/색 모음입니다.
(원본 패키지 `POP-SPOT 브랜드 CI.zip` — Adobe Illustrator `.ai` 원본 + PNG + 아이디어 시안 — 의 SVG 추출본)

---

## 1. 로고 컨셉

- **심볼 = 쇼핑 바스켓**(장바구니): 라임 테두리 + 검정 몸체/손잡이 + 점 → "팝업 스토어에서 담는다"는 발견·쇼핑 행위.
- **워드마크 = `popspot`** 아웃라인(검정 + 라임 혼합 레터링).
- 메인 로고 = 바스켓 심볼 + 워드마크 가로 락업.

---

## 2. 파일 목록

| 파일 | 용도 |
|---|---|
| `popspot-favicon.svg` | 파비콘 / 앱 아이콘 (바스켓 심볼). `app/icon.svg`·`public/icon.svg`·루트 `icon.svg` 와 동일 |
| `popspot-logo.svg` | 메인 가로 락업 (심볼 + popspot 워드마크) |
| `popspot-powered-by.svg` | "powered by popspot" 배지 (파트너/임베드용) |
| `popspot-pop-look.svg` | 섹션 로고 — POP-LOOK |
| `popspot-popup-calendar.svg` | 섹션 로고 — 팝업 캘린더 |
| `popspot-search-zone.svg` | 섹션 로고 — Search Zone |
| `popspot-tagline.svg` | SEOUL POPUP STORE INTELLIGENCE 태그라인 락업 |

> **사이트 내부에서는** 정적 SVG 대신 React 컴포넌트
> [`src/components/layout/Logo.tsx`](../../src/components/layout/Logo.tsx) 를 쓰세요.
> 공식 락업 SVG 를 인라인하되 **검정 파트를 `currentColor`** 로 바꿔 라이트/다크 테마에 적응시킵니다
> (다크 배경에서 검정 워드마크가 사라지는 문제 방지). 헤더·푸터·로그인이 이 컴포넌트를 사용.

---

## 3. 색 (CI 팔레트)

| 이름 | HEX | 용도 |
|---|---|---|
| Lime | `#b8d565` / `#b3d35f` | 심볼 테두리 · 워드마크 일부 |
| Pink | `#e73274` | 바스켓 안의 점(포인트) |
| Black | `#040000` / `#101010` | 심볼 몸체 · 워드마크 일부 (사이트에선 다크모드 시 크림으로 적응) |

---

## 4. 폰트

- 워드마크는 **아웃라인(path)** 이라 폰트 의존이 없습니다(어디서 열어도 동일).
- 사이트 본문/UI 폰트는 **Wanted Sans** (별개, `globals.css` `@theme`).

---

## 5. 사용 규칙

- **여백:** 심볼 높이의 최소 50% 를 로고 사방에 비워둡니다.
- **최소 크기:** 심볼 16px, 가로 락업 100px 이상.
- **하지 말 것:** 비율 왜곡 / 임의 색 변경 / 그림자·외곽선 추가 / 심볼·워드마크 간격 변경.

---

_갱신: v2.25 (2026-06) — 디자이너 공식 CI(바스켓 심볼 + popspot 워드마크) 적용. 직전 임시 P-핀 로고 폐기._
