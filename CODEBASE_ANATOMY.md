# POP-SPOT 코드베이스 해부 문서 (CODEBASE ANATOMY)

> 자동 생성: 13개 모듈을 서브에이전트가 병렬 정독한 결과를 병합. 각 파일을 `####` 단위로
> **책임 / 핵심 로직(중요한 곳은 파일:라인) / 연결(의존·피호출) / 특이사항** 으로 분해했다.
> 생성 시각: 2026-06-09

## 0. 개요

**POP-SPOT** 는 서울 팝업스토어를 지도·캘린더·랭킹 한 화면에서 모아 보는 발견형 서비스다.

### 기술 스택
- **프론트**: Next.js 16 (App Router) · React 19 · Tailwind · framer-motion · dnd-kit · next-themes · Kakao Map SDK. Vercel 배포(`popspot.co.kr`).
- **백엔드**: Spring Boot 4 · Java 21 · Spring Security(JWT HS256) · JPA/Hibernate · Flyway · Caffeine 캐시 · Redis(이메일 인증코드) · Bucket4j(rate limit) · 일부 MyBatis · LangChain4j(Groq LLM) · Algolia(검색) · WebSocket/STOMP(채팅). 단일 VM + Tailscale Funnel 노출.
- **DB**: PostgreSQL (스키마는 Flyway 마이그레이션 V1~V14).
- **외부 API**: 네이버/카카오 검색(자동수집) · Spotify(검색 + OAuth) · YouTube Data API · iTunes Search(미리듣기) · Kakao 지오코딩 · Groq(LLM) · Sentry.

### 큰 그림 — 요청 / 인증 흐름
브라우저 → (Vercel rewrite `/api/*` → 백엔드) → `SecurityFilterChain` → `JwtAuthenticationFilter`(Bearer 토큰 → SecurityContext) → 컨트롤러 → 서비스 → 리포지토리 / 외부 API → DB.
- 인증: 로컬/소셜 로그인 모두 동일 형식의 **JWT(HS256, subject=userId, role 클레임)** 발급. 프론트는 `localStorage` 에 저장하고 `apiFetch` 가 `Authorization: Bearer` 로 부착.
- 인가: `/api/**` 는 URL 단에서 permitAll 이고, 실제 보호는 컨트롤러/서비스의 `@PreAuthorize` 또는 토큰 본인확인에 위임(`/api/admin/**` 만 URL 단에서 ADMIN 강제).

### 핵심 서브시스템 4
1. **자동수집 파이프라인**(`service/crawler`): cron → 네이버/카카오 검색(80여 키워드) → LLM 정규화 → 신뢰도 게이트(≥0.8) → PostgreSQL + Algolia 인덱싱.
2. **3-tier 음악 재생**(`service/music`, `service/spotify`): Spotify SDK(Premium 풀트랙) > preview(iTunes/Spotify 30~90초) > YouTube IFrame. 곡↔팝업 무드 매칭.
3. **사용자 기능**: AI 코스 추천 · 위시리스트 · 스탬프 패스포트 · 메이트(동행) · 피드백.
4. **어드민 모니터링**(`admin/metrics`, `admin/log`): 메트릭 카드(MetricSnapshotProvider 플러그인) + 라이브 로그(SSE).

### 이 문서 읽는 법
- 모듈 접두사: **B** = 백엔드, **F** = 프론트.
- 보안·성능 관련 지적은 `PROJECT_CHANGELOG.md` ch.29.22~29.23(v2.22 보안/클린코드 감사)과 교차 참조하면 좋다.
- 파일:라인 인용은 분석 시점 기준이라 이후 수정으로 1~2줄 어긋날 수 있다.

## 목차
- **B1** — 백엔드 · 설정 / 보안 / 모니터링
- **B2** — 백엔드 · 컨트롤러 (인증 / 회원 / 어드민 / 주문 / 게임)
- **B3** — 백엔드 · 컨트롤러 (팝업 / 음악 / 메이트 / 검색 / 기타)
- **B4** — 백엔드 · 음악 / Spotify 서비스
- **B5** — 백엔드 · 자동수집(크롤러) / 지오코딩
- **B6** — 백엔드 · 핵심 서비스 (auth / order / mate / wishlist / sla / backup / 기타)
- **B7** — 백엔드 · 엔티티 / 리포지토리 (데이터 계층)
- **B8** — 백엔드 · DTO / model / mapper / 예외 / 리소스
- **F1** — 프론트 · 메인 페이지 & 루트 레이아웃
- **F2** — 프론트 · 나머지 라우트
- **F3** — 프론트 · 컴포넌트 (src/components)
- **F4** — 프론트 · features (도메인 모듈)
- **F5** — 프론트 · lib / store / types / firebase / 설정

---

## B1 — 백엔드 · 설정 / 보안 / 모니터링

#### `popspot-backend/.../config/SecurityConfig.java` — Spring Security 중앙 설정 (CORS / STATELESS JWT / 경로 인가 / OAuth2 로그인)
- **책임**: 전체 HTTP 보안 정책의 단일 진입점. CSRF 비활성, CORS 화이트리스트, 세션 STATELESS, JWT 필터 삽입, 경로별 인가, OAuth2 로그인 핸들러 연결, BCrypt 인코더 빈 제공.
- **핵심 로직**:
  - `filterChain` (`SecurityConfig.java:94`): CSRF off → CORS 소스 연결 → `SessionCreationPolicy.STATELESS` → `jwtAuthenticationFilter` 를 `UsernamePasswordAuthenticationFilter` 앞에 삽입.
  - 인가 순서가 중요 — preflight 허용(`SecurityConfig.java:102`) → `/actuator/health(/**)` 공개 → `/api/admin/**` 와 `/actuator/**` 는 `hasRole("ADMIN")`(`:106`,`:108`) → `PUBLIC_PATHS` 공개 → 나머지 `authenticated()`. 즉 `/api/admin/**` 가 `/api/**`(public) 보다 먼저 매칭돼 어드민 경로는 보호된다.
  - `PUBLIC_PATHS`(`SecurityConfig.java:60`): `/`, `/api/**`, `/login/**`, `/oauth2/**`, `/signup/**`, `/error`, `/favicon.ico`, `/ws-stomp/**`, `/ws-planning/**`, `/uploads/**`. 대부분 API가 public이고 실제 인증/인가는 메서드 단 `@PreAuthorize` 와 JWT 필터에 위임.
  - `passwordEncoder` (`:88`): `BCryptPasswordEncoder(12)` — strength 12.
  - `corsConfigurationSource` (`:126`): `setAllowCredentials(true)` + `setAllowedOriginPatterns(origins)` 조합. 와일드카드 단독 금지, 화이트리스트만.
  - `parseOrigins` (`:149`): 쉼표 분리 → `frontendUrl` fallback 추가 → **prod 프로필이 아닐 때만** `http://localhost:3000` 추가(`:162`). `LinkedHashSet` 으로 중복 제거 + 순서 보존.
  - `buildOAuthFailureUrl` (`:143`): OAuth 실패 시 `{frontendUrl}/login?error` 로 보냄.
- **연결**: `@EnableMethodSecurity(prePostEnabled=true)` 로 코드 전반의 `@PreAuthorize` 활성화(예: `LogTailController`, `AdminMetricsController`). 주입: `CustomOAuth2UserService`(userInfo endpoint), `OAuth2SuccessHandler`(성공 핸들러), `JwtAuthenticationFilter`(필터). `@Value` 로 `app.frontend.url`, `app.allowed-origins`, `spring.profiles.active` 주입. `WebSocketConfig` 와 동일한 `app.allowed-origins` 를 공유(중복 구현).
- **특이사항**: `setAllowCredentials(true)` + `setAllowedOriginPatterns` 사용 시 패턴에 와일드카드(`*`)가 섞이면 자격증명 노출 위험 — 입력이 정확한 origin 문자열이라는 전제. CORS 정의는 여기 하나뿐이어야 하며(`WebConfig` 가 `addCorsMappings` 를 비워둔 이유), 두 곳에서 설정하면 충돌. JWT 필터는 `PUBLIC_PATHS` 라도 실행되어 토큰이 있으면 컨텍스트를 채운다(필터 자체는 인가를 막지 않음).

#### `popspot-backend/.../config/JwtAuthenticationFilter.java` — 매 요청 Bearer 토큰 검증 → SecurityContext 채우기
- **책임**: `OncePerRequestFilter` 로 요청당 1회 실행. Authorization Bearer(또는 SSE 한정 `?token=`)에서 JWT를 꺼내 검증하고 인증 정보를 `SecurityContextHolder` 에 세팅. 부팅 시 시크릿 강도 검증.
- **핵심 로직**:
  - `validateSecret` `@PostConstruct` (`JwtAuthenticationFilter.java:51`): `jwt.secret` 미설정/공백이면 `IllegalStateException` 으로 부팅 차단(`:53`), UTF-8 바이트 길이 < 32 이면 차단(`:59`) — HS256 최소 키 길이 강제. 통과 시 `Keys.hmacShaKeyFor` 로 `signingKey` 생성(`:66`).
  - `extractToken` (`:82`): `Authorization: Bearer ` 우선. 없고 경로가 `/api/admin/logs/stream`(`SSE_TOKEN_PATH_PREFIX`, `:41`)로 시작할 때만 `?token=` 쿼리 폴백(`:88`). 그 외 경로는 쿼리 토큰 무시.
  - `tryAuthenticate` (`:98`): `parseClaimsJws` 로 서명 검증 → subject=userId, `role` 클레임 추출. userId/role 둘 중 null이면 무인증 통과(`:108`). 성공 시 `UsernamePasswordAuthenticationToken(userId, null, [role권한])` 으로 컨텍스트 설정.
  - `ensureRolePrefix` (`:121`): `role` 에 `ROLE_` 접두사 없으면 붙임 → `hasRole("ADMIN")` 매칭 보장.
  - 예외 시 `log.warn("JWT 검증 실패: {}", e.getClass().getSimpleName())`(`:117`) — 토큰/스택트레이스 미노출.
- **연결**: `SecurityConfig.filterChain` 이 `UsernamePasswordAuthenticationFilter` 앞에 삽입. `?token=` 폴백은 `LogTailController`(`/api/admin/logs/stream`)의 EventSource 인증 경로와 짝을 이룸.
- **특이사항**: 토큰/헤더를 절대 로깅하지 않음(PII/시크릿 보호 의도 명시). 검증 실패는 401을 던지지 않고 "익명 통과" → 실제 차단은 인가 단(`anyRequest().authenticated()` / `@PreAuthorize`)에서. SSE 경로 외에는 URL 쿼리 토큰을 막아 URL 로깅/리퍼러 노출 위험을 축소.

#### `popspot-backend/.../config/OAuth2SuccessHandler.java` — OAuth2 로그인 성공 → JWT 발급 → 프론트 리다이렉트
- **책임**: 소셜 로그인 성공 직후 사용자 이메일을 provider별 구조에서 추출, DB 사용자 조회, JWT 발급, `redirectUri?token=...` 로 리다이렉트.
- **핵심 로직**:
  - `initKey` `@PostConstruct` (`OAuth2SuccessHandler.java:55`): `JwtAuthenticationFilter` 와 동일하게 32바이트 미만이면 부팅 차단. `signingKey` 생성.
  - `onAuthenticationSuccess` (`:66`): principal → attributes → `extractEmail`. 이메일 없으면 `redirectUri + "?error=no_email"` 로 리다이렉트하고 종료(`:74`). 있으면 `findUserOrThrow` → `issueJwt` → `UriComponentsBuilder` 로 `?token=` 부착 후 리다이렉트.
  - `extractEmail` (`:96`): provider별 분기 — top-level `email`(google) → `kakao_account.email`(kakao) → `response.email`(naver) 순서로 탐색(`:97`~`:110`). instanceof 패턴 매칭 사용.
  - `issueJwt` (`:120`): subject=`user.getUserId()`, `role` 클레임=`user.getRole()`, issuedAt/expiration(`accessTokenValidityMs` 기본 3600000ms=1h), HS256 서명.
  - 디버그 로그(`:86`)는 토큰 길이만 기록(토큰 값 미노출).
- **연결**: `SecurityConfig.oauth2Login(...).successHandler(this)` 로 연결. `UserRepository.findByEmail` 주입. 발급 JWT의 형식(subject=userId, role 클레임)은 `JwtAuthenticationFilter`/`WebSocketConfig` 의 파싱 규약과 일치해야 함. `@Value`: `app.oauth2.redirect-uri`(기본값 없음 → 미설정 시 부팅 실패), `jwt.secret`, `jwt.access-token-validity-ms`.
- **특이사항**: `findUserOrThrow` 가 `new RuntimeException("User not found")` 를 던짐(`:117`) — 도메인 예외가 아닌 raw RuntimeException(저장소가 다른 곳에선 RuntimeException→도메인 예외로 정리해 왔다는 작업 이력과 대비되는 잔존 케이스). 즉 OAuth 가입 절차상 사용자 선등록이 전제이며, 미등록 이메일은 500성 오류로 떨어짐. `jwt.secret` 빈 디폴트(`""`)라 미설정 시 `initKey` 에서 즉시 실패.

#### `popspot-backend/.../config/RateLimitInterceptor.java` — 민감 인증 엔드포인트 IP 기반 Rate Limit (Bucket4j + Caffeine)
- **책임**: 로그인/이메일 발송/코드 검증/이메일 열거 GET 엔드포인트에 IP별 토큰버킷 제한 적용. 초과 시 429 JSON 반환.
- **핵심 로직**:
  - 버킷 저장소(`RateLimitInterceptor.java:47`): `Caffeine` 캐시, `maximumSize(100_000)` + `expireAfterAccess(1h)`. 무한 증가 방지가 핵심(아래 특이사항).
  - `preHandle` (`:54`): `resolveLimit(URI)` 가 null이면 통과. 키=`URI|clientIp`(`:62`), 버킷을 `get(key, …Bucket.builder().addLimit(limit))` 로 lazy 생성. `tryConsume(1)` 실패 시 `rejectAsRateLimited` 후 `false`.
  - `resolveLimit` switch (`:71`): `/api/v1/auth/login` 분당 5, `email/send`·`email/send-for-pw` 시간당 5, `email/verify` 분당 10, `check-email`·`find-email`(열거 방지 GET) 분당 20. `Bandwidth.classic + Refill.intervally`(고정 윈도우 일괄 보충).
  - `rejectAsRateLimited` (`:89`): `log.warn(uri, ip)` → 429 + `application/json;charset=UTF-8` + `{"error":"RATE_LIMITED",...}`.
  - `clientIp` (`:98`): `X-Forwarded-For` 첫 값 → `X-Real-IP` → `getRemoteAddr()`.
- **연결**: `WebConfig.addInterceptors` 가 `/api/v1/auth/**` 패턴에만 등록(즉 등록 경로가 좁아 다른 URI는 애초에 인터셉터를 안 탐). `@Component` 로 주입.
- **특이사항**: 명시된 보안 회귀 수정(`:44`) — 과거 `ConcurrentHashMap` 은 `URI|IP` 키가 무한 증가했고, `X-Forwarded-For` 위조로 고유 키를 양산하면 OOM. Caffeine 상한/만료로 메모리 상한 보장. 단 `clientIp` 가 XFF를 신뢰하므로 **신뢰 가능한 리버스 프록시 뒤** 가정이 필요(프록시가 XFF를 덮어쓰지 않으면 IP 위조로 제한 우회 가능). 메모리 기반이라 단일 인스턴스 전용 — 멀티 인스턴스에서는 Redis 백엔드 필요(클래스 javadoc 명시).

#### `popspot-backend/.../config/WebConfig.java` — Spring MVC: 업로드 정적 매핑 + 인터셉터 등록 + nosniff
- **책임**: `/uploads/**` 를 디스크 업로드 폴더에 정적 매핑하고, RateLimit 인터셉터(`/api/v1/auth/**`)와 업로드 응답 nosniff 인터셉터(`/uploads/**`)를 등록.
- **핵심 로직**:
  - `addResourceHandlers` (`WebConfig.java:35`): `Paths.get(uploadPath).toUri()` 를 리소스 로케이션으로 매핑. 시작 시 매핑 로그.
  - `addInterceptors` (`:42`): `rateLimitInterceptor` → `/api/v1/auth/**`(`:43`), 내부 `NoSniffInterceptor` → `/uploads/**`(`:46`).
  - `NoSniffInterceptor` (`:50`): 업로드 응답에 `X-Content-Type-Options: nosniff` 부착(`:54`) — 이미지로 위장한 HTML/SVG의 MIME 스니핑 실행 차단. `Content-Disposition` 은 미설정해 inline 표시 유지.
- **연결**: `RateLimitInterceptor` 주입. `@Value` `app.upload.path`(기본값 없음 → 필수). CORS 매핑은 의도적으로 비워 `SecurityConfig` 가 단일 진실 공급원(클래스 javadoc `:18`).
- **특이사항**: nosniff만 부착할 뿐 업로드 파일 확장자/Content-Type 자체 검증은 여기서 안 함(업로드 처리 측 책임). 업로드 폴더가 웹 루트에 노출되므로 저장 단계의 파일명/타입 검증이 별도로 필요.

#### `popspot-backend/.../config/CacheConfig.java` — Caffeine 인메모리 캐시 매니저
- **책임**: `@EnableCaching` + Caffeine 기반 `CacheManager` 빈 제공. 4개 캐시 이름 상수 정의(5분 TTL, 최대 500엔트리, 통계 기록).
- **핵심 로직**:
  - `cacheManager` (`CacheConfig.java:42`): `CaffeineCacheManager` 에 캐시명 4개 고정(`setCacheNames`, `:44`) → 미선언 이름 호출 시 캐시 생성 안 됨. 공통 정책 `expireAfterWrite(5m)`, `maximumSize(500)`, `recordStats()`(`:47`).
  - 캐시 상수(`:36`~`:39`): `popups-visible`, `popups-hot`, `popup-detail`, `mypage`.
- **연결**: 캐시명 상수를 서비스의 `@Cacheable`/`@CacheEvict` 가 참조(javadoc상 `PopupStoreService#findVisibleMapMarkers` 에 `popups-visible` 적용, 어드민 쓰기 시 evict). 인증/검수/실시간 데이터는 미캐싱 방침.
- **특이사항**: javadoc상 실제 wiring은 일부만 됨 — `popups-hot`(Jackson lazy 직렬화 위험으로 evict만), `popup-detail`(viewCount++ 부수효과로 미적용), `mypage`(premium 만료 lazy expire 미분리로 미적용). 모든 캐시가 동일 정책(5m/500)을 공유해 javadoc에 적힌 캐시별 TTL(10분/1분)은 코드상 미반영 — 주석과 구현 불일치 주의. `spring.cache.type=none` 으로 전체 비활성 가능.

#### `popspot-backend/.../config/WebSocketConfig.java` — STOMP WebSocket 엔드포인트 + 핸드셰이크 JWT 파싱
- **책임**: `/ws-stomp`, `/ws-planning` STOMP 엔드포인트(SockJS) 등록, origin 화이트리스트 적용, 핸드셰이크 단계에서 JWT를 파싱해 `userId`/`role` 을 세션 attributes에 적재, 심플 브로커 설정.
- **핵심 로직**:
  - `init` `@PostConstruct` (`WebSocketConfig.java:54`): `jwt.secret` 공백이면 `signingKey` 를 null로 두고 그냥 리턴(`:55`) — JWT 검증을 건너뜀. 32바이트 이상일 때만 키 생성(`:57`). (부팅 차단하는 다른 두 클래스와 달리 여기선 미설정 허용.)
  - `registerStompEndpoints` (`:63`): 두 엔드포인트에 `setAllowedOriginPatterns(origins)` + `JwtHandshakeInterceptor` + `.withSockJS()`.
  - `configureMessageBroker` (`:81`): 구독 prefix `/sub`,`/topic`; 발행 prefix `/pub`,`/app`.
  - `parseOrigins` (`:86`): `allowedOriginsRaw` 쉼표 분리 + `frontendUrl` + **항상** `http://localhost:3000` 추가(`:97`).
  - `JwtHandshakeInterceptor.beforeHandshake` (`:104`): `signingKey==null` 이면 통과. 토큰 있으면 검증 후 `attributes.put("userId"/"role")`(`:119`). 검증 실패해도 `debug` 로그만 남기고 **항상 true** 반환(`:125`) — 익명 핸드셰이크 허용.
  - `extractToken` (`:137`): Authorization Bearer → `?token=` 쿼리(SockJS info/transport 요청 호환).
- **연결**: `SimpMessagingTemplate`(브로커)와 `WebSocketEventListener`(연결 해제 이벤트)가 이 STOMP 설정 위에서 동작. `PlanningController` 가 `/pub|/app` 발행 prefix와 `/topic/plan/...` 구독을 사용. `app.allowed-origins`/`app.frontend.url`/`jwt.secret` 공유.
- **특이사항**: 핸드셰이크 JWT는 검증 실패/부재여도 통과시키므로(익명 채팅 호환), **인증 강제는 메시지 발행 단(컨트롤러/`@PreAuthorize`)에서 해야 함** — 핸드셰이크만으로 권한 보장 안 됨. `SecurityConfig` 가 prod에서 localhost를 빼는 것과 달리 여기 `parseOrigins` 는 프로필 무관하게 localhost를 항상 추가 → prod에서도 WS origin에 localhost가 남는 비대칭(보안 점검 포인트). 두 곳의 origin 파싱 로직이 중복.

#### `popspot-backend/.../config/WebSocketEventListener.java` — STOMP 연결 해제 시 협업 룸 정리 + LEAVE 브로드캐스트
- **책임**: `SessionDisconnectEvent` 수신 → Redis에 저장된 세션 매핑을 읽어 사용자를 룸 참여자 Set에서 제거하고, 같은 룸에 `LEAVE` 시스템 메시지를 브로드캐스트한 뒤 세션 키 삭제.
- **핵심 로직**:
  - `handleWebSocketDisconnectListener` `@EventListener` (`WebSocketEventListener.java:34`): `sessionKey = PlanningController.SESSION_KEY_PREFIX + sessionId`(`:36`). Redis 값 없으면 리턴(`:39`). 값 형식 `roomId/userData` 를 `/` 로 분리, parts.length≠2면 리턴(`:42`) — 방어적 파싱.
  - `evictFromRoom` (`:53`): `plan:room:{roomId}:users` Set에서 userData 제거.
  - `broadcastLeave` (`:59`): `/topic/plan/{roomId}` 로 `PlanningController.PlanAction("LEAVE", userData, "System")` 전송.
  - 마지막에 세션 키 삭제(`:50`).
- **연결**: 주입 `SimpMessagingTemplate`, `StringRedisTemplate`. `PlanningController` 와 강결합 — 세션 키 접두사 상수(`SESSION_KEY_PREFIX`)와 메시지 DTO(`PlanAction`)를 그대로 재사용(저장은 `PlanningController.java:134` 에서, 형식 `roomId + "/" + sender`). `WebSocketConfig` 가 만든 STOMP 인프라 위에서 동작.
- **특이사항**: Redis 세션 키에 TTL 3시간(`ROOM_TTL_HOURS`, PlanningController)이 걸려 있어 disconnect 이벤트가 유실돼도 자동 만료. 세션값 포맷이 `roomId/userData` 라 userData에 `/` 가 들어가면 split이 깨질 수 있음(현 구현은 정확히 2파트 가정).

#### `popspot-backend/.../config/AiConfig.java` — LLM(ChatLanguageModel) 빈 — Groq(OpenAI 호환) 게이트웨이
- **책임**: langchain4j `OpenAiChatModel` 을 Groq 엔드포인트로 구성해 `@Primary ChatLanguageModel` 빈 제공.
- **핵심 로직**:
  - `chatLanguageModel` (`AiConfig.java:34`): `baseUrl`(기본 `https://api.groq.com/openai/v1`), `apiKey`, `modelName`(기본 `llama-3.3-70b-versatile`), `temperature(0.7)`, `timeout(60s)` 빌더 구성.
  - `@Value` 주입: `groq.api-key`(기본값 없음 → 필수), `groq.model-name`, `groq.base-url`.
- **연결**: `@Primary` 라 `ChatLanguageModel` 을 주입받는 AI 서비스가 이 빈을 받음. base-url 교체로 다른 OpenAI 호환 서비스 전환 가능.
- **특이사항**: `groq.api-key` 미설정 시 빈 생성/주입 시점에 실패. 무료 한도 14,400 req/day(주석) — 운영 시 레이트/쿼터 고려 필요.

#### `popspot-backend/.../config/GoodsInitializer.java` — 굿즈 시드 데이터 주입 자리(현재 비활성)
- **책임**: 시작 시 굿즈 시드를 넣기 위한 `CommandLineRunner` 빈 — 현재는 원본 데이터 보존을 위해 no-op(로그만 출력).
- **핵심 로직**: `initGoodsData` (`GoodsInitializer.java:25`) 가 실행 시 `log.info("...초기화 로직을 건너뜁니다.")` 만 호출. `GoodsRepository` 는 `@SuppressWarnings("unused")` 로 주입만 되어 있음(향후 `saveAll` 복원용).
- **연결**: `GoodsRepository` 주입(현재 미사용). 복원하려면 `initGoodsData` 람다 안에 `goodsRepository.saveAll(...)` 추가.

#### `popspot-backend/.../admin/log/LogRingBuffer.java` — 최근 N줄 로그 메모리 링버퍼
- **책임**: 최근 최대 500줄 로그를 메모리 FIFO로 보관해 새 SSE 연결 시 백필 소스로 제공. 모든 접근 synchronized.
- **핵심 로직**:
  - `add` (`LogRingBuffer.java:22`): 크기 ≥500이면 `pollFirst()` 로 가장 오래된 줄 제거 후 `addLast`.
  - `snapshot` (`:30`): `ArrayList` 복사본을 `unmodifiableList` 로 반환(오래된→최신 순서, 호출자 안전 순회).
  - `size` (`:34`): 현재 줄 수.
- **연결**: `LogTailService` 가 주입받아 `pollNewLines` 에서 `add`, `sendBackfill` 에서 `snapshot` 호출.
- **특이사항**: 단순 `synchronized` 동기화(어드민 동시 접속 적다는 전제). 메모리 상한이 500줄로 고정.

#### `popspot-backend/.../admin/log/LogTailService.java` — 로그 파일 폴링 → SSE 브로드캐스트
- **책임**: 설정된 로그 파일을 500ms마다 폴링해 새로 추가된 바이트를 라인 단위로 모든 SSE 구독자에게 전송 + 링버퍼 적재. 30초 keepalive ping. 구독자 수/타임아웃 상한 관리.
- **핵심 로직**:
  - `start` `@PostConstruct` (`LogTailService.java:49`): `logging.file.name` 미설정이면 SSE 비활성(`:50`, dev 환경). 설정 시 데몬 스레드 풀 1개로 `pollNewLines`(0/500ms)와 `sendKeepalive`(30s/30s) 스케줄.
  - `newDaemonThread` (`:66`): 데몬 스레드로 띄워 JVM 종료를 막지 않음.
  - `subscribe` (`:80`): 구독자 ≥50(`MAX_SUBSCRIBERS`)이면 1ms emitter로 즉시 `completeWithError`(`:83`). 아니면 `SseEmitter(30분)` 생성 → completion/timeout/error 콜백으로 자기 자신 제거 등록(`:88`~`:90`) → `sendBackfill` → 구독자 목록 추가.
  - `sendBackfill` (`:96`): 링버퍼 snapshot을 `event().name("log")` 로 전송, 실패 시 제거+에러 종료.
  - `pollNewLines` (`:108`): `RandomAccessFile` 로 `lastReadPosition` 부터 읽음. 파일 길이 < lastRead이면(rotation/재생성) 0으로 리셋(`:115`), 변화 없으면 리턴. 새 바이트만 UTF-8 디코딩 후 `\R` 로 분할, 비어있지 않은 줄을 링버퍼 add + `broadcast("log", line)`.
  - `broadcast` (`:142`): 전 구독자에 전송, 실패 emitter는 제거 후 `completeWithError`.
  - `stop` `@PreDestroy` (`:73`): 스케줄러 `shutdownNow`, 전 emitter `complete`, 목록 clear.
- **연결**: `LogRingBuffer` 주입. `LogTailController.stream()` 이 `subscribe()` 호출. `@Value logging.file.name`(Spring Boot 표준 로그 파일 프로퍼티).
- **특이사항**: 명시된 보안 수정(`:33`) — SSE 타임아웃 0(무제한)은 잠든/죽은 admin 탭의 emitter가 영구 누수돼 스레드·메모리 고갈 → 30분 타임아웃 + 30초 keepalive로 정상 클라이언트는 자동 재연결. `MAX_SUBSCRIBERS=50` 초과 거부로 폭증 방지. 파일을 매 폴링마다 열고 닫음(try-with-resources). `lastReadPosition` 은 인스턴스 필드라 단일 폴링 스레드 전제(스케줄 풀 size=1이라 직렬화됨).

#### `popspot-backend/.../admin/log/LogTailController.java` — 어드민 실시간 로그 SSE 엔드포인트
- **책임**: `GET /api/admin/logs/stream` 으로 `text/event-stream` SSE를 반환(ADMIN 전용).
- **핵심 로직**:
  - 클래스 `@RequestMapping("/api/admin/logs")` + `@PreAuthorize("hasRole('ADMIN')")`(`LogTailController.java:18`,`:20`).
  - `stream` (`:26`): `produces = TEXT_EVENT_STREAM_VALUE`, `logTailService.subscribe()` 위임.
- **연결**: `LogTailService` 주입. 인가는 `SecurityConfig` 의 `/api/admin/**` hasRole + 메서드 `@PreAuthorize` 이중 가드. 인증 토큰은 `JwtAuthenticationFilter` 의 `/api/admin/logs/stream` 한정 `?token=` 폴백으로 받음(EventSource가 헤더 못 보내는 문제 우회, javadoc `:14`).
- **특이사항**: 경로가 정확히 `JwtAuthenticationFilter.SSE_TOKEN_PATH_PREFIX`(`/api/admin/logs/stream`)와 일치해야 쿼리 토큰 인증이 동작 — 두 상수가 결합돼 있음.

#### `popspot-backend/.../admin/metrics/MetricSnapshotProvider.java` — 메트릭 제공자 SPI 인터페이스
- **책임**: 어드민 대시보드 메트릭 한 묶음을 제공하는 확장 포인트. 구현 빈을 추가하면 자동으로 합성됨.
- **핵심 로직**: `key()` — 응답 JSON 최상위 키(jvm/http/db/crawler). `snapshot()` — 직렬화 안전 타입(Number/String/Boolean/컬렉션)만 담은 `Map<String,Object>`.
- **연결**: `AdminMetricsController`(`controller/AdminMetricsController.java:33`)가 `private final List<MetricSnapshotProvider> providers;` 로 모든 구현 빈을 자동 주입받아 `getDashboard()` 에서 합성. 구현체 4종: `JvmMetricSnapshotProvider`, `HttpMetricSnapshotProvider`, `DbPoolMetricSnapshotProvider`, `CrawlerMetricSnapshotProvider`.
- **특이사항**: 새 카드 추가 = 인터페이스 구현 빈 1개 추가만으로 끝나는 개방-폐쇄 설계. `key()` 중복 시 응답 맵에서 충돌 가능(합성 측 정책에 의존).

#### `popspot-backend/.../admin/metrics/CrawlerMetricSnapshotProvider.java` — 자동수집 운영 지표(오늘 수집 수/평균 신뢰도/검수 대기)
- **책임**: 오늘 새로 수집된 팝업 수, 평균 신뢰도, 검수 대기열 크기를 DB 집계로 제공. `key()="crawler"`.
- **핵심 로직**:
  - `snapshot` (`CrawlerMetricSnapshotProvider.java:29`): `startOfToday = LocalDate.now().atStartOfDay()` 기준. `countCrawledSince`, `averageConfidenceSince`(`round2`), `countPendingReview` 3개 쿼리.
  - `round2` (`:39`): `BigDecimal` null이면 0.0, 아니면 소수 2자리 반올림.
- **연결**: `PopupStoreRepository` 주입(집계 메서드 3종). `AdminMetricsController` 가 List로 수집해 응답에 `crawler` 키로 노출.
- **특이사항**: 호출마다 DB 집계 3건 — 어드민 폴링(약 3초)엔 부담 없다고 명시되나, 폴링 주기가 짧아지면 부하 가능. 서버 로컬 타임존 기준 "오늘".

#### `popspot-backend/.../admin/metrics/DbPoolMetricSnapshotProvider.java` — HikariCP 커넥션 풀 사용량
- **책임**: `hikaricp.connections.*` Micrometer 게이지를 합산해 active/idle/pending/max/total 제공. `key()="db"`.
- **핵심 로직**:
  - `snapshot` (`DbPoolMetricSnapshotProvider.java:27`): 각 메트릭을 `sumGauges` 후 `(long)` 캐스팅해 맵에 적재.
  - `sumGauges` (`:37`): `meterRegistry.find(name).gauges()` 를 순회 합산(풀 여러 개 대비).
- **연결**: `MeterRegistry` 주입. `AdminMetricsController` 가 `db` 키로 합성.
- **특이사항**: 게이지 부재 시 빈 컬렉션 → 합 0.0 (null-safe). HikariCP가 Micrometer에 등록돼 있어야 값이 잡힘.

#### `popspot-backend/.../admin/metrics/HttpMetricSnapshotProvider.java` — HTTP 요청 통계(count/mean/p95/5xx/errorRate)
- **책임**: `http.server.requests` Timer들을 합산해 요청 수, 5xx 수, 에러율, 평균/ p95 응답시간(ms) 제공. `key()="http"`.
- **핵심 로직**:
  - `snapshot` (`HttpMetricSnapshotProvider.java:38`): 모든 Timer 순회하며 `count`/`totalTime(ms)` 누적, 5xx면 `total5xx` 누적, p95는 Timer별 최댓값으로(`Math.max`, `:51`). `meanMs = totalTimeMs/total`(0 division 가드, `:54`). `errorRate = total5xx/total`(`round4`).
  - `isStatus5xx` (`:63`): `status` 태그가 "5" 로 시작.
  - `extractP95Ms` (`:69`): `takeSnapshot().percentileValues()` 에서 percentile≈0.95(±0.001)인 값을 ms로 반환, 없으면 0.
- **연결**: `MeterRegistry` 주입. `AdminMetricsController` 가 `http` 키로 합성.
- **특이사항**: p95는 histogram이 활성화돼야 의미 있는 값(미활성 시 0). javadoc상 `application.properties` 의 percentiles 설정 필요. 여러 Timer의 p95를 평균이 아닌 최댓값으로 합치는 단순화 — 통계적으로 정확한 전역 p95는 아님(보수적 근사).

#### `popspot-backend/.../admin/metrics/JvmMetricSnapshotProvider.java` — JVM 상태(Heap/GC/Thread)
- **책임**: Micrometer 표준 게이지/타이머로 Heap·NonHeap 사용량(MB), GC pause(초), live/daemon 스레드 수 제공. `key()="jvm"`.
- **핵심 로직**:
  - `snapshot` (`JvmMetricSnapshotProvider.java:30`): `jvm.memory.used/max` 를 `area=heap|nonheap` 태그로 합산 후 MB 변환, `jvm.gc.pause` 타이머 total(초), `jvm.threads.live/daemon` 게이지.
  - `sumByArea` (`:42`): `find(name).tag("area", area).gauges()` 합산.
  - `gaugeValue` (`:50`): 게이지 null이면 0.0 (첫 요청 전 부재 대비).
  - `timerTotal` (`:56`): `jvm.gc.pause` timers의 total time(초) 합. 첫 GC 전엔 0.
- **연결**: `MeterRegistry` 주입. `AdminMetricsController` 가 `jvm` 키로 합성.
- **특이사항**: 모든 조회가 null-safe(첫 요청 전 일부 게이지 부재 대응). `hasAreaTag`(`:67`)는 `@SuppressWarnings("unused")` 가 붙은 미사용 참고용 헬퍼 — 데드코드.

---

교차 연결 요약: `SecurityConfig` 가 보안의 허브로 `JwtAuthenticationFilter`·`OAuth2SuccessHandler` 를 엮고 `@PreAuthorize` 를 켜며, `WebConfig` 는 CORS를 여기에 위임하고 인터셉터(`RateLimitInterceptor`·`NoSniff`)만 담당. JWT 형식(subject=userId + `role` 클레임)은 `OAuth2SuccessHandler`(발급)·`JwtAuthenticationFilter`·`WebSocketConfig`(검증) 3곳이 공유. `app.allowed-origins` 는 `SecurityConfig`·`WebSocketConfig` 가 중복 파싱(prod localhost 처리는 비대칭). 로그 모듈은 `LogTailController → LogTailService → LogRingBuffer` 선형 체인이며 SSE 인증을 위해 `JwtAuthenticationFilter` 의 `/api/admin/logs/stream` 쿼리토큰 폴백과 결합. 메트릭 모듈은 `MetricSnapshotProvider` SPI를 4개 구현체가 채우고 (이 디렉터리 밖) `AdminMetricsController` 가 `List` 자동주입으로 합성. `WebSocketEventListener` 는 `PlanningController` 의 Redis 세션 규약/`PlanAction` DTO에 강결합.

주의 깊게 본 잠재 포인트: (1) `WebSocketConfig.parseOrigins` 가 prod에서도 localhost를 허용 origin에 항상 추가 — `SecurityConfig` 와 비대칭. (2) `OAuth2SuccessHandler.findUserOrThrow` 의 raw `RuntimeException`("User not found") 잔존. (3) `CacheConfig` javadoc의 캐시별 TTL(10분/1분)과 실제 단일 정책(5분) 불일치 + 다수 캐시가 evict만 wired. (4) `RateLimitInterceptor`·`WebSocketConfig`·`JwtAuthenticationFilter` 모두 `X-Forwarded-For`/`?token=` 를 신뢰 — 신뢰 프록시 뒤 전제가 필요.

## B2 — 백엔드 · 컨트롤러 (인증/회원/어드민/주문/게임)

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/AuthController.java` — 인증/회원가입/이메일 인증코드/비밀번호 재설정 + 내 정보 조회

- **책임**: `/api/v1/auth` 하위 인증 흐름 전반. 회원가입·로그인·이메일 중복확인·이메일 찾기·인증코드 발송/검증·비밀번호 재설정·`/me`(현재 사용자 조회)를 담당. 도메인 로직은 `AuthService`/`EmailService`에 위임하고, 컨트롤러는 Redis 기반 인증코드 상태 머신을 직접 운영한다.
- **핵심 로직**:
  - 인증코드 상태는 Redis 3개 키로 관리 — `AUTH_CODE:`(코드, TTL 5분), `AUTH_ATTEMPTS:`(실패 시도수), `AUTH_VERIFIED:`(검증완료 플래그, TTL 10분) (`AuthController.java:41-43`).
  - `issueNewAuthCode` — `emailService.sendMail`로 코드 발송 후 Redis에 TTL 5분 저장 + 기존 시도수 삭제 (`AuthController.java:153-159`).
  - `verifyEmail` — 저장 코드 없으면 만료 400, 일치하면 `markEmailVerified`, 불일치면 `handleFailedAttempt` (`AuthController.java:111-121`).
  - `handleFailedAttempt` — 시도수를 increment 후 expire 재설정. `MAX_VERIFY_ATTEMPTS=5` 도달 시 코드+시도수 폐기하고 429 반환 (brute-force 방어) (`AuthController.java:177-192`).
  - `resetPassword` — `AUTH_VERIFIED:`가 `TRUE`일 때만 통과(아니면 403), 변경 후 verified 플래그 삭제 (`AuthController.java:128-134`).
  - `getCurrentUser` — `Authentication`이 null이면 401, 유저 로드 후 `toUserInfo`로 `userId/nickname/role/isPremium/email/picture` 맵 반환 (`AuthController.java:137-149`, `206-216`).
  - `mapPasswordResetError` — 예외 메시지가 `SOCIAL_USER` 접두사면 400(소셜 가입자 비번재설정 불가), 그 외 404 (`AuthController.java:194-200`).
- **연결**: 주입 = `AuthService`, `EmailService`, `StringRedisTemplate`. 호출자 = 프론트 인증/회원가입/비밀번호찾기 화면. `/me`는 JWT 인증된 클라이언트가 권한·프로필 갱신용으로 호출(MEMORY의 v2.15.3 "MY 탭 내 계정 카드"·네이버 OAuth 검수용으로 email/picture 추가).
- **특이사항**: 보안(v2.22) — brute-force 의심 로그에서 이메일을 `maskEmail`로 마스킹(앞1글자+`***`+도메인)해 PII 평문 로깅 방지 (`AuthController.java:186`, `222-228`). `/me` 예외는 메시지 노출 없이 클래스명만 로깅(`AuthController.java:146`). `sendEmail`은 가입 여부 검증 없이 누구에게나 코드 발송 가능(이메일 존재 확인은 `send-for-pw`에서만 `checkUserForPasswordReset` 수행).

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/AdminController.java` — 관리자 운영 콘솔(팝업 승인 큐/대시보드/보상/메이트 운영)

- **책임**: `/api/admin` 하위 관리자 API. 사용자 제보 팝업(`status=PENDING`) 승인/거절, 대시보드 통계, 전체 팝업 상태 변경, 수동 보상 지급, 메이트 글 강제 삭제. 모든 도메인 로직은 `AdminService`에 위임.
- **핵심 로직**:
  - 클래스 단 `@PreAuthorize("hasRole('ADMIN')")` — SecurityConfig URL 매칭과 이중 방어(라우트 패턴 변경 시 권한 누락 방지) (`AdminController.java:30`).
  - 팝업 승인 큐 — `GET /popups/pending`, `POST /popups/{id}/approve`(승인+보상지급), `DELETE /popups/{id}/reject` (`AdminController.java:37-52`).
  - `giveReward` — body에서 `nickname`/`itemType` 필수 검증, `amount`는 정수 파싱. 검증 실패는 `IllegalArgumentException`으로 격상해 GlobalExceptionHandler에 위임 (`AdminController.java:80-106`).
  - `changePopupStatus` — `@RequestParam status`를 받아 `adminService.changePopupStatus`로 위임 (`AdminController.java:66-71`).
- **연결**: 주입 = `AdminService`. 반환 타입에 엔티티(`PopupStore`, `MatePost`) 직접 노출. 호출자 = 프론트 admin 페이지(승인 큐/대시보드/보상/메이트 운영 탭). MEMORY 작업 이력상 admin 페이지는 role 가드로 polling 차단(v2.13.3-H2).
- **특이사항**: 사용자 제보 검수는 본 컨트롤러(`status=PENDING`), 자동수집 검수는 `PopupAdminReviewController`(`reviewStatus=PENDING_REVIEW`)로 분리되어 URL 충돌 회피.

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/AdminMetricsController.java` — 관리자 서버 헬스 메트릭(v1 server-status + v2 dashboard)

- **책임**: `/api/admin/metrics` 하위. 레거시 `/server-status`(CPU+JVM heap)와 확장형 `/dashboard`(여러 `MetricSnapshotProvider` 빈 합성) 두 엔드포인트 제공.
- **핵심 로직**:
  - `getServerStatus` — `system.cpu.usage` Gauge에서 CPU%(×100), `Runtime`으로 사용 메모리(MB) 계산. 전체를 try-catch로 감싸 실패 시 0.0 폴백 (`AdminMetricsController.java:36-47`, `68-78`).
  - `getDashboard` — 주입된 `List<MetricSnapshotProvider>`를 순회하며 `p.key()→p.snapshot()` 수집. **Provider별 try-catch로 한 곳이 던져도 그 키만 `{error: 예외클래스명}`으로 격리**(한 Provider 실패가 전체 5xx 되는 것 방지) (`AdminMetricsController.java:54-66`).
  - `roundToTwoDecimals` — `Math.round(v*100)/100.0` (`AdminMetricsController.java:80-82`).
- **연결**: 주입 = `MeterRegistry`(Micrometer), `List<MetricSnapshotProvider>`. Provider는 빈 1개 추가만으로 dashboard 확장(개방-폐쇄). 호출자 = 프론트 admin 모니터링 탭(MEMORY v2.10 모니터링 작업군). 클래스 단 `@PreAuthorize("hasRole('ADMIN')")`.

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/AdminFeedbackController.java` — 의견 보내기 검수/답변용 어드민 API

- **책임**: `/api/admin/feedback` 하위. 피드백 목록 조회(상태 필터+페이징), 상태별 카운트 메트릭, 답변 작성, 삭제. 매핑/검증은 모두 `FeedbackService`에 위임.
- **핵심 로직**:
  - `list` — `status`(선택), `page`(기본 0), `size`(기본 50) 받아 `feedbackService.findForAdmin` 위임 (`AdminFeedbackController.java:39-45`).
  - `metrics` — `countByStatus()`로 상태별 개수 맵 반환 (`AdminFeedbackController.java:47-50`).
  - `reply` — `@Valid @RequestBody FeedbackReplyRequestDto`로 답변, `FeedbackResponseDto` 반환 (`AdminFeedbackController.java:52-56`).
  - `delete` — 삭제 후 `{status: "DELETED", id}` 반환 (`AdminFeedbackController.java:58-62`).
- **연결**: 주입 = `FeedbackService`(사용자측 `FeedbackController`와 공유). 호출자 = 프론트 admin FEEDBACK 탭(MEMORY v2.11-R3/R6). 클래스 단 `@PreAuthorize("hasRole('ADMIN')")` + SecurityConfig 이중 방어.

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/AdminMusicController.java` — 음악 캐시 운영용 어드민(cover/live/remix 캐시 일괄 초기화)

- **책임**: `/api/admin/music/refresh-covers` 단일 엔드포인트. cover/live/remix 의심 row의 캐시된 YouTube id를 일괄 초기화해 다음 재생 시 v2.14 새 필터로 공식 음원만 재매칭되게 한다.
- **핵심 로직**: `refreshCovers` → `musicService.clearLikelyCoverCache()` 호출, 정리된 개수 맵 반환 (`AdminMusicController.java:26-29`).
- **연결**: 주입 = `MusicService`(`service.music` 패키지). 호출자 = 프론트 admin 음악 운영(MEMORY v2.14-M3). 클래스 단 `@PreAuthorize("hasRole('ADMIN')")`.

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/PopupAdminReviewController.java` — 자동수집(Naver/Kakao+LLM) 팝업 검수 큐 + 수동 크롤/지오코딩 트리거

- **책임**: `/api/admin/popups/crawl` 하위. 신뢰도 임계값 미만(`reviewStatus=PENDING_REVIEW`)인 자동수집 팝업의 검수(승인/거절/영구삭제)와 운영자용 수동 크롤 1회 트리거·좌표 backfill. 영속화는 `PopupStoreService`, 크롤은 `PopupCrawlOrchestrator`에 위임.
- **핵심 로직**:
  - `pending` — `findPendingReview(size)` (기본 50) (`PopupAdminReviewController.java:45-49`).
  - `approve`/`reject` — `updateReviewStatus(id, "APPROVED"/"REJECTED")` 후 변경된 팝업명 INFO 로깅, `{status, id}` 반환 (`PopupAdminReviewController.java:51-63`).
  - `permanentDelete` — `deleteById(id)` 영구 삭제 + WARN 로깅. JavaDoc: 약관상 24h 내 노출 차단은 `reviewStatus=TAKEDOWN`으로 우선 처리하고, 본 호출은 검토 후 영구삭제 단계에서만(악성 takedown 방어) (`PopupAdminReviewController.java:65-74`).
  - `runCrawlNow` — `orchestrator.runOnce()` 수동 1회 크롤, `triggeredAt`(LocalDateTime.now)+`stats` 반환 (`PopupAdminReviewController.java:77-85`).
  - `geocodeMissing` — 좌표 누락 row 일괄 geocoding backfill, `{geocoded: n}` 반환 (`PopupAdminReviewController.java:88-92`).
- **연결**: 주입 = `PopupStoreService`, `PopupCrawlOrchestrator`. 호출자 = 프론트 admin 자동수집 검수 탭(MEMORY v2.13-S2 자동수집 자동화). 클래스 단 `@PreAuthorize("hasRole('ADMIN')")`.
- **특이사항**: 사용자 제보 검수(`AdminController`, `status=PENDING`)와 의도적으로 URL/상태 컬럼을 분리. takedown은 즉시 `TAKEDOWN` 처리 후 영구삭제는 별도 신중 단계로 두는 2단계 설계.

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/UserProfileController.java` — 회원 프로필 수정(닉네임 중복검사/아바타 업로드/메타 수정/회원 탈퇴)

- **책임**: `/api/v1/users` 하위. 닉네임 중복검사(본인 제외), 아바타 multipart 업로드(검증+저장+DB picture 갱신), 닉네임/picture JSON 수정, PIPA 의무 회원 탈퇴(즉시 익명화). 이 모듈에서 가장 복잡한 컨트롤러로, 보안 로직(traversal 차단·MIME 화이트리스트·forwarded host 검증)을 자체 보유.
- **핵심 로직**:
  - 생성자에서 `app.upload.allowed-host-patterns` CSV를 `compilePatterns`로 정규식 리스트 컴파일(불변 리스트) (`UserProfileController.java:76-83`, `335-345`).
  - `checkNickname` — 길이 2~20 검증, 본인이 이미 쓰는 닉네임이면 `{available:true, self:true}`, `existsByNickname`로 중복 판정 (`UserProfileController.java:87-110`).
  - `uploadAvatar` — `validateAvatar`(빈파일/5MB초과/`..` traversal/확장자[jpg,jpeg,png,webp]/MIME 화이트리스트) → `prepareDestination`(UUID 재명명) → `transferTo` → `buildPublicUrl` → DB `user.setPicture` 갱신. `SecurityException`은 400+traversal 경고 로깅, `IOException`은 500 (`UserProfileController.java:114-150`, `262-304`).
  - `prepareDestination` — UUID 파일명 생성 후 **canonicalPath가 업로드 디렉토리+separator로 시작하는지 재확인**해 traversal 차단 (`UserProfileController.java:292-304`).
  - `buildPublicUrl`/`resolveHost` — `X-Forwarded-Host`는 `isAllowedHost`(화이트리스트 정규식 매칭) 통과 시에만 신뢰, 아니면 `serverName`+포트(80/443 생략) (`UserProfileController.java:306-333`). MEMORY 작업이력 v2.7 S4 "X-Forwarded-Host 화이트리스트"와 일치.
  - `updateMe` — `@Transactional`. 닉네임 길이·중복 검증 후 갱신, picture 공백이면 null. 검증 실패는 `IllegalArgumentException` (`UserProfileController.java:163-196`).
  - `deleteMe` — `@Transactional`. nickname=`[탈퇴한 회원]`, email/phone/picture 익명화(랜덤 8자 suffix로 unique 충돌 회피), 비번을 `DELETED-{suffix}`로 무효화, **`spotifyAuthRepository.deleteByUserId`로 Spotify 토큰 즉시 삭제**(users는 익명화만 하므로 FK CASCADE 미발동, 명시 삭제 필요) (`UserProfileController.java:209-234`).
- **연결**: 주입 = `UserRepository`, `SpotifyAuthRepository`, `@Value` 호스트 패턴 CSV. 호출자 = 프론트 ProfileEditModal/회원가입 아바타/MY 탭(MEMORY v2.16-P1~P4, v2.17-A 탈퇴, v2.21-S14 Spotify 토큰 삭제).
- **특이사항**: `requireAuthenticatedUserId`는 미인증 시 `SecurityException` throw(GlobalExceptionHandler가 403 변환). `checkNickname`은 미인증도 허용(userId null이면 본인 제외 로직만 skip). 아바타 업로드는 확장자+MIME 이중 화이트리스트지만 **실제 파일 매직넘버 검사는 없음**(MIME 헤더 위조 여지). avatarDir은 `user.dir/uploads/avatar`로 고정.

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/MyPageController.java` — 마이페이지 요약(IDOR 가드 포함)

- **책임**: `/api/mypage/{userId}` 단일 GET. 마이페이지 요약(프리미엄/확성기/스탬프 수 등) 반환. 로직은 `MyPageService`에 위임하고 컨트롤러는 URL 매핑 + 본인 검증만 담당.
- **핵심 로직**:
  - `getMyPageInfo` — `requireSelf` 통과 후 `myPageService.findMyPageData(userId)` (`MyPageController.java:32-37`).
  - `requireSelf` — 미인증(null/비인증/이름null) 시 `SecurityException("로그인이 필요합니다")`, path userId가 토큰 본인과 불일치 시 `SecurityException("본인 정보만 조회할 수 있습니다")` (`MyPageController.java:40-49`).
- **연결**: 주입 = `MyPageService`. 예외는 `GlobalExceptionHandler` 전역 변환. 호출자 = 프론트 MY 탭.
- **특이사항**: 보안(v2.22) — 이전엔 검사가 없어 `/api/mypage/{타인ID}`로 IDOR 가능했음. `WishlistController`와 동일한 `requireSelf` 패턴(JavaDoc 명시).

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/TermsController.java` — 약관 버전 관리(현재버전/동의버전/재동의 필요여부 + 동의 저장)

- **책임**: `/api/v1/terms` 하위. `GET /status`(현재 약관버전+본인 동의버전+재동의 필요여부), `POST /accept`(동의버전을 현재로 갱신). 현재 버전은 환경변수 `popspot.terms.current-version`(기본 1.0)으로 관리.
- **핵심 로직**:
  - `getStatus` — 비로그인이면 `agreedVersion=null, needsReConsent=false`. 로그인 시 `user.getAgreedTermsVersion()` 조회 후 `needsReConsent = agreed==null || !agreed.equals(currentVersion)` (`TermsController.java:42-63`).
  - `accept` — `@Transactional`. `user.setAgreedTermsVersion(currentVersion)` 저장 + INFO 로깅, `{status:"ACCEPTED", version}` (`TermsController.java:65-77`).
- **연결**: 주입 = `UserRepository`, `@Value` currentVersion. 호출자 = 프론트 TermsReconsentModal(MEMORY v2.19-D 재동의 시스템, v2.20-B 프론트 모달).
- **특이사항**: 약관 개정 시 환경변수 값만 올리면(예 1.0→2.0) 전 사용자에게 재동의 모달 노출되는 설계. 미인증 status 조회는 허용, accept는 `requireAuthenticatedUserId`로 강제.

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/StampController.java` — 팝업 방문 스탬프 적립/조회(IDOR 가드)

- **책임**: `/api/stamps` 하위. `POST`(스탬프 적립), `GET /my`(내 스탬프 목록). userId는 항상 JWT에서만 추출.
- **핵심 로직**:
  - `addStamp` — `requireUserId(authentication)` + `@RequestParam popupId`로 `stampService.addStamp`. `IllegalArgumentException`(하루1회/동일팝업 중복 등 어뷰징 방어)만 메시지 노출해 400 (`StampController.java:31-42`).
  - `requireUserId` — 미인증/`anonymousUser`면 `SecurityException` (`StampController.java:50-58`).
- **연결**: 주입 = `StampService`(중복 적립은 서비스 unique 제약 차단). 호출자 = 프론트 팝업 방문/스탬프 화면.
- **특이사항**: 보안(v2.22) — 이전 `@RequestParam userId` 방식이라 비로그인 사용자가 남 ID로 스탬프/확성기 보상 임의 적립하는 IDOR가 있었음. 현재는 토큰에서만 추출.

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/GameController.java` — 티켓팅 시뮬레이션 게임(재고/예약/봇 압박 재현, IDOR 가드)

- **책임**: `/api/game` 하위. `POST /start`(재고 리셋+봇 비동기 발사), `POST /reserve`(예약 시도), `GET /stock`(재고 조회). 실제 티켓팅 압박감 재현용 시뮬레이션.
- **핵심 로직**:
  - `startSimulation` — `resetGame(itemId)` 후 `startSimulation(itemId)`로 봇 비동기 발사 (`GameController.java:30-35`).
  - `reserve` — `requireAuthenticatedUserId`로 토큰에서 userId 강제 추출 후 `attemptReservation(userId, itemId)`, `{result}` 반환 (`GameController.java:37-43`).
  - `getStock` — 재고 문자열 반환, null이면 `"0"` 폴백 (`GameController.java:45-49`).
- **연결**: 주입 = `TicketService`. 호출자 = 프론트 티켓팅 게임 화면.
- **특이사항**: 예약 userId를 토큰 subject에서 강제 추출(이전 `@RequestParam` 방식 IDOR 취약, JavaDoc 명시 — MEMORY 작업이력 v2.6/S2 GameController IDOR 차단과 일치). `/start`·`/stock`은 인증 없이 호출 가능(예약만 인증 강제).

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/OrderController.java` — 주문 완료 처리(서버 권위 값 재계산으로 스푸핑 방지)

- **책임**: `/api/orders/complete` 단일 POST. 굿즈 주문 완료 처리. 로직은 `OrderService.processOrder`에 위임.
- **핵심 로직**:
  - `completeOrder` — `@RequestBody OrderDto` + `Authentication`을 `orderService.processOrder(dto, authentication)`로 전달 (`OrderController.java:28-33`).
  - 내부 `OrderDto`는 하위호환용 필드를 두되 **서버가 무시하는 필드 명시** — `userId`(인증 컨텍스트로 식별), `goodsName`(DB 상품명 사용), `amount`(아임포트 조회 금액 사용). `merchantUid`는 "검증 후 서버 값 사용" (`OrderController.java:35-52`).
- **연결**: 주입 = `OrderService`. 호출자 = 프론트 결제 완료 콜백(아임포트 결제 후).
- **특이사항**: 클래스 단 `@PreAuthorize("isAuthenticated()")`. 스푸핑 방지를 위해 userId/금액/상품명을 클라이언트 값이 아니라 인증 컨텍스트+아임포트 서버+DB의 권위 값으로 재계산하는 것이 핵심 설계(JavaDoc). 실제 검증/재계산 로직은 `OrderService`에 있음(컨트롤러는 위임만).

#### `popspot-backend/src/main/java/com/example/popspotbackend/controller/GoodsController.java` — 굿즈 조회(팝업별/랜덤 픽업/팝업 선택 목록)

- **책임**: `/api/goods` 하위. `GET /{popupId}`(팝업별 굿즈), `GET /random`(메인용 랜덤 픽업), `GET /stores`(굿즈 등록 시 팝업 선택용 전체 팝업 목록).
- **핵심 로직**:
  - `getGoodsByPopup` → `goodsService.findByPopup(popupId)` (`GoodsController.java:24-27`).
  - `getRandomGoods` → `goodsService.findRandomPicks()` (`GoodsController.java:29-32`).
  - `getPopupStores` → `popupStoreService.findAll()`, 반환 타입 `List<PopupStore>` (`GoodsController.java:35-37`).
- **연결**: 주입 = `GoodsService`, `PopupStoreService`. 호출자 = 프론트 굿즈 조회 화면 + 굿즈 등록 페이지(팝업 선택).
- **특이사항**: 세 엔드포인트 모두 `@PreAuthorize`/인증 없음(공개 조회). `/stores`는 JavaDoc상 "굿즈 등록 페이지"용이지만 권한 가드가 없어 전체 `PopupStore` 엔티티 목록을 누구나 조회 가능(DTO 미적용·인증 미적용 — 등록은 관리자 기능일 가능성이 높아 노출 범위 검토 여지).

## B3 — 백엔드 · 컨트롤러 (팝업/음악/메이트/검색/기타)

#### `popspot-backend/.../controller/PopupStoreController.java` — 팝업스토어 공개 조회 + 제보/takedown 엔드포인트
- **책임**: `/api/popups` 하위의 팝업 목록/상세/트렌딩/검색/캘린더 조회와, 사용자 제보(`/report`) 및 권리자 takedown(`/{id}/takedown`) 접수를 담당. CORS는 `SecurityConfig` 전역 설정에 위임하므로 컨트롤러 단 `@CrossOrigin`을 두지 않는다(클래스 JavaDoc 27행).
- **핵심 로직**:
  - `getPopupById` (50-59): 서비스로 팝업 조회 후 `youTubeService.searchVideoId(popup.getName())`로 영상 ID를 얻어 `{data, imageUrl, videoId}` 맵으로 반환. 즉 상세 응답에 YouTube 검색이 동기적으로 결합됨.
  - `searchPopups` (67-72): keyword가 null/공백이면 빈 리스트를 즉시 반환(서비스 호출 회피).
  - `requestTakedown` (88-103): `findOrThrow`로 조회 → `applyTakedown`으로 `reviewStatus=TAKEDOWN`, takedown 시각/사유/요청자 세팅 → `save` → `log.warn`로 감사 로그. 실제 row 삭제가 아니라 노출 차단만 하고 admin 후속 조사로 넘김(악성 신고 방어, 28행).
  - `reportPopup` (107-116): `PopupReportRequestDto`(`@Valid`)에서 화이트리스트 필드만 뽑아 `buildReportedPopup`로 엔티티 생성 → Mass Assignment 방어. status=PENDING, viewCount=0 강제(147-148).
  - `buildReportedPopup`/`appendImageNote` (136-158): 제보 단계엔 imageUrl 필드가 없어 description 끝에 `"\n\n[제보 이미지] " + url` 메모로 남김(정식 등록은 admin이 PopupImage로 추가).
- **연결**: 주입 — `PopupStoreService`(조회/저장/캘린더/findOrThrow), `YouTubeService`(영상 검색). DTO — `CalendarPopupDto`, `PopupReportRequestDto`, `PopupTakedownRequestDto`. 피호출 — 프론트 팝업 목록/상세/캘린더/제보/신고 UI.
- **특이사항**: 상세 조회마다 외부 YouTube API를 호출하므로 키 한도/지연이 상세 응답 속도에 영향(단 YouTubeService가 실패 시 null 반환이라 장애 전파는 없음). takedown 응답 문구는 "24시간 내 검토"로 SLA를 명시.

#### `popspot-backend/.../controller/PopupMapController.java` — 지도 마커 경량 응답
- **책임**: `GET /api/map/markers` 하나만 제공. 노출 대상 팝업을 지도 핀 + 메인 BROWSE 섹션용 경량 DTO 리스트로 직렬화.
- **핵심 로직**: `getMapMarkers` (28-30)가 `popupStoreService.findVisibleMapMarkers()`를 받아 `toMarker`로 매핑. `MapMarkerResponse`(45-57)는 id/name/location/lat/lng + v2.21에 추가된 category/startDate/endDate를 담는 정적 내부 클래스. 좌표는 PopupStore의 String 그대로 직렬화.
- **연결**: 주입 — `PopupStoreService`. 피호출 — 프론트 지도 페이지 및 메인 BROWSE 슬라이스 카운트(지역/시점/카테고리 계산은 클라이언트에서 수행).
- **특이사항**: 모든 필드가 scalar라 Jackson lazy 직렬화/캐시 안전 문제가 없다는 점을 클래스 JavaDoc(16-18행)이 명시 — 엔티티 직접 노출 대신 DTO를 쓰는 의도된 설계.

#### `popspot-backend/.../controller/MusicController.java` — 음악 → 팝업 매칭 API
- **책임**: `/api/music` 하위의 곡 검색/자동완성/인기차트/재생+분위기매칭/룰렛/역추천/히스토리/카테고리/다음추천/재생실패마킹 전부를 라우팅. 입력 검증(query trim·길이상한, limit clamp)을 컨트롤러에서 직접 수행.
- **핵심 로직**:
  - 다수 limit 상수(32-46)로 엔드포인트별 default/max를 분리 관리. `clampLimit`(138-141)이 `[1, max]`로 강제.
  - `search`/`suggest`/`category` (51-106): `sanitizeQuery`로 정제 후 각각 `MusicService.searchTracks` / `SearchSuggestService.suggest` / `tracksForCategory` 호출.
  - `play` (72-76): `@AuthenticationPrincipal UserDetails`에서 `usernameOrNull`로 username 추출 → `musicService.matchPopups(trackId, username)` 호출, 반환 타입은 `MusicService.MatchResult`(내부 클래스).
  - `roulette` (78-81): 익명 허용(`usernameOrNull`이 null 가능) → `musicService.roulette`.
  - `history` (91-97): user가 null이면 빈 리스트, 아니면 `userHistory(username, limit)`.
  - `markPlaybackFailed` (120-124): 프론트 `useYouTubePlayer` onError(101/150 embed 차단, 100 비공개 등) 시 호출 → `recordPlaybackFailure`로 누적, 임계값 넘으면 검색 후보에서 자동 제외(116-119행 주석).
  - `sanitizeQuery` (129-136): null→"", trim, `MAX_QUERY_LENGTH=80` 초과 시 잘라냄(외부 API 부하 방어).
- **연결**: 주입 — `MusicService`, `SearchSuggestService`. 엔티티/타입 — `MusicTrack`, `UserMusicHistory`, `MusicService.MatchResult`, `MusicService.TrackMatch`. 피호출 — 프론트 음악 페이지 그리드/플레이어/룰렛/패스포트.
- **특이사항**: `play`/`roulette`/`history`의 인증은 선택적(미인증이면 username=null로 동작) — 인증 강제가 아니라 개인화 여부만 갈림.

#### `popspot-backend/.../controller/YouTubeService.java` — 팝업 이름으로 YouTube 영상 ID 검색 (controller 패키지에 위치한 @Service)
- **책임**: YouTube Data API v3 `search` 엔드포인트를 호출해 검색어(보통 팝업 이름)의 첫 영상 `videoId`를 반환. 키 미설정/에러/결과 없음이면 모두 `null` 반환(영상만 안 보일 뿐 서비스 정상).
- **핵심 로직**:
  - `searchVideoId` (40-55): `apiKey` 또는 `query`가 blank면 즉시 null(41) → `restTemplate.exchange`로 GET → 2xx 아니거나 body null이면 null(47-49) → `extractFirstVideoId`. 예외는 catch해서 `log.warn` 후 null(51-54) — 외부 장애가 호출부로 전파되지 않음.
  - `buildSearchUri` (57-67): `part=snippet&q=...&type=video&maxResults=1&key=...`를 `UriComponentsBuilder`로 조립 + `.encode()`(쿼리 인젝션/공백 안전).
  - `extractFirstVideoId` (69-73): Jackson으로 `items[0].id.videoId` 추출, 배열 비었으면 null.
  - `apiKey` 주입 (30-31): `@Value("${youtube.api-key:${YOUTUBE_API_KEY:}}")` — 프로퍼티 → 환경변수 → 빈 문자열 폴백 체인.
- **연결**: 호출자 — `PopupStoreController.getPopupById`(같은 패키지라 import 없이 참조 — 클래스 JavaDoc 19행이 이 위치 선정 이유를 설명). 의존 — 자체 생성한 `RestTemplate`/`ObjectMapper`(필드 직접 `new`, 빈 주입 아님).
- **특이사항**: `@RestController`가 아니라 `@Service`인데 controller 패키지에 둔 게 의도적. `RestTemplate`을 빈으로 안 받고 직접 생성 → 타임아웃 설정 없음(기본 무한 대기 가능성), 상세 조회 경로(`getPopupById`)에서 동기 호출되므로 외부 지연 시 응답 지연 소지.

#### `popspot-backend/.../controller/MateController.java` — 동행(메이트) 모집 게시판 REST API
- **책임**: `/api/mates` 하위 게시글 목록/채팅조회/생성/확성기(boost)상태/참여/삭제/신고를 라우팅. 비즈니스 로직(확성기 소비·정원 검사·자동 마감)은 `MateService`에 위임하고 컨트롤러는 결과 코드 → HTTP 변환만 담당.
- **핵심 로직**:
  - `joinMate` (63-71): `JoinResult` enum을 `switch`로 매핑 — `ALREADY_JOINED`→200 재입장 안내, `FULL`→400 "FULL", `JOIN_SUCCESS`→200.
  - `reportPost` (84-90): `mateService.reportPost`가 누적 신고 수를 반환 → `{status:REPORTED, reportCount:n}` 응답. 임계값 도달 시 자동 isHidden, 본인 글 신고 거부(서비스 측, 80-83행 주석).
  - `requireUserId` (96-104): **보안 핵심(v2.22)**. `Authentication`이 null/미인증/이름 null/`anonymousUser`면 `SecurityException`. 작성/참여/삭제/신고 주체를 JWT 토큰에서만 가져옴 — 이전엔 userId를 파라미터/바디로 받아 남 명의 글 작성·삭제·신고(자동숨김 어뷰징)가 가능했다(92-95행 주석).
  - 도메인 예외 매핑(108-116): `@ExceptionHandler`로 `BoostQuotaExceededException`→400, `AccessDeniedToPostException`→403.
- **연결**: 주입 — `MateService`. 엔티티/타입 — `MatePost`, `MateChatMessage`, `MateService`의 `JoinResult`/`BoostStatus`/`BoostQuotaExceededException`/`AccessDeniedToPostException`. 피호출 — 프론트 메이트 게시판 UI. 채팅 조회(`/{postId}/chat`)는 이 컨트롤러가 REST로, 실시간 송신은 `MateChatController`가 STOMP로 담당.
- **특이사항**: 신고 자동숨김 어뷰징을 막기 위해 신고 주체도 토큰 강제. `requireUserId`가 던지는 `SecurityException`은 글로벌 핸들러에서 401/403로 변환되는 구조(이 파일엔 핸들러 없음).

#### `popspot-backend/.../controller/MateChatController.java` — 메이트 게시글 실시간 채팅 (STOMP)
- **책임**: 메이트 게시글별 실시간 채팅 메시지 수신·영속화·브로드캐스트. `@Controller`(REST 아님)로 STOMP 메시지만 처리.
- **핵심 로직**: `sendMessage` (28-33): `@MessageMapping("/mate/chat/{postId}")` 수신 → `mateService.persistChatMessage(postId, message)`로 저장 → `messagingTemplate.convertAndSend("/sub/mate/chat/" + postId, saved)`로 구독자에게 전파. 프론트는 `/pub/mate/chat/{postId}`로 발행, `/sub/...` 구독(클래스 JavaDoc 15행).
- **연결**: 주입 — `SimpMessagingTemplate`(브로드캐스트), `MateService`(영속화). 엔티티 — `MateChatMessage`. 피호출 — STOMP 클라이언트(메이트 채팅창). 과거 메시지 로딩은 `MateController.getChatMessages`가 담당.
- **특이사항**: 영속화 결과(`saved`, 서버가 채운 id/timestamp 등)를 브로드캐스트하므로 모든 구독자가 동일 정규화 메시지를 받음.

#### `popspot-backend/.../controller/ChatController.java` — 팝업 상세 실시간 채팅 + 메인 티커
- **책임**: 팝업 방(roomId=popupId)별 실시간 채팅(STOMP)과, 채팅 히스토리/메인 티커(REST) 제공. `@RestController`지만 STOMP 메서드와 REST 메서드를 한 클래스에 혼합.
- **핵심 로직**:
  - `sendMessage` (30-35): `@MessageMapping("/chat/message/{roomId}")` + `@SendTo("/sub/chat/room/{roomId}")` — 수신 즉시 `chatService.saveMessage(roomId, sender, message)` 반환값을 해당 토픽으로 자동 전파(`MateChatController`와 달리 `@SendTo` 선언적 방식).
  - `getChatHistory` (37-40): `GET /api/chat/history/{roomId}` → `chatService.findChatHistory`.
  - `getRecentChats` (42-45): `GET /api/chat/ticker` → `chatService.findRecentTickerEntries()`로 `List<Map<String,String>>` 반환(메인 페이지 흐르는 티커).
  - `ChatMessageDto` (47-51): sender/message만 받는 입력 DTO.
- **연결**: 주입 — `ChatService`(영속화·티커 집계). 엔티티 — `ChatMessage`. 피호출 — 팝업 상세 채팅 STOMP 클라이언트 + 메인 티커 폴링.
- **특이사항**: `sender`를 클라이언트 DTO에서 그대로 받음(인증 토큰 기반이 아님) — 메이트 컨트롤러가 v2.22에서 토큰 강제로 바꾼 것과 대조적으로, 팝업 채팅 sender는 클라이언트 신뢰 입력.

#### `popspot-backend/.../controller/ChatFileController.java` — 채팅 첨부 이미지 업로드 (보안 집중)
- **책임**: `POST /api/chat/upload`로 멀티파트 이미지를 받아 크기/확장자/MIME 검증 후 UUID 재명명하여 `user.dir/uploads`에 저장, 공개 URL 반환. 다층 방어가 핵심.
- **핵심 로직**:
  - 인증 강제 (72-76): **보안(v2.22)** — null/미인증/`anonymousUser`면 401. 이전엔 누구나 업로드 가능해 디스크 채우기 DoS가 가능했다.
  - `validate` (104-128): 빈 파일 거부 → 크기 `>10MB` 거부 → `StringUtils.cleanPath` 후 `".."` 포함 거부(traversal) → 확장자 화이트리스트(jpg/jpeg/png/gif/webp) → contentType 화이트리스트(소문자 비교).
  - `prepareDestination` (137-149): uploads 디렉토리 보장 → `UUID + "." + ext` 파일명 → **canonical path 검증**: `dest.getCanonicalPath()`가 `uploadCanon + File.separator`로 시작하지 않으면 `SecurityException`(이중 traversal 방어, 145행).
  - `resolveHost` (164-175): **X-Forwarded-Host 스푸핑 방어** — 헤더가 `isAllowedHost`(정규식 화이트리스트) 통과 시에만 신뢰, 아니면 `log.warn` 후 컨테이너 `serverName`+포트로 폴백.
  - `isAllowedHost`/`compilePatterns` (182-200): 프로퍼티 `app.upload.allowed-host-patterns`(콤마 구분 정규식)를 생성자(61-64)에서 컴파일. 패턴 비어있으면 **어떤 헤더도 불신**(보수적, 183행). `Pattern.matches`는 전체 매칭이라 부분 일치 우회 없음(180행 주석).
  - `resolveScheme` (159-162): `X-Forwarded-Proto` 우선, 없으면 `request.getScheme()`. 포트 80/443은 URL에서 생략(172-174).
- **연결**: 의존 — `@Value` 프로퍼티(`allowed-host-patterns`), `HttpServletRequest`, `Authentication`. 외부 서비스 주입 없음(파일시스템 직접). 피호출 — 채팅 첨부 업로드 프론트. 저장 파일은 `/uploads/...` 정적 경로로 서빙되어 채팅 메시지에 URL로 삽입.
- **특이사항**: 확장자·MIME 화이트리스트와 canonical-path 검증을 **둘 다** 거는 다층 방어. 단 contentType은 클라이언트 헤더 기반이라 매직바이트 검사까지는 안 함(이미지로 위장한 폴리글랏 가능성은 잔존). 업로드 디렉토리가 `System.getProperty("user.dir")` 기준이라 실행 위치에 종속.

#### `popspot-backend/.../controller/CourseController.java` — AI 데이트 코스 추천
- **책임**: `GET /api/courses/recommend?vibe=...` 하나. vibe 키워드로 AI 생성 코스(`List<Map<String,Object>>`)를 반환.
- **핵심 로직**: `recommend` (21-24)가 `aiCourseService.recommendCourse(vibe)`로 위임만. 컨트롤러 자체 로직 없음.
- **연결**: 주입 — `AiCourseService`. 피호출 — 프론트 코스 추천 UI. 생성된 코스 저장은 `MyCourseController`가 담당(역할 분리).
- **특이사항**: 인증/입력 검증 없는 순수 공개 위임 컨트롤러.

#### `popspot-backend/.../controller/MyCourseController.java` — 내 코스 저장/조회/삭제 (IDOR 방어)
- **책임**: `/api/my-courses`에서 코스 저장(POST)/조회(GET)/삭제(DELETE). v2.9 보안으로 모든 엔드포인트가 토큰 userId와 요청 userId 일치를 검증, 불일치는 403.
- **핵심 로직**:
  - `saveCourse` (33-39): `requireSelf(auth, dto.getUserId())`로 본문 userId가 토큰 본인인지 검증 후 저장.
  - `getMyCourses` (41-49): `requireSelf(auth, userId)`(쿼리 파라미터) 검증 후 조회 결과를 `MyCourseResponseDto::fromEntity`로 매핑(엔티티 직접 노출 회피).
  - `deleteCourse` (51-56): `requireAuthenticated`로 토큰 username만 얻어 `deleteCourseAsOwner(courseId, username)`에 위임 — 소유권 검사는 서비스가 수행(컨트롤러는 인증만).
  - `requireSelf` (60-65): `requireAuthenticated`로 토큰 userId 획득 후 `requestUserId`와 불일치면 `SecurityException`.
  - `requireAuthenticated` (67-74): null/미인증/이름 null이면 `SecurityException`.
- **연결**: 주입 — `MyCourseService`. DTO — `CourseSaveRequestDto`(입력), `MyCourseResponseDto`(출력). 피호출 — 프론트 MY 탭 코스 카드.
- **특이사항**: 저장/조회는 컨트롤러에서 userId 일치 검증(`requireSelf`), 삭제는 courseId 기반이라 소유권을 서비스(`deleteCourseAsOwner`)로 내려 검증 — 두 가지 방어 위치가 섞여 있음. 무료 회원 1슬롯 제한은 서비스가 기존 코스 덮어쓰기로 처리(클래스 JavaDoc 24행).

#### `popspot-backend/.../controller/WishlistController.java` — 위시리스트 토글/조회 (IDOR 방어)
- **책임**: `/api/wishlist`에서 `POST /{userId}/{popupId}` 토글(ADDED/REMOVED 문자열 반환)과 `GET /{userId}` 조회. v2.9 보안으로 path의 userId가 토큰 subject와 일치할 때만 통과(불일치 403).
- **핵심 로직**:
  - `toggleWishlist` (27-34): `requireSelf(auth, userId)` 후 `wishlistService.toggleWishlist` 결과 문자열 그대로 반환.
  - `getMyWishlist` (36-41): `requireSelf` 후 `WishlistResponseDto` 리스트 반환.
  - `requireSelf` (44-53): null/미인증/이름 null이면 거부, 그리고 `authentication.getName()`이 path `userId`와 불일치면 거부 — 둘 다 `SecurityException`.
- **연결**: 주입 — `WishlistService`. DTO — `WishlistResponseDto`. 피호출 — 프론트 팝업 카드/상세의 위시 버튼, MY 탭 위시 목록. 위시 만료 메일 cron(v2.18.1-D)은 별도 모듈.
- **특이사항**: `MyCourseController`와 동일한 IDOR 방어 패턴이지만 userId가 query가 아니라 path variable. 토글 결과를 enum이 아닌 원시 문자열("ADDED"/"REMOVED")로 프론트에 노출.

#### `popspot-backend/.../controller/FeedbackController.java` — 사용자 의견 보내기
- **책임**: `/api/feedback`에서 의견 제출(POST, 게스트 허용)과 본인 의견 조회(`GET /me`, 로그인 필수)를 처리.
- **핵심 로직**:
  - `submit` (30-35): `authenticatedUserId`로 userId 추출(없으면 null) → `feedbackService.submit(dto, userId)`. 게스트는 userId=null로 저장, 로그인 사용자는 토큰 subject로 저장.
  - `getMine` (37-44): userId가 null이면 `SecurityException`(로그인 필수) → 아니면 `findMine(userId)`.
  - `authenticatedUserId` (47-55): null/미인증/이름 null/`anonymousUser`면 null 반환 — **예외를 던지지 않는 게 의도**(게스트 작성 허용, 46행 주석).
- **연결**: 주입 — `FeedbackService`. DTO — `FeedbackCreateRequestDto`(`@Valid` 입력), `FeedbackResponseDto`(출력). 피호출 — 프론트 `/feedback` 페이지 + MY 탭 카드. admin 답변/상태 변경은 별도 `AdminFeedbackController`.
- **특이사항**: 같은 헬퍼(`authenticatedUserId`)를 submit(null 허용)과 getMine(null이면 거부)에서 다르게 해석 — 한 메서드가 두 정책을 겸한다.

#### `popspot-backend/.../controller/SearchController.java` — Algolia 인덱스 동기화 트리거 (ADMIN 전용)
- **책임**: Algolia 검색 인덱스 재동기화를 트리거. 신규 `POST /api/admin/search/reindex`와 호환용 `GET /api/search/sync` 두 경로 제공, 둘 다 ADMIN 가드.
- **핵심 로직**:
  - `syncAll` (26-31): 호환용 옛 경로. `@PreAuthorize("hasRole('ADMIN')")` → `searchService.syncAllPopups()` → 문자열 반환.
  - `reindex` (34-39): v2.13 어드민 UI용. 동일 `syncAllPopups()`가 인덱싱한 row 수를 반환 → `{indexed:n}`. 인덱싱 가능 row만 push하고 부적격 row는 삭제(정확도/유효 가드를 인덱싱 시점 적용, 클래스 JavaDoc 15-17행).
- **연결**: 주입 — `SearchService`. 피호출 — 어드민 검색 관리 UI + 옛 운영 스크립트. `@RequestMapping`이 클래스에 없어 메서드마다 절대 경로 지정.
- **특이사항**: 두 엔드포인트가 같은 서비스 메서드를 호출하는 사실상의 별칭(반환 형태만 string vs JSON). ADMIN 권한은 `@PreAuthorize` 메서드 보안으로 강제.

#### `popspot-backend/.../controller/TrendController.java` — OOTD 트렌드 영상 추천
- **책임**: `GET /api/trends/ootd` 하나. Pexels 패션 영상 + 키워드 기반 한 줄 코멘트를 반환.
- **핵심 로직**:
  - `getOotd` (27-41): `pexelsService.getFashionVideo()` → null이면 `{type:OOTD, error:...}` 반환(여전히 200 OK), 아니면 `{type, data, comment}`.
  - `commentFor` (43-49): 영상 keyword(`street fashion`/`urban style`)에 따라 고정 코멘트 분기, 그 외 기본 코멘트(상수 21-23행).
- **연결**: 주입 — `PexelsService`. 피호출 — 프론트 트렌드/OOTD 위젯.
- **특이사항**: 외부 실패도 200 OK + error 필드로 응답(프론트가 상태코드 아닌 body로 분기). 코멘트는 성수동 맥락의 마케팅 카피로 하드코딩.

#### `popspot-backend/.../controller/CongestionController.java` — 서울 실시간 혼잡도 위임
- **책임**: `GET /api/congestion?area=...` 하나. 지역 키를 받아 서비스로 위임(기본값 `SEONGSU`).
- **핵심 로직**: `getCongestion` (21-25)가 `congestionService.getCongestionData(area)`를 그대로 반환(`Map<String,Object>`). `@RequestParam` default가 상수 `SEONGSU`.
- **연결**: 주입 — `CongestionService`. 피호출 — 프론트 혼잡도 위젯(메인/팝업 상세).
- **특이사항**: 순수 위임. 응답 래핑 없이 서비스 맵을 그대로 직렬화.

#### `popspot-backend/.../controller/PlanningController.java` — 일정 협업 룸 (실시간 마커 + 1인1표 투표, Redis 백엔드)
- **책임**: 일정 협업 룸의 방 생성/상태조회(REST)와 마커 add/remove/clear/join, 1인 1표 토글 투표(STOMP)를 처리. 상태는 전부 Redis에 TTL 3시간으로 저장. `@RestController`에 STOMP 메서드 혼합.
- **핵심 로직**:
  - Redis 키 구조(클래스 JavaDoc 27-30행): `plan:room:{roomId}:markers`(List)/`:users`(Set)/`:votes`(Hash 카운트)/`:voters:{placeId}:{voteType}`(Set 중복방지)/`plan:session:{sessionId}`(세션→roomId/sender). 모든 키 TTL 3h.
  - `createRoom` (51-58): UUID 앞 8자(`ROOM_ID_LENGTH`)를 roomId로, `:exist` 키를 TTL 3h로 set.
  - `getRoomState` (60-68): markers(List range 전체)/users(Set members)/votes(Hash entries)를 모아 `RoomState` 반환.
  - `handleAction` (70-84): `@MessageMapping("/plan/{roomId}/action")` — type별 `appendMarker`/`removeMarker`/`clearMarkers`/`registerJoin` 분기 후, **무조건** 원본 action을 `/topic/plan/{roomId}`로 브로드캐스트(83). 알 수 없는 type은 로깅만 후에도 브로드캐스트됨.
  - `handleVote` (87-109): voterLogKey로 `hasUserVoted` 판정 → 이미 투표면 `cancelVote`, 아니면 `castVote` → TTL 연장 → `VoteMessage`(갱신 카운트) 브로드캐스트. 1인 1표 토글(같은 사람 재클릭 시 취소, 86행).
  - `cancelVote` (153-162): **Redis increment가 음수 허용이라** 카운트가 0 미만이면 "0"으로 되돌려 0L 반환(언더플로 방어, 152행 주석).
  - `registerJoin` (125-139): users Set에 sender 추가 + TTL 연장, sessionId 있으면 `plan:session:{sessionId}` = `roomId/sender` 저장(세션 종료 시 정리용 추정).
  - DTO 4종(171-204): `PlanAction`/`RoomState`/`VoteRequest`/`VoteMessage`.
- **연결**: 주입 — `SimpMessagingTemplate`(브로드캐스트), `StringRedisTemplate`(상태). 피호출 — 프론트 일정 협업 페이지(STOMP 발행 + REST 상태 폴링). `SESSION_KEY_PREFIX`가 `public`이라 세션 disconnect 핸들러(다른 모듈)가 참조할 가능성.
- **특이사항**: 룸/투표에 인증 가드가 전혀 없음 — roomId(UUID 8자)만 알면 누구나 마커/투표 조작 가능(공유 협업 특성상 의도된 무인증 설계로 보이나, sender도 클라이언트 입력이라 1인1표가 sender 위조로 우회 가능). 마커 remove는 값 기반 `remove(key, 1, data)`라 동일 마커 문자열이 중복일 때 하나만 제거.

#### `popspot-backend/.../controller/TmapController.java` — TMAP 보행자 경로 프록시
- **책임**: `POST /api/tmap/route`로 출발/도착 좌표를 받아 SK TMAP 보행자 경로 API를 호출하고, LineString 좌표를 `[{lat,lng}]` 리스트로 가공해 반환. AppKey를 서버에서만 보관(프록시 목적).
- **핵심 로직**:
  - `getPedestrianRoute` (38-57): `buildRouteBody`+`buildHeaders`로 POST → `parseRouteCoordinates`. `HttpClientErrorException`은 status/body 로깅 후 빈 리스트, 그 외 예외도 로깅 후 빈 리스트(53-56) — 실패를 빈 경로로 흡수.
  - `buildHeaders` (59-64): `appKey` 헤더에 `tmapAppKey`(@Value `tmap.app-key`) 주입 + JSON content-type.
  - `buildRouteBody` (66-77): startX=lng/startY=lat 등 TMAP 좌표 규약(경도=X, 위도=Y)으로 매핑, `reqCoordType`/`resCoordType`=WGS84.
  - `parseRouteCoordinates` (79-97): `features` 없으면 빈 리스트 → 각 feature의 geometry가 `LineString`인 것만 → coordinates를 `[경도, 위도]`로 받아 `new Point(coord.get(1), coord.get(0))`로 **lat/lng 순서 뒤집어** 저장. 다수 `@SuppressWarnings("unchecked")` 캐스팅.
  - DTO — `RouteRequestDto`(start/end lat·lng, 99-105), `Point`(lat/lng, 107-116).
- **연결**: 의존 — `@Value tmap.app-key`, 자체 생성 `RestTemplate`(빈 아님). 피호출 — 프론트 코스/지도의 도보 경로 그리기.
- **특이사항**: TMAP의 `[X=lng, Y=lat]` 좌표 순서를 응답에서 `Point(lat, lng)`로 스왑하는 부분이 좌표 버그가 나기 쉬운 지점(93행). `RestTemplate` 타임아웃 미설정. 좌표 외 입력 검증 없음 — 잘못된 좌표는 TMAP가 거절하면 빈 리스트로 흡수. 인증 가드 없는 공개 프록시이므로 AppKey 비용이 외부 호출량에 노출(rate limit 별도 필요).

크로스컷 관찰:
- **인증 패턴 3종 공존**: (1) JWT 토큰 강제 + IDOR 검증(`MateController`/`MyCourseController`/`WishlistController`/`ChatFileController`, 모두 `SecurityException` throw), (2) 선택적 인증(`MusicController` play/roulette/history, `FeedbackController` submit — 미인증이면 username=null로 동작), (3) 무인증 공개(`CourseController`/`CongestionController`/`TrendController`/`TmapController`/`PlanningController`/`PopupMapController`/`ChatController`의 STOMP sender).
- **`SecurityException`은 이 컨트롤러들에서 직접 잡지 않고** 글로벌 핸들러(`GlobalExceptionHandler`, 본 모듈 외)에서 401/403로 변환되는 전제. `MateController`만 자체 `@ExceptionHandler`로 boost/access 도메인 예외를 추가 처리.
- **STOMP 채팅 2종 패턴 차이**: `ChatController`는 `@SendTo` 선언적 전파, `MateChatController`는 `SimpMessagingTemplate.convertAndSend` 명령적 전파.
- **외부 API 프록시 3종**(`YouTubeService`/`TmapController`/`TrendController`→Pexels)이 모두 실패를 null/빈값/error필드로 흡수해 장애 전파를 차단하지만, `YouTubeService`·`TmapController`의 `RestTemplate`에 타임아웃이 없어 외부 지연이 호출 스레드를 묶을 소지.

## B4 — 백엔드 · 음악 / Spotify 서비스

#### `popspot-backend/.../service/music/MusicService.java` — 음악→팝업 매칭 오케스트레이터(메인 진입점)

- **책임**: 검색·재생·추천·역방향 매칭의 전 과정을 지휘하는 음악 도메인의 중앙 서비스로, 다른 모든 music/spotify 하위 서비스를 묶어 "곡 메타 확보 → YouTube/iTunes 보충 → 무드 분석 → 팝업 점수 매칭"을 수행한다.
- **핵심 로직**:
  - 클래스 상단(`37~74`)에 매칭 점수 상수가 전부 모여 있다. 재생 실패 임계값 `PLAYBACK_FAILURE_THRESHOLD=3`(`47`), 폴백 점수 `FALLBACK_POPUP_SCORE=50`, 최대 점수 `MAX_MATCH_SCORE=100`, 태그 매칭 점수(음악→팝업 30 / 팝업→음악 25 / 유사도 20), 카테고리 보너스(FASHION+댄스 10 / CHARACTER+키치 15 / FOOD+카페 15).
  - `searchTracks` (`98~115`): 검색 그리드용. 먼저 `queryNormalization.normalize(query)`로 한글 검색어를 정규화(`102`)한 뒤 Spotify 검색. 주석에 따르면 정규화 서비스가 v2.21-S16 이전엔 만들어졌으나 호출되지 않아 한글 검색에 영어 제목 곡이 안 잡히던 버그가 있었다(`100~101`). 결과 곡마다 `findBySpotifyTrackId`로 DB 조회, 없으면 `upsertTrackMetaOnly`로 메타만 저장(`108~112`).
  - `matchPopups` (`118~134`): **재생 시점 핵심 메서드**. 3-tier 재생 준비를 순차 보강한다 — `ensureYoutubeVideoId`(122) → `ensurePreviewUrl`(123) → `ensureMoodTags`(124) → `incrementPlayCount`(125) → save(126). 그 후 무드 태그를 파싱(`128`)해 `matchByMood`로 상위 5개 팝업 매칭(129), 청취 기록 저장(131), `MatchResult` 반환.
  - `clearLikelyCoverCache` (`83~92`): 어드민용. `findLikelyNonOfficialCached()`로 cover/live/remix 의심 row를 찾아 `clearYoutubeCacheByIds`로 youtube_video_id를 NULL 초기화한다. 다음 재생 때 새 필터로 재매칭됨. `scanned`/`cleared` 카운트 맵 반환.
  - `recommendNext` (`165~186`): 시드 곡 무드와 겹치는 정도로 다음 곡 추천. 시드 무드가 비면 `popular(limit)`로 폴백(170). 후보 풀(`RECOMMENDATION_CANDIDATE_POOL=200`)에서 시드 제외 + YouTube ID 보유 + `isPlaybackHealthy` 통과 + 유사도>0인 것만 정렬. **외부 API 미사용(DB만)**.
  - `recordPlaybackFailure`/`isPlaybackHealthy` (`192~201`): 프론트 YouTube IFrame onError가 호출하면 `incrementPlaybackFailed`로 카운터 증가. 누적 3회 이상이면 `isPlaybackHealthy`가 false가 되어 검색·추천 후보에서 자동 제외(null/0은 통과).
  - `matchTracksForPopup` (`204~217`): 역방향 매칭. 팝업 ID로 그 팝업과 어울리는 곡 N개. 후보 풀 `REVERSE_MATCH_CANDIDATE_POOL=500`.
  - 점수 산정부(`341~396`): `scorePopupAgainstMoods`는 팝업 텍스트(name+description+content 소문자) haystack에 무드 태그가 `contains`되면 태그당 점수 가산 + 카테고리 보너스, `MAX_MATCH_SCORE`로 상한. `calculateCategoryBonus`(376)는 특정 무드↔카테고리 조합에만 보너스. `similarityScore`(390)는 두 태그 리스트의 교집합 개수×20.
  - `parseTagsJson`/`serializeTags` (`411~426`): moodTags 컬럼을 JSON 배열 문자열로 직렬화/역직렬화. 예외 시 각각 빈 리스트/`"[]"` 반환(조용히 삼킴).
- **연결**:
  - **주입(의존)**: `SpotifySearchService`, `YouTubeMusicSearchService`, `ITunesPreviewService`, `MusicQueryNormalizationService`, `MusicMoodAnalysisService`, 그리고 `MusicTrackRepository`/`UserMusicHistoryRepository`/`PopupStoreRepository`. `ObjectMapper`는 직접 `new`(74).
  - **피호출**: 음악 컨트롤러(이 디렉토리 밖)가 검색/재생/룰렛/추천/역방향/히스토리 엔드포인트에서 호출할 것으로 보인다. `recordPlaybackFailure`는 프론트 IFrame 에러 콜백 경로.
- **특이사항**:
  - `matchPopups`가 `@Transactional`인데 그 안에서 `ensureYoutubeVideoId`/`ensurePreviewUrl`이 외부 HTTP(YouTube/iTunes)를 동기 호출한다. 외부 API 지연이 DB 트랜잭션을 잡고 있는 구조 — 느린 외부 응답이 커넥션을 오래 점유할 수 있다.
  - `ObjectMapper`를 필드에서 `new`로 생성(74) — Spring 빈 재사용 대신 인스턴스 생성. 동작엔 문제없으나 일관성 측면에서 주의.
  - `roulette`는 무드 있는 곡 풀이 비면 `IllegalStateException`을 던진다(`142~145`).

#### `popspot-backend/.../service/music/SpotifySearchService.java` — Spotify 검색 클라이언트 + 한국어 5단계 폴백

- **책임**: Spotify Client Credentials Flow로 앱 토큰을 발급·캐시한 뒤 `/v1/search`로 곡 메타데이터를 조회하고, 한국어 검색은 5단계 폴백과 관련도·인기도 재정렬을 적용해 정확도를 끌어올린다.
- **핵심 로직**:
  - `search` (`75~93`): 진입점. 무효 쿼리(2자 미만)·credentials 미설정 시 빈 리스트. 토큰 확보 후 `containsHangul`이면 `searchKoreanWithFallback`, 아니면 단일 `callSearch`. 마지막에 `rerankByRelevance`로 재정렬(92).
  - `searchKoreanWithFallback` (`106~120`): **한국어 5단계 폴백의 핵심**.
    - ① KR 마켓 직접 검색(107) → `isStrongMatch`면 즉시 반환(108).
    - ② `searchViaAiNormalization`(110): AI 정규화 후 글로벌 검색 → strong이면 반환.
    - ③ `searchViaSuggestion`(113): YouTube Suggest 추천 표기로 재검색 → strong이면 반환.
    - ④ 원본 한국어 글로벌 검색(116).
    - ⑤ `mergeResultsWithPriority`로 ai→suggested→kr→global 우선순위로 중복 제거 병합(118).
  - `searchViaAiNormalization` (`122~126`): `queryNormalizer.normalize`. 정규화 결과가 원본과 같으면(대소문자 무시) 빈 리스트로 스킵 — 변환 안 됐으면 굳이 재검색 안 함.
  - `searchViaSuggestion` (`132~146`): Suggest 후보 최대 3개(`SUGGESTION_CANDIDATE_LIMIT`)를 돌며, 각 후보로 검색해 원본 쿼리 또는 후보 자체에 strong match면 반환.
  - `mergeResultsWithPriority` (`148~163`): `@SafeVarargs`. `HashSet`으로 spotifyId 중복 제거하며 limit까지 모아 반환.
  - `isStrongMatch`/`matchesTrackOrArtist` (`169~192`): 결과 중 한 곡이라도 trackName/artistName에 쿼리가 포함되면 true. 공백 제거한 compact 비교도 병행(띄어쓰기 차이 무시).
  - **토큰 관리** (`233~272`): `ensureAccessToken`은 `synchronized`. `isCachedTokenValid`(248)는 만료 30초 전(`TOKEN_REFRESH_SAFETY_SECONDS`)까지만 유효 판정. `requestNewAccessToken`(255)은 Basic 인증(`encodeBasicCredentials`, clientId:clientSecret을 Base64) + `grant_type=client_credentials`로 POST. 발급 실패 시 null.
  - `parseTrack` (`279~295`): Spotify item → `SpotifyTrack`. `parseArtwork`(375)는 images 배열 0번을 hires(640), 1번을 thumb(300)로 가정. `parsePreviewUrl`(390)은 null 노드면 Java null 반환.
  - `rerankByRelevance`/`scoreTrack` (`311~362`): 재정렬 산식 — popularity(0~100) 기본점 + trackName 전체일치 +30 + artistName 전체일치 +20 + 모든 토큰 분포 시 +50. 동점이면 popularity 높은 곡 우선.
  - `containsHangul`/`isHangulCodePoint` (`407~419`): 가-힣(0xAC00~0xD7A3), 자모(0x1100~0x11FF), 호환 자모(0x3130~0x318F) 범위로 한글 판정.
- **연결**:
  - **주입**: `SearchSuggestService`(폴백 ③), `MusicQueryNormalizationService`(폴백 ②). `RestTemplate`/`ObjectMapper`는 직접 `new`(61~62). clientId/secret은 `@Value("${spotify.client-id:}")`/`${spotify.client-secret:}`.
  - **피호출**: `MusicService.searchTracks`. 내부 DTO `SpotifyTrack`(433~447)이 `MusicService`로 흘러간다.
- **특이사항**:
  - 이 서비스의 `spotify.client-id`/`spotify.client-secret`(앱 검색용 Client Credentials)은 OAuth용 `spotify.oauth.client-id`(SpotifyOAuthService)와 **별개 프로퍼티**다. 혼동 주의.
  - `searchKoreanWithFallback`는 최악의 경우 KR + AI정규화 + Suggest후보 3회 + 글로벌 = 다수의 외부 호출이 직렬로 일어날 수 있다(레이턴시 비용).
  - 토큰 캐시는 인스턴스 메모리(`volatile` 필드)라 서버 재시작·다중 인스턴스 시 각자 재발급.

#### `popspot-backend/.../service/music/YouTubeMusicSearchService.java` — YouTube Data API v3 영상 ID 검색 + 공식음원 5단계 검증

- **책임**: Spotify 메타(아티스트+트랙)로 YouTube에서 IFrame 재생용 video ID를 찾되, 제목 기반 5단계 신뢰도 검증과 비공식 키워드 필터로 cover/live/remix 등 비공식 영상이 박히는 것을 차단한다.
- **핵심 로직**:
  - `NON_OFFICIAL_KEYWORDS` (`51~131`): 비공식 변형 차단 키워드 대량 배열. v2.14에 cover/live/remix/acoustic 계열, v2.21-S9에 단독 악기(piano/violin/오르골)·템포 변형(slowed/nightcore/8d/lofi)·자장가/가이드/짧은 클립(snippet/teaser/shorts)·클래식 편곡(arrangement/tutorial) 등 추가. 주석(`46~49`)에 "live" 같은 broad 키워드가 정상 발매곡("Live in London (Official)")까지 차단할 위험을 **정확도 우선 정책으로 의도적 수용**했다고 명시.
  - `searchOfficialAudio` (`147~174`): 주 경로. API키 미설정/quota 차단 중이면 즉시 null. 검색 → `pickBestByTitle`로 최적 영상 선택. `HttpClientErrorException.Forbidden`(403) 잡으면 `blockOnQuotaExceeded`(168).
  - `searchMusicOnly` (`187~209`): Spotify가 못 찾는 한국 인디 곡용 폴백. 검색어에 " 노래" 접미사 추가(191) + `videoCategoryId=10`(음악) 강제 + `pickMusicalCandidate`로 음악성 신호 있는 영상만 채택.
  - `buildSearchUrl` (`225~239`): `part=snippet&type=video&videoEmbeddable=true&maxResults=10`. **`videoEmbeddable=true`는 IFrame 재생 필수**(222). `forceMusicCategory`면 `videoCategoryId=10` 추가. 한글이 percent-encode 안 되어 400나는 걸 막으려 `.encode(UTF_8)` 명시(218~219).
  - **Quota 차단**(`260~271`): `quotaExhaustedUntil`(volatile) — 403 받으면 `blockOnQuotaExceeded`가 현재+12시간(`QUOTA_BLOCK_HOURS`)으로 설정. `isQuotaCurrentlyBlocked`가 true면 모든 검색 즉시 null 반환해 로그 폭격·헛호출 방지. **서버 메모리에만 유지, 재시작 시 초기화**(139).
  - `pickBestByTitle` (`289~329`): **5단계 신뢰도 검증**. 모든 단계가 `!isNonOfficialVariant(item) &&` 조건을 먼저 건다.
    - 아티스트·트랙 둘 다 없으면 그냥 items.get(0)(292).
    - ① 제목에 아티스트 AND 트랙 둘 다 포함(`isArtistAndTrackInTitle`, 294~302).
    - ② 공식 채널 + 제목에 트랙 포함(`isOfficialWithTrack`, 303~311).
    - ③ 공식 채널만(`isOfficialItem`, 313~316).
    - ④ 제목에 트랙명 포함(318~323).
    - ⑤ 제목에 아티스트명 포함 — 마지막 보루(324~327). 어느 단계도 못 통과하면 null.
  - `isNonOfficialVariant` (`337~345`): 제목 소문자에 비공식 키워드 하나라도 `contains`면 true.
  - `isOfficialChannel` (`402~409`): 채널명이 "- TOPIC"로 끝나거나 VEVO/OFFICIAL 포함, 또는 채널명이 아티스트명과 정확히 일치하면 공식으로 판정. `hasMusicalChannelKeyword`(359)는 추가로 RECORDS/ENTERTAINMENT까지 음악성 신호로 인정.
  - `containsLoose`/`normalize` (`426~435`): 소문자화 + 공백·따옴표·괄호·구두점 제거 후 부분일치. "Super Shy"가 "NewJeans 'Super Shy' (MV)"에 있는지 인식.
- **연결**:
  - **주입**: `RestTemplate`/`ObjectMapper` 직접 `new`(133~134). `youtube.api-key`는 `@Value`(136).
  - **피호출**: `MusicService.ensureYoutubeVideoId`가 `searchOfficialAudio`를 호출(반환 `YouTubeVideo`의 videoId/channelTitle/isOfficial을 트랙에 저장). `searchMusicOnly`는 **이 디렉토리(music/spotify) 내에서는 호출처가 보이지 않음** — 외부(다른 패키지)에서 쓰이거나 미사용일 수 있다. 확인 못 함.
- **특이사항**:
  - 비공식 키워드 필터가 과차단(false negative)을 일으킬 수 있음은 코드 주석이 인정한 알려진 트레이드오프. 정상 공식 라이브 음원이 누락될 수 있다.
  - quota 차단 상태가 인스턴스 메모리라 다중 인스턴스 배포 시 인스턴스별로 따로 차단됨.

#### `popspot-backend/.../service/music/ITunesPreviewService.java` — iTunes Search API로 미리듣기(preview_url) 보충

- **책임**: Spotify가 2024-11부터 신규 앱에 null로 막은 `preview_url`을, Apple iTunes Search API(무료·키 불필요)로 아티스트+트랙명 검색해 90초 미리듣기 직링크를 보충한다.
- **핵심 로직**:
  - `findPreviewUrl` (`40~68`): 진입점. artist·track 둘 다 비면 null(41). `"artist track"` term으로 iTunes 검색 URL 구성(`media=music&entity=song&limit=5`, `43~52`). 응답을 `readTree`해 `results` 배열에서 `pickBest`로 최적 곡 선택, 그 곡의 `previewUrl` 반환. 예외 시 `log.warn` 후 null(64~67).
  - `pickBest` (`71~86`): preview가 있는 항목 중 아티스트·트랙명이 `containsLoose`로 둘 다 매칭되는 첫 항목 우선 반환. 정확 매칭 없으면 preview 있는 첫 결과(`firstWithPreview`, iTunes 자체 정렬 신뢰).
  - `containsLoose`/`normalize` (`88~95`): 소문자화 + 공백·따옴표·괄호·구두점 제거 후 부분일치. (YouTubeMusicSearchService의 동명 메서드와 사실상 동일 로직 — 코드 중복.)
- **연결**:
  - **주입**: `RestTemplate`/`ObjectMapper` 직접 `new`(30~31). 외부 키·프로퍼티 없음.
  - **피호출**: `MusicService.ensurePreviewUrl`이 재생 직전 lazy 호출(한 번 채우면 DB 캐시).
- **특이사항**:
  - `normalize`의 정규식 `[\\s'\\\"`()\\[\\].,!?·\\-_/]`은 `YouTubeMusicSearchService.normalize`와 동일 — 두 파일에 같은 로직이 복제돼 있다.
  - iTunes도 결과 0건이거나 매칭 실패하면 null을 반환해 해당 트랙은 그대로 YouTube 폴백으로 남는다(주석 18~19).

#### `popspot-backend/.../service/music/MusicQueryNormalizationService.java` — 한국어 검색어 → Spotify 친화 표기 LLM 정규화

- **책임**: 한국어 가수/곡 검색어를 Spotify가 잘 매칭하는 영문 정식 표기(뉴진스→NewJeans, 데이식스→DAY6)로 LLM을 통해 변환하고, 같은 입력은 메모리 캐시해 재호출을 막는다.
- **핵심 로직**:
  - `SYSTEM_PROMPT` (`35~57`): 변환 규칙(한 줄·문장부호 금지, 가수명 영문 정식 표기, 곡명 한국어면 "가수영문+곡한국어", 모호하면 입력 그대로) + 예시 10여 개를 박은 프롬프트.
  - `normalize` (`63~73`): blank면 그대로 반환. `normalizationCache`(ConcurrentHashMap) 조회 후 hit면 즉시 반환. miss면 `requestNormalizationFromModel` 호출 후 캐시에 저장.
  - `requestNormalizationFromModel` (`75~86`): 프롬프트 + `"\n\n입력: " + query + "\n출력:"`를 `chatModel.generate(UserMessage.from(...))`로 전송(78). 응답을 `cleanResponse`로 정제, `isValidNormalization`(blank 아니고 80자 이하)이면 그 값, 아니면 원본 query. **예외 시 원본 query 반환**(82~85, fail-safe).
  - `cleanResponse` (`89~98`): trim → `stripOutputPrefix`("출력:"/"출력 :" 접두어 제거) → 따옴표(`["'\`]`) 제거 → 다중 공백 단일화 → `firstLineOnly`(첫 줄만).
- **연결**:
  - **주입**: `ChatLanguageModel chatModel`(LangChain4j). 캐시는 인스턴스 `ConcurrentHashMap`.
  - **피호출**: `MusicService.searchTracks`(검색 진입), `SpotifySearchService.searchViaAiNormalization`(한국어 폴백 ②). 두 곳에서 같은 인스턴스 캐시를 공유한다.
- **특이사항**:
  - 캐시가 무제한 증가(eviction 없음) — 고유 검색어가 매우 많아지면 메모리 누적 가능. 다만 한 줄 문자열이라 실질 부담은 작다.
  - LLM이 규칙을 어겨 80자 초과 응답을 주면 조용히 원본으로 폴백 → 안전하지만 정규화 실패가 로그 없이 묻힐 수 있다.

#### `popspot-backend/.../service/music/MusicMoodAnalysisService.java` — Groq LLM 무드 키워드 5개 추출(화이트리스트 강제)

- **책임**: 곡 메타데이터(아티스트/곡명/앨범)를 LLM에 보내 분위기 키워드 최대 5개를 뽑되, 사전 정의 화이트리스트(`ALLOWED_MOODS`) 안의 단어만 통과시켜 매칭의 결정성을 보장한다.
- **핵심 로직**:
  - `ALLOWED_MOODS` (`28~33`): "청량/여름/감성/빈티지/...키치/하이틴" 등 약 40개 고정 키워드. 같은 분위기가 "여름밤"/"한여름밤"처럼 변형돼 매칭이 비결정적이 되는 것을 막는 장치(주석 16~18).
  - `analyze` (`39~53`): `buildPrompt` → `chatLanguageModel.generate(prompt)` → `parseMoodTags`. 예외 시 `log.warn` 후 빈 리스트(매칭 폴백 유도).
  - `buildPrompt` (`55~76`): "후보 중에서만 5개 선택" + "JSON 배열만" 지시 + 예시 + 곡 정보를 텍스트 블록(`"""..."""`)으로 포맷. 앨범명 null이면 빈 문자열.
  - `parseMoodTags`/`extractJsonArray` (`82~101`): 응답에 잡설이 섞여도 첫 `[`~마지막 `]` 사이만 잘라(`extractJsonArray`, 95) JSON 파싱. start<0 또는 end<=start면 null.
  - `collectAllowedTags` (`103~112`): 배열 각 요소를 trim해 `ALLOWED_MOODS.contains` 통과한 것만 수집, `limit(MAX_TAGS=5)`.
- **연결**:
  - **주입**: `ChatLanguageModel chatLanguageModel`(Groq). `ObjectMapper` 직접 `new`.
  - **피호출**: `MusicService.ensureMoodTags`가 moodTags 비었을 때만 호출, 결과를 직렬화해 트랙에 저장.
- **특이사항**:
  - `MusicQueryNormalizationService`는 빈 필드를 `chatModel`로, 이 파일은 `chatLanguageModel`로 같은 타입을 주입받는다 — 같은 LangChain4j 빈을 쓰지만 필드명이 달라 검색 시 혼동 가능.
  - 화이트리스트 밖 키워드는 전부 버려지므로, LLM이 좋은 키워드를 줘도 후보에 없으면 누락 → 빈 리스트가 나오면 `MusicService`가 트렌딩 팝업 폴백으로 흐른다.

#### `popspot-backend/.../service/music/SearchSuggestService.java` — YouTube Suggest 자동완성 백엔드 프록시

- **책임**: 브라우저에서 CORS로 막히는 Google/YouTube Suggest 엔드포인트를 백엔드가 대신 호출해 검색어 자동완성 후보를 한글 깨짐 없이(UTF-8 강제) 받아오고, 음악성 키워드 기준으로 재정렬한 뒤 메모리 캐시한다.
- **핵심 로직**:
  - `SUGGEST_URL_PREFIX` (`38~40`): `client=firefox&hl=ko&oe=utf-8&ie=utf-8`. **`oe/ie=utf-8`이 한글 깨짐을 막는 핵심**(주석 35~37).
  - `suggest` (`54~75`): 무효 쿼리면 빈 리스트. 캐시 키는 `trim().toLowerCase()`. hit면 `capToLimit`. miss면 `fetchSuggestionsFromYouTube` → `sortByMusicalRelevance` → 비어있지 않으면 캐시 저장 후 limit 적용. 예외 시 빈 리스트.
  - `fetchSuggestionsFromYouTube` (`81~95`): `URLEncoder.encode` 후 **`URI.create`로 넘긴다** — String URL로 넘기면 Spring이 percent-encoded 값을 또 인코딩(`%EB`→`%25EB`)하는 걸 회피(주석 77~80). 응답을 `byte[]`로 받아 `decodeAsUtf8`.
  - `decodeAsUtf8` (`101~103`): `new String(rawBytes, UTF_8)`. RestTemplate의 String 변환이 charset 없으면 ISO-8859-1로 디코딩해 한글이 깨지는 걸 우회(주석 97~100).
  - `parseCandidatesArray` (`106~118`): 응답 구조 `["query", [candidates...], ...]`의 인덱스 1을 꺼냄. 배열 아니면 앞 200자 로그 후 빈 배열노드.
  - `sortByMusicalRelevance`/`calculateMusicalScore` (`130~146`): "노래"/"곡"=5, "가사"=3, "mv"/"m/v"=4, "audio"/"official"=4, "앨범"/"album"=2 점수 합산해 내림차순 **안정 정렬**(같은 점수면 원래 순서 유지).
- **연결**:
  - **주입**: `RestTemplate`/`ObjectMapper` 직접 `new`(50~51). 캐시는 인스턴스 `ConcurrentHashMap`.
  - **피호출**: `SpotifySearchService.searchViaSuggestion`(한국어 폴백 ③). 자동완성 API 컨트롤러(외부)도 직접 쓸 가능성.
- **특이사항**:
  - `suggestqueries.google.com` 비공식 엔드포인트 의존 — Google이 막거나 형식을 바꾸면 자동완성·Spotify 폴백 ③이 함께 무력화된다.
  - 캐시 eviction 없음(무제한 증가 가능).

#### `popspot-backend/.../service/music/ITunesSearchService.java` — 폐기된 빈 껍데기(deprecated)

- **책임**: V6에서 검색 소스가 iTunes→Spotify로 전환되면서 더 이상 쓰이지 않는, 호환을 위해 남겨둔 빈 final 클래스.
- **핵심 로직**: `@Deprecated` final 클래스 + private 생성자(`9~12`)만 존재. 메서드·필드 없음. JavaDoc에 "다음 정리 시 안전하게 제거 가능", `@see SpotifySearchService` 명시.
- **연결**: 어떤 것도 주입/호출하지 않음. (이름이 비슷한 `ITunesPreviewService`와 혼동 주의 — 미리듣기 보충은 그쪽이 담당, 이 파일은 죽은 코드.)

#### `popspot-backend/.../service/spotify/SpotifyOAuthService.java` — Spotify OAuth Authorization Code Flow + 토큰 자동 갱신

- **책임**: 사용자 개인 Spotify 계정을 OAuth Authorization Code Flow로 연결해 access/refresh token을 암호화 저장하고, 호출 시점에 만료 임박 토큰을 자동 refresh해 유효한 access token을 돌려준다.
- **핵심 로직**:
  - 상수/설정(`42~61`): `SCOPE = "streaming user-read-email user-read-private"`(45) — Web Playback SDK(streaming) + 사용자 식별 + Premium 여부. 주석에 "최소 권한 원칙"으로 그 외 scope 미요청 명시(35~36). `REFRESH_GRACE_SECONDS=60`. OAuth용 client-id/secret/redirect-uri는 `spotify.oauth.*` 프로퍼티(검색용과 별개).
  - `buildAuthorizationUrl` (`64~76`): `ensureClientConfigured` 후 authorize URL 생성. `response_type=code`, `state` 포함(CSRF 방어용, 호출자가 생성·검증), `show_dialog=false`.
  - `handleCallback` (`79~93`): **code→token 교환 + DB upsert**. `exchangeCode`로 토큰 받고 `fetchMe`로 Spotify 사용자 식별. 기존 row 있으면 갱신, 없으면 새 `SpotifyAuth`. **access/refresh 토큰을 `encryption.encrypt`로 암호화해 저장**(88~89). `expiresAt`은 now+expiresIn. `isPremium`은 me.product가 "premium"인지(91, 대소문자 무시).
  - `getValidAccessToken` (`100~123`): **토큰 자동 갱신 핵심**. row 없으면 "Spotify 미연결" 예외(104). `expiresAt`이 now+60초보다 뒤면 저장된 access token을 **복호화해 반환**(108). 만료 임박이면 refresh token 복호화(112) → `refreshAccessToken`(113) → 새 access token 암호화 저장 + expiresAt 갱신(115~116) → **refresh 응답에 새 refresh_token이 오면 그것도 갱신, 없으면 기존 유지**(118~120) → 평문 access token 반환.
  - `postToken` (`142~169`): 표준 `java.net.http.HttpClient` 사용(Spring RestTemplate 아님). Basic 인증(clientId:clientSecret Base64) + form body로 token endpoint POST. 200 아니면 응답 바디 로그 후 `IllegalStateException`. 응답에서 access/refresh/expires_in(기본 3600) 파싱해 `TokenResponse`.
  - `fetchMe` (`171~191`): `/v1/me`를 Bearer로 GET. id/email/product(기본 "free") 파싱.
- **연결**:
  - **주입**: `SpotifyAuthRepository repo`, `TokenEncryption encryption`. `HttpClient`(connectTimeout 10s)와 `ObjectMapper`는 직접 생성(59~61).
  - **피호출**: OAuth 콜백 컨트롤러(외부)가 `buildAuthorizationUrl`/`handleCallback`을 호출. Web Playback이 필요한 곳이 `getValidAccessToken`으로 사용자별 토큰을 받아간다. `TokenResponse`/`SpotifyMe`는 public record.
- **특이사항**:
  - `getValidAccessToken`이 `@Transactional`인데 그 안에서 refresh 시 외부 HTTP(`postToken`)를 동기 호출 — 외부 지연이 트랜잭션을 점유(MusicService와 동일 패턴).
  - `handleCallback`은 `state` 검증을 하지 않는다(파라미터로도 안 받음). **CSRF 방어용 state 생성·검증은 상위 컨트롤러 책임**으로 위임된 구조 — 이 서비스만 보면 state 검증이 없다는 점 주의.
  - access token을 복호화한 **평문**을 그대로 반환하므로 호출자가 로깅·노출에 주의해야 한다.
  - `postToken`이 비-200 응답 시 `res.body()`를 그대로 `log.warn`(158) — 토큰 엔드포인트 에러 바디에 민감정보가 들어갈 가능성은 낮으나 로그 노출 경로.

#### `popspot-backend/.../service/spotify/TokenEncryption.java` — AES-256-GCM 토큰 암복호화 유틸

- **책임**: Spotify access/refresh token을 AES-256-GCM(인증 암호화)으로 암복호화하며, 32바이트 키를 환경변수에서만 로드해 DB와 키를 분리한다.
- **핵심 로직**:
  - 상수(`28~35`): `AES/GCM/NoPadding`, GCM 태그 128비트, nonce 12바이트, 키 32바이트(AES-256). 키는 `spotify.token.encryption-key` 프로퍼티(Base64).
  - `init` (`40~57`): `@PostConstruct`. 키 미설정이면 **예외 없이 경고만 남기고 비활성**(keySpec=null) — "openssl rand -base64 32"로 주입하라고 안내(43~46). Base64 디코드 후 길이가 정확히 32바이트가 아니면 `IllegalStateException`(49~54).
  - `isEnabled` (`60~62`): keySpec != null. 컨트롤러/서비스가 키 미설정 시 503 판단에 쓰라는 용도.
  - `encrypt` (`65~80`): `ensureEnabled` → 매 호출 새 nonce 12바이트(`SecureRandom`) → GCM 초기화 → `doFinal` → **`out = nonce ‖ ciphertext+tag`로 prepend** → Base64. 실패 시 `IllegalStateException("토큰 암호화 실패")`.
  - `decrypt` (`83~97`): Base64 디코드 → 앞 12바이트=nonce, 나머지=ciphertext+tag로 분리(`87~90`) → GCM 복호화 → UTF-8 문자열. 실패 시 "토큰 해독 실패 (키 불일치 또는 변조)" 예외 — **GCM 인증 태그 불일치(변조)도 여기서 잡힌다**.
- **연결**:
  - **주입**: 없음(설정값만). `@Component`.
  - **피호출**: `SpotifyOAuthService`가 `encrypt`/`decrypt`로 토큰 저장·조회. `isEnabled`는 상위 컨트롤러가 503 게이팅에 사용할 수 있음.
- **특이사항**:
  - **보안 설계 양호**: nonce 매회 새로 생성(GCM nonce 재사용 금지 원칙 준수), 인증 암호화로 변조 감지, 키를 소스·.properties 기본값에 박지 않고 환경변수에서만 로드.
  - **키 분실 = 저장된 전 토큰 무효**(주석 22~23) — 사용자 전원 재연결 필요. 운영상 키 백업·로테이션 전략이 별도로 필요.
  - 키 미설정 시 빈 동작이 갈린다: `init`은 조용히 비활성화하지만, `encrypt`/`decrypt`를 그 상태로 호출하면 `ensureEnabled`가 "Spotify 기능 사용 불가" 예외를 던진다 — 즉 OAuth 미사용 시엔 부팅은 되고, 실제 토큰 작업에서만 실패.

## B5 — 백엔드 · 자동수집(크롤러) / 지오코딩

#### `service/crawler/PopupCrawlSource.java` — 외부 검색 API 1건의 원본(raw) 데이터를 담는 DTO
- **책임**: 네이버/카카오 검색 API가 돌려준 검색 결과 한 건(제목·요약·링크 등)을 그대로 담는 불변에 가까운 값 객체. 이후 LLM 정규화의 입력 단위가 된다.
- **핵심 로직**: 필드 5개뿐 — `sourceName`(예: `NAVER_BLOG`, `KAKAO_WEB` 같은 출처 코드), `title`, `description`, `link`, `postDate`. Lombok `@Data`(getter/setter) + `@Builder`만 붙어 로직은 없다.
- **연결**: `NaverPopupCrawler`/`KakaoPopupCrawler`가 `.builder()`로 생성하고, `PopupNormalizationService`와 `PopupCrawlOrchestrator`가 읽는다.
- **특이사항**: 클래스 주석에 "저작권/약관 회색지대 회피를 위해 검색 API가 주는 title/description/link만 쓰고 본문은 직접 스크래핑하지 않는다"는 설계 의도가 명시돼 있다. 즉, 이 DTO의 필드 구성 자체가 법적 안전장치다.

#### `service/crawler/NormalizedPopup.java` — LLM이 검색 snippet을 정리해 만든 구조화 결과 DTO
- **책임**: 여러 검색 snippet을 LLM이 "팝업스토어 1개"로 정규화한 결과를 담는다.
- **핵심 로직**: 필드 9개 — `name`, `location`, `category`, `startDate`, `endDate`, `description`, `content`, `confidence`(Double), `error`(String). Lombok `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor`. setter가 있어 후처리 단계에서 값이 덮어쓰기된다(아래 NormalizationService 참고).
- **연결**: `PopupNormalizationService.normalize()`가 생성/반환하고, `PopupCrawlOrchestrator`가 소비한다.
- **특이사항**: 주석에 "confidence 0.8 이상이면 자동 게시, 미만이면 admin 검수 큐로"라고 적혀 있으나 — 실제 Orchestrator 코드는 검수 큐를 쓰지 않고 임계값 미달 시 **즉시 폐기**한다(코드와 주석 불일치, 주석이 옛 정책을 반영). 카테고리는 FASHION/FOOD/CULTURE/CHARACTER/BEAUTY/TECH/ETC 중 하나, 날짜는 ISO `YYYY-MM-DD` 또는 null.

#### `service/crawler/NaverPopupCrawler.java` — 네이버 검색 API(블로그+뉴스) 수집 클라이언트
- **책임**: 주어진 검색어로 네이버 블로그/뉴스 검색 API를 호출해, 결과를 `PopupCrawlSource` 리스트로 변환한다.
- **핵심 로직**:
  - `Naver...:33-34` 엔드포인트 2개 상수(`blog.json`, `news.json`), `:39` 요청당 30건(`display=30`), `:40` `sort=date`(최신순).
  - `:43-47` 자격증명을 `@Value`로 주입 — `naver.client.id` / `naver.client.secret`. `RestTemplate`과 `ObjectMapper`는 `new`로 직접 필드 생성(스프링 빈 아님).
  - `:52-54` `isConfigured()` — id/secret 둘 다 non-blank여야 true.
  - `:64-81` `search()` 공통 메서드: 미설정이면 경고 로그 후 빈 리스트 반환(예외 안 던짐). 성공 시 응답 body를 트리 파싱해 `items` 노드만 추출 → 매핑. **try/catch로 모든 예외를 삼켜** 빈 리스트 반환(`:77-79`) — 즉 한 채널이 죽어도 파이프라인 전체는 계속 돈다.
  - `:83-95` `callApi()` — `UriComponentsBuilder`로 `query/display/sort`를 붙이고 `.encode()` 후 GET. 인증 헤더(`:97-103`)는 `X-Naver-Client-Id` / `X-Naver-Client-Secret` + 커스텀 User-Agent.
  - `:113-121` `toCrawlSource()` — `title/description/link`를 뽑고, `postDate`는 `postdate`(블로그) 우선 없으면 `pubDate`(뉴스)로 fallback(`:119`).
  - `:124-133` `stripHtml()` — 네이버가 응답에 끼워 보내는 `<b>...</b>` 등 태그를 정규식 `<[^>]*>`로 제거하고, `&quot; &amp; &lt; &gt; &nbsp;` 5개 HTML 엔티티를 디코드 후 trim.
- **연결**: 주입 없음(설정값만). `PopupCrawlOrchestrator.fetchSnippetsForKeyword()`가 `searchBlog`/`searchNews`를 호출하고, `isConfigured()`로 미설정 여부를 검사한다.
- **특이사항**: 무료 한도 25,000건/일(주석). 예외를 전부 로그+빈리스트로 흡수하므로 401/429 같은 인증·쿼터 오류도 조용히 0건이 되어 디버깅이 까다로울 수 있다. `stripHtml`의 엔티티 디코드는 명시된 5종만 처리(숫자 엔티티 `&#xxx;` 등은 미처리).

#### `service/crawler/KakaoPopupCrawler.java` — 카카오 검색 API(웹+블로그) 수집 클라이언트
- **책임**: 주어진 검색어로 카카오 다음(Daum) 웹/블로그 검색 API를 호출해 결과를 `PopupCrawlSource` 리스트로 변환한다. 구조가 `NaverPopupCrawler`와 거의 대칭이다.
- **핵심 로직**:
  - `Kakao...:33-34` 엔드포인트 `v2/search/web`, `v2/search/blog`. `:39` 요청당 30건(`size=30`), `:40` `sort=recency`(최신순).
  - `:43-44` API 키 주입이 특이 — `@Value("${kakao.rest.api-key:${kakao.api.key:}}")`: `kakao.rest.api-key`가 없으면 `kakao.api.key`로 fallback, 둘 다 없으면 빈 문자열(중첩 기본값 문법).
  - `:61-78` `search()` — 미설정이면 빈 리스트. 성공 시 응답에서 `documents` 노드 추출 후 매핑. 네이버와 동일하게 모든 예외를 catch해 빈 리스트로 흡수(`:74-77`).
  - `:80-92` `callApi()` — 쿼리 파라미터 `query/size/sort` 인코딩 후 GET. 인증 헤더(`:94-99`)는 `Authorization: KakaoAK {키}` 형식 + User-Agent.
  - `:109-117` `toCrawlSource()` — 카카오 응답은 필드명이 다름: `title`/`contents`(요약)/`url`(링크)/`datetime`(날짜)을 매핑.
  - `:119-128` `stripHtml()` — 네이버 것과 동일한 태그·엔티티 제거 로직(중복 구현).
- **연결**: 주입 없음. `PopupCrawlOrchestrator.fetchSnippetsForKeyword()`가 `searchWeb`/`searchBlog`를 호출, `areAllCrawlersUnconfigured()`가 `isConfigured()`를 검사. (참고: 좌표용 `KakaoApiService`/`KakaoGeocodingService`와는 별개의 클래스다 — 이 크롤러는 검색용.)
- **특이사항**: 무료 한도 30,000건/일(주석). `stripHtml` 로직이 NaverPopupCrawler와 글자 그대로 중복 — 공통 유틸로 추출되지 않은 약간의 기술부채.

#### `service/crawler/PopupNormalizationService.java` — 검색 snippet 묶음을 LLM에 넘겨 구조화 JSON으로 정규화
- **책임**: 동일 팝업 후보로 묶인 여러 snippet을 하나의 프롬프트로 LLM에 보내, 검증·정제된 `NormalizedPopup` 1개로 변환한다.
- **핵심 로직**:
  - `:26` 토큰 절약을 위해 snippet은 최대 8개(`MAX_SNIPPETS_PER_REQUEST`)만 사용.
  - `:31-34` 텍스트 길이 상한 — name 120 / location 200 / description 300 / content 2000자. 주석에 "HTML 태그 제거와 함께 저장형 XSS 2중 방어 + DB 보호"라 명시(v2.22).
  - `:41-74` **프롬프트 템플릿**(Java 텍스트 블록). LLM에게 ① JSON 한 개만(코드펜스/설명문 금지) ② 8개 필드 스펙 ③ confidence 가산 규칙(name 명확 +0.3, location 구 단위 +0.2, 시작·종료일 둘 다 +0.3, 출처 2개+ 동일정보 +0.1, 카테고리 +0.1) ④ 모호하면 error+confidence 0.0 ⑤ **서울이 아니면 confidence 0.0** ⑥ **개인정보 금지**(운영자 연락처·작성자 닉네임/실명·후기 작성자 인적사항 → "공식 SNS 참고"로 대체) ⑦ snippet 원문 베끼지 말고 재요약. 오늘 날짜와 snippet 텍스트를 `%s`로 주입.
  - `:80-96` `normalize()` 흐름: snippet null/empty면 `EMPTY_SNIPPETS` 에러 결과 즉시 반환 → `buildPrompt` → `chatLanguageModel.generate(prompt)`(LangChain4j `ChatLanguageModel`) → `parseJsonResponse` → `parseNormalizedPopup` → `applyPostValidations`. 전 과정을 try/catch로 감싸 LLM 실패 시 `LLM_ERROR: {메시지}` 에러 결과 반환(`:92-95`).
  - `:105-119` snippet 포맷팅 — `[출처] 제목 : 요약` 한 줄씩, `\n`으로 join(8개 limit).
  - `:122-125` `parseJsonResponse()` — LLM이 실수로 붙인 ```` ```json ```` / ```` ``` ```` 코드펜스를 정규식으로 제거 후 trim하고 트리 파싱(LLM 출력 방어).
  - `:127-139` `parseNormalizedPopup()` — 각 필드를 뽑되 name/location/description/content는 `sanitize()`로 정제, 날짜·error는 `nullableText()`로 null 보존, confidence는 `asDouble(0.0)` 기본값.
  - `:151-159` **후처리 검증** `applyPostValidations()` — LLM이 confidence를 잘못 줬을 때를 대비한 2중 안전망: name이 비면(`:161-163`) `EMPTY_NAME`, location에 "서울" 문자열이 없으면(`:165-167`) `NOT_IN_SEOUL`로 `forceRejection()`(`:169-174`) — confidence를 강제 0.0으로 깔고 error가 비어있을 때만 코드 세팅.
  - `:197-201` `sanitize()` — HTML 태그 정규식 제거 + 길이 상한 잘라내기(저장형 XSS 2차 방어).
- **연결**: `ChatLanguageModel`(LangChain4j 빈)을 주입받는다. `PopupCrawlOrchestrator.processNormalizationAndSave()`가 `normalize()`를 keyword 그룹마다 한 번씩 호출.
- **특이사항**: 개인정보·저작권 방어가 프롬프트 레벨(LLM 지시)과 코드 레벨(sanitize/길이상한)에 분산돼 있다. 단, "서울 외 거부"는 `location.contains("서울")` 문자열 매칭이라 — location이 비어있거나 null이면 통과(`:166`의 `!= null` 가드), 반대로 "서울식당"처럼 우연히 "서울"을 포함한 타지역명은 통과할 수 있는 약점이 있다.

#### `service/crawler/PopupCrawlOrchestrator.java` — 검색 → LLM 정규화 → 신뢰도 검증 → DB 저장 전체 파이프라인 지휘자
- **책임**: 4개 검색 채널 수집 → 키워드별 묶음 → LLM 정규화 → 신뢰도/중복 검증 → `PopupStore` 저장 + Algolia 인덱싱까지 자동수집 1회 실행을 조율한다.
- **핵심 로직**:
  - **레이트리밋 상수**(`:39-41`): 네이버/카카오 호출 간 800ms, Groq LLM 호출 간 2200ms(주석 "30 RPM=2초 간격"), 카카오 지오코딩 간 300ms.
  - `:47-48` 허용 카테고리 7종 Set. `:54-157` **검색 키워드 80여 개**(`SEARCH_KEYWORDS`) — 일반/지역(성수·강남·홍대 등)/백화점/K-패션/캐릭터·IP/애니·게임/K-뷰티/F&B/K-pop/럭셔리/카테고리로 분류. 주석에 "v2.13부터 80+개로 확장 — 정확도 임계값은 유지하면서 다양성을 늘려 자동게시 통과 row 수를 끌어올림".
  - `:159-164` 의존성 6개 주입: 두 크롤러, `PopupNormalizationService`, `PopupStoreRepository`, `GeocodingService`, `SearchService`.
  - `:166-171` 설정값: `confidence-threshold`(기본 0.8), `max-auto-published`(기본 0=무제한, 목표 도달 시 조기 종료용).
  - **`runOnce()`** (`:174-187`): 두 크롤러 다 미설정이면 `{skipped:1}` 반환 후 스킵. 아니면 `collectSnippetsByKeyword` → `processNormalizationAndSave` 순서로 실행하고 통계 맵 반환.
  - `:189-205` **`geocodeMissing()`**: `findCrawledMissingCoordinates()`로 좌표 없는 수집 row를 찾아 하나씩 `fillCoordinates`, 호출 사이 300ms sleep. admin/백필 cron이 호출.
  - `:213-223` **수집 단계** `collectSnippetsByKeyword()`: 키워드마다 4채널 fetch → `"kw:" + keyword` 키로 그룹화(`HashMap`), 키워드 사이 800ms sleep. `:225-232` `fetchSnippetsForKeyword()`가 네이버 블로그+뉴스, 카카오 웹+블로그를 순서대로 다 합친다.
  - `:236-254` **정규화+저장 단계** `processNormalizationAndSave()`: 그룹을 순회하며 (a) `shouldStopEarly`면 break, (b) 빈 그룹 skip, (c) **첫 호출 빼고 매번 2200ms sleep**(Groq RPM 스로틀), (d) `normalize()` 한 번 → `handleNormalizedResult`.
  - `:256-263` `shouldStopEarly()` — `maxAutoPublished>0`이고 자동게시 수가 목표 도달 시 true.
  - `:265-292` **`handleNormalizedResult()`** — 핵심 게이트: ① `isInvalidResult`(error 있음/confidence null/name 없음, `:294-299`)면 rejected++ ② confidence < threshold면 rejected++ (둘 다 폐기, 검수 큐 없음) ③ `computeExternalId`로 식별자 생성 ④ `markDuplicateAsSeen`이 true면 duplicates++ ⑤ 아니면 `saveNewPopup` + autoPublished++.
  - `:301-309` **중복 처리** `markDuplicateAsSeen()` — externalId로 기존 row 조회, 있으면 `lastSeenAt`만 현재시각으로 갱신 후 save하고 true(중복) 반환. 즉 같은 팝업이 재수집되면 "마지막 본 시각"만 touch.
  - `:311-353` **`saveNewPopup()`** — snippet 첫 건을 primary source로, `geocodingService.geocode(name, location)`로 좌표 시도(Optional). `PopupStore`를 빌더로 조립: viewCount 0, 좌표는 Optional map(없으면 null), `sourceType=CRAWLED`, sourceUrl/sourceName은 primary에서, externalId, **confidenceScore는 BigDecimal로 소수 2자리 반올림**(`:333-335`), crawledAt/lastSeenAt=now, `reviewStatus=AUTO_PUBLISHED`. save 후 `searchService.addPopup(saved)`로 **즉시 Algolia 푸시**하되 try/catch로 실패해도 경고만 남기고 진행(`:345-352`, v2.13 — 다음 주기까지 검색 누락되던 문제 해소).
  - `:357-366` `fillCoordinates()` — 좌표 backfill 단건 처리(geocode 성공 시 lat/lng set 후 save, 빈 결과면 false).
  - `:371-380` **`computeExternalId()`** — `SHA-256(name|location|startDate)`. name/location은 `normalizePart`(trim+lowercase), startDate는 `safeStr`(null→""). SHA-256 실패 시 `raw.hashCode()`의 hex로 fallback(`:377-378`). 이게 중복 판정의 키.
  - `:396-400` `safeCategory()` — 대문자화 후 허용 7종에 없으면 `ETC`로 강등.
  - `:402-408` `sleepQuietly()` — InterruptedException 시 interrupt 플래그 복원.
  - `:412-430` 내부 통계 클래스 `CrawlStatistics` — totalSnippets/normalized/autoPublished/pendingReview/duplicates/rejected를 `LinkedHashMap`(순서 보존)으로 직렬화. (`pendingReview`는 필드만 있고 항상 0 — 검수 큐 폐지 잔재.)
- **연결**: 호출하는 것 — 두 크롤러, normalizer, geocodingService, popupStoreRepository(findByExternalId/findCrawledMissingCoordinates/save), searchService.addPopup. 호출하는 쪽 — `PopupCrawlScheduler`가 `runOnce()`/`geocodeMissing()`을 cron으로 실행(admin 수동 호출도 주석상 존재).
- **특이사항**:
  - **클래스 레벨 `@Transactional` 미사용**(`:31-32` 주석): 크롤 1회가 1~2분이라 단일 거대 트랜잭션은 DB 커넥션을 너무 오래 점유 → 각 `save()`가 JPA 자동 트랜잭션 단위. 부작용으로 중간 실패 시 부분 커밋 상태가 남는다(의도된 트레이드오프).
  - 수집을 전부 메모리에 모은 뒤(`HashMap<String,List>`) 정규화 — 키워드 80개 × 채널 4개 × 최대 30건이면 수천 snippet이 힙에 상주.
  - `confidenceThreshold` 비교(`:272`)는 `getConfidence()`가 null이 아님을 `isInvalidResult`에서 먼저 보장하므로 NPE 안전.
  - 그룹 키가 `"kw:" + keyword`라 키워드별 1그룹·1정규화 — 서로 다른 키워드가 같은 팝업을 잡으면 externalId 중복으로 자연 병합된다.

#### `service/crawler/PopupCrawlScheduler.java` — 자동수집/백필 cron 트리거
- **책임**: 설정으로 on/off되는 스케줄러로, 하루 2회 자동수집과 1회 좌표 백필을 KST 기준 cron으로 돌린다.
- **핵심 로직**:
  - `:34-35` `popspot.crawler.enabled`(기본 false) 게이트 — 운영 환경에서만 켠다.
  - `:37-45` 수집 cron 2개: 오전(`cron`, 기본 `0 0 4 * * *`=04:00), 오후(`cron-afternoon`, 기본 16:00), 둘 다 `runIfEnabled` 호출.
  - `:48-61` `scheduledGeocodeBackfill()` — 기본 04:30(`geocode-backfill-cron`). disabled면 skip, 아니면 `orchestrator.geocodeMissing()` 실행, 예외는 error 로그로 흡수.
  - `:63-78` **`runIfEnabled()`** — disabled면 skip. 아니면 `orchestrator.runOnce()` 실행 후 **`popupStoreService.evictPopupCaches()`로 캐시 명시 evict**(`:71-73` v2.21-S3 주석: Orchestrator가 Repository.save()를 직접 부르므로 `@CacheEvict`가 안 터져, popups-visible/popups-hot 캐시를 수동으로 비워 BROWSE/지도를 즉시 갱신). 예외는 error 로그로 흡수.
- **연결**: `PopupCrawlOrchestrator`(runOnce/geocodeMissing)와 `PopupStoreService`(evictPopupCaches)를 주입. 스프링 `@Scheduled`가 호출.
- **특이사항**: 모든 cron 표현식·임계값·상한이 `application.properties`로 덮어쓰기 가능(클래스 주석에 설정키 목록 정리). 캐시 evict가 스케줄러 쪽에 있는 건 캐싱 추상화의 한계(직접 save 경로)를 우회한 의도적 처리.

#### `service/crawler/PopupExpireScheduler.java` — 만료 팝업을 매일 새벽 EXPIRED 처리하는 cron
- **책임**: 매일 05:00 KST에 종료일이 지난 팝업을 일괄 `EXPIRED` 상태로 바꾸고, 동시에 Algolia 인덱스에서 제거한다.
- **핵심 로직**:
  - `:33-34` `@Scheduled(cron="0 0 5 * * *", zone="Asia/Seoul")` + 메서드 레벨 `@Transactional`(여긴 짧은 일괄 UPDATE라 트랜잭션 OK — Orchestrator와 대조적).
  - `:36-37` 오늘 날짜를 ISO로 포맷해 `findToExpire(today)`로 만료 대상 조회.
  - `:39-42` 대상 없으면 debug 로그 후 조기 return.
  - `:44-46` 대상 id 리스트 추출 → `markExpired(targetIds)` 벌크 UPDATE, 갱신 건수 로그.
  - `:48-54` id마다 `searchService.removePopup(id)`로 Algolia에서 제거, 실패해도 경고만(개별 try/catch).
- **연결**: `PopupStoreRepository`(findToExpire/markExpired), `SearchService`(removePopup) 주입. `@Scheduled`가 호출.
- **특이사항**: 클래스 주석대로 **row를 물리 삭제하지 않는다**(이력/랭킹/방문기록 보존) — 캘린더·검색·랭킹 쿼리가 EXPIRED를 제외하므로 사용자에겐 사라진 것처럼 보임. Algolia 제거가 트랜잭션 커밋 이후가 아니라 같은 메서드 안 루프라, DB 트랜잭션이 롤백되면 인덱스만 먼저 지워진 불일치 가능성은 이론상 존재(다만 markExpired 직후라 실제 위험은 낮음).

#### `service/geocoding/GeocodingService.java` — 지오코딩 추상 인터페이스
- **책임**: "이름+위치 → 좌표" 변환을 외부 지도 API와 분리한 인터페이스. 실패 시 예외 대신 빈 `Optional`을 반환하는 계약을 정의한다.
- **핵심 로직**: 메서드 1개 `Optional<Coordinates> geocode(String name, String location)`. 주석에 "구현체는 이름이 비어있으면 위치만으로 fallback해야 한다"는 구현 요구사항을 명시.
- **연결**: `KakaoGeocodingService`가 구현, `PopupCrawlOrchestrator`가 이 타입으로 주입받아 사용.
- **특이사항**: 향후 Naver/Google로 교체하거나 합성하기 쉽도록 추상화한 설계(주석). 빈 Optional 계약 덕에 호출부가 fallback(좌표 null 저장)을 명확히 표현 가능.

#### `service/geocoding/Coordinates.java` — 위경도 좌표 값 객체(record)
- **책임**: latitude/longitude 한 쌍을 함께 전달하는 단순 컨테이너.
- **핵심 로직**: `record Coordinates(String latitude, String longitude)` — 좌표를 **문자열로** 보유.
- **연결**: `KakaoGeocodingService`가 생성, `PopupCrawlOrchestrator.saveNewPopup`/`fillCoordinates`가 `.latitude()`/`.longitude()`로 읽는다.
- **특이사항**: 주석대로 `PopupStore`가 좌표를 문자열로 저장하기 때문에 record도 String 형태를 그대로 노출(숫자 파싱·검증은 하지 않음 — 카카오 응답 값을 `String.valueOf`로 변환해 그대로 통과).

#### `service/geocoding/KakaoGeocodingService.java` — 카카오 로컬 키워드 검색 기반 지오코딩 구현체
- **책임**: 카카오 로컬 검색을 2단계(이름+위치 → 위치만)로 시도해 첫 결과의 좌표를 `Coordinates`로 돌려준다.
- **핵심 로직**:
  - `:28-30` 카카오 응답 필드 상수 — 경도 `x`, 위도 `y`, 결과 배열 `documents`.
  - `:34-52` **`geocode()`** — name/location을 `safeTrim`(`:80-82`, null→"") 후 ① `이름 위치` 합친 쿼리로 1차 `tryGeocodeOnce`, 성공이면 즉시 반환 ② 실패 시 **location이 비어있지 않고 합친 쿼리와 다를 때만** 위치 단독으로 2차 시도(`:44-46`). 전체를 try/catch로 감싸 어떤 예외든 빈 Optional로 흡수(`:48-51`).
  - `:55-78` **`tryGeocodeOnce()`** — 전부 방어적 파싱: 빈 쿼리면 empty(`:56`), `KakaoApiService.searchPopups(query)` 호출(`:58`), 응답 null이면 empty, `documents`가 List가 아니거나 비었으면 empty(`:61-64`, 패턴 매칭 instanceof), 첫 문서가 Map이 아니면 empty(`:66-67`), x/y 중 하나라도 null이면 empty(`:69-71`), 모두 통과하면 `new Coordinates(String.valueOf(y), String.valueOf(x))`(위도=y, 경도=x 순서 주의). 내부도 try/catch로 empty 흡수(`:75-77`).
- **연결**: `KakaoApiService`(검색 좌표 API 래퍼) 주입 + `GeocodingService` 구현. `PopupCrawlOrchestrator`가 신규 저장·백필 시 호출.
- **특이사항**:
  - **이중 try/catch + 단계별 instanceof 가드**로 카카오 응답 스키마가 바뀌거나 깨진 응답이 와도 절대 예외를 전파하지 않는다(주석 "응답 파싱은 모두 Map 단계에서 방어적으로").
  - 좌표 순서가 카카오 관례(x=경도, y=위도)를 정확히 반영 — `Coordinates(latitude=y, longitude=x)`. 여기를 바꾸면 지도 핀이 통째로 어긋난다.
  - 2차 fallback 조건 `!trimmedLoc.equals(combinedQuery)`는 이름이 비어 합친 쿼리가 곧 location과 같아질 때 동일 쿼리 재호출(쿼터 낭비)을 막는 최적화다.

**모듈 전체 데이터 흐름 요약**: `PopupCrawlScheduler`(cron, enabled 게이트) → `PopupCrawlOrchestrator.runOnce()` → [수집] `Naver/KakaoPopupCrawler`가 80여 키워드 × 4채널 검색 → `PopupCrawlSource` 수천 건을 키워드별로 그룹화 → [정규화] 그룹마다 `PopupNormalizationService.normalize()`가 LangChain4j LLM 호출(Groq 2.2s 스로틀) → `NormalizedPopup` → [검증] 신뢰도≥0.8 & name 존재 & 서울 & 비중복(SHA-256 externalId) 통과분만 → [저장] `KakaoGeocodingService`로 좌표 채워 `PopupStore`(AUTO_PUBLISHED) save + Algolia 즉시 인덱싱 → 스케줄러가 캐시 evict. 별도로 `PopupExpireScheduler`(05:00)가 만료분을 EXPIRED + Algolia 제거, `geocodeMissing()`(04:30)이 좌표 누락분을 백필한다.

## B6 — 백엔드 · 핵심 서비스 (auth/order/mate/wishlist/sla/backup/기타)

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/CongestionService.java` — 서울시 실시간 도시데이터(혼잡도/날씨/12시간 예측) 3중 폴백 조회
- **책임**: 서울시 열린데이터광장 `citydata` API를 호출해 6개 지역의 인구 혼잡도, 날씨, 시간대별 인구 예측을 가져오고, 실패 시 데모 데이터로 그래프 깨짐을 막는다.
- **핵심 로직**:
  - `getCongestionData(locationKey)`(59) — `AREA_MAP`(47)으로 키→지역명 변환 후, ①사용자 키로 시도 → ②실패하면 `"sample"` 키로 재시도 → ③둘 다 실패하면 첫 결과(데모) 반환하는 3단계 폴백.
  - `isErrorResult`(222) — 결과 Map의 `message`에 "Demo"/"오류"가 들어 있으면 실패로 간주(폴백 트리거가 메시지 문자열 매칭에 의존).
  - `parseResponse`(109) — 응답 첫 글자가 `<`면 XML, 아니면 JSON으로 파싱(서울시 API가 XML/JSON 혼재).
  - `extractRootData`(115) — `citydata`/`CITYDATA`/`SeoulRtd.citydata` 세 가지 루트 키를 모두 시도.
  - `readNested`(145) — 같은 키가 한 단계 더 중첩돼 오는 경우까지 양쪽 모두 지원(배열이면 [0], 내부에 동일 키가 있으면 그 배열의 [0]).
  - `applyAgeRates`(212) — 20대 비율을 `40~59` 랜덤으로 만들고 30대는 `100-20대-10`으로 계산(실데이터 아님, 항상 가짜 연령대 생성).
  - `demoFor`(239)/`demoForecasts`(227) — 혼잡 레벨/날씨/인구를 `Random`으로 합성.
- **연결**: `@Value("${seoul.api.key}")` 외 의존 빈 없음. `RestTemplate`을 메서드마다 `buildRestTemplate()`(100)로 새로 생성(5초 타임아웃). 컨트롤러(혼잡도 API)에서 호출될 것으로 보이나 이 모듈 범위에선 호출처 미확인.
- **특이사항**: 실데이터가 정상으로 와도 `applyAgeRates`가 연령 비율을 항상 난수로 덮어쓴다(실제 API의 연령 분포를 쓰지 않음). 폴백 판정이 한글/영문 메시지 문자열에 의존해, API가 메시지 포맷을 바꾸면 폴백이 오작동할 수 있다.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/CourseService.java` — vibe 키워드 기반 정적 성수동 코스 추천
- **책임**: 입력 분위기(vibe) 문자열에 키워드가 포함됐는지 보고 미리 하드코딩된 4종 코스(데이트/사진/힐링/기본 핫플) 중 하나를 반환한다.
- **핵심 로직**: `recommendCourse`(27) — `데이트/로맨틱`→datingCourse, `사진/인생샷`→photoCourse, `힐링/여유`→healingCourse, 그 외 기본. 각 코스는 `place()`(80) 헬퍼로 `id/name/lat/lng/category/reason` 키를 갖는 Map 리스트를 만든다(프론트 InteractiveMap 호환).
- **연결**: 의존 빈 없는 순수 정적 서비스. `AiCourseService`의 LLM 추천이 실패할 때의 폴백/대안 경로로 쓰일 가능성이 높으나, 호출처는 컨트롤러 측에 있음(이 범위 밖).
- **특이사항**: 좌표·장소가 전부 상수. 성수동 외 지역엔 의미 없음.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/CustomOAuth2UserService.java` — OAuth2 로그인 시 User upsert
- **책임**: Spring Security OAuth2 로그인 콜백에서 provider별 attributes를 매핑해 이메일 기준으로 User를 신규 생성 또는 갱신(upsert)하고, 권한 정보를 담은 `OAuth2User`를 반환한다.
- **핵심 로직**:
  - `loadUser`(35) — 기본 `DefaultOAuth2UserService`로 원본 attributes를 받고 → `OAuthAttributes.of(registrationId, ...)`로 표준화 → `saveOrUpdate`로 영속화 → `DefaultOAuth2User`에 `user.getRole()` 권한 1개를 부여해 반환.
  - `saveOrUpdate`(58) — `findByEmail`로 기존 회원이면 `existing.update(name, picture)`, 없으면 `buildNewUser`.
  - `buildNewUser`(70) — role=`ROLE_USER`, password를 `UUID.randomUUID()`로 채움(소셜 가입자는 비밀번호 미사용).
- **연결**: `UserRepository` 주입. Spring Security 필터 체인(OAuth2 로그인)이 호출. `OAuthAttributes` DTO에 매핑 로직을 위임.
- **특이사항**: PII 보호를 위해 로그에 provider와 내부 userId만 남기고 이메일/이름/사진은 기록 안 함(50). 이메일 기준 upsert이므로 같은 이메일을 다른 provider로 로그인하면 같은 User에 병합됨.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/IamportService.java` — 아임포트(PortOne) 결제 검증/취소 REST 클라이언트
- **책임**: 아임포트 REST API로 토큰 발급 → `imp_uid`로 실제 결제 정보 조회 → 위변조 의심 시 결제 취소(환불)를 수행하는 저수준 HTTP 래퍼.
- **핵심 로직**:
  - `check()`(50, `@PostConstruct`) — 키/시크릿이 비면 경고만 로깅(부팅은 막지 않음). `isConfigured()`(58)로 외부에서 설정 여부 확인.
  - `getAccessToken()`(64) — `/users/getToken` POST 후 `access_token` 추출.
  - `findPaymentByImpUid`(83) — `/payments/{impUid}` GET → `PaymentInfo` record(153)로 매핑(impUid/merchantUid/status/amount/buyerEmail/paidAt). **위변조 방어의 핵심: 서버 실제값 조회**.
  - `cancelPayment`(106) — `/payments/cancel` POST. 취소 실패는 로깅만 하고 예외를 삼킨다(124).
  - `parseSuccessResponse`(143) — 공통 응답에서 `code != 0`이면 `IllegalStateException`. `getToken`/`findPayment`은 `RuntimeException`은 그대로 rethrow, 그 외 파싱 예외는 `IllegalStateException`으로 변환.
- **연결**: `@Value`로 `iamport.api-key/api-secret` 주입. 자체 `RestTemplate`/`ObjectMapper` 인스턴스 보유. **`OrderService`가 유일한 호출처**(토큰/조회/취소 전부).
- **특이사항**: 취소 본문의 `checksum`을 `amount`와 동일하게 보냄(115). 키 미설정 시 부팅은 되지만 `OrderService`가 결제 단계에서 `isConfigured()=false`로 막는다.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/KakaoApiService.java` — 카카오 Local 키워드 검색 래퍼
- **책임**: 카카오 Local 키워드 검색 API를 호출해 응답 Map을 가공 없이 그대로 반환한다.
- **핵심 로직**: `searchPopups(keyword)`(28) — `UriComponentsBuilder`로 query 인코딩, `Authorization: KakaoAK <key>` 헤더로 GET 후 `Map` 바디 반환.
- **연결**: `@Value("${kakao.api.key}")`, 자체 `RestTemplate`. 검색/팝업 수집 관련 컨트롤러·서비스가 호출(범위 밖).
- **특이사항**: 예외 처리·널 체크 없음(호출 실패 시 그대로 전파). 응답 가공은 호출자 책임.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/NaverSearchService.java` — 네이버 이미지/블로그 검색 래퍼
- **책임**: 팝업 상세의 보조 콘텐츠 생성을 위해 네이버 이미지 검색(링크 100건)과 블로그 후기 검색(설명 텍스트 병합)을 제공한다.
- **핵심 로직**:
  - `searchPopupImages`(42) — 키워드+`" 팝업스토어"`, display=100, sort=`sim`으로 검색해 각 item의 `link`만 추출. 실패 시 빈 리스트(graceful).
  - `searchBlogReviews`(65) — 키워드+`" 후기"`, display=5의 `description`을 공백으로 이어붙여 한 덩어리 문자열로 반환.
  - `fetchItems`(83) — 공통 GET + `items` 추출, 바디/항목 null이면 빈 리스트.
- **연결**: `@Value`로 `naver.client.id/secret`, `X-Naver-Client-Id/Secret` 헤더. 자체 `RestTemplate`. 호출처는 팝업 콘텐츠 보강 로직(범위 밖, 아마 크롤러/팝업 서비스).
- **특이사항**: `searchPopupImages`만 try-catch로 빈 리스트 폴백이 있고, `searchBlogReviews`는 예외를 전파(비대칭).

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/OrderService.java` — 결제 처리 + 서버측 위변조 방어 + 권한 지급
- **책임**: 클라이언트가 보낸 결제 정보를 신뢰하지 않고, 아임포트 재조회로 금액/상태/중복을 검증한 뒤 주문을 저장하고 상품에 맞는 권한(POP-PASS 프리미엄/확성기)을 지급한다.
- **핵심 로직**:
  - `processOrder`(46, `@Transactional`) — 순서: 인증 유저 추출 → DTO 검증 → 중복 차단 → Goods 조회 → 결제 검증 → 주문 저장 → 권한 지급.
  - `requireAuthenticatedUser`(65) — principal 없으면 `SecurityException`. **유저ID는 클라이언트 값이 아닌 인증 컨텍스트에서 취득**.
  - `rejectDuplicatePayment`(81) — `existsByImpUid`로 재처리 차단(`IllegalStateException`).
  - `verifyPaymentOrThrow`(93) — ①`isConfigured()` 아니면 차단 → ②`findPaymentByImpUid` 재조회 → ③`status != "paid"`면 차단 → ④`amount != goods.price`면 **`cancelPayment`로 자동 환불 후 `SecurityException`**(105~114).
  - `grantPurchaseEntitlements`(132) — `normalizeGoodsName`(157, 대문자/공백/하이픈 제거)로 정규화 후 `PASS`/`멤버십` 포함 시 `grantPopPass`, `확성기`/`MEGAPHONE` 포함 시 `addMegaphone(1)`.
  - `grantPopPass`(148) — `extendPremium(30일)` + 만료일 null이면 now+30일 + `setPremium(true)`.
- **연결**: `OrderRepository`, `UserRepository`, `GoodsRepository`, **`IamportService`** 주입. `OrderController.OrderDto`/`Authentication`을 인자로 받음(컨트롤러가 호출). `User.addMegaphone/extendPremium/setPremium` 등 엔티티 메서드 호출.
- **특이사항**: 권한 지급이 **상품명 문자열 substring 매칭**에 의존(132~144) — 상품명에 키워드가 없으면 결제는 성공·저장되지만 아무 권한도 지급되지 않을 수 있다. 금액 불일치 시 자동 취소가 동작하려면 아임포트 설정이 필수.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/PexelsService.java` — Pexels 세로 영상 랜덤 추천(메인 OOTD)
- **책임**: 패션 키워드 풀에서 랜덤으로 골라 Pexels Video Search를 호출하고, 세로 영상 10개 중 하나를 다시 랜덤 픽해 메타데이터 Map으로 반환한다.
- **핵심 로직**:
  - `getFashionVideo`(45) — `FASHION_KEYWORDS`(34)에서 랜덤 query → `buildUri`(orientation=portrait, per_page=10) GET → `pickRandomVideo`. 실패 시 `null` 반환(graceful).
  - `pickRandomVideo`(77) — `videos` 배열에서 랜덤 픽, `keyword/photographer/videoUrl(첫 번째 video_files link)/thumbnail` 추출.
- **연결**: `@Value("${pexels.api-key}")`, 자체 `RestTemplate`/`ObjectMapper`/`Random`. 메인 페이지 영상 API 컨트롤러가 호출(범위 밖).
- **특이사항**: 실패/빈결과 모두 `null` 반환이라 호출자의 null 처리가 필수.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/TicketService.java` — Redis 기반 티켓팅(선착순 재고) 시뮬레이션
- **책임**: Redis 카운터로 재고를 관리하며, 봇 스레드들이 동시에 재고를 깎는 환경에서 사용자가 자리를 잡을 수 있는지 시뮬레이션한다.
- **핵심 로직**:
  - `startSimulation`(43) — 고정 풀(`BOT_THREAD_POOL_SIZE`=10)에 `BOT_COUNT`=5개 봇 루프 제출.
  - `runBotLoop`(76) — 재고가 0 이하가 될 때까지 50~150ms 휴식 후 `decrement` 반복. `InterruptedException` 시 인터럽트 플래그 복원.
  - `attemptReservation`(50) — 사용자 시도: `decrement` 결과가 `>= 0`이면 `SUCCESS`, 아니면 `FAIL`.
  - `resetGame`(37)/`getStock`(60) — 재고 초기화(30)/조회.
  - `cleanup`(64, `@PreDestroy`) — 스레드 풀 종료.
- **연결**: `StringRedisTemplate` 주입. 게임/티켓 컨트롤러가 호출(범위 밖). 레거시 호환용 no-op 메서드(`triggerBots`/`attemptTicket`/`resetGame(id,stock)`/`triggerClusterBots`) 4개 유지(89~105).
- **특이사항**: `decrement`가 음수까지 내려갈 수 있어(봇·사용자 경쟁) 재고가 음수로 흐를 수 있으나, 사용자 판정은 `>= 0`만 성공으로 처리해 정합성을 맞춘다. `executorService`가 클래스 필드로 즉시 생성되어 봇은 매 시뮬레이션마다 풀에 누적 제출됨.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/WishlistService.java` — 위시리스트 토글/조회
- **책임**: 사용자-팝업 찜 관계를 토글(있으면 삭제/없으면 추가)하고, 내 위시리스트를 DTO로 조회한다.
- **핵심 로직**:
  - `toggleWishlist`(29, `@Transactional`) — `existsByUser_UserIdAndPopupStore_Id`로 존재 확인 → 있으면 `removeExisting`→`REMOVED`, 없으면 `addNew`→`ADDED`.
  - `addNew`(54) — User/PopupStore 조회 후 `Wishlist.builder()` 저장(없으면 `IllegalArgumentException`).
  - `toResponse`(66) — `WishlistResponseDto`로 변환(팝업 id/이름/이미지/위치/시작·종료일).
- **연결**: `WishlistRepository`, `UserRepository`, `PopupStoreRepository` 주입. 위시리스트 컨트롤러가 호출. `WishlistExpiryScheduler`와는 같은 Repository를 공유(직접 호출 관계는 아님).
- **특이사항**: 클래스에 `@Transactional(readOnly=true)` 기본 + 쓰기 메서드만 `@Transactional` 오버라이드. `startDate/endDate.toString()`(74~75) 호출 — 해당 필드가 null이면 NPE 가능(가드 없음).

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/ChatService.java` — 팝업 채팅 영속화 + 메인 티커
- **책임**: 팝업 상세의 STOMP 채팅 저장/이력 조회와, 메인 페이지 실시간 티커(최근 10건)를 담당하는 도메인 서비스. 컨트롤러/STOMP 핸들러가 Repository를 직접 다루지 않게 한다.
- **핵심 로직**:
  - `saveMessage`(30, `@Transactional`) — `popupStoreService.findOrThrow(popupId)`로 팝업 검증 후 `ChatMessage` 저장.
  - `findChatHistory`(36) — 전송시각 오름차순 이력.
  - `findRecentTickerEntries`(42) — 최근 10건 중 **orphan(팝업 삭제됨) 메시지는 제외**(48)하고 `toTickerEntry`로 Map 변환.
- **연결**: `ChatRepository`, **`PopupStoreService`**(`findOrThrow`) 주입. 채팅 STOMP/REST 컨트롤러가 호출.
- **특이사항**: 티커에서 `getPopupStore()==null` 가드로 NPE/유령 데이터 노출을 방지.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/GoodsService.java` — 굿즈 조회 + 메인 랜덤 픽업
- **책임**: 팝업별 굿즈 목록 조회와, 메인 화면용 랜덤 굿즈(최대 20개)를 제공한다.
- **핵심 로직**: `findByPopup`(27) — 팝업 id로 조회. `findRandomPicks`(33) — `findAll()`을 메모리에서 `Collections.shuffle` 후 앞 20개 subList(데이터 부족 시 전부).
- **연결**: `GoodsRepository` 주입. `OrderService`와 같은 Repository를 쓰지만 직접 호출 관계는 아님. 굿즈 컨트롤러가 호출.
- **특이사항**: 클래스 주석(15)대로 셔플이 메모리 기반이라 카탈로그가 수천 행을 넘으면 `findAll()` 전체 로드가 부하. (소규모 운영 전제의 트레이드오프)

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/AdminService.java` — 관리자 운영 로직(승인/보상/메이트 삭제/통계)
- **책임**: 팝업 승인·거절·상태변경, 이벤트 보상 직접 지급, 메이트 게시글 강제 삭제, 대시보드 통계를 제공한다.
- **핵심 로직**:
  - `approvePopup`(58, `@Transactional`) — 상태 `영업중`으로 변경 + `rewardReporterIfPresent`(121)로 신고자에게 확성기 1개 보상(reporterId 있을 때만).
  - `rejectPopup`(65)/`changePopupStatus`(70) — 삭제/상태변경.
  - `giveReward`(78) — 닉네임으로 유저 조회 후 `MEGAPHONE`이면 `addMegaphone(amount)`, `POPPASS`면 `extendPremium(amount)`, 그 외 `IllegalArgumentException`.
  - `getAdminStats`(104) — `count`/`countByStatus`만 사용해 N+1 없이 통계(totalUsers/activePopups/totalMatePosts/pendingPopups).
  - `findAllMatePostsOrdered`(52) — 부스트(isMegaphone) 우선 + 최신순.
- **연결**: `PopupStoreRepository`, `UserRepository`, `MatePostRepository` 주입. `findPopupOrThrow`(115)는 `ResourceNotFoundException.popup`. Admin 컨트롤러가 호출.
- **특이사항**: `giveReward`의 유저 미존재가 **`new RuntimeException(...)`**(82)으로 던져짐 — 다른 메서드(`ResourceNotFoundException`)와 예외 정책이 불일치(이 모듈에서 유일하게 남은 raw RuntimeException 사용처 중 하나). `@Transactional`이라 엔티티 변경이 dirty checking으로 반영되며 `giveReward`는 명시적 save 없이 flush에 의존(`rewardReporterIfPresent`는 명시적 save 호출).

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/MyPageService.java` — 마이페이지 집계 + 프리미엄 lazy 만료
- **책임**: 마이페이지 데이터(닉네임/프리미엄/확성기/스탬프·찜·활동 카운트)를 한 번에 조립하고, 조회 시점에 만료된 프리미엄을 즉시 정리한다. 컨트롤러가 5개 Repository를 직접 호출하던 패턴을 흡수.
- **핵심 로직**:
  - `findMyPageData`(35, `@Transactional`) — 유저 조회 → `expirePremiumIfNeeded` → 스탬프/찜/활동 카운트 → `MyPageDto` 빌드.
  - `expirePremiumIfNeeded`(61) — 프리미엄이고 만료일이 now 이전이면 `user.expirePremium()` + save(lazy expire).
  - `countMyActivity`(70) — 채팅(닉네임 기준 `countBySender`) + 게시글(userId 기준 `countByAuthor_UserId`) 합산.
- **연결**: `UserRepository`, `StampRepository`, `WishlistRepository`, `ChatRepository`, `MatePostRepository` 5개 주입. `MyPageController`가 호출. `ResourceNotFoundException.user`로 404 변환.
- **특이사항**: 채팅 카운트가 닉네임 기반이라(72) 닉네임 변경 이력이 있으면 과거 채팅이 누락될 수 있음. `findMyPageData`가 단순 조회처럼 보이지만 만료 처리(쓰기)가 섞여 있어 `@Transactional`(readOnly 아님).

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/StampService.java` — 방문 스탬프 적립 + 어뷰징 방어 + 자동 보상
- **책임**: 팝업 방문 스탬프를 적립하고, 누적 3의 배수마다 확성기를 자동 지급한다. 하루 1회·팝업당 1회 두 단계 어뷰징 방어.
- **핵심 로직**:
  - `addStamp`(38, `@Transactional`) — ①`rejectIfAlreadyStampedToday` → ②`rejectIfDuplicatePopup` → 팝업/유저 조회 → Stamp 저장 → `grantStampReward`.
  - `rejectIfAlreadyStampedToday`(57) — **KST 기준** 오늘 00:00~23:59:59.999 사이에 이미 적립이 있으면 거부(`IllegalArgumentException`).
  - `rejectIfDuplicatePopup`(68) — 동일 팝업 재인증 거부.
  - `grantStampReward`(74) — `stampCount+1` 저장, `newCount % 3 == 0`이면 확성기 +1.
- **연결**: `StampRepository`, `PopupStoreRepository`, `UserRepository` 주입. 스탬프 컨트롤러가 호출. `getMyStamps`(51)는 트랜잭션 어노테이션 없음.
- **특이사항**: 팝업/유저 미존재 시 **`new RuntimeException`**(88, 94) 사용 — `ResourceNotFoundException`을 쓰는 다른 서비스와 예외 정책 불일치. 스탬프 카운트는 `User.stampCount`(엔티티 컬럼)와 `StampRepository.countByUserId`(MyPageService가 사용)가 별도로 존재 — 두 경로가 어긋날 여지가 있음(여기선 엔티티 카운터로 보상 판정).

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/AiCourseService.java` — LangChain4j LLM 동적 코스 추천
- **책임**: LLM에게 성수동 5곳 투어 코스를 JSON 배열로만 생성하게 하고, 마크다운 펜스 제거·id 문자열화로 프론트 호환성을 보장한다.
- **핵심 로직**:
  - `recommendCourse`(42) — `PROMPT_TEMPLATE`(22)에 vibe를 넣어 `chatLanguageModel.generate` → `parseResponse`. LLM 호출 실패 시 `IllegalStateException`으로 변환(메시지에 원인 포함).
  - `parseResponse`(56) — `stripMarkdownFences`(68, ```json/``` 제거)로 정리 후 `List`로 역직렬화, 파싱 실패 시 빈 리스트.
  - `normalizeIdFields`(73) — 각 item의 `id`를 항상 `String.valueOf`로 문자열화.
- **연결**: **`ChatLanguageModel`(LangChain4j)** 주입 + 자체 `ObjectMapper`. AI 코스 컨트롤러가 호출. `CourseService`(정적)와 같은 출력 스키마(id/name/lat/lng/category/reason)를 공유.
- **특이사항**: 주석(49~50)대로 LLM 장애가 의미상 5xx여야 하지만 `GlobalExceptionHandler`가 `IllegalStateException`을 409로 잡고 있어 클라이언트는 409를 받음(의도적으로 메시지에 원인을 담음). 파싱 실패와 호출 실패의 처리가 다름(전자는 빈 리스트, 후자는 예외).

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/FeedbackService.java` — 의견 보내기(피드백) 도메인 로직
- **책임**: 사용자/게스트 피드백 제출, 본인 목록 조회, 어드민 검수 큐/상태별 카운트/답변/삭제를 처리한다. 카테고리/상태 화이트리스트 검증을 서비스가 담당.
- **핵심 로직**:
  - `submit`(42, `@Transactional`) — `requireCategory`(115, `BUG/FEATURE/GOOD/OTHER`만 허용) 후 저장. `userId`가 null이면 게스트 작성, `guestEmail`은 `emptyToNull`(135).
  - `findForAdmin`(65) — `normalizeStatusFilter`(127)로 null이면 전체, 값 있으면 화이트리스트 검증. `PageRequest.of(max(page,0), max(size,1))`로 음수 방어.
  - `countByStatus`(74) — 4개 상태별 카운트 Map(어드민 대시보드용).
  - `reply`(84, `@Transactional`) — 상태 변경(`requireStatus` 검증) + 답변 채워지면 `repliedAt` 갱신, 답변 없이 `RESOLVED`로 바뀌고 `repliedAt`이 비어있으면 그때도 시각 기록(98).
  - `deleteById`(106) — 존재 확인 후 삭제(없으면 `ResourceNotFoundException`).
- **연결**: `FeedbackRepository` 주입(생성자 명시, 36). 사용자/어드민 피드백 컨트롤러가 호출. **`SlaNotificationScheduler`가 같은 Repository의 `countOlderThan("PENDING", cutoff)`로 24h 미처리 감시**(직접 호출은 아님).
- **특이사항**: 상태 화이트리스트(`ALLOWED_STATUSES`, 29)와 SLA 스케줄러의 `FEEDBACK_PENDING="PENDING"`이 같은 문자열에 의존 — 상태 코드 변경 시 양쪽 동기화 필요. `defaultPageSize()`(140) static getter는 외부 노출용으로만 존재.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/MyCourseService.java` — 내 코스 저장/조회/삭제(소유권 검사)
- **책임**: 사용자 코스 저장(무제한), 본인 코스 목록 조회, 소유자 검증 후 삭제를 담당한다.
- **핵심 로직**:
  - `saveCourse`(28, `@Transactional`) — `requireUserExists`(60)로 userId 유효성만 검증(코스 수 제한 폐지, v2.12) 후 저장.
  - `deleteCourseAsOwner`(46) — 코스 조회 후 `tokenUserId != course.userId`면 **`SecurityException`**(403 의도) → IDOR 방어(v2.9).
- **연결**: `MyCourseRepository`, `UserRepository` 주입. `MyCourseController`가 토큰 subject를 `tokenUserId`로 넘겨 호출. `ResourceNotFoundException`(코스/유저 미존재).
- **특이사항**: 주석대로 v2.12에서 무료 1개 제한을 폐지. 삭제 시 토큰 subject로 소유권을 재검증해 요청 바디 userId 위조를 차단.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/SearchService.java` — Algolia 인덱스 동기화 + 인덱싱 정책 게이트
- **책임**: 팝업 데이터를 Algolia에 동기화하되, 신뢰도/검수상태/상태 기준으로 인덱싱 적격 row만 올리고 부적격은 인덱스에서 삭제한다. 키 미설정 시 graceful 비활성.
- **핵심 로직**:
  - `init`(57, `@PostConstruct`) — `isAlgoliaConfigured`(147, appId 6자+대문자/숫자 패턴, apiKey 10자+) 통과 시에만 클라이언트 초기화, 실패해도 부팅 안 막음.
  - `syncAllPopups`(77) — 전체 조회 후 `isIndexable` 필터로 분리해 적격은 `saveObjects().waitTask()`, 부적격 id는 `deleteObjects().waitTask()`(옛 garbage cleanup).
  - `addPopup`(108) — 1건 push, 부적격이면 인덱스에서 삭제까지 처리(REJECTED 전환 대응). `removePopup`(119) — id 강제 삭제.
  - `isIndexable`(126) = `passesReviewStatus`(130, null 또는 `AUTO_PUBLISHED/APPROVED`) AND `passesStatus`(135, `EXPIRED/PENDING` 제외) AND `passesConfidence`(141, confidenceScore null이면 통과, 아니면 ≥ 임계값).
- **연결**: `PopupStoreRepository` 주입 + Algolia `SearchClient/SearchIndex`. `@Value`로 `algolia.app-id/api-key` + **`popspot.crawler.confidence-threshold`(기본 0.8)** — PopupCrawlOrchestrator와 동일 키 공유로 정책 일원화(53). `PopupSearchDto.fromEntity`로 변환. 크롤러/어드민이 add/sync/remove를 호출(범위 밖).
- **특이사항**: 인덱싱 게이트는 `PopupStoreService.isPublic`(노출 게이트)과 기준이 **유사하나 동일하진 않음** — SearchService는 confidence 임계값을 추가로 보고, PopupStoreService(v2.21-S4)는 신뢰도 게이트를 제거함. 즉 검색 인덱스와 지도/BROWSE 노출 집합이 confidence 경계에서 어긋날 수 있다.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/EmailService.java` — 인증번호/운영 알림 메일러
- **책임**: 회원가입 인증번호 메일(HTML)과, v2.17 운영/SLA 알림용 임의 텍스트 메일을 발송한다. SecureRandom으로 6자리 코드 생성.
- **핵심 로직**:
  - `createNumber`(35) — `SecureRandom`으로 6자리 숫자.
  - `sendMail`(43) — 인증번호 HTML 메일 발송, 실패 시 **`IllegalStateException`으로 격상**(GlobalExceptionHandler가 409로 통일). 실패 로그엔 예외 클래스명만(이메일/메시지 미기록).
  - `sendNotification`(67) — 임의 제목/평문 본문 알림. 수신처 비면 발송 스킵+false. 실패해도 **예외를 던지지 않고 false 반환**(cron 전체 중단 방지). 로그는 `maskEmail`(89, 앞1글자+***+도메인)로 마스킹(v2.22 PII 보안).
- **연결**: `JavaMailSender` 주입, `@Value("${spring.mail.username:...}")`로 발신자. **`WishlistExpiryScheduler`와 `SlaNotificationScheduler`가 `sendNotification`을 호출**. 인증 컨트롤러/AuthService 흐름이 `sendMail` 사용.
- **특이사항**: 두 발송 경로의 실패 정책이 의도적으로 다름 — 인증번호는 예외(사용자 흐름 차단), 알림은 false(배치 지속). 알림 로그는 마스킹되지만 `sendMail`(인증) 경로는 toEmail을 로그에 아예 안 남김.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/PopupStoreService.java` — 팝업 공개 조회/검색/캘린더/상세 + 캐시
- **책임**: 사용자에게 노출 가능한 팝업만 거르는 공개 게이트(`isPublic`)를 중심으로, 지도 마커/카테고리/검색/인기/상세/캘린더 조회와 저장·삭제·검수상태 변경 시 캐시 무효화를 담당한다.
- **핵심 로직**:
  - `isPublic`(204) — `status`가 `PENDING/EXPIRED`면 숨김, `reviewStatus`가 null(레거시)이면 통과, 아니면 `AUTO_PUBLISHED/APPROVED`만 통과. **여러 조회 메서드의 공통 필터**.
  - `findVisibleMapMarkers`(133, `@Cacheable(CACHE_POPUPS_VISIBLE, sync=true)`) — `findAllVisible()` + `isPublic` 필터. v2.21-S2에서 신뢰도 0.8 미만 노출 회귀 차단 후, 필터된 결과를 5분 TTL 캐싱.
  - 쓰기 메서드(`save` 69 / `updateReviewStatus` 92 / `deleteById` 105) — 모두 `@Caching`으로 `CACHE_POPUPS_VISIBLE` + `CACHE_POPUPS_HOT` 두 캐시 evict.
  - `evictPopupCaches`(120) — 빈 바디 + `@Caching` evict만. **크롤러가 Repository.save를 직접 호출(Service.save 우회)해 @CacheEvict가 안 걸리는 회귀를 보강**하는 명시적 무효화 훅(v2.21-S3).
  - `getPopupById`(171, `@Transactional`) — viewCount++ 부수효과가 있어 캐시 대상에서 제외.
  - `getTrendingPopups`(165) — Top 4. lazy `images` 직렬화 문제로 아직 캐싱 안 함(주석 161~163, v2.21 리팩터 예정).
  - `getCalendar`(183) — from/to 파싱(`parseOrDefault` 215, 잘못된 ISO면 기본값), to<from이면 from+60일로 보정, `isPublic` 필터 + `CalendarPopupDto` 변환.
- **연결**: `PopupStoreRepository` 주입 + `CacheConfig` 캐시 이름 상수. **`ChatService.saveMessage`가 `findOrThrow` 호출**. 팝업 공개 컨트롤러/크롤러/어드민이 광범위하게 호출. `ResourceNotFoundException.popup`으로 404.
- **특이사항**: 주석에 캐시/lazy 관련 기술부채가 상세히 남아 있음 — `getTrendingPopups`/`getPopupById`는 lazy 직렬화·부수효과 때문에 의도적으로 캐시 제외. v2.21-S4에서 사용자 노출 신뢰도 게이트는 제거됐고(주석 47~53), confidence 판정은 SearchService(검색 인덱싱)에만 남음.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/AuthService.java` — 로컬 가입/로그인/계정찾기/비번재설정 + JWT + 로그인 잠금
- **책임**: 로컬 회원의 가입·로그인·이메일/비밀번호 찾기·재설정을 처리하고, OAuth와 동일 키로 JWT를 발급하며, brute-force 방어용 로그인 시도 잠금을 관리한다.
- **핵심 로직**:
  - `initJwtKey`(70, `@PostConstruct`) — `jwt.secret`이 32바이트 미만이면 부팅 실패(`IllegalStateException`). HS256 키 생성.
  - `signup`(83) — 이메일 중복이면 `IllegalArgumentException`(400), 아니면 비번 인코딩 후 `LOCAL`/`USER`로 저장.
  - `login`(101) — ①`ensureNotLocked` → ②이메일 조회 실패 시 `recordFailure` 후 **비밀번호 불일치와 동일 메시지**로 응답(user enumeration 차단, v2.22) → ③비번 불일치도 동일 메시지 → 성공 시 `loginAttempts.invalidate` + `LoginResponseDto`(role/isPremium/megaphone 포함) + `issueJwt`.
  - `ensureNotLocked`(141) — `LOGIN_MAX_ATTEMPTS`(5)회 연속 실패 시 `LOGIN_LOCK_MINUTES`(15)분 잠금, 잠금 만료되면 카운터 리셋.
  - `recordFailure`(158)/`LoginAttempt` record(170) — 실패 카운트+시각 기록.
  - `checkUserForPasswordReset`(205) — 닉네임 불일치는 400, **소셜 가입자(provider≠LOCAL)는 `RuntimeException("SOCIAL_USER:<provider>")`**로 컨트롤러가 안내 분기.
  - `issueJwt`(241) — subject=userId, claim role, 만료 `accessTokenValidityMs`(기본 1h).
- **연결**: `UserRepository`, `PasswordEncoder` 주입 + **Caffeine `Cache<String,LoginAttempt>`**(49, 최대 5만, 15분 write 만료). `@Value`로 `jwt.secret`/`jwt.access-token-validity-ms`. Auth 컨트롤러가 호출. `OAuth2SuccessHandler`와 JWT 형식 일치(주석 240).
- **특이사항**: `loginAttempts`가 **process-local in-memory Caffeine** — 다중 인스턴스 배포 시 노드별로 잠금이 분리됨(주석 46에 명시). v2.22에서 `ConcurrentHashMap`→Caffeine으로 이메일 스프레이 메모리 누수 차단. `findByEmailOrThrow`(227)는 `RuntimeException`을 던지지만 `login`이 즉시 가로채 동일 메시지 `IllegalArgumentException`으로 치환해 enumeration을 막음(내부적으로만 RuntimeException 사용).

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/MateService.java` — 동행 모집 게시판 + 등급별 부스트 + 신고/자동숨김
- **책임**: 메이트 게시글 CRUD·참여·채팅 영속화, 등급별 월 부스트 한도 검증/차감, 신고 누적 자동 숨김을 담당한다. 컨트롤러의 비즈니스 로직을 흡수하고 트랜잭션 경계를 소유.
- **핵심 로직**:
  - `createPost`(67, `@Transactional`) — 작성자(userId)는 **컨트롤러가 JWT에서 추출**해 전달(바디 userId 불신, 사칭 방지). `tryConsumeBoost`로 부스트 적용 여부 결정 후 저장.
  - `tryConsumeBoost`(178) — 요청 시 `resetBoostIfNewPeriod` → `BoostPolicy.monthlyLimitFor(stampCount)` 한도 초과면 **`BoostQuotaExceededException`**(234, 400), 아니면 `boostUsedCount++` 저장 후 true.
  - `resetBoostIfNewPeriod`(193) — `YearMonth.now()`가 `user.boostPeriod`와 다르면 사용량 0 리셋.
  - `joinMate`(82) — `hasJoined`면 `ALREADY_JOINED`, 정원 차면 `FULL`, 아니면 `admitNewMember`(214, 인원+1, 정원 도달 시 `CLOSED`)→`JOIN_SUCCESS`(enum 224).
  - `deletePost`(103) — 작성자 아니면 **`AccessDeniedToPostException`**(241, 403).
  - `reportPost`(119) — 본인 글 신고 차단 + **1인 1신고**(`hasReported`, v2.22) + 카운트 증가, `REPORT_AUTO_HIDE_THRESHOLD`(3) 도달 시 `setHidden(true)`.
  - `getBoostStatus`(146) — 등급/한도/사용/잔여를 `BoostStatus` record(231)로 반환(글쓰기 모달 "N회 남음" 표시).
  - `persistChatMessage`(52) — 게시글에 묶어 채팅 저장 + sendTime 세팅.
- **연결**: `MatePostRepository`, `UserRepository`, `MateChatMessageRepository` 주입 + **`service.mate.BoostPolicy`** 의존. `MateController`/STOMP 핸들러가 호출. `AdminService.forceDeleteMatePost`와 같은 Repository 공유. 도메인 예외 2종(`BoostQuotaExceededException`/`AccessDeniedToPostException`)을 자체 정의해 컨트롤러가 상태코드로 변환.
- **특이사항**: `MatePost.isMegaphone` 컬럼을 v2.12부터 "확성기 소비"→"상단 부스트 적용 여부"로 **의미만 재해석해 재사용**(주석 24~25). `getBoostStatus`가 읽기처럼 보이지만 기간 리셋 save가 있어 `@Transactional`(쓰기). `REPORT_AUTO_HIDE_THRESHOLD` 상수가 메서드 사이(138)에 선언돼 있음.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/mate/BoostPolicy.java` — 동행 부스트 등급/월한도 정책 유틸
- **책임**: 스탬프 누적량으로 등급(NONE/BEGINNER/HUNTER/MASTER)을 결정하고 등급별 월 부스트 한도를 반환하는 무상태 정책 클래스.
- **핵심 로직**: `rankOf`(34) — 12+→MASTER, 6+→HUNTER, 3+→BEGINNER, 그 외 NONE. `monthlyLimit`(42) — MASTER 5/HUNTER 3/BEGINNER 1/NONE 0. `monthlyLimitFor`(52) — 둘을 합성.
- **연결**: `MateService`(`tryConsumeBoost`/`getBoostStatus`)만 사용. private 생성자(util 클래스).
- **특이사항**: 임계값(`BEGINNER_MIN`/`HUNTER_MIN`/`MASTER_MIN`)이 **프론트 `src/lib/rank.ts`와 동일해야 함** — 한쪽만 바꾸면 사용자가 보는 등급과 서버 차감 한도가 어긋남(주석 6~7 경고).

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/wishlist/WishlistExpiryScheduler.java` — 위시 만료 D-3 메일 알림 cron
- **책임**: 매일 09:00 KST에 종료일이 정확히 D-3인 팝업을 찜한 사용자에게 종료 안내 메일을 발송한다(기능 플래그로 운영에서만 활성).
- **핵심 로직**:
  - `scheduledNotify`(49, `@Scheduled(cron=..., zone="Asia/Seoul")`) — `enabled` false면 스킵 → `now + daysBefore`(기본 3) ISO 날짜로 `findWithUserAndPopupByEndDate` 조회(fetch join으로 user+popup 동반) → 각 건 `sendNotificationFor`.
  - `sendNotificationFor`(69) — user/email/popup null·blank 가드 후 `emailService.sendNotification`.
  - `buildBody`(80) — 닉네임/팝업명/기간/위치 평문 본문 조립.
- **연결**: `WishlistRepository`, **`EmailService.sendNotification`** 주입. `@Component`(스케줄러). `@Value`로 `popspot.wishlist.enabled/expiry-days-before/expiry-cron`.
- **특이사항**: 기본 비활성(`enabled=false`). 한 사용자가 여러 팝업을 찜했으면 팝업당 한 통씩 발송(주석대로 단순화). `findWithUserAndPopupByEndDate`가 fetch join이라 본문 조립 시 lazy 예외를 피함.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/sla/SlaNotificationScheduler.java` — 24h 미처리 SLA 운영 알림 cron
- **책임**: 매시간 Takedown 신고와 Feedback의 24시간 초과 미처리 건수를 집계해, 0이 아니면 운영자에게 알림 메일을 보낸다.
- **핵심 로직**:
  - `scheduledCheck`(42, `@Scheduled` 매시간, KST) — `notifyEmail` 미설정 시 스킵 → `cutoff = now-24h` → `feedbackRepository.countOlderThan("PENDING", cutoff)` + `popupStoreRepository.countTakedownOlderThan(cutoff)` → 둘 다 0이면 스킵 → 제목/본문에 건수 담아 `sendNotification`.
- **연결**: **`FeedbackRepository`, `PopupStoreRepository`, `EmailService`** 주입. `@Component`. `@Value("${popspot.sla.notify-email:}")` 미설정이면 비활성. `FeedbackService`의 `PENDING` 상태/`PopupStoreService`의 TAKEDOWN 흐름과 데이터적으로 연동(직접 호출은 아님).
- **특이사항**: 이용약관 §11(Takedown 24h) + v2.11 운영 약속(Feedback 24h)을 코드로 추적. 본문에 어드민 처리 경로(`/admin` 탭/필터)를 안내. 알림 자체는 `sendNotification`이 실패해도 예외를 던지지 않아 cron이 죽지 않음.

#### `popspot-backend/src/main/java/com/example/popspotbackend/service/backup/DatabaseBackupScheduler.java` — PostgreSQL 자동 백업 cron + 보안 하드닝
- **책임**: 매일 03:00 KST에 `pg_dump`를 실행해 `backups/`에 `.sql.gz`로 저장하고, 보관일수(기본 7일) 초과 백업을 삭제한다. 운영에서만 활성.
- **핵심 로직**:
  - `scheduledBackup`(70, `@Scheduled` 03:00 KST) — `enabled` false면 스킵 → `runPgDump` → `cleanupOldBackups`. 예외는 클래스명만 로깅.
  - `runPgDump`(88) — 디렉토리 보장 → JDBC URL에서 db명/host/port 파싱 → `/bin/sh -c "pg_dump ... | gzip > file"` ProcessBuilder. **v2.22 보안: 모든 설정 유래 값을 `escapeShell`(203, `'`→`'\''`)로 single-quote escape**(셸 인젝션 방어), **비밀번호는 커맨드라인 대신 `PGPASSWORD` 환경변수로 전달**(112, ps 노출 방지). 30분 타임아웃 초과 시 `destroyForcibly`, exit≠0이면 출력 포함 `IOException`.
  - `cleanupOldBackups`(129) — `popspot-` 접두 파일 중 `lastModified < cutoff`를 삭제.
  - `ensureBackupDirExists`(149)/`restrictDirPermissions`(161) — 디렉토리 생성 + **POSIX 환경에서 700(rwx------)로 제한**(SQL 덤프는 전체 PII 포함). 비-POSIX(Windows dev)는 조용히 스킵.
  - URL 파서 `extractDatabaseName`(172)/`extractHost`(181)/`extractPort`(192) — `jdbc:postgresql://host:port/db?...`에서 각 조각 추출(기본 localhost/5432).
- **연결**: 의존 빈 없음(`@Component`). `@Value`로 `popspot.backup.*` + `spring.datasource.url/username/password`. `moveFileForTesting`(210)은 단위 테스트 전용(운영 미사용).
- **특이사항**: 기본 비활성(`enabled=false`). v2.22에서 셸 인젝션·비밀번호 노출·디렉토리 권한 세 가지를 하드닝. `/bin/sh` 기반이라 Linux 운영 환경 전제(Windows에선 백업 자체가 동작하지 않으나 권한 설정만 graceful 스킵). cutoff 계산 `retentionDays * 24L * 60 * 60 * 1000`은 long 캐스팅으로 오버플로 회피(134).

**모듈 전반 연결 요약**: 외부 API 래퍼군(`Congestion`/`Kakao`/`NaverSearch`/`Pexels`/`Iamport`)은 각자 독립 `RestTemplate`을 쓰는 무상태 클라이언트이고, 결제 검증의 핵심 체인은 `OrderController → OrderService → IamportService`다. 노출/검색 정책은 `PopupStoreService.isPublic`(지도·BROWSE 노출)과 `SearchService.isIndexable`(Algolia 인덱싱)으로 이원화돼 있으며 둘 다 `reviewStatus`+`status`를 보지만 confidence 게이트는 검색 쪽에만 남아 있다. `EmailService.sendNotification`은 두 cron(`WishlistExpiryScheduler`, `SlaNotificationScheduler`)의 공통 출력 채널이고, 세 스케줄러(+`DatabaseBackupScheduler`)는 모두 기능 플래그/수신처 설정으로 기본 비활성이다. 등급/부스트 정책은 `MateService`↔`BoostPolicy`↔프론트 `rank.ts` 삼자가 임계값을 공유한다. 예외 정책은 대부분 `ResourceNotFoundException`+도메인 예외로 통일됐으나 `AdminService.giveReward`와 `StampService`의 조회 헬퍼에 raw `RuntimeException`이 잔존한다.

## B7 — 백엔드 · 엔티티 / 리포지토리 (데이터 계층)

#### `popspot-backend/.../entity/User.java` — 로컬+OAuth2 회원 통합 엔티티
- **책임**: `USERS` 테이블 매핑. 로컬 가입과 구글/카카오/네이버 OAuth2 회원을 한 테이블에 저장한다. PK는 UUID 문자열(`userId`), 프리미엄 구독/확성기/등급별 부스트/약관 동의 버전/누적 카운트(스탬프·좋아요·리뷰)를 모두 보유.
- **핵심 로직**:
  - `@PrePersist generateId()` (`User.java:107-112`) — INSERT 직전 `userId`(UUID), `mannerTemp`(36.5), `role`(`ROLE_USER`) 기본값 보장. DB가 아니라 애플리케이션에서 PK 생성.
  - 카운트 4종(`megaphoneCount`/`stampCount`/`likeCount`/`reviewCount`)과 `isPremium`/`boostUsedCount`는 `@Builder.Default = 0/false` + `columnDefinition = "integer default 0"`로 이중 방어(`User.java:77-104`) — 기존 row의 NULL이 hibernate 매핑 에러를 일으키던 사고 회피.
  - `extendPremium(int days)` (`User.java:136-144`) — 잔여 기간이 살아있으면(`premiumExpiryDate.isAfter(now)`) 만료일에 가산, 아니면 오늘부터 재시작. 항상 `isPremium=true`.
  - `expirePremium()`/`upgradeToPremium()`/`addMegaphone()`/`changePassword()`/`update(name,picture)` (`User.java:117-154`) — 상태 변경용 도메인 메서드. OAuth 프로필 갱신은 `update()`가 닉네임·사진만 덮어쓴다.
  - `getRoleKey()` (`User.java:123`) — Spring Security용 role 문자열 그대로 반환.
- **연결**: `MatePost.author`(ManyToOne), `Wishlist.user`(ManyToOne)가 이 엔티티를 FK로 참조. `UserRepository`가 CRUD 담당. `boostPeriod`(YYYY-MM)/`agreedTermsVersion`은 서비스 레이어 정책(월별 부스트 리셋, 약관 재동의 강제)과 연동.
- **특이사항**: `email`/`phoneNumber` unique. `password`가 `nullable=false`라 소셜 가입 시에도 더미/인코딩 값이 반드시 채워져야 함(서비스 레이어 책임). role 문자열에 `ROLE_` 접두사 규칙 — 위반 시 인가 깨짐.

#### `popspot-backend/.../entity/PopupStore.java` — 팝업스토어 (수동/제보/자동수집 통합) 엔티티
- **책임**: `popup_store` 테이블. 수동등록·사용자제보·크롤링(CRAWLED) 팝업을 한 테이블에 담고, V4 자동수집/검수/Takedown 메타데이터를 추가로 보유. PK는 `popup_store_seq` 시퀀스 기반 `Long id`.
- **핵심 로직**:
  - `getImageUrl()` (`PopupStore.java:151-158`) — main flag(`mainYn="Y"`) row 우선 → 없으면 첫 이미지 → 둘 다 없으면 하드코딩 Unsplash fallback URL(`PopupStore.java:41-42`) 반환. 이미지 컬렉션은 LAZY(`PopupStore.java:104`)라 트랜잭션/EntityGraph 밖에서 호출 시 LazyInit 위험.
  - `updateAllDetails(Map<String,String>)` (`PopupStore.java:161-177`) — 외부 API가 보낸 Map을 부분 업데이트. `applyIfPresent`/`applyIntIfPresent` 헬퍼(`PopupStore.java:185-200`)로 null 값은 덮어쓰지 않고, 정수 파싱 실패는 조용히 무시.
  - 자동수집 필드군(`PopupStore.java:108-146`): `sourceType`(MANUAL/CRAWLED/USER_REPORT), `sourceUrl`(저작권 출처표시), `externalId`(SHA-256 중복방어, unique), `confidenceScore`(LLM 신뢰도 0~1), `reviewStatus`(AUTO_PUBLISHED/PENDING_REVIEW/APPROVED/REJECTED/TAKEDOWN), takedown 4종 필드.
- **연결**: `@OneToMany @JoinColumn(name="popup_id")`로 `PopupImage` 목록 보유(단방향, 양쪽 mappedBy 없음). `Goods`/`Stamp`/`Wishlist`/`ChatMessage`가 ManyToOne으로 이 엔티티를 가리킴. `PopupStoreRepository`가 핵심 조회/검수/만료 쿼리 담당.
- **특이사항**: 컬럼명 매핑 함정 — 필드 `location`이 DB 컬럼 `address`에, 필드 `address`가 DB 컬럼 `detail_address`에 매핑(`PopupStore.java:62-66`). 위경도(`latitude`/`longitude`)와 날짜(`startDate`/`endDate`)가 전부 `String`(ISO 형태라 사전식 비교에 의존). `externalId` unique 충돌이 중복수집 차단의 유일한 DB 방어선.

#### `popspot-backend/.../entity/Goods.java` — 팝업 굿즈(상품) 아이템
- **책임**: `GOODS` 테이블. 팝업스토어에 묶인 개별 상품(이름/가격/이미지/설명). PK는 IDENTITY 전략 `Long id`.
- **핵심 로직**: `@ManyToOne(LAZY) @JoinColumn("POPUP_ID")`로 부모 `PopupStore` 참조. `@JsonIgnore`(`Goods.java:44`)로 직렬화 시 부모를 잘라 순환참조/LazyInit 방지.
- **연결**: `GoodsRepository.findByPopupStore_Id(popupId)`로 팝업별 굿즈 조회. 부모는 `PopupStore`.

#### `popspot-backend/.../entity/Orders.java` — 주문 영수증 (결제 멱등성 보장)
- **책임**: `ORDERS` 테이블. 결제 1건의 영수증(`impUid`/`merchantUid`/금액/굿즈/주문일시). PK는 `orders_seq` 시퀀스 기반.
- **핵심 로직**: `@PrePersist prePersist()` (`Orders.java:59-62`)가 INSERT 시 `orderDate`를 현재시각으로 자동 세팅. `userId`/`goodsId`는 FK 관계가 아니라 평문 컬럼으로만 보관(비정규화).
- **연결**: `OrderRepository.existsByImpUid()`가 중복결제 방어, `findByUserId()`가 주문 이력 조회.
- **특이사항**: JavaDoc은 `impUid` unique 제약으로 재시도 idempotency를 보장한다고 명시하나, **엔티티 코드에는 `@Column(name="IMP_UID")`만 있고 `unique=true`가 없다**(`Orders.java:41-42`). 실제 unique 제약은 DB 스키마(Flyway 등) 쪽에 있어야 하며, 엔티티만 보면 보장이 누락된 것처럼 보이는 함정.

#### `popspot-backend/.../entity/PopupImage.java` — 팝업 이미지 갤러리 단건
- **책임**: `POPUP_IMAGE` 테이블. 팝업 이미지 한 장(`imageUrl` + 대표여부 `mainYn`). PK는 IDENTITY.
- **핵심 로직**: `mainYn="Y"`가 대표 이미지 플래그. 한 팝업당 정확히 하나만 Y가 되도록 하는 보장은 이 엔티티가 아니라 서비스 레이어 책임(JavaDoc 명시).
- **연결**: `PopupStore.images`가 `@JoinColumn("popup_id")`로 이 테이블을 단방향 소유. 여기엔 부모 역참조 필드가 없음. `PopupImageRepository`는 사실상 빈 CRUD.

#### `popspot-backend/.../entity/MatePost.java` — 동행 모집 게시글 (비정규화 참가자/신고자 명단)
- **책임**: `MATE_POST` 테이블. 동행 모집글(제목/내용/작성자/정원/대상팝업/상태). 참가자·신고자 명단을 join 테이블 없이 콤마 구분 문자열로 저장. 확성기 부스트/신고 자동숨김 상태 보유. PK는 `mate_post_seq` 시퀀스.
- **핵심 로직**:
  - `@PrePersist prePersist()` (`MatePost.java:98-107`) — `createdAt`/`status`(RECRUITING)/`currentPeople`(1) 기본값 세팅 + 작성자 ID를 `joinedUsers`에 자동 추가.
  - `hasReported(userId)` (`MatePost.java:134-140`) — `contains`가 아니라 `split(",")` + `equals` 토큰 단위 정확 일치로 판정. 한 ID가 다른 ID의 부분문자열일 때의 오탐 방지(예: "user1"이 "user12"에 매칭되는 문제).
  - `addReporter(userId)` (`MatePost.java:143-149`) — 1인 1신고 보장(중복 신고로 자동숨김 어뷰징 차단).
  - `hasJoined(userId)` (`MatePost.java:123-126`) — 방장은 무조건 통과, 그 외엔 `joinedUsers.contains(userId)`로 판정 — **여기는 토큰 단위가 아니라 단순 `contains`라 부분문자열 오탐 가능**(hasReported와 비대칭).
  - `increaseCurrentPeople()` (`MatePost.java:109-113`) — 정원 미만일 때만 증가.
- **연결**: `author`는 `@ManyToOne(EAGER) → User`. `chatMessages`는 `@OneToMany(mappedBy="matePost", cascade=ALL, orphanRemoval=true)`로 `MateChatMessage` 소유 → 글 삭제 시 채팅 cascade 삭제(`MatePost.java:70-72`). `MatePostRepository`가 숨김 제외 정렬 조회 담당.
- **특이사항**: `joinedUsers`/`reportedBy` 콤마 문자열은 정규화 포기(조회 단순화 목적, `length=2000` 상한). `author` EAGER 로딩 — 목록 조회 시 User join 항상 발생. `reportCount` 임계값 도달 시 `isHidden` 자동 true는 서비스 레이어가 수행(엔티티엔 임계 로직 없음).

#### `popspot-backend/.../entity/MateChatMessage.java` — 동행 게시글 채팅 메시지
- **책임**: `MATE_CHAT_MESSAGE` 테이블. 메이트 게시글의 채팅 메시지(발신자/내용/시각). PK는 `chat_msg_seq` 시퀀스.
- **핵심 로직**: `@PrePersist`(`MateChatMessage.java:53-58`)가 `sendTime` null일 때만 현재시각 세팅. `@ManyToOne(EAGER) → MatePost`.
- **연결**: `MatePost.chatMessages`의 역방향(`mappedBy="matePost"`). `MateChatMessageRepository.findByMatePostIdOrderBySendTimeAsc()`로 조회.
- **특이사항**: SEQUENCE 전략을 쓴 이유가 JavaDoc에 기록(`MateChatMessage.java:24-26`) — IDENTITY 시절 채팅 저장에서 ID가 NULL로 들어가던 사고를 SEQUENCE로 우회. `MatePost`와 같은 `chat_msg_seq_gen` 이름을 쓰지만 시퀀스명은 `chat_msg_seq`(소문자)로 `ChatMessage`의 `CHAT_MSG_SEQ`(대문자)와 별개.

#### `popspot-backend/.../entity/ChatMessage.java` — 팝업별 라이브 채팅 메시지
- **책임**: 팝업 상세 페이지의 STOMP/WebSocket 라이브 채팅 메시지. `@Table` 미지정(클래스명 기반 기본 테이블명). PK는 `CHAT_MSG_SEQ` 시퀀스.
- **핵심 로직**:
  - `@ManyToOne(EAGER) → PopupStore` (`ChatMessage.java:34-45`) — JavaDoc에 EAGER 이유 명시: WebSocket broadcast가 트랜잭션 밖에서 직렬화되므로 LAZY면 `LazyInitializationException` 발생.
  - `@JsonIgnoreProperties`로 `images`/`imageUrl`/`stamps`/`reviews`/`comments`/`hibernateLazyInitializer`/`handler`를 직렬화 제외(`ChatMessage.java:36-44`) — lazy 컬렉션 직렬화 폭주 차단.
  - 수동 생성자 `ChatMessage(popupStore, sender, message)` (`ChatMessage.java:51-56`)가 `sendTime`을 즉시 세팅(`@PrePersist` 없음).
- **연결**: `ChatRepository`가 방별 조회(`findByPopupStore_IdOrderBySendTimeAsc`)/티커용 최신 10개/발신자 카운트 담당.
- **특이사항**: 다른 엔티티와 달리 `@Setter`만 있고 `@Builder`/`@AllArgsConstructor` 없음(수동 생성자만). `@JsonIgnoreProperties`에 `stamps`/`reviews`/`comments` 같이 `PopupStore`에 실제로 존재하지 않는 필드명도 방어적으로 나열돼 있음(미래/타 버전 대비).

#### `popspot-backend/.../entity/Stamp.java` — 팝업 방문 스탬프 (복합 unique 중복방어)
- **책임**: `STAMP` 테이블. 사용자의 팝업 방문 스탬프(userId + 팝업 + 적립시각). PK는 IDENTITY.
- **핵심 로직**: `@UniqueConstraint(uk_stamp_user_popup, {USER_ID, POPUP_ID})` (`Stamp.java:35-38`)로 `(유저, 팝업)` 평생 중복 적립을 DB 차원에서 차단. 하루 1회 제한은 서비스 레이어(별도 시간 범위 검사)가 담당. `@PrePersist`가 `stampDate` 자동 세팅.
- **연결**: `userId`는 평문 컬럼(User FK 아님), `popupStore`만 `@ManyToOne(LAZY)`. `StampRepository`가 일일/평생 중복검사 + EntityGraph 조회 담당.
- **특이사항**: 동시성 race condition으로 중복 INSERT 시도 시 DB unique 제약이 최종 방어선(서비스 검사만으론 race 못 막음 — JavaDoc 명시).

#### `popspot-backend/.../entity/Wishlist.java` — 찜한 팝업 (사용자↔팝업 매핑)
- **책임**: `WISHLIST` 테이블. 사용자가 찜한 팝업 매핑. `(user_id, popup_store_id)` 복합 unique로 중복 찜 방지. PK는 IDENTITY.
- **핵심 로직**: `user`/`popupStore` 둘 다 `@ManyToOne(LAZY)`, FK `nullable=false`. `@Getter`만 있고 `@Setter` 없음 — 생성 후 불변(Builder/생성자로만 채움).
- **연결**: `WishlistRepository`가 존재여부 검사·삭제용 조회·만료알림 cron 조회 담당. `User`/`PopupStore`를 부모로 참조.

#### `popspot-backend/.../entity/MyCourse.java` — 사용자 저장 코스 (JSON 통째 보관)
- **책임**: `MY_COURSE` 테이블. 사용자가 저장한 코스(장소 목록+메모). PK는 `my_course_seq` 시퀀스.
- **핵심 로직**: `courseData`를 PostgreSQL `TEXT` 컬럼(`MyCourse.java:47-48`)으로 둬서 프론트가 직렬화한 JSON을 파싱 없이 통째 저장. `@PrePersist`가 `createdAt` 자동 세팅.
- **연결**: `userId`는 평문 컬럼(User FK 아님). `MyCourseRepository.findAllByUserId()`로 조회.
- **특이사항**: 코스 내부 구조(장소/순서)는 DB에서 비투명(opaque JSON) — 서버 측 쿼리/검증 불가, 무결성은 프론트 의존.

#### `popspot-backend/.../entity/Feedback.java` — 사용자 의견 1건 (로그인/비로그인 겸용)
- **책임**: `FEEDBACK` 테이블. 운영팀에 보낸 의견(카테고리/제목/내용/상태/관리자답변). 로그인·비로그인 모두 수용. PK는 `feedback_seq` 시퀀스.
- **핵심 로직**: `@PrePersist`(`Feedback.java:73-81`)가 `createdAt` + `status`(기본 `PENDING`) 세팅. `userId`는 로그인 사용자, 비로그인이면 NULL이고 답신용 `guestEmail`을 선택 입력. category/status를 enum 아닌 String으로 둠(DB 마이그레이션 자유 — JavaDoc 명시).
- **연결**: `FeedbackRepository`가 본인 목록/어드민 검수큐/상태별 카운트/SLA 카운트 담당.
- **특이사항**: category(BUG/FEATURE/GOOD/OTHER)·status(PENDING/REVIEWING/RESOLVED/WONT_FIX) 값 검증이 DB/엔티티엔 없음 → 서비스 레이어 의존.

#### `popspot-backend/.../entity/MusicTrack.java` — 음악 트랙 캐시 (Spotify+YouTube+Groq 무드)
- **책임**: `music_track` 테이블. Spotify 메타데이터 + YouTube 재생 ID + Groq 무드태그를 합친 트랙 캐시. quota 절약을 위해 영구 캐시로 운용. PK는 IDENTITY.
- **핵심 로직**:
  - `isCacheFresh()` (`MusicTrack.java:110-112`) — `youtubeVideoId`가 비어있지 않으면 캐시 신선(=외부 API 재호출 불필요)으로 판정. 한 번 매칭된 영상 ID는 거의 안 바뀌고 매 재호출 시 YouTube quota(10,000/day)가 닳기 때문.
  - `@PrePersist`(`MusicTrack.java:97-103`) — `cachedAt`/`createdAt`/`playCount`(0)/`isOfficial`(false) 기본값.
  - `playbackFailedCount`(`MusicTrack.java:85-86`) — 클라이언트 IFrame onError(101/150 embed차단, 100 비공개/삭제) 누적 카운터. 임계값 초과 시 검색 후보에서 자동 제외해 막힌 곡 회귀 차단.
  - `moodTags`는 Groq가 분석한 무드 JSON 배열(40개 화이트리스트 중 최대 5개)을 TEXT로 보관.
- **연결**: `MusicTrackRepository`가 인기/랜덤/무드/캐시청소/실패카운터 쿼리 담당. `UserMusicHistory.trackId`가 이 엔티티 ID를 평문으로 참조(FK 객체 관계 아님).
- **특이사항**: `itunesTrackId`(레거시)·`spotifyTrackId` 둘 다 unique지만 nullable — 신곡은 spotify만, 옛곡은 itunes만 채워질 수 있음. `youtubeChannel`은 실제로는 channelTitle을 담고 있어 cover/live/remix 키워드 검색에 쓰임.

#### `popspot-backend/.../entity/UserMusicHistory.java` — 사용자별 청취 기록
- **책임**: `user_music_history` 테이블. 사용자 음악 청취 기록(음악 패스포트 화면 + 추천 큐 보충용). PK는 IDENTITY.
- **핵심 로직**: `@PrePersist`(`UserMusicHistory.java:47-50`)가 `playedAt` 자동 세팅. `matchedPopupId`는 그 곡 재생 시 함께 추천된 팝업 ID(있으면) — "이 곡 들었던 날 본 팝업" 표시용.
- **연결**: `userId`/`trackId`/`matchedPopupId` 모두 평문 컬럼(객체 FK 관계 없음 — `MusicTrack`/`PopupStore`와 느슨 결합). `UserMusicHistoryRepository`가 최신순 조회 + 중복 카운트 담당.

#### `popspot-backend/.../entity/SpotifyAuth.java` — Spotify OAuth 토큰 저장 (암호화)
- **책임**: `spotify_auth` 테이블. popspot 사용자가 자기 Spotify 계정을 연결하면 1 row 생성. Web Playback SDK용 access/refresh 토큰을 암호화 보관. PK는 IDENTITY.
- **핵심 로직**:
  - `@PrePersist`/`@PreUpdate`(`SpotifyAuth.java:64-74`) — 생성 시 `createdAt`/`updatedAt`/`isPremium`(false), 수정 시 `updatedAt` 갱신.
  - 토큰은 평문 금지(Spotify Developer Policy + PIPA) — AES-256 GCM 암호화 Base64 문자열을 `accessTokenEncrypted`/`refreshTokenEncrypted`(TEXT, nullable=false)에 보관(`SpotifyAuth.java:46-50`).
  - `userId` unique(`SpotifyAuth.java:40`) — 사용자당 Spotify 연결 1개. access_token 1시간 만료라 `expiresAt` 기준 refresh로 갱신.
- **연결**: `SpotifyAuthRepository.findByUserId()` 조회, `deleteByUserId()`로 회원 탈퇴 시 토큰 즉시 삭제. JavaDoc은 FK ON DELETE CASCADE도 언급(스키마 레벨).
- **특이사항**: 암호화 자체는 서비스 레이어 책임(엔티티는 암호문 문자열만 받음). PIPA/약관상 탈퇴 시 즉시 파기 의무 — `deleteByUserId`가 그 경로.

#### `popspot-backend/.../repository/UserRepository.java` — 회원 CRUD + 조회 파생 메서드
- **책임**: `JpaRepository<User, String>`(ID 타입 String=UUID). 이메일/닉네임/전화번호 기반 조회와 중복검사 파생 메서드 제공.
- **핵심 로직**: `findByEmail`(로그인), `existsByEmail`/`existsByNickname`(가입 중복검사), `findByPhoneNumber`·`findByNicknameAndPhoneNumber`(계정 찾기), `findByNickname`(관리자가 닉네임으로 보상 지급). 전부 메서드명 파생 쿼리, `@Query` 없음.
- **연결**: `User` 엔티티 대상. Auth/회원/관리자 서비스가 호출(피호출).
- **특이사항**: 주석에 ID 타입을 `<User, String>`으로 "복구"했다는 흔적 — 과거 ID 타입을 잘못 바꿔 깨졌던 이력.

#### `popspot-backend/.../repository/PopupStoreRepository.java` — 팝업 핵심 조회/검수/만료/메트릭 (가장 복잡)
- **책임**: `JpaRepository<PopupStore, Long>`. 카테고리/검색/인기/캘린더 조회, 자동수집 중복방어, 만료 일괄처리, 검수 큐, Takedown SLA, 어드민 메트릭까지 전 영역 쿼리 집약. 배정 리포지토리 중 가장 큼.
- **핵심 로직**:
  - N+1 방어 — `findByCategory`/`findTop4ByOrderByViewCountDesc`/`findByNameContainingOrLocationContaining`/`findByStatus`/`findAll`(override) 모두 `@EntityGraph(attributePaths={"images"})`로 이미지 즉시 fetch(`PopupStoreRepository.java:18-39`).
  - `findAllPublic()` (`PopupStoreRepository.java:69-76`) — "보여줄 수 있는" 팝업 통일 필터: `status NOT IN ('PENDING','EXPIRED')` AND `reviewStatus IS NULL/AUTO_PUBLISHED/APPROVED`. PENDING_REVIEW/REJECTED/TAKEDOWN 차단.
  - `findCalendarRange(from,to)` (`PopupStoreRepository.java:82-94`) — 날짜 구간 겹침(`startDate<=:toDate AND endDate>=:fromDate`). startDate/endDate가 String이지만 ISO라 사전식 비교 안전(JavaDoc 명시).
  - `findToExpire(today)` + `@Modifying markExpired(ids)` (`PopupStoreRepository.java:113-125`) — 만료 대상 조회 후 `status='EXPIRED'` 일괄 UPDATE. 만료 cron의 2단계.
  - `findCrawledMissingCoordinates()` (`PopupStoreRepository.java:127-135`) — CRAWLED인데 위경도 비거나 빈문자열인 row(geocoding backfill 대상).
  - 어드민 메트릭(`PopupStoreRepository.java:141-164`): `countCrawledSince`(시각 이후 수집 수), `averageConfidenceSince`(평균 신뢰도, row 없으면 COALESCE 0), `countPendingReview`(검수 대기), `countTakedownOlderThan`(24h SLA 위반 Takedown 카운트).
  - `findByExternalId()` (`PopupStoreRepository.java:63`) — SHA-256 기반 중복수집 방어 조회.
- **연결**: `PopupStore`+`PopupImage`(EntityGraph) 대상. 팝업 서비스·만료/백필 cron·어드민 대시보드·캘린더 API가 호출.
- **특이사항**: `findTrending`(`PopupStoreRepository.java:48-51`)와 `findTrendingPublic`(`PopupStoreRepository.java:96-105`)이 거의 동일(둘 다 PENDING 제외 + viewCount 정렬)하나 후자가 EXPIRED+reviewStatus까지 더 엄격 — 중복에 가까운 두 메서드 공존. `markExpired`는 `@Modifying`이지만 `@Transactional`이 메서드에 없어 호출 측 트랜잭션 경계 필요(MusicTrack 리포와 대비). 날짜 비교가 String 사전식이라 날짜 포맷이 ISO(YYYY-MM-DD)에서 벗어나면 조용히 오작동.

#### `popspot-backend/.../repository/MatePostRepository.java` — 동행 게시글 조회 (숨김 제외 정렬)
- **책임**: `JpaRepository<MatePost, Long>`. 사용자 목록용 정렬 조회 + 작성자별 카운트.
- **핵심 로직**: `findAllByOrderByIsMegaphoneDescCreatedAtDesc()` (`MatePostRepository.java:10-13`) — 메서드명은 파생형이지만 실제로는 `@Query`로 `isHidden=false`(신고 자동차단 글 제외) 필터 후 확성기 우선(`isMegaphone DESC`) → 최신순 정렬. `countByAuthor_UserId(userId)`로 본인 작성글 수 집계.
- **연결**: `MatePost`(+EAGER로 `author` 동반) 대상. 메이트 게시판 서비스가 호출.
- **특이사항**: 메서드명과 실제 쿼리 동작이 불일치(이름엔 isHidden 필터가 안 드러남) — 이름만 보면 숨김 글도 포함될 것 같지만 `@Query`가 제외함.

#### `popspot-backend/.../repository/GoodsRepository.java` — 굿즈 조회
- **책임**: `JpaRepository<Goods, Long>`. 팝업 ID로 굿즈 목록 조회(`findByPopupStore_Id`).
- **연결**: `Goods` 대상, 부모 `PopupStore.id` 경로 탐색. 굿즈/팝업 상세 서비스가 호출.

#### `popspot-backend/.../repository/OrderRepository.java` — 주문 조회 + 중복결제 방어
- **책임**: `JpaRepository<Orders, Long>`. 사용자 주문 이력(`findByUserId`) + `existsByImpUid`(동일 imp_uid 중복결제 차단).
- **연결**: `Orders` 대상. 결제 서비스가 결제 검증 시 `existsByImpUid`로 멱등성 확인.

#### `popspot-backend/.../repository/ChatRepository.java` — 팝업 라이브 채팅 조회
- **책임**: `JpaRepository<ChatMessage, Long>`. 방(팝업)별 채팅 시간순 조회 + 메인 티커용 최신 10개 + 발신자별 카운트.
- **핵심 로직**: `findByPopupStore_IdOrderBySendTimeAsc(roomId)`(상세 페이지), `findTop10ByOrderBySendTimeDesc()`(메인 티커), `countBySender(sender)`. 전부 파생 쿼리.
- **연결**: `ChatMessage`(+EAGER `PopupStore`) 대상. WebSocket/채팅 서비스가 호출.

#### `popspot-backend/.../repository/MateChatMessageRepository.java` — 동행 채팅 조회
- **책임**: `JpaRepository<MateChatMessage, Long>`. 게시글 ID로 채팅 시간순 조회(`findByMatePostIdOrderBySendTimeAsc`).
- **연결**: `MateChatMessage`(+EAGER `MatePost`) 대상. 메이트 채팅 서비스가 호출.

#### `popspot-backend/.../repository/StampRepository.java` — 스탬프 중복검사 + 적립 조회
- **책임**: `JpaRepository<Stamp, Long>`. 일일/평생 중복 적립 검사 + 사용자 스탬프 목록 + 카운트.
- **핵심 로직**:
  - `existsByUserIdAndStampDateBetween(userId, startOfDay, endOfDay)` (`StampRepository.java:16-17`) — 하루 1회 제한용(서비스가 오늘 00:00~24:00 범위 전달).
  - `existsByUserIdAndPopupStore_Id(userId, popupId)` (`StampRepository.java:20`) — 특정 팝업 평생 중복 검사.
  - `findAllByUserId(userId)` (`StampRepository.java:25-26`) — `@EntityGraph({"popupStore","popupStore.images"})`로 2단계 깊이 fetch. `popupStore`만 fetch하면 `getImageUrl()`이 세션 닫힌 뒤 images를 lazy 로드하다 LazyInit 터지던 사고 회피(주석 명시, `open-in-view=false` 호환).
  - `countByUserId(userId)` — 전체 row 안 끌고 DB 카운트만.
- **연결**: `Stamp`+`PopupStore`+`PopupImage` 대상. 스탬프 적립/마이페이지 서비스가 호출.
- **특이사항**: 일일 제한과 평생 제한 검사를 서비스가 둘 다 호출해야 정책이 완성됨(엔티티 unique는 평생만 보장).

#### `popspot-backend/.../repository/WishlistRepository.java` — 찜 조회/중복검사 + 만료알림 cron
- **책임**: `JpaRepository<Wishlist, Long>`. 사용자 찜 목록·존재검사·삭제용 조회·카운트 + 만료 D-3 메일 cron용 조회.
- **핵심 로직**:
  - `findAllByUser_UserIdOrderByIdDesc(userId)` (`WishlistRepository.java:15-16`) — `@EntityGraph({"popupStore","popupStore.images"})`로 직렬화 시 LazyInit 방어(open-in-view=false 환경).
  - `existsByUser_UserIdAndPopupStore_Id` / `findByUser_UserIdAndPopupStore_Id` — 중복 찜 검사 / 찜 토글·삭제용 단건 조회.
  - `findWithUserAndPopupByEndDate(targetDate)` (`WishlistRepository.java:33-35`) — `@Query` + `@EntityGraph({"popupStore","user"})`로 특정 종료일 팝업을 찜한 위시+사용자를 한 번에 fetch(메일 발송 시 LazyInit 방지). 위시 만료 cron 전용.
- **연결**: `Wishlist`+`PopupStore`+`User`+`PopupImage` 대상. 찜 서비스·마이페이지·만료알림 cron이 호출.

#### `popspot-backend/.../repository/MyCourseRepository.java` — 코스 조회
- **책임**: `JpaRepository<MyCourse, Long>`. 사용자별 코스 목록(`findAllByUserId`) 파생 쿼리 1개.
- **연결**: `MyCourse` 대상. 코스 서비스가 호출.

#### `popspot-backend/.../repository/FeedbackRepository.java` — 의견 조회 + 어드민 검수 + SLA
- **책임**: `JpaRepository<Feedback, Long>`. 본인 의견 목록 + 어드민 상태필터 검수큐 + 상태별 카운트 + SLA 카운트.
- **핵심 로직**:
  - `findAllByUserIdOrderByCreatedAtDesc(userId)` — 본인 의견 최신순.
  - `findForAdmin(status, pageable)` (`FeedbackRepository.java:17-21`) — `:status IS NULL OR f.status=:status` 패턴으로 status가 null이면 전체, 있으면 필터(동적 조건 한 줄 구현).
  - `countByStatus(status)`(대시보드 메트릭), `countOlderThan(status, cutoff)` (`FeedbackRepository.java:27-28`) — SLA 알림용 cutoff 이전 미처리 카운트.
- **연결**: `Feedback` 대상. 사용자 의견 서비스·어드민 피드백 컨트롤러·SLA 알림 cron이 호출.

#### `popspot-backend/.../repository/MusicTrackRepository.java` — 트랙 캐시 조회/랜덤/무드/실패카운터 (복잡)
- **책임**: `JpaRepository<MusicTrack, Long>`. ID 조회, 인기/랜덤/무드 매칭, cover 캐시 일괄청소, 재생 실패 카운터까지. 음악 도메인 핵심 리포.
- **핵심 로직**:
  - `findByItunesTrackId`/`findBySpotifyTrackId` — 외부 트랙 ID로 캐시 hit 검사.
  - `findTopPlayed(pageable)` / `findAllWithMood(pageable)` (`MusicTrackRepository.java:19-39`) — youtubeVideoId 있는 곡 한정 인기/무드 조회.
  - `findRandomWithMood()` (`MusicTrackRepository.java:24-34`) — **nativeQuery** `ORDER BY RANDOM() LIMIT 1`(PostgreSQL 전용)로 무드 있는 곡 랜덤 1곡("운명의 곡 룰렛").
  - `findLikelyNonOfficialCached()` (`MusicTrackRepository.java:48-55`) — youtubeChannel에 cover/커버/remix/live 포함 OR `isOfficial=false`인 캐시 트랙 일괄 조회(어드민 cover 청소용).
  - `clearYoutubeCacheByIds(ids)` (`MusicTrackRepository.java:58-63`) — `@Modifying @Transactional`로 youtubeVideoId/Channel=NULL + isOfficial=false 일괄 비움 → 다음 재생 시 재선택.
  - `incrementPlaybackFailed(id)` (`MusicTrackRepository.java:69-74`) — `@Modifying @Transactional` 단일 SQL UPDATE로 `playbackFailedCount = COALESCE(...,0)+1`. race 무관 원자 증가.
  - `countPlaybackBlocked(threshold)` (`MusicTrackRepository.java:77-80`) — 임계값 이상 실패 트랙 수(어드민 embed 차단 통계).
- **연결**: `MusicTrack` 대상. 음악 검색/추천 서비스·어드민 캐시청소 엔드포인트·재생 실패 리포팅이 호출.
- **특이사항**: `findRandomWithMood`만 nativeQuery라 PostgreSQL `RANDOM()`에 묶임(DB 이식성 ↓). `@Modifying` 메서드 3개는 자체 `@Transactional`을 달아 호출 측 트랜잭션 없이도 동작(PopupStore의 markExpired와 대비되는 패턴).

#### `popspot-backend/.../repository/UserMusicHistoryRepository.java` — 청취 기록 조회
- **책임**: `JpaRepository<UserMusicHistory, Long>`. 사용자 최근 청취(최신순 페이징) + 동일 곡 중복 등록 방지 카운트.
- **핵심 로직**: `findByUserIdOrderByPlayedAtDesc(userId, pageable)`(패스포트 화면/추천 보충), `countByUserIdAndTrackId(userId, trackId)`(중복 등록 방지). 둘 다 파생 쿼리.
- **연결**: `UserMusicHistory` 대상. 음악 패스포트/재생 기록 서비스가 호출.

#### `popspot-backend/.../repository/SpotifyAuthRepository.java` — Spotify 토큰 조회/삭제
- **책임**: `JpaRepository<SpotifyAuth, Long>`. 사용자별 토큰 조회 + 탈퇴 시 토큰 삭제.
- **핵심 로직**: `findByUserId(userId)`(토큰 로드/갱신), `deleteByUserId(userId)` (`SpotifyAuthRepository.java:14-16`) — `@Modifying @Transactional`로 회원 탈퇴 시 즉시 삭제(PIPA + Spotify 약관 의무).
- **연결**: `SpotifyAuth` 대상. Spotify 연동/토큰 갱신 서비스·회원 탈퇴 플로우가 호출.

#### `popspot-backend/.../repository/PopupImageRepository.java` — 팝업 이미지 기본 CRUD
- **책임**: `JpaRepository<PopupImage, Long>`. 커스텀 메서드 없는 순수 CRUD(`deleteByPopupStore`는 주석 처리됨).
- **연결**: `PopupImage` 대상. 이미지 등록/관리 서비스가 기본 save/delete로 호출.
- **특이사항**: 주석 처리된 `deleteByPopupStore` 흔적만 남음 — 현재는 이미지 삭제를 다른 경로(PopupStore의 `@JoinColumn` 단방향 관리 또는 직접 delete)로 처리.

**전체 연결 관계 요약**: `PopupStore`가 도메인 허브로 `PopupImage`(소유, 단방향 @JoinColumn) · `Goods`/`Stamp`/`Wishlist`/`ChatMessage`(자식 ManyToOne)가 모여듦. `User`는 `MatePost.author`/`Wishlist.user`만 객체 FK로 연결되고, `Stamp`/`MyCourse`/`Orders`/`Feedback`/`UserMusicHistory`/`SpotifyAuth`는 `userId`를 평문 컬럼으로 느슨하게 참조(객체 관계 없음). 음악 도메인(`MusicTrack`↔`UserMusicHistory`↔`SpotifyAuth`)도 ID 평문 참조로 느슨 결합. N+1/LazyInit 방어가 리포지토리 전반의 핵심 패턴(`@EntityGraph`로 `images`까지, 채팅은 EAGER+`@JsonIgnore(Properties)`). PK 전략은 PostgreSQL 환경 때문에 SEQUENCE(PopupStore/Orders/MatePost/MateChatMessage/ChatMessage/MyCourse/Feedback)와 IDENTITY(Goods/PopupImage/Stamp/Wishlist/MusicTrack/UserMusicHistory/SpotifyAuth)가 혼재하고, User만 애플리케이션 생성 UUID String.

## B8 — 백엔드 · DTO / model / mapper / 예외 / 리소스

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/CalendarPopupDto.java` — 캘린더 위젯용 경량 팝업 DTO
- **책임**: 프론트 캘린더가 소비하는 최소 필드만 담아 `PopupStore` 엔티티 전체 직렬화의 페이로드 과대 + LAZY 로딩 위험을 차단(`CalendarPopupDto.java:7`).
- **핵심 로직**: `fromEntity(PopupStore p)` 정적 팩토리가 Lombok `@Builder`로 9개 필드만 매핑(`:21-33`). `sourceType`(MANUAL/CRAWLED)은 "자동수집" 뱃지용, `sourceUrl`은 저작권법 출처표시용으로 의도적으로 노출(`:18-19`).
- **연결**: `entity.PopupStore` 의존. 캘린더 데이터를 내려주는 서비스/컨트롤러가 이 팩토리를 호출(피호출). Lombok `@Data @Builder`.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/CourseSaveRequestDto.java` — 코스 저장 요청 DTO
- **책임**: 사용자가 짠 코스를 저장할 때 `userId`/`courseName`/`courseData` 3필드를 받는 단순 요청 바디.
- **특이사항**: Bean Validation 애너테이션이 전혀 없다. `userId`를 클라이언트가 직접 담는 구조라 컨트롤러/서비스 단에서 토큰 주체와 일치 검증이 없으면 IDOR 소지(타 DTO는 토큰에서 userId를 채우는 패턴을 명시함 — 이 DTO는 그렇지 않음).
- **연결**: 코스 저장 컨트롤러가 `@RequestBody`로 수신. `MyCourse` 엔티티로 변환되어 저장될 것으로 보임(응답은 `MyCourseResponseDto`).

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/LoginRequestDto.java` — 로컬 로그인 요청 DTO
- **책임**: 이메일/비밀번호 로그인 입력. `@Getter @NoArgsConstructor`만 — Jackson 역직렬화용.
- **특이사항**: 검증 애너테이션 없음(로그인은 형식보다 인증 결과로 거르므로 의도된 설계로 보임). setter가 없어 Jackson은 필드 직접 주입.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/PopupReportRequestDto.java` — 팝업 제보 요청(Mass Assignment 방어) DTO
- **책임**: 사용자 팝업 제보 시 **허용 필드만** 명시 수신. `PopupStore` 엔티티를 그대로 받으면 `id`/`status`/`viewCount` 등을 클라이언트가 임의 주입해 저장되는 취약점을 차단(`:9-11`).
- **핵심 로직**: `name`/`location`은 `@NotBlank`+`@Size`, `category`/`description`/`imageUrl`/`startDate`/`endDate`는 `@Size`만. 길이 상한으로 저장소 오염/과대 입력 방지.
- **특이사항**: 보안 핵심 DTO. 엔티티 직접 바인딩 금지 패턴의 대표 사례. 검증 실패는 `GlobalExceptionHandler`가 400으로 변환.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/PopupTakedownRequestDto.java` — 권리자 takedown 요청 DTO
- **책임**: 자동수집된 팝업이 부정확/저작권 침해일 때 권리자가 내리기 요청하는 폼. 이용약관 §10 신고창구 데이터(`:8`).
- **핵심 로직**: `requesterEmail` `@NotBlank @Email`, `reason` `@NotBlank @Size(max=500)`.
- **연결**: takedown 컨트롤러가 수신 → `popup_store.review_status='TAKEDOWN'` + `takedown_*` 컬럼(V4) 갱신으로 이어진다. 운영자 알림은 `popspot.crawler.takedown-notify-email`(properties §18) 및 SLA cron(§20)과 연동.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/StampRequest.java` — 스탬프 적립 요청 DTO
- **책임**: `userId`+`popupId`로 방문 스탬프 적립 요청. `@Getter @Setter`.
- **특이사항**: 검증 없음. 중복 적립은 DTO가 아니라 DB 유니크 제약(V2 `uk_stamp_user_popup`)으로 race condition까지 차단된다 — DTO와 스키마가 한 쌍으로 동작.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/auth/OAuthAttributes.java` — OAuth2 프로바이더 속성 정규화 DTO
- **책임**: Google/Kakao/Naver의 서로 다른 사용자 응답 JSON 구조를 공통 형태(`name`/`email`/`picture`/`provider`)로 통일(`:7-12`).
- **핵심 로직**:
  - `of(registrationId, userNameAttributeName, attributes)`가 프로바이더 분기 디스패처(`:43-52`) — naver→`ofNaver`, kakao→`ofKakao`, 그 외→`ofGoogle`(기본값이 Google).
  - `ofGoogle`: 최상위 키에서 직접 추출(`:54-64`).
  - `ofKakao`: `kakao_account.profile` 중첩에서 `nickname`/`profile_image_url`, 이메일은 `kakao_account.email`(`:67-80`). 무체크 캐스트라 `@SuppressWarnings("unchecked")`.
  - `ofNaver`: `response` 래퍼 안에서 추출하고, `attributes` 자체도 `response`로 교체 저장(`:83-95`) — 이후 Spring Security가 nameAttributeKey(`id`)를 `response` 맵 기준으로 찾도록.
- **특이사항**: Kakao/Naver는 중첩 맵을 가정하고 캐스팅하므로, 프로바이더 스코프 미동의 등으로 `kakao_account`/`profile`/`response`가 누락되면 NPE/ClassCastException 가능 → 상위에서 OAuth2 예외로 처리될 것. `attributes` 키 이름(`id`/`response`)은 properties의 `user-name-attribute` 설정과 정확히 짝.
- **연결**: 커스텀 `OAuth2UserService`가 `of(...)`를 호출(피호출), `entity.User` upsert로 연결. properties §7~9의 OAuth 등록 정보에 의존.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/CongestionDto.java` — 성수동 실시간 혼잡도+날씨 응답 DTO
- **책임**: 혼잡도 4단계(`level`: 여유/보통/약간 붐빔/붐빔)+메시지+인구 범위(min/maxPop)+날씨(temp/sky/rainChance)+12시간 예측(`forecast`)+연령대 비율(`ageRates`) 묶음(`:9-13`).
- **핵심 로직**: 순수 데이터 홀더. `forecast`는 `List<Map<String,String>>`(`{"time":"14:00","pop":"3200"}`), `ageRates`는 `Map<String,Double>`.
- **연결**: 서울 열린데이터 API(`seoul.api.key`, properties §11) + 기상 데이터를 가공하는 혼잡도 서비스가 채워 반환. `@Data @AllArgsConstructor @NoArgsConstructor`.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/LoginResponseDto.java` — 로그인 성공 응답 DTO
- **책임**: 로그인 성공 시 `userId`/`email`/`nickname`/`role`/`token`(JWT)/`isPremium`/`megaphoneCount` 반환.
- **핵심 로직**: `isPremium`이 boolean이라 Jackson 기본 직렬화가 `premium` 키로 나가는 것을 `@JsonProperty("isPremium")`으로 강제 고정(`:11-13`, `:24-25`) — 프론트 계약 유지를 위한 함정 회피.
- **연결**: 인증 컨트롤러가 JWT 발급 후 반환. `megaphoneCount`는 V8에서 등급별 부스트로 정책이 바뀌었지만 호환 위해 잔존하는 레거시 필드.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/MyPageDto.java` — 마이페이지 요약 응답 DTO
- **책임**: 닉네임/프리미엄 여부/만료일/부스트(메가폰)수/스탬프·좋아요·리뷰 카운트 집계 응답.
- **핵심 로직**: `LoginResponseDto`와 동일하게 `isPremium` 키를 `@JsonProperty`로 고정(`:11`, `:18`). `premiumExpiryDate`는 `LocalDateTime`(타임존은 properties `spring.jackson.time-zone=Asia/Seoul`).
- **연결**: 마이페이지 서비스가 여러 Repository 카운트를 모아 빌드. `stampCount`는 V10 `idx_stamp_user_id` 인덱스로 가속되는 `countByUserId`와 연관.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/PlanningPlace.java` — 계획 보드 장소 카드 DTO
- **책임**: 동행 계획 보드의 장소 카드(id/name/lat/lng/category)와 투표 카운트(`likeCount`=좋아요, `fireCount`="가자!").
- **핵심 로직**: `@Builder.Default`로 두 카운트 초기값 0 보장(`:25-26`) — Builder 사용 시 누락돼도 null/미초기화 방지. 클라이언트가 STOMP로 실시간 증분 수신(`:11-12`).
- **연결**: WebSocket/STOMP 기반 실시간 계획 보드 서비스가 사용. `VoteRequest`로 들어온 투표가 이 카운트를 증분.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/SignupRequestDto.java` — 회원가입 요청 DTO
- **책임**: 가입 입력(email/password/nickname/phoneNumber)의 형식·강도·필수 여부를 컨트롤러 진입 직후 Bean Validation으로 검증(`:10-15`).
- **핵심 로직**:
  - 비밀번호 정규식 `PASSWORD_REGEX`(`:21-22`): 영문+숫자+특수문자(`@$!%*#?&`) 각 1개 이상, 8~20자. lookahead 조합.
  - 전화번호 정규식 `PHONE_REGEX`(`:23`): `^010\d{8}$` (010 + 8자리).
  - 각 필드에 한국어 메시지 명시(`:25-38`).
- **특이사항**: 정규식은 특수문자 집합을 화이트리스트로 제한하므로 그 외 기호(예: `^`,`-`)는 거부됨. 검증 실패 → `MethodArgumentNotValidException` → `GlobalExceptionHandler` 400.
- **연결**: 회원가입 컨트롤러 `@Valid @RequestBody`. 통과 시 `entity.User` 생성. 가입 시점에 `agreed_terms_version`(V11)을 현재 버전으로 박는 흐름과 연계.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/VoteRequest.java` — 계획 보드 투표 요청 DTO
- **책임**: 장소 카드 투표 입력(`placeId`+`voteType`). `voteType`은 "LIKE"/"FIRE"만 허용, enum 변환은 컨트롤러에서(`:7-8`).
- **특이사항**: DTO 자체엔 enum 제약이 없어 잘못된 `voteType` 거부는 컨트롤러 변환 로직 책임(거기서 `IllegalArgumentException` 시 400).
- **연결**: `PlanningPlace`의 `likeCount`/`fireCount` 증분 트리거.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/WishlistResponseDto.java` — 찜 목록 행 응답 DTO
- **책임**: 마이페이지 찜 목록 각 행(`wishlistId`,`popupId`,`popupName`,`popupImage`,`location`,`startDate`,`endDate`).
- **연결**: 위시리스트 조회 서비스가 `Wishlist`+`PopupStore` 조인 결과를 매핑. V10 `idx_wishlist_user_id`/`idx_wishlist_popup_store`로 가속. 위시 만료 D-3 메일 cron(properties §21)도 같은 조인 경로 사용.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/MyCourseResponseDto.java` — 내 코스 조회 응답 DTO
- **책임**: `MyCourse` 엔티티 직접 직렬화의 LAZY/내부 컬럼 노출을 API 경계에서 차단하면서 프론트 필드명 유지(`:8-12`).
- **핵심 로직**: 전 필드 `final` + `fromEntity(MyCourse)` 정적 팩토리(`:23-31`). 불변 응답 객체.
- **연결**: 코스 조회 컨트롤러가 호출(피호출), 입력은 `CourseSaveRequestDto`. v2.9-R2C "엔티티→DTO 분리" 작업 산물로 보임.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/FeedbackCreateRequestDto.java` — 의견 보내기 작성 요청 DTO
- **책임**: 의견 작성 입력. 로그인 사용자는 `userId`를 토큰에서 채우므로 DTO에 없음, 게스트는 답신용 이메일을 선택 입력(`:8-12`).
- **핵심 로직**: `category`(BUG/FEATURE/GOOD/OTHER) `@NotBlank @Size(32)`, `title` `@NotBlank @Size(200)`, `content` `@NotBlank @Size(4000)`, `guestEmail` `@Email @Size(255)`(선택, `@NotBlank` 없음 → 비워도 통과).
- **연결**: 사용자 FeedbackController `@Valid` 수신 → `feedback` 테이블(V7). `content` 4000자 상한은 V7 `content TEXT`와 정합.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/FeedbackReplyRequestDto.java` — 어드민 답변+상태변경 요청 DTO
- **책임**: 어드민이 의견에 답변과 상태를 동시에(또는 따로) 보내는 DTO(`:7-10`).
- **핵심 로직**: `adminReply` `@Size(4000)`만(비우면 미작성). `status` `@NotBlank @Size(32)` — PENDING/REVIEWING/RESOLVED/WONT_FIX(`:19-22`). 둘 다 빈 요청은 서비스 단에서 거부(주석 명시이나 `status`가 `@NotBlank`라 사실상 status는 필수).
- **연결**: `AdminFeedbackController`가 수신 → `feedback.status`/`admin_reply`/`replied_at`(V7) 갱신.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/FeedbackResponseDto.java` — 의견 단건 응답 DTO
- **책임**: 사용자 본인 목록과 어드민 검수 큐가 **동일 모양**으로 공유하는 응답(`:10-14`).
- **핵심 로직**: `fromEntity(Feedback f)` 정적 팩토리로 10개 필드 전체 매핑(`:33-46`). `guestEmail`/`userId`/`adminReply`/`repliedAt` 포함.
- **특이사항**: 사용자/어드민이 같은 DTO를 쓰므로 사용자 본인 응답에도 `guestEmail` 등 전 필드가 노출됨 — 어드민 전용 필드가 생기면 분리 필요(주석에 명시). 현재는 동일 모양이라 통합.
- **연결**: 사용자/어드민 양쪽 FeedbackController가 반환. `Feedback` 엔티티(V7) 의존.

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/MateDto.java` — 동행 게시글 작성 DTO
- **책임**: 메이트(동행) 글 작성 입력(userId/title/content/targetPopup/maxPeople/useBoost).
- **핵심 로직**: `@NoArgsConstructor`는 Jackson 역직렬화용(setter 호출 전 빈 인스턴스 생성, `:9-10`). `useBoost`(`:22-26`)는 v2.12에서 옛 `useMegaphone`의 의미를 그대로 이어받은 상단 부스트 요청 플래그 — 프론트는 `useBoost` 이름으로 전송.
- **특이사항**: 검증 애너테이션 없음. `useBoost`는 등급별 월 한도 안에서만 허용되며 한도 추적은 V8 `boost_used_count`/`boost_period` + 서비스 로직 담당.
- **연결**: 메이트 컨트롤러 수신 → `mate_post` 테이블(V8/V9/V14 확장).

#### `popspot-backend/src/main/java/com/example/popspotbackend/dto/PopupSearchDto.java` — Algolia 인덱싱용 경량 DTO
- **책임**: Algolia 색인용 팝업 문서. v2.13부터 정확도(`confidence`)/유효(`status`,`endDate`) 필드를 함께 인덱싱해 프론트+백엔드 이중 방어(`:10-16`).
- **핵심 로직**:
  - `objectID`는 Algolia 필수 키라 엔티티 id를 String으로(`:8`, `:46`).
  - `fromEntity(PopupStore)`가 빌드(`:44-57`). `confidence`는 `BigDecimal→Double` 변환(`toDouble`, `:59-61`), `endDate`는 ISO 포맷팅(`formatDate`, `:63-70`).
  - `formatDate`는 파싱 실패 시 **원본 그대로 반환**(`:67-68`) — 클라가 best-effort 처리하도록 예외를 삼킴.
  - `confidence` 0.80 미만은 인덱싱 자체에서 거부되지만 프론트도 재가드(`:38`).
- **특이사항**: `endDate`가 오늘보다 과거면 프론트가 결과에서 제외(만료 숨김). 백엔드 인덱싱 시점 필터와 프론트 필터가 이중으로 작동.
- **연결**: Algolia 동기화 서비스가 호출(`algolia.app-id`/`algolia.api-key`, properties §11). `PopupStore`의 `confidenceScore`/`reviewStatus`/`status`(V4)에 의존.

#### `popspot-backend/src/main/java/com/example/popspotbackend/exception/ResourceNotFoundException.java` — 도메인 리소스 미존재 예외
- **책임**: User/PopupStore/MatePost/MusicTrack 미발견 시 던지는 `RuntimeException` 파생 예외. `orElseThrow(...)` 패턴용(`:3-10`).
- **핵심 로직**: 도메인별 정적 팩토리 4개 — `user(String)`/`popup(Long)`/`matePost(Long)`/`musicTrack(Long)`(`:18-32`)로 메시지 포맷("X not found: id")을 일관 유지.
- **특이사항**: 기존 `new RuntimeException("유저 없음")`를 격상한 것(`:9-10`) — 컴파일러가 호출 지점 추적 가능, 메시지 일관성. 정적 팩토리에 매핑된 4개 엔티티가 이 예외의 실제 사용처 힌트.
- **연결**: 서비스 레이어가 throw, `GlobalExceptionHandler.handleNotFound`가 catch → 404.

#### `popspot-backend/src/main/java/com/example/popspotbackend/exception/GlobalExceptionHandler.java` — 전역 예외 → 표준 HTTP 응답 변환
- **책임**: `@RestControllerAdvice`로 전 컨트롤러 예외를 `{status,error,message,timestamp}` 표준 규격으로 변환. 운영에서 스택트레이스 응답 노출 금지, 5xx는 일반화 메시지+Sentry 추적(`:18-24`).
- **핵심 로직** (핸들러 우선순위는 구체타입 우선):
  - `AuthenticationException` → 401(`:34-37`).
  - `NoResourceFoundException` → 404, 스택트레이스 미기록(백엔드는 API만 제공, 루트 접근은 정상 404, `:43-46`).
  - `AccessDeniedException` → 403(`:48-51`).
  - `AuthorizationDeniedException` → 403, **한 줄 WARN만**(`:61-66`). v2.13.3 핫픽스: 일반 유저가 어드민 엔드포인트(대시보드/메트릭/SSE 로그) 호출 시 매 요청마다 100+줄 stack trace가 Tomcat까지 전파돼 로그/Sentry 도배 + SSE "response already committed" 후속 에러를 유발하던 문제 해결(`:53-60`).
  - `ResourceNotFoundException` → 404, DEBUG 로그(노이즈 최소, `:74-78`).
  - `SecurityException` → 403, WARN + **Sentry capture**(위변조 결제 등, `:80-86`).
  - `IllegalArgumentException`+`MethodArgumentNotValidException` → 400(`:88-91`).
  - `IllegalStateException` → 409 Conflict(`:93-96`).
  - `RuntimeException` → 400 + Sentry capture(`:98-103`).
  - `Exception`(최종 폴백) → 500, **원문 대신 일반 메시지**(`MESSAGE_INTERNAL`) + ERROR 로그 + Sentry(`:105-110`).
  - `body(status,error,msg)` 공통 빌더 — `HashMap`에 4키 채워 `ResponseEntity` 생성, msg null이면 error로 대체(`:112-119`).
- **특이사항**: 
  - 보안상 5xx만 메시지를 가리고(`handleAllExceptions`), `RuntimeException`/`IllegalArgument` 등은 `ex.getMessage()`를 그대로 응답에 노출 → 도메인 메시지(예: "User not found: …")가 클라에 전달됨. 민감 정보가 메시지에 섞이지 않도록 throw 측 주의 필요.
  - `RuntimeException` 핸들러가 `ResourceNotFoundException`(RuntimeException 파생)보다 **덜 구체적**이라, 더 구체적인 `handleNotFound`가 우선 매칭됨(Spring 규칙). 순서 의존이 아니라 타입 specificity 의존이라 안전.
- **연결**: `io.sentry.Sentry`(properties §15 `sentry.dsn`), `ResourceNotFoundException`, Spring Security 예외들에 의존. 모든 컨트롤러가 암묵적 피호출.

#### `popspot-backend/src/main/resources/application.properties` — 기본(dev) 전체 설정
- **책임**: 22개 섹션의 마스터 설정. 거의 모든 값이 `${ENV:default}`로 환경변수 주입 + 로컬 기본값을 갖는 12-factor 스타일.
- **핵심 로직**(보안/운영 함정 위주):
  - 프로필: `spring.profiles.active=${SPRING_PROFILES_ACTIVE:dev}`(`:4`) → 기본 dev, prod는 명시 주입.
  - `app.allowed-origins`(CORS 화이트리스트, `:15`), `app.upload.allowed-host-patterns`(`:17-19`) — **비어 있으면 X-Forwarded-Host 무시(가장 보수적)**, prod 필수. v2.7 S4 보안수정 산물.
  - `jwt.secret=${JWT_SECRET:}`(`:72-73`) — **기본값 없음. 운영 누락 시 `JwtAuthenticationFilter @PostConstruct`에서 부팅 실패**(의도된 fail-fast).
  - JPA `ddl-auto=${JPA_DDL_AUTO:update}`(`:53`) → dev update, prod는 prod 파일에서 validate로 override. `open-in-view=true`(`:57-59`)로 직렬화 중 LAZY 접근 허용(N+1 위험보다 운영 안정성 우선이라 명시).
  - OAuth2 Google/Kakao/Naver registration+provider(`:77-119`), `user-name-attribute`가 각각 default/`id`/`response` — `OAuthAttributes`의 키 추출과 정확히 짝.
  - Kakao는 `client_secret_post` 인증 방식 + provider URL 직접 명시(`:89-97`)(Spring 기본 제공 안 함).
  - 자동수집(§18, `:204-225`): `crawler.enabled` 기본 false(운영만 true), confidence-threshold 0.8(자동게시 vs 검수큐 분기), cron 하루 2회(새벽4시/오후4시) + geocode 백필(새벽4:30). v2.21-S4 주석: `min-visible-confidence` 키를 의도적으로 제거(검수 통과 데이터는 신뢰도 무관 노출).
  - Spotify OAuth(§18.5, `:227-243`): `spotify.token.encryption-key` AES-256(Base64 32바이트=44자), **키 분실=저장 토큰 전부 무효** 경고.
  - 백업(§19)/SLA(§20)/위시 만료(§21) cron + enabled 토글, 약관 버전(§22) `popspot.terms.current-version`(프론트와 공유 상수).
  - Actuator(§16): 운영에선 health만 노출, `show-details=never`.
- **특이사항**:
  - **`§10` MyBatis 설정이 stale**: `mybatis.mapper-locations=classpath:mapper/*.xml`(`:124-125`)이 남아 있으나 프로젝트는 JPA 전용이고 `mapper/*.xml`도 `mapper/`/`model/` 패키지도 비어 있음 → 죽은 설정(별도 정리 태스크로 플래그함).
  - 다수 민감 키(JWT/DB/OAuth/Spotify/iamport/Sentry)가 평문 properties에 키 이름으로 존재하나 모두 빈 default라 실제 비밀은 환경변수로만 주입되는 구조 — 평문 유출 위험은 없음.

#### `popspot-backend/src/main/resources/application-prod.properties` — 운영 프로필 오버라이드
- **책임**: dev 기본값 위에 운영 안전값만 덮어쓰기(`:1-3`).
- **핵심 로직**:
  - `spring.jpa.hibernate.ddl-auto=validate`(`:6-7`) — **운영 update/create 금지, 스키마는 Flyway 전담**.
  - Flyway 활성화 + `baseline-on-migrate=true`(`:10-13`) → 기존 운영 DB(이미 ddl-auto로 생성된)에서 V1 베이스라인 충돌 없이 잡힘.
  - 로그 레벨 INFO/WARN 고정(`:15-20`), Actuator health만(`:22-25`, probes 활성), DevTools restart/livereload 차단(`:31-33`).
- **특이사항**: Flyway는 prod에서만 켜진다 → dev는 `ddl-auto=update`로 스키마 관리, prod는 Flyway+validate. V1 주석이 설명한 부트스트랩 전략(첫 부팅 dev로 스키마 생성 후 prod 전환)과 정확히 맞물림.

#### `popspot-backend/src/main/resources/db/migration/V1__baseline.sql` — Flyway 베이스라인(no-op)
- **책임**: 기존 운영 DB(ddl-auto=update로 생성됨)에 "이 시점=v1" 마킹만. 실제 테이블 생성은 안 함(`:1-16`).
- **핵심 로직**: 본문은 `SELECT 1;`(`:19`) — 실행돼도 무해.
- **특이사항**: 신규 빈 DB에는 이 V1으로 테이블이 안 생기므로, 첫 부팅을 dev(ddl-auto=update)로 띄워 스키마 생성 후 prod(validate) 전환하거나 V1에 CREATE를 직접 작성하는 두 옵션을 주석에 명시. `baseline-on-migrate=true`가 충돌 방지 핵심.

#### `popspot-backend/src/main/resources/db/migration/V2__stamp_unique_constraint.sql` — 스탬프 중복 방지 유니크 제약
- **책임**: 동일 유저+동일 팝업 중복 스탬프를 DB 레벨에서 차단(race condition 방어).
- **핵심 로직**: PL/pgSQL `DO $$` 블록으로 idempotent 처리(`:8-20`) — `pg_constraint`에 `uk_stamp_user_popup` 없을 때만 `ALTER TABLE "stamp" ADD CONSTRAINT ... UNIQUE("user_id","popup_id")`. 테이블 부재 시 `undefined_table` 예외를 NOTICE로 흡수(`:16-18`, ddl-auto 첫 부팅 전 대비).
- **연결**: `StampRequest` DTO가 이 제약의 보호를 받음. 적립 서비스의 중복 삽입은 여기서 거부.

#### `popspot-backend/src/main/resources/db/migration/V3__sequences.sql` — 누락 시퀀스 사전 생성
- **책임**: validate 모드에서 시퀀스 누락으로 부팅 실패하는 사고 방어(`:1-7`).
- **핵심 로직**: `orders_seq`, `popup_store_seq`를 `CREATE SEQUENCE IF NOT EXISTS`(`:9-10`). 각각 `Orders`/`PopupStore` 엔티티의 `@SequenceGenerator(sequenceName=...)`와 짝.

#### `popspot-backend/src/main/resources/db/migration/V4__crawler_fields.sql` — 자동수집 워크플로우 컬럼 + 인덱스
- **책임**: `popup_store`에 자동수집(Naver/Kakao Search API + Gemini 정규화) 관련 11개 컬럼 추가. 레거시는 source_type='MANUAL'/review_status=NULL로 자연 동작(`:4-13`).
- **핵심 로직**:
  - 11개 컬럼 `ADD COLUMN IF NOT EXISTS`(`:15-26`): `source_type`(default MANUAL), `source_url`/`source_name`(출처표시), `external_id`(중복키), `confidence_score DECIMAL(3,2)`, `crawled_at`/`last_seen_at`, `review_status`, `takedown_*` 3종.
  - 부분 유니크 인덱스 `uk_popup_store_external_id WHERE external_id IS NOT NULL`(`:29-31`) — 이름+장소+시작일 SHA-256 해시로 중복 수집 방지.
  - 조회 가속 인덱스 3종: `(start_date,end_date)`, `review_status`(부분), `status`(부분)(`:34-43`).
  - 레거시 정합성: `source_type IS NULL → 'MANUAL'` 백필(`:46-48`).
- **특이사항**: 정책 주석(`:8-12`) — 공개 검색 API 결과만 수집(인스타/블로그 본문 직접 크롤링 금지), 모든 row가 source_url 보유(저작권 인용/공정이용 방어), takedown→`review_status='TAKEDOWN'` 즉시 hide, 만료→`status='EXPIRED'` soft delete. `confidence_score`는 `PopupSearchDto.confidence`/properties confidence-threshold와 연결, `takedown_*`는 `PopupTakedownRequestDto`와 연결.

#### `popspot-backend/src/main/resources/db/migration/V5__music_track.sql` — 음악 매칭 테이블 신설
- **책임**: "POP-SPOT Music Radio"(iTunes 검색→YouTube 매칭→Groq 분위기 분석→팝업 추천) 데이터 모델(`:1-5`).
- **핵심 로직**:
  - `music_track`(`:7-25`): `itunes_track_id UNIQUE NOT NULL`(초기), `artwork_url_hires`(1000x1000), `preview_url`(30초 백업), `youtube_video_id`(풀재생), `is_official`(VEVO/Topic), `mood_tags`(JSON 배열 문자열), `play_count`, 캐시 타임스탬프들.
  - 인덱스 3종: itunes_id, play_count DESC, `LOWER(artist_name)`(대소문자 무시 검색, `:27-29`).
  - `user_music_history`(`:32-39`): 음악 패스포트용. `track_id` FK→music_track, `matched_popup_id`(NULL 가능), `UNIQUE(user_id,track_id,played_at)`.
  - 청취 기록 인덱스 2종(`:41-42`).
- **특이사항**: `ResourceNotFoundException.musicTrack(Long)` 팩토리의 대상 테이블. itunes_track_id가 여기선 NOT NULL이지만 V6에서 완화됨.

#### `popspot-backend/src/main/resources/db/migration/V6__music_spotify.sql` — 음악 소스 Spotify 전환
- **책임**: 검색 소스를 iTunes→Spotify로 전환하되 기존 컬럼 호환 유지(`:1-6`).
- **핵심 로직**: `spotify_track_id VARCHAR(50)` 추가(`:8-9`), `itunes_track_id` **NOT NULL 제약 DROP**(Spotify 데이터 삽입 시 실패 방지, `:11-12`), `spotify_track_id` 부분 유니크 인덱스(NULL 중복 허용, `:14-17`).
- **특이사항**: 컬럼명은 호환 위해 `itunes_track_id`로 두되 의미는 "external_track_id"로 일반화(주석). V5의 NOT NULL을 사실상 무효화하므로 V5 단독 적용 환경과 차이.

#### `popspot-backend/src/main/resources/db/migration/V7__feedback.sql` — 의견 보내기 게시판 테이블
- **책임**: 사용자/게스트 의견 저장. user_id NULL=비로그인, guest_email=답신용 선택(`:1-2`).
- **핵심 로직**: `feedback_seq` 시퀀스(`:4`) + `feedback` 테이블(`:6-17`) — `status` default 'PENDING', `category`/`title`/`content` NOT NULL, `admin_reply`/`replied_at` NULL. 인덱스 2종: `(status,created_at DESC)`(검수 큐), `(user_id,created_at DESC)`(내 의견)(`:19-23`).
- **연결**: `Feedback` 엔티티 ↔ `FeedbackCreateRequestDto`(작성, content 4000자↔TEXT)/`FeedbackReplyRequestDto`(어드민 답변, status 4상태)/`FeedbackResponseDto`(조회) 전부와 짝. SLA cron(properties §20)이 PENDING 24h 미답변 추적.

#### `popspot-backend/src/main/resources/db/migration/V8__user_boost.sql` — 등급별 부스트 한도 추적 컬럼
- **책임**: v2.12 — 동행 게시판 상단 부스트를 "메가폰 아이템 차감" 모델에서 "등급(스탬프 누적)별 월 한도"로 전환(`:1-3`).
- **핵심 로직**: `users`에 `boost_used_count INTEGER NOT NULL DEFAULT 0`, `boost_period VARCHAR(7) NULL` 추가(`:5-6`). `boost_period`는 "YYYY-MM", 서비스가 현재 월과 다르면 used_count 0 리셋(`:8`). 컬럼 코멘트 부착(`:9-10`).
- **특이사항**: 기존 `megaphone_count` 컬럼은 호환 위해 잔존(`:3`) — `LoginResponseDto.megaphoneCount`/`MyPageDto.megaphoneCount`와 `MateDto.useBoost`의 정책 전환 배경. 월 리셋이 cron이 아니라 서비스 조회 시점 비교 방식이라 lazy reset.

#### `popspot-backend/src/main/resources/db/migration/V9__mate_post_report.sql` — 동행 글 신고 누적 + 자동 차단
- **책임**: v2.18.1 — `mate_post`에 신고 누적(`report_count`)과 자동 숨김(`is_hidden`) 컬럼(`:1-3`).
- **핵심 로직**: `report_count INTEGER NOT NULL DEFAULT 0`, `is_hidden BOOLEAN NOT NULL DEFAULT FALSE`(`:5-6`). 코멘트: **3건 도달 시 is_hidden 자동 true**(`:8`). 목록 쿼리가 `is_hidden=true` 제외로 사용자 화면에서 사라짐(`:3`).
- **특이사항**: V9 단계에선 "누가" 신고했는지 추적 안 함 → 1인이 3회 반복 신고로 혼자 자동숨김 트리거 가능한 어뷰징 구멍이 있었고, **V14에서 `reported_by`로 보완**됨.

#### `popspot-backend/src/main/resources/db/migration/V10__performance_indexes.sql` — 운영 트래픽 대비 성능 인덱스 묶음
- **책임**: v2.19 — 자주 쓰는 쿼리 패턴별 인덱스 일괄 추가(`:1-2`).
- **핵심 로직**(6개 테이블, 전부 `IF NOT EXISTS`):
  - `popup_store`(`:10-14`): review_status/status/source_type/end_date/`view_count DESC` — `findAllVisible`(status NOT IN PENDING/EXPIRED + reviewStatus IN AUTO_PUBLISHED/APPROVED) 및 정렬 가속.
  - `mate_post`(`:20-21`): `(is_hidden,created_at DESC)`(목록: 숨김 제외+최신순), `status`.
  - `wishlist`(`:29-30`): `popup_store_id`, `user_id`(본인 위시 + 만료 cron 양방향).
  - `music_track`(`:35-36`): `play_count DESC`, `youtube_video_id`.
  - `stamp`(`:42`): `user_id`(`countByUserId` — 마이페이지/등급 계산).
  - `user_music_history`(`:47`): `user_id`(패스포트).
  - 일부 인덱스에 `COMMENT ON INDEX`로 용도 명시(`:49-51`).
- **특이사항**: `idx_popup_review_status`/`idx_popup_status`는 V4의 부분 인덱스(WHERE 절 有)와 **중복 가능성** — V4는 `WHERE review_status IS NOT NULL`, V10은 무조건 전체 인덱스라 PostgreSQL이 둘 다 생성(IF NOT EXISTS는 이름 기준이라 이름이 달라 중복 잔존). `idx_user_music_history_user`는 V5에도 동명 인덱스가 있어 V10에선 IF NOT EXISTS로 no-op.

#### `popspot-backend/src/main/resources/db/migration/V11__user_terms_version.sql` — 약관 재동의 시스템
- **책임**: v2.19 — 약관 개정 시 모든 사용자에게 다음 로그인 재동의 강제(`:1-4`).
- **핵심 로직**: `users.agreed_terms_version VARCHAR(10)` 추가(`:6`), 기존 사용자는 '1.0' 백필(가입 시 동의한 것으로 간주, `:8-10`). 프론트/백엔드가 같은 상수(`popspot.terms.current-version`, properties §22)를 공유, 사용자 버전과 다르면 재동의 모달(`:3-4`).
- **연결**: `SignupRequestDto` 통과 후 신규 가입자는 현재 버전을 박는 흐름.

#### `popspot-backend/src/main/resources/db/migration/V12__music_track_playback_failed.sql` — 재생 실패 카운터
- **책임**: v2.21-S7 — YouTube IFrame Player onError(101/150 embed 차단, 100 비공개 등) 누적 카운터(`:1-4`).
- **핵심 로직**: `music_track.playback_failed_count integer NOT NULL DEFAULT 0` 추가(`:5-6`), 클라가 `POST /api/music/{id}/playback-failed`로 1 증가, 임계값(기본 3) 초과 시 후속 검색 제외(`:3-4`). 필터용 인덱스(`:8-10`).

#### `popspot-backend/src/main/resources/db/migration/V13__spotify_auth.sql` — 사용자별 Spotify OAuth 토큰 저장
- **책임**: v2.21-S10 — 각 사용자가 자기 Spotify 계정(Premium/Free)을 OAuth 연결하면 암호화 토큰 저장(`:1-4`).
- **핵심 로직**: `spotify_auth` 테이블(`:5-17`) — `user_id UNIQUE`, `access/refresh_token_encrypted TEXT`(AES-256 GCM Base64), `expires_at`, `is_premium`, `FK→users(user_id) ON DELETE CASCADE`(회원 탈퇴 시 자동 정리, PIPA/Spotify 약관 의무, `:4`, `:15-16`). 만료 조회용 인덱스(`:19-20`).
- **연결**: properties §18.5의 `spotify.oauth.*` + `spotify.token.encryption-key`와 짝. 암호화 키 분실 시 전 토큰 무효(properties 경고와 일치).

#### `popspot-backend/src/main/resources/db/migration/V14__mate_post_reported_by.sql` — 신고자 중복 방지
- **책임**: v2.22 — V9 `report_count`가 신고자를 추적하지 않아 1인 반복 신고로 자동숨김을 어뷰징할 수 있던 구멍을 막음(`:1-4`).
- **핵심 로직**: `mate_post.reported_by VARCHAR(2000) DEFAULT ''` 추가(`:6`) — `joinedUsers`와 동일하게 콤마 구분 ID 명단으로 1인 1신고 보장. 정규화(join 테이블) 대신 기존 코드 컨벤션·단순성 우선(`:4-5`). 코멘트 부착(`:8`).
- **특이사항**: V9의 자동차단 로직과 합쳐져야 의미가 있음 — `reported_by`에 신고자 추가 + 미존재 시에만 `report_count` 증분하는 서비스 로직이 전제. `VARCHAR(2000)` 상한이라 신고자 수 폭증 시 잠재적 truncation 한계.

---

### 모듈 전체 연결 요약
- **DTO 계층**은 두 패턴으로 갈린다: (1) **입력 DTO**는 Bean Validation으로 컨트롤러 진입 직후 검증(`SignupRequestDto`/`PopupReportRequestDto`/`FeedbackCreateRequestDto`/`PopupTakedownRequestDto`), 검증 실패는 전부 `GlobalExceptionHandler`(400)로 수렴. 일부 입력 DTO(`CourseSaveRequestDto`/`StampRequest`/`MateDto`/`VoteRequest`)는 검증 애너테이션이 없어 방어가 서비스/DB 제약에 위임됨. (2) **응답 DTO**는 `fromEntity(...)` 정적 팩토리로 JPA 엔티티의 LAZY/내부 컬럼 노출을 API 경계에서 차단(`CalendarPopupDto`/`MyCourseResponseDto`/`FeedbackResponseDto`/`PopupSearchDto`).
- **boolean 직렬화 함정**은 `@JsonProperty("isPremium")`로 두 곳(`LoginResponseDto`/`MyPageDto`)에서 일관 처리.
- **예외 처리**는 `ResourceNotFoundException`(도메인 404)와 `GlobalExceptionHandler`(전역 표준 응답 + 운영 로그/Sentry 정책)가 한 쌍. v2.13.3의 `AuthorizationDeniedException` 핸들러가 어드민 권한 거부 로그 폭주를 잠재운 핵심 핫픽스.
- **설정**은 dev(`application.properties`, ddl-auto=update)와 prod(`application-prod.properties`, validate+Flyway) 2단 구성, 비밀은 전부 환경변수 주입.
- **Flyway 마이그레이션**은 V1 베이스라인(no-op) 위에 점증 적용되며, DTO/properties와 강하게 맞물린다: V4(자동수집)↔`PopupSearchDto`/`PopupTakedownRequestDto`/crawler properties, V7(feedback)↔Feedback 3종 DTO, V8(boost)↔`MateDto.useBoost`+megaphone 잔존 필드, V9→V14(신고 어뷰징 보완), V13(spotify_auth)↔§18.5 OAuth/암호화 설정.

### 발견된 정리 포인트 (별도 태스크로 플래그함)
- `application.properties:124-125`의 MyBatis 설정(`mybatis.mapper-locations`, `mybatis.configuration.map-underscore-to-camel-case`)은 **죽은 설정**이다. `mapper/`·`model/` 패키지 및 `resources/mapper/`가 모두 비어 있고 영속화는 JPA 전용이므로 MyBatis 의존성이 없다면 제거 대상(task_ae950e97로 등록).

## F1 — 프론트 · 메인 페이지 & 루트 레이아웃 (핵심)

#### `popspot-frontend/app/layout.tsx` — Next.js App Router 루트 레이아웃 (전역 메타데이터 · Provider 중첩 · 지도 SDK 주입)
- **책임**: 모든 페이지를 감싸는 루트 HTML 셸을 정의하고, SEO 메타데이터/구조화 데이터/뷰포트를 선언하며, 전역 Provider 와 외부 스크립트(카카오맵)를 한 번에 주입한다.
- **핵심 로직**:
  - `metadata` (11~85행): `metadataBase` 를 `https://popspot.co.kr` 로 고정하고, `title.template`(`"%s · POP-SPOT"`)으로 하위 페이지 제목 패턴을 정의. `keywords` 배열(19~57행)은 브랜드·일반어·지역·시점·카테고리·기능으로 분류된 한국어 SEO 키워드 묶음. `openGraph`/`twitter`(58~74행)는 OG 이미지 `/og-image.png` 와 한국어 로케일(`ko_KR`)을 설정.
  - `alternates`(79~84행, v2.20.3 주석): `canonical` URL 과 RSS 피드(`/feed.xml`)를 선언해 네이버 SearchAdvisor·RSS 리더가 자동 인식하게 함.
  - `JSON_LD`(91~114행, v2.17 주석): `@graph` 안에 `WebSite`(sitelinks search box용 `SearchAction` 포함, target `https://popspot.co.kr/?q={search_term_string}`)와 `Organization` 두 스키마를 담은 구조화 데이터 객체.
  - `viewport`(116~123행): light/dark 별 `themeColor` 두 개(`#F5F3EE` / `#0A0A0A`)와 `width=device-width`, `initialScale=1`.
  - `RootLayout`(125~159행): `<html lang="ko" suppressHydrationWarning>` — `suppressHydrationWarning` 은 next-themes 가 클라이언트에서 `class="dark"` 를 주입할 때 서버/클라 mismatch 경고를 억제하기 위함. `<head>` 안에서 `JSON_LD` 를 `dangerouslySetInnerHTML` 로 `<script type="application/ld+json">` 에 직렬화 주입(134~137행).
  - Provider 중첩 순서(140~148행): `Providers` → `AuthGuard` → `MusicPlayerProvider` → `{children}` + `GlobalChatManager` + `GlobalMusicPlayer`. 즉 인증 게이트(AuthGuard)가 음악/채팅보다 바깥에 있어 비인증 시 음악 컨텍스트 자체가 마운트되지 않는 구조.
  - 카카오맵 SDK(150~155행): `env.kakaoMapKey` 가 있을 때만 `<Script strategy="beforeInteractive">` 로 `dapi.kakao.com/v2/maps/sdk.js?...&autoload=false` 주입. `autoload=false` 라 실제 SDK 초기화는 지도 컴포넌트가 직접 수행한다는 뜻.
- **연결**: `./Providers`(Providers), `@/components/AuthGuard`, `@/components/GlobalChatManager`, `@/components/music/MusicPlayerProvider`, `@/components/music/GlobalMusicPlayer`, `@/lib/env`(env) 를 주입. Next.js App Router 가 이 파일을 모든 라우트의 루트로 자동 호출.
- **특이사항**: `icons.icon` 이 `/icon.svg` 를 가리키는데(76행), 저장소 루트에 `icon.svg` 가 untracked 로 존재(git status). 카카오맵 키가 없으면 SDK 스크립트가 통째로 누락되므로 지도 기능이 조용히 죽을 수 있음 — env 누락 시 fallback 안내는 이 레이어에 없음.

#### `popspot-frontend/app/Providers.tsx` — 클라이언트 전용 테마 Provider 래퍼 (SSR hydration mismatch 회피)
- **책임**: `next-themes` 의 `ThemeProvider` 를 마운트 이후에만 활성화해 다크모드 클래스로 인한 서버/클라이언트 hydration mismatch 를 피한다.
- **핵심 로직**:
  - `'use client'`(1행) 선언 — 이 파일만 클라이언트 컴포넌트이므로 서버 컴포넌트인 layout 이 안전하게 감쌀 수 있음.
  - `mounted` 상태(17행) + `useEffect(() => setMounted(true), [])`(19~21행): 첫 렌더(서버 + 클라이언트 초기 hydration)에서는 `mounted=false`.
  - 게이트(23행): `if (!mounted) return <>{children}</>;` — 마운트 전엔 ThemeProvider 없이 children 만 그대로 노출. 주석(9~12행)에 따르면 CSS 변수 없는 잠깐의 깜빡임이 `class="dark"` mismatch 보다 덜 눈에 띈다는 트레이드오프.
  - 마운트 후(25~29행): `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`. `attribute="class"` 가 있어야 `<html>` 에 `class="dark"` 가 붙어 Tailwind dark variant 동작, `enableSystem` 은 OS 다크모드 자동 추종.
- **연결**: `next-themes` 의 `ThemeProvider` 를 주입. `layout.tsx` 가 최외곽 Provider 로 호출.
- **특이사항**: 마운트 전 children 을 테마 컨텍스트 없이 렌더하므로, 초기 렌더에서 `useTheme()` 를 호출하는 하위 컴포넌트가 있으면 기본값을 받게 됨(설계상 의도된 절충).

#### `popspot-frontend/app/page.tsx` — 메인 SPA 셸 (7개 탭 · 인증/게스트 게이트 · 14개 useState · 데이터 페칭/핸들러 god 컴포넌트)
- **책임**: 로그인/게스트 상태에 따라 7개 탭(MAP/PASSPORT/MUSIC/COURSE/MY/MATE/FEEDBACK)을 한 클라이언트 컴포넌트 안에서 전환 렌더하며, 팝업/혼잡도/OOTD 데이터 페칭·코스 편집·위시리스트·AI 추천·모달 오케스트레이션을 모두 담당한다.

- **상단 상수 / 탭 접근 정책 (76~103행)**:
  - `INITIAL_MY_COURSE: CourseItem[] = []`(76행) — 빈 초기 코스.
  - `DEFAULT_TAB = "MAP"`(87행), `USER_ONLY_TABS = Set(["COURSE","MUSIC","MATE"])`(88행) — 회원 전용 3개 탭을 한 곳에서 관리.
  - `canAccessTab(tab, hasUser, isGuestActive)`(91~95행): 로그인 사용자면 무조건 `true`, 게스트 활성이면 `true`(주석상 v2.13.1부터 게스트는 7일간 모든 탭 자유), 그 외(비로그인+비게스트)는 `!USER_ONLY_TABS.has(tab)` — 즉 MAP/PASSPORT/MY/FEEDBACK 만 통과.
  - `userOnlyTabHint(tab)`(98~103행): COURSE/MUSIC/MATE 별 "가입 후 이용" 안내 문구 반환.

- **상태 선언 (`useState` 14개 + ref, 112~143행)**:
  - `hotPopups`(112), `allPopups`(113): 실시간 랭킹용 상위 5개 / 전체 팝업 목록.
  - 모달 토글 8개: `isModalOpen`(전체 트렌딩, 115), `isReportOpen`(AI 리포트, 116), `isReportPopupOpen`(팝업 제보, 117), `isAddPlaceOpen`(장소 추가, 118), `isCalendarOpen`(달력, 119), `isProfileEditOpen`(프로필 수정, 120), `isGlobalSearchOpen`(전역 검색, 121), `isNotificationsOpen`(알림센터, 122).
  - `useGlobalSearchHotkey(setIsGlobalSearchOpen)`(123행): 단축키로 전역 검색 모달을 여는 훅에 setter 위임.
  - `currentTab`(125, 기본 "MAP"), `user: User|null`(126), `myPageInfo: MyPageData|null`(127, 찜/스탬프/리뷰 카운트), `savedCourses`(128), `myWishlist`(129), `aiCourse`(130, AI 추천 결과), `myCourseItems`(131, 현재 편집 중인 코스).
  - AI 관련: `isAiLoading`(133), `selectedVibe`(134), `customVibeInput`(135), `showCustomInput`(136).
  - `congestionData: CongestionData|null`(137), `ootd: TrendOotd|null`(138), `calendarDate`(139), `guestRemainingDays: number|null`(141, null = 비활성/로그인).
  - `videoRef`(143) — OOTD 비디오 엘리먼트 ref.
  - `sensors`(145~148): dnd-kit `PointerSensor`(드래그 5px 활성화 임계값) + `KeyboardSensor` — MY 탭 코스 순서 드래그용.

- **핵심 핸들러**:
  - `handleDragEnd`(151~160): 드래그 종료 시 `active.id !== over.id` 면 `arrayMove` 로 `myCourseItems` 순서 재배열.
  - `handleCopyAiToMyCourse`(162~170): `aiCourse` 비었으면 경고, 아니면 `myCourseItems` 에 통째 복사 후 `handleTabChange("MY")` 로 이동.
  - `handleAddPlace`(172~188): PopupStore 를 CourseItem 으로 변환(좌표 없으면 성수 기본값 `37.5445/127.0560`), 중복이면 `notify` 후 중단, 아니면 추가하고 모달 닫기.
  - `handleCreateRoom`(190~208): 비로그인 시 `confirmAction` 후 `/login` 유도; 로그인 시 `POST /api/planning/create` 호출 → 응답 텍스트를 roomId 로 받아 `/planning?room=${roomId}` 이동(실패 시 `notifyError`).
  - `fetchMyPageData`(210~223): `GET /api/mypage/${userId}` → `setMyPageInfo`. 추가로 응답의 `isPremium` 을 현재 `user` 에 머지해 `setUser` + localStorage 갱신(216~220).
  - `fetchMyCourses`(225~240): `GET /api/my-courses?userId=` → `setSavedCourses`. `shouldAutoLoad=true` 면 가장 최근 코스(`data[data.length-1]`)의 `courseData` 를 JSON.parse 해 `myCourseItems` 자동 복원.
  - `fetchWishlist`(242~250): `GET /api/wishlist/${userId}` → `setMyWishlist`.
  - `handleRemoveWishlist`(252~269): `preventDefault/stopPropagation`(Link 내부 버튼이라 필수), destructive confirm 후 `DELETE /api/wishlist/${userId}/${popupId}` → 낙관적 필터링 + `fetchMyPageData` 재호출.
  - `handleLoadCourse`(271~280): warning confirm 후 `JSON.parse(courseDataStr)` 로 `myCourseItems` 교체 + 상단 스크롤.
  - `handleDeleteCourse`(282~297): destructive confirm 후 `DELETE /api/my-courses/${courseId}` → 성공 시 `fetchMyCourses` 재호출.
  - `promptUpgradeOrLogin`(304~322): USER_ONLY 탭을 막힌 사용자가 눌렀을 때 — 주석상 게스트 활성은 canAccessTab 에서 이미 통과하므로 여기 도달하는 건 `!user`(305행)뿐. 비로그인이면 "회원가입"(→`/signup`) 또는 "로그인"(→`/login`) 유도.
  - `handleTabChange`(324~338): **탭 전환 단일 진입점.** `isGuestActive = guestRemainingDays != null && > 0`(325) 계산 → `canAccessTab` 실패 시 `promptUpgradeOrLogin` 호출 후 중단(326~329). 통과하면 `setCurrentTab` + `sessionStorage.setItem("lastTab", tab)`(330~331). MY 탭이고 로그인 상태면 mypage/courses/wishlist 3종 동시 페치(333~337).
  - `handleLogout`(340~347): localStorage(user/token) + sessionStorage(aiCourseData) 제거 → `setUser(null)` → 알림 후 `window.location.reload()` (전체 리로드로 상태 완전 초기화).
  - `handleDeleteAccount`(357~394, v2.17/PIPA §17 주석): **2단계 확인** — 1차 "정말 탈퇴?"(destructive, 359~367) → 2차 "마지막 확인, 되돌릴 수 없음"(369~375). 둘 다 통과 시 `DELETE /api/v1/users/me`(379) → 실패 시 서버 텍스트 메시지 표시(380~384), 성공 시 localStorage/sessionStorage 전부 청소 + `setUser(null)` + `router.replace("/login")`.
  - `handleAiRecommend`(396~415): vibe 공백 검증 → `setIsAiLoading(true)` + `setAiCourse([])` 초기화 → `GET /api/courses/recommend?vibe=${vibe}` → 응답을 `res.text()` 로 받아 `JSON.parse` → `setAiCourse` + sessionStorage 에 `{vibe, course}` 캐시(411). finally 에서 로딩 해제.
  - `handleResetCourse`(417~421): aiCourse/selectedVibe 초기화 + sessionStorage `aiCourseData` 제거.
  - `handleSaveCourse`(423~451, v2.12 주석으로 freemium 1개 제한 폐지 명시): 비로그인 차단 → `POST /api/my-courses` 에 `{userId, courseName(날짜+시각 자동), courseData: JSON.stringify(myCourseItems)}` 전송 → 성공 시 `fetchMyCourses` 재호출.
  - `handleMarkerClickToDetail`(455~457): `router.push('/popup/${popupId}')` — InteractiveMap 마커 클릭 콜백.

- **데이터 페칭 / 인증 게이트 useEffect 3개**:
  - **(1) 메인 데이터 로딩 (467~513, deps `[]`)**: **localStorage-first 캐싱 패턴.** `cached_popups` → 즉시 표시 + viewCount 내림차순 정렬해 상위 5개를 `hotPopups` 로(472~473). 이어 `GET /api/popups` 신선 데이터로 덮어쓰고 캐시 갱신(476~484). 동일 패턴을 `cached_congestion`+`GET /api/congestion`(486~499, `data.level` 가드 있음), `cached_ootd`+`GET /api/trends/ootd`(501~512)에도 적용. 즉 첫 화면은 캐시로 즉시, 그 후 네트워크로 최신화.
  - **(2) 인증/게스트 진입 게이트 (528~564, deps `[]` — mount 1회, v2.13.1 분리 주석)**: `localStorage.user` 없으면 → `getGuestFirstVisit()` 으로 분기: `null`(게스트 미시작)이면 `router.replace("/login")`(534), 만료면 `router.replace("/signup?reason=guest_expired")`(538), 활성이면 `setGuestRemainingDays(getRemainingGuestDays(...))`(541). user 있으면 `setGuestRemainingDays(null)` + `setUser(parsed)` + `fetchMyCourses(userId, true)`(자동복원) + `fetchWishlist`, lastTab 이 "MY" 면 추가로 `fetchMyPageData`(547~552). 끝으로 sessionStorage `aiCourseData` 복원(555~560). **주석(522~526)**: 이 effect 가 과거 `[searchParams, router]` deps 라 탭 클릭 → router 변경 → 게스트 D-N 재계산 → "매번 새로 시작되는 듯한" 깜빡임 버그가 있어 mount 1회로 분리함.
  - **(3) 탭 복원 (570~585, deps `[searchParams]`)**: `?tab=` 쿼리 우선 — 대문자화 후 `canAccessTab` 통과하면 그 탭, 아니면 DEFAULT_TAB(578). 쿼리 없으면 sessionStorage `lastTab` 으로 복원(581~584). 게스트/유저 상태는 건드리지 않고 `setCurrentTab` 만.

- **유틸 (587~618)**:
  - `sectionVariants`(588~591): framer-motion 섹션 fade-up 애니메이션.
  - `renderRankChange`(593~597): 랭킹 변동 — 0/없음 `Minus`, 양수 빨강 `ArrowUp`, 음수 파랑 `ArrowDown`(국내 증시 색 관례).
  - `getCongestionColor`(599~607): "여유/보통/약간 붐빔/붐빔" → green/yellow/orange/red.
  - `getDday`(609~616): 만료일 문자열 → D-day(음수면 0).
  - `isAdmin = user?.role?.includes('ADMIN')`(618) — **선언되지만 JSX 본문에서 사용처 없음**(dead variable 가능성).

- **렌더 구조 (620~1535)**: 최상위 `<main>` 안에 고정 배경 비디오(`/bg.mp4`, 624~628) + 반투명 오버레이. `Header`(632~641, user/로그아웃/로고/제보/프로필/검색/종 콜백 주입). 게스트 D-N 배너(648~662, `guestRemainingDays != null` 일 때만). 이후 **7개 탭이 `currentTab === "X"` 조건부 렌더**:
  - **MAP**(665~989): 환영 배너(로그인/비로그인 분기) → 음악 진입 버튼 → `<BrowseSection/>`(738) → 대시보드 그리드(`SearchZone`/`InteractiveMap`/실시간 랭킹/달력 카드/AI 리포트 카드) → OOTD 섹션(`ootd.data` 비디오) → `LiveChatTicker` → 협업 기능 홍보(작전 회의실 → `handleCreateRoom`).
  - **PASSPORT**(992~1003): 로그인 시 `<PassportView/>`, 아니면 로그인 유도.
  - **MUSIC**(1006~1015): `<MusicTab/>`.
  - **COURSE**(1018~1151): 4개 분위기 프리셋 버튼(핫플/데이트/사진/힐링 → `handleAiRecommend`) + 직접 입력 토글 → AI 추천 결과 타임라인 렌더 + "MY 탭으로 복사"/"저장" 버튼.
  - **MY**(1154~1430): 좌측 `InteractiveMap`(places=myCourseItems, showPath) + 우측 스크롤 대시보드 — 내 계정 카드(프로필/이메일/탈퇴 버튼) + Activity(찜/스탬프/리뷰) + `RankCard` + `RecentVisitsCard` + Wishlist + Saved Courses + `MyFeedbackList`(최근 3건) + DnD 코스 편집기(`DndContext`/`SortableContext`/`SortableItem`) + `AddPlaceModal`.
  - **MATE**(1433~1438): 로그인 시 `<MateBoard user={user}/>`.
  - **FEEDBACK**(1441~1471): `FeedbackForm` + `MyFeedbackList`(게스트도 진입 가능).
  - 하단: `Footer`(1475), `BottomDock`(1478, `currentTab`/`handleTabChange` 위임), 그리고 **모달 묶음**(1481~1531): AllTrending/ReportPopup/GlobalSearch/Onboarding/NotificationCenter/TermsReconsent/ProfileEdit/PopupCalendar/AIReportModal. `TermsReconsentModal`(1500)은 `onDecline={handleLogout}` — 약관 재동의 거부 시 강제 로그아웃.

- **하단 보조 컴포넌트 `RecentVisitsCard`(1543~1592, v2.18 주석)**: 같은 파일 내 별도 함수 컴포넌트. mount 시 `import("@/lib/recentVisits")` **동적 import** 로 `readVisits()` 호출(1549~1551, 코드 스플리팅) → localStorage 기반이라 회원/게스트 무관. 방문 기록 없으면 `null` 반환, 있으면 최대 6개를 3열 그리드로 `/popup/${id}` 링크 렌더.

- **연결 (의존)**: `apiFetch`/`API_BASE_URL`/`SOCKET_BASE_URL`(src/lib/api), `notify` 계열(@/lib/notify), `getGuestFirstVisit`/`getRemainingGuestDays`/`isGuestExpired`(@/lib/guestMode), dnd-kit, framer-motion, lucide 아이콘, next-navigation(`useRouter`/`useSearchParams`). 자식 컴포넌트 다수: `InteractiveMap`, `PassportView`, `MateBoard`, `MusicTab`, `RankCard`, `Header`/`Footer`/`BottomDock`, `BrowseSection`, `LiveChatTicker`, 그리고 `@/features/*` 의 모달 9종.
- **연결 (피호출)**: `layout.tsx` 의 Provider 트리(AuthGuard 안쪽)에서 루트 라우트(`/`)의 `children` 으로 렌더됨.
- **특이사항**:
  - **보안 주석(459~465, v2.7)**: 과거 OAuth 흐름이 token 외 `isPremium/role/userId/nickname` 까지 URL 쿼리로 보내 클라이언트가 localStorage 에 저장 → role/isPremium 위조(IDOR/권한상승) 위험이 있었고, 현재는 `/oauth/callback` 이 토큰만 받아 `GET /api/v1/auth/me` 로 서버 검증하므로 메인의 URL 신뢰 코드를 통째로 제거했다는 기록. 단 `fetchMyPageData`(217행)는 여전히 서버 응답의 `isPremium` 을 localStorage user 에 머지하므로, 권한 표시는 항상 서버 응답에 의존.
  - **JSON.parse 무가드**: `cached_popups`(470), `aiCourseData`(557), `courseData`(234/278) 등 localStorage/sessionStorage 값을 try 없이(혹은 effect 전체 try 없이) 파싱하는 지점 다수 — 캐시 손상 시 런타임 throw 가능.
  - `isAdmin`(618) 미사용 변수로 보임.
  - `calendarDate`/`setCalendarDate`(139) 는 선언되나 본문에서 `PopupCalendarModal` 에 전달되지 않음(달력 모달은 `popups` 만 받음) — 사용처 불명.
  - `handleAiRecommend` 가 `vibe` 를 URL 쿼리에 인코딩 없이 직접 삽입(`?vibe=${vibe}`, 407행) — 사용자 자유 입력(`customVibeInput`)이 들어가므로 특수문자 미인코딩 이슈 소지.

## F2 — 프론트 · 나머지 라우트

#### `popspot-frontend/app/popups/[slug]/page.tsx` — Long-tail SEO 슬라이스 랜딩 페이지 (SSG+ISR, SEO 핵심)
- **책임**: 지역/시점/카테고리 슬라이스 하나당 독립 URL(`/popups/seongsu`, `/popups/today`, `/popups/fashion` 등)을 빌드 타임에 SSG 로 미리 생성하고, 키워드 풍부한 `title/description/H1/H2/본문/FAQ/JSON-LD`를 서버 렌더링해 Naver/Google long-tail 검색("성수동 팝업스토어 추천" 등) 진입 미끼를 만든다. 실시간 데이터는 노출하지 않고 메인 지도(`/?tab=MAP&region=...`)로 유도 — 약관 §10-2(검색결과 재현 금지)와의 일관성 장치.
- **핵심 로직**:
  - `popups/[slug]/page.tsx:54-55` — `export const revalidate = 3600; export const dynamicParams = false;` 로 1시간 ISR + 미등록 슬러그는 404(`generateStaticParams`로 생성한 슬러그만 허용). 주석(`popups/[slug]/page.tsx:51-53`)에 Next 16 segment config 는 리터럴만 받으므로 `const` 변수 참조 불가라 인라인 필수임을 명시.
  - `popups/[slug]/page.tsx:58-64` `generateStaticParams()` — `REGIONS + PERIODS + CATEGORIES` 의 slug 를 합쳐 23개 경로를 빌드 타임 생성.
  - `popups/[slug]/page.tsx:66-74` `resolveSlice(slug)` — `regionBySlug → periodBySlug → categoryBySlug` 순으로 조회해 `{kind, slug, label}` 판별, 없으면 `null`.
  - `popups/[slug]/page.tsx:86-97` `fetchMarkers()` — `NEXT_PUBLIC_API_BASE_URL`(없으면 `SITE_URL`) 의 `/api/map/markers` 를 `next:{revalidate:3600}` 로 fetch, 실패/비-ok 시 빈 배열 반환(페이지는 0건 상태로 정상 렌더).
  - `popups/[slug]/page.tsx:99-110` `filterBySlice` — region 은 `classifyRegion(location)===slug`, period 는 `matchesPeriod(startDate,endDate,slug)`, category 는 `classifyCategory(category)===slug` 로 필터.
  - `popups/[slug]/page.tsx:114-150` `generateMetadata` — slice 유형별 `titles/descriptions` 매핑으로 메타 생성, `alternates.canonical`, openGraph, twitter 카드 세팅. slice 가 null 이면 `{title:"찾을 수 없음", robots:{index:false}}`.
  - `popups/[slug]/page.tsx:154-167` 본문 — `notFound()` 가드 후 마커 fetch→필터→`count`, deep link `mainHref = /?tab=MAP&{param}={slug}` 구성.
  - `popups/[slug]/page.tsx:229` — 목록은 `filtered.slice(0,30)` 만 렌더하고 초과분은 "외 N곳 더" 텍스트(`:251-255`)로 처리.
  - `popups/[slug]/page.tsx:272-285` ItemList JSON-LD, `:366-379` FAQPage JSON-LD 를 `dangerouslySetInnerHTML` 로 주입(검색결과 풍부도↑).
  - 보조 컴포넌트: `SliceIcon`(`:292`), `SliceCloud`(`:300` — 현재 외 모든 슬라이스로 내부 링크 클라우드, SEO 인터널 링킹), `FaqSection`(`:331`).
- **연결**: `@/lib/regions`(REGIONS/classifyRegion/regionBySlug), `@/lib/popupSlices`(PERIODS/CATEGORIES/matchesPeriod/classifyCategory/periodBySlug/categoryBySlug) 의존. 백엔드 `/api/map/markers` 호출. `sitemap.ts` 가 동일한 REGIONS/PERIODS/CATEGORIES 로 이 페이지들의 URL 을 등록 → 검색엔진 진입. lucide-react 아이콘, next `Link`/`notFound` 사용.
- **특이사항**: `dangerouslySetInnerHTML` 에 들어가는 JSON-LD 의 name/description 은 운영자가 코드로 정의한 정적 문자열(label 조합)이라 XSS 위험 없음. `filterBySlice` 의 `slug as never`(`:105`) 캐스팅은 `matchesPeriod` 시그니처 회피용. SEO 상 이 페이지는 **서버 렌더링**(SSG)이라 본문이 HTML 로 노출됨 — 약관 §14 가 "자동수집 팝업 상세는 클라이언트 렌더링"이라 한 것과 모순처럼 보이나, 이건 운영자 큐레이션 분류(집계/카운트)일 뿐 개별 팝업 상세(`/popup/[id]`, 클라이언트 렌더)가 아니므로 정책상 정합.

#### `popspot-frontend/app/sitemap.ts` — 검색엔진 sitemap.xml 자동 생성
- **책임**: Next `MetadataRoute.Sitemap` 규약으로 sitemap.xml 을 생성. 운영자가 직접 작성한 정적 페이지(`/`, `/about`, `/terms`, `/privacy`)와 long-tail 슬라이스 랜딩(`/popups/[slug]` 전부)만 포함. 자동수집 팝업 상세·사용자 게시판(메이트/의견)은 약관 §10-2/PII 보호 이유로 의도적으로 제외.
- **핵심 로직**:
  - `sitemap.ts:28-53` `staticPages` — 4개 정적 페이지에 `changeFrequency`/`priority`(메인 1.0, about 0.8, terms/privacy 0.3) 지정.
  - `sitemap.ts:56-75` `sliceLandings` — `REGIONS`(priority 0.7, daily), `PERIODS`(0.6, daily), `CATEGORIES`(0.5, weekly) 각 slug → `/popups/{slug}` URL 생성.
  - `sitemap.ts:77` — 둘을 합쳐 반환.
- **연결**: `@/lib/regions`(REGIONS), `@/lib/popupSlices`(PERIODS/CATEGORIES) 의존 — `popups/[slug]/page.tsx` 의 `generateStaticParams` 와 같은 소스라 sitemap URL ↔ 실제 생성 페이지가 1:1 정합. Naver/Google 서치 콘솔이 이 파일을 크롤.
- **특이사항**: `SITE_URL` 하드코딩(`https://popspot.co.kr`). `lastModified`는 빌드/요청 시점 `new Date()` 라 매 생성마다 갱신됨.

#### `popspot-frontend/app/feed.xml/route.ts` — RSS 2.0 피드 (Naver SearchAdvisor용) Route Handler
- **책임**: `GET /feed.xml` 에서 RSS 2.0 XML 을 직접 문자열로 빌드해 반환. 운영자 작성 정적 페이지 4건(about/메인/terms/privacy)만 item 으로 노출(약관 §10-2 일관성). Naver SearchAdvisor RSS 제출용.
- **핵심 로직**:
  - `feed.xml/route.ts:20` `export const revalidate = 3600;` — ISR 1시간.
  - `feed.xml/route.ts:29-58` `GET()` — `now = toUTCString()`, 4개 `FeedItem` 배열 정의(pubDate 모두 now).
  - `feed.xml/route.ts:60-73` — RSS 골격 문자열 조립(channel title/link/atom:self/description/language ko-KR/lastBuildDate/generator + `items.map(renderItem)`).
  - `feed.xml/route.ts:75-80` — `NextResponse` 로 `Content-Type: application/rss+xml; charset=utf-8` + `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
  - `feed.xml/route.ts:83-91` `renderItem`, `:93-100` `escapeXml`(`& < > " '` 이스케이프).
- **연결**: `next/server`(NextResponse) 외 외부 의존 없음. 외부 서치어드바이저가 호출. 라우트 세그먼트 이름 `feed.xml` 자체가 URL 경로가 됨(`.xml` 포함).
- **특이사항**: item 본문이 전부 정적 상수라 `escapeXml` 은 방어적이지만 실질 위험은 없음. sitemap/robots 와 함께 "정적 페이지만 노출" 정책을 코드로 3중 강제.

#### `popspot-frontend/app/popup/[id]/page.tsx` — 개별 팝업스토어 상세 (클라이언트 렌더, 인증 필요)
- **책임**: `"use client"` 동적 상세 페이지. URL `id` 로 백엔드 상세를 fetch 해 Hero(마퀴 타이포 + DigitalTicket), 기간/시간 카드, 본문(링크 자동 변환), 자동수집 출처/Takedown 박스, 카카오 지도, 음악 매칭, 실시간 채팅을 렌더. 스탬프 찍기/위시 토글/공유/신고 액션 제공. 비로그인 시 `/login` 강제.
- **핵심 로직**:
  - `popup/[id]/page.tsx:44-115` `KakaoRoadview` (export) — `window.kakao.maps.load` 안에서 `RoadviewClient.getNearestPanoId(position,50,...)` 로 반경 50m 파노라마 검색, 있으면 커스텀 오버레이 부착, 없으면 `isError` UI. 오버레이 HTML 의 장소명은 `escapeHtml(name)`(`:78`)로 이스케이프 — `dangerouslySetInnerHTML` 가 아닌 카카오 SDK content 문자열이라 직접 sanitize.
  - `popup/[id]/page.tsx:155-182` `renderContentWithLinks` — `/(https?:\/\/[^\s]+)/g` 로 본문을 쪼개 URL 조각만 `<a target=_blank rel=noopener noreferrer>` 로 렌더(나머지는 평문).
  - `popup/[id]/page.tsx:185-198` 인증 가드 useEffect — `localStorage.user` 없으면 `notify` 후 `router.replace("/login")`, 있으면 파싱+`isCheckingAuth=false`.
  - `popup/[id]/page.tsx:201-256` 상세 fetch useEffect — `isCheckingAuth` 동안 보류, `apiFetch('/api/popups/${params.id}')` → `response.data||response` 정규화 → `PopupDetail` 매핑(여러 백엔드 필드명 폴백: `popupId||id`, `location||address`, `startDate||openDate` 등). 성공 시 `recordVisit` 동적 import 로 최근 방문 기록(`:234-249`), 이어서 `checkIfStamped`/`checkWishlistStatus` 호출.
  - `popup/[id]/page.tsx:259-283` `checkIfStamped` — `/api/stamps/my?userId=` 결과에서 오늘 날짜(`toISOString().split('T')[0]`)+popupId 매칭으로 `isStamped` 판정.
  - `popup/[id]/page.tsx:286-299` `checkWishlistStatus` — `/api/wishlist/{userId}` 목록에 popupId 존재 여부로 `isLiked`.
  - `popup/[id]/page.tsx:301-317` `handleStamp` — `POST /api/stamps?userId=&popupId=`.
  - `popup/[id]/page.tsx:319-341` `handleToggleLike` — Optimistic UI(먼저 `setIsLiked` 토글 후 `POST /api/wishlist/{userId}/{popupId}`, 실패 시 `prevStatus` 롤백).
  - `popup/[id]/page.tsx:424-438` 공유 버튼 — `@/lib/share` 동적 import 후 Web Share/클립보드.
  - `popup/[id]/page.tsx:494-520` `sourceType==="CRAWLED"` 일 때만 "AI 자동수집 정보" + 원문 출처 링크 노출, `:521-541` 모든 row 에 Takedown 신고 버튼.
- **연결**: `apiFetch`(`@/lib/api` 가 아닌 상대경로 `../../../src/lib/api`), `notify/notifyError`, `escapeHtml`, 컴포넌트 `DetailMap/ChatRoom/DigitalTicket/MusicForPopup/TakedownModal`, `@/lib/recentVisits`·`@/lib/share`(동적), `next-themes`, framer-motion 의존. 호출처: 메인 지도 마커, music passport(`/popup/{matchedPopupId}`), 그 외 팝업 링크.
- **특이사항**: `TEST_USER_ID = "test_user"`(`:152`) 폴백이 남아 있어 user 미설정 시 stamp/wishlist 조회에 들어감(인증 가드가 먼저 막지만 잠재적 잔재). 좌표 기본값 건대입구(37.5445,127.0560). 이 페이지가 약관 §14 가 말하는 "클라이언트 렌더링되어 크롤러가 본문 수집 못 하는" 자동수집 상세에 해당.

#### `popspot-frontend/app/login/page.tsx` — 로그인 + 소셜 로그인 + 게스트 진입
- **책임**: 이메일/비번 로그인, 카카오·네이버·구글 OAuth 시작, "게스트로 N일 둘러보기" 명시적 진입(인트로 자동시작 폐기 후 정상 진입점). 아이디 저장(localStorage), 비번 표시 토글, Enter 제출.
- **핵심 로직**:
  - `login/page.tsx:33-39` 마운트 시 `savedEmail` 복원.
  - `login/page.tsx:49-76` `handleLogin` — `POST /api/v1/auth/login` → `localStorage.user`(+`token`,+조건부 `savedEmail`) 저장 → `notifySuccess` → `router.push("/?entered=1")`(인트로 미들웨어 우회).
  - `login/page.tsx:78-80` `handleSocialLogin` — `window.location.href = ${API_BASE_URL}/oauth2/authorization/{provider}`.
  - `login/page.tsx:88-97` `handleGuestLogin` — `startGuestMode()`(7일 카운터 시작) → 안내 토스트 → `/?entered=1`.
- **연결**: `apiFetch/API_BASE_URL`(`@/lib/api`), `@/components/ui/button`·`input`(Button/Input/Field), `notify/notifyError/notifySuccess`, `@/lib/guestMode`(GUEST_GRACE_PERIOD_DAYS/startGuestMode). 결과적으로 `/oauth/callback`(소셜), `/?entered=1`(성공), `/signup`·`/find-account`(링크)로 이어짐.
- **특이사항**: 토큰을 `localStorage` 에 저장(XSS 노출면). 소셜 로그인은 풀 페이지 리다이렉트라 SPA 상태 초기화됨. 배경 `<video src=/login-bg.mp4>` 사용.

#### `popspot-frontend/app/signup/page.tsx` — 회원가입 (이메일 인증 + 실시간 유효성 + 허니팟)
- **책임**: 이메일 인증코드 발송/검증, 비번·닉네임·생년월일·성별·휴대전화 입력 + 실시간 유효성, 필수 약관 2종 동의, 만 14세 이상 정책, honeypot 봇 차단을 거쳐 `POST /api/v1/auth/signup`. 게스트 만료 리다이렉트 시 안내 배너.
- **핵심 로직**:
  - `signup/page.tsx:25-33` 생년 옵션 — `MAX_BIRTH_YEAR = CURRENT_YEAR - 14`(만 14세 정책을 옵션 단에서 강제).
  - `signup/page.tsx:77` `guestExpired = searchParams.get("reason")==="guest_expired"` → `:336-343` 배너.
  - `signup/page.tsx:97-98` honeypot state + `formMountAtRef`(마운트 시각).
  - `signup/page.tsx:109-117` 연/월/일 select 합성 → `formData.birthdate`(`YYYY-MM-DD`).
  - `signup/page.tsx:129-152` 정규식 유효성(email/password 8~20 영숫자특수/match/name 2~8/phone `^010\d{8}$`) + `isFormValid` 집계(인증완료+약관동의 포함).
  - `signup/page.tsx:167-180` `handleChange` 입력 sanitize — email 은 비-ASCII 제거(`/[^\x20-\x7E]/g`), phone 은 숫자만(`/\D/g`).
  - `signup/page.tsx:191-224` `handleSendAuth` — `POST /api/v1/auth/email/send` → `isAuthSent`, `timer=300`(Redis 5분).
  - `signup/page.tsx:226-254` `handleVerifyAuth` — `POST /api/v1/auth/email/verify` → `isAuthVerified`.
  - `signup/page.tsx:256-303` `handleSignup` — `isFormValid` 가드 후 **honeypot 검사**(`:268` — `honeypot.length>0` 또는 마운트 후 3초 미만이면 봇 → 조용히 실패), 통과 시 가입 API → 성공 시 `/login`.
- **연결**: `apiFetch`(`@/lib/api`), `Button/Input/Field`, `Swal`(sweetalert2 직접 사용 — login/find-account 가 notify 추상화를 쓰는 것과 대비). 약관/개인정보 동의 박스에서 `/terms`·`/privacy` 새 탭 링크.
- **특이사항**: 비번 표시 아이콘 컨벤션이 login/signup 이 상이 — signup 은 "보이는 상태=Eye(뜬 눈)"(`:460-463`). honeypot 필드 `name="company-website"` 를 화면 밖(`-left-[9999px]`)에 배치. 이 페이지만 notify 미사용(Swal 직접) — 의도적 예외.

#### `popspot-frontend/app/oauth/callback/page.tsx` — OAuth 콜백 토큰 처리 + /api/auth/me 권한 재검증
- **책임**: 소셜 로그인 리다이렉트 착지점. URL `token` 을 `localStorage` 에 저장하고 즉시 URL 에서 제거, `/api/v1/auth/me` 로 서버가 토큰을 검증해 돌려준 유저 정보를 신뢰(클라이언트 URL 의 role 등을 믿지 않음)해 저장 후 메인으로.
- **핵심 로직**:
  - `oauth/callback/page.tsx:14-18` `CallbackContent` — `hasFetched` ref 로 StrictMode 이중 호출 방지.
  - `oauth/callback/page.tsx:27-40` `token` 추출 → `localStorage.setItem("token")` → `window.history.replaceState({},"","/oauth/callback")`(보안: 토큰을 히스토리/프록시 로그에서 제거). 토큰 없으면 2초 뒤 `/login`.
  - `oauth/callback/page.tsx:42-64` `GET /api/v1/auth/me` → 응답의 `userId/nickname/isPremium/role` 만 추려 `realUser`(+`isSocial:true`) 저장 → 0.5초 뒤 `window.location.href="/?entered=1"`.
  - `oauth/callback/page.tsx:65-76` 401 등 거부/예외 시 status 메시지 노출 후 3초 뒤 `/login`.
  - `oauth/callback/page.tsx:90-98` Suspense 래핑(useSearchParams 요구).
- **연결**: `apiFetch`(상대경로 `../../../src/lib/api`). login 페이지의 소셜 버튼이 이 경로로 귀환. `/api/v1/auth/me` 백엔드 의존(task #8 "클라이언트 권한 URL 신뢰 제거"의 산출물).
- **특이사항**: 권한을 URL 파라미터가 아니라 서버 `me` 응답으로 확정하는 게 핵심 보안 포인트. 성공 시 `router` 대신 `window.location.href` 사용(전체 리로드로 인증 상태 확실히 반영).

#### `popspot-frontend/app/admin/page.tsx` — 관리자 콘솔 (6탭: 대시보드/팝업/커뮤니티/보상/의견/로그)
- **책임**: ADMIN 전용 통합 관리 SPA. 실시간 서버 리소스 차트 + 통합 메트릭(JVM/HTTP/DB/자동수집) 카드 + 제보 승인 대기열, 전체 팝업 상태 제어, 메이트 게시글 삭제, 수동 보상 지급, 의견 검수(AdminFeedbackPanel), SSE 실시간 로그(LogViewer). 클라이언트 role 게이트로 비-ADMIN 진입 차단.
- **핵심 로직**:
  - `admin/page.tsx:95-114` role 게이트 useEffect(v2.13.3 핫픽스) — `localStorage.user` 없으면 `/login`, 파싱한 `role` 을 `trim().toUpperCase()` 후 `"ROLE_ADMIN"||"ADMIN"` 이면 `authorized=true`, 아니면 `/`. 주석(`:76-92`)에 비-ADMIN 진입 시 metric polling/SSE 가 매 요청 403 + 백엔드 stack trace 도배를 유발해 polling 시작 전에 가드한다고 명시.
  - `admin/page.tsx:62-69` `toLinePoint` — DashboardSnapshot → `{time, heapMb, httpRps}` 차트 점 압축.
  - `admin/page.tsx:123-128` `useDashboardMetrics(toLinePoint, 3000ms, buffer 15, authorized)` — `authorized` false 면 폴링 미시작.
  - `admin/page.tsx:153-179` server-status 폴링 useEffect — `authorized && activeTab==="DASHBOARD"` 조건, `/api/admin/metrics/server-status` 3초 폴링으로 cpu/memory 차트(`realtimeMetrics`, 최근 15개 slice).
  - `admin/page.tsx:200-205` 탭 전환 시 데이터 로딩 분기(DASHBOARD→stats+pending, POPUPS→all, MATES→mate-posts) — 모두 `authorized` 가드.
  - `admin/page.tsx:209-289` 액션 핸들러: `handleApprove`(POST approve), `handleReject`(DELETE reject), `handleChangeStatus`(`Swal.fire input:'select'` 로 상태 선택 후 PATCH — 주석 `:235-239` 에 select 다이얼로그라 notify 미지원이라 Swal 예외 유지 명시), `handleDeleteMatePost`(DELETE), `handleGiveReward`(POST reward).
  - `admin/page.tsx:303-311` `!authorized` 면 "권한 확인 중..." 로더로 첫 paint 가림.
  - `admin/page.tsx:597-601` LOGS 탭은 `activeTab==="LOGS" && authorized` 일 때만 `<LogViewer active>` 렌더 → EventSource 도 그 때만 생성.
- **연결**: `apiFetch`(상대경로), `confirmAction/notifyError/notifySuccess`, `PopupStore` 타입, `MetricCard`, `useDashboardMetrics`, `LogViewer`, `AdminFeedbackPanel`, recharts(Pie/Bar/Line), `Swal`. 다수의 `/api/admin/*` 엔드포인트 의존.
- **특이사항**: 클라이언트 role 가드는 UX/로그노이즈 방지용이며 실제 권한은 서버 토큰 검증으로 강제됨(주석 명시). role 값이 환경별 `ROLE_ADMIN`/`ADMIN` 둘 다 존재 가능해 둘 다 통과. 대시보드에 server-status 폴링과 통합 메트릭 폴링이 **이중**으로 돈다(둘 다 3초). `handleChangeStatus` 만 Swal 직접 호출.

#### `popspot-frontend/app/feedback/page.tsx` — 의견 보내기 (작성 폼 + 내 의견 목록), 게스트 허용
- **책임**: 좌측 `FeedbackForm`, 우측 `MyFeedbackList` 2열 레이아웃. 로그인 사용자는 답변까지 열람, 게스트는 작성만. 비회원 허용 페이지(AuthGuard PUBLIC_PATHS 포함).
- **핵심 로직**:
  - `feedback/page.tsx:23-33` 마운트 시 `localStorage.user` 파싱해 `userId`(`parsed.userId ?? parsed.id ?? null`) 추출.
  - `feedback/page.tsx:21,59,69` `refreshKey` — 제출 성공 시 증가시켜 `MyFeedbackList` 강제 갱신.
- **연결**: `@/features/feedback/FeedbackForm`·`MyFeedbackList`, `User` 타입. layout 에서 noindex. BottomDock/Footer 등에서 진입.
- **특이사항**: 페이지 본문 자체는 가벼운 컨테이너이고 실제 로직은 features/feedback 모듈에 위임.

#### `popspot-frontend/app/find-account/page.tsx` — 아이디/비밀번호 찾기 (탭 + 비번 3단계)
- **책임**: '아이디 찾기'(이름+휴대폰 → 이메일/소셜 제공자 조회)와 '비밀번호 찾기'(이메일 인증→코드 검증→새 비번 설정 3스텝) 탭. 소셜 회원은 비번 재설정 대신 소셜 로그인 안내.
- **핵심 로직**:
  - `find-account/page.tsx:32-38` `handleTabChange` — 탭 전환 시 모든 입력/결과 초기화.
  - `find-account/page.tsx:40-63` `handleFindId` — `GET /api/v1/auth/find-email?nickname=&phoneNumber=` → 응답의 `provider` 가 LOCAL 아니면 `providerInfo` 세팅.
  - `find-account/page.tsx:66-96` `handleSendEmailCode` — `POST /api/v1/auth/email/send-for-pw`, 실패 응답에 `SOCIAL_USER` 포함 시 `msg.split(":")[1]` 로 제공자 추출해 안내(소셜 회원 차단), 성공 시 `pwStep=2`.
  - `find-account/page.tsx:99-120` `handleVerifyCode` — `POST /api/v1/auth/email/verify` → `pwStep=3`.
  - `find-account/page.tsx:123-145` `handleChangePassword` — `POST /api/v1/auth/reset-password` → `/login`.
- **연결**: `apiFetch`(상대경로), `notify/notifyError`, framer-motion(AnimatePresence). login 페이지의 "아이디·비밀번호 찾기" 링크에서 진입.
- **특이사항**: **잠재 버그** — 아이디 찾기 결과 화면은 `activeTab==='id' && foundEmail`(`:198`) 조건으로 렌더되는데, `handleFindId` 는 `foundEmail` 을 set 하지 않고 `providerInfo` 만 set 한다. 따라서 성공해도 결과 박스(`{foundEmail}` 표시)가 뜨지 않을 수 있음 — `setFoundEmail` 호출 누락 정황. 백엔드가 `data.provider` 외 이메일 필드를 어떻게 주는지와 무관하게 화면 전환 트리거(`foundEmail`)가 비어 있음.

#### `popspot-frontend/app/music/page.tsx` — /music → 홈 MUSIC 탭 리다이렉트 (서버)
- **책임**: `/music` 라우트를 홈의 MUSIC 탭으로 흡수. 북마크/외부 링크 호환 위해 서버 `redirect("/?tab=music")`.
- **핵심 로직**: `music/page.tsx:7-9` — 컴포넌트 본문에서 즉시 `redirect` 호출(렌더 없음).
- **연결**: `next/navigation` 의 `redirect`. music/passport 의 EmptyHistory 가 `/music` 링크를 가리킴 → 이 리다이렉트로 홈 탭 진입.
- **특이사항**: `"use client"` 없는 서버 컴포넌트라 307 서버 리다이렉트.

#### `popspot-frontend/app/music/passport/page.tsx` — 뮤직 패스포트 (음악 청취 기록 타임라인)
- **책임**: `"use client"`. 사용자 음악 재생 이력을 fetch 해 통계(총 재생/감상 곡/매칭 팝업)와 타임라인 카드로 렌더. 카드 클릭 시 트랙 재생, 매칭 팝업 링크 제공.
- **핵심 로직**:
  - `music/passport/page.tsx:25-45` 마운트 fetch — `/api/music/history?limit=50` 로 이력 로드 후, 트랙 메타 보강 위해 `/api/music/popular?limit=100` 를 추가 호출해 `id→MusicTrack` 맵 구성(주석: 백엔드 join 추가 전 임시 매칭).
  - `music/passport/page.tsx:48-58` `useMemo` 통계 — `trackId`/`matchedPopupId` Set 크기로 uniqueTracks/matchedPopups 계산.
  - `music/passport/page.tsx:132-150` 아트워크 클릭 → `player.play(t)`(트랙 없으면 disabled), 이미지는 Spotify/iTunes CDN URL 을 `<img>` 직접 사용(next/image 도메인 화이트리스트 회피, eslint-disable 주석).
  - `music/passport/page.tsx:161-169` `matchedPopupId` 있으면 `/popup/{id}` 링크(sm 이상에서만 표시).
  - `music/passport/page.tsx:247-260` `fmtDate` — ko-KR 짧은 날짜 포맷, 실패 시 원문.
- **연결**: `apiFetch`(`@/lib/api`), `MusicTrack/UserMusicHistory` 타입, `useMusicPlayer`(`@/components/music/MusicPlayerProvider`), `/popup/[id]` 링크, framer-motion. 보조 컴포넌트 `StatCell/SkeletonRows/EmptyHistory` 동일 파일 내 정의.
- **특이사항**: 이력의 `trackId` 가 popular 캐시 100개 안에 없으면 트랙 메타가 비어 `Track #{id}` 폴백 표시(임시 매칭의 한계). 인증 가드 없음 — 비로그인 시 history API 가 빈 배열을 주면 EmptyHistory 노출.

#### `popspot-frontend/app/about/page.tsx` — 서비스 소개 (7대 보안 안전장치 마케팅)
- **책임**: `"use client"`. 백엔드에 실제 적용된 7가지 보안/정책 안전장치(JWT/BCrypt12/CORS 화이트리스트/Rate Limit/PIPA/Takedown 24h/HTTPS)를 일반어 카드로 노출. 상용화 직전 신뢰도 확보용. README 정책 안전장치와 1:1.
- **핵심 로직**:
  - `about/page.tsx:31-88` `SECURITY_CARDS` 상수 배열(Icon/title/shortDesc/detail/accent).
  - `about/page.tsx:90-108` `ACCENT_BG`/`ACCENT_BAR` 매핑으로 카드별 색상 토큰.
  - `about/page.tsx:138-164` `whileInView` 스크롤 진입 애니메이션으로 카드 그리드 렌더.
  - `about/page.tsx:184-204` 하단 CTA — `/terms`, `/privacy`, `mailto:reo4321@naver.com`.
- **연결**: framer-motion, lucide-react, next `Link`. layout 에서 메타/canonical. sitemap 포함(priority 0.8). 메인/푸터에서 진입.
- **특이사항**: 정적 마케팅 콘텐츠라 외부 데이터/상태 없음. 카드 detail 의 보안 수치(시크릿 32바이트, BCrypt 12 등)는 실제 백엔드 설정과 일치해야 하는 "문서-코드 동기화" 대상.

#### `popspot-frontend/app/planning/page.tsx` — 작전 회의실 (실시간 협업 코스 짜기, STOMP)
- **책임**: `"use client"`. `?room=` 방 단위로 STOMP/SockJS 실시간 동기화해 여러 사용자가 지도에 장소를 추가/삭제/투표하고, OSRM 도보 경로와 총 소요시간을 계산하며, 최근접 이웃 휴리스틱으로 동선 최적화. 비로그인/방ID 없음은 차단.
- **핵심 로직**:
  - `planning/page.tsx:46-57` `generateMockRoute` — OSRM 실패 시 직선 보간 경로.
  - `planning/page.tsx:60-78` `fetchRealRoute` — `router.project-osrm.org/route/v1/foot/...` 호출, 실패 시 mock 폴백.
  - `planning/page.tsx:81-92` `calculateRouteInfo` — Haversine 거리 × 1.3(도보 보정) → 분(67m/min) + 거리 문자열.
  - `planning/page.tsx:111-115` `totalTime` — 인접 마커 간 시간 누적.
  - `planning/page.tsx:118-132` 마커 변경 시 인접 쌍마다 `fetchRealRoute` 병렬 → `routePaths`.
  - `planning/page.tsx:135-159` `optimizeRoute` — 3개 미만이면 차단, 확인 후 현재 위치 시작 최근접 이웃 정렬(유클리드 거리).
  - `planning/page.tsx:161-184` STOMP 액션 publish — `sendVote`/`addPlaceToMap`(중복/미연결 가드, `name|lat|lng` 직렬화)/`removeMarker`/`inviteFriend`(URL 클립보드 복사).
  - `planning/page.tsx:186-255` 메인 useEffect — roomId 없으면 `/`, 비로그인 `/login`, 초기 `GET /api/planning/{roomId}/state` 로 마커/투표/참가자 복원, `new SockJS(${SOCKET_BASE_URL}/ws-planning)` 연결, onConnect 시 JOIN publish + `/topic/plan/{roomId}` 구독(VOTE/ADD/REMOVE/CLEAR/JOIN/LEAVE 액션별 state 갱신), cleanup 에서 `client.deactivate()`.
  - `planning/page.tsx:257-267` `handleSearch` — `GET /api/popups/search?keyword=`.
- **연결**: `@stomp/stompjs`(Client), `sockjs-client`, `InteractiveMap`(mode="PLAN", routePaths 전달), `API_BASE_URL/SOCKET_BASE_URL`(상대경로 lib/api), `notify/confirmAction`, framer-motion, 외부 OSRM. 헤더 뒤로가기는 `/?entered=1`.
- **특이사항**: 마커 `id` 가 `name+lat+lng` 문자열 연결로 생성돼 동일 이름·좌표면 충돌 가능. useEffect 의존성에 `myInfo.color` 가 들어가(`:255`) 색상 변동 시 소켓 재연결 위험(주석으로 의도 표시). OSRM 공개 서버 직접 호출(rate limit/안정성 외부 의존). layout 에서 noindex(방 ID URL 노출 방지).

#### `popspot-frontend/app/privacy/page.tsx` — 개인정보 처리방침 (정적, 서버 컴포넌트)
- **책임**: PIPA 기준 개인정보 처리방침 전문. 수집 항목/이용 목적/보유 기간/제3자 제공/위탁/이용자 권리/파기/만14세/안전성/쿠키/DPO/개정 12개 조항을 표·리스트로 구조화 렌더.
- **핵심 로직**:
  - `privacy/page.tsx:4-8` `export const metadata`(title/description) — 서버 컴포넌트라 페이지에서 직접 메타 export(layout 메타와 병합).
  - `privacy/page.tsx:31-82` `COLLECTION_TABLE`/`PROCESSOR_TABLE` 상수 — 수집 항목/위탁 업체(Google/Kakao/NAVER/Vercel/Sentry/Groq/Spotify·YouTube·Algolia) 데이터.
  - `privacy/page.tsx:284-359` 재사용 컴포넌트 `Section/DataTable/Ul/Ol/Note/ContactLink`(mailto subject 인코딩).
- **연결**: next `Link`(홈/terms). layout + 페이지 메타 이중 정의. sitemap 포함. signup 동의 박스/about/footer 에서 진입.
- **특이사항**: 위탁 업체 목록이 실제 사용 SaaS 와 동기화돼야 하는 문서. 순수 정적이라 SSG 로 HTML 노출(검색 색인 의도).

#### `popspot-frontend/app/terms/page.tsx` — 이용약관 (정적, 자동수집/검색 API/검색엔진 노출 정책)
- **책임**: 자동수집 운영의 법적 안전장치 약관 전문(§10 자동수집 출처/면책, §10-2 외부 검색 API 사용 형태·저작권, §11 Takedown 24h, §12 정보 보존, §13 개인정보 수집·이용, §14 검색엔진 노출 정책)을 조항별로 렌더. `deploy/TERMS_OF_SERVICE_CLAUSE.md` 와 동기화 유지 대상(주석 `:21-22`).
- **핵심 로직**:
  - `terms/page.tsx:4-8` `metadata` export.
  - `terms/page.tsx:97-147` §10-2 — 외부 검색 API(네이버/카카오) 정식 호출, snippet/링크만 수집, LLM 으로 이름·위치·기간·카테고리만 구조화 추출하고 **원문 미복제**, 출처 링크 노출, 검색결과 페이지 재현 금지를 명문화 — `sitemap.ts`/`feed.xml`/`popups/[slug]` 의 "자동수집 상세 제외" 정책의 법적 근거.
  - `terms/page.tsx:297-354` §14 — sitemap 포함 페이지를 정적 4종으로 한정, 회원가입/로그인/계정찾기/OAuth/어드민/의견/작전회의실은 robots+noindex 차단, 자동수집 상세는 클라이언트 렌더로 크롤 차단, 회원 게시물 SSR 전환 시 재동의를 약속.
- **연결**: next `Link`. layout+페이지 메타 이중. sitemap 포함. signup 동의 박스, about/privacy/footer 링크에서 진입.
- **특이사항**: §14 3항이 noindex 대상으로 나열한 경로들이 실제 각 `layout.tsx` 의 `robots:{index:false}` 와 정확히 매칭(코드-약관 정합). §14 4항의 "자동수집 상세=클라이언트 렌더"는 `/popup/[id]`(클라이언트)에 해당하며 `/popups/[slug]`(서버 SSG, 집계)와는 별개.

#### `popspot-frontend/app/{admin,login,signup,feedback,find-account,oauth,planning}/layout.tsx` — 비공개 페이지 noindex 메타 래퍼 (7개)
- **책임**: 각 라우트 세그먼트에 `export const metadata = { robots: { index: false, follow: false } }` 만 선언하고 `children` 을 그대로 통과(`<>{children}</>`)시키는 얇은 래퍼. 검색엔진 색인 차단(v2.15).
- **핵심 로직**: 7개 파일 모두 동일 구조 — 메타 객체 + 패스스루 컴포넌트. 차단 사유 주석만 상이:
  - admin(`admin/layout.tsx:3-9`): 운영자 전용+PII, robots.txt 와 이중 안전장치.
  - login/signup/find-account: 중복 노출·계정 URL 색인 불필요.
  - feedback(`feedback/layout.tsx:4-12`): 의견 본문/답변/게스트 이메일 PII 가 함께 렌더 → noindex.
  - oauth: 토큰 처리/리다이렉트 전용.
  - planning: 방 ID 가 URL 에 포함되는 회원 협업 공간 → 사생활.
- **연결**: 각 동명 `page.tsx` 를 감쌈. 약관 §14 3항의 차단 목록과 1:1 대응. 정적 `robots.txt`(task #64)와 중복 방어.
- **특이사항**: admin layout 주석의 `robots.ts` 언급은 현재 정적 `robots.txt` 로 전환됨(task #64) — 주석이 약간 stale 하나 동작에는 무관.

#### `popspot-frontend/app/{about,terms,privacy}/layout.tsx` — 공개 페이지 SEO 메타/canonical 래퍼 (3개)
- **책임**: noindex 와 반대로, 공개 정적 페이지의 검색 노출 풍부도를 위해 `title/description/alternates.canonical/openGraph`(locale ko_KR) 를 선언하는 얇은 래퍼. 패스스루.
- **핵심 로직**:
  - about(`about/layout.tsx:6-17`): title "서비스 소개", canonical `/about`, og type website.
  - terms(`terms/layout.tsx:6-17`): canonical `/terms`, og type article.
  - privacy(`privacy/layout.tsx:6-17`): canonical `/privacy`, og type article.
- **연결**: 각 동명 page.tsx 를 감쌈. terms/privacy 는 page.tsx 도 자체 metadata 를 export 해 **메타가 layout+page 양쪽**에 존재(Next 가 병합; page 의 title 이 우선). about page 는 메타 없어 layout 메타만 적용. sitemap 의 공개 4종(메인 제외 3종)과 일치.
- **특이사항**: terms/privacy 의 title 이 layout("이용약관")과 page("이용약관 | POP-SPOT")에서 다르게 정의돼 page 쪽이 최종 적용됨 — 중복 정의지만 충돌은 아님(병합 규칙상 page 우선).

## F3 — 프론트 · 컴포넌트 (src/components)

#### `popspot-frontend/src/components/ChatRoom.tsx` — 팝업 상세 페이지용 공개 실시간 톡방
- **책임**: 특정 `roomId`의 공개 채팅방. 과거 히스토리 로드 + STOMP/SockJS WebSocket 구독으로 실시간 메시지를 받아 카카오톡 스타일 말풍선으로 렌더.
- **핵심 로직**:
  - `ChatRoom.tsx:31-54` 단일 useEffect 에서 ① `GET /api/chat/history/{roomId}` 로 히스토리 채우고 ② `SOCKET_BASE_URL/ws-stomp` 로 STOMP `Client` 생성, `onConnect` 시 `/sub/chat/room/{roomId}` 구독해 새 메시지를 `setMessages(prev => [...prev, newMessage])`. 클린업에서 `client.deactivate()`.
  - `ChatRoom.tsx:56-58` `messages` 변경 시 `scrollRef`를 맨 아래로 자동 스크롤.
  - `ChatRoom.tsx:60-65` `sendMessage` — `client.connected` 확인 후 `/pub/chat/message/{roomId}` 로 `{sender, message, type:'TALK'}` publish.
  - `ChatRoom.tsx:81` 메시지 분류가 **텍스트 기반 휴리스틱**: 본문에 "입장"/"퇴장" 포함이면 시스템 메시지, `ChatRoom.tsx:84` 정규식 `/\.(png|jpg|jpeg|gif|webp)$/i` 매칭이면 이미지로 간주. 이미지는 `${API_BASE_URL}/uploads/{content}` 로 표시.
- **연결**: `apiFetch`, `SOCKET_BASE_URL`, `API_BASE_URL`(`../lib/api`) 의존. `@stomp/stompjs` + `sockjs-client`. `isMe`는 `msg.sender === nickname` 닉네임 비교. 호출처는 팝업 상세 페이지(주입된 `roomId`, `nickname`).
- **특이사항**: 발신자 식별이 닉네임 문자열 동일성에만 의존 → 동명 닉네임 위장 가능. "입장/퇴장" 키워드가 일반 대화에 포함돼도 시스템 알약으로 오인. 이미지 URL은 백엔드 업로드 검증에 보안이 위임됨.

#### `popspot-frontend/src/components/MateBoard.tsx` — 동행(메이트) 모집 게시판
- **책임**: 동행 모집글 목록 조회/작성/신고/참여(채팅 진입). 상단 부스트(메가폰) 글을 가로 스와이프로 분리 노출. 글쓰기 모달은 포털로 렌더.
- **핵심 로직**:
  - `MateBoard.tsx:54-70` `fetchPosts` — `GET /api/mates`. **Spring Boot boolean getter 직렬화로 `isMegaphone`이 `megaphone`으로 들어오는 케이스를 `p.isMegaphone === true || p.megaphone === true` 로 정규화**(`:63`).
  - `MateBoard.tsx:72-82` `fetchBoostStatus` — `GET /api/mates/boost-status?userId=` 잔여 부스트 횟수.
  - `MateBoard.tsx:88-101` 글쓰기 모달 열림 시 `document.body.style.overflow` 잠금 + 부스트 상태 조회.
  - `MateBoard.tsx:103-134` `handleSubmit` — `POST /api/mates` 로 `{...formData, userId}` 전송, 부스트 여부에 따라 토스트 분기.
  - `MateBoard.tsx:139-170` `handleReport` — 본인 글 차단 후 `confirmAction` 확인 → `POST /api/mates/{id}/report?userId=`.
  - `MateBoard.tsx:172-197` `handleJoinChat` — 작성자면 즉시 `openChat(isAuthor:true)`, 아니면 `POST /api/mates/{id}/join?userId=` 후 성공/"이미 참여"면 채팅 진입, "FULL" 이면 안내.
  - `MateBoard.tsx:199-200` `isMegaphone && status!=='CLOSED'` 로 부스트/일반 분리.
  - `MateBoard.tsx:476-509` `AuthorAvatar` (사진 없으면 UserIcon), `MateBoard.tsx:512-518` `isMyPost`(userId 우선, nickname fallback), `MateBoard.tsx:527-580` `BoostToggle`(잔여 0이면 cursor-not-allowed).
- **연결**: `useChatStore.openChat`(store) 주입, `apiFetch`, `notify`/`notifyError`/`confirmAction`(동적 import), `BOOST_LIMIT_HINT`/`BoostStatus`(`@/lib/boost`), `RankKey`(`@/lib/rank`), `DomainUser`(`@/types/popup`). 호출처는 메인 페이지 MATE 탭(주입 `user`).
- **특이사항**: 본인 글 판정/신고 차단이 `userId` 또는 `nickname` 동일성 기반 — 서버 측 재검증 전제. `useBoost` 토글은 클라이언트 잔여 횟수만 보고 막으므로 실제 강제는 백엔드 몫.

#### `popspot-frontend/src/components/Map/InteractiveMap.tsx` — 카카오 지도 기반 팝업 마커 뷰 (메인 지도/코스/작전 모드)
- **책임**: 지도에 팝업 마커를 렌더하고 카테고리/지역/시점 필터, 내 위치, 줌, 사이드바 목록, 경로(폴리라인)를 제공. `DEFAULT`/`PLAN` 모드와 `showPath`로 동작 분기.
- **핵심 로직**:
  - `InteractiveMap.tsx:77-107` `spreadOverlappingMarkers` — 동일 좌표(자동수집 geocoding 중복) 마커를 반경 0.00005도 원형으로 분산. **주석(`:78-79`)대로 react-kakao-maps-sdk의 `Map` import와 JS `Map` 충돌을 피하려 Record로 그룹핑**.
  - `InteractiveMap.tsx:127-140` `useSearchParams` 대신 `window.location.search`를 useEffect 내에서 읽고 `popstate` 리스닝 — **production 빌드에서 Suspense 없는 `useSearchParams` 마운트 실패 회귀 차단**(`:118-120`).
  - `InteractiveMap.tsx:159-199` 데이터 fetch: `places` prop 있으면 코스 모드로 변환(좌표 없으면 성수 기본값 fallback), 없으면 `GET /api/map/markers`(직접 `fetch`).
  - `InteractiveMap.tsx:204-226` `markers` useMemo — 클라이언트 사이드 통합 필터. 우선순위: 상단 칩 category(ALL 아니면) > BROWSE deep-link category, 그 후 region/period. 마지막에 분산 적용.
  - `InteractiveMap.tsx:242-258` `handleMyLocation` — `navigator.geolocation`, **좌표는 브라우저 메모리에만 보관(PIPA 부담 최소)**. `enableHighAccuracy:false`.
  - `InteractiveMap.tsx:290-295` `<style jsx global>`로 `#map` 타일 이미지를 `invert+hue-rotate`로 다크 테마화.
  - `InteractiveMap.tsx:446-469` 경로: `routePaths` 있으면 실선 polyline, 없고 마커 2개 이상이면 점선 fallback.
  - `InteractiveMap.tsx:558-609` 선택 마커 상세 오버레이 — 클릭 시 `onMarkerClick(popupId)` 콜백.
  - `InteractiveMap.tsx:619-642` `FilterBadge` — X 클릭 시 해당 쿼리만 삭제 후 `window.location.replace`로 강제 navigation.
- **연결**: `react-kakao-maps-sdk`의 `Map`/`CustomOverlayMap`/`Polyline`, `notify`, `@/lib/regions`(classifyRegion 등), `@/lib/popupSlices`(classifyCategory/matchesPeriod 등). `onMarkerClick` 콜백을 부모(지도 탭)에 전달.
- **특이사항**: `FilterBadge.handleRemove`가 `window.location.replace`로 **전체 페이지 리로드**를 유발(SPA 흐름 깨짐) — 주석상 React가 searchParams 변경을 감지 못 하는 회귀 회피용 의도적 처리. `window.kakao`는 `declare global any`로 타입 느슨.

#### `popspot-frontend/src/components/Map/DetailMap.tsx` — 팝업 상세 위치 정적 지도
- **책임**: 단일 위경도를 받아 카카오 지도 + 마커 1개를 그리는 가벼운 표시용 컴포넌트.
- **핵심 로직**: `DetailMap.tsx:19-44` useEffect 에서 `window.kakao.maps` 로드 확인 → `kakao.maps.load` 콜백 안에서 `Map`(level 3) + `Marker` 생성. 좌표 없으면 조기 return.
- **연결**: `window.kakao`(`@/types/sdk`의 `KakaoMapsSdk` 타입). 호출처는 팝업 상세 페이지. 의존 없음(순수 SDK 래퍼).
- **특이사항**: 카카오 스크립트가 외부에서 선로드돼 있어야 동작 — 없으면 조용히 아무것도 안 그림.

#### `popspot-frontend/src/components/Map/KakaoRoadview.tsx` — 카카오 로드뷰(거리뷰) 패널
- **책임**: 위경도 주변 50m 내 파노라마를 찾아 로드뷰 표시 + 커스텀 오버레이로 장소 이름 핀. 파노라마 없으면 에러 안내.
- **핵심 로직**:
  - `KakaoRoadview.tsx:29` `RoadviewClient.getNearestPanoId(position, 50, cb)` — panoId 있으면 `setPanoId`, 없으면 `setIsError(true)`.
  - `KakaoRoadview.tsx:34-90` 오버레이 HTML 문자열을 인라인 `<style>`(pulse-dot, 반응형 media query)과 함께 생성. **`escapeHtml(name)`으로 이름을 이스케이프**(`:37`) — XSS 방지.
  - `KakaoRoadview.tsx:104-112` 에러 시 AlertCircle 안내 카드 렌더.
- **연결**: `escapeHtml`(`@/lib/escapeHtml`), `window.kakao`. 호출처는 `DigitalTicket`(로드뷰 모달).
- **특이사항**: `innerHTML` 성격의 content 문자열에 사용자 데이터(`name`)가 들어가므로 `escapeHtml`이 보안 핵심 — 제거 시 XSS 취약.

#### `popspot-frontend/src/components/music/MusicPlayerProvider.tsx` — 전역 음악 플레이어 상태/엔진 오케스트레이터
- **책임**: 앱 전역 단일 음악 플레이어. 3-tier 재생 엔진(spotify/preview/youtube)을 투명하게 선택·통합하고, 큐 관리(playlist + autoQueue), 매칭 결과 fetch, 모드(hidden/mini/full)를 Context로 제공. 라우트 이동에도 끊기지 않게 layout 최상단에 둠.
- **핵심 로직**:
  - `MusicPlayerProvider.tsx:124-136` 엔진 결정 useMemo — Premium 연결 + 데스크탑(모바일 UA 제외) + Spotify trackId 면 `spotify`, `previewUrl` 있으면 `preview`, 아니면 `youtube`. trackId는 `spotifyTrackId || itunesTrackId`(레거시 호환).
  - `MusicPlayerProvider.tsx:138-179` 세 훅(`useYouTubePlayer`/`usePreviewPlayer`/`useSpotifyPlayer`)을 모두 호출하되 활성 엔진에만 입력 전달, `MusicPlayerProvider.tsx:182-190` 활성 엔진 신호/컨트롤을 `player`로 통합(YouTube `containerRef` 공유).
  - `MusicPlayerProvider.tsx:141-167` YouTube `onError` — **같은 trackId 중복 skip 방지(`skippedTrackIdRef`)**, `describeYouTubeError`로 토스트, `POST /api/music/{id}/playback-failed`로 백엔드 마킹 후 다음 곡.
  - `MusicPlayerProvider.tsx:194-207` `refillAutoQueue` — `GET /api/music/{seedId}/next?limit=8`(중복 호출 `refillingRef` 가드).
  - `MusicPlayerProvider.tsx:209-226` `fetchMatchResult` — `POST /api/music/{trackId}/play` 로 매칭 팝업 + lazy youtube_video_id 받아 `current` 덮어씀.
  - `MusicPlayerProvider.tsx:240-257` `playNextFromQueue` — playlist 다음 곡 우선, 없으면 autoQueue head.
  - `MusicPlayerProvider.tsx:286-313` youtube 엔진인데 매칭 0(youtubeVideoId null)이면 토스트 + 자동 skip(`noMatchHandledRef` 중복 방지).
  - `MusicPlayerProvider.tsx:379-386` YouTube IFrame "무대" div — **약관 III.E.4.b 준수로 영상은 어느 모드든 시각 노출, preview/spotify면 hidden**.
- **연결**: `apiFetch`, `notify`, `useSpotifyAuth`(`@/features/music`), `MatchResult`/`MusicTrack`(`@/types/music`), 세 재생 훅. `useMusicPlayer()` 훅으로 `GlobalMusicPlayer`/`MusicTab`/`MusicForPopup`이 소비. Context 미존재 시 throw(`:393`).
- **특이사항**: 세 재생 훅을 항상 동시 호출(조건부 훅 회피)하고 비활성 엔진엔 null 입력 — 구조적으로 안전하지만 SDK 3개 동시 로드 가능성. 모바일 spotify 제외는 UA 정규식 의존.

#### `popspot-frontend/src/components/music/GlobalMusicPlayer.tsx` — 전역 플레이어 UI (미니바 + 풀스크린)
- **책임**: Provider의 상태를 구독해 mini(하단 바)/full(풀스크린 모달) 두 UI를 렌더. 앨범아트, 진행바 seek, 컨트롤, 매칭 팝업 카드, 음원 어트리뷰션.
- **핵심 로직**:
  - `GlobalMusicPlayer.tsx:37-49` 루트 — `current` 없거나 hidden 이면 null, 아니면 모드별 AnimatePresence.
  - `GlobalMusicPlayer.tsx:53-169` `MiniPlayerBar` — 진행바, 앨범아트(클릭 시 `expand`), prev/toggle/next/close. 닫기 버튼에 `stopPropagation+preventDefault`로 라우터 버블링 차단. 매칭 1순위 팝업만 `Link href /popup/{id}` 노출.
  - `GlobalMusicPlayer.tsx:174-389` `FullScreenPlayer` — 앨범아트 블러 배경, 영상 자리(YouTube IFrame 무대가 덮음, 아니면 앨범아트 z-0), `seekPercent`(progressbar 클릭 위치 계산), moodTags 칩, 매칭 팝업 그리드(`Link onClick collapse`).
  - `GlobalMusicPlayer.tsx:20-25` `formatSeconds` 유틸.
- **연결**: `useMusicPlayer`(Provider). `PopupMatch`(`@/types/music`). next/link. 호출처는 RootLayout(1회 렌더).
- **특이사항**: 앨범아트/팝업 이미지에 `next/image` 대신 `<img>` 사용 — 주석대로 Spotify/외부 CDN 도메인 화이트리스트 회피. 풀스크린 닫기 버튼이 페이지 위 떠 있을 때 라우터/링크 오작동 막으려 이벤트 전파 차단.

#### `popspot-frontend/src/components/music/MusicPlayerModal.tsx` — (Deprecated) 빈 컴포넌트
- **책임**: 과거 모달 플레이어. 현재 Provider+GlobalMusicPlayer로 대체돼 `return null`만 남은 import 호환용 스텁.
- **특이사항**: `@deprecated` 주석(`:3-7`) — 다음 정리에서 파일째 삭제 가능. 데드코드.

#### `popspot-frontend/src/components/music/MusicTab.tsx` — 메인 MUSIC 탭 (검색/카테고리/인기/룰렛)
- **책임**: 음악 디스커버리 홈. Spotify 검색(자동완성+자동 결과), 무드 카테고리 칩, 인기 차트, "운명의 곡" 룰렛, 패스포트 진입, Spotify 연결 버튼.
- **핵심 로직**:
  - `MusicTab.tsx:26-33` `useDebounce` 훅(250ms).
  - `MusicTab.tsx:39-50` `CATEGORIES` — **한국 컨텍스트 키워드로 정정**(`:36-38`, 이전 광범위 영어 키워드로 해외곡 혼입 보고 반영).
  - `MusicTab.tsx:88-111` 인기곡(`/api/music/popular`) + 자동완성(`/api/music/suggest`) fetch.
  - `MusicTab.tsx:116-139` 입력만 해도 `debouncedQuery`로 자동 검색(`/api/music/search`), 별개로 자동완성 드롭다운.
  - `MusicTab.tsx:142-155` 외부 클릭 시 드롭다운 닫기.
  - `MusicTab.tsx:167-185` `handleKeyDown` — ArrowUp/Down으로 후보 이동, Enter 시 활성 후보 또는 입력값 검색.
  - `MusicTab.tsx:187-211` `handleCategory`(`/api/music/category`), `handleRoulette`(`POST /api/music/roulette` → `player.play`).
  - `MusicTab.tsx:390-443` `TrackCard`(클릭 시 `player.play(t, display)` — 현재 그리드를 playlist로), `SkeletonGrid`, `EmptyState`.
- **연결**: `useMusicPlayer`, `apiFetch`, `SpotifyConnectButton`(`@/features/music`), `MusicTrack`/`MatchResult`. 호출처 메인 페이지 MUSIC 탭.
- **특이사항**: 자동완성과 자동 검색이 같은 `debouncedQuery`에 동시 의존 — 입력 즉시 두 API 동시 호출. 앨범아트 `<img>` 직접 사용(CDN 화이트리스트 회피).

#### `popspot-frontend/src/components/music/MusicForPopup.tsx` — 팝업 상세 "어울리는 곡" 위젯
- **책임**: 팝업 상세에 끼워 쓰는 AI 매칭 곡 카드 6개. 클릭 시 전역 플레이어 재생.
- **핵심 로직**: `MusicForPopup.tsx:30-38` `GET /api/music/by-popup/{popupId}?limit=6`. `MusicForPopup.tsx:56` 매칭 0개면 `null`(섹션 자체 숨김). `MusicForPopup.tsx:78` 카드 클릭 시 `player.play(track, 매칭곡들)` — 매칭 목록을 playlist로 설정. 로딩 시 스켈레톤.
- **연결**: `useMusicPlayer`, `apiFetch`, `MusicTrack`. 호출처 팝업 상세 페이지(주입 `popupId`).
- **특이사항**: 간결한 위젯. `score`(매칭%) 배지 노출.

#### `popspot-frontend/src/components/music/useYouTubePlayer.ts` — YouTube IFrame Player 제어 훅
- **책임**: YouTube IFrame API를 동적 로드하고 영상 재생/일시정지/seek/진행률을 노출. Provider가 youtube 엔진일 때 사용.
- **핵심 로직**:
  - `useYouTubePlayer.ts:16-34` `loadYouTubeApi` — 스크립트 1회 로드, `onYouTubeIframeAPIReady` 콜백 큐(`apiLoaded`/`apiCallbacks` 모듈 전역).
  - `useYouTubePlayer.ts:48-62` `describeYouTubeError` — 코드 2/5/100/101/150 → 한국어 사유(101/150은 "업로더 임베드 차단").
  - `useYouTubePlayer.ts:104-189` 플레이어 생성 useEffect — **핵심 주의(`:74-82`): `new YT.Player(element)`가 element를 iframe으로 교체해 React reconcile NotFoundError 유발. wrapper 안에 매번 새 inner div를 직접 만들어 YouTube에 넘기고, 클린업에서 직접 destroy/removeChild**.
  - `useYouTubePlayer.ts:123-133` playerVars — autoplay/controls0/modestbranding/rel0/disablekb/fs0/playsinline 등(약관 + UX). `:124` height "100%"(0으로 두면 오디오 분리 사용 해석 위험).
  - `useYouTubePlayer.ts:141-156` `onStateChange`(0=ended→onEnded), `onError`→onErrorRef.
  - `useYouTubePlayer.ts:192-203` 500ms 폴링으로 progress/currentSec/durationSec 갱신.
  - `useYouTubePlayer.ts:90-95` `onEnded`/`onError`를 ref로 잡아 effect 재실행 없이 최신값 참조.
- **연결**: `YouTubeIframeSdk` 등(`@/types/sdk`), `window.YT`. 호출처 `MusicPlayerProvider`.
- **특이사항**: DOM 수동 조작(직접 createElement/removeChild)이 React와 공존하는 정교한 패턴 — wrapper `isConnected` 검사로 unmount 레이스 방어. 약관 준수 코멘트 다수.

#### `popspot-frontend/src/components/music/usePreviewPlayer.ts` — Spotify/Apple 30초 미리듣기 (HTML5 audio) 훅
- **책임**: `previewUrl` mp3/m4a를 단일 재사용 `Audio` 엘리먼트로 재생. useYouTubePlayer와 동일 인터페이스.
- **핵심 로직**:
  - `usePreviewPlayer.ts:54-91` audio 엘리먼트 **1회만 생성**(트랙마다 새로 만들면 자동재생 unlock 유지 안 됨, `:54`) + timeupdate/play/pause/ended 바인딩.
  - `usePreviewPlayer.ts:94-132` src 교체 + `audio.play()` 시도. **자동재생 차단 시(`:115`) `wantPlayRef`/`retryPendingRef` 가드 후 다음 `pointerdown`에 1회 재시도**(`document.addEventListener("pointerdown", retry, {once:true})`).
  - `usePreviewPlayer.ts:63-67` duration 없으면 30초로 가정.
- **연결**: 없음(순수 HTML5 audio). 호출처 `MusicPlayerProvider`.
- **특이사항**: 주석(`:14-23`)대로 트랙 클릭→백엔드 매칭(비동기)→setCurrent→play()가 "사용자 제스처 창"을 벗어나 자동재생이 막히는 문제를, 단일 엘리먼트 재사용 + 다음 클릭 재시도로 해결.

#### `popspot-frontend/src/components/music/useSpotifyPlayer.ts` — Spotify Web Playback SDK (Premium 풀트랙) 훅
- **책임**: Premium 사용자에게 320kbps 풀트랙 재생. SDK 동적 로드 → Player 생성(토큰 자동 refresh) → device 등록 → Web API로 트랙 재생.
- **핵심 로직**:
  - `useSpotifyPlayer.ts:63-82` `loadSpotifySdk`(`sdk.scdn.co/spotify-player.js`, `onSpotifyWebPlaybackSDKReady` 콜백 큐).
  - `useSpotifyPlayer.ts:84-93` `fetchAccessToken` — `GET /api/spotify/token`.
  - `useSpotifyPlayer.ts:96-115` `playTrackOnDevice` — `PUT https://api.spotify.com/v1/me/player/play?device_id=` 직접 호출, `{uris:["spotify:track:..."]}`.
  - `useSpotifyPlayer.ts:142-213` SDK 초기화 — `getOAuthToken` 콜백, `ready`(device_id 확보), `player_state_changed`(isPlaying/progress + **곡 종료 감지: paused+position0+직전 재생중**, `:185`), `not_ready`.
  - `useSpotifyPlayer.ts:216-220` 트랙 변경 시 재생.
  - `useSpotifyPlayer.ts:226-240` **500ms 폴링으로 position 보정**(`:222-225`, SDK가 재생 중 position 자동 갱신 안 함).
- **연결**: `apiFetch`, `window.Spotify`. 호출처 `MusicPlayerProvider`(enabled=spotify 엔진 시).
- **특이사항**: Spotify 액세스 토큰을 프론트에서 받아 `api.spotify.com`에 직접 Bearer 호출 — 토큰 노출 표면이지만 Web Playback SDK 구조상 불가피. Premium 아니면 SDK가 account_error로 폴백(Provider가 preview 선택).

#### `popspot-frontend/src/components/GlobalChatManager.tsx` — 메이트 채팅 모달 전역 마운트 매니저
- **책임**: zustand `useChatStore`의 `activeChat`이 있을 때만 `MateChatModal`을 렌더하는 얇은 게이트. 어느 페이지에서든 동행 채팅창이 떠 있게 함.
- **핵심 로직**: `GlobalChatManager.tsx:24-29` `isMounted`(SSR 가드), `GlobalChatManager.tsx:41-43` `activeChat` 없으면 null, `GlobalChatManager.tsx:45-58` 있으면 store 값을 props로 전달, `onClose=closeChat`, 삭제 성공 시 토스트+close.
- **연결**: `useChatStore`(activeChat/closeChat), `MateChatModal`, `notify`. 호출처 RootLayout. `MateBoard`가 `openChat`으로 트리거.
- **특이사항**: `useEffect` 두 개에 빈 본문이 남아 있음(`:27-28`, `:32-35`) — 과거 디버깅 로그 잔재(데드 useEffect).

#### `popspot-frontend/src/components/MateChatModal.tsx` — 동행 그룹 채팅 모달 (드래그/최소화/약속/파일)
- **책임**: 메이트 모집글의 그룹 채팅. STOMP 실시간, 드래그 이동, 최소화+안읽음 배지, 파일/이미지 업로드, "약속 잡기" 초대장, 방장 폭파/나가기.
- **핵심 로직**:
  - `MateChatModal.tsx:95-130` 히스토리(`/api/mates/{postId}/chat`) + STOMP `/sub/mate/chat/{postId}` 구독.
  - `MateChatModal.tsx:67-79` 안읽음 시 `document.title` 변경, 최소화 해제 시 카운트 0.
  - `MateChatModal.tsx:133-144` 새 메시지 + 최소화 + 타인 발신이면 `unreadCount++` + 알림음(`new_msg.mp3`).
  - `MateChatModal.tsx:152-181` `sendMessage`(TALK), `sendPromise` — **약속을 `📅약속|date|time|location` 파이프 문자열로 직렬화**(`:169`)해 PROMISE 타입 publish.
  - `MateChatModal.tsx:201-232` `handleFileUpload` — `POST /api/chat/upload`(FormData), 응답 fileUrl에서 파일명 추출, 이미지 여부로 IMAGE/FILE 타입 분기.
  - `MateChatModal.tsx:234-256` `parsePromiseData`(파이프 split), `getImageUrl` — **`decodeURIComponent`→`encodeURIComponent` 재인코딩으로 한글 파일명 깨짐 방어**.
  - `MateChatModal.tsx:188-199` `handleDeleteRoom` — `DELETE /api/mates/{postId}?userId=` (방장만).
  - `MateChatModal.tsx:263-428` 드래그(framer `useDragControls`, 헤더 onPointerDown으로 시작) + 최소화/최대화 AnimatePresence. PROMISE는 초대장 카드로 렌더.
- **연결**: `@stomp/stompjs`/`sockjs-client`, `apiFetch`/`SOCKET_BASE_URL`/`API_BASE_URL`, `notify`/`notifyError`/`confirmAction`. 호출처 `GlobalChatManager`.
- **특이사항**: 발신자 식별이 닉네임 비교(`msg.sender === nickname`). 약속 직렬화가 파이프 구분자 — 본문에 `|` 포함 시 파싱 깨짐. `addToCalendar`(`:258`)는 실제 캘린더 연동 없이 토스트만(목업). 구독 콜백 내 빈 `if`(`:121-123`)는 미완성 잔재.

#### `popspot-frontend/src/components/layout/Header.tsx` — 전역 공통 헤더
- **책임**: 로고, 부제, 테마토글, 인라인 검색, 알림 벨(미확인 배지), 제보/관리자 버튼, UserChip(아바타+PRO 배지+로그아웃) 또는 로그인/가입.
- **핵심 로직**:
  - `Header.tsx:56-63` 미확인 알림 개수를 `readUnread()`(localStorage)로 읽고 `popspot:notifications-changed` 커스텀 이벤트로 동기화.
  - `Header.tsx:64` `isAdmin = user?.role?.includes("ADMIN")`.
  - `Header.tsx:75-86` 로고 `Link href="/?entered=1"`(게스트 인트로 우회 쿼리).
  - `Header.tsx:161-223` `UserChip` — Premium이면 잉크색 칩+Crown PRO 배지, 모바일은 아바타만/데스크탑부터 닉네임. `onProfileClick` 있으면 칩이 버튼.
  - `Header.tsx:236-262` `Avatar` — 사진 있으면 `next/image unoptimized`(외부 OAuth 도메인 대응), 없으면 UserIcon.
- **연결**: `Button`/`Badge`/`ThemeToggle`/`InlineGlobalSearch`(컴포넌트), `unreadCount`(`@/lib/notifications`), `cn`(`@/lib/utils`). 콜백(onLogout/onReportClick/onProfileClick/onBellClick 등)을 부모(메인/기타 페이지)가 주입.
- **특이사항**: `role.includes("ADMIN")`는 UI 노출용일 뿐 실제 권한은 서버 검증. 알림 동기화가 전역 커스텀 이벤트 기반.

#### `popspot-frontend/src/components/layout/BottomDock.tsx` — 모바일 하단 탭 네비게이션
- **책임**: 7개 탭(MAP/COURSE/MUSIC/PASSPORT/MY/MATE/FEEDBACK)을 같은 페이지 내에서 즉시 전환하는 고정 하단 도크.
- **핵심 로직**: `BottomDock.tsx:38-46` `ITEMS` 정의. `BottomDock.tsx:54-88` 모바일은 가로 스크롤(`overflow-x-auto`, 스크롤바 숨김), 데스크탑 중앙 정렬 — **v2.17에서 7탭이 모바일에서 좁아지던 문제 해결**(`:51-52`). `BottomDock.tsx:97-127` `DockButton`(active시 잉크 배경, `aria-pressed`).
- **연결**: `cn`(`@/lib/utils`), lucide 아이콘. `DockTab` 타입 export. `currentTab`/`onTabChange`를 부모(메인 페이지)가 제어.
- **특이사항**: 외부 라우트 없이 탭 상태만 변경 — SPA 단일 페이지 모델.

#### `popspot-frontend/src/components/AuthGuard.tsx` — 경로별 인증 가드 (UX/리다이렉트 전용)
- **책임**: 공개 경로 화이트리스트 밖이면 마운트 후 토큰 검증해 미인증 시 `/login`. 실제 보안은 서버 API 토큰 검증이 담당.
- **핵심 로직**:
  - `AuthGuard.tsx:10-24` `PUBLIC_PATHS`(정확 일치) + `PUBLIC_PREFIXES`(`/popups/`, `/popup/` prefix, SEO/공유 대상).
  - `AuthGuard.tsx:30-36` `isPublicPath` — pathname 불명 시 공개로 간주(막지 않음).
  - `AuthGuard.tsx:67-104` 보호 경로면 `GET /api/v1/auth/me` 검증. **401이면 토큰/유저 삭제+리다이렉트, 5xx/네트워크 장애면 stale 캐시 유지(UX 보호)**(`:88-97`). 성공 시 서버 유저를 localStorage에 갱신.
  - `AuthGuard.tsx:106` **항상 children을 `<Suspense>`로 렌더 — v2.23.2 SEO: 인증 확인 동안 스피너로 본문 가리지 않음**(`:50-58`, 크롤러 특히 네이버 Yeti가 본문 HTML 색인 가능하도록). Suspense는 `useSearchParams` 쓰는 페이지의 정적 생성 빌드 실패 방지용.
- **연결**: `apiFetch`, next/navigation(useRouter/usePathname). 호출처 RootLayout(children 래핑).
- **특이사항**: 클라이언트 가드라 보호 페이지가 잠깐 빈 셸 렌더될 수 있으나 noindex + 토큰 게이트 API라 유출 없음(주석 명시). 토큰을 localStorage에 보관 — XSS 시 탈취 표면.

#### `popspot-frontend/src/components/layout/Footer.tsx` — 사이트 공통 푸터 (서버 컴포넌트)
- **책임**: 브랜드/소셜, 플랫폼·파트너 링크, 정보 출처/저작권/신고/운영자 고지(disclaimer). 자동수집 운영 시 약관/신고 접근성 확보.
- **핵심 로직**: `Footer.tsx:9-20` X 로고 인라인 SVG(lucide 미제공). `Footer.tsx:34-49` 링크 데이터(파트너는 `mailto:` subject 포함). `Footer.tsx:143-183` `DisclaimerBox` — **"접수 즉시 노출 차단, 24시간 내 조치"**(`:163`), DPO 메일, 운영자 정보, `© ${new Date().getFullYear()}`.
- **연결**: next/link, `cn`. `CONTACT_EMAIL=reo4321@naver.com`. 호출처 각 페이지 하단.
- **특이사항**: `"use client"` 없음 — 서버 컴포넌트(SEO). 더미 `#` 링크 금지 정책(`:25-26`), 단 일부 플랫폼 링크가 모두 `/`로 연결(미구현 라우트).

#### `popspot-frontend/src/components/layout/InlineGlobalSearch.tsx` — 헤더 인라인 통합검색
- **책임**: 헤더의 라임색 "통합검색" 칩 → 클릭 시 input 확장 → 디바운스 검색 → 드롭다운 결과 → 팝업 상세 이동. Ctrl/Cmd+K 단축키.
- **핵심 로직**:
  - `InlineGlobalSearch.tsx:46-61` ESC + 외부 클릭 닫기.
  - `InlineGlobalSearch.tsx:65-78` **전역 Ctrl/Cmd+K로 열기 — input/textarea/contentEditable 안이면 무시**.
  - `InlineGlobalSearch.tsx:86-115` 디바운스(200ms) 검색 — **2글자 미만 무시, `AbortController`로 이전 요청 취소**, `GET /api/popups/search?keyword=`, 최대 8개.
  - `InlineGlobalSearch.tsx:127-140` `onSubmit`(첫 결과로 이동), `goToHit`.
- **연결**: `apiFetch`, next/navigation(useRouter), framer-motion. 호출처 `Header`.
- **특이사항**: AbortController로 경쟁 요청 정리 + aborted 가드 — 깔끔한 비동기 처리. 검색은 별도 권한 없이 공개 엔드포인트.

#### `popspot-frontend/src/components/main/BrowseSection.tsx` — 메인 BROWSE 슬라이스 섹션 + 모달
- **책임**: visible markers를 받아 지역/시점/카테고리별 카운트 칩을 보여주고, 칩 클릭 시 해당 슬라이스의 진행 중 팝업 목록 모달. 모달에서 상세/지도/SEO 랜딩으로 이동.
- **핵심 로직**:
  - `BrowseSection.tsx:90-104` 펼침 상태 localStorage 영속(`popspot:browse:expanded`).
  - `BrowseSection.tsx:106-119` `GET /api/map/markers`(cancelled 가드).
  - `BrowseSection.tsx:121-172` region/period/category 슬라이스 useMemo — `classifyRegion`/`matchesPeriod`/`classifyCategory`로 카운트 후 count>0만.
  - `BrowseSection.tsx:174-184` `handleSelect` → `filterMarkers`로 매칭 추출해 `activeSlice` 설정.
  - `BrowseSection.tsx:334-472` `SliceModal` — **ESC + body scroll lock**(`:342-353`), 최대 50개 노출 + 초과 안내, 하단 CTA(`/?tab=MAP&{key}={slug}` 지도, `/popups/{slug}` SEO 랜딩).
  - `BrowseSection.tsx:476-487` `filterMarkers` 유틸.
- **연결**: `apiFetch`, `@/lib/regions`, `@/lib/popupSlices`, framer/next. 호출처 메인 페이지. **v2.21-S3.4 주석(`:36-39`): 이전 router.push deep link가 Next router cache로 useSearchParams 재실행 안 되던 회귀를 모달로 전환해 라우팅 의존성 제거**.
- **특이사항**: error 또는 markers 0개면 섹션 자체 null. 모든 슬라이스 계산 클라이언트 사이드.

#### `popspot-frontend/src/components/AIReportModal.tsx` — 서울 핫스팟 혼잡도 AI 리포트 모달
- **책임**: 6대 핫플레이스 탭별 실시간 혼잡도/날씨/연령 통계 + 12시간 예측 차트를 보여주는 모달.
- **핵심 로직**:
  - `AIReportModal.tsx:36-54` 탭 변경 시 `GET /api/congestion?area={tab}` fetch. **첫 렌더+성수 초기데이터면 중복 호출 스킵**(`:37-41`).
  - `AIReportModal.tsx:57-62` `getColor`(혼잡도 레벨→색, 미사용 가능성).
  - `AIReportModal.tsx:128-163` 레벨별 색 분기 요약 카드(여유/보통/그외).
  - `AIReportModal.tsx:179-189` 방문자 1위 — `ageRates['20s'] vs ['30s']` 비교.
  - `AIReportModal.tsx:200` `CongestionChart`에 `forecasts || forecast || []`(키 양쪽 호환).
- **연결**: `CongestionChart`(자식), `API_BASE_URL`(`../../src/lib/api`), `CongestionData`(`@/types/popup`). framer-motion. 호출처 메인 페이지(초기 `data` 주입).
- **특이사항**: import 경로가 `../../src/lib/api`로 비정상적(다른 파일은 `../lib/api` 또는 `@/lib/api`) — 동작은 하나 일관성 깨짐. `bg-lime-300/10/50`(`:179`)는 오타성 Tailwind 클래스.

#### `popspot-frontend/src/components/CongestionChart.tsx` — 혼잡도 예측 영역 차트 (recharts)
- **책임**: 시간대별 예측 인구를 recharts `AreaChart`로 그리는 표시용 컴포넌트.
- **핵심 로직**: `CongestionChart.tsx:25-27` 데이터 없으면 "로딩 중" 안내. `CongestionChart.tsx:62-70` Tooltip formatter — **ValueType를 number 여부로 안전하게 좁힘**(라이브러리 시그니처 대응). gradient fill, `animationDuration 1500`.
- **연결**: recharts. `ForecastData[]` props. 호출처 `AIReportModal`.
- **특이사항**: 4개 파일 중 유일하게 `"use client"` 없음 + recharts 사용 — 부모가 클라이언트라 동작. 순수 프레젠테이션.

#### `popspot-frontend/src/components/DigitalTicket.tsx` — 팝업 디지털 티켓 카드 + 로드뷰 모달
- **책임**: 팝업 정보를 3D 티켓 카드로 시각화하고, 버튼 클릭 시 포털로 카카오 로드뷰 풀스크린 모달을 띄움.
- **핵심 로직**: `DigitalTicket.tsx:26-36` 모달 열림 시 body scroll lock + mounted 가드. `DigitalTicket.tsx:54-60` 노이즈 질감을 **인라인 SVG data URL**로(외부 의존성 제거). `DigitalTicket.tsx:140-182` `createPortal`로 모달을 `document.body`에 렌더(`z-[999999]`), 안에 `KakaoRoadview` 마운트.
- **연결**: `KakaoRoadview`(자식, lat/lng/name 전달), framer-motion, react-dom createPortal. 호출처 팝업 상세 페이지.
- **특이사항**: z-index가 매우 큼(`999999`/`1000001`) — 다른 오버레이와 충돌 회피용. 순수 표시(API 호출 없음).

#### `popspot-frontend/src/components/LiveChatTicker.tsx` — 메인 실시간 채팅 티커 (흐르는 배너)
- **책임**: 최근 채팅을 가로로 무한 롤링하는 "LIVE NOW" 배너. 각 항목 클릭 시 해당 팝업 상세로.
- **핵심 로직**: `LiveChatTicker.tsx:22-40` `fetchRecentChats` — **`apiFetch` 대신 직접 `fetch` 사용**(주석 `:7-8`/`:21`: Content-Type 헤더가 preflight 유발 → simple request로 회피), 캐시 무력화 `?t=Date.now()`, `credentials:"include"`. **데이터가 적으면 3배 복제**(`:32`)해 애니메이션 끊김 방지. `LiveChatTicker.tsx:42-47` 10초 폴링. `LiveChatTicker.tsx:66-73` framer로 `x:["0%","-50%"]` 40초 무한.
- **연결**: `API_BASE_URL`, next/link, framer. 호출처 메인 페이지. 데이터 0개면 null.
- **특이사항**: CORS preflight 회피를 위해 의도적으로 raw fetch 사용 — 토큰 헤더 없이 쿠키 기반. 폴링 방식(WebSocket 아님).

#### `popspot-frontend/src/components/SecretTip.tsx` — 프리미엄 전용 꿀팁 블러 게이트
- **책임**: 프리미엄 회원이면 팁 본문 노출, 아니면 블러 + 잠금 오버레이로 가린 업셀 컴포넌트.
- **핵심 로직**: `SecretTip.tsx:20-39` `isPremium` 분기 — true면 `tip` 텍스트, false면 `blur-sm select-none` 더미 텍스트 + Lock 오버레이("프리미엄 회원 전용").
- **연결**: lucide만. `isPremium`/`tip` props. 호출처 팝업 상세 페이지.
- **특이사항**: **실제 팁 본문(`tip`)이 프리미엄 아니어도 DOM에 들어오지 않음**(분기 렌더) — 블러는 더미 텍스트라 콘텐츠 유출 없음(올바른 게이팅).

#### `popspot-frontend/src/components/SortableItem.tsx` — 코스 편집 드래그 정렬 아이템
- **책임**: dnd-kit 기반 코스(course) 장소 목록의 단일 드래그 가능 행. 핸들/순서번호/이름/카테고리.
- **핵심 로직**: `SortableItem.tsx:19-33` `useSortable({id})`로 transform/transition/isDragging, 드래그 중 opacity 0.5 + zIndex 50. `SortableItem.tsx:42` 드래그 핸들에만 `attributes`/`listeners` 부여(GripVertical). `touch-none`으로 모바일 스크롤 충돌 방지.
- **연결**: `@dnd-kit/sortable`/`@dnd-kit/utilities`, lucide. `Place` props. 호출처 코스 편집(DndContext) 페이지/탭.
- **특이사항**: 간결. 핸들 분리로 의도적 드래그만 허용.

#### `popspot-frontend/src/components/TicketingSimulation.tsx` — 광클 티켓팅 체험 시뮬레이션
- **책임**: 대기열→날짜선택→결제→결과의 티켓팅 과정을 체험시키는 게임형 시뮬레이션. 봇들이 재고를 까는 압박감을 100ms 폴링으로 구현.
- **핵심 로직**:
  - `TicketingSimulation.tsx:14-18` 단계(`Step`) + 상수(`POLL 100ms`, `FAIL_DELAY 500ms`).
  - `TicketingSimulation.tsx:32-43` `handleStart` — `POST /api/game/start?itemId=`(봇 재고 소진 시작) → QUEUE + 폴링 + 대기열 시뮬.
  - `TicketingSimulation.tsx:46-70` `startStockPolling` — 100ms마다 `GET /api/game/stock`, 재고 0이면 결제 단계 아닐 시 FAIL 처리.
  - `TicketingSimulation.tsx:73-86` `runQueueSimulation` — 랜덤 감소로 대기열 시각화.
  - `TicketingSimulation.tsx:89-108` `handlePayment` — RESULT_UX(1.5초) 후 `POST /api/game/reserve?userId=&itemId=`로 실제 성공/실패 판정(이 시간에도 봇이 깜).
  - `TicketingSimulation.tsx:111-115` 언마운트 폴링 정리.
- **연결**: `notify`/`notifyError`, `API_BASE_URL`(`@/lib/api`), framer. 호출처 게임/시뮬 탭(주입 `userId`).
- **특이사항**: 폴링 콜백이 클로저로 `step`을 참조(`:62`)해 stale 가능성 있으나 시뮬 특성상 영향 적음. `userId` IDOR은 백엔드 검증(과거 보안 태스크 S2 참고). 코드 주석에 "1초마다"라 적혔으나 실제 100ms(`:45`).

#### `popspot-frontend/src/components/Passport/PassportView.tsx` — 팝업 여권(스탬프 콜렉션) 전체 화면
- **책임**: 로그인 유저의 방문 스탬프를 카드 그리드로 보여주고, 진행률/등급/리워드 단계를 표시.
- **핵심 로직**:
  - `PassportView.tsx:29-34` localStorage `user` 로드, `PassportView.tsx:37-46` `GET /api/stamps/my?userId=`로 스탬프.
  - `PassportView.tsx:49-52` 목표 12개 기준 진행률 + `getUserRank(acquiredCount)`.
  - `PassportView.tsx:73-81` 아바타 ring 색이 등급(`rank.ring`)에 따라 자동 변경.
  - `PassportView.tsx:94` `Lv.{Math.floor(count/3)+1} 트렌드 세터`.
  - `PassportView.tsx:122-151` 획득 스탬프 카드(카테고리 앞 4글자 + 이름 + 날짜 + Visited 도장) + 남은 칸 LOCKED 채움.
  - `PassportView.tsx:162-193` 리워드 3단계(3/6/12개) 획득/잠김.
- **연결**: `apiFetch`, `notify`(import만), `getUserRank`(`@/lib/rank`), `User`(`@/types/popup`). 호출처 PASSPORT 탭/`/music/passport` 외 패스포트 페이지.
- **특이사항**: 유저 정보를 localStorage에서 직접 파싱(서버 검증 없는 표시용). `notify` import되나 사용처 안 보임(미사용 가능).

#### `popspot-frontend/src/components/rank/RankCard.tsx` — 등급/진행도 요약 카드
- **책임**: 현재 등급과 다음 등급까지 진행도, 획득 뱃지 미니 진열을 보여주는 MY 탭용 카드.
- **핵심 로직**: `RankCard.tsx:19-24` 등급별 진행률 계산(MASTER 100%, HUNTER `(count-6)/6`, BEGINNER `(count-3)/3`, NONE `count/3`). `RankCard.tsx:67` 다음 등급/남은 개수(`rank.nextLabel`/`rank.toNext`). `RankCard.tsx:82-84`/`:90-102` `BadgePill`(3/6/12 달성 여부).
- **연결**: `getUserRank`(`@/lib/rank`), lucide. `stampCount`/`nickname`/`onSeeAll` props. 호출처 MY 탭.
- **특이사항**: 표시 로직만, 데이터는 부모 주입. `@/lib/rank`의 rank 객체(bg/ring/text/accent/nextLabel/toNext)에 강하게 의존.

#### `popspot-frontend/src/components/ThemeToggle.tsx` — 라이트/다크 토글
- **책임**: next-themes 기반 테마 전환 버튼.
- **핵심 로직**: `ThemeToggle.tsx:13-18` `useTheme`로 resolvedTheme. `ThemeToggle.tsx:16` mount 후에만 실제 아이콘(Sun/Moon) — **SSR placeholder로 hydration mismatch 방지**(`:8-11`).
- **연결**: `next-themes`, `Button`(ui). 호출처 `Header`.
- **특이사항**: 간결한 표준 패턴.

#### `popspot-frontend/src/components/admin/ServerResourceChart.tsx` — 어드민 서버 리소스 실시간 차트 (레거시)
- **책임**: 3초마다 서버 CPU/메모리를 폴링해 최근 20포인트 라인 차트로. online/offline 상태 표시.
- **핵심 로직**: `ServerResourceChart.tsx:21-57` `setInterval` 3초 → `GET /api/admin/metrics/server-status`, `setData(prev => [...prev, point].slice(-20))`, 실패 시 offline. `ServerResourceChart.tsx:119-138` CPU/메모리 라인(`isAnimationActive={false}` 실시간성).
- **연결**: recharts, `apiFetch`(`../../lib/api`). 호출처 admin 페이지(구형).
- **특이사항**: 새 `useDashboardMetrics`+`LiveLineChart` 패턴과 별개로 자체 폴링·차트를 한 파일에 내장 — 메트릭 신모듈과 중복 성격. `enabled` 게이트 없어 마운트되면 무조건 폴링(일반 유저 진입 시 403 가능, 신모듈은 이걸 개선).

#### `popspot-frontend/src/components/admin/metrics/MetricCard.tsx` — 어드민 단일 메트릭 카드
- **책임**: 큰 숫자 1개 + 라벨/단위/보조/아이콘을 tone(neutral/ok/warning/danger)별 색으로 표시하는 프레젠테이션 카드.
- **핵심 로직**: `MetricCard.tsx:23-28` `TONE_CLASS` 매핑. `MetricCard.tsx:30-57` 좌측 라벨/값/sub, 우측 아이콘.
- **연결**: 없음(순수 UI). 호출처 admin 대시보드.
- **특이사항**: 단순 표시 컴포넌트.

#### `popspot-frontend/src/components/admin/metrics/LiveLineChart.tsx` — 범용 실시간 시계열 라인 차트
- **책임**: 부모가 시계열 데이터와 series 스펙(key/color/label)을 주면 그리는 재사용 라인 차트. 버퍼 슬라이딩은 부모 책임.
- **핵심 로직**: `LiveLineChart.tsx:32-76` recharts `LineChart` — `series.map`으로 다중 라인, `isAnimationActive={false}`, `domain=[0,"auto"]`, 다크 톤 그리드/툴팁.
- **연결**: recharts. 호출처 admin 대시보드(`useDashboardMetrics`와 조합).
- **특이사항**: `ServerResourceChart`의 차트 부분을 일반화한 신버전. 상태 없는 순수 표시.

#### `popspot-frontend/src/components/admin/metrics/useDashboardMetrics.ts` — 어드민 대시보드 메트릭 폴링 훅
- **책임**: `/api/admin/metrics/dashboard`를 N초 폴링해 스냅샷 + 차트용 시계열 버퍼(FIFO) + online/offline을 제공.
- **핵심 로직**: `useDashboardMetrics.ts:46-74` effect — `enabled=false`면 미실행(**v2.13.3: 일반 유저 admin 진입 시 ADMIN 검증 전까지 403 도배 차단**, `:17-18`). `tick`에서 fetch → `setSeries(prev => [...prev, point].slice(-bufferSize))`, 실패 시 offline. `toLinePoint`를 ref로 잡아 effect 의존성에서 제외(`:43-44`).
- **연결**: `apiFetch`. 제네릭 `P`(차트 점 타입). 호출처 admin 대시보드 페이지.
- **특이사항**: `enabled` 게이트가 권한 검증 전 폴링 차단의 핵심 — `ServerResourceChart`보다 안전.

#### `popspot-frontend/src/components/admin/log/LogViewer.tsx` — 어드민 실시간 로그 뷰어
- **책임**: SSE로 백엔드 로그 라인을 받아 최근 500줄 유지, 정규식/부분문자열 필터, 일시정지/비우기/다운로드/자동스크롤, 레벨별 색상.
- **핵심 로직**: `LogViewer.tsx:26-37` `useSseStream`으로 라인 수신 → `slice(-MAX_LINES)`. `LogViewer.tsx:40-48` 필터 — **정규식 시도 실패 시 substring 폴백**. `LogViewer.tsx:56-64` `handleDownload` — Blob → ObjectURL → `<a>.click()`. `LogViewer.tsx:138-160` `ConnectionBadge`(connecting/open/closed/error), `lineColor`(ERROR/WARN/INFO/DEBUG 색).
- **연결**: `useSseStream`(자식 훅). 호출처 admin LOGS 탭(`active` prop으로 enabled 제어).
- **특이사항**: `active=false`면 SSE 미연결(탭 닫힘 시 자원 절약). 로그 대기 시 "logging.file.name 환경변수 설정" 안내.

#### `popspot-frontend/src/components/admin/log/useSseStream.ts` — 인증 SSE 스트림 구독 훅
- **책임**: 토큰을 쿼리로 첨부한 `EventSource`로 SSE 구독, exponential backoff 재연결, paused/enabled 제어.
- **핵심 로직**: `useSseStream.ts:57-83` `connect` — **EventSource가 헤더를 못 보내 토큰을 `?token=`으로 첨부**(`:58-59`), named event 리스닝, `onerror` 시 close + backoff(1s→2s→…→max 30s) 후 재연결. `useSseStream.ts:70-73` `pausedRef.current`면 onMessage 미호출(연결은 유지). `useSseStream.ts:47-51` `enabled=false`면 closed. ref로 onMessage/paused 최신값 참조.
- **연결**: `API_BASE_URL`. 호출처 `LogViewer`.
- **특이사항**: **토큰이 URL 쿼리에 노출** — 서버 액세스 로그/프록시에 남을 수 있는 표면(EventSource 한계상 불가피, 백엔드가 SSE 경로만 허용). backoff 재연결이 견고.

#### `popspot-frontend/src/components/ui/button.tsx` — 디자인 시스템 Button (cva)
- **책임**: variant(primary/accent/ink/outline/ghost/link) × size(sm/md/lg/icon) × block, loading 스피너, iconLeft/Right, asChild(Slot) 지원하는 표준 버튼.
- **핵심 로직**: `button.tsx:19-57` `cva`로 variant 정의. `button.tsx:89-112` `asChild`면 `Slot` + `React.Children.only` + `cloneElement`로 자식(예: Link)에 스타일/아이콘 주입. `button.tsx:114-130` 일반 button은 loading 시 disabled+`aria-busy`.
- **연결**: `@radix-ui/react-slot`, `cva`, lucide Loader2, `cn`. `ui/index.ts`로 re-export. 광범위 호출(Header/ThemeToggle/ErrorState 등).
- **특이사항**: asChild에서 iconLeft/Right는 자식 children 안에 합성됨. forwardRef + displayName 표준.

#### `popspot-frontend/src/components/ui/card.tsx` — 디자인 시스템 Card 패밀리
- **책임**: tone(surface/muted/ink) × radius × elevation Card + Header/Title/Description/Content/Footer 하위 컴포넌트.
- **핵심 로직**: `card.tsx:17-36` tone/radius/elevation 클래스 맵. `card.tsx:45-69` Card forwardRef. `card.tsx:71-125` 하위 컴포넌트들(각 forwardRef + displayName).
- **연결**: `cn`. `ui/index.ts` re-export.
- **특이사항**: `CardProps`에 `asChild?` 선언만 있고 미구현(`:42`) — 사용 안 됨.

#### `popspot-frontend/src/components/ui/dialog.tsx` — Radix 기반 Dialog 모달
- **책임**: 포커스 트랩/ESC/스크롤 잠금/접근성이 자동인 표준 모달. size(sm~full), hideClose 옵션.
- **핵심 로직**: `dialog.tsx:15-18` Radix primitive re-export. `dialog.tsx:20-35` Overlay(블러+애니메이션). `dialog.tsx:51-94` DialogContent — sizeClass + 중앙 정렬 + 닫기 버튼(hideClose로 숨김). `dialog.tsx:96-143` Header/Footer/Title/Description.
- **연결**: `@radix-ui/react-dialog`, lucide X, `cn`. `ui/index.ts` re-export.
- **특이사항**: 다른 모달들(MateBoard/DigitalTicket 등)은 이 Dialog 대신 framer+createPortal을 직접 쓰는 경우가 많아 모달 구현이 이원화됨.

#### `popspot-frontend/src/components/ui/input.tsx` — 디자인 시스템 Input + Field
- **책임**: 아이콘(좌/우)/invalid 상태 지원 Input + label/helper/error 래퍼 Field.
- **핵심 로직**: `input.tsx:20-66` Input — 아이콘 있으면 relative wrapper로 패딩 조정, `aria-invalid`. `input.tsx:96-137` Field — `useId`로 label/input 연결, error면 `role="alert"` 표시(helper와 배타).
- **연결**: `cn`, React.useId/cloneElement. `ui/index.ts` re-export.
- **특이사항**: Field가 단일 자식에 `id` 주입(`cloneElement`) — 접근성 자동 연결. 다만 ChatRoom/MateChatModal 등은 raw `<input>`을 직접 써서 이 컴포넌트 미사용.

#### `popspot-frontend/src/components/ui/badge.tsx` — 디자인 시스템 Badge (cva)
- **책임**: tone(lime/hot/violet/ink/outline/muted/success/warning/danger) × size(sm/md) 라벨/태그.
- **핵심 로직**: `badge.tsx:10-36` cva 정의. `badge.tsx:42-49` 단순 span 래퍼.
- **연결**: `cva`, `cn`. `ui/index.ts` re-export. 호출처 Header(PRO 배지) 등.
- **특이사항**: forwardRef 없는 함수 컴포넌트(다른 ui와 차이).

#### `popspot-frontend/src/components/ui/index.ts` — UI 프리미티브 배럴 익스포트
- **책임**: button/card/dialog/input/badge를 한 곳에서 re-export.
- **연결**: 위 5개 파일. 호출처가 `@/components/ui`로 일괄 import.
- **특이사항**: feedback 하위는 별도 배럴(`ui/feedback/index.ts`).

#### `popspot-frontend/src/components/ui/feedback/EmptyState.tsx` — 공용 빈 상태 컴포넌트
- **책임**: 아이콘/타이틀/설명/액션을 가진 통일된 빈 상태 UI(점선 카드형 또는 텍스트형).
- **핵심 로직**: `EmptyState.tsx:33-63` props 기반 렌더, 아이콘 미지정 시 lucide Inbox, `bordered`로 점선 테두리, description은 `whitespace-pre-line`.
- **연결**: `cn`, lucide. 호출처 위시리스트/메이트/코스/의견 등(주석 `:24-29`).
- **특이사항**: v2.18에서 산발적 빈 상태 UI를 통일하려 도입.

#### `popspot-frontend/src/components/ui/feedback/LoadingSpinner.tsx` — 공용 로딩 스피너
- **책임**: size(sm/md/lg)/label/fullscreen 모드를 가진 통일 로딩 표시.
- **핵심 로직**: `LoadingSpinner.tsx:35-48` fullscreen이면 전체 오버레이(`fixed inset-0`), 아니면 `LoadingSpinner.tsx:50-62` inline(`role="status" aria-live="polite"`). Loader2 회전.
- **연결**: `cn`, lucide. 호출처 다수 로딩 지점.
- **특이사항**: v2.18 통일 컴포넌트. inline에 a11y 속성 부여.

#### `popspot-frontend/src/components/ui/feedback/ErrorState.tsx` — 공용 에러 상태 컴포넌트
- **책임**: 사용자 친화 에러 메시지 + 선택적 재시도 버튼. stack trace 노출 금지 정책.
- **핵심 로직**: `ErrorState.tsx:29-65` AlertTriangle + title/message + `onRetry` 있으면 outline Button(RefreshCw). `role="alert"`, `bordered`로 danger 테두리.
- **연결**: `Button`(ui), `cn`, lucide. 호출처 데이터 fetch 실패 지점.
- **특이사항**: v2.18 통일 컴포넌트. 메시지 기본값으로 기술 용어 차단.

#### `popspot-frontend/src/components/ui/feedback/index.ts` — feedback 컴포넌트 배럴
- **책임**: EmptyState/LoadingSpinner/ErrorState를 `@/components/ui/feedback` 한 줄로 import 가능하게 re-export.
- **연결**: 위 3개. 
- **특이사항**: 단순 배럴.

## F4 — 프론트 · features (도메인 모듈)

#### `popspot-frontend/src/features/feedback/api.ts` — 의견(피드백) 백엔드 호출 래퍼 모음
- **책임**: 컴포넌트가 `apiFetch`를 직접 부르지 않도록, 의견 관련 모든 HTTP 호출(URL/JSON 직렬화/에러 변환)을 한 파일에 모은다. 사용자용(`/api/feedback`)과 어드민용(`/api/admin/feedback`) 두 베이스를 분리(`api.ts:17-18`).
- **핵심 로직**:
  - `readJsonOrThrow<T>(res)` — `res.ok` 아니면 `readMessage`로 메시지 뽑아 throw, 아니면 JSON 파싱(`api.ts:21-27`). 모든 GET/POST 응답 처리의 공통 관문.
  - `readMessage(res)` — 응답 JSON의 `data.message`를 우선 쓰고, JSON 파싱 실패 시 `statusText`로 폴백(`api.ts:29-37`).
  - `createFeedback(payload)` — 로그인/게스트 공용 POST `/api/feedback`(`api.ts:40-46`).
  - `fetchMyFeedback()` — 본인 의견 GET `/api/feedback/me`(`api.ts:49-52`).
  - `fetchAdminFeedback(params)` — `URLSearchParams`로 status/page/size 쿼리 조립 후 GET(`api.ts:62-70`). 값이 `undefined`면 쿼리에서 누락시켜 깔끔한 URL 생성.
  - `fetchAdminFeedbackMetrics()` — 상태별 카운트 GET `/metrics`(`api.ts:72-75`).
  - `replyFeedback(id, payload)` / `deleteFeedback(id)` — 답변 POST `/{id}/reply`, 삭제 DELETE `/{id}`(`api.ts:77-93`).
- **연결**: `@/lib/api`의 `apiFetch`, `@/types/feedback`의 타입에 의존. 피호출처는 `FeedbackForm`(create), `MyFeedbackList`(fetchMy), `AdminFeedbackPanel`(fetchAdmin/metrics/reply/delete).

#### `popspot-frontend/src/features/feedback/FeedbackForm.tsx` — 의견 입력 폼(로그인/게스트 공용)
- **책임**: 카테고리(라디오 4종)·제목·내용·게스트 이메일을 받아 `createFeedback`로 제출하는 클라이언트 폼. `userId` 유무로 게스트/로그인 분기.
- **핵심 로직**:
  - `isGuest = !userId`(`FeedbackForm.tsx:41`) — 게스트일 때만 "답신용 이메일(선택)" 필드 렌더(`FeedbackForm.tsx:145-158`).
  - `handleSubmit` — `title`/`content`를 `.trim()` 후 비면 `notifyError`로 막고 제출 차단(`FeedbackForm.tsx:43-63`). 게스트 + 이메일 입력 시에만 `payload.guestEmail` 추가(`FeedbackForm.tsx:52-54`).
  - 제출 성공 시 `notifySuccess` 후 입력 초기화 + `onSubmitted?.()` 콜백(`FeedbackForm.tsx:67-75`). `submitting` 가드로 중복 제출 방지(`FeedbackForm.tsx:45`).
  - 카테고리 라디오는 `sr-only` input + label 스타일링 패턴(`FeedbackForm.tsx:102-111`). 상수 `TITLE_MAX=200`, `CONTENT_MAX=4000`(`FeedbackForm.tsx:25-26`)로 `maxLength` 강제.
- **연결**: `./api`의 `createFeedback`, `@/lib/notify`, `@/components/ui`(Button/Input/Field), `@/types/feedback`(CATEGORY_LABEL/타입). 피호출: 마이페이지·`/feedback` 페이지 등에서 `userId`/`onSubmitted` 주입받아 사용.

#### `popspot-frontend/src/features/feedback/MyFeedbackList.tsx` — 본인이 보낸 의견 목록(재사용 카드)
- **책임**: 로그인 사용자의 의견 목록을 불러와 카드 리스트로 표시. `limit`만 다르게 줘서 MY 탭(최근 3건)과 `/feedback` 전용 페이지(전체)에서 동일 모양 재사용(`MyFeedbackList.tsx:24-29`).
- **핵심 로직**:
  - `useEffect`에서 `userId` 없으면 즉시 return, 있으면 `fetchMyFeedback` 호출(`MyFeedbackList.tsx:40-64`). `cancelled` 플래그로 언마운트 후 setState 방지(전형적 race 가드).
  - deps에 `refreshKey` 포함 — 부모가 이 값을 증가시키면 강제 재조회(작성 직후 갱신용)(`MyFeedbackList.tsx:16, 64`).
  - 렌더 분기: 비로그인/로딩/에러/빈목록을 각각 다른 안내로 처리(`MyFeedbackList.tsx:66-81`).
  - `limit` 있으면 `items.slice(0, limit)`로 잘라 표시(`MyFeedbackList.tsx:83`). `adminReply` 있으면 답변 블록 노출(`MyFeedbackList.tsx:103-107`).
  - `formatDate` — ISO 문자열 앞 10자리(YYYY-MM-DD)만 슬라이스(`MyFeedbackList.tsx:115-117`).
- **연결**: `./api`의 `fetchMyFeedback`, `@/types/feedback`(CATEGORY_LABEL/STATUS_LABEL/타입). props로 `userId`/`refreshKey`/`limit`/`emptyText` 주입받음.

#### `popspot-frontend/src/features/feedback/AdminFeedbackPanel.tsx` — 어드민 의견 검수 패널
- **책임**: 상태별 카운트 카드 + 상태 필터 + 의견 목록 + 항목 펼침형 답변/상태/삭제 처리. 목록·카운트·답변·삭제 4종 API만 사용(`AdminFeedbackPanel.tsx:45-50`).
- **핵심 로직**:
  - `reload` — `Promise.all`로 목록(`fetchAdminFeedback`)과 카운트(`fetchAdminFeedbackMetrics`) 동시 조회(`AdminFeedbackPanel.tsx:59-76`). 필터 `ALL`이면 빈 params, 아니면 `{status: filter}`. `setCounts({...EMPTY_COUNTS, ...metrics})`로 누락 키 0 보정(`AdminFeedbackPanel.tsx:68`).
  - `useCallback([filter])` + `useEffect([reload])` — 필터 변경 시 자동 재조회(`AdminFeedbackPanel.tsx:78-80`).
  - 항목 클릭 시 `expandedId` 토글로 한 번에 하나만 펼침(`AdminFeedbackPanel.tsx:130`).
  - 내부 `MetricRow` — 4개 카운트 카드 그리드(`AdminFeedbackPanel.tsx:177-199`).
  - 내부 `ReplyEditor` — `replyFeedback`로 답변+상태 저장(`adminReply`는 trim 후 비면 `undefined`로 보냄, `AdminFeedbackPanel.tsx:217-220`), `deleteFeedback`은 `confirmAction({destructive:true})` 확인 후 삭제(`AdminFeedbackPanel.tsx:232-252`).
  - `onSaved`는 목록을 in-place 갱신한 뒤 또 `reload()`(낙관적 갱신 + 재동기화 이중)(`AdminFeedbackPanel.tsx:153-163`).
  - `authorLabel` — `userId` 있으면 그대로, 없으면 `게스트 (이메일)` 또는 `게스트`(`AdminFeedbackPanel.tsx:340-343`).
- **연결**: `./api` 4함수, `@/lib/notify`(notifySuccess/notifyError/confirmAction), `@/components/ui`, `@/types/feedback`. 어드민 페이지의 FEEDBACK 탭에서 마운트.
- **특이사항**: `onSaved`/`onDeleted` 모두 in-place 업데이트 직후 `reload()`를 호출해 네트워크 왕복이 한 번 더 발생 — 카운트 갱신을 위한 의도지만 중복 렌더 비용 존재.

#### `popspot-frontend/src/features/music/useSpotifyAuth.ts` — Spotify 연결 상태/액션 훅 (v2.21-S11)
- **책임**: Spotify 연결 상태(`connected`/`isPremium`/`spotifyUserId`) 조회와 로그인 시작/연결 해제 액션을 캡슐화한 커스텀 훅. 3개 엔드포인트(`/api/spotify/me`·`/login`·`/disconnect`) 담당(`useSpotifyAuth.ts:10-17`).
- **핵심 로직**:
  - `refresh` — GET `/api/spotify/me`, 실패하면 모두 false + `loading:false`로 안전 처리(`useSpotifyAuth.ts:35-56`). `!!data.x`로 boolean 강제 캐스팅.
  - `useEffect([refresh])`로 마운트 시 1회 자동 조회(`useSpotifyAuth.ts:58-60`).
  - `startLogin` — GET `/api/spotify/login`으로 `authorizationUrl` 받아 `window.location.assign`으로 **top-level navigation**(`useSpotifyAuth.ts:63-74`). 주석: 팝업보다 안정적(Safari 차단 회피).
  - `disconnect` — POST `/api/spotify/disconnect` 후 `refresh()`로 상태 재동기화(`useSpotifyAuth.ts:77-80`).
  - 반환은 `{...state, refresh, startLogin, disconnect}` 형태로 상태 평탄화(`useSpotifyAuth.ts:82`).
- **연결**: `@/lib/api`의 `apiFetch`에만 의존. 피호출: `SpotifyConnectButton`.
- **특이사항**: `startLogin`은 URL 누락/요청 실패 시 throw하므로 호출부에서 try/catch 필요(`SpotifyConnectButton.handleConnect`가 처리). `refresh`는 에러를 삼켜 throw하지 않음(상태만 false).

#### `popspot-frontend/src/features/music/SpotifyConnectButton.tsx` — 음악 탭 Spotify 연결 칩 (v2.21-S11)
- **책임**: `useSpotifyAuth` 상태를 받아 3가지 UI(미연결 녹색 버튼 / Premium 라임 배지 / Free 회색 배지)를 렌더하고, OAuth 콜백 결과 토스트를 띄운다(`SpotifyConnectButton.tsx:10-25`).
- **핵심 로직**:
  - 콜백 처리 `useEffect` — `searchParams`의 `?spotify=` 값이 `connected`/`denied`/`error`면 각각 토스트, `connected`면 `refresh()`(`SpotifyConnectButton.tsx:32-58`).
  - 토스트 후 `window.history.replaceState`로 `?spotify=` 쿼리를 URL에서 제거해 history 오염 방지(`SpotifyConnectButton.tsx:60-65`).
  - `handleConnect` — `startLogin` try/catch로 감싸 실패 토스트(`SpotifyConnectButton.tsx:68-78`).
  - `handleDisconnect` — `window.confirm`로 확인 후 `disconnect`(`SpotifyConnectButton.tsx:80-102`).
  - 렌더 3분기: `loading`(확인 중 스피너), `!connected`(`#1DB954` 브랜드색 연결 버튼), 연결됨(Premium/Free 배지 + X 해제 버튼)(`SpotifyConnectButton.tsx:104-159`).
- **연결**: `./useSpotifyAuth`, `@/lib/notify`(notify), `next/navigation`(useSearchParams). 음악 탭 헤더에 배치.
- **특이사항**: 다른 파일들이 `@/lib/notify`의 `notifySuccess/notifyError`를 쓰는 것과 달리 여기선 저수준 `notify({icon,...})`를 직접 호출 — 모듈 내 알림 패턴 불일치. 해제 확인도 `confirmAction`이 아닌 네이티브 `window.confirm` 사용(피드백 패널과 상이).

#### `popspot-frontend/src/features/notifications/NotificationCenter.tsx` — 통합 알림 센터 모달 (v2.18.1)
- **책임**: 헤더 종 아이콘으로 열리는 Radix Dialog. 의견 답변/동행 채팅/위시 만료/시스템 알림을 localStorage 기반으로 모아 보여주고, 읽음/모두읽음/모두삭제 처리(`NotificationCenter.tsx:37-42`).
- **핵심 로직**:
  - `TYPE_ICON` — `NotificationType`별 lucide 아이콘 맵(`NotificationCenter.tsx:30-35`).
  - `useEffect([open])` — 모달 열릴 때 `readNotifications()`로 최신 로드(`NotificationCenter.tsx:46-48`).
  - 탭 간 동기화 — `popspot:notifications-changed` 커스텀 이벤트 리스너로 다른 탭/컴포넌트 변경 시 재조회(`NotificationCenter.tsx:51-56`).
  - 빈 목록이면 `EmptyState`, 아니면 "모두 읽음"(`markAllAsRead`)·"모두 삭제"(`clearAll`) 버튼 + 목록(`NotificationCenter.tsx:70-121`).
  - `NotificationRow` — `notification.href` 있으면 `Link`로, 없으면 `button`으로 렌더(`NotificationCenter.tsx:164-172`). 클릭 시 안 읽음이면 `markAsRead`, href 있으면 모달 닫기(`NotificationCenter.tsx:109-115`).
  - `formatDate` — `new Date(iso)`를 `YYYY-MM-DD HH:MM`로 직접 포맷, 실패 시 원본 반환(`NotificationCenter.tsx:175-182`).
- **연결**: `@/lib/notifications`(타입 + clearAll/markAllAsRead/markAsRead/readNotifications), `@/components/ui`(Dialog/Button/EmptyState), `next/link`. `open`/`onOpenChange` props는 헤더가 제어.
- **특이사항**: 백엔드 push 없이 전부 localStorage 클라이언트 알림(주석 명시, `NotificationCenter.tsx:41`) — 기기/브라우저 간 비동기화.

#### `popspot-frontend/src/features/onboarding/OnboardingModal.tsx` — 신규 사용자 3단계 온보딩 (v2.18)
- **책임**: 첫 진입자에게 1회만 3단계 기능 소개 모달 노출, localStorage(`popspot:onboarding-seen`)로 재노출 차단(`OnboardingModal.tsx:16, 45-50`).
- **핵심 로직**:
  - `STEPS` 상수 3개(지도/코스/의견) 정의(`OnboardingModal.tsx:24-43`).
  - `useEffect` — localStorage에 `seen` 없으면 1200ms 지연 후 `setOpen(true)`(mount 직후 어수선함 회피), cleanup으로 `clearTimeout`(`OnboardingModal.tsx:55-63`).
  - `dismiss` — localStorage에 `"1"` 기록 + 닫기(`OnboardingModal.tsx:65-70`). `onOpenChange`에서 닫힘(`!v`)이면 `dismiss` 호출해 ESC/외부클릭도 영구 차단(`OnboardingModal.tsx:76`).
  - 마지막 단계면 "시작하기"=dismiss, 아니면 "다음"=stepIndex+1(`OnboardingModal.tsx:72-73, 119-127`). dots 인디케이터로 현재 단계 표시(`OnboardingModal.tsx:93-105`).
- **연결**: `@/components/ui`(Dialog/Button), lucide 아이콘만 의존. 외부 props 없음 — 자체 마운트만으로 동작(루트 레이아웃류에 배치).
- **특이사항**: 로그인/게스트 무관 전역 1회. SSR 가드(`typeof window === "undefined"`)로 서버 렌더 안전(`OnboardingModal.tsx:56`).

#### `popspot-frontend/src/features/profile/ProfileEditModal.tsx` — 프로필(사진+닉네임) 편집 모달
- **책임**: 닉네임 실시간 중복 검사(350ms debounce)와 아바타 업로드(5MB 이하 jpg/png/webp)를 처리하고, 저장 시 아바타 업로드 → 메타 PATCH 2단계로 서버 반영(`ProfileEditModal.tsx:39-44`).
- **핵심 로직**:
  - 모달 열림 시 초기값 동기화 `useEffect([open, ...])`(`ProfileEditModal.tsx:65-72`).
  - 닉네임 debounce 검사 `useEffect`(`ProfileEditModal.tsx:75-123`): trim 결과가 현재 닉네임과 같으면 `selfSame` ok로 즉시 종료(`ProfileEditModal.tsx:80-83`); 길이(2~20) 위반이면 `taken`(`ProfileEditModal.tsx:84-90`); 통과 시 350ms 뒤 GET `/api/v1/users/check-nickname?value=`로 `available` 확인(`ProfileEditModal.tsx:93-118`). **네트워크 실패 시 `ok`로 통과시키고 서버 최종검증에 위임**(`ProfileEditModal.tsx:114-117`).
  - `handleFileChange` — 5MB 초과/허용 외 MIME(`/^image\/(jpeg|png|webp)$/i`)면 `notifyError`로 거부, 통과 시 `URL.createObjectURL`로 미리보기(`ProfileEditModal.tsx:127-140`).
  - `handleSave`(`ProfileEditModal.tsx:142-203`): checking/taken 상태면 막음; `pendingFile` 있으면 FormData로 POST `/api/v1/users/me/avatar` → 반환 `url`을 nextPicture로(`ProfileEditModal.tsx:158-171`); 이어서 PATCH `/api/v1/users/me`로 `{nickname, picture}` 저장(`ProfileEditModal.tsx:174-188`); 성공 시 `onSaved`로 부모에 전달(`ProfileEditModal.tsx:191-194`).
  - `renderNicknameHelper` — checking/taken/selfSame/사용가능 4상태 헬퍼 텍스트(`ProfileEditModal.tsx:310-329`).
  - 로컬 `readMessage` — JSON `message`/문자열/`text()`/`statusText` 다단 폴백(`ProfileEditModal.tsx:331-344`).
- **연결**: `@/lib/api`, `@/lib/notify`, `@/components/ui`(Dialog/Button/Input/Field), `@/types/popup`의 `User`, `next/image`. props로 `user`/`onSaved` 주입. 피호출: Header 프로필 칩/마이페이지에서 열림.
- **특이사항**: 닉네임 검사 fetch 실패를 "사용 가능"으로 낙관 처리 → 저장 단계와 서버 검증이 최종 방어선. `Image`에 `unoptimized` 사용(blob/외부 URL 대응, `ProfileEditModal.tsx:231`). 저장 버튼은 `disabled`(taken/checking) + 내부 가드 이중.

#### `popspot-frontend/src/features/terms/TermsReconsentModal.tsx` — 약관 재동의 강제 모달 (v2.20)
- **책임**: `GET /api/v1/terms/status`로 현재 버전 vs 본인 동의 버전을 비교해 `needsReConsent`면 강제 모달; 동의 시 `POST /api/v1/terms/accept`, 거절 시 부모 `onDecline`(로그아웃)(`TermsReconsentModal.tsx:31-39`).
- **핵심 로직**:
  - `useEffect([enabled])` — `enabled`일 때만 status 조회, `cancelled` 가드, `needsReConsent`면 `setOpen(true)`(`TermsReconsentModal.tsx:45-62`). 실패는 조용히 삼킴(다음 세션 재시도).
  - `handleAccept` — POST accept 성공 시 모달 닫기, 실패 시 모달 유지(`TermsReconsentModal.tsx:64-76`).
  - `onOpenChange`에서 `!v && needsReConsent`면 닫기 차단 — **ESC/외부클릭으로 못 빠져나가게 막아 동의/거절만 허용**(`TermsReconsentModal.tsx:83-87`).
  - `if (!status?.needsReConsent) return null`로 불필요 시 미렌더(`TermsReconsentModal.tsx:78`).
  - 이용약관/개인정보처리방침 링크는 새 탭 + `rel="noopener noreferrer"`(`TermsReconsentModal.tsx:108-125`).
- **연결**: `@/lib/api`, `@/components/ui`(Dialog/Button), `next/link`. props `enabled`/`onDecline`은 부모(로그인 상태 알고 로그아웃 처리)가 주입.
- **특이사항**: 마운트 시 1회만 조회(주석 명시). 비로그인은 부모가 아예 렌더 안 함 전제. 모달 탈출 차단이 핵심 — 동의 거절=로그아웃이라는 강제 흐름.

#### `popspot-frontend/src/features/popup/SearchBox.tsx` — Algolia 기반 검색존 + 클라이언트 가드 (v2.13)
- **책임**: 메인 MAP 탭 좌측 Algolia InstantSearch 검색존. 입력창 아래 드롭다운으로 결과. Algolia 키 미설정/오류 시 외부 호출 없는 fallback UI로 안전 대체(`SearchBox.tsx:166-170`).
- **핵심 로직**:
  - `isVisibleHit(hit)` — 인덱스 잔존 garbage 대비 **이중 방어** 필터(`SearchBox.tsx:35-45`): `reviewStatus`가 `AUTO_PUBLISHED/APPROVED/null/undefined`만 통과(`SearchBox.tsx:37`); `status`가 `EXPIRED/PENDING`이면 차단(`SearchBox.tsx:38`); `confidence < 0.8`이면 제외(`SearchBox.tsx:39`); `endDate`가 24시간 전보다 과거면 제외(`SearchBox.tsx:40-43`).
  - `searchClient` — `env.algolia` null이면(미설정/더미) 클라이언트 미생성(`SearchBox.tsx:47-50`).
  - `CustomSearchBox` — `useSearchBox`의 `query`를 input과 동기화하되, **무한루프 방지를 위해 deps에서 `inputValue` 의도적 제외**(`SearchBox.tsx:59-62`, eslint-disable 주석).
  - `CustomHits` — `query` 없으면 null, 있으면 `hits.filter(isVisibleHit)` 후 `/popup/{objectID}`로 링크(`SearchBox.tsx:88-130`). 빈 결과 안내 + Algolia 어트리뷰션 푸터.
  - `SearchZoneFallback` — disabled input "준비 중" UI, 외부 호출 일절 없음(`SearchBox.tsx:133-164`).
  - `SearchZone` — `searchClient` 없으면 fallback, 있으면 `InstantSearch indexName="popups"`(`SearchBox.tsx:171-191`).
- **연결**: `react-instantsearch`, `algoliasearch/lite`, `@/lib/env`의 `env`, `next/link`. 피호출: `GlobalSearchModal`이 `SearchZone`을 재사용; MAP 탭 직접 사용.
- **특이사항**: 백엔드 인덱싱 가드를 클라에서 한 번 더 검증하는 이중 방어 설계. env 미설정을 런타임 에러 없이 fallback으로 흡수.

#### `popspot-frontend/src/features/popup/GlobalSearchModal.tsx` — 글로벌 검색 모달 + Ctrl/Cmd+K 훅 (v2.18)
- **책임**: 헤더 돋보기 버튼으로 여는 검색 모달. `SearchZone`을 그대로 재사용해 어느 페이지에서든 동일 검색 경험 제공(`GlobalSearchModal.tsx:20-27`).
- **핵심 로직**:
  - `GlobalSearchModal` — Radix Dialog(size="lg") 안에 `SearchZone` 렌더(`GlobalSearchModal.tsx:28-42`). ESC 닫기는 Radix 기본.
  - `useGlobalSearchHotkey(setOpen)` — keydown에서 `metaKey+k`(Mac) 또는 `ctrlKey+k`(Win/Linux) 감지 시 `preventDefault` 후 `setOpen(true)`(`GlobalSearchModal.tsx:49-62`).
- **연결**: `@/components/ui/dialog`, `./SearchBox`의 `SearchZone`. 피호출: 헤더 컴포넌트가 `open`/`setOpen` 상태를 들고 모달 + 훅 사용.
- **특이사항**: 검색 로직을 갖지 않고 전적으로 `SearchZone`에 위임 — 결합도 낮춤. 주석은 "다시 누르면 닫힘"이라 하나 실제 핸들러는 `setOpen(true)` 고정이라 토글이 아님(닫기는 ESC/외부클릭 의존).

#### `popspot-frontend/src/features/popup/AddPlaceModal.tsx` — 코스 탭 "장소 추가" 슬라이드업 시트
- **책임**: 부모 컨테이너 내부에서 `absolute inset-0`으로 채우는 로컬 시트(뷰포트 전체 모달 아님). 팝업 목록을 보여주고 선택 이벤트만 부모로 전달(`AddPlaceModal.tsx:14-20`).
- **핵심 로직**:
  - `AnimatePresence` + framer-motion으로 아래에서 위로 슬라이드(`y:"100%"→0`)(`AddPlaceModal.tsx:28-37`).
  - `popups.map`으로 각 항목 버튼 렌더, 클릭 시 `onSelect(popup)` 호출(`AddPlaceModal.tsx:50-67`).
  - 비즈니스 로직(중복 체크/state)은 부모에 두고 여기선 표시+선택만(`AddPlaceModal.tsx:19-20`).
- **연결**: `framer-motion`, `@/types/popup`의 `PopupStore`. props `popups`/`onSelect`/`onClose`는 코스 탭 부모가 주입.
- **특이사항**: 의도적으로 Radix Dialog를 쓰지 않음 — 컨테이너 내부 시트라서(`AddPlaceModal.tsx:17-19`). `role="dialog"`+`aria-label` 수동 부여.

#### `popspot-frontend/src/features/popup/PopupCalendarModal.tsx` — 월별 팝업 일정 캘린더 모달
- **책임**: 월 그리드 달력에서 날짜 클릭 시 해당일 진행 팝업 목록을 보여주는 모달. 날짜별 매칭은 startDate~endDate 범위 비교(`PopupCalendarModal.tsx:24-27`).
- **핵심 로직**:
  - `days` `useMemo` — 월 첫날 요일만큼 `null` 패딩 + 1~말일 숫자 배열 생성(`PopupCalendarModal.tsx:41-48`).
  - `getPopupsForDate(day)` — `YYYY-MM-DD` 타깃 문자열 만들어 `targetDate >= start && targetDate <= end` **문자열 사전식 비교**로 필터(`PopupCalendarModal.tsx:50-61`). `endDate` 없으면 `startDate`로 폴백(당일 팝업).
  - `handlePrevMonth/NextMonth` — `new Date(year, month±1, 1)`로 월 이동 + `selectedDay`를 1로(`PopupCalendarModal.tsx:63-70`).
  - 그리드 렌더: 요일 헤더(일=hot/토=lime 색), 날짜 셀(선택/팝업유무 점 표시), `null`은 `invisible`(`PopupCalendarModal.tsx:110-174`).
  - 하단 선택일 목록 — `sourceType === "CRAWLED"`면 "AI" 자동수집 뱃지 노출(정확성 면책 가시성, `PopupCalendarModal.tsx:201-210`), 클릭 시 `/popup/{id}`로 이동하며 모달 닫기(`PopupCalendarModal.tsx:191-196`).
- **연결**: `@/components/ui/dialog`, `@/lib/utils`의 `cn`, `@/types/popup`의 `PopupStore`, `next/link`. props `popups`는 부모가 주입.
- **특이사항**: 날짜 비교를 Date 객체가 아닌 `YYYY-MM-DD` 문자열 사전식으로 처리 — zero-pad가 보장돼 정상 동작하나 타임존/형식 의존적. 초기 `selectedDay`는 오늘 날짜지만 월 이동 시 항상 1일로 리셋.

#### `popspot-frontend/src/features/popup/ReportPopupModal.tsx` — 사용자 팝업 제보 모달
- **책임**: 사용자가 발견한 팝업 정보(이름/카테고리/지역/주소/기간/설명)를 입력해 `POST /api/popups/report`로 제보. Radix Dialog 사용으로 포커스 트랩/ESC/스크롤잠금 자동(`ReportPopupModal.tsx:31-34`).
- **핵심 로직**:
  - `formData` 단일 state + 공용 `handleChange`(`e.target.name`으로 필드 갱신)(`ReportPopupModal.tsx:40-56`).
  - `handleSubmit` — `submitting` 가드 후 POST, 제출 시 `reporterId`를 `user?.userId || "unknown"`로 다시 한번 세팅(`ReportPopupModal.tsx:58-69`). 성공 시 `notifySuccess` + 모달 닫기, 실패/예외 시 `notifyError`(`ReportPopupModal.tsx:70-83`).
  - 카테고리 select 3종(FASHION/FOOD/POPUP)(`ReportPopupModal.tsx:25-29`).
- **연결**: `@/lib/api`, `@/lib/notify`, `@/components/ui`(Dialog/Button/Input/Field), `@/types/popup`의 `User`/`PopupReportPayload`. props `user`/`open`/`onOpenChange`는 부모 주입.
- **특이사항**: 비로그인 시 `reporterId="unknown"` 문자열로 전송 — 서버가 식별/검증 필요. 초기 `formData.reporterId`(`ReportPopupModal.tsx:48`)는 제출 시점에 다시 덮어쓰므로(`ReportPopupModal.tsx:67`) state 초기값은 사실상 무의미.

#### `popspot-frontend/src/features/popup/AllTrendingModal.tsx` — 전체 트렌딩 랭킹 모달
- **책임**: 메인 랭킹 카드의 + 버튼으로 열리는 전체 트렌딩 팝업 목록(2열 그리드) 모달(`AllTrendingModal.tsx:21-24`).
- **핵심 로직**:
  - `popups.length === 0`이면 6개 스켈레톤(animate-pulse) 표시, 아니면 그리드(`AllTrendingModal.tsx:46-61`).
  - 순위 번호는 `(idx+1).padStart(2,"0")`, 상위 3개만 라임색 강조(`AllTrendingModal.tsx:71-77`).
  - 각 항목: 이름/위치 + `viewCount`(없으면 0) + `status` Badge(`혼잡`이면 hot tone, 아니면 lime, 없으면 "영업중")(`AllTrendingModal.tsx:87-97`). 클릭 시 `/popup/{id}` 이동 + 모달 닫기(`AllTrendingModal.tsx:64-67`).
- **연결**: `@/components/ui`(Dialog/Badge), `@/types/popup`의 `PopupStore`, `next/link`. props `popups`는 부모(메인 페이지)가 이미 정렬된 목록으로 주입.
- **특이사항**: 정렬/랭킹 로직 없음 — 받은 `popups` 순서를 그대로 순위로 표시(정렬 책임은 부모).

#### `popspot-frontend/src/features/popup/TakedownModal.tsx` — 권리자 정보 삭제·수정 요청 모달
- **책임**: 자동수집된 팝업에 대해 권리자/오류 발견자가 `POST /api/popups/{id}/takedown`으로 삭제·수정 요청. 접수 시 즉시 `reviewStatus='TAKEDOWN'` + 24h 내 검토(이용약관 §11)(`TakedownModal.tsx:32-38`).
- **핵심 로직**:
  - 신고 사유 4종(COPYRIGHT/INACCURATE/OWNER_REQUEST/OTHER) select(`TakedownModal.tsx:25-30`).
  - `handleSubmit` — 선택 사유 라벨 + 상세를 `[라벨] 상세` 형태로 합쳐 **500자로 slice**(`TakedownModal.tsx:55-57`), POST에 `{requesterEmail, reason}` 전송(`TakedownModal.tsx:59-65`). 성공 시 `notifySuccess` + 모달 닫기 + 입력 초기화(`TakedownModal.tsx:67-75`).
  - 허위/악성 신고 손해배상 경고 박스(`TakedownModal.tsx:146-148`).
- **연결**: `@/lib/api`, `@/lib/notify`, `@/components/ui`(Dialog/Button/Input/Field). props `popupId`/`popupName`은 상세페이지가 주입.
- **특이사항**: `reason` 클라 측 500자 절단으로 서버 길이 제한 선제 방어. 성공 후 caller 새로고침은 주석상 미구현(`TakedownModal.tsx:73`) — 호출부가 별도 처리 필요. `requesterEmail`은 인증과 무관한 자가신고 입력값이라 서버 검증 의존.

## F5 — 프론트 · lib / store / types / firebase / 설정

#### `popspot-frontend/src/lib/env.ts` — 환경변수 단일 진입점 (검증 + 폴백)
- **책임**: 모든 `NEXT_PUBLIC_*` 환경변수를 한 곳에서 읽어 형 검사·빈 문자열 정규화·폴백·사용 가능 플래그를 붙여 `env` 객체로 노출. 호출부의 `process.env.X!` non-null assertion 패턴(런타임에서야 깨짐)을 제거하는 게 목적.
- **핵심 로직**:
  - `trim()` (`env.ts:19`) — `undefined`/공백/빈 문자열을 모두 `undefined`로 정규화 (`.env`에 `KEY=`만 있는 경우 대비).
  - 5개 변수를 **리터럴 키**로 읽음 (`env.ts:25-29`). 주석(`env.ts:10-12`)이 명시 — Next는 빌드 시 `NEXT_PUBLIC_*`만 인라인 치환하므로 동적 키(`process.env[name]`) 접근은 치환 안 됨.
  - `isAlgoliaValid` (`env.ts:35-40`) — App ID가 영문대문자+숫자(`/^[A-Z0-9]+$/`), 길이 6 이상, search key 길이 10 이상일 때만 유효. 더미값으로 Algolia 클라이언트가 런타임 폭발하는 것을 차단.
  - `env` 객체 (`env.ts:42-53`): `apiUrl`(미지정 시 `http://localhost:8080`), `socketUrl`(SOCKET→API→로컬 순 폴백, `env.ts:46`), `kakaoMapKey`(부재 시 빈 문자열), `algolia`(검증 통과 시에만 객체, 아니면 `null` → 호출부 fallback UI).
- **연결**: 의존 없음(순수 `process.env` 읽기). `api.ts`가 `env.apiUrl`/`env.socketUrl`을 re-export하고, Algolia/Kakao Map/Spotify 관련 컴포넌트가 `env.algolia`/`env.kakaoMapKey`를 직접 참조할 것으로 보임.
- **특이사항**: 폴백 URL이 하드코딩(`localhost:8080`)이라 프로덕션에서 `NEXT_PUBLIC_API_URL` 누락 시 조용히 로컬을 가리킴 — 빌드 시점에 경고 없음.

#### `popspot-frontend/src/lib/api.ts` — 인증 토큰 자동 부착 fetch 래퍼
- **책임**: 상대 경로에 API 도메인 prefix를 붙이고 localStorage 토큰을 `Authorization: Bearer`로 자동 부착하는 `apiFetch` 제공. `env`의 URL을 legacy 호환용으로 re-export.
- **핵심 로직**:
  - `apiFetch` (`api.ts:29-48`) — `buildUrl`+`buildHeaders` 후 `credentials: 'include'`로 fetch. `!response.ok`면 콘솔 에러만 찍고 **응답 객체를 그대로 반환**(throw 안 함); 네트워크 예외만 re-throw.
  - `buildUrl` (`api.ts:52-53`) — `http`로 시작하면 절대 URL 그대로, 아니면 `API_BASE_URL` prefix.
  - `isSameOrigin` (`api.ts:61-62`) — 상대 경로이거나 `API_BASE_URL`로 시작할 때만 `true`. **보안 핵심**: 외부 절대 URL에는 토큰을 싣지 않아 Authorization 헤더가 서드파티로 새는 것을 차단.
  - `buildHeaders` (`api.ts:64-77`) — 기본 `Content-Type: application/json` → 토큰 부착(same-origin일 때만, `api.ts:68`) → 호출자 헤더 병합 → **body가 FormData면 Content-Type 삭제**(`api.ts:73-75`, 브라우저가 multipart boundary 자동 생성하도록).
  - `readToken` (`api.ts:79-82`) — SSR 가드(`window === undefined` → null) 후 `localStorage.getItem('token')`.
- **연결**: 의존 = `./env`. 피호출 = 거의 모든 데이터 페칭 컴포넌트/페이지(인증 필요 API 호출 표준 경로).
- **특이사항**: `!response.ok`여도 반환만 하므로 호출자가 직접 status 체크 필요. `isSameOrigin`의 `startsWith(API_BASE_URL)` 판정은 prefix 매칭이라 `https://api.evil.com.attacker.com`처럼 `API_BASE_URL`을 prefix로 갖는 악성 도메인엔 이론상 토큰이 새지만, `API_BASE_URL`이 자체 운영 도메인이라 실질 위험은 낮음.

#### `popspot-frontend/src/lib/utils.ts` — Tailwind 클래스 병합 + 포맷 헬퍼
- **책임**: `cn`(clsx + tailwind-merge), `formatCompactNumber`(K/M 표기), `getDaysUntil`(D-day) 세 가지 범용 유틸.
- **핵심 로직**:
  - `cn` (`utils.ts:11-13`) — `twMerge(clsx(inputs))`. 충돌 클래스는 뒤쪽 우선.
  - `formatCompactNumber` (`utils.ts:19-23`) — 1000 미만 그대로, 백만 미만 `K`, 그 이상 `M`. `.toFixed(1).replace(/\.0$/, "")`로 `1.0K` → `1K` 정리.
  - `getDaysUntil` (`utils.ts:26-31`) — `Math.max(0, Math.ceil(diff/일))` — 만료 시 음수 대신 0.
- **연결**: 의존 = `clsx`, `tailwind-merge`. 피호출 = 거의 모든 UI 컴포넌트(`cn`), 조회수/카운트 표시(`formatCompactNumber`), 위시/팝업 D-day 배지(`getDaysUntil`).

#### `popspot-frontend/src/lib/notify.ts` — sweetalert2 기반 공통 알림 헬퍼
- **책임**: sweetalert2를 한 겹 감싸 토스트(`notify`)·성공/에러/경고 변형·확인 다이얼로그(`confirmAction`)를 브랜드 톤(라임 `#C2F970`, 잉크 `#0A0A0A`, 위험 `#EE1A64`)으로 통일. `'use client'`.
- **핵심 로직**:
  - `normalize` (`notify.ts:35-36`) — 문자열 인자를 `{ text }`로 변환해 string/객체 두 형태 모두 수용.
  - `notify` (`notify.ts:39-49`) — 기본 `info`, 1.4초 타이머 토스트(`showConfirmButton: false`).
  - `notifyError` (`notify.ts:55-64`) — 타이머 없는 모달, 확인 버튼 잉크색, 기본 제목 '오류'.
  - `confirmAction` (`notify.ts:92-105`) — 예/아니오, `destructive`면 확인 버튼 빨강(`notify.ts:100`), `reverseButtons: true`, `result.isConfirmed`(boolean) 반환.
- **연결**: 의존 = `sweetalert2`. 피호출 = `share.ts`(복사 성공/실패 토스트), 그리고 task 이력상 페이지/admin 전반이 직접 Swal 결합을 걷어내고 이 모듈로 단일화됨.

#### `popspot-frontend/src/lib/rank.ts` — 스탬프 누적 수 → 사용자 등급 결정
- **책임**: 스탬프 개수로 4단계 등급(NONE/BEGINNER/HUNTER/MASTER)을 산출하고, 각 등급의 라벨·Tailwind ring/text/bg/accent 클래스·다음 등급까지 남은 수까지 한 객체(`UserRank`)로 반환.
- **핵심 로직**:
  - 임계값 (`rank.ts:35-37`) — BEGINNER 3, HUNTER 6, MASTER 12.
  - `getUserRank` (`rank.ts:64-71`) — `stampCount ?? 0`으로 null 흡수 후 높은 임계값부터 분기.
  - `buildHunter`/`buildBeginner`/`buildNone` (`rank.ts:75-106`) — `toNext`를 `다음임계값 - stamps`로 계산(예: HUNTER는 `MASTER_MIN - stamps`). MASTER는 상수 객체로 `toNext: 0`.
- **연결**: 의존 없음(`RankKey` 타입만 export). 피호출 = `boost.ts`(`RankKey`로 부스트 한도 매핑), 프로필 아바타/등급 카드/진행도 미터 컴포넌트.
- **특이사항**: 색/라벨이 데이터에 박혀 있어 등급 UI가 이 파일 단일 출처에 의존. 백엔드 등급 임계값과 어긋나면 표시-실제 불일치 발생(주석상 `boost.ts`가 백엔드 정합성 경고를 가짐).

#### `popspot-frontend/src/lib/boost.ts` — 동행 게시판 부스트 등급별 월 한도 정의
- **책임**: 등급별 월 부스트 한도 숫자(`BOOST_LIMIT_BY_RANK`)와 사용자 안내 라벨(`BOOST_LIMIT_HINT`), 그리고 `GET /api/mates/boost-status` 응답 타입(`BoostStatus`) 선언.
- **핵심 로직**: MASTER 5 / HUNTER 3 / BEGINNER 1 / NONE 0 (`boost.ts:10-15`). `BoostStatus`는 rank/monthlyLimit/used/remaining 4필드(`boost.ts:26-32`).
- **연결**: 의존 = `./rank`의 `RankKey`. 피호출 = 동행 글쓰기 모달(한도 표시), 부스트 상태 조회 컴포넌트.
- **특이사항**: 주석(`boost.ts:5-6`)이 명시 — 백엔드 `BoostPolicy.java`와 임계값/한도가 **반드시 일치**해야 함. 한쪽만 바꾸면 사용자 잔여 표시와 서버 차감이 어긋남.

#### `popspot-frontend/src/lib/guestMode.ts` — 7일 게스트 모드 localStorage 정책
- **책임**: 비회원이 7일간 둘러보기/검색/지도/캘린더를 쓸 수 있는 게스트 모드의 시작·만료·잔여일·리셋을 localStorage(`popspot:guest:firstVisit`)만으로 관리. 서버 저장 없음(PIPA 부담 최소).
- **핵심 로직**:
  - `startGuestMode` (`guestMode.ts:28-35`) — **명시적 시작 전용**. 이미 시작돼 있으면 기존 timestamp 유지, 없으면 `Date.now()` 기록 후 반환. (v2.7 재설계: 이전엔 메인 진입만으로 자동 시작돼 사용자 모르게 카운터가 돌았음 — `guestMode.ts:6-7`.)
  - `getGuestFirstVisit` (`guestMode.ts:38-44`) — SSR 가드 + `Number.isNaN` 방어로 미설정/손상 시 null.
  - `isGuestExpired` (`guestMode.ts:58-61`) — 기본 인자로 localStorage 값을 읽되, `null`(미시작)이면 `false`("만료"가 아니라 "아직 시작 안 함").
  - `getRemainingGuestDays` (`guestMode.ts:69-75`) — **미시작 시 의도적으로 7 반환**(`guestMode.ts:70`) → "7일 무료 체험" 카피에 그대로 사용. 만료 시 0.
  - `clearGuestMode` (`guestMode.ts:78-81`) — 가입 완료/로그아웃 시 키 제거.
- **연결**: 의존 없음. 피호출 = `useGuestMode.ts`(읽기 전용 래퍼), 로그인 페이지의 "게스트로 로그인하기" 버튼(`startGuestMode`).
- **특이사항**: localStorage를 지우면 7일이 재갱신되는 우회가 가능하나 주석상(`guestMode.ts:14`) 비즈니스 임팩트가 작아 의도적으로 무시.

#### `popspot-frontend/src/lib/useGuestMode.ts` — 게스트 상태 read-only React 훅
- **책임**: `guestMode.ts`의 상태를 컴포넌트가 SSR-safe하게 읽도록 감싼 훅. **카운터를 시작하지 않음**(v2.7 read-only화).
- **핵심 로직**:
  - `useGuestMode(isLoggedIn)` (`useGuestMode.ts:22-53`) — 초기값을 SSR 기본값(`active:false, remainingDays:7, expired:false`)으로 두어 hydration mismatch 회피.
  - `useEffect` (`useGuestMode.ts:28-41`) — mount 후 `isLoggedIn`이면 `clearGuestMode()` 호출 후 게스트 상태 초기화(로그인 사용자는 잔재 정리, `useGuestMode.ts:31-36`); 비로그인이면 `getGuestFirstVisit`/`getRemainingGuestDays`/`isGuestExpired`로 실제 값 세팅. deps = `[isLoggedIn]`.
  - 반환: `mounted`(SSR 가드용), `active`, `remainingDays`, `expired`.
- **연결**: 의존 = `./guestMode` 4함수. 피호출 = 헤더/AuthGuard/메인 등 게스트 D-N pill·만료 강제 리다이렉트를 다루는 컴포넌트. `'use client'`.
- **특이사항**: 시작 책임은 오로지 로그인 페이지 버튼 → `startGuestMode`에 있고, 이 훅은 결과만 읽음 — 자동 시작 방지 설계가 훅/모듈 분리로 강제됨.

#### `popspot-frontend/src/lib/recentVisits.ts` — 최근 본 팝업 localStorage 헬퍼 (v2.18)
- **책임**: 방문한 팝업을 클라이언트 localStorage(`popspot:recent-visits`)에 최대 10개 FIFO로 저장. 서버 저장 없음.
- **핵심 로직**:
  - `recordVisit` (`recentVisits.ts:25-38`) — 같은 `popupId` 제거 후 맨 앞에 새 항목(`visitedAt` = 현재 ISO) 추가, `.slice(0, 10)`으로 중복 제거 + 최신순 유지. setItem은 try/catch로 quota 초과 시 조용히 무시.
  - `readVisits` (`recentVisits.ts:40-51`) — SSR 가드 + JSON.parse + `Array.isArray` 방어, 손상 시 `[]`.
- **연결**: 의존 없음. 피호출 = 팝업 상세 페이지(방문 기록), 메인의 "최근 본 팝업" 섹션.

#### `popspot-frontend/src/lib/notifications.ts` — 클라이언트 로컬 알림 큐 (v2.18.1)
- **책임**: 의견 답변/동행 채팅/위시 만료/시스템 알림을 localStorage(`popspot:notifications`)에 최대 30개 FIFO로 통합 보관. 헤더 종 아이콘이 이걸 구독.
- **핵심 로직**:
  - `pushNotification` (`notifications.ts:37-52`) — `id`를 `${Date.now()}-${random36}`로 생성, `read:false`/`createdAt` 부여 후 맨 앞 삽입+`slice(0,30)`. **저장 후 `popspot:notifications-changed` CustomEvent dispatch**(`notifications.ts:51`) — 같은 탭 내 다른 구독자에게 즉시 알림.
  - `unreadCount` (`notifications.ts:66-68`) — `read`가 false인 것만 카운트 → 뱃지 숫자.
  - `markAsRead`/`markAllAsRead`/`clearAll` (`notifications.ts:70-88`) — 모두 write 후 `notifyChange()`로 같은 이벤트 dispatch.
  - `writeNotifications` (`notifications.ts:90-97`) — setItem try/catch 무시.
- **연결**: 의존 없음. 피호출 = 알림 센터 모달/헤더 종 아이콘(구독 = `window.addEventListener('popspot:notifications-changed')`), 의견 답변/위시 만료/채팅 발생 지점(push).
- **특이사항**: `CustomEvent`는 **같은 탭** 내 동기화만 보장. 다른 탭은 storage 이벤트가 아니라 이 커스텀 이벤트를 쓰므로 멀티탭 실시간 동기화는 안 됨(설계상 단일 탭 가정).

#### `popspot-frontend/src/lib/share.ts` — Web Share API + 클립보드 fallback 공유 (v2.18)
- **책임**: Web Share API 지원 시 네이티브 공유 시트, 미지원이면 클립보드 복사로 fallback. 외부 라이브러리 없이 표준 API만 사용.
- **핵심 로직**:
  - `share` (`share.ts:19-42`) — `navigator.share`가 함수면 시도; **`AbortError`(사용자 취소)는 `false` 반환하되 에러 토스트 안 띄움**(`share.ts:33-35`), 그 외 실패만 클립보드 fallback.
  - `copyToClipboard` (`share.ts:44-70`) — `navigator.clipboard && window.isSecureContext`면 `writeText` + 성공 토스트(`share.ts:46-49`); 비HTTPS/옛 브라우저는 임시 textarea + `document.execCommand('copy')` 레거시 경로(`share.ts:52-63`). 실패 시 에러 토스트.
- **연결**: 의존 = `./notify`(`notifySuccess`/`notifyError`). 피호출 = 팝업 카드/상세의 공유 버튼.
- **특이사항**: `execCommand('copy')`는 deprecated지만 비보안 컨텍스트 대비 의도적 fallback. `navigator`/`window` 직접 접근하나 SSR 가드는 `share` 진입부의 `navigator === "undefined"` 체크에 의존(`copyToClipboard`는 별도 가드 없음 — 항상 `share` 통해 호출되는 전제).

#### `popspot-frontend/src/lib/regions.ts` — 주소 문자열 → 서울 동네(region) 분류 (v2.21)
- **책임**: 팝업 위치 텍스트를 12개 region(성수/한남/압구정/홍대/강남/이태원/잠실/여의도/명동/성북/마포/기타)으로 정확히 하나만 분류. "성수인데 한남으로 새면 안 됨"이 핵심 요구.
- **핵심 로직**:
  - `REGIONS` (`regions.ts:48-153`) — 각 region에 `keywords`(substring 매칭, 더 긴 키워드 우선 배치)와 `priority`(낮을수록 더 좁고 구체적) 부여. 강남/성북 priority 2, 마포 3, 나머지 1.
  - `classifyRegion` (`regions.ts:159-186`) — **모든 region을 순회**해 첫 매치가 아니라 "가장 정확한 한 곳"을 고름. 동률 규칙(`regions.ts:175-178`): priority 낮은 쪽 우선, 같으면 keyword 길이가 긴(더 구체적) 쪽. 예: "성수동 한남대로" → priority 동률(둘 다 1)이면 키워드 길이로 "성수동"(3) vs "한남대로"(4) 비교.
  - `regionLabel`/`regionBySlug` (`regions.ts:189-195`) — code↔label/slug 조회 헬퍼.
- **연결**: 의존 없음. 피호출 = 메인 BROWSE 동네 슬라이스, SEO 동네 랜딩 페이지(slug 라우팅), 지도 필터.
- **특이사항**: 행정구역 단독("성동구")은 키워드에 없어 매칭 안 됨 — 동네명이 명시돼야 카운트(`regions.ts:10`). 약관 §10-2 일관성: 외부 검색 API 없이 자체 보관 텍스트만 사용(`regions.ts:12`). "성수동 한남대로" 예시는 키워드 길이 규칙상 한남(4)이 더 길어 실제로는 한남으로 갈 수 있는 모서리 케이스 — 주석의 의도(성수 우선)와 길이 규칙이 미묘하게 충돌할 여지.

#### `popspot-frontend/src/lib/popupSlices.ts` — 시점/카테고리 슬라이싱 순수 유틸 (v2.21)
- **책임**: 팝업을 시점(오늘/내일/이번 주/주말/이번 달)과 카테고리(패션/뷰티/캐릭터/디저트/라이프/아트/테크)로 분류. 메인 BROWSE와 SEO 랜딩이 공유. 모든 함수 순수, 외부 호출 없음.
- **핵심 로직**:
  - `getPeriods(now)` (`popupSlices.ts:33-68`) — 호출 시점 날짜로 **동적 라벨** 생성. 주 범위는 월~일(`offsetToMon = (day+6)%7`, `popupSlices.ts:42`), 주말은 토요일 기준이되 **일요일이면 "다음 주말"**(`popupSlices.ts:52-55`).
  - `PERIODS` (`popupSlices.ts:74`) — `getPeriods()` 빌드 타임 스냅샷. 주석상 slug/code만 필요한 `generateStaticParams`용, 사용자 표시엔 `getPeriods()` 권장(라벨 stale 방지).
  - `parseDate` (`popupSlices.ts:142-150`) — `yyyy-MM-dd`/`yyyy.MM.dd` 모두 `.`→`-` 정규화 후 `slice(0,10)`, 파트 3개 + truthy 검사.
  - `matchesPeriod` (`popupSlices.ts:164-208`) — 시점별 범위 겹침 판정. `this-week`/`this-weekend`/`this-month`는 "단 하루라도 겹치면" 매치(`start <= rangeEnd && end >= rangeStart`). 한 팝업이 여러 슬라이스에 동시 포함 가능(`popupSlices.ts:163`).
  - `classifyCategory` (`popupSlices.ts:213-224`) — `toLowerCase` 후 keyword substring 첫 매치 반환. 백엔드 category가 자유 텍스트라 한/영 키워드 혼재.
- **연결**: 의존 없음. 피호출 = 메인 BROWSE 시점/카테고리 탭, `/popups/[period]`·`[category]` SEO 랜딩 + 그 `generateStaticParams`.
- **특이사항**: 시점 판정은 클라이언트 로컬 시간(KST 사용자 가정, `popupSlices.ts:5-6`) — 타임존 다른 사용자는 경계일이 어긋날 수 있음. `getPeriods`의 `switch`는 모든 케이스 반환이라 default 없음(타입상 망라).

#### `popspot-frontend/src/lib/escapeHtml.ts` — raw HTML 삽입용 XSS escape
- **책임**: 신뢰 불가 문자열을 raw HTML(외부 SDK의 `content` 문자열, innerHTML)에 넣기 전 5개 특수문자(`& < > " '`)를 엔티티로 치환.
- **핵심 로직**: `escapeHtml` (`escapeHtml.ts:12-20`) — null/undefined → `""`, 이후 `&`를 **가장 먼저** 치환(이중 escape 방지)하고 `<`,`>`,`"`,`'` 순서로 replace.
- **연결**: 의존 없음. 피호출 = Kakao Map/Roadview의 `CustomOverlay({ content })`처럼 문자열을 DOM에 직접 꽂는 지점.
- **특이사항**: 주석(`escapeHtml.ts:7-9`)이 위협 모델을 명시 — 팝업 이름은 자동수집 크롤러가 외부 검색결과에서 가져온 비신뢰 데이터라 `<img src=x onerror=...>` 페이로드로 저장형 XSS 가능. React 일반 텍스트 렌더(`{value}`)는 자동 escape되니 이 함수는 **오직 raw HTML 직조 시에만** 써야 함(과용 시 이중 escape).

#### `popspot-frontend/src/store/useChatStore.ts` — 동행 채팅방 전역 상태 (Zustand + persist)
- **책임**: 활성 채팅방(`activeChat`)과 최소화 여부(`isMinimized`)를 Zustand로 전역 관리하고 localStorage(`popspot-chat-storage`)에 영속. 새로고침/멀티탭에서 마지막 채팅방 복원.
- **핵심 로직**:
  - 스토어 (`useChatStore.ts:29-44`) — `persist` 미들웨어로 감싼 create. `openChat`은 `activeChat` 세팅 + `isMinimized:false`(`useChatStore.ts:35`), `closeChat`은 null, `minimizeChat`는 boolean 토글.
  - `storage: createJSONStorage(() => localStorage)` (`useChatStore.ts:41`) — JSON 직렬화 영속.
  - `ChatRoomInfo` (`useChatStore.ts:11-17`) — postId/postTitle/nickname/userId/isAuthor.
- **연결**: 의존 = `zustand`, `zustand/middleware`. 피호출 = 글로벌 채팅 매니저(미니/풀 뷰 토글), 동행 게시판 글에서 채팅 열기 버튼.
- **특이사항**: localStorage 직접 참조라 SSR에서 첫 렌더 시 hydration 주의 필요(zustand persist의 알려진 패턴 — 구독 컴포넌트가 mount 가드로 다룰 것으로 보임).

#### `popspot-frontend/src/types/sdk.ts` — 외부 SDK(Kakao Maps / YouTube) 글로벌 타입
- **책임**: 공식 @types가 부실한 Kakao Maps·YouTube IFrame Player의 **우리가 실제 쓰는 표면만** 최소 선언.
- **핵심 로직**: `KakaoMapsSdk`/`YouTubeIframeSdk`를 `any`로 둠(`sdk.ts:15,18`, 컨테이너만). `YouTubePlayer`(`sdk.ts:27-39`)는 play/pause/stop/seekTo/getCurrentTime/getDuration/getPlayerState/setVolume/mute/unMute/destroy만 좁게 타입화. `YouTubePlayerEvent`(`sdk.ts:21-24`)는 `onReady`/`onStateChange` 콜백 인자.
- **연결**: 의존 없음. 피호출 = Kakao Map 컴포넌트, `useYouTubePlayer` 훅(음악 재생).
- **특이사항**: 파일 상단에서 `eslint-disable @typescript-eslint/no-explicit-any`(`sdk.ts:12`) — `any` 사용이 의도적. 주석(`sdk.ts:8-9`) — Kakao API가 자주 바뀌어 좁게 잡는 게 유지보수에 유리하다는 명시적 결정.

#### `popspot-frontend/src/types/popup.ts` — 팝업 도메인 공용 타입 (백엔드 DTO 1:1)
- **책임**: User/MyPageData/PopupStore/CalendarPopup/혼잡도/트렌드/위시/코스 등 핵심 도메인 타입을 한 곳에서 관리. 페이지·컴포넌트·모달이 같은 모양을 공유.
- **핵심 로직**:
  - `SourceType`/`ReviewStatus` (`popup.ts:11-18`) — 자동수집/검수 enum union.
  - `User` (`popup.ts:22-36`) — `userId`가 정식, `id`는 일부 API가 내려주는 **호환 alias**(`popup.ts:23`, 화면은 userId 우선). `email`/`picture`는 v2.15.3 추가(소셜 로그인), `megaphoneCount`는 상점 폐기 후 기존 보유분 표시용.
  - `PopupStore` (`popup.ts:50-73`) — 필수(id/name/location/status/viewCount) + 다수 옵셔널. lat/lng가 `string` 타입(`popup.ts:57-58`, 백엔드가 문자열로 내림). V4 자동수집 메타(`sourceType`/`reviewStatus`/`confidenceScore`)는 수동 등록 호환 위해 옵셔널(`popup.ts:67-72`).
  - `CongestionData` (`popup.ts:107-123`) — `forecast`가 정식, `forecasts`는 일부 응답 alias(`popup.ts:119-120`). `ageRates`는 `Record<string, number>`.
  - `SavedCourse.courseData` (`popup.ts:166`) — **JSON 문자열**, parse하면 `CourseItem[]`.
- **연결**: 의존 없음(순수 타입). 피호출 = 거의 모든 팝업/마이페이지/지도/위시 관련 코드.
- **특이사항**: alias 필드(`User.id`, `CongestionData.forecasts`)와 `latitude/longitude: string`은 백엔드 응답 형 불일치를 흡수하는 방어적 모델링 — 호출부가 어느 키를 쓸지 일관성 주의 필요.

#### `popspot-frontend/src/types/feedback.ts` — 의견 보내기 도메인 타입 + 라벨 맵
- **책임**: 백엔드 Feedback DTO 3종과 1:1 대응하는 타입, 카테고리/상태 union, 그리고 UI 표시 라벨 맵을 한 곳에서 관리.
- **핵심 로직**: `FeedbackCategory`(BUG/FEATURE/GOOD/OTHER)·`FeedbackStatus`(PENDING/REVIEWING/RESOLVED/WONT_FIX) union(`feedback.ts:8-10`). `Feedback`은 `userId`/`guestEmail`/`adminReply`/`repliedAt`이 nullable(`feedback.ts:12-23`). `CATEGORY_LABEL`/`STATUS_LABEL`(`feedback.ts:45-58`)이 union을 빠짐없이 매핑(`Record<K, string>`)해 라벨 단일 출처.
- **연결**: 의존 없음. 피호출 = `/feedback` 페이지, MY 탭 의견 카드, admin FEEDBACK 탭, feedback API 모듈.
- **특이사항**: `Record<Category, string>` 타입이라 enum 값 추가 시 라벨 누락이 컴파일 에러로 잡힘 — 의도적 안전장치.

#### `popspot-frontend/src/types/music.ts` — 음악→팝업 매칭 도메인 타입
- **책임**: MusicTrack/PopupMatch/MatchResult/UserMusicHistory 타입 선언. Spotify/YouTube/iTunes 메타데이터 표현.
- **핵심 로직**:
  - `MusicTrack` (`music.ts:8-32`) — **`itunesTrackId`는 레거시 컬럼명이지만 대부분 null**, 실제 재생 ID는 `spotifyTrackId`(`music.ts:11-16`, v2.21-S13). `artworkUrl`(100×100)/`artworkUrlHires`(1000×1000) 2단계 해상도. **`moodTags`는 JSON 문자열**이라 클라이언트에서 `JSON.parse` 필요(`music.ts:28`).
  - `MatchResult` (`music.ts:44-48`) — track + parse된 `moodTags: string[]`(여기선 배열) + `popups: PopupMatch[]`.
- **연결**: 의존 없음. 피호출 = 음악 매칭 페이지, `useYouTubePlayer`/Spotify Web Playback 관련 컴포넌트, 음악 히스토리.
- **특이사항**: 같은 `moodTags`가 `MusicTrack`에선 JSON 문자열, `MatchResult`에선 `string[]`로 형이 다름(`music.ts:28` vs `music.ts:46`) — 변환 경계 혼동 주의. `itunesTrackId` 필드명은 DB 컬럼 변경 없이 의미만 Spotify로 바뀐 부채(`music.ts:4-6`).

#### `popspot-frontend/next.config.ts` — Next.js 빌드/보안/이미지/리라이트 설정
- **책임**: 워크스페이스 루트 고정, 이미지 원격 호스트 화이트리스트, `/api/*` → 백엔드 리라이트, 보안 헤더(CSP 등), 프로덕션 콘솔 제거를 한 파일에 설정.
- **핵심 로직**:
  - `backendHostname` 파싱 (`next.config.ts:8-13`) — `API_URL`에서 hostname 추출, URL 형식 오류 시 try/catch로 `localhost` 폴백 + 경고.
  - `turbopack.root` + `outputFileTracingRoot` = `projectRoot`(`next.config.ts:17-20`) — 부모 폴더의 yarn.lock/package.json 무시(모노레포 오인 방지).
  - `images.remotePatterns` (`next.config.ts:23-31`) — unsplash/kakaocdn/pstatic/googleusercontent + 동적 `backendHostname`(http/https 둘 다).
  - `rewrites` (`next.config.ts:34-38`) — `/api/:path*` → `${API_URL}/api/:path*` (같은 출처처럼 보이게 프록시).
  - `headers().csp` (`next.config.ts:61-85`) — **상세 CSP**. `script-src`에 Kakao(dapi.kakao/daumcdn)·GTM·Algolia·YouTube(www.youtube/s.ytimg)·Spotify SDK(sdk.scdn.co) + `'unsafe-inline' 'unsafe-eval'`(Next/React inline 호환 임시 허용, `next.config.ts:68`). `connect-src`에 Algolia·OAuth(kakao/google/naver)·`*.ts.net`(Tailscale Funnel 백엔드)·Spotify(api/wss)·YouTube(`next.config.ts:77`). `frame-src`에 YouTube/Spotify/Kakao accounts. `media-src`에 Spotify CDN + iTunes preview(`next.config.ts:73`). `object-src 'none'`, `frame-ancestors 'self'`, `upgrade-insecure-requests`.
  - 그 외 헤더(`next.config.ts:92-99`) — X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy(geolocation self만 허용, mic/cam/payment 차단), HSTS 1년+includeSubDomains.
  - `compiler.removeConsole` (`next.config.ts:105-110`) — 프로덕션에서 `error`/`warn` 제외 콘솔 제거.
- **연결**: `process.env.NEXT_PUBLIC_API_URL` 직접 읽음(env.ts와 별개 — config는 빌드 타임 컨텍스트). 피영향 = 전체 앱(모든 라우트에 헤더 적용 `source: "/:path*"`, `next/image` 호스트 검증).
- **특이사항**: `'unsafe-inline' 'unsafe-eval'`이 `script-src`에 있어 CSP의 XSS 방어가 약화됨(주석상 nonce 적용으로 강화 가능 명시, `next.config.ts:45-46`). CSP 도메인 누락이 과거 실제 장애를 냄 — YouTube `iframe_api.js`가 `script-src` 누락으로 막혀 음악 재생 검은 화면(`next.config.ts:63-66`), jsdelivr/`*.ts.net` 초기 strict CSP 차단(`next.config.ts:52-58`). 외부 의존이 늘 때마다 CSP 동기 갱신이 필수인 취약 지점. `env.ts`와 폴백 URL(`localhost:8080`)이 중복 정의됨.
