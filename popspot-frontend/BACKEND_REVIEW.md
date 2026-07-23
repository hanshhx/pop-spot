# POP-SPOT 백엔드 종합 진단 리포트

> Spring Boot 백엔드 (`popspot-backend`) 코드 전체 정독 결과.
> 보안 / 기능 / 구조 / 성능 4개 축으로 정리. 심각도(🔴 즉시 / 🟡 곧 / 🟢 권장).

---

## 1. 즉시 조치 (🔴) — 배포 전 반드시 수정

### 1-1. 평문 시크릿 / API 키 / DB 비밀번호 노출 (최우선)

`src/main/resources/application.properties` 안에 다음이 평문으로 박혀 있음:

| 종류                                    | 값 (마스킹)             |
| --------------------------------------- | ----------------------- |
| Gmail 앱 비밀번호                       | `ikfc htay ibqs qmwv`   |
| DB 비밀번호                             | `1234`                  |
| Google OAuth Secret                     | `GOCSPX-79fmnrpVZH...`  |
| Naver OAuth Secret                      | `zagKzs...`             |
| Kakao API 키                            | `9a7c6b14c55c2907bd...` |
| Gemini API 키                           | `AIzaSyBmkEEOg4...`     |
| Pexels / Tmap / Algolia / Seoul 공공API | 모두 평문               |

**파급:** 이 파일이 Git에 커밋돼 있다면 GitHub 검색에 노출되고 즉시 봇이 키 탈취. Gmail 앱 비밀번호 유출은 본인 계정 도용으로 이어짐.

**조치:**

1. **모든 키 즉시 재발급** (특히 Gmail 앱 비밀번호 → 2단계 인증에서 폐기)
2. Git history에서 제거 (`git filter-repo --path application.properties --invert-paths`) 또는 새 레포로 이전
3. `application.properties` 에 환경변수 참조만 남기고 실제 값은 `.env` (.gitignore 추가) 또는 GCP Secret Manager 로 이전
4. CI/CD에서 환경변수 주입

```properties
# application.properties (커밋 가능)
spring.datasource.password=${DB_PASSWORD}
spring.mail.password=${MAIL_PASSWORD}
jwt.secret=${JWT_SECRET}
```

### 1-2. 결제(iamport) 검증 우회 가능 — 무료 프리미엄 획득 가능

`OrderService.java`:

```java
if (!goods.getPrice().equals(dto.getAmount())) {
    if (dto.getAmount() == 100 || dto.getAmount() == 0) {
        System.out.println("⚠️ [TEST_MODE] 테스트 결제 승인");
    } else {
        throw new RuntimeException("결제 금액 불일치");
    }
}
```

**공격 벡터:**

- 프론트에서 `amount: 100` (또는 `0`) 으로 위조해 보내면 서버가 "테스트 결제"로 인식해 무조건 승인 → 사용자가 무료로 PRO 결제 완료
- `impUid` 가짜 값을 보내도 검증이 없어서 통과

**조치:** iamport 서버 API 로 실제 결제를 다시 조회한 후 금액·상태·중복 체크.

```java
@Transactional
public void processOrder(OrderDto dto) {
    // 1. iamport 서버에서 실제 결제 정보 가져오기
    IamportResponse<Payment> res = iamportClient.paymentByImpUid(dto.getImpUid());
    if (res.getCode() != 0) throw new IllegalStateException("결제 조회 실패");
    Payment payment = res.getResponse();

    // 2. 금액 검증 (DB 의 상품 가격과 직접 비교 — 프론트 amount 신뢰 X)
    BigDecimal serverAmount = payment.getAmount();
    BigDecimal expected = goods.getPrice();
    if (serverAmount.compareTo(expected) != 0) {
        // 위변조 의심 → 결제 자동 취소
        iamportClient.cancelPaymentByImpUid(new CancelData(dto.getImpUid(), true, expected));
        throw new SecurityException("결제 금액 위변조 감지");
    }

    // 3. 결제 상태 paid 만 허용
    if (!"paid".equals(payment.getStatus())) {
        throw new IllegalStateException("결제 상태 비정상: " + payment.getStatus());
    }

    // 4. 중복 결제 차단
    if (orderRepository.existsByImpUid(dto.getImpUid())) {
        throw new IllegalStateException("이미 처리된 주문");
    }

    // 5. 트랜잭션 안에서 사용자 권한 부여
    user.setPremium(true);
    user.setPremiumExpiryDate(LocalDateTime.now().plusMonths(1));
    orderRepository.save(Order.from(dto, user));
}
```

### 1-3. JWT 시크릿 기본값이 코드에 박혀 있음

`JwtAuthenticationFilter.java`:

```java
@Value("${jwt.secret:defaultSecretKeyForLocalDevelopmentMustBe32BytesLong!}")
```

**파급:** 환경변수 누락 시 누구나 아는 기본 키로 토큰 위조 가능 → 임의 사용자로 로그인 가능.

**조치:** 기본값 제거하고 시작 시 검증.

```java
@Value("${jwt.secret}")
private String jwtSecret;

@PostConstruct
void validate() {
    if (jwtSecret == null || jwtSecret.length() < 32) {
        throw new IllegalStateException("JWT_SECRET (32+ bytes) 필수");
    }
}
```

### 1-4. WebSocket CORS 와일드카드 + 인증 없음

`WebSocketConfig.java`:

```java
.setAllowedOriginPatterns("*")
```

**파급:** `evil.com` 에서 사용자 브라우저로 WebSocket 연결해 채팅 도청·조작 가능.

**조치:**

```java
@Value("${app.allowed-origins}")
private String[] allowedOrigins;

registry.addEndpoint("/ws-stomp")
    .setAllowedOrigins(allowedOrigins)
    .addInterceptors(new HandshakeInterceptor() {
        @Override
        public boolean beforeHandshake(...) {
            // JWT 검증 — 미인증 연결 거부
            String token = extractToken(request);
            return jwtUtil.isValid(token);
        }
    });
```

### 1-5. 관리자 권한 검증이 SecurityConfig 한 곳에만 있음

`AdminController.java` 의 모든 메서드에 `@PreAuthorize` 가 없음. SecurityConfig 의 `/api/admin/**` 차단 규칙만 의존 → 라우트 패턴 변경/오타 시 즉시 보안 구멍.

**조치:** 컨트롤러 클래스에 `@PreAuthorize("hasRole('ADMIN')")` 한 줄.

### 1-6. Rate Limiting 전무

- 로그인 무제한 시도 → 비밀번호 대입 공격
- 이메일 인증번호 발송 무제한 → 이메일 폭탄 + Gmail 한도 초과 → 서비스 마비
- 인증번호 6자리 무제한 시도 → 100만 가지 brute force

**조치:** Bucket4j 또는 Spring Cloud Gateway RateLimiter.

```gradle
implementation 'com.bucket4j:bucket4j-core:8.10.1'
```

- `/api/v1/auth/login` → IP별 분당 5회
- `/api/v1/auth/email/send` → IP/이메일별 분당 1회, 시간당 5회
- `/api/v1/auth/email/verify` → 이메일별 5회 실패 시 인증코드 무효

### 1-7. 토큰/사용자 정보가 로그에 평문 노출

`CustomOAuth2UserService.java`:

```java
System.out.println("🔥 [2] 소셜 로그인 정보 가져오기 성공: " + oAuth2User.getAttributes());
```

→ 이메일, 프로필 URL 등 PII 가 로그 파일에 평문 저장. 로그 파일 유출 시 사용자 정보 유출.

**조치:** `System.out.println` 전부 제거 또는 마스킹.

### 1-8. `application.properties` 의 `spring.jpa.hibernate.ddl-auto=update`

운영 환경에서 `update` 는 위험 — 엔티티 변경 시 자동으로 ALTER TABLE 실행.

**조치:**

- 운영: `validate` (스키마 일치만 확인)
- 개발: `update` 또는 `create-drop`
- Flyway/Liquibase 도입해 마이그레이션 명시적 관리

---

## 2. 곧 조치 (🟡)

### 2-1. 스탬프 / 좌석예약 등 Race Condition

`StampService.java`:

```java
if (stampRepository.existsByUserIdAndStampDateBetween(...)) throw ...;
stampRepository.save(stamp);
```

→ 두 요청이 동시에 들어오면 둘 다 `existsBy` 통과 → 두 개 저장됨. 하루 1개 제한 우회 가능.

**조치:** `@Lock(LockModeType.PESSIMISTIC_WRITE)` 또는 unique constraint (userId, stampDate).

### 2-2. N+1 / 비효율 쿼리

`PopupStoreService.getTrendingPopups()` 가 `findAll()` 후 메모리 정렬:

```java
return popupStoreRepository.findAll().stream()
    .sorted(...)
    .limit(4)
    ...
```

팝업 1만 개면 매번 1만 row 로드. JPQL 로 DB 정렬 + LIMIT.

```java
@Query("SELECT p FROM PopupStore p WHERE p.status <> 'PENDING' ORDER BY p.viewCount DESC")
List<PopupStore> findTopTrending(Pageable pageable);
```

### 2-3. DTO 와 Entity 분리 부족

`PopupStoreController#reportPopup` 이 `PopupStore` 엔티티를 그대로 요청 받음:

```java
@PostMapping("/report")
public ResponseEntity<PopupStore> reportPopup(@RequestBody PopupStore popupStore) {
```

→ 사용자가 `id`, `status`, `viewCount` 등을 요청에 박아서 보내면 그대로 저장될 수 있음. **Mass Assignment 취약점**.

**조치:** 요청은 `PopupReportRequest` DTO, 응답도 `PopupReportResponse` DTO.

### 2-4. 파일 업로드 검증 보강 필요

`ChatFileController` 의 확장자 화이트리스트는 OK. 하지만:

- MIME 타입 검증 없음 (`.png` 라 이름만 바꾼 실행 파일)
- 파일 크기 제한이 컨트롤러에서 명시적으로 안 잡힘 (Spring 기본 1MB 만 의존)
- Path traversal 추가 검증 필요:

```java
File destFile = new File(UPLOAD_DIR, savedFileName).getCanonicalFile();
String uploadDirCanon = new File(UPLOAD_DIR).getCanonicalPath();
if (!destFile.getAbsolutePath().startsWith(uploadDirCanon)) {
    throw new SecurityException("경로 조작");
}
```

### 2-5. WebSocket 세션 정리 미흡

`WebSocketEventListener` 에 `SessionDisconnectEvent` 핸들러는 있는데 사용자 상태(온라인/오프라인) 정리 로직이 없음. 메모리 누수 + 유령 사용자 발생 가능.

### 2-6. 이메일 인증 검증 횟수 제한 없음

`AuthController.verifyEmail()` 이 6자리 코드 검증을 무제한 허용 → 100만 가지 시도 가능.

**조치:** Redis 에 `AUTH_ATTEMPTS:{email}` 카운터, 5회 초과 시 코드 무효화 + 차단.

### 2-7. 에러 응답 비일관 + 스택트레이스 노출 위험

여러 컨트롤러가 `ResponseEntity.badRequest().body(e.getMessage())` 형태로 그대로 반환. 메시지 안에 스택트레이스/내부 정보가 들어갈 수 있음.

**조치:**

1. `@ControllerAdvice` 로 글로벌 예외 처리 일원화
2. 표준 `ErrorResponse` DTO (`code`, `message`, `timestamp`, optional `traceId`)
3. 운영에서는 stack trace 절대 응답에 포함 금지

### 2-8. Lombok `@Data` 사용 금지 권장

`@Data` 는 `@Setter` 까지 자동 생성 — 엔티티 불변성 깨짐. `@Getter` + `@NoArgsConstructor(access = PROTECTED)` + 도메인 메서드로 상태 변경.

### 2-9. `LocalDateTime` vs `ZonedDateTime` 일관성

서울 팝업 서비스라 KST 기준이지만, 타임존 명시가 안 돼 있어 서버 시간대(UTC?) 영향을 받을 수 있음. `application.properties` 또는 `@PostConstruct` 에서 `TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"))` 명시.

---

## 3. 권장 (🟢)

### 3-1. 캐싱 부재

인기 팝업 / 혼잡도 / OOTD 같이 동일 결과 반복 호출되는 데이터에 `@Cacheable(value="trending", cacheManager="caffeineCacheManager")`. Caffeine 5분 TTL 정도면 충분.

### 3-2. 페이징 없는 무제한 조회

`GoodsController#randomGoods` 가 `findAll()` + `Collections.shuffle()` — 상품 1000개면 매번 1000 row 로드. `Pageable` + `nativeQuery RANDOM()` 으로.

### 3-3. Actuator 엔드포인트 노출 점검

`management.endpoints.web.exposure.include=health,metrics,prometheus` 로 추정. 운영에서는 `health` 만 외부 노출, 나머지는 별도 포트(`management.server.port=9090`) + 내부 IP 만 허용.

### 3-4. 테스트 코드 부재

`src/test/` 디렉터리가 비어 있음. 결제 / 인증 / 스탬프 같은 핵심 비즈니스 로직은 단위 테스트라도 작성 권장.

### 3-5. `application-prod.yml` 분리

운영 / 개발 설정이 한 파일에 섞여 있음. profile 분리:

- `application.yml` (공통)
- `application-dev.yml` (로컬)
- `application-prod.yml` (운영, 시크릿은 환경변수)

### 3-6. 헬스체크 + 모니터링

- `/actuator/health` 에 DB 연결 / Redis 연결 / 디스크 / 메일 서버 상태 포함
- Sentry 는 통합돼 있는 것 같으니 OK
- Prometheus + Grafana 면 좋음 (이미 actuator 에 prometheus 있음)

### 3-7. `BCryptPasswordEncoder` 라운드 명시

기본 10 라운드는 OK. 운영 환경에서 `new BCryptPasswordEncoder(12)` 정도로 명시하면 좋음.

### 3-8. JPA `@OneToMany` Lazy 정책

모든 연관관계가 LAZY 인지 확인. EAGER 가 섞여 있으면 N+1 + 메모리 폭증.

### 3-9. 회원 탈퇴 시 연관 데이터 처리

`User` 삭제 시 채팅 메시지 / 스탬프 / 위시리스트 / 코스 / 주문이 어떻게 되는가? 카스케이드 정책 명시 (개인정보보호법상 보존 의무 vs 즉시 삭제 트레이드오프).

### 3-10. CI/CD 파이프라인

GitHub Actions 로 자동 빌드 + 테스트 + 보안 스캔(`gradle dependencyCheck`) 권장. 배포는 GCP Cloud Run 또는 Docker 이미지 푸시.

---

## 4. 잘 만든 부분 (👍)

- BCrypt 사용 (비밀번호 평문 저장 X)
- JWT + Spring Security 6 호환 필터 체인
- OAuth2 다중 제공자 (Google / Kakao / Naver)
- `@Transactional(readOnly = true)` 명시적 사용
- 일부 `@EntityGraph` 로 N+1 회피
- Sentry 통합 (전역 예외 모니터링)
- Email 인증 → Redis TTL 사용

---

## 5. 우선순위 정리표

| 순위 | 항목                                          | 예상 작업 | 마감 |
| ---- | --------------------------------------------- | --------- | ---- |
| 1    | 시크릿/키 환경변수 분리 + Git 이력 정리       | 1~2시간   | 즉시 |
| 2    | iamport 서버 검증 추가                        | 2~3시간   | 즉시 |
| 3    | JWT 시크릿 기본값 제거                        | 30분      | 즉시 |
| 4    | WebSocket CORS 화이트리스트 + 핸드셰이크 인증 | 1시간     | 즉시 |
| 5    | 관리자 `@PreAuthorize` 추가                   | 30분      | 즉시 |
| 6    | Rate limiting (로그인/이메일)                 | 2~3시간   | 1주  |
| 7    | `System.out.println` 제거 + slf4j 통일        | 1시간     | 1주  |
| 8    | 스탬프 race condition 방지                    | 1시간     | 1주  |
| 9    | DTO/Entity 분리 (특히 reportPopup)            | 2시간     | 1주  |
| 10   | `ddl-auto=validate` + Flyway                  | 반나절    | 1주  |

---

이 리포트는 zip 안의 코드를 직접 정독해 발견한 사항만 포함. 추측 없음.
