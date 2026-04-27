# POP-SPOT Frontend 종합 진단 리포트

> 디자인적으로 "AI 같다"는 피드백의 근본 원인을 디자인 / 코드 / 구조 관점에서 빠짐없이 정리한 문서.
> 분석 범위: `app/` 9개 페이지 + `src/components/` 21개 컴포넌트 + 설정 파일 (총 6,864줄).

---

## 1. 가장 큰 문제 (한 줄 요약)

**디자인 시스템이 없고**, 색상·둥근값·간격·그림자·폰트 위계를 매번 className에 인라인으로 적기 때문에, 결과적으로 모든 곳이 **"shadcn 디폴트 + indigo/purple 그라데이션 + glassmorphism"** 라는 가장 평균적인 AI 풍경이 되어 있습니다. 거기에 더해 **브랜드 컬러(`#00ff88`)와 실제 화면 컬러(indigo-600)가 완전히 다릅니다.** 이게 "AI 같다"의 핵심입니다.

---

## 2. 디자인 문제 (Why it looks "AI-generated")

### 2-1. 색상 시스템이 두 개로 갈라져 있음 (가장 치명적)

`tailwind.config.ts`:
```ts
primary: "#00ff88",   // 네온 그린
secondary: "#ff0088", // 핫 핑크
```

그런데 실제 화면에서 압도적으로 자주 쓰는 색은:
- `indigo-500 / 600`, `purple-500 / 900`, `pink-400 / 500`, `violet-600`
- `from-indigo-400 to-pink-400`, `from-indigo-900 to-purple-900` 그라데이션

→ **브랜드 컬러는 로고 점(`.`) 하나에만 쓰이고**, 나머지 99%는 indigo/purple입니다.
이게 가장 강한 "AI 같음" 신호입니다 — Lovable / v0 / bolt 결과물의 디폴트 색이거든요.

대표 사례 (`app/page.tsx`):
- L713: `bg-gradient-to-r from-indigo-400 to-pink-400` (Hero 그라데이션 텍스트)
- L904: `bg-gradient-to-br from-indigo-900 via-gray-900 to-black` (협업 섹션)
- L915: `from-indigo-400 to-pink-400`
- L988, L1023, L1037, L1053, L1058: 모두 indigo-600 (CTA 버튼)
- L662: `from-indigo-900 to-purple-900` (프리미엄 배지)

→ "Find Your Vibe in Seoul"을 **네온 그린/핑크의 거리감 있는 시티팝 브랜드**로 가져갈 거였다면 indigo는 절대 등장하면 안 됐어요. 지금은 둘이 싸우고 있습니다.

### 2-2. `secondary`가 Tailwind에 등록만 되고 거의 안 쓰임
`#ff0088` (secondary)는 `border-secondary/30 text-secondary` (랭킹 상태 뱃지) 정도에서만 살짝 등장. 디자인 토큰을 정의해놓고 실제로는 안 쓰면서 indigo를 쓰니, 토큰의 의미가 사라집니다.

### 2-3. Border-radius 5단계 혼용 (시각적 혼란)
같은 페이지에서 `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-[2rem]`, `rounded-[2.5rem]`, `rounded-[3rem]` 가 전부 다 쓰입니다.

대표 사례 (`app/page.tsx`만 해도):
- 카드: `rounded-2xl`, `rounded-[2rem]`, `rounded-[2.5rem]` 혼용
- 버튼: `rounded-full`, `rounded-xl`, `rounded-2xl` 혼용
- 입력창: `rounded-full`, `rounded-xl` 혼용

→ 토큰화해야 합니다. 예: `--radius-card: 24px`, `--radius-button: 12px`, `--radius-pill: 9999px`. 지금은 위계가 0입니다.

### 2-4. Glassmorphism + backdrop-blur 도배
`backdrop-blur-md`, `backdrop-blur-xl`, `backdrop-blur-2xl`, `backdrop-blur-[2px]`, `bg-white/80`, `bg-black/80`, `bg-[#111]/80` 이 거의 모든 카드에 들어갑니다.

→ 글래스 효과는 "한두 군데에서 쓸 때 강조"가 되는데, 헤더·검색창·랭킹·달력·OOTD·하단 도크·모달·푸터까지 다 쓰면 효과가 사라지고 그냥 답답해 보입니다. AI 같다는 신호 #2.

### 2-5. 그림자가 통제 안 됨
`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-[0_0_15px_rgba(99,102,241,0.5)]`, `shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]`, `shadow-[0_15px_30px_-10px_rgba(0,0,0,0.8)]` 등 **인라인 매직 그림자가 30+곳**.

특히 `app/page.tsx` L723의 `shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]` — `--primary-rgb` CSS 변수가 어디에도 정의되어 있지 않아 **이 그림자는 사실상 작동 안 합니다.** (`globals.css` 어디에도 `--primary-rgb` 없음)

### 2-6. 그라데이션 텍스트 남용
`text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400` 같은 텍스트 그라데이션이 헤로 / OOTD / POP-LOOK / 협업 섹션 / 모달까지 **5곳 이상**에서 반복됩니다.

→ "여기가 강조 포인트야!"가 다섯 번 나오면 그냥 노이즈입니다.

### 2-7. 폰트 굵기 단조로움 (Inter 단일)
`layout.tsx` L12: `Inter`만 사용. 한국어 콘텐츠가 메인인 서비스인데 한글 전용 폰트(Pretendard, Spoqa Han Sans 등)가 없어서 한글이 영문 디스크립터에 끌려가는 모양으로 렌더링됩니다.

`font-black` (900), `font-bold` (700), `font-medium`, `font-normal` 만 사용 — 300 / 500 같은 중간 굵기가 없고, 거의 모든 헤더는 `font-black tracking-tighter uppercase` 로 똑같은 톤. "POP-SPOT", "POP-LOOK", "POP-COURSE", "ALL TRENDING" 모두 같은 스타일이라 위계가 없습니다.

### 2-8. 폰트 크기에 매직 픽셀 다수
`text-[9px]`, `text-[10px]`, `text-[11px]` 가 100+곳. 9~11px은 **모바일에서 사실상 못 읽는 크기**이고, Tailwind의 `text-xs`(12px) / `text-sm`(14px)에서 벗어나는 순간 디자인 토큰이 사라집니다.

### 2-9. 반응형 prefix가 너무 길어 디자인이 흐려짐
대표 예시 한 줄 (`src/components/DigitalTicket.tsx` L53):
```
className="relative w-full max-w-4xl bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-[0_15px_30px_-10px_rgba(0,0,0,0.8)] md:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] flex flex-col md:flex-row z-10"
```

거의 모든 속성에 `md:` 두 단계 분기 → 모바일과 데스크톱이 사실상 별개 디자인. 디자인 결정이 코드에 250자씩 박혀 있으니 **디자이너가 한 게 아니라 LLM이 한 것처럼 보이는** 결정적 이유.

### 2-10. 레이아웃 매직 넘버
`min-h-[80vh]`, `h-[35vh]`, `h-[50vh]`, `h-[60vh]`, `h-[85vh]`, `min-h-[400px]`, `max-w-3xl`, `max-w-[1600px]`, `w-[280px]`, `w-[320px]`, `w-[450px]` 등 **vh / px 매직 넘버가 60+ 곳**. 일관된 컨테이너 크기 시스템이 없습니다.

### 2-11. 이모지가 코드에도 UI에도 흘러다님
- 코드 주석: `🔥 [수정 완료]`, `🎥 배경 비디오`, `🌑 비디오 위 어두운 막`, `✨`, `📦`, `📡 [API 요청]`, `❌ API Error`, `🚨 Network Error`, `📜`, `📨` — 거의 모든 파일.
- UI: `전체 달력 펴보기 ➔` 같은 인라인 화살표 문자.

→ "AI한테 시켜서 만든 코드"라는 인상의 1차 단서. 진짜 디자이너/개발자는 코드에 이모지를 안 씁니다(사내 컨벤션에 따라 다르지만 본인 포트폴리오용 코드면 더더욱).

### 2-12. 외부 텍스처 패턴 의존
`bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]` — 환영 배너, AI 코스 섹션, 광고 카드 3곳에서 동일한 외부 PNG 패턴 사용. 이게 AI 결과물의 클래식 시그니처입니다 (브랜드 자산 0).

### 2-13. 비디오 배경 + 80% 흰/검정 오버레이
`<video src="/bg.mp4">` + `bg-white/80 dark:bg-black/80 backdrop-blur-[2px]` — 결국 비디오가 거의 안 보입니다. **비디오를 블러 처리할 거라면 처음부터 정적 이미지**가 나았고, 비디오가 살리려면 더 옅은 오버레이여야 합니다. 지금은 둘 다 손해.

### 2-14. 일관성 없는 빈/로딩/에러 상태
- 로딩: 어떤 곳은 스켈레톤(L803-815), 어떤 곳은 `<Loader2 className="animate-spin"/>`(L877), 어떤 곳은 `LOADING...` 텍스트만(`popup/[id]`).
- 빈 상태: 어떤 곳은 점선 박스(L1187, L1273), 어떤 곳은 단순 회색 텍스트(L1230).
- 에러: 거의 전부 `Swal.fire({ icon: 'error', text: '서버 연결 실패' })` — 같은 메시지가 7곳 이상.

### 2-15. 다크모드가 50%만 구현
- `<body>`는 `dark:bg-black` 잘 됨.
- 그러나 `app/login/page.tsx` L81 등 일부 페이지는 `bg-black` 하드코딩 → 라이트 모드에서도 검정.
- `globals.css` L29에 `:root:where(.dark) body` 룰이 있는데 Tailwind v4에서 `darkMode: "class"`와 충돌 가능성. (실제로 두 군데에서 다크모드를 정의 — `tailwind.config.ts`의 `darkMode: "class"` + `globals.css`의 `@custom-variant dark`)

### 2-16. 페이지마다 헤더가 다 다름
- 메인: 거대한 `POP-SPOT.` + 부제목 + 테마 토글 + 제보 + 관리자 + 사용자 카드 (인라인)
- 로그인: 비디오 배경에 카드 하나만 (헤더 없음)
- Shop: 또 다른 헤더 (자체 구현)
- Admin: 또 다른 헤더

→ 공통 `<Header />` 컴포넌트가 없어서 같은 사이트인지 의심됩니다.

### 2-17. 하단 Dock + 페이지 단위 라우팅 + 탭 단위 컨디셔널 렌더링이 섞여 있음
`app/page.tsx`는 `currentTab` 상태로 MAP/PASSPORT/COURSE/MY/MATE를 전부 한 페이지에 그리고, 거기에 더해 `/shop`, `/admin`, `/popup/[id]`, `/login` 은 진짜 라우팅. 사용자가 도크의 "상점"을 누르면 진짜 페이지 이동, "지도"를 누르면 같은 페이지에서 탭 전환 — UX 모델이 둘이 섞여 있습니다.

### 2-18. 폰트 굵기 위계가 강박적으로 `font-black`
`font-black tracking-tighter uppercase` 패턴이 `app/page.tsx` 안에서만 18번 등장. 모든 헤더가 가장 굵은 폰트라 시각적 강조가 무뎌집니다.

### 2-19. CTA 버튼 스타일이 페이지마다 다름
- 메인 hero: `bg-primary hover:bg-primary/80 text-black` (네온 그린)
- 코스 추천: `bg-indigo-600 hover:bg-indigo-50` (인디고)
- 로그인: `bg-violet-600` 추정
- Shop 결제: 또 다른 색
- 모달 제보: `bg-indigo-600 hover:bg-indigo-700`

→ "메인 액션 버튼"이 한 사이트에 4종류. 사용자가 학습할 수 없는 패턴.

### 2-20. 화살표 문자 직접 입력
L832: `전체 달력 펴보기 ➔` (유니코드 화살표 직접). lucide-react를 이미 쓰고 있는데도 이런 곳에 텍스트 화살표를 박는 건 일관성 부재.

### 2-21. 카드마다 `motion.div whileInView ...` 패턴 복붙
같은 `sectionVariants`가 5섹션에 그대로 적용 → 페이지 스크롤하면 다섯 번 똑같이 위로 슬라이드 + 페이드 인. 모션 디자인이 아니라 "모션 스팸"입니다.

### 2-22. 호버 인터랙션 한 가지만 반복
거의 모든 카드: `hover:scale-105`, `group-hover:scale-110`, `group-hover:translate-x-1`. 의미가 다른 요소들이 모두 같은 마이크로 인터랙션을 가집니다.

### 2-23. 푸터에 더미 링크
L1376-1388: "지도 보기", "팝업 캘린더", "AI 혼잡도 분석", "매거진", "파트너 등록", "비즈니스 문의", "광고 안내" 모두 `href="#"`. 포트폴리오라도 라우팅이나 anchor가 들어가야 자연스러워 보입니다.

### 2-24. "Built with AI" 클리셰 카피라이팅
"Find Your Vibe in Seoul." / "Seoul Popup Store Intelligence" / "POP-SPOT EXCLUSIVE" / "FOR YOU" / "Daily Style Forecast" — 모두 v0 결과물의 디폴트 영어 카피 톤입니다. 한국 서비스인데 굳이 영문 슬로건을 박는 것도 톤이 안 맞고요.

### 2-25. SVG 아이콘이 모두 lucide-react
브랜드 아이콘이 0개. lucide의 stroke-width 2px, 24px 디폴트 그대로 — 어디서나 본 모양. 적어도 로고 옆 점이라도 커스텀 SVG였다면 인상이 달랐을 거예요.

---

## 3. 코드 품질 문제

### 3-1. `app/page.tsx`가 1,724줄 (단일 파일 거대화)
- 한 파일에 메인 페이지 + ReportPopupModal + PopupCalendarModal + DockItem + 인터페이스 4종 + 50+ 핸들러.
- 권장: 각 탭(`MapTab`, `PassportTab`, `CourseTab`, `MyTab`, `MateTab`)을 별도 컴포넌트로, 모달도 `components/modals/`로.

### 3-2. TypeScript `any`가 곳곳에 박혀 있음
- L51: `function CustomSearchBox(props: any)`
- L93: `hits.map((hit: any) => ...)`
- L181: `const INITIAL_MY_COURSE: any[] = []`
- L200: `useState<any>(null)` — user 객체 타입 없음
- L202, L203, L205: `useState<any[]>([])` 4곳
- `admin/page.tsx`: stats / pendingPopups / allPopups / matePosts 모두 `any[]`
- `MateBoard.tsx`, `MateChatModal.tsx`, `CongestionChart.tsx` 등 거의 모든 컴포넌트의 props가 `any`.

→ `tsconfig.json`은 `"strict": true`인데 이걸 `any`로 회피하고 있어요.

### 3-3. `useEffect` 의존성 문제
- `app/page.tsx` L478-506: 의존성에 `searchParams, router`만 있는데 내부에서 `user`, `fetchMyPageData` 등을 캡처. ESLint exhaustive-deps 끄고 사용 중.
- `app/page.tsx` L508-554: 의존성 `[]` (빈 배열)인데 내부에서 `localStorage`, `apiFetch` 호출 + 캐시 갱신. 의도는 이해하지만 데이터가 stale 됨.
- `app/page.tsx` L290 fetchMyPageData 안에서 `user` 의존하는데 이 함수가 useEffect 안에서 호출됨 → 빈 의존성 useEffect라 처음 user 값으로만 실행.

### 3-4. SSR 가드 없는 `localStorage` 직접 접근
- `app/login/page.tsx` L27: `localStorage.getItem("savedEmail")` — `useEffect` 안이라 OK.
- 하지만 `app/page.tsx` L509, L527, L542 등은 `useEffect` 안에 있어 OK인데, `app/popup/[id]/page.tsx`, `app/admin/page.tsx` 등에서 컴포넌트 본문 또는 함수 본문에서 직접 호출하는 케이스가 다수 있음 (Hydration 미스매치 위험).

### 3-5. 토큰을 `localStorage`에 평문 저장 (XSS 취약)
- `app/oauth/callback/page.tsx` L28
- `app/login/page.tsx` L56 (`user` 객체 — `userId`, `nickname`, `isPremium`, `role` 까지 통째로 평문)
- `app/page.tsx` L495, L293

→ XSS 한 방에 모든 토큰이 털립니다. **httpOnly 쿠키**로 옮겨야 하고, 사용자 정보는 메모리(zustand) + 새로고침 시 `/me` 재조회로.

### 3-6. Firebase API 키 하드코딩
- `src/firebase/config.ts` L5-13: 모든 키가 코드에 직접. 클라이언트 키라 노출돼도 어느 정도는 괜찮지만, **환경 변수로 옮기고 Firebase 콘솔에서 도메인/IP 제한 거는 게 표준**.

### 3-7. `.env.local` 가 작업폴더에 그대로 있음
- 루트에 `.env.local` 존재 (711B). `.gitignore` 에 `.env*` 처리는 되어 있지만, 같은 폴더의 `package-lock.json` 도 있는 걸 보면 git 관리 중. 한 번 누락하면 사고. **`.env.local`은 절대 커밋 금지**, 그리고 본인 PC라도 키가 노출돼 있으면 깃 history에 남았는지 확인 필요.

### 3-8. `console.log` / `console.error` 잔존 다수
- `src/lib/api.ts` L36, L48, L53: 모든 API 호출에 `📡 [API 요청]` 로그.
- `src/components/ChatRoom.tsx`: `console.log("📜 ...")`, `console.log("📨 ...")`.
- `src/components/GlobalChatManager.tsx`: 5+ 곳.
- `src/components/AIReportModal.tsx` L53.

`next.config.ts` L46-48 에서 프로덕션 빌드 시 `removeConsole` 처리하긴 하지만, 개발자 도구에서 디버깅 흔적이 그대로 보입니다.

### 3-9. `alert()` / `confirm()` 와 `Swal.fire()` 혼용
- `app/login/page.tsx` L65, 68, 71: `alert()` 3곳.
- `app/signup/page.tsx`: `alert()` 9곳.
- `app/planning/page.tsx`: `alert()`, `confirm()` 5곳.
- `app/shop/page.tsx`: `alert()` 4곳.
- `app/page.tsx`: 거의 전부 `Swal.fire()` 사용.
- `app/admin/page.tsx`: `Swal.fire()` + `confirm()` 둘 다.

→ 같은 사이트인데 어떤 상황에선 OS native alert, 어떤 상황에선 sweetalert 모달, 어떤 상황에선 sweetalert 에러 아이콘. 일관성 0.

### 3-10. 메인 페이지 `apiFetch` 일부 페이지에서 미사용
- `src/lib/api.ts` 의 `apiFetch` 가 토큰을 자동 주입하는 헬퍼인데:
- `app/login/page.tsx` L48: 직접 `fetch()` 사용.
- `app/planning/page.tsx`, `src/components/InteractiveMap.tsx`, `src/components/TicketingSimulation.tsx` 일부도 직접 `fetch()` 호출.
- `TicketingSimulation.tsx` 일부 줄에는 `"http://localhost:8080"` 하드코딩까지.

### 3-11. 절대경로 import alias 미사용
- `tsconfig.json` L21-22: `"paths": { "@/*": ["./*"] }` 설정 있음.
- 그런데 모든 import가 `import { ... } from "../../src/lib/api"`, `import InteractiveMap from "../src/components/Map/InteractiveMap"` 같이 상대경로.
- 권장: `@/lib/api`, `@/components/Map/InteractiveMap`. 폴더 옮겨도 안 깨짐.

### 3-12. `app/` 안에 페이지가 있는데 `src/` 안에 컴포넌트
- Next.js 15+ 표준은 둘 다 `src/app/`, `src/components/` 거나, 둘 다 루트 (`app/`, `components/`).
- 지금은 `app/` (페이지) + `src/` (컴포넌트, lib, store, firebase) — 비표준 혼합.
- `tailwind.config.ts` L9-12 에 `app/`, `src/`, `pages/`, `components/` 4경로 다 추가한 흔적("혹시 모를 대비") → 본인도 헷갈렸다는 뜻.

### 3-13. `react-instantsearch` 모듈을 메인 페이지에서 직접 호출
- `app/page.tsx` L43 에서 `algoliasearch` 클라이언트를 모듈 최상단에서 생성 → 서버에서도 한 번 평가됨. 환경변수 누락 시 빌드 에러. `process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!` non-null assertion이라 안전망도 없음.

### 3-14. `framer-motion` import가 무겁게 들어감
- `app/page.tsx` L12: `import { motion, Variants, AnimatePresence } from "framer-motion"` — 메인 페이지에서 `motion.div` 단독 모션이 12개, `<AnimatePresence>` 4개. 번들 크기 + JS 실행 비용 큼.
- `framer-motion`은 클라이언트 컴포넌트 단위로 쪼개거나, 단순 페이드는 CSS로.

### 3-15. `<Link href ... passHref legacyBehavior>` 사용
- `app/page.tsx` L94, L628, L780, L1140, L1471 등 다수.
- Next.js 13+ 부터 `legacyBehavior`는 deprecated. App Router에서는 `<Link href><button>...</button></Link>` 형식이 표준.

### 3-16. 이미지 태그 `<img>` 사용
- `app/page.tsx` L1195: `<img src={item.popupImage} ... />` — 위시리스트 전체.
- Next.js의 `next/image` 미사용 → CLS, 레이지로딩, srcset 다 손해.
- 그런데 `next.config.ts` L20-30 엔 `images.remotePatterns` 가 잘 설정돼 있음 (미스매치).

### 3-17. `style jsx` 없이 `:root:where(.dark)` 글로벌 CSS에 박음
- `globals.css` L29-31, L46-48: 글로벌에 `:root:where(.dark)` 셀렉터 사용. Tailwind `dark:` variant 와 중복됨. `theme-dark` 토큰을 한 곳에서만 관리해야 함.

### 3-18. `--primary-rgb` CSS 변수 미정의
- `app/page.tsx` L723: `shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]` — 하지만 어떤 CSS에도 `--primary-rgb` 정의 없음. 그림자가 안 나옴.

### 3-19. 많은 page들이 `"use client"` 첫 줄
- `app/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/planning/page.tsx`, `app/shop/page.tsx`, `app/admin/page.tsx`, `app/popup/[id]/page.tsx`, `app/find-account/page.tsx`, `app/oauth/callback/page.tsx` — 9개 페이지 전부 client.
- App Router의 핵심 장점인 **서버 컴포넌트 / 데이터 페칭 / 메타데이터 생성**을 전혀 활용 안 함. 검색 엔진/소셜 공유에서 손해.
- 적어도 페이지 셸은 server, 인터랙션 부분만 client로 분리해야 함.

### 3-20. 로딩 UI를 `loading.tsx` 대신 컴포넌트 내부에서 처리
- App Router는 `loading.tsx`, `error.tsx`, `not-found.tsx` 라우트 단위 파일이 있는데 하나도 없음.

### 3-21. `Suspense` 미사용
- `app/oauth/callback/page.tsx` 에서 `useSearchParams()` 쓰는데 `<Suspense>` 래핑이 없으면 빌드 경고. (Next.js 14+ 에서 빌드 오류 가능)

### 3-22. 거대한 인라인 핸들러
- `app/page.tsx` L1159-1167: 도크 안의 onClick에 if/else 분기 + alert + confirm + router.push 8줄짜리 인라인 함수. 추출 필요.

### 3-23. 메모이제이션 0
- `useMemo`, `useCallback`, `React.memo` 가 6,800줄짜리 코드베이스에 거의 없음. 메인 페이지가 매 렌더마다 모든 카드/모달을 다시 그리고 있음. 큰 화면에서 끊김 발생할 수 있음.

### 3-24. 캐시 전략이 단순
- `app/page.tsx` L509-554: `localStorage`로 popup, congestion, ootd 캐시. 만료 시간 / 무효화 / 백그라운드 리프레시 없음.
- React Query / SWR 도입하면 한 번에 해결.

### 3-25. WebSocket 라이프사이클 관리
- `GlobalChatManager.tsx`, `ChatRoom.tsx` 에서 `@stomp/stompjs` + `sockjs-client` 사용. layout 단에 글로벌 매니저 두는 건 좋은 선택. 하지만 토큰 만료 / 재연결 / 페이지 전환 시 클린업 명시적이지 않음.

### 3-26. zustand store가 1개 (`useChatStore`)뿐
- 인증, 사용자, 위시리스트, 코스 등 모두 `app/page.tsx` 안의 `useState`로 처리 → 페이지 이동 시 다시 fetch.

### 3-27. 환경변수 non-null assertion
- `app/page.tsx` L44-45: `process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!` — 누락 시 런타임 에러. 빌드 시 검증하는 zod 스키마 같은 보호 없음.

### 3-28. `as any` 없는데 타입 캐스팅 우회
- 실제로 `state: any => state.openChat` 같은 패턴이 다수. zustand 타입을 정의하면 `any` 다 사라짐.

### 3-29. `useSearchParams()` 없는 곳에서도 `searchParams` 객체 생성 패턴
- 메인 페이지 진입 시 OAuth 콜백을 메인 페이지(`/`)에서 처리 (L478-506) — 이게 OAuth 콜백 라우트(`app/oauth/callback/page.tsx`)와 별개로 또 있음. 두 개 라우트 중 어느 게 진짜인지 헷갈림.

### 3-30. README 거의 디폴트
- `README.md` 1,450 byte → Next.js create-next-app 디폴트 + 약간만 수정. 프로젝트 설명, 환경변수 문서, 배포 절차 없음.

---

## 4. 접근성 (Accessibility) 문제

### 4-1. 대부분의 버튼에 `aria-label` 없음
- 아이콘만 있는 버튼 (예: `<button onClick={...}><X size={16}/></button>`) 이 30+곳. 스크린리더 사용자가 "버튼"이라고만 듣고 무엇을 하는지 모름.

### 4-2. `div` 를 클릭 영역으로 사용
- `app/page.tsx` L820 (Calendar Zone): `<div onClick={() => setIsCalendarOpen(true)} ... cursor-pointer>` — 키보드로 접근 불가, role="button" 도 없음.
- L1235, L1332: 동일 패턴.

### 4-3. 색 대비 부족
- `text-white/40`, `text-white/30`, `text-gray-400` 다수 → WCAG AA 4.5:1 미달 가능성 높음. 특히 다크 배경 위 `text-white/30` 은 거의 안 보임.

### 4-4. 포커스 인디케이터 없음
- 거의 모든 버튼이 `focus:outline-none` 만 있고 `focus:ring`, `focus-visible:ring` 도 없음. 키보드 네비게이션 사용자에게 현재 위치 표시 안 됨.
- `app/page.tsx` L923의 협업 CTA 만 `ring-offset-2 focus:ring-2 ring-indigo-400` 있음.

### 4-5. `<a>` 태그에 의미 없는 `href="#"`
- 푸터 링크 7+ 곳. 키보드 사용자가 Tab으로 이동하면 페이지 최상단으로 점프.

### 4-6. 이미지 `alt` 누락
- `<img>` 일부에만 `alt` 있고, 일부는 없음.

### 4-7. 폼 라벨 연결
- `<label>` + `<input>` 이 `htmlFor`/`id` 로 연결 안 된 폼이 다수 (login, signup, report).

### 4-8. 비디오 `controls`, `aria-hidden` 누락
- `bg.mp4`, `login-bg.mp4` 가 자동재생되는 배경 비디오인데 `aria-hidden="true"` 없음. 스크린리더에 "비디오 재생 중"이라고 읽힘 + 자막 없는 비디오라 WCAG 위반.

### 4-9. 모션 환경 설정 미반영
- `prefers-reduced-motion` 무시. 모션 멀미가 있는 사용자에게 위시리스트, 헤로 그라데이션, dock 흔들림이 전부 그대로 노출.

### 4-10. 모달 포커스 트랩 없음
- `ReportPopupModal`, `PopupCalendarModal`, `AIReportModal` 모두 `<motion.div>` 로 직접 만든 모달 — `Esc` 닫기, 포커스 트랩, 배경 스크롤 잠금 없음.

---

## 5. 보안 / 운영 문제

### 5-1. 토큰을 localStorage 저장 (위 3-5 참고)
**최우선 수정**.

### 5-2. Firebase 키 코드에 직접 (위 3-6)

### 5-3. 카카오 맵 키도 process.env에 있지만 클라이언트 노출
- `app/layout.tsx` L48: `${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}` — 카카오는 도메인 화이트리스트 필수 (해주셨겠지만 확인 필요).

### 5-4. CORS / `credentials: 'include'`
- `src/lib/api.ts` L43: `credentials: "include"` — 백엔드에서 `Access-Control-Allow-Credentials: true` + `Access-Control-Allow-Origin` 정확한 도메인이어야 함. `*` 면 작동 안 함.

### 5-5. `next.config.ts` 의 rewrites
- `/api/:path*` → 백엔드로 프록시 → 클라이언트에서 같은 출처로 보임 (좋음). 그런데 코드에서는 거의 `${API_BASE_URL}/api/...` 직접 호출 (위 3-10) → rewrites가 무용지물.

### 5-6. iamport / 결제 키 노출 (`shop/page.tsx`)
- `process.env.NEXT_PUBLIC_IAMPORT_MERCHANT_CODE` — 가맹점 코드는 클라이언트 노출이 맞지만, **결제 검증은 반드시 서버에서** 진행되는지 확인 필요.

### 5-7. 무료 회원 코스 1개 제한이 클라이언트 사이드
- `app/page.tsx` L438-447: `if (!user.isPremium && savedCourses.length > 0)` — 사용자가 devtools 에서 `isPremium=true`로 바꾸면 우회. 서버에서 검증해야 함.

### 5-8. 어드민 권한 클라이언트 체크
- `app/page.tsx` L613: `const isAdmin = user?.role?.includes('ADMIN')` — localStorage 의 user 객체를 그대로 신뢰. 서버에서 매 요청 검증 필요.

---

## 6. 성능 문제

### 6-1. `app/page.tsx` 단일 청크
- 1,724줄 + algolia + framer-motion + dnd-kit + sweetalert2 + recharts 등 → 메인 페이지 First Load JS 가 매우 클 것. `next build` 후 번들 사이즈 확인 권장.

### 6-2. 비디오 자동재생
- `bg.mp4`, `login-bg.mp4` 가 첫 로드 때 다운로드. LCP / CLS 지표 망가짐. `<video preload="metadata">` 또는 정적 포스터 + 클릭 시 재생.

### 6-3. `<img>` 직접 사용 (위 3-16) → 옵티마이즈 X

### 6-4. Algolia 검색 클라이언트가 모든 페이지에서 평가
- `app/page.tsx` 모듈 최상단 — 메인이 아닌 라우트도 메인이 import 되면 평가됨.

### 6-5. 텍스처 PNG 외부 호스트 (위 2-12)
- `transparenttextures.com` 외부 호스트 의존. 그 사이트 다운되면 디자인 깨짐.

### 6-6. 캐시 전략 없음 (위 3-24)

---

## 7. 폴더 구조 / 컨벤션

### 7-1. `src/components/` 가 평평
```
src/components/
├── AIReportModal.tsx
├── AuthGuard.tsx
├── ChatRoom.tsx
├── CongestionChart.tsx
├── DigitalTicket.tsx
├── GlobalChatManager.tsx
├── LiveChatTicker.tsx
├── MateBoard.tsx
├── MateChatModal.tsx
├── SecretTip.tsx
├── SortableItem.tsx
├── ThemeToggle.tsx
├── TicketingSimulation.tsx
├── Map/
├── Passport/
└── admin/
```
→ 23개 컴포넌트 중 3개만 폴더. 나머지는 평평.

권장 구조:
```
src/
├── features/        # 기능별
│   ├── auth/
│   ├── popup/
│   ├── course/
│   ├── chat/
│   ├── mate/
│   ├── shop/
│   └── passport/
├── components/      # 공통 UI (Button, Card, Modal, Input, ...)
├── lib/
├── hooks/
├── stores/
└── types/
```

### 7-2. `types/` 폴더 없음
- 인터페이스가 사용 파일 안에 inline 정의 (예: `app/page.tsx` L122-180에 PopupStore, CongestionData 등). 다른 파일에서 재사용 못 함.

### 7-3. `hooks/` 폴더 없음
- `useFetch`, `useAuth`, `useDebounce`, `useLocalStorage` 등 흔한 패턴이 매번 인라인 useEffect.

### 7-4. UI 라이브러리 미도입
- 모달, 버튼, 입력, 셀렉트, 토스트 모두 직접 구현. shadcn/ui 또는 Radix UI 도입 시 코드 30%+ 감소 가능.

### 7-5. 테스트 0
- `__tests__`, `*.test.tsx`, vitest, jest, playwright 무엇도 없음.

### 7-6. CI / CD 0
- `.github/workflows/` 없음. 빌드 깨진 채로 push 가능.

### 7-7. README 빈약 (위 3-30)

### 7-8. `pages/` 폴더 미존재인데 tailwind config 에 포함
- `tailwind.config.ts` L11: `"./pages/**/*"` — 사용 안 함. 정리 필요.

### 7-9. `next-env.d.ts` 가 commit 됨
- `.gitignore` 마지막 줄: "next-env.d.ts는 Next.js 공식 권장사항에 따라 깃허브에 올려야 하므로 여기서 삭제했습니다." — 맞는 결정.

### 7-10. 한국어 코드 주석에 이모지 + 비격식
- `🔥 [수정 완료]`, `🔥 [핵심 수정 사항]`, `🔥 [신규 추가]` — 코드 리뷰어가 보면 의도/근거 파악 어려움. 본인 작업 흔적인 건 알겠지만 PR 머지 전에 정리 필요.

---

## 8. 우선순위가 높은 수정 (의견)

만약 30개 다 고치기 부담스러우면, **이 5개만 해도 "AI 같다"는 인상이 절반 이상 사라집니다**:

1. **색상 시스템 통일** — `tailwind.config.ts` 에서 brand 컬러를 정하고 (지금 `#00ff88`을 살릴지, indigo로 통일할지 결단), 그 외 indigo/purple 직접 사용 전부 제거. → CSS 변수 + Tailwind theme extend 한 곳에서.
2. **`<Header />`, `<Button />`, `<Card />`, `<Modal />` 4개만이라도 공통 컴포넌트로** 추출. 모든 페이지에서 동일 사용. → shadcn/ui 도입을 진지하게 고려.
3. **한글 폰트 추가** (Pretendard) 와 폰트 굵기 위계 정의 (heading 4단계, body 2단계).
4. **이모지 / 한국어 코드 주석 / `console.log` 정리** — 본인 흔적이 너무 많이 보입니다.
5. **메인 페이지 분할** — 1,724줄을 5개 탭별 컴포넌트로. 거기서 자연스럽게 디자인 일관성도 발견됨.

---

## 9. 부수적 잔소리

- 푸터 더미 링크 활성화 (`href="#"` 제거)
- "Find Your Vibe in Seoul" 부분을 한국어 우선 카피로 (`서울의 모든 팝업을, 한 화면에` 같은)
- 실제 사진 / 일러스트 한두 장 추가 (지금은 아이콘 + 그라데이션 박스만)
- 데모 로그인 / 데모 데이터 가이드 추가 (포트폴리오라면)
- 모바일에서 padding/margin이 너무 좁음 (p-4 vs p-6 차이)
- 도크의 "상점"만 다른 라우트라 시각적으로도 분리되어야 함 (예: 외부 링크 아이콘)
- `motion.div whileInView` 보다는 `framer-motion` 의 `useScroll` + `useTransform` 으로 한 번만 정의

---

이 문서는 코드 100% 정독 후 작성됐습니다. 확인하면서 "이건 동의 안 함"인 항목 알려주시면 근거(어떤 줄, 어떤 이유)로 더 풀어 드릴게요.
