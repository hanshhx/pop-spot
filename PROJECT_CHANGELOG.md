# POP-SPOT 백엔드/프론트 변경 이력 + 트러블슈팅 일지

> 본 문서는 보안 감사 → GCP/Vercel 배포 → 자동수집(Tier 1) 시스템 구축까지의 모든 변경 사항을
> "**무엇이 취약했고 / 왜 바꿨고 / 어떻게 바꿨고 / 어디서 막혔고**" 4가지 관점으로 정리합니다.

---

## 목차

1. [백엔드 변경 사항 (17개 영역)](#1-백엔드-변경-사항)
2. [프론트엔드 변경 사항 (9개 영역)](#2-프론트엔드-변경-사항)
3. [운영 중 막혔던 부분 — 트러블슈팅 일지 (25건)](#3-운영-중-막혔던-부분--트러블슈팅-일지)
4. [최종 시스템 구조](#4-최종-시스템-구조)
5. [향후 권장 작업](#5-향후-권장-작업)

---

# 1. 백엔드 변경 사항

## 1.1 시크릿 환경변수 분리

### 변경 전 — 취약했던 점

```properties
# application.properties (기존)
spring.datasource.password=mysecretpw123
jwt.secret=hardcoded_jwt_secret_for_dev
spring.mail.password=ikfc htay ibqs qmwv
iamport.api-secret=PYbz...
```

- **하드코딩된 시크릿**이 그대로 git 에 커밋됨
- 누구나 깃허브 → 시크릿 → DB/메일/결제 시스템 침투 가능
- JWT 시크릿 노출 = 모든 사용자 토큰 위조 가능

### 왜 바꿨나

- OWASP Top 10 의 **A02 Cryptographic Failures** + **A07 Identification and Authentication Failures** 정면 위배
- GitHub 의 시크릿 스캐너가 자동으로 노출 알림 보냄 → 추후 어뷰즈 위험
- 12 Factor App 의 III. Config 원칙 준수 필요

### 어떻게 바꿨나

```properties
# application.properties (변경 후)
spring.datasource.password=${DB_PASSWORD:}
jwt.secret=${JWT_SECRET:}
spring.mail.password=${MAIL_PASSWORD:}
iamport.api-secret=${IAMPORT_API_SECRET:}
```

- 모든 시크릿을 `${ENV_VAR:기본값}` 패턴으로 변경
- 기본값을 비워두어 운영에서 누락 시 부팅 실패하도록
- `.env.example` 템플릿 작성 (실제 값 X, 자리만)
- `.gitignore` 에 `.env*` 추가 (단 `.env.example` 제외)
- 운영: VM 의 `/etc/popspot/popspot.env` 에서 systemd `EnvironmentFile=` 로 주입

### 검증

```bash
# 운영 VM 에서 환경변수 확인
sudo systemctl show popspot.service --property=Environment | grep -c 'JWT_SECRET'
```

---

## 1.2 JWT 시크릿 보호 + 부팅 시 검증

### 변경 전 — 취약했던 점

```java
// JwtAuthenticationFilter.java (기존)
@Value("${jwt.secret:default_secret}")  // 기본값 있음
private String jwtSecret;
```

- 환경변수 미설정 시 `default_secret` 사용 → 누구나 토큰 위조 가능
- HS256 은 32바이트 이상 키가 필요한데 검증 없음
- 짧은 시크릿 사용 시 brute-force 가능

### 왜 바꿨나

- HMAC-SHA256 의 보안 강도는 키 길이에 비례
- 약한 키로 발급된 토큰은 분 단위로 깨짐
- "안 막힌 default 값" 은 운영 사고의 단골 원인

### 어떻게 바꿨나

```java
@Value("${jwt.secret:}")  // 기본값 제거
private String jwtSecret;
private java.security.Key signingKey;

@PostConstruct
void validateSecret() {
    if (jwtSecret == null || jwtSecret.isBlank()) {
        throw new IllegalStateException(
            "❌ JWT_SECRET 환경변수 누락. 운영 환경에서는 32B+ 강한 시크릿 필요");
    }
    byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
    if (keyBytes.length < 32) {
        throw new IllegalStateException(
            "❌ JWT_SECRET 길이 부족 (현재 " + keyBytes.length + "B). " +
            "openssl rand -base64 48 으로 생성하세요");
    }
    this.signingKey = Keys.hmacShaKeyFor(keyBytes);
}
```

- `@PostConstruct` 로 부팅 시 즉시 검증
- 미설정 또는 32B 미만이면 부팅 차단 → 절대 약한 키로 운영 불가
- `OAuth2SuccessHandler` 도 동일 패턴 적용

### 검증

```bash
# 일부러 짧은 시크릿으로 부팅 시도
JWT_SECRET="short" java -jar popspot-backend.jar
# → IllegalStateException 발생 후 종료
```

---

## 1.3 CORS 화이트리스트 + 패턴 지원

### 변경 전 — 취약했던 점

```java
config.setAllowedOrigins(List.of("*"));  // 와일드카드
config.setAllowCredentials(true);        // + 자격증명
```

- 와일드카드 + credentials → 모든 도메인이 사용자 쿠키/JWT 로 API 호출 가능
- CSRF 우회 / 토큰 탈취 가능
- Vercel preview URL (`xxx-yyy.vercel.app`) 마다 도메인이 달라서 화이트리스트 곤란

### 왜 바꿨나

- CORS 와일드카드 + credentials 조합은 표준이 명시적으로 금지
- 환경변수로 도메인 관리 못 하면 배포 환경마다 다시 빌드해야 함

### 어떻게 바꿨나

```java
@Value("${app.allowed-origins:http://localhost:3000}")
private String allowedOriginsRaw;

@Bean
public CorsConfigurationSource corsConfigurationSource() {
    List<String> origins = parseOrigins(allowedOriginsRaw, frontendUrl);
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowCredentials(true);
    // setAllowedOriginPatterns: 패턴 매칭 (https://*.vercel.app 같은)
    // ⚠️ 절대 단독 "*" 만 두지 말 것
    config.setAllowedOriginPatterns(origins);
    config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS","PATCH","HEAD"));
    config.setAllowedHeaders(List.of(
        "Authorization","Content-Type","Accept","Origin",
        "X-Requested-With","Cache-Control","X-XSRF-TOKEN"));
    config.setExposedHeaders(List.of("Authorization","Content-Disposition"));
    config.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

- `setAllowedOriginPatterns` 사용 → 와일드카드 패턴 + credentials 호환
- 환경변수 `APP_ALLOWED_ORIGINS=https://popspot.co.kr,https://*.vercel.app` 로 주입
- `parseOrigins` 가 쉼표 분리 + 로컬 개발 자동 포함

### 검증

```bash
# preflight 시뮬레이션
curl -i -H "Origin: https://popspot.co.kr" -X OPTIONS https://popspot.duckdns.org/api/popups
# → Access-Control-Allow-Origin: https://popspot.co.kr 헤더 확인
```

---

## 1.4 AdminController 권한 추가

### 변경 전 — 취약했던 점

```java
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    @GetMapping("/popups/pending")
    public ResponseEntity<List<PopupStore>> getPendingPopups() {
        return ResponseEntity.ok(popupStoreRepository.findByStatus("PENDING"));
    }
    // ... approve, reject 도 마찬가지
}
```

- URL 패턴 매칭 (`SecurityConfig` 의 `requestMatchers("/api/admin/**").hasRole("ADMIN")`) 만 의존
- URL 패턴 변경/오타 시 즉시 권한 우회
- 컨트롤러 코드만 봐도 권한 모름

### 왜 바꿨나

- 보안은 다층 방어가 원칙 (Defense in Depth)
- URL 단 + 메서드 단 이중 검증 시 한쪽 실수해도 다른 쪽이 막아줌

### 어떻게 바꿨나

```java
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")  // ← 추가 (클래스 단)
public class AdminController { ... }
```

- 모든 메서드에 `@PreAuthorize("hasRole('ADMIN')")` 자동 적용
- `SecurityConfig` 에 `@EnableMethodSecurity(prePostEnabled = true)` 추가
- `PopupAdminReviewController`, `AdminMetricsController` 도 동일 적용

### 검증

```bash
# 일반 사용자 토큰으로 호출 → 403
curl -H "Authorization: Bearer $USER_TOKEN" https://popspot.duckdns.org/api/admin/popups/pending
```

---

## 1.5 Rate Limiting (Bucket4j)

### 변경 전 — 취약했던 점

- 로그인 / 이메일 인증 / 인증코드 검증에 횟수 제한 없음
- 무한 brute-force 공격 가능
- 이메일 폭탄 (한 명에게 1초에 100통 가능)

### 왜 바꿨나

- 한국 ISMS / GDPR 둘 다 무차별 인증 시도 차단 요구
- Gmail 계정 잠겨버리면 회원가입 자체 마비

### 어떻게 바꿨나

**1) 의존성 추가**
```gradle
implementation 'com.bucket4j:bucket4j-core:8.10.1'
```

**2) RateLimitInterceptor 신규 작성**

```java
public class RateLimitInterceptor implements HandlerInterceptor {
    // IP 별 토큰 버킷 캐시
    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> emailBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> verifyBuckets = new ConcurrentHashMap<>();
    
    private Bucket newLoginBucket() {
        return Bucket.builder()
            .addLimit(Bandwidth.simple(5, Duration.ofMinutes(1)))  // 5/분
            .build();
    }
    private Bucket newEmailBucket() {
        return Bucket.builder()
            .addLimit(Bandwidth.simple(5, Duration.ofHours(1)))   // 5/시간
            .build();
    }
    // ...
    
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        String ip = extractIp(req);
        String uri = req.getRequestURI();
        Bucket bucket = pickBucket(uri, ip);
        if (!bucket.tryConsume(1)) {
            res.setStatus(429);  // Too Many Requests
            res.getWriter().write("{\"error\":\"Rate limit exceeded\"}");
            return false;
        }
        return true;
    }
}
```

**3) WebConfig 에서 등록**

```java
registry.addInterceptor(rateLimitInterceptor)
        .addPathPatterns("/api/v1/auth/**");
```

### 검증

```bash
# 6번 연속 로그인 시도 → 6번째 429 응답
for i in {1..6}; do
  curl -X POST http://localhost:8080/api/v1/auth/login \
    -d '{"email":"x","password":"y"}' -H 'Content-Type: application/json' -w "\n%{http_code}\n"
done
```

---

## 1.6 PII 로그 제거 + SLF4J 전환

### 변경 전 — 취약했던 점

```java
// 여러 파일에서
System.out.println("로그인 요청: email=" + email + ", password=" + password);
System.out.println("OAuth2 user: " + oAuth2User.getAttributes());  // PII 덩어리
```

- 평문 비밀번호가 stdout 에 찍힘 → systemd journal 영구 보관
- PII (이메일/이름/전화번호) 가 로그에 노출
- 개인정보보호법 위반 가능

### 왜 바꿨나

- 한국 개인정보보호법 제29조 — 개인정보 처리시스템 접근기록 관리 의무
- 시크릿 / PII 가 로그에 남는 것은 명백한 노출

### 어떻게 바꿨나

```java
@Slf4j
public class JwtAuthenticationFilter ... {
    // 변경 전: log.info("Authorization 헤더: {}", bearerToken);
    // 변경 후:
    if (log.isDebugEnabled()) {
        log.debug("📡 [Filter] {} | Auth header present={}",
                  request.getRequestURI(), bearerToken != null);
    }
}
```

- `System.out.println` → `log.info/debug/warn` 으로 통일
- PII 자체는 로그에 안 찍고 "presence(있음/없음)" 만
- 운영 로그 레벨 INFO → debug 메시지 자동 무시

**적용 파일:**
- `JwtAuthenticationFilter.java`
- `OAuth2SuccessHandler.java`
- `CustomOAuth2UserService.java`
- `EmailService.java`

### 검증

```bash
# 운영 로그에 PII 없는지
grep -E "password|@.*\.com|01[0-9]{8,9}" /home/reo4321/nohup.out
# → 결과 없음
```

---

## 1.7 ddl-auto=validate + Flyway 마이그레이션

### 변경 전 — 취약했던 점

```properties
spring.jpa.hibernate.ddl-auto=update
```

- 운영 DB 스키마가 코드 변경에 따라 자동 변경됨
- 잘못된 엔티티 변경이 운영 데이터를 망가뜨릴 수 있음
- 테이블/컬럼 이름 오타가 prod 에서 데이터 손실로 직결

### 왜 바꿨나

- 운영 DB 변경은 의도적이고 추적 가능해야 함
- Hibernate `update` 는 컬럼 추가만 하고 삭제는 안 해서 스키마 부패 누적

### 어떻게 바꿨나

**1) build.gradle 의존성**
```gradle
implementation 'org.flywaydb:flyway-core'
implementation 'org.flywaydb:flyway-database-postgresql'
```

**2) application-prod.properties 분리**
```properties
spring.jpa.hibernate.ddl-auto=validate  # 운영: 검증만, 절대 변경 X
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true
```

**3) 마이그레이션 SQL 작성**
- `V1__baseline.sql` — 기존 스키마 베이스라인 (no-op)
- `V2__stamp_unique_constraint.sql` — Stamp Race Condition 방어
- `V3__sequences.sql` — `orders_seq`, `popup_store_seq`
- `V4__crawler_fields.sql` — 자동수집 11개 컬럼 (이번 작업)

### 검증

```bash
# Flyway 적용 이력
sudo -u postgres psql popspot_db -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"
```

---

## 1.8 iamport(PortOne) 결제 서버 검증

### 변경 전 — 취약했던 점

```java
// OrderService.java (기존)
public void completeOrder(OrderDto dto) {
    Order order = new Order();
    order.setUserId(dto.getUserId());  // ← 클라이언트가 보낸 그대로
    order.setAmount(dto.getAmount());   // ← 신뢰
    orderRepository.save(order);
}
```

- 클라이언트가 보내는 `userId/amount` 를 그대로 신뢰
- 다른 사용자 ID 박아넣어 결제 가능
- 1000원 결제하고 1억원 적립 가능 (변조)

### 왜 바꿨나

- PCI-DSS / 한국 전자결제 보안 표준 정면 위반
- 결제 검증은 반드시 서버 → PortOne API 직접 조회

### 어떻게 바꿨나

**IamportService 신규**
```java
@Service
public class IamportService {
    public Iamport.Payment findByImpUid(String impUid) {
        // POST /users/getToken → 액세스 토큰
        // GET /payments/{imp_uid} → 검증된 결제 정보
        ...
    }
    
    public void cancelPayment(String impUid, String reason) {
        // POST /payments/cancel
        ...
    }
}
```

**OrderService 검증 로직**
```java
@Transactional
public OrderResponse complete(OrderRequestDto dto, Authentication auth) {
    // 1. JWT 에서 userId 추출 (클라이언트 신뢰 X)
    String userId = auth.getName();
    
    // 2. 중복 검증
    if (orderRepository.existsByImpUid(dto.getImpUid())) {
        throw new IllegalStateException("이미 처리된 결제");
    }
    
    // 3. PortOne 서버에서 직접 조회
    Iamport.Payment payment = iamportService.findByImpUid(dto.getImpUid());
    
    // 4. 금액 일치 검증
    if (payment.getAmount() != dto.getExpectedAmount()) {
        iamportService.cancelPayment(dto.getImpUid(), "AMOUNT_MISMATCH");
        throw new IllegalStateException("금액 불일치 - 자동 환불됨");
    }
    
    // 5. 검증된 데이터로만 저장
    Order order = Order.builder()
        .userId(userId)
        .impUid(payment.getImpUid())
        .amount(payment.getAmount())
        .status("PAID")
        .build();
    return orderRepository.save(order);
}
```

### 검증

```bash
# 1) 정상 결제: PASS
# 2) 다른 사용자 ID 박아 보내기: 403 (auth 사용)
# 3) 가짜 imp_uid: PortOne 404 → 실패
# 4) 금액 변조: 자동 환불 + 실패
```

---

## 1.9 Stamp Race Condition + N+1 fix

### 변경 전 — 취약했던 점

```java
public void addStamp(Long userId, Long popupId) {
    // 동시 요청 2개 들어오면 둘 다 통과 → 중복 스탬프
    if (!stampRepository.existsByUserIdAndPopupId(userId, popupId)) {
        stampRepository.save(new Stamp(userId, popupId, today));
    }
}
```

- TOCTOU (Time-Of-Check Time-Of-Use) 경쟁 조건
- 따닥 클릭 / 봇으로 스탬프 다중 적립 가능
- + `findAll()` 호출 시 PopupImage 마다 추가 쿼리 (N+1)

### 왜 바꿨나

- 스탬프 시스템이 게임 보상의 핵심 → 중복 적립은 게임 밸런스 망가뜨림
- N+1 은 팝업 100개 + 이미지 평균 3개 = 401번 쿼리

### 어떻게 바꿨나

**1) DB 단 UNIQUE 제약**
```sql
-- V2__stamp_unique_constraint.sql
ALTER TABLE stamp ADD CONSTRAINT uk_stamp_user_popup
    UNIQUE (user_id, popup_id, stamp_date);
```

**2) 엔티티에 명시**
```java
@Entity
@Table(name = "stamp", uniqueConstraints = {
    @UniqueConstraint(name="uk_stamp_user_popup",
                      columnNames={"user_id","popup_id","stamp_date"})
})
public class Stamp { ... }
```

**3) N+1 fix — @EntityGraph**
```java
public interface StampRepository extends JpaRepository<Stamp, Long> {
    @EntityGraph(attributePaths = {"popupStore", "popupStore.images"})
    List<Stamp> findByUserId(Long userId);
}
```

### 검증

```bash
# 동시 요청 100개 → 단 1개만 성공
ab -n 100 -c 10 -p stamp.json -T application/json http://localhost:8080/api/stamps
# 결과: SQL 로 카운트 = 1
```

---

## 1.10 Mass Assignment 방어 (DTO 분리)

### 변경 전 — 취약했던 점

```java
@PostMapping("/report")
public PopupStore reportPopup(@RequestBody PopupStore popup) {
    return popupStoreRepository.save(popup);
    // ← 사용자가 status="ACTIVE", viewCount=999999, id=1 까지 박아 보낼 수 있음
}
```

- 엔티티를 직접 받아 모든 필드 변조 가능
- 사용자가 자기 popup 을 admin 승인 상태로 만들 수 있음

### 왜 바꿨나

- OWASP Mass Assignment 취약점 (CWE-915)

### 어떻게 바꿨나

```java
@Data
public class PopupReportRequestDto {
    @NotBlank @Size(max = 100)
    private String name;
    @NotBlank
    private String location;
    @NotBlank
    private String category;
    private String description;
    private String startDate;
    private String endDate;
    // status, viewCount, id 등은 정의하지 않음 → 프론트 데이터 X
}

@PostMapping("/report")
public ResponseEntity<Map<String,Object>> reportPopup(@Valid @RequestBody PopupReportRequestDto dto) {
    PopupStore popup = PopupStore.builder()
        .name(dto.getName())
        // ...
        .build();
    popup.setStatus("PENDING");  // 서버에서 강제
    popup.setViewCount(0);
    return ResponseEntity.ok(saved);
}
```

---

## 1.11 파일 업로드 검증

### 변경 전 — 취약했던 점

```java
@PostMapping("/upload")
public String upload(@RequestParam MultipartFile file) {
    Files.copy(file.getInputStream(), Paths.get("uploads/" + file.getOriginalFilename()));
    return file.getOriginalFilename();
}
```

- MIME 검증 없음 → `.exe` `.php` `.sh` 업로드 가능
- 경로 traversal: `../../../etc/passwd` 가능
- 사용자 입력 파일명 그대로 사용 → XSS / 경로 충돌

### 어떻게 바꿨나

```java
private static final Set<String> ALLOWED_MIME = Set.of(
    "image/jpeg", "image/png", "image/gif", "image/webp"
);
private static final long MAX_SIZE = 10 * 1024 * 1024;  // 10MB

public String upload(MultipartFile file) throws IOException {
    // 1. MIME 검증
    if (!ALLOWED_MIME.contains(file.getContentType())) {
        throw new IllegalArgumentException("지원되지 않는 파일 형식");
    }
    // 2. 사이즈 검증
    if (file.getSize() > MAX_SIZE) {
        throw new IllegalArgumentException("파일이 너무 큽니다 (10MB 이하)");
    }
    // 3. 파일명 UUID 로 강제 (XSS / 충돌 방어)
    String ext = StringUtils.getFilenameExtension(file.getOriginalFilename());
    String safeName = UUID.randomUUID() + "." + ext;
    
    // 4. canonical path 검증 (Path Traversal 방어)
    Path target = Paths.get(uploadPath, safeName).toAbsolutePath().normalize();
    Path uploadRoot = Paths.get(uploadPath).toAbsolutePath().normalize();
    if (!target.startsWith(uploadRoot)) {
        throw new SecurityException("Invalid path");
    }
    
    Files.copy(file.getInputStream(), target);
    return safeName;
}
```

---

## 1.12 글로벌 예외 처리 + 타임존

### 변경 전 — 취약했던 점

- 예외마다 다른 응답 포맷 (어떤 건 String, 어떤 건 JSON)
- 스택트레이스가 운영 응답에 노출 → 내부 구조 유출
- 서버 시간이 UTC → 한국 사용자에게 다른 시간 표시

### 어떻게 바꿨나

```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        return ResponseEntity.status(400).body(ErrorResponse.builder()
            .status(400).error("Bad Request")
            .message(e.getBindingResult().getAllErrors().get(0).getDefaultMessage())
            .timestamp(LocalDateTime.now()).build());
    }
    
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(403).body(...);
    }
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception e) {
        log.error("Unhandled exception", e);  // 서버 로그에만 스택
        return ResponseEntity.status(500).body(ErrorResponse.builder()
            .status(500).error("Internal Server Error")
            .message("일시적인 오류가 발생했습니다")  // 사용자에겐 일반 메시지
            .timestamp(LocalDateTime.now()).build());
    }
}
```

**타임존 강제**
```java
@SpringBootApplication
public class PopspotBackendApplication {
    @PostConstruct
    void setDefaultTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
    }
}
```

```properties
spring.jackson.time-zone=Asia/Seoul
```

---

## 1.13 BCrypt strength 12

### 변경 전 — 취약했던 점

```java
return new BCryptPasswordEncoder();  // 기본 strength 10
```

### 어떻게 바꿨나

```java
return new BCryptPasswordEncoder(12);  // 약 4배 느림 = brute-force 4배 어려움
```

---

## 1.14 자동수집 시스템 (Tier 1) — 메인 작업

### 변경 전 — 기능 자체 부재

- 모든 팝업 정보를 운영자가 수동 입력
- 지속 불가능 (운영자 1명이 매일 새 팝업 검색해서 입력)

### 왜 바꿨나

- 큐레이션 서비스의 본질은 정보 풍부함
- AI 시대에 자동화 없는 큐레이션은 경쟁력 없음

### 어떻게 바꿨나 — 합법 범위만 (Tier 1)

```
[수집 단계]
Naver 검색 API (블로그+뉴스) ─┐
Kakao 검색 API (웹+블로그)  ─┼─→ raw snippets
사용자 제보                  ─┘
                            ↓
[정규화 단계]
Gemini 가 snippets → 구조화 JSON + confidence 점수
                            ↓
[저장 단계]
SHA-256 dedup → 신뢰도 ≥ 0.8: 자동게시
                신뢰도 < 0.8: admin 검수 큐
                            ↓
[갱신 단계]
매일 04시 자동수집 / 매일 05시 만료처리
```

#### V4 마이그레이션 (popup_store 11컬럼 추가)

```sql
ALTER TABLE popup_store
    ADD COLUMN source_type VARCHAR(20) DEFAULT 'MANUAL',  -- MANUAL/CRAWLED
    ADD COLUMN source_url TEXT,                           -- 출처표시용 (저작권법)
    ADD COLUMN source_name VARCHAR(100),                  -- "네이버 블로그" 등
    ADD COLUMN external_id VARCHAR(64),                   -- SHA-256(name+loc+date)
    ADD COLUMN confidence_score DECIMAL(3,2),             -- Gemini 신뢰도
    ADD COLUMN crawled_at TIMESTAMP,
    ADD COLUMN last_seen_at TIMESTAMP,
    ADD COLUMN review_status VARCHAR(20),                 -- AUTO_PUBLISHED/PENDING_REVIEW/...
    ADD COLUMN takedown_requested_at TIMESTAMP,
    ADD COLUMN takedown_reason VARCHAR(500),
    ADD COLUMN takedown_requester VARCHAR(255);

CREATE UNIQUE INDEX uk_popup_store_external_id ON popup_store(external_id) WHERE external_id IS NOT NULL;
```

#### 핵심 클래스 8개 신규

| 클래스 | 책임 |
|---|---|
| `NaverPopupCrawler` | 네이버 검색 API 호출 (블로그/뉴스) |
| `KakaoPopupCrawler` | 카카오 검색 API 호출 (웹/블로그) |
| `PopupNormalizationService` | Gemini 로 snippet → 구조화 |
| `PopupCrawlOrchestrator` | 전체 파이프라인 + dedup + geocoding |
| `PopupCrawlScheduler` | `@Scheduled(cron="0 0 4 * * *")` |
| `PopupExpireScheduler` | `@Scheduled(cron="0 0 5 * * *")` |
| `PopupAdminReviewController` | 검수 큐 + 수동 트리거 + geocoding backfill |
| `PopupTakedownController` | 권리자 신고 24h SLA |

#### Gemini 프롬프트 핵심

```
출력 규칙:
1) 반드시 JSON 한 개. 마크다운/설명문 X
2) 필드:
   - name (필수): 명확하지 않으면 빈 문자열
   - location: 서울 외 confidence=0
   - category: FASHION/FOOD/CULTURE/CHARACTER/BEAUTY/TECH/ETC
   - startDate, endDate: ISO YYYY-MM-DD 또는 null
   - description: 50자 / content: 200자 (paraphrase, 원문 복사 금지)
   - confidence (0.0~1.0): name +0.3 / loc +0.2 / 날짜 +0.3 / 출처중복 +0.1 / 카테 +0.1
5) 개인정보 절대 포함 금지: 휴대폰/이메일/실명/닉네임
6) 검색 스니펫 그대로 베끼지 말고 너의 표현으로 요약
```

#### 정책 안전장치 (7대 영역)

| 영역 | 방어 |
|---|---|
| TOS | 공식 API 만, 본문 크롤링 X, User-Agent 명시, 800ms rate limit |
| 저작권 | source_url 저장, AI paraphrase, 이미지 직접 호스팅 X |
| 개인정보 | Gemini 프롬프트 PII 제외 |
| 정확성 면책 | 신뢰도 점수, 검수 큐, AI 뱃지, 약관 §10③ |
| Takedown | 24h SLA, 즉시 차단, 약관 §11 |
| 만료 | 매일 5시 EXPIRED |
| 약관 | /terms 페이지, Footer 링크, 가입 동의 |

---

## 1.15 Geocoding (지도 마커)

### 변경 전 — 취약했던 점

자동수집된 팝업이 지도에 표시 안 됨 (lat/lng = NULL).

### 어떻게 바꿨나

```java
// PopupCrawlOrchestrator
private String[] geocode(String name, String location) {
    // 1차: 이름 + 위치 (정확도 ↑)
    String[] r = tryGeocodeOnce((name + " " + location).trim());
    if (r != null) return r;
    
    // 2차 fallback: 위치만
    return tryGeocodeOnce(location);
}

private String[] tryGeocodeOnce(String query) {
    Map<String,Object> resp = kakaoApiService.searchPopups(query);
    // documents[0].x = longitude, documents[0].y = latitude
    return new String[]{ String.valueOf(first.get("y")), String.valueOf(first.get("x")) };
}
```

- 신규 수집 row 는 자동 좌표 채움
- 기존 row 는 `POST /api/admin/popups/crawl/geocode-missing` 으로 일괄 backfill

### 검증

```sql
SELECT 
  COUNT(*) FILTER (WHERE latitude IS NOT NULL) AS with_coords,
  COUNT(*) FILTER (WHERE latitude IS NULL) AS missing
FROM popup_store WHERE source_type='CRAWLED';
-- 17개 중 15개 좌표 채워짐
```

---

## 1.16 Admin Controller URL 분리 + AuthService JWT fix

### 변경 전 — 취약했던 점

**1) URL 충돌**

```java
// 기존 AdminController
@GetMapping("/popups/pending")  // /api/admin/popups/pending
// 신규 PopupAdminReviewController
@GetMapping("/pending")          // /api/admin/popups/pending (충돌!)
```

→ Spring 부팅 시 `Ambiguous mapping` 에러로 백엔드 죽음.

**2) 로컬 로그인 토큰이 가짜**

```java
// AuthService.login() 기존
return LoginResponseDto.builder()
    .token("TEMP_TOKEN_" + user.getUserId())  // 진짜 JWT 가 아님!
    .build();
```

OAuth 로그인은 진짜 JWT 발급되는데 로컬 로그인만 placeholder. → admin API 호출 불가.

### 어떻게 바꿨나

**1) URL prefix 분리**
```java
@RequestMapping("/api/admin/popups/crawl")  // ← /crawl prefix 추가
public class PopupAdminReviewController {
    @GetMapping("/pending")  // /api/admin/popups/crawl/pending
    @PostMapping("/{id}/approve")
    @PostMapping("/run")
    @PostMapping("/geocode-missing")
}
```

**2) AuthService 진짜 JWT**

```java
@Value("${jwt.secret:}")
private String jwtSecret;

@PostConstruct
void initJwtKey() {
    // ... 32B+ 검증
    this.signingKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
}

private String issueJwt(User user) {
    return Jwts.builder()
        .setSubject(user.getUserId())
        .claim("role", user.getRole())
        .setIssuedAt(new Date())
        .setExpiration(new Date(System.currentTimeMillis() + accessTokenValidityMs))
        .signWith(signingKey, SignatureAlgorithm.HS256)
        .compact();
}

// login() 에서:
.token(issueJwt(user))  // ← TEMP_TOKEN 대신
```

---

## 1.17 Gemini → Groq LLM 마이그레이션

### 변경 전 — 취약했던 점

```java
// AiConfig.java (기존)
return GoogleAiGeminiChatModel.builder()
    .apiKey(apiKey)
    .modelName("gemini-2.0-flash")
    .build();
```

```properties
# application.properties
langchain4j.google-ai-gemini.chat-model.api-key=${GEMINI_API_KEY:}
langchain4j.google-ai-gemini.chat-model.model-name=${GEMINI_MODEL_NAME:gemini-2.0-flash}
```

- **Gemini Free 한도**: RPM 10, RPD 1500 — 자동수집(60키워드) + 코스추천 동시 사용 시 부족
- **API 키 노출 시 자동 차단**: Google secret scanner 가 채팅/git 노출된 키를 발견하면 quota 를 0 으로 강제 변경 → 같은 프로젝트의 모든 키가 묶여서 죽음
- **재발급 무한루프**: 같은 프로젝트에 새 키 발급해도 quota 0 그대로

### 왜 바꿨나

- Gemini 키가 채팅 노출 후 Google scanner 에 의해 무력화됨 (`limit: 0`)
- 같은 프로젝트에 새 키 발급해도 0 → 운영 중단 사태
- Groq 무료 한도가 압도적으로 큼 (14,400 req/day = Gemini Free 의 ~720배)
- Groq 는 OpenAI 호환 API → LangChain4j `langchain4j-open-ai` 모듈 그대로 활용 가능
- 자동수집 + 코스추천 둘 다 한 키로 여유롭게 운영 가능

### 어떻게 바꿨나

**1) 의존성 교체** (`build.gradle`)
```gradle
// 제거
// implementation 'dev.langchain4j:langchain4j-google-ai-gemini:0.36.0'

// 추가
implementation 'dev.langchain4j:langchain4j-open-ai:0.36.0'
```

**2) AiConfig.java 재작성**
```java
@Configuration
public class AiConfig {
    @Value("${groq.api-key}")
    private String apiKey;

    @Value("${groq.model-name:llama-3.3-70b-versatile}")
    private String modelName;

    @Value("${groq.base-url:https://api.groq.com/openai/v1}")
    private String baseUrl;

    @Bean
    @Primary
    public ChatLanguageModel chatLanguageModel() {
        return OpenAiChatModel.builder()
            .baseUrl(baseUrl)        // ← Groq 엔드포인트
            .apiKey(apiKey)
            .modelName(modelName)
            .temperature(0.7)
            .timeout(Duration.ofSeconds(60))
            .build();
    }
}
```

**3) application.properties 갱신**
```properties
# 12. AI (Groq — OpenAI 호환 API)
groq.api-key=${GROQ_API_KEY:}
groq.model-name=${GROQ_MODEL_NAME:llama-3.3-70b-versatile}
groq.base-url=${GROQ_BASE_URL:https://api.groq.com/openai/v1}
```

**4) 자동수집 호출 간격 단축** (`PopupCrawlOrchestrator.java`)
```java
// Before — Gemini RPM 10 회피용 6.5초
sleepQuietly(6500);

// After — Groq RPM 30 활용
sleepQuietly(2200);
```

→ 60키워드 풀크롤 시간 **13분 → 약 5분** (~62% 단축)

**5) `.env.example` 갱신**
```bash
# 제거: GEMINI_API_KEY, GEMINI_MODEL_NAME
# 추가:
GROQ_API_KEY=
GROQ_MODEL_NAME=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

**6) AiCourseService / PopupNormalizationService — 코드 변경 없음**
두 서비스 모두 `ChatLanguageModel` 인터페이스에만 의존 → Spring DI 가 자동으로 새 빈 주입.

### 검증

```bash
# Groq 직접 호출
curl -X POST "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"hi"}]}'
# → {"choices":[{"message":{"content":"Hi there!..."}}]}

# 백엔드 통한 코스 추천
curl -G "https://popspot.duckdns.org/api/courses/recommend" \
  --data-urlencode "vibe=데이트"
# → 5개 추천 popup + 좌표 + 카테고리 + 추천이유
```

| 지표 | Gemini Free | Groq Free |
|---|---|---|
| 일일 한도 | 0 (차단됨) | 14,400 req |
| 분당 한도 | RPM 10 | RPM 30 |
| 응답 속도 | 2~5초 | ~50ms |
| 비용 | $0 | $0 |
| 모델 | gemini-2.0-flash | llama-3.3-70b-versatile |

---

# 2. 프론트엔드 변경 사항

## 2.1 환경변수 분리

### 변경 전

```typescript
const API_URL = "http://localhost:8080";  // 하드코딩
```

### 어떻게 바꿨나

```typescript
// src/lib/api.ts
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
export const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_URL 
                            || process.env.NEXT_PUBLIC_API_URL 
                            || "http://localhost:8080";
```

- `.env.example` 신규 (Vercel 템플릿)
- Vercel 대시보드에 `NEXT_PUBLIC_API_URL=https://popspot.duckdns.org` 등록

---

## 2.2 SOCKET_BASE_URL fallback 체인

WebSocket 따로 도메인 쓸 수 있게 fallback:
```
NEXT_PUBLIC_SOCKET_URL → NEXT_PUBLIC_API_URL → localhost
```

---

## 2.3 V4 자동수집 통합

### 변경 전

```typescript
interface PopupStore {
    id: number;
    name: string;
    location: string;
    // ... 기본 필드만
}
```

### 어떻게 바꿨나

```typescript
// src/types/popup.ts
export interface PopupStore {
    // 기존 필드들 ...
    sourceType?: "MANUAL" | "CRAWLED" | "USER_REPORT";
    sourceUrl?: string;
    sourceName?: string;
    reviewStatus?: "AUTO_PUBLISHED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "TAKEDOWN";
    confidenceScore?: number;
}

export interface CalendarPopup {
    id: number; name: string; location: string;
    startDate?: string; endDate?: string;
    sourceType?: "MANUAL" | "CRAWLED" | "USER_REPORT";
    sourceUrl?: string;
}
```

**팝업 상세페이지** (`app/popup/[id]/page.tsx`)
- 자동수집 정보 박스 추가 — "AI 가 정리한 정보" + 출처 링크
- 신고 버튼 추가 (모든 row 에서)
- TakedownModal 마운트

**캘린더 모달** (`PopupCalendarModal.tsx`)
- `sourceType === "CRAWLED"` 일 때 "AI" 뱃지 표시

**TakedownModal** (신규)
- 신고자 이메일, 신고 사유 4종, 상세 내용
- 허위신고 손해배상 경고
- POST /api/popups/{id}/takedown

---

## 2.4 /terms 페이지 신규

자동수집 운영 위한 약관 페이지:
- §10 — 팝업스토어 정보의 출처 및 자동수집
- §11 — 권리자 정보 삭제 요청 (Takedown)
- §12 — 정보의 보존
- §13 — 개인정보의 수집·이용 (4가지 항목 명시)

---

## 2.5 Footer 업데이트

### 변경 전

```typescript
const PLATFORM_LINKS = [
    { label: "지도 보기", href: "/" },
    { label: "팝업 캘린더", href: "/" },
    // 약관 링크 없음
];
```

### 어떻게 바꿨나

- "이용약관" 링크 추가 → `/terms`
- 면책 조항 — "검색 API 자동수집" + "24h 내 조치" 명시
- 신고 이메일 + 가시성 강화

---

## 2.6 회원가입 약관 링크

### 변경 전 — 약관 동의 체크박스만 있고 본문 링크 없음

```tsx
<input type="checkbox" />
<span>[필수] POP-SPOT 서비스 이용약관</span>
```

→ 사용자가 약관 못 읽고 동의 → 법적 동의 효력 약함.

### 어떻게 바꿨나

```tsx
<div className="flex items-center justify-between">
    <label>
        <input type="checkbox" ... />
        <span>[필수] POP-SPOT 서비스 이용약관</span>
    </label>
    <Link href="/terms" target="_blank" rel="noopener noreferrer">
        보기 ↗
    </Link>
</div>
```

→ "동의 전 열람 가능" 법적 요건 충족.

---

## 2.7 인트로(커버) 페이지 신규 — 풀스크린 스크롤 스냅 + 영상 배경

### 변경 전 — 부족했던 점

- 사용자가 사이트 처음 들어오면 **곧장 메인페이지** (지도/팝업 리스트) 표시
- 브랜드 인지/정체성 전달 부족, 어디서 본 듯한 사이트 느낌
- "POP-SPOT 이 뭐 하는 곳?" 한눈에 안 들어옴

### 왜 바꿨나

- 첫 방문 임팩트가 결정적인 컨버전 요소
- 기능 나열보다 **임팩트 + 차별점 + CTA** 의 페이지가 신뢰감 높임
- 비로그인 사용자에게도 가치 제안 후 가입 유도 가능

### 어떻게 바꿨나

**1) `/intro` 라우트 신규** (`app/intro/page.tsx`)

5섹션 풀스크린 스냅 스크롤 구조:

| # | 섹션 | 무드 | 콘텐츠 |
|---|---|---|---|
| 1 | Hero | 영상 + 다크 그라데이션 | 로고/슬로건/3아이콘/CTA |
| 2 | Why POP-SPOT | 라임 후광 | "더 이상 놓치지 마세요" + 통계 3개 (60+/1~2/24h) |
| 3 | Core Features | 글래스모피즘 | 캘린더/지도/랭킹 카드 |
| 4 | Only on POP-SPOT | 보라/핫 후광 | AI코스/친구동선/스탬프/혼잡도 (2x2) |
| 5 | Final CTA | 핫핑크 틴트 | 큰 로그인/회원가입 버튼 |

**핵심 CSS — 스크롤 스냅:**
```tsx
<div style={{
  scrollSnapType: "y mandatory",
  scrollBehavior: "smooth",
  WebkitOverflowScrolling: "touch",  // iOS momentum
}}>
  <section style={{ scrollSnapAlign: "start" }}>...</section>
  ...
</div>
```

**핵심 — 영상 영구 재생** (모든 섹션에서 계속):
```tsx
{/* 페이지 전체 fixed 비디오 — z-0 */}
<div className="fixed inset-0 z-0 bg-ink-900">
  <video autoPlay loop muted playsInline>
    <source src="/14385-256955049.mp4" type="video/mp4" />
  </video>
</div>

{/* 스크롤 컨테이너 — z-10 */}
<div className="relative z-10 h-screen overflow-y-scroll snap-mandatory">
  ...섹션들 (각 섹션은 반투명 오버레이)
</div>
```

**섹션 진입 애니메이션 (framer-motion):**
```tsx
<motion.div
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: false, amount: 0.4 }}  // 다시 스크롤하면 재생
  transition={{ duration: 0.7 }}
>
```

**2) middleware.ts 신규** — `/` 진입 시 `/intro` 로 강제 리다이렉트
```typescript
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/") {
    if (searchParams.get("entered") !== "1") {
      const url = request.nextUrl.clone();
      url.pathname = "/intro";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ["/"] };
```

→ 사용자가 `popspot.com` 만 쳐도 항상 인트로 → ENTER 클릭 시 `/?entered=1` 으로 메인.

**3) 로그인 상태 인지 CTA**
```tsx
const proceed = () => {
  if (isLoggedIn) router.push("/?entered=1");
  else router.push("/login");
};
```
- 비로그인: "로그인하러 가기" + 🔑 아이콘
- 로그인: "ENTER" + → 화살표

### 검증

```bash
# 비로그인 상태로 / 접속 → /intro 리다이렉트 → ENTER → /login → 로그인 → /?entered=1 → 메인
# 로그인 상태로 / 접속 → /intro 리다이렉트 → ENTER → /?entered=1 → 메인
```

---

## 2.8 AuthGuard 공개 경로에 /intro 추가

### 변경 전 — 인트로가 안 보이는 버그

```typescript
// AuthGuard.tsx (기존)
const PUBLIC_PATHS = ["/login", "/signup", "/", "/find-account", "/oauth/callback"];
```

→ 비로그인 사용자가 `/intro` 접근 시 AuthGuard 가 `/login` 으로 강제 이동 = **인트로 페이지 자체를 못 봄**.

### 어떻게 바꿨나

```typescript
const PUBLIC_PATHS = ["/intro", "/login", "/signup", "/", "/find-account", "/oauth/callback"];
```

추가로 로그인/OAuth 성공 후 `/?entered=1` 로 보내서 **로그인 직후 인트로 재표시 방지**:

```typescript
// app/login/page.tsx
router.push("/?entered=1");  // 기존: router.push("/")

// app/oauth/callback/page.tsx
window.location.href = "/?entered=1";
```

→ 비로그인 → 인트로 → 로그인 → 메인 직행 (인트로 두 번 안 봄).

---

## 2.9 SearchBox — Algolia 잘못된 키 안전 fallback

### 변경 전 — 콘솔 에러 폭발

```typescript
const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!
);
```

→ 잘못된 App ID (`imp68206770` 등 만료/오타) 시 매 페이지 로드마다:
```
imp68206770-1.algolianet.com  ERR_NAME_NOT_RESOLVED
imp68206770-2.algolianet.com  ERR_NAME_NOT_RESOLVED
imp68206770-3.algolianet.com  ERR_NAME_NOT_RESOLVED
RetryError: Unreachable hosts...
```

### 어떻게 바꿨나

```typescript
const isAlgoliaConfigured =
  !!ALGOLIA_APP_ID &&
  !!ALGOLIA_SEARCH_KEY &&
  ALGOLIA_APP_ID.length >= 6 &&
  /^[A-Z0-9]+$/.test(ALGOLIA_APP_ID);  // 정식 형식만 통과

const searchClient = isAlgoliaConfigured
  ? algoliasearch(ALGOLIA_APP_ID!, ALGOLIA_SEARCH_KEY!)
  : null;

export function SearchZone() {
  if (!searchClient) return <SearchZoneFallback />;  // 비활성 입력창 + "준비 중"
  return <InstantSearch ...>...</InstantSearch>;
}
```

→ 키가 비어있거나 형식 안 맞으면 **외부 호출 자체 차단**, 콘솔 깨끗.

---

# 3. 운영 중 막혔던 부분 — 트러블슈팅 일지

## 3.1 OneDrive 빌드 락

**증상:**
```
> Task :processResources FAILED
Failed to clean up stale outputs
```

**원인:** OneDrive 가 build/ 폴더 파일 동기화 중에 잠금 → Gradle 이 청소 못함.

**해결:** 프로젝트를 `Documents/popspot2` 로 이동. OneDrive 영향권 밖.

---

## 3.2 YouTubeService 클래스 누락

**증상:** 빌드 시 `cannot find symbol: class YouTubeService`

**원인:** `PopupStoreController` 가 import 하는데 클래스 파일 없음.

**해결:** `controller/YouTubeService.java` 신규 — Optional API key, 키 없으면 null 반환.

---

## 3.3 PopupStore.imageUrl() builder 에러

**증상:** `cannot find method imageUrl(String)` on `PopupStore.PopupStoreBuilder`.

**원인:** `imageUrl` 은 필드가 아니라 `images` 리스트에서 계산되는 getter (`getImageUrl()`).

**해결:** `.imageUrl(...)` 빌더 호출 제거. 이미지 URL 은 `description` 끝에 메모로 남기거나, 정식 등록은 admin 이 PopupImage 엔티티 추가.

---

## 3.4 UriComponentsBuilder.fromHttpUrl 제거됨

**증상:** Spring 6.2+ 에서 `fromHttpUrl()` deprecated.

**해결:**
```java
// 변경 전
UriComponentsBuilder.fromHttpUrl(endpoint)
// 변경 후
UriComponentsBuilder.fromUriString(endpoint)
```

---

## 3.5 LF→CRLF 경고

**증상:** `git add .` 시 수십 줄 `warning: LF will be replaced by CRLF`.

**원인:** Windows 의 정상 동작. Git 이 자동 줄바꿈 변환.

**해결:** 그냥 무시. 기능에 영향 없음.

---

## 3.6 502 Bad Gateway (백엔드 부팅 시간)

**증상:** 재시작 후 30초 동안 502.

**원인:** Spring Boot 부팅 88초 (Redis 헬스체크 등 포함).

**해결:** 부팅 끝날 때까지 대기. 또는 `MANAGEMENT_HEALTH_REDIS_ENABLED=false` 로 단축.

---

## 3.7 도메인 잘못 알기

**증상:** `api.popspot.co.kr` 로 호출해도 응답 없음.

**원인:** `popspot.co.kr` 은 Vercel 프론트, 백엔드는 `popspot.duckdns.org`.

**해결:** API 도메인을 `popspot.duckdns.org` 로 통일.

---

## 3.8 JWT SignatureException

**증상:** 모든 API 가 401, 로그에 `JWT signature does not match`.

**원인:** 옛 JWT 시크릿으로 발급된 토큰 + 새 시크릿. localStorage 에 옛 토큰 살아있음.

**해결:** 브라우저 콘솔에서 `localStorage.clear()` → 재로그인.

---

## 3.9 Firebase 의문

**증상:** `Firebase appId missing` 에러.

**원인:** 사용자가 한때 Firebase 시도했다가 환경변수 안 채움.

**해결:** Firebase 안 쓰기로 결정 → `npm uninstall firebase` + config.ts 삭제.

---

## 3.10 CORS preview URL 차단

**증상:** Vercel preview URL 에서 API 호출 → CORS 차단.

**원인:** `setAllowedOrigins` 는 정확 도메인만 매칭. Vercel preview 는 `https://popspot-pr-12-yyy.vercel.app` 처럼 매번 다름.

**해결:**
```java
config.setAllowedOriginPatterns(origins);  // 패턴 매칭
// origins 에 "https://*.vercel.app" 추가
```

---

## 3.11 LazyInit 스탬프

**증상:** 마이페이지 → 스탬프 목록 → `LazyInitializationException`.

**원인:** `StampRepository` 의 `@EntityGraph` 가 `popupStore` 만 fetch, `popupStore.images` 는 lazy.

**해결:**
```java
@EntityGraph(attributePaths = {"popupStore", "popupStore.images"})
```

WishlistRepository 도 동일 적용.

---

## 3.12 PortOne 키 발급 + 채널 등록

**증상:** 결제 페이지에서 `등록된 PG 설정 정보가 없습니다`.

**원인:** PortOne 콘솔에서 `imp04604457` merchant 에 kakaopay 채널 미등록.

**해결:**
- 사용자가 직접 PortOne 콘솔 → 결제연동 → 채널관리 → kakaopay 추가
- 테스트 모드 + 기본 CID `TC0ONETIME`

---

## 3.13 Ambiguous mapping (백엔드 부팅 실패)

**증상:**
```
Cannot map 'popupAdminReviewController' method to {GET [/api/admin/popups/pending]}: 
There is already 'adminController' bean method ... mapped.
```

**원인:** 기존 `AdminController.getPendingPopups()` 와 신규 `PopupAdminReviewController.pending()` URL 충돌.

**해결:** 신규 컨트롤러를 `/api/admin/popups/crawl` prefix 로 분리.

---

## 3.14 TEMP_TOKEN 발견

**증상:** 로컬 로그인 후 admin API 호출 시 401.

**원인:** `AuthService.login()` 이 `"TEMP_TOKEN_" + userId` 반환 — 진짜 JWT 아님.

**해결:** `OAuth2SuccessHandler` 와 동일한 JWT 발급 로직을 `AuthService` 에 이식.

---

## 3.15 nginx 504 timeout

**증상:** 자동수집 트리거 60초 후 504.

**원인:** 60 키워드 처리 시간 (5~8분) > nginx `proxy_read_timeout` 기본 60초.

**해결:** VM 안에서 `localhost:8080` 으로 직접 호출 → nginx 우회.

---

## 3.16 sleep 90 무한로딩 오해

**증상:** `sleep 90` 명령 후 화면 멈춤.

**원인:** `sleep 90` 은 정확히 90초 동안 블록. 무한로딩 아님.

**해결:** 그냥 기다림. 또는 다음 권장:
```bash
until grep -q "Started PopspotBackendApplication" nohup.out; do
  sleep 10
done
```

---

## 3.17 location 컬럼명 불일치

**증상:** `psql -c "SELECT location FROM popup_store"` → `column "location" does not exist`.

**원인:** Java 필드는 `location` 인데 DB 컬럼명은 `address`.

```java
@Column(name = "address")  // ← DB 는 address
private String location;   // ← Java 는 location
```

**해결:** raw SQL 에서는 `address` 사용.

---

## 3.18 Java 패턴 매칭 스코프 에러

**증상:**
```
error: cannot find symbol: variable documents
```

**원인:**
```java
if (!(docsRaw instanceof List<?> documents) || documents.isEmpty()) {
    documents = docs2;  // ← 여기서 documents scope 밖
}
```

Java 패턴 변수는 negation 시 if 블록 안에서 안 보임.

**해결:** 메서드 두 개로 분리 (`geocode()` + `tryGeocodeOnce()`).

---

## 3.19 Gradle 파일 락 (Windows)

**증상:** 빌드 실패 — `Failed to clean up stale outputs`.

**원인:** 이전 java 프로세스 / IDE / 안티바이러스가 build/ 폴더 잠금.

**해결:**
```powershell
.\gradlew --stop
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
.\gradlew build -x test
```

---

## 3.20 비밀번호 placeholder 그대로 입력

**증상:** 로그인 응답이 `null`.

**원인:** `password":"실제_비번"` 그대로 보냄. placeholder 안 바꿈.

**해결:** 진짜 비밀번호로 교체. 특수문자 있을 때:
```bash
PASSWORD='power147878#'
LOGIN_JSON="{\"email\":\"...\",\"password\":\"$PASSWORD\"}"
```

작은따옴표로 감싸서 bash 가 `#` 같은 특수문자 해석 안 하게.

---

## 3.21 package-lock (1).json 백업 파일

**증상:** git add 후 9214줄 짜리 이상한 파일이 staged.

**원인:** 다운로드 폴더 등에서 들어온 백업 파일 (`(1)` 접미사).

**해결:**
```bash
git reset HEAD "popspot-frontend/package-lock (1).json"
Remove-Item "popspot-frontend\package-lock (1).json" -Force
```

---

## 3.22 application-prod.properties 외부 파일 우선순위 함정

**증상:** popspot.env 의 `GEMINI_API_KEY` 를 새 키로 바꾸고 백엔드 재시작했는데도 옛날 키로 호출되어 `limit: 0` 반복.

**원인:** Spring Boot 가 `cd ~` 후 실행되면 **현재 디렉토리** 의 `application-prod.properties` 를 자동 로드하는데, `/home/reo4321/application-prod.properties` 에 옛날 키가 평문으로 박혀있었음.

```
JAR 안 application-prod.properties:
  api-key=${GEMINI_API_KEY:}     ← 환경변수 참조 (정상)

/home/reo4321/application-prod.properties (Feb 19, 외부 파일):
  api-key=AIzaSy(옛날키 평문)    ← 환경변수보다 우선 적용 (범인)
```

→ 환경변수 새 키 적용을 외부 파일이 덮어씀.

**해결:**
```bash
nano /home/reo4321/application-prod.properties
# 평문 키 라인 → ${GEMINI_API_KEY:} 로 교체
```

→ Spring Boot 가 환경변수에서 키 읽도록 통일.

**교훈:** 외부 properties 에 시크릿 평문 박지 말 것. 무조건 `${ENV_VAR:}` 참조 사용.

---

## 3.23 Gemini API 키 노출 → Google 자동 차단

**증상:** Gemini 키를 채팅창에 붙여넣어 디버깅 후, 새 키 발급받아도 모두 `RESOURCE_EXHAUSTED, limit: 0`.

**원인:** Google Cloud 의 secret scanner 가 **노출된 키를 자동 감지** → 그 키가 속한 **프로젝트 전체의 quota 를 0 으로 강제 변경**. 같은 프로젝트에 새 키 발급해도 quota 0 그대로 유지.

```json
{
  "violations": [{
    "quotaMetric": "...generate_content_free_tier_requests",
    "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
    "limit": 0
  }]
}
```

`limit: 0` 은 일일 한도 초과가 아니라 **프로젝트 차단** 신호.

**해결:**
1. https://console.cloud.google.com 에서 **새 프로젝트** 생성
2. 새 프로젝트에서 Generative Language API 활성화
3. AI Studio 에서 **그 새 프로젝트 선택** 후 키 발급
4. 또는 → **Groq 으로 마이그레이션** (1.17 참조, 결국 이 길로 감)

**교훈:**
- 키는 **절대 채팅/git 에 붙이지 말 것** (앞 5자리만 공유 OK)
- AI Studio 의 "Create API Key" 디폴트가 옛날 프로젝트 → 새 프로젝트 선택 의식적으로
- 같은 사고 반복 방지 위해 Groq 같은 다중 벤더 옵션 확보

---

## 3.24 Algolia 잘못된 App ID 콘솔 스팸

**증상:** 메인페이지 진입 시 콘솔에 빨간 에러 폭발.
```
imp68206770-1.algolianet.com  ERR_NAME_NOT_RESOLVED
imp68206770-2.algolianet.com  ERR_NAME_NOT_RESOLVED
imp68206770-3.algolianet.com  ERR_NAME_NOT_RESOLVED
RetryError: Unreachable hosts - your application id may be incorrect
```

**원인:** `.env.local` 또는 Vercel env 의 `NEXT_PUBLIC_ALGOLIA_APP_ID` 가 만료/오타 (`imp68206770` 같은 데모 ID). Algolia 가 호스트명을 `<APP_ID>-X.algolianet.com` 으로 만드는데, 존재하지 않는 ID 라 DNS 실패.

**해결:** SearchBox.tsx 에 형식 검증 + fallback (2.9 참조).

```typescript
const isAlgoliaConfigured = !!APP_ID && /^[A-Z0-9]+$/.test(APP_ID);
const searchClient = isAlgoliaConfigured ? algoliasearch(...) : null;
```

→ 잘못된 키면 외부 호출 안 함, fallback UI 표시.

**교훈:** 외부 SaaS 의존성은 항상 **graceful degradation** 패턴 적용. 키 누락/오류 시 앱이 죽으면 안 됨.

---

## 3.25 시놀로지 마이그레이션 준비

**상황:** GCP Free Tier 가 **2026-05-28 만료**. 친구 시놀로지 NAS 로 이전 결정.

**진단 결과 (현재 GCP VM):**
- Ubuntu 22.04.5 LTS / 2 vCPU / 1 GB RAM
- 디스크 13 GB / 29 GB 사용
- 실행 중: Spring Boot, PostgreSQL 14, Redis 6, nginx 1.18
- DB: `popspot_db` (popspot_user / 비번 1234) — 시놀로지 옮기기 전 강한 비번으로 변경 필수
- nginx 외부 설정: `/etc/nginx/sites-available/default` 안에 popspot 라우팅
- SSL: Let's Encrypt `popspot.duckdns.org` 발급됨

**옮길 파일 (총 ~200MB):**
- DB 덤프 (`pg_dumpall`) ~70MB
- popspot-backend-0.0.1-SNAPSHOT.jar 92MB
- popspot.env (3KB) — API 키들
- start.sh (4KB)
- application-prod.properties (4KB)
- uploads/ (1.7MB)
- nginx 설정 + Let's Encrypt 인증서

**전송 방법 비교:**
| 방법 | 추천도 | 비고 |
|---|---|---|
| rsync 직접 | ⭐⭐⭐⭐⭐ | 시놀로지 SSH 가능 시 |
| SFTP via FileZilla | ⭐⭐⭐ | SSH 안 켜는 경우 |
| FTP | ❌ | 평문 비번, 비추 |

**시놀로지 운영 계획:**
- **Container Manager (Docker Compose)** 로 4개 컨테이너 (postgres / redis / backend / nginx)
- DSM 내장 **Reverse Proxy** 로 nginx 대체 가능
- DSM 내장 **Let's Encrypt** 로 SSL 재발급
- DuckDNS 도메인 그대로 (IP 만 친구 집 공유기로)

**상세 절차:** `SYNOLOGY_MIGRATION_GUIDE.md` 별도 문서 참조 (11개 섹션, 전송/Docker Compose/Postgres 복원/SSL/검증 체크리스트 12개/트러블슈팅 6가지).

**아직 미완료:**
- 친구 시놀로지 모델/RAM/외부IP 확인 대기
- DB 비번 변경 (1234 → 32자 랜덤)
- 실제 데이터 이전 + 검증

---

# 4. 최종 시스템 구조

## 인프라

```
[사용자 브라우저]
        ↓ HTTPS
        ↓ (/ → middleware → /intro 자동 리다이렉트)
┌──────────────────────┐         ┌──────────────────────────┐
│   Vercel             │         │   GCP VM (Ubuntu 22.04)  │
│   popspot.vercel.app │ ──API─→ │   popspot.duckdns.org    │
│   Next.js 16 프론트  │         │   ⚠ 5/28 만료 → Synology │
│   /intro 인트로 페이지│        │   Spring Boot 4.0.2      │
│   (스냅 스크롤+영상) │         │   PostgreSQL 14          │
└──────────────────────┘         │   Redis 6                │
                                 │   nginx 1.18 + LE SSL    │
                                 └──────────────────────────┘
                                            ↓
                                 ┌──────────────────────┐
                                 │  외부 서비스         │
                                 │  - Naver 검색 API    │
                                 │  - Kakao 검색/지도   │
                                 │  - Groq AI (LLM)     │
                                 │    llama-3.3-70b     │
                                 │  - PortOne (결제)    │
                                 │  - Kakao OAuth2      │
                                 │  - Sentry (오류추적) │
                                 └──────────────────────┘
```

## 자동수집 데이터 흐름

```
매일 04:00 KST
  ├─ 60 키워드 ("서울 팝업스토어" 등)
  ├─ × Naver 블로그/뉴스 + Kakao 웹/블로그 (각 30건)
  ├─ × 800ms rate limit
  ├─ Groq llama-3.3-70b 정규화 → 신뢰도 점수
  │   (호출 간격 2.2초 — RPM 30 활용, 60키워드 풀크롤 ~5분)
  ├─ Kakao Local API geocoding → lat/lng
  ├─ external_id (SHA-256) 중복 검사
  └─ confidence ≥ 0.8 → AUTO_PUBLISHED
     confidence < 0.8 → PENDING_REVIEW (admin 검수)

매일 05:00 KST
  └─ end_date < today → status='EXPIRED'
```

## 7대 정책 안전장치

1. **TOS 준수** — 공식 검색 API 만, 일일 한도 1% 미만
2. **저작권** — snippet+source_url 만, AI paraphrase
3. **개인정보** — LLM 프롬프트 PII 제외 + §13
4. **정확성 면책** — 신뢰도 점수, AI 뱃지, Footer
5. **Takedown** — 24h SLA, 즉시 차단, 약관 §11
6. **만료 자동처리** — 매일 5시 EXPIRED
7. **약관 가시성** — /terms + Footer + 가입 동의

## 데이터 현황 (현재)

```
PopupStore 총합: 150개
├─ MANUAL/EXPIRED (숨김):  133개
└─ CRAWLED (자동수집):      17개
    ├─ AUTO_PUBLISHED:       9개  (메인 노출)
    ├─ PENDING_REVIEW:       8개  (admin 검수 대기)
    └─ 좌표 채워진 row:     15개  (지도 마커)
```

---

# 5. 향후 권장 작업

## 🔴 최우선 (5월 내)
- [ ] **시놀로지 마이그레이션** — GCP 5/28 만료 (SYNOLOGY_MIGRATION_GUIDE.md 참조)
  - [ ] 친구 시놀로지 모델/RAM/외부IP 확인
  - [ ] DB 비번 1234 → 32자 랜덤으로 변경
  - [ ] Container Manager (Docker Compose) 로 4개 컨테이너 배포
  - [ ] DuckDNS IP 변경 + 친구 공유기 포트포워딩
  - [ ] 12개 검증 체크리스트 통과
  - [ ] GCP VM 정지

## 즉시 (포트폴리오 단계)
- [x] 자동수집 활성화
- [x] 매일 자동 스케줄 가동
- [x] **Gemini → Groq 마이그레이션** (1.17 참조, 한도 0 → 14400/day)
- [x] **인트로 페이지 신규** (2.7 참조, 5섹션 스냅 스크롤)
- [x] **Algolia 안전 fallback** (2.9 참조, 콘솔 에러 제거)
- [ ] 1주일 운영 후 더미 133개 hard delete

## 가까운 시일 (포트폴리오 유지 시)
- [ ] 회원가입 — 만 14세 미만 차단 로직
- [ ] 프론트 lighthouse 점수 점검
- [ ] 코스 추천을 룰 기반으로 갈아치우기 (LLM 의존도 ↓, AiCourseService 만 변경)
- [ ] Algolia 인덱싱 스크립트 작성 또는 백엔드 검색으로 대체
- [ ] 인트로 페이지 영상 4MB 이하로 압축 (모바일 데이터 절약)

## 수익화 시점 (필수)
- [ ] Footer 의 "포트폴리오" 라벨 제거
- [ ] 통신판매업 신고 + 사업자 정보 표시
- [ ] 정식 개인정보처리방침 (별도 페이지)
- [ ] 14세 미만 법정대리인 동의 절차
- [ ] 본인인증 (NICE 등 PG 연동)

---

---

# 6. 실제 마이그레이션 실행 (2026-05-03)

§3.25 에서 계획만 세웠던 시놀로지 마이그레이션을 실제로 실행한 기록.
**예상 시간 1~2시간 → 실제 약 6시간** (트러블슈팅 포함). 모든 결정/명령어/막힌 점 정리.

## 6.1 환경 변경 — DSM Container Manager → Proxmox + Ubuntu VM

### 변경 전 계획
시놀로지 DSM 의 **Container Manager (Docker Compose)** 로 4개 컨테이너 운영.

### 실제 환경
친구가 **Proxmox VE** (가상화 플랫폼) 를 시놀로지에 깔고, 그 위에 **Ubuntu VM** 을 만들어줬음. 즉:

```
시놀로지 NAS (하드웨어)
    └── Proxmox VE (가상화 플랫폼)
            └── Ubuntu VM (POP-SPOT 호스팅)
```

### 왜 이게 더 나았나
- **Full Linux 환경** — DSM 의 제약 (sudo 제한, 패키지 매니저 차이) 없음
- **systemd 사용 가능** — GCP 와 동일한 방식
- **Xshell 로 SSH 직접 접속** — 터미널 친화적
- **Proxmox 리소스 분리** — VM 자체 메모리/CPU 격리

### 단점
- VM 안에 들어가서 작업 → Proxmox 콘솔 추가 계층
- 친구가 만든 VM 환경에 의존 (모델/설정 등 알아야 함)

---

## 6.2 외부 노출 — Tailscale Funnel 선택

### 옵션 비교

| 방식 | 장점 | 단점 | 채택 |
|---|---|---|---|
| **A. 친구 공유기 포트포워딩** | 도메인 그대로 (`popspot.duckdns.org`) 유지 가능 | 친구 공유기 손대야 함, ISP 80 포트 차단 위험 | ❌ |
| **B. Tailscale Funnel** | HTTPS 자동, 친구 공유기 안 건드림, 5분 셋업 | 도메인이 `*.ts.net` 형태로 변경 | ✅ |
| **C. Cloudflare Tunnel** | 도메인 유지 가능, HTTPS 자동 | 추가 도구 설치, Cloudflare 가입 | ❌ |

### Tailscale Funnel 선택 이유
1. Ubuntu VM 에 Tailscale 이미 설치됨 (친구가 셋업)
2. **무료 플랜에서 월 1TB 트래픽** — 작은 사이트엔 충분
3. **자동 SSL** — Let's Encrypt 별도 셋업 불필요
4. 한 명령어로 활성화: `sudo tailscale funnel --bg 8080`
5. **친구 공유기 / 시놀로지 네트워크 설정 안 건드림**

### 새 도메인
```
이전: https://popspot.duckdns.org      (GCP, Let's Encrypt)
변경: https://vm-113.tailc57dd4.ts.net  (Tailscale Funnel)
```

DuckDNS 도메인은 → **Tailscale 100.x.x.x 사설 IP 가리킬 수 없음** (DuckDNS 는 공인 IP 만 지원). 그래서 새 도메인 사용. 추후 Cloudflare DNS 등으로 도메인 통합 가능.

---

## 6.3 호스팅 방식 — Docker 빼고 직접 설치

### 옵션 비교

| 방식 | 계층 구조 | 디버깅 | 채택 |
|---|---|---|---|
| **A. 직접 설치 (bare metal)** | VM → 서비스 | ⭐⭐⭐ 단순 | ✅ |
| **B. Docker Compose** | VM → 컨테이너 → 서비스 | ⭐⭐ 복잡 | ❌ |
| **C. systemd 서비스** | VM → systemd → 서비스 | ⭐⭐⭐ 단순 | (start.sh 사용) |

### 선택 이유
1. **GCP 환경과 동일** — 새로 배울 거 없음, start.sh 그대로 사용
2. **로그 직접 접근** — `tail -f ~/nohup.out` 한 줄로 끝
3. **재시작 단순** — `bash ~/start.sh` 한 명령
4. **컨테이너 안 들어가도 됨** — 디버깅 시 직접 nano 로 파일 수정 가능
5. **백엔드 1개 + DB 1개** — 컨테이너 격리 필요 없음

### 단점
- 새 환경 만들 때마다 수동 설치 (Docker 면 한 번에)
- → 한 번 옮길 거니까 OK

---

## 6.4 마이그레이션 10단계 실행 기록

### Phase 1 — Ubuntu VM 환경 준비 (10분)

```bash
# Xshell 로 reo4321@100.99.233.107 접속
sudo apt update && sudo apt upgrade -y

# 필수 패키지 한 번에
sudo apt install -y \
  openjdk-21-jdk-headless \
  postgresql postgresql-contrib \
  redis-server \
  nginx \
  certbot python3-certbot-nginx \
  rsync curl htop
```

> 📌 apt upgrade 중 "Pending kernel upgrade" 다이얼로그 나옴 → Enter 로 OK 누르고 계속 진행. 재부팅은 나중에.

설치 결과:
- OpenJDK 21
- PostgreSQL 14
- Redis 6
- nginx 1.18 (사용 안 할 거지만 일단 설치)

### Phase 2 — GCP 데이터 백업 (5분)

```bash
ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208

# DB 덤프
sudo -u postgres pg_dump \
  --format=plain \
  --encoding=UTF8 \
  --no-owner \
  --no-privileges \
  popspot_db > ~/popspot_backup.sql

# nginx 설정 백업
sudo cp /etc/nginx/sites-available/default ~/nginx-default.conf
sudo chown reo4321:reo4321 ~/nginx-default.conf
```

옮길 파일 (총 ~200MB):
- `popspot_backup.sql` — 112KB (작아 보이지만 정상 — Phase 4 검증 참조)
- `popspot-backend-0.0.1-SNAPSHOT.jar` — 98MB
- `popspot.env` — 3KB
- `start.sh`, `application-prod.properties`
- `uploads/`
- `nginx-default.conf`

### Phase 3 — Tailscale 로 직접 전송 (5분)

```bash
# GCP 에 Tailscale 설치
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# → 출력 URL 브라우저로 열어서 본인 Tailscale 계정 인증

# 가입 확인
tailscale status
ping -c 3 100.99.233.107  # Ubuntu VM 응답 확인

# rsync 한 방에 전송
rsync -avzP \
  ~/popspot-backend-0.0.1-SNAPSHOT.jar \
  ~/popspot.env \
  ~/start.sh \
  ~/application-prod.properties \
  ~/popspot_backup.sql \
  ~/nginx-default.conf \
  ~/uploads/ \
  reo4321@100.99.233.107:~/
```

> 📌 처음에 `ubuntu@100.99.233.107` 로 시도했다가 비번 거부 → Xshell 세션 속성 보니 사용자명이 **`reo4321`** (GCP 와 동일) → 변경 후 성공.

### Phase 4 — DB 복원 (10분)

```bash
# 강한 비번 생성 (메모장에 따로 보관)
openssl rand -base64 32

# PostgreSQL 사용자 + DB 생성
sudo -u postgres psql <<'EOF'
CREATE USER popspot_user WITH PASSWORD '강한_새_비번';
CREATE DATABASE popspot_db
    OWNER popspot_user
    ENCODING 'UTF8'
    LC_COLLATE 'C.UTF-8'
    LC_CTYPE 'C.UTF-8'
    TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE popspot_db TO popspot_user;
GRANT ALL ON SCHEMA public TO popspot_user;
EOF

# 덤프 복원
sudo -u postgres psql popspot_db < ~/popspot_backup.sql

# 검증 — 일부러 테이블별 row 수
sudo -u postgres psql popspot_db -c "
SELECT 'popup_store' AS t, COUNT(*) FROM popup_store
UNION ALL SELECT 'users', COUNT(*) FROM users;
"
```

복원 결과:
```
COPY 17  (popup_store)
COPY 18  (users)
COPY 149 (course)
... (18 테이블 모두)
```

> 📌 **`ERROR: permission denied for table popup_store`** 발생 → pg_dump 가 `--no-owner` 옵션 때문에 OWNER 가 `postgres` 가 됨. ALTER OWNER 일괄 적용으로 해결:
> ```sql
> DO $$
> DECLARE r record;
> BEGIN
>   FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
>     EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO popspot_user';
>   END LOOP;
> END $$;
> ```

### Phase 5 — 백엔드 띄우기 (10분)

```bash
# popspot.env 의 DB_PASSWORD 를 새 비번으로
nano ~/popspot.env
# Ctrl+W → DB_PASSWORD 검색 → 값 수정 → Ctrl+O Enter Ctrl+X

# Redis 시작
sudo systemctl enable --now redis-server
redis-cli ping  # → PONG

# 백엔드 시작
bash ~/start.sh
sleep 60
tail -30 ~/nohup.out
```

부팅 결과:
```
Started PopspotBackendApplication in 9.272 seconds
```

→ GCP (47초) 보다 5배 빠름! Proxmox VM 의 CPU 가 더 좋은 듯.

### Phase 6 — Tailscale Funnel 외부 노출 (10분)

#### 처음엔 nginx 도 같이 셋업하려 했음

```bash
sudo cp ~/nginx-default.conf /etc/nginx/sites-available/popspot
sudo ln -sf /etc/nginx/sites-available/popspot /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
# → "nginx: configuration file /etc/nginx/nginx.conf test failed"
```

→ GCP 의 nginx 설정이 `popspot.duckdns.org` SSL 인증서를 가리킴. 새 VM 엔 그 인증서 없으니 실패.

#### nginx 빼는 결정

분석 결과 nginx 가 하던 일이 SSL + 프록시뿐. Tailscale Funnel 이 둘 다 대체:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx

sudo tailscale funnel --bg 8080

sudo tailscale funnel status
# Funnel on:
#   https://vm-113.tailc57dd4.ts.net (Funnel on)
#   |-- proxy http://127.0.0.1:8080
```

외부 접속 테스트:
```bash
curl https://vm-113.tailc57dd4.ts.net/actuator/health
# → {"status":"UP"}  ✅
```

### Phase 7 — Vercel 환경변수 변경 (5분)

Vercel 대시보드 → POP-SPOT → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL = https://vm-113.tailc57dd4.ts.net
```

→ **Save → Deployments → Redeploy**

> 📌 처음에 `NEXT_PUBLIC_API_BASE_URL` 로 잘못 적었음 (BASE 들어감). 코드는 `NEXT_PUBLIC_API_URL` 찾는데 못 찾으니까 fallback `http://localhost:8080` 사용. → OAuth 리다이렉트 URL 이 `http://localhost:8080/oauth2/...` 로 가는 사고. 변수명에서 BASE 빼고 정정.

### Phase 8 — OAuth 콜백 URL 등록 (5분)

3개 프로바이더 콘솔에 새 URL 추가 (옛 URL 도 그대로 둠):

| 프로바이더 | 콘솔 | 등록 URL |
|---|---|---|
| 카카오 | https://developers.kakao.com → 카카오 로그인 → Redirect URI | `https://vm-113.tailc57dd4.ts.net/login/oauth2/code/kakao` |
| 네이버 | https://developers.naver.com → API 설정 → Callback URL | `https://vm-113.tailc57dd4.ts.net/login/oauth2/code/naver` |
| 구글 | https://console.cloud.google.com → Credentials → OAuth 2.0 Client | `https://vm-113.tailc57dd4.ts.net/login/oauth2/code/google` |

### Phase 9 — 모니터링 (1~2일 예정)

```bash
# 매일 확인
curl https://vm-113.tailc57dd4.ts.net/actuator/health
curl https://vm-113.tailc57dd4.ts.net/api/popups | head -100
free -h
```

새 popup 들어오는지 / 메모리 안정한지 / 사용자 트래픽 들어오는지.

### Phase 10 — GCP 정지 (1~2일 후 예정)

```bash
# 백엔드 프로세스만 종료 (VM 은 살려둠 — 비상 백업)
ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208 "sudo pkill -f popspot-backend"

# 5/28 만료 전에 VM 자체 정지/삭제
```

---

## 6.5 트러블슈팅 모음 (오늘 막혔던 19가지)

### 6.5.1 SSH 비번 거부 (`Permission denied`)

**증상:**
```
ubuntu@100.99.233.107's password:
Permission denied, please try again.
```

**원인:** Ubuntu VM 의 사용자명이 `ubuntu` 가 아니라 `reo4321`. (친구가 GCP 와 동일한 사용자명으로 만들어줌). Xshell 세션 속성에 보면 `reo4321@VM-113`.

**해결:**
```bash
rsync -avzP ... reo4321@100.99.233.107:~/  # ubuntu → reo4321
```

**교훈:** Xshell/SSH 의 사용자명은 항상 세션 속성에서 먼저 확인.

---

### 6.5.2 rsync `Connection timed out`

**증상:**
```
ssh: connect to host 100.99.233.107 port 22: Connection timed out
```

**원인:** GCP VM 에 Tailscale 미설치. `100.x.x.x` 는 Tailscale 사설 IP 라 같은 tailnet 안에 있어야 보임.

**해결:**
```bash
# GCP 에 Tailscale 설치 + 가입
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# 출력 URL 브라우저로 열어 인증 후 같은 tailnet 가입
```

**교훈:** Tailscale IP (100.x.x.x) 는 Tailscale 가입한 머신끼리만 통신 가능.

---

### 6.5.3 DB 덤프 사이즈 작아 보임 (112KB)

**증상:** `pg_dump` 결과 파일이 112KB. GCP 의 DB 사이즈가 68MB 였는데 너무 작은 듯.

**원인:** 정상. `pg_dump` 디폴트는 데이터를 `INSERT` 가 아니라 **`COPY` 형식**으로 떠냄. COPY 가 훨씬 컴팩트:
- INSERT 형식: 한 행 = 여러 줄 (`INSERT INTO ... VALUES (...);`)
- COPY 형식: 한 행 = 한 줄 (탭 구분)

또한 GCP `/var/lib/postgresql` 의 68MB 는 system catalogs + WAL + 다른 DB 다 합친 것. 실제 popspot_db 만은 작음.

**검증:**
```bash
grep -c "^COPY public" ~/popspot_backup.sql  # → 18 (테이블 수)
wc -l ~/popspot_backup.sql                   # → 936 (정상)
```

---

### 6.5.4 DB 권한 거부 (`permission denied for table popup_store`)

**증상:**
```
ERROR: permission denied for table popup_store
```

**원인:** `pg_dump --no-owner` 로 떠서 복원할 때 OWNER 가 `postgres` 가 됨. `popspot_user` 는 그 테이블 접근 못함.

**해결:** 모든 테이블/시퀀스 OWNER 일괄 변경:
```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO popspot_user';
  END LOOP;
END $$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO popspot_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO popspot_user;
ALTER DATABASE popspot_db OWNER TO popspot_user;
```

---

### 6.5.5 `popspot.env` 첫 줄 깨짐 (ANSI escape 문자)

**증상:**
```bash
bash ~/start.sh
# /home/reo4321/popspot.env: 줄 1: Y4: 명령어를 찾을 수 없음
# /home/reo4321/popspot.env: 줄 1: [7: 명령어를 찾을 수 없음
```

**원인:** nano 로 비번 편집 중 화살표 키 → ANSI escape sequence (`ESC[7` 같은 것) 가 텍스트로 들어감. 첫 줄이 `aY4Y4a[7a[7[7# ====...` 처럼 깨짐.

**해결:** 깨진 첫 줄이 마침 주석 (`# ===`) 이라 통째 삭제:
```bash
sed -i '1d' ~/popspot.env
```

**교훈:**
- nano 편집 중 화살표 키 막 누르지 말기
- 비번은 `Shift+Insert` 로 깔끔히 붙여넣기
- 저장 직전 `head -5` 로 첫 줄 확인

---

### 6.5.6 환경변수 이름 자체 깨짐 (`ALGOLIA_API_KaaD`aDEY`)

**증상:** `grep CRAWLER popspot.env` 결과에 이상한 줄:
```
ALGOLIA_API_KaaD`aDEY=...
```

**원인:** 6.5.5 와 같은 이유로 변수명에 백틱/escape 문자 섞임.

**해결:** Algolia 어차피 안 쓰니 해당 줄 통째 삭제:
```bash
sed -i '/ALGOLIA_API_KaaD/d' ~/popspot.env
```

---

### 6.5.7 백엔드 부팅 실패 (Algolia 클라이언트 초기화 실패)

**증상:** `nohup.out` 에 stack trace:
```
SearchService.init(SearchService.java:33)
DefaultSearchClient.create(DefaultSearchClient.java:25)
SearchConfig$Builder.build(SearchConfig.java:26)
```

**원인:** `SearchService` 가 `@PostConstruct` 에서 Algolia 클라이언트 생성 시도. App ID 가 비어있으니 IllegalArgumentException → @PostConstruct 실패 → 빈 생성 실패 → 백엔드 부팅 자체 실패.

**해결:** `SearchService.java` 에 graceful fallback 추가:
```java
@Value("${algolia.app-id:}")  // 콜론 추가로 빈 값 허용
private String appId;

@PostConstruct
public void init() {
    if (appId == null || appId.isBlank() || appId.length() < 6
            || !appId.matches("^[A-Z0-9]+$")) {
        log.warn("Algolia 미설정 → 검색 기능 비활성화");
        return;  // 클라이언트 안 만들고 종료
    }
    try {
        SearchClient client = DefaultSearchClient.create(appId, apiKey);
        index = client.initIndex("popups", PopupSearchDto.class);
        enabled = true;
    } catch (Exception e) {
        log.warn("Algolia 클라이언트 초기화 실패 → 비활성화");
    }
}
```

**교훈:** `@PostConstruct` 에서 외부 서비스 초기화 시 try-catch + enabled 플래그 패턴 필수.

---

### 6.5.8 `application-prod.properties` 평문 시크릿

**증상:** 외부 properties 파일 안에 OAuth Client ID/Secret 평문으로 박혀있음.

**원인:** 초기 배포 시 평문으로 적어둔 게 남아있음. JAR 안의 application-prod.properties 가 환경변수 참조하는데, 외부 파일이 그걸 덮어씀.

**해결:** 외부 파일 통째로 비우기 (가장 안전):
```bash
cp ~/application-prod.properties ~/application-prod.properties.bak
> ~/application-prod.properties
```

→ 모든 설정은 `popspot.env` 환경변수 → JAR 안 properties 참조 패턴으로 단일화.

---

### 6.5.9 Vercel 환경변수 이름 mismatch

**증상:** OAuth 로그인 클릭 시 URL 이 `http://localhost:8080/oauth2/...` 로 감.

**원인:**
- 코드 (`app/login/page.tsx`): `process.env.NEXT_PUBLIC_API_URL` 찾음
- Vercel 설정: `NEXT_PUBLIC_API_BASE_URL` (BASE 들어감) 으로 잘못 적음
- → 매치 안 되니 fallback `http://localhost:8080` 사용

**해결:** Vercel 에 정확한 변수명 추가:
```
NEXT_PUBLIC_API_URL = https://vm-113.tailc57dd4.ts.net  ✅
```

→ Save → Redeploy.

**교훈:** 환경변수 추가 전 `grep -rn "process.env.NEXT_PUBLIC_" src/` 로 코드가 찾는 정확한 이름 먼저 확인.

---

### 6.5.10 `wss://` syntax 에러

**증상:**
```
Uncaught SyntaxError: The URL's scheme must be either 'http:' or 'https:'.
'wss:' is not allowed.
```

**원인:** API_BASE_URL 이 `wss://` 로 시작. 어딘가 `new URL(API_URL + '/api/...')` 에 wss URL 들어가서 폭발.

**해결:** `NEXT_PUBLIC_API_URL` 은 무조건 `https://` 로. WebSocket 은 별도 변수 또는 자동 변환 사용.

```typescript
// api.ts 의 자동 변환 로직
export const SOCKET_BASE_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL
  ?? API_BASE_URL?.replace(/^https?:\/\//, m => m === "https://" ? "wss://" : "ws://")
  ?? "ws://localhost:8080";
```

---

### 6.5.11 캐시 문제 (시크릿창 OK, 일반창 X)

**증상:** 시크릿 모드에서는 사이트 정상, 일반 브라우저에서는 옛 빌드의 옛 도메인 호출.

**원인:** 일반 브라우저가 옛 JS 번들 / Service Worker 캐시 보존.

**해결:**
1. **하드 리프레시**: `Ctrl + Shift + R`
2. **Clear site data**: F12 → Application → Storage → Clear site data
3. **Service Worker unregister** (있을 때)

---

### 6.5.12 OAuth 리다이렉트 localhost (6.5.9 의 결과)

**증상:** 네이버 로그인 클릭 시 `http://localhost:8080/oauth2/authorization/naver` 로 이동.

**원인:** Vercel 환경변수 mismatch (6.5.9 참조).

**해결:** `NEXT_PUBLIC_API_URL` 정확히 추가 + Redeploy.

---

### 6.5.13 Live Visitor Talk — 백엔드 200, 프론트 안 보임

**증상:**
- `curl https://.../api/chat/ticker` → 200 OK + JSON 데이터
- 사이트에서 LIVE NOW 영역 안 보임

**원인 1 — apiFetch 의 preflight:**
```typescript
// apiFetch 가 항상 Content-Type: application/json 추가
// → GET 요청에도 preflight (OPTIONS) 발생
// → 백엔드 OPTIONS 처리 못 하면 실제 GET 실패
```

**해결 1:** `LiveChatTicker` 가 `apiFetch` 안 쓰고 직접 `fetch` 사용:
```typescript
const res = await fetch(url, { credentials: "include" });
// Content-Type 헤더 안 붙임 → simple request → preflight 회피
```

**원인 2 — ChatRoom 의 setMessages 누락:**
```typescript
// ChatRoom.tsx (Before)
client.current?.subscribe(`/sub/chat/room/${roomId}`, (res) => {
  const newMessage = JSON.parse(res.body);
  // ❌ setMessages 호출 없음 → state 업데이트 X → 화면 표시 X
});
```

**해결 2:**
```typescript
client.current?.subscribe(`/sub/chat/room/${roomId}`, (res) => {
  const newMessage = JSON.parse(res.body);
  setMessages(prev => [...prev, newMessage]);  // ✅ 추가
});

// 히스토리 로드도 같이 누락됨
.then(data => {
  if (Array.isArray(data)) setMessages(data);  // ✅ 추가
})
```

---

### 6.5.14 WebSocket LazyInitializationException

**증상:** 채팅 메시지 보낼 때 백엔드 에러:
```
LazyInitializationException: Cannot lazily initialize collection of role
'PopupStore.images' with key '160' (no session)
```

**원인:**
- WebSocket broadcast 는 트랜잭션 밖에서 실행
- ChatMessage → popupStore (EAGER) → images (LAZY) 직렬화 시점에 세션 끊어짐
- `getImageUrl()` getter 가 `images.isEmpty()` 호출 → 폭발

**해결:** `ChatMessage.popupStore` 에 `@JsonIgnoreProperties` 추가:
```java
@ManyToOne(fetch = FetchType.EAGER)
@JoinColumn(name = "POPUP_ID")
@JsonIgnoreProperties({
    "images", "imageUrl", "stamps", "reviews", "comments",
    "hibernateLazyInitializer", "handler"
})
private PopupStore popupStore;
```

→ JSON 직렬화 시 lazy 컬렉션 + derived getter (`imageUrl`) 모두 무시.

---

### 6.5.15 `noise.svg` 404 (외부 의존성)

**증상:** 콘솔에:
```
GET https://grainy-gradients.vercel.app/noise.svg 404
```

**원인:** `DigitalTicket.tsx` 의 grainy 텍스처 효과로 외부 사이트의 SVG 사용. 그 사이트가 더 이상 호스팅 안 함.

**해결:** 인라인 SVG 데이터 URL 로 교체:
```tsx
<div
  className="absolute inset-0 opacity-10 pointer-events-none"
  style={{
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
  }}
></div>
```

**교훈:** 외부 URL 의존성은 항상 죽을 수 있음. 단순 텍스처는 인라인 SVG 가 안전.

---

### 6.5.16 `NoResourceFoundException` 로그 시끄러움

**증상:** 백엔드 로그에 큰 stack trace:
```
NoResourceFoundException: No static resource for request '/'.
```

**원인:** 누군가 (봇/본인 테스트) 백엔드 도메인 루트 (`https://vm-113.tailc57dd4.ts.net/`) 직접 접속. 백엔드는 API 만 제공, 정적 리소스 없으니 에러.

**해결:** `GlobalExceptionHandler` 에 핸들러 추가:
```java
@ExceptionHandler(NoResourceFoundException.class)
public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
    return body(HttpStatus.NOT_FOUND, "Not Found", "요청한 리소스가 없습니다.");
}
```

→ 조용히 404 응답, 스택트레이스 안 찍음.

---

### 6.5.17 결제 400 에러 (PortOne)

**증상:**
```
404 Not Found on GET request for "https://api.iamport.kr/payments/imp_122973170162":
"존재하지 않는 결제정보입니다."
```

**원인:** PortOne 서버에 해당 imp_uid 가 없음. 가짜/테스트 결제거나, 가맹점 식별코드 mismatch.

**해결 (미완):**
- Vercel 에 `NEXT_PUBLIC_IAMPORT_MERCHANT_CODE` 환경변수 추가
- 백엔드 `IAMPORT_API_KEY/SECRET` 가 PortOne 콘솔의 키와 일치하는지 확인

→ 결제 기능은 마이그레이션 후 별도 점검 (지금 운영 차단 요소 아님).

---

### 6.5.18 Proxmox 웹 접속 안 됨 (`https://jsycure-vm.tail149964.ts.net:8443`)

**증상:** 친구가 알려준 Proxmox 웹 관리 URL 접속 안 됨.

**원인 가능성:**
- 시놀로지/Proxmox 재부팅됨
- Tailscale Funnel 설정 풀림
- 포트 변경 (8443 → 8006 등)

**해결:** 친구한테 확인 부탁. 단 **Ubuntu VM 만 살아있으면 본인 작업에 영향 없음** — Proxmox 웹은 VM 만들 때만 필요.

---

### 6.5.19 Vercel `DEPLOYMENT_NOT_FOUND`

**증상:**
```
The deployment could not be found on Vercel. DEPLOYMENT_NOT_FOUND
```

**원인:** Vercel Redeploy 진행 중일 때 일시적으로 발생.

**해결:** 1~2분 기다리면 자동 해결. Deployments 탭에서 Ready 상태 확인.

---

## 6.6 새로 생긴 코드 변경

이번 마이그레이션 중 백엔드/프론트 6개 파일 수정:

| 파일 | 변경 |
|---|---|
| **백엔드 — `SearchService.java`** | Algolia 키 미설정 시 graceful fallback (enabled 플래그) |
| **백엔드 — `GlobalExceptionHandler.java`** | `NoResourceFoundException` 핸들러 추가 |
| **백엔드 — `ChatMessage.java`** | `@JsonIgnoreProperties` 로 lazy 컬렉션 직렬화 회피 |
| **프론트 — `ChatRoom.tsx`** | 히스토리 + WebSocket 메시지에 setMessages 호출 추가 |
| **프론트 — `LiveChatTicker.tsx`** | apiFetch → 직접 fetch (preflight 회피) |
| **프론트 — `DigitalTicket.tsx`** | 외부 noise.svg → 인라인 SVG 데이터 URL |

---

## 6.7 마이그레이션 결과 — Before vs After 비교

| 항목 | GCP (Before) | Ubuntu VM (After) |
|---|---|---|
| **호스팅** | GCP Compute Engine (e2-small) | 친구 시놀로지 → Proxmox VE → Ubuntu VM |
| **OS** | Ubuntu 22.04.5 LTS | Ubuntu 22.04.5 LTS (동일) |
| **외부 노출** | nginx + Let's Encrypt SSL | Tailscale Funnel (자동 SSL) |
| **도메인** | popspot.duckdns.org | vm-113.tailc57dd4.ts.net |
| **SSH 접속** | ssh -i ~/.ssh/gcp_key reo4321@34.121.111.208 | Xshell + Tailscale 100.99.233.107 (reo4321) |
| **파일 전송** | scp via SSH key | rsync via Tailscale |
| **백엔드 부팅 시간** | 47초 | **9초** (5배 빠름) |
| **DB** | PostgreSQL 14 (popspot_db / popspot_user) | 동일 (비번만 강한 32자로 변경) |
| **Redis** | Redis 6 | Redis 6 (동일) |
| **nginx** | 사용 (SSL + 프록시) | **사용 안 함** (Tailscale Funnel 이 대체) |
| **비용** | $0 (5/28 만료) | $0 (친구 호스팅 + Tailscale 무료) |
| **OAuth 콜백** | popspot.duckdns.org/login/oauth2/code/* | vm-113.tailc57dd4.ts.net/login/oauth2/code/* |

---

## 6.8 갱신된 시스템 구조 (5/3 이후)

```
[사용자 브라우저]
        ↓ HTTPS
        ↓ (/ → middleware → /intro 자동 리다이렉트)
┌──────────────────────────┐
│   Vercel                 │
│   popspot.vercel.app     │
│   Next.js 16 프론트엔드   │
│   /intro 인트로 페이지    │
│   (스냅 스크롤+영상)      │
└──────────────────────────┘
        ↓ API 호출
        ↓ https://vm-113.tailc57dd4.ts.net
┌──────────────────────────┐
│   Tailscale Funnel       │
│   (자동 SSL + 인터넷 노출) │
└──────────────────────────┘
        ↓ HTTP localhost:8080
┌──────────────────────────────────────┐
│   친구 시놀로지 NAS                   │
│      └── Proxmox VE (가상화)          │
│            └── Ubuntu VM (Tailscale)  │
│                  ├── Spring Boot 4.0.2│
│                  ├── PostgreSQL 14    │
│                  └── Redis 6          │
└──────────────────────────────────────┘
        ↓
┌──────────────────────┐
│  외부 서비스          │
│  - Naver 검색 API    │
│  - Kakao 검색/지도   │
│  - Groq AI (LLM)     │
│    llama-3.3-70b     │
│  - PortOne (결제)    │
│  - Kakao OAuth2      │
│  - Sentry (오류추적) │
└──────────────────────┘
```

---

## 6.9 회고 — 6시간 동안 배운 것

### ⭐ 잘한 결정

1. **Docker 안 쓴 거** — GCP 와 동일 환경이라 디버깅 쉬웠음. Docker 였으면 컨테이너 안 들어갔다 나왔다 더 복잡했을 듯.
2. **Tailscale Funnel** — 친구 공유기 안 건드리고 5분 만에 외부 노출. 압도적으로 단순.
3. **GCP 백엔드 살려둔 거** — 새 VM 검증 완료까지 사용자가 사이트 못 들어가는 일 없었음. 점진적 전환.
4. **rsync 직접 전송** — Tailscale 가입한 김에 PC 경유 안 하고 5분 만에 전송 완료.

### 🤔 다음에 더 잘할 수 있는 것

1. **환경변수명 사전 검증** — `grep -rn "NEXT_PUBLIC_" src/` 로 코드가 찾는 이름 먼저 확인했으면 OAuth localhost 사고 없었을 듯.
2. **nano 에서 비번 입력 신중히** — 화살표/마우스 휠 사용 자제. 안 그러면 ANSI escape 문자 들어가서 환경변수 깨짐.
3. **DB 덤프 시 OWNER 처리 미리 결정** — `--no-owner` 옵션 쓰면 ALTER OWNER 후처리 필요. 미리 알았으면 더 빨랐을 듯.
4. **빌드 자주 — 점진 검증** — Algolia / NoResourceFound / ChatMessage 수정사항을 모아서 한 번에 빌드/배포했으면 시간 절약.

### 📊 시간 분포 (실제)

| 단계 | 예상 | 실제 |
|---|---|---|
| Phase 1 환경 준비 | 10분 | 10분 ✓ |
| Phase 2 백업 | 5분 | 5분 ✓ |
| Phase 3 전송 | 5분 | 30분 (SSH 사용자명 + Tailscale 설치) |
| Phase 4 DB 복원 | 10분 | 30분 (권한 문제) |
| Phase 5 백엔드 띄우기 | 5분 | 1시간 (env 깨짐 + Algolia 빌드 사이클) |
| Phase 6 외부 노출 | 10분 | 20분 (nginx 빼는 결정) |
| Phase 7 Vercel | 5분 | 30분 (변수명 mismatch + 캐시 + Redeploy) |
| Phase 8 OAuth | 5분 | 10분 ✓ |
| Phase 9-10 모니터링/정리 | (예정) | (예정) |
| **소계** | **약 1시간** | **약 4시간 + 추가 디버깅 2시간** |

→ 마이그레이션은 **항상 예상 시간의 2~3배**.

---

# 7. v1.2 변경점 요약

- §6 통째로 신규 — 실제 마이그레이션 실행 기록 (10단계 + 19개 트러블슈팅)
- §6.1 Proxmox + Ubuntu VM 환경 결정 (DSM Container Manager 대신)
- §6.2 Tailscale Funnel 외부 노출 (nginx + Let's Encrypt 대체)
- §6.3 직접 설치 방식 채택 (Docker 빼기)
- §6.4 10단계 실제 명령어 + 결과 + 막힌 점
- §6.5 트러블슈팅 19가지 (SSH/rsync/DB 권한/env 깨짐/Algolia/CORS preflight/LazyInit/캐시 등)
- §6.6 새 코드 변경 6개 파일
- §6.7 Before/After 비교표
- §6.8 갱신된 시스템 구조도
- §6.9 회고 (잘한 결정 / 개선점 / 시간 분포)

---

**문서 버전:** v1.2
**최종 수정:** 2026-05-03
**작성자:** POP-SPOT 개발팀

**v1.2 변경점:**
- §6 실제 마이그레이션 실행 기록 통째 추가 (5/3, 약 6시간 작업)
- 10단계 마이그레이션 + 19가지 트러블슈팅 모두 포함
- GCP → Proxmox/Ubuntu VM 이전 완료 (백엔드만 정지 대기)
- 외부 노출 nginx → Tailscale Funnel 로 대체
- 도메인 popspot.duckdns.org → vm-113.tailc57dd4.ts.net

**v1.1 변경점:**
- §1.17 Gemini → Groq LLM 마이그레이션 추가
- §2.7 인트로(커버) 페이지 신규 추가
- §2.8 AuthGuard 공개 경로 + 로그인 후 ?entered=1 추가
- §2.9 SearchBox Algolia 잘못된 키 fallback 추가
- §3.22 application-prod.properties 외부 파일 우선순위 함정 추가
- §3.23 Gemini API 키 노출 → Google 자동 차단 추가
- §3.24 Algolia 잘못된 App ID 콘솔 스팸 추가
- §3.25 시놀로지 마이그레이션 준비 추가
- §4 시스템 구조 — Groq, 인트로 페이지, 시놀로지 이전 예정 반영
- §5 향후 권장 작업 — 시놀로지 마이그레이션 최우선 순위로
