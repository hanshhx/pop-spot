# 🚀 POP-SPOT 배포 체크리스트 / 변경 요약 / CORS 검증

이 문서 = "배포 직전에 한 번만 훑으면 되는 최종 점검표".

---

## 1. 코드 변경 요약 (이 세션에서 수정한 것)

### 보안 (🔴 즉시 조치 — 모두 반영)

| 항목 | 파일 | 핵심 변경 |
|---|---|---|
| 시크릿 분리 | `src/main/resources/application.properties` | 모든 키를 `${ENV_VAR}` 참조로. 평문 키 0개. |
| 운영 프로필 | `src/main/resources/application-prod.properties` (신규) | `ddl-auto=validate`, Flyway on, actuator는 health만 |
| 환경변수 템플릿 | `.env.example` (신규) | 모든 변수 + 발급처 메모 |
| .gitignore | `.gitignore` | `.env*` 차단 + `*-secret.*` 차단 (application.properties 자체는 커밋 가능) |
| 결제 위변조 | `service/IamportService.java` (신규), `service/OrderService.java` | `imp_uid` 로 PortOne 서버에서 실제 결제 재조회 → 금액/상태 검증 → 위반 시 자동 환불. **테스트 모드 우회 제거.** |
| 결제 인증 | `controller/OrderController.java` | `@PreAuthorize("isAuthenticated()")` + `Authentication` 객체에서 userId 추출 (스푸핑 방어) |
| 중복 결제 | `repository/OrderRepository.java` | `existsByImpUid` 추가 |
| JWT 시크릿 | `config/JwtAuthenticationFilter.java`, `config/OAuth2SuccessHandler.java` | 기본값 제거. `@PostConstruct` 에서 32B 미만이면 부팅 실패. |
| CORS | `config/SecurityConfig.java` | 와일드카드 X. `APP_ALLOWED_ORIGINS` 화이트리스트만. STATELESS 세션. BCrypt strength=12. `@EnableMethodSecurity` 활성화. |
| WebSocket | `config/WebSocketConfig.java` | `setAllowedOriginPatterns("*")` → 화이트리스트. JWT 핸드셰이크 인터셉터. |
| 관리자 권한 | `controller/AdminController.java`, `AdminMetricsController.java` | 클래스 단 `@PreAuthorize("hasRole('ADMIN')")` 추가 |
| Rate Limit | `config/RateLimitInterceptor.java` (신규), `config/WebConfig.java` | Bucket4j. login 5회/분, email/send 5회/시간, email/verify 10회/분 |
| 인증코드 brute-force | `controller/AuthController.java` | 검증 5회 실패 시 코드 무효화 |
| PII 로그 | `service/CustomOAuth2UserService.java`, `JwtAuthenticationFilter.java`, `OAuth2SuccessHandler.java` | `System.out.println` 제거. 이메일/사진/토큰 평문 출력 X. |
| ddl-auto | `application-prod.properties` | `validate` + Flyway. 마이그레이션 폴더 `db/migration/V1__baseline.sql`, `V2__stamp_unique_constraint.sql` |

### 중간 우선순위 (🟡 — 모두 반영)

| 항목 | 파일 | 변경 |
|---|---|---|
| Stamp race | `entity/Stamp.java` + `V2__stamp_unique_constraint.sql` | 동일(user_id, popup_id) UNIQUE |
| N+1 / 메모리 폭발 | `repository/PopupStoreRepository.java`, `service/PopupStoreService.java` | `findTrending(Pageable)` JPQL — DB 단 정렬 + LIMIT |
| Mass assignment | `dto/PopupReportRequestDto.java` (신규), `controller/PopupStoreController.java` | 엔티티 직접 받지 않고 DTO. id/status/viewCount 스푸핑 차단 |
| 파일 업로드 | `controller/ChatFileController.java` | MIME 화이트리스트 + canonical path 비교 + 10MB 제한 + UUID 파일명 |
| 글로벌 예외 | `exception/GlobalExceptionHandler.java` | 표준 응답 + AccessDenied/Auth/SecurityException 분리. 운영 스택트레이스 노출 X |
| 타임존 | `PopspotBackendApplication.java`, `application.properties` | KST 강제 (JVM + Jackson 양쪽) |

### 운영/배포 (🟢)

| 항목 | 파일 | 내용 |
|---|---|---|
| systemd | `deploy/popspot.service` | popspot 사용자, EnvironmentFile, ProtectSystem 등 보안 옵션 |
| nginx | `deploy/nginx-popspot.conf` | 80→443 리다이렉트, WebSocket Upgrade, X-Forwarded-* 전달 |
| 배포 스크립트 | `deploy/deploy.sh` | `initial` / `update` 모드, gradle bootJar |
| PostgreSQL | `deploy/postgresql-setup.sh` | 17/16 설치 + DB/USER 생성 + localhost only |
| 가이드 | `deploy/README_DEPLOY.md` | 11단계 가이드 |
| build.gradle | Bucket4j, Flyway 추가 |

### 프론트엔드

| 항목 | 파일 | 변경 |
|---|---|---|
| 하드코드 제거 | `src/components/TicketingSimulation.tsx` | `http://localhost:8080` → `${API_BASE_URL}` |
| WS 분리 | `src/lib/api.ts` | `SOCKET_BASE_URL` 가 `NEXT_PUBLIC_SOCKET_URL` 우선 |
| 환경변수 템플릿 | `.env.example` (신규) | Vercel 등록용 |

---

## 2. 배포 직전 체크리스트 (실수 0%)

### A. 환경변수 (가장 흔한 사고 포인트)

#### VM 측 — `/home/reo4321/popspot.env`
- [ ] `JWT_SECRET` — `openssl rand -base64 48` 생성 (32B 미만이면 **부팅 실패**)
- [ ] `DB_PASSWORD` — `postgresql-setup.sh` 에 넘긴 비번과 **반드시 동일**
- [ ] `MAIL_PASSWORD` — Gmail 앱 비밀번호 (16자)
- [ ] `IAMPORT_API_KEY` / `_SECRET` — 누락 시 결제 자체가 차단됨
- [ ] `APP_FRONTEND_URL=https://popspot.co.kr`
- [ ] `APP_OAUTH2_REDIRECT_URI=https://popspot.co.kr/oauth/callback`
- [ ] `APP_ALLOWED_ORIGINS=https://popspot.co.kr,https://popspot.vercel.app,...` ← Vercel 모든 도메인 (preview 포함)
- [ ] `SPRING_PROFILES_ACTIVE=prod`
- [ ] `JPA_DDL_AUTO=validate` (단, **첫 부팅에만** `update` 로 띄워서 스키마 생성)

#### Vercel 측 — Settings > Environment Variables
- [ ] `NEXT_PUBLIC_API_URL=https://api.popspot.co.kr`
- [ ] `NEXT_PUBLIC_SOCKET_URL=https://api.popspot.co.kr`
- [ ] `NEXT_PUBLIC_KAKAO_MAP_KEY` / `NEXT_PUBLIC_ALGOLIA_*` / `NEXT_PUBLIC_IAMPORT_MERCHANT_CODE`
- [ ] **Production / Preview 둘 다** 설정
- [ ] 변경 후 **Redeploy** 클릭 (저장만 하면 반영 X)

### B. OAuth 콘솔 리다이렉트 URI (또 하나의 사고 포인트)

소셜 로그인 콘솔에서 다음 콜백을 등록해야 함:
- Google: `https://api.popspot.co.kr/login/oauth2/code/google`
- Kakao: `https://api.popspot.co.kr/login/oauth2/code/kakao`
- Naver: `https://api.popspot.co.kr/login/oauth2/code/naver`

### C. 방화벽 / DNS
- [ ] DNS: `api.popspot.co.kr A → VM 외부 IP`
- [ ] DNS: `popspot.co.kr CNAME → cname.vercel-dns.com`
- [ ] GCP 방화벽: 80/443만 0.0.0.0/0 허용. 22는 본인 IP만. 5432/6379/8080 외부 차단
- [ ] Let's Encrypt: `sudo certbot --nginx -d api.popspot.co.kr`

### D. 첫 스키마 생성 (잘못하면 안 일어나는 일)

신규 DB 라면 **딱 한 번**:
```bash
# /home/reo4321/popspot.env 에서 임시로:
SPRING_PROFILES_ACTIVE=dev
JPA_DDL_AUTO=update

sudo systemctl restart popspot
sudo journalctl -u popspot -f   # "Hibernate: create table ..." 로그 확인

# 확인 후 즉시 prod 로 복귀
SPRING_PROFILES_ACTIVE=prod
JPA_DDL_AUTO=validate
sudo systemctl restart popspot

# Flyway 베이스라인:
sudo -u postgres psql -d popspot_db -c "SELECT * FROM flyway_schema_history;"
```

---

## 3. CORS 검증 (배포 후 즉시 실행)

### 3-1. 백엔드 자체 헬스
```bash
# VM 내부
curl -s http://127.0.0.1:8080/actuator/health
# 외부 (nginx + TLS 통과)
curl -s https://api.popspot.co.kr/actuator/health
# 둘 다 {"status":"UP"} 가 떠야 함
```

### 3-2. preflight (OPTIONS) — Vercel → VM

```bash
curl -i -X OPTIONS https://api.popspot.co.kr/api/v1/auth/login \
  -H "Origin: https://popspot.co.kr" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
```

#### ✅ 정상 응답 헤더
```
HTTP/2 200
Access-Control-Allow-Origin: https://popspot.co.kr     <-- "*" 가 아니어야 함
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD
Access-Control-Allow-Headers: Authorization, Content-Type, Accept, Origin, X-Requested-With, Cache-Control, X-XSRF-TOKEN
Access-Control-Max-Age: 3600
```

#### ❌ 흔한 실패 패턴
| 응답 | 원인 | 해결 |
|---|---|---|
| `403 Invalid CORS request` | Origin 이 화이트리스트에 없음 | `APP_ALLOWED_ORIGINS` 에 해당 도메인 추가 → restart |
| `Access-Control-Allow-Origin: *` | 정책 위반 (credentials=true 와 충돌) | SecurityConfig 가 와일드카드 안 쓰는지 확인 |
| `Access-Control-Allow-Origin` 헤더 누락 | CORS 설정 자체가 안 잡힘 | `WebConfig#addCorsMappings` 가 비어있는지 (SecurityConfig 가 SSOT) |
| 200 OK 인데 CORS 헤더 없음 | nginx 레벨에서 Bearer 가 잘림 | nginx 설정의 `proxy_set_header Authorization $http_authorization;` 확인 |

### 3-3. 실제 POST (인증 없는 엔드포인트로)

```bash
curl -i -X POST https://api.popspot.co.kr/api/v1/auth/check-email?email=test@example.com \
  -H "Origin: https://popspot.co.kr" \
  -H "Content-Type: application/json"
```

응답에 `Access-Control-Allow-Origin: https://popspot.co.kr` 와 `Access-Control-Allow-Credentials: true` 가 보이면 통과.

### 3-4. WebSocket 핸드셰이크

브라우저 DevTools > Network > WS 필터로:
- `wss://api.popspot.co.kr/ws-stomp/info?t=...` 가 200 OK
- 이어서 `/ws-stomp/<server>/<session>/websocket` 이 101 Switching Protocols

403 이 떨어진다면:
- `APP_ALLOWED_ORIGINS` 에 도메인 누락
- nginx 의 `Upgrade` / `Connection` 헤더 누락 (deploy/nginx-popspot.conf 그대로 쓰면 OK)

### 3-5. JWT 통합 검증

```bash
# 1) 회원가입/로그인으로 토큰 획득
TOKEN=$(curl -s -X POST https://api.popspot.co.kr/api/v1/auth/login \
  -H "Origin: https://popspot.co.kr" -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' | jq -r .accessToken)

# 2) /me 호출
curl -s https://api.popspot.co.kr/api/v1/auth/me \
  -H "Origin: https://popspot.co.kr" \
  -H "Authorization: Bearer $TOKEN"
# → { "userId": "...", "nickname": "...", "role": "ROLE_USER", "isPremium": false }
```

---

## 4. 배포 후 자주 나는 오류 → 해결

| 증상 | 원인 | 1줄 처방 |
|---|---|---|
| 부팅 시 `JWT_SECRET 환경변수 누락/짧음` | env 미설정 | `openssl rand -base64 48` → `popspot.env` |
| `password authentication failed for user "popspot_user"` | DB 비번 불일치 | postgresql-setup.sh 비번과 env DB_PASSWORD 동일하게 |
| `Could not open JPA EM ... validate ... missing column` | 운영에서 validate 인데 스키마 안 만들어짐 | `JPA_DDL_AUTO=update` 로 1회 부팅 → 즉시 validate |
| 502 Bad Gateway | 백엔드 죽음 | `journalctl -u popspot -n 200` |
| Mixed Content 에러 (브라우저 콘솔) | 프론트가 http://136.115... 로 호출 | `NEXT_PUBLIC_API_URL=https://...` 로 갱신 + Vercel Redeploy |
| 결제 후 권한 안 붙음 | IAMPORT 키 미설정 | `IAMPORT_API_KEY` / `_SECRET` 채우고 restart |
| 로그인 5회 후 차단 | RateLimitInterceptor 정상 작동 | 1분 기다리거나 IP 변경 |
| `Connection refused 5432` (백엔드 부팅 시) | postgresql 미시작 | `sudo systemctl status postgresql` |
| Sentry 안 들어옴 | DSN 누락 또는 sample-rate 0 | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE=0.2` |
| WebSocket 핸드셰이크 200 인데 데이터 안 옴 | nginx Upgrade 헤더 누락 | `deploy/nginx-popspot.conf` 그대로 사용 |

---

## 5. 빌드 검증 (이 세션 sandbox 한계 안내)

이 sandbox 는 Java 11 만 있어 Java 21 toolchain 자동 빌드는 못 했습니다. 실제 빌드는 VM 에서:

```bash
cd /opt/popspot/source
./gradlew clean bootJar -x test
ls -la build/libs/*.jar
# popspot-backend-0.0.1-SNAPSHOT.jar 가 나와야 정상
```

빌드 실패 시 패턴 인식:
- `Could not resolve dependency com.bucket4j:bucket4j-core:8.10.1` → `mavenCentral()` 도달 못 함 (방화벽)
- `Source option X is no longer supported. Use Y` → JDK 21 미설치
- `Spring Boot 4.0.2 not found` → SB4 GA 미배포 시 `org.springframework.boot:3.4.x` 로 임시 다운그레이드

---

## 6. 즉시 조치되지 않은 항목 (의도적 보류)

- **테스트 코드** — 결제/인증/스탬프 단위 테스트는 별도 작업으로 권장
- **Caffeine 캐시** — getTrendingPopups 등 (Caffeine 의존성 추가 + `@Cacheable` 이면 끝)
- **`/api/**` 전역 permitAll** — 기존 동작 유지 위해 그대로. 민감 엔드포인트는 `@PreAuthorize` 로 메서드 단 보호 (OrderController 가 그 예시). 향후 점진적으로 명시적 인증 매처로 전환 권장.
- **회원 탈퇴 카스케이드** — 현재 정책 미정. 결정 후 `@OneToMany(cascade=...)` 또는 `@SQLDelete`.
- **CI/CD GitHub Actions** — 사용자 환경에 맞춰 별도 작성.

---

## 7. 한 줄 요약

> **"평문 시크릿/와일드카드 CORS/결제 우회/JWT 기본값 — 4대 즉시 위험은 모두 차단. 배포 직전 `/etc/popspot/popspot.env` 만 채우고 첫 부팅에 `update` 한 번 → 운영 `validate` 로 영구 전환하면 끝."**
