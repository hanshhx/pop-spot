package com.example.popspotbackend.controller;

import com.example.popspotbackend.config.OAuth2SuccessHandler;
import com.example.popspotbackend.dto.LoginRequestDto;
import com.example.popspotbackend.dto.LoginResponseDto;
import com.example.popspotbackend.dto.ResetPasswordRequestDto;
import com.example.popspotbackend.dto.SignupRequestDto;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.service.AuthService;
import com.example.popspotbackend.service.EmailService;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 / 회원 관련 엔드포인트.
 *
 * <p>이메일 인증코드는 Redis 에 TTL 5분으로 저장되며, 검증 실패가 {@value #MAX_VERIFY_ATTEMPTS}회를 넘으면 코드가 폐기되어 재발송이 강제된다
 * (brute-force 방어).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final int MAX_VERIFY_ATTEMPTS = 5;
    private static final long AUTH_CODE_TTL_MINUTES = 5;
    private static final long AUTH_VERIFIED_TTL_MINUTES = 10;

    private static final String KEY_AUTH_CODE = "AUTH_CODE:";
    private static final String KEY_AUTH_ATTEMPTS = "AUTH_ATTEMPTS:";
    private static final String KEY_AUTH_VERIFIED = "AUTH_VERIFIED:";
    private static final String VERIFIED_TRUE = "TRUE";
    private static final String PURPOSE_SIGNUP = "SIGNUP";
    private static final String PURPOSE_PASSWORD_RESET = "PASSWORD_RESET";

    private static final String SOCIAL_USER_ERROR_PREFIX = "SOCIAL_USER";

    /**
     * GET 후 DEL 을 한 번에(원자적으로) 수행하는 스크립트.
     *
     * <p>Spring Data 의 {@code getAndDelete()} 는 Redis 명령 {@code GETDEL} 로 내려가는데 이는 Redis 6.2 이상에서만
     * 존재한다. 운영 서버(Ubuntu 22.04 기본 Redis 6.0.x)에는 그 명령이 없어 Lettuce 가 "Error in execution" 을 던졌고, 이
     * 예외가 {@code GlobalExceptionHandler} 의 RuntimeException 핸들러를 타면서 소셜 로그인 교환(/oauth/exchange)과
     * 회원가입·비밀번호 재설정의 이메일 인증 소비가 전부 400 으로 실패했다.
     *
     * <p>Lua 스크립트는 Redis 2.6+ 에서 동작하고 서버에서 단일 원자 단위로 실행되므로, 1회용 코드가 두 번 소비되지 않는다는 보장은 {@code
     * GETDEL} 과 동일하게 유지된다.
     */
    static final RedisScript<String> GET_DEL_SCRIPT =
            new DefaultRedisScript<>(
                    "local v = redis.call('GET', KEYS[1]) "
                            + "if v then redis.call('DEL', KEYS[1]) end "
                            + "return v",
                    String.class);

    /* ---------------- 소셜 로그인 교환 ---------------- */

    private static final int MAX_EXCHANGE_CODE_LENGTH = 100;
    private static final String PARAM_CODE_VERIFIER = "code_verifier";

    private static final String EXCHANGE_OK_PREFIX = "OK\n";
    private static final String EXCHANGE_MISS = "MISS";
    private static final String EXCHANGE_NEEDS_VERIFIER = "NEEDV";
    private static final String EXCHANGE_DOWNGRADE = "NODOWN";

    /**
     * 교환 코드의 <b>검증과 소비를 한 원자 단위로</b> 처리한다.
     *
     * <p>자바 쪽에서 먼저 읽고 나중에 검사하면, 틀린 verifier 를 보낸 사람이 정상 로그인을 소진시킬 수 있다. 그래서 비교 → 조건부 삭제 → 반환이 전부 여기
     * 있다. <b>불일치면 코드를 남긴다</b> — 정상 클라이언트가 다시 시도할 수 있어야 한다.
     *
     * <p>공용 {@link #GET_DEL_SCRIPT} 를 확장하지 않은 이유: 그 스크립트는 이메일 인증 완료 표도 쓴다. OAuth 전용으로 바꾸면 회원가입·비밀번호
     * 재설정에 영향이 간다.
     *
     * <p>해시 계산(S256)은 자바에서 한다. 원자적으로 묶여야 하는 것은 <b>저장값과의 비교 → 조건부 삭제 → 반환</b>이지 해시 계산이 아니다.
     *
     * <p>Redis 6.0 호환 — 운영 서버에 {@code GETDEL} 이 없다(위 {@link #GET_DEL_SCRIPT} 사연 참고).
     */
    static final RedisScript<String> OAUTH_EXCHANGE_SCRIPT =
            new DefaultRedisScript<>(
                    // 개행은 string.char(10) 으로 만든다. 문자열 리터럴에 이스케이프를 쓰면 안 된다 —
                    // 이스케이프가 heredoc → 자바 → Lua 로 세 겹이라 한 겹만 잃어도 자바가 진짜 개행을
                    // 넣고, Lua 는 홑따옴표 문자열 안의 개행을 문법 오류로 본다. 2026-09-05 에 실제로
                    // 그렇게 나가 소셜 로그인이 503 이 됐다. 이 방식은 백슬래시가 아예 없어 그 겹침이
                    // 생기지 않는다.
                    "local NL = string.char(10) "
                            + "local v = redis.call('GET', KEYS[1]) "
                            + "if not v then return 'MISS' end "
                            + "local given = ARGV[1] "
                            + "local nl = string.find(v, NL, 1, true) "
                            + "local header, payload "
                            + "if nl then header = string.sub(v, 1, nl - 1) "
                            + "  payload = string.sub(v, nl + 1) "
                            + "else header = v payload = '' end "
                            // 헤더가 없는 값 = 배포 직전 60초 안에 발급된 옛 형식. 값 전체가 payload 다.
                            + "if string.sub(header, 1, 3) ~= 'B1:' then "
                            + "  if given ~= '' then return 'NODOWN' end "
                            + "  redis.call('DEL', KEYS[1]) return 'OK' .. NL .. v end "
                            + "local bind = string.sub(header, 4) "
                            + "if bind == '-' then "
                            + "  if given ~= '' then return 'NODOWN' end "
                            + "  redis.call('DEL', KEYS[1]) return 'OK' .. NL .. payload end "
                            + "if string.sub(bind, 1, 5) ~= 'S256:' then return 'NEEDV' end "
                            + "local want = string.sub(bind, 6) "
                            + "if given == '' or given ~= want then return 'NEEDV' end "
                            + "redis.call('DEL', KEYS[1]) return 'OK' .. NL .. payload",
                    String.class);

    private final AuthService authService;
    private final EmailService emailService;
    private final StringRedisTemplate redisTemplate;

    @PostMapping("/signup")
    public ResponseEntity<String> signup(@Valid @RequestBody SignupRequestDto requestDto) {
        if (!consumeEmailVerification(requestDto.getEmail(), PURPOSE_SIGNUP)) {
            return ResponseEntity.status(403).body("회원가입 이메일 인증이 완료되지 않았거나 만료되었습니다.");
        }
        String userId = authService.signup(requestDto);
        return ResponseEntity.ok("회원가입 성공! User ID: " + userId);
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDto> login(@RequestBody LoginRequestDto requestDto) {
        return ResponseEntity.ok(authService.login(requestDto));
    }

    /**
     * 로그인 2단계 — 인증 앱의 6자리 또는 복구 코드.
     *
     * <p>{@code /login} 이 {@code totpRequired=true} 와 {@code challengeToken} 을 돌려준 경우에만 쓴다. 표는 한 번
     * 쓰면 사라지므로, 코드를 틀리면 비밀번호부터 다시 넣어야 한다 — 같은 표로 6자리를 계속 대입하지 못하게 하기 위해서다.
     */
    @PostMapping("/login/totp")
    public ResponseEntity<LoginResponseDto> loginTotp(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(
                authService.completeTotpLogin(body.get("challengeToken"), body.get("code")));
    }

    /**
     * 접근 토큰 갱신 — 리프레시 토큰을 새 접근 토큰과 <b>새 리프레시 토큰</b>으로 바꾼다.
     *
     * <p>관리자 접근 토큰은 30분짜리다. 이 경로가 없으면 30분마다 재로그인해야 한다.
     *
     * <p>쓴 리프레시 토큰은 즉시 버린다. 같은 토큰을 계속 쓰게 두면 그것이 곧 장수 토큰이 되어, 접근 토큰을 짧게 만든 의미가 사라진다.
     */
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponseDto> refresh(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.refresh(body.get("refreshToken")));
    }

    /**
     * 소셜 로그인 교환 — 1회용 코드를 토큰으로 바꾼다.
     *
     * <p><b>가로챈 코드를 쓰지 못하게 하는 것이 이 경로의 몫이다.</b> 앱이 만드는 nonce 는 정상 앱이 <b>위조된</b> 콜백을 걸러내는 장치이고,
     * <b>탈취된</b> 콜백은 막지 못한다 — 그 검사는 서버가 아니라 정상 앱이 자기 기기에서 하기 때문이다. 그래서 서버가 코드 자체를 요청자에게 묶는다(RFC
     * 7636).
     *
     * <p>판정은 <b>요청이 무엇을 보냈느냐가 아니라 발급된 코드의 속성</b>으로 한다. 요청에 verifier 가 없다고 구방식으로 통과시키면 공격자는 필드를 빼기만
     * 하면 된다.
     *
     * <table>
     *   <tr><th>저장된 코드</th><th>교환 조건</th></tr>
     *   <tr><td>묶임(B1:S256:…)</td><td>맞는 verifier 필수. 없거나 틀리면 <b>항상</b> 거부</td></tr>
     *   <tr><td>구방식(B1:-)</td><td>전환기에만 허용. <b>verifier 가 붙어 오면 거부</b>(강등 차단)</td></tr>
     *   <tr><td>만료·사용됨</td><td>거부</td></tr>
     * </table>
     */
    @PostMapping("/oauth/exchange")
    public ResponseEntity<?> exchangeOAuthCode(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (isBlank(code) || code.length() > MAX_EXCHANGE_CODE_LENGTH) {
            return ResponseEntity.badRequest().body("유효하지 않은 로그인 교환 코드입니다.");
        }

        String verifier = body.get(PARAM_CODE_VERIFIER);
        String presented = "";
        if (verifier != null && !verifier.isBlank()) {
            if (!isWellFormedVerifier(verifier)) {
                return ResponseEntity.badRequest().body("유효하지 않은 code_verifier 입니다.");
            }
            presented = sha256Base64Url(verifier);
        }

        String result;
        try {
            result =
                    redisTemplate.execute(
                            OAUTH_EXCHANGE_SCRIPT,
                            List.of(OAuth2SuccessHandler.OAUTH_EXCHANGE_KEY_PREFIX + code),
                            presented);
        } catch (RuntimeException e) {
            // 클래스명만 남기면 RedisSystemException 처럼 원인이 메시지에만 있는 예외에서
            // 진단 정보를 통째로 잃는다. 2026-09-05 에 실제로 그래서 한 배포를 더 썼다.
            log.error(
                    "[OAuthExchange] Redis 실행 실패: {} — {}",
                    e.getClass().getSimpleName(),
                    e.getMessage());
            return ResponseEntity.status(503).body("잠시 후 다시 시도해 주세요.");
        }

        if (result == null || EXCHANGE_MISS.equals(result)) {
            return ResponseEntity.status(401).body("로그인 교환 코드가 만료되었거나 이미 사용되었습니다.");
        }
        if (EXCHANGE_NEEDS_VERIFIER.equals(result)) {
            // 틀린 verifier 로는 코드가 소비되지 않는다. 정상 클라이언트는 다시 시도할 수 있다.
            log.warn("[OAuthExchange] 묶인 코드에 맞지 않는 verifier — 거부");
            return ResponseEntity.status(401).body("이 로그인 요청을 시작한 앱에서만 완료할 수 있습니다.");
        }
        if (EXCHANGE_DOWNGRADE.equals(result)) {
            // 묶이지 않은 코드에 verifier 가 붙어 왔다. 신방식 클라이언트가 구코드를 신방식 응답으로
            // 받아들이는 강등 경로를 막는다(RFC 9700 §4.8.2).
            log.warn("[OAuthExchange] 구방식 코드에 verifier 가 붙어 왔다 — 거부");
            return ResponseEntity.badRequest().body("유효하지 않은 로그인 교환 요청입니다.");
        }

        String value = result.substring(EXCHANGE_OK_PREFIX.length());

        // 2단계 인증이 남았으면 토큰 대신 표를 준다. 프론트는 이메일 로그인과 <b>같은</b> 6자리
        // 화면으로 이어간다 — 경로가 갈리면 한쪽만 고치는 사고가 난다.
        if (value.startsWith(OAuth2SuccessHandler.TOTP_CHALLENGE_MARKER)) {
            return ResponseEntity.ok(
                    Map.of(
                            "totpRequired",
                            "true",
                            "challengeToken",
                            value.substring(OAuth2SuccessHandler.TOTP_CHALLENGE_MARKER.length())));
        }
        // 슬롯에는 접근 토큰과 리프레시 토큰이 줄바꿈으로 묶여 있다.
        String[] parts = value.split(OAuth2SuccessHandler.TOKEN_SEPARATOR, 2);
        Map<String, String> tokens = new java.util.LinkedHashMap<>();
        tokens.put("token", parts[0]);
        if (parts.length > 1) tokens.put("refreshToken", parts[1]);
        return ResponseEntity.ok(tokens);
    }

    /** RFC 7636 의 code_verifier — unreserved 문자 43~128자. */
    static boolean isWellFormedVerifier(String verifier) {
        int n = verifier.length();
        if (n < 43 || n > 128) return false;
        for (int i = 0; i < n; i++) {
            char c = verifier.charAt(i);
            boolean ok =
                    (c >= 'A' && c <= 'Z')
                            || (c >= 'a' && c <= 'z')
                            || (c >= '0' && c <= '9')
                            || c == '-'
                            || c == '.'
                            || c == '_'
                            || c == '~';
            if (!ok) return false;
        }
        return true;
    }

    /** S256 변환 — base64url(SHA-256(verifier)), 패딩 없음. */
    static String sha256Base64Url(String verifier) {
        try {
            byte[] digest =
                    java.security.MessageDigest.getInstance("SHA-256")
                            .digest(verifier.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (java.security.NoSuchAlgorithmException e) {
            // SHA-256 은 JRE 필수 알고리즘이다. 없으면 환경이 깨진 것이라 조용히 넘기면 안 된다.
            throw new IllegalStateException("SHA-256 을 쓸 수 없습니다", e);
        }
    }

    @GetMapping("/check-email")
    public ResponseEntity<Boolean> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(authService.checkEmailExists(email));
    }

    /**
     * 닉네임 + 전화번호로 이메일/provider 조회.
     *
     * <p>미일치 시 {@link AuthService} 가 ResourceNotFoundException 을 던져 404 로 변환된다.
     */
    @GetMapping("/find-email")
    public ResponseEntity<Map<String, String>> findEmail(
            @RequestParam String nickname, @RequestParam String phoneNumber) {
        return ResponseEntity.ok(authService.findEmailByNameAndPhone(nickname, phoneNumber));
    }

    @PostMapping("/email/send")
    public ResponseEntity<String> sendEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (isBlank(email)) {
            return ResponseEntity.badRequest().body("이메일을 입력해주세요.");
        }
        issueNewAuthCode(email, PURPOSE_SIGNUP);
        return ResponseEntity.ok("인증번호가 발송되었습니다.");
    }

    @PostMapping("/email/send-for-pw")
    public ResponseEntity<String> sendEmailForPw(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String nickname = body.get("nickname");
        try {
            authService.checkUserForPasswordReset(email, nickname);
            issueNewAuthCode(email, PURPOSE_PASSWORD_RESET);
            return ResponseEntity.ok("인증번호 발송 완료");
        } catch (RuntimeException e) {
            return mapPasswordResetError(e);
        }
    }

    @PostMapping("/email/verify")
    public ResponseEntity<String> verifyEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");
        String purpose = normalizePurpose(body.get("purpose"));

        if (email == null || code == null) {
            return ResponseEntity.badRequest().body("이메일/코드를 입력해주세요.");
        }

        String savedCode = redisTemplate.opsForValue().get(authCodeKey(email, purpose));
        if (savedCode == null) {
            return ResponseEntity.status(400).body("인증번호가 만료되었거나 발송되지 않았습니다. 다시 발송해주세요.");
        }

        if (savedCode.equals(code)) {
            markEmailVerified(email, purpose);
            return ResponseEntity.ok("인증 성공");
        }
        return handleFailedAttempt(email, purpose);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(
            @Valid @RequestBody ResetPasswordRequestDto request) {
        if (!consumeEmailVerification(request.getEmail(), PURPOSE_PASSWORD_RESET)) {
            return ResponseEntity.status(403).body("이메일 인증이 완료되지 않았거나 만료되었습니다. 다시 인증해주세요.");
        }

        authService.updatePassword(request.getEmail(), request.getNewPassword());
        return ResponseEntity.ok("비밀번호가 성공적으로 변경되었습니다.");
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).body("인증 정보가 유효하지 않습니다.");
        }
        try {
            User user = loadUser(authentication.getName());
            return ResponseEntity.ok(toUserInfo(user));
        } catch (Exception e) {
            log.error("/me 처리 실패: {}", e.getClass().getSimpleName());
            return ResponseEntity.status(500).body("내 정보 조회 중 오류가 발생했습니다.");
        }
    }

    /* ============================== 내부 헬퍼 ============================== */

    private void issueNewAuthCode(String email, String purpose) {
        String authCode = emailService.sendMail(email);
        redisTemplate
                .opsForValue()
                .set(
                        authCodeKey(email, purpose),
                        authCode,
                        AUTH_CODE_TTL_MINUTES,
                        TimeUnit.MINUTES);
        redisTemplate.delete(authAttemptsKey(email, purpose));
    }

    private void markEmailVerified(String email, String purpose) {
        redisTemplate.delete(authCodeKey(email, purpose));
        redisTemplate.delete(authAttemptsKey(email, purpose));
        redisTemplate
                .opsForValue()
                .set(
                        authVerifiedKey(email, purpose),
                        VERIFIED_TRUE,
                        AUTH_VERIFIED_TTL_MINUTES,
                        TimeUnit.MINUTES);
    }

    private boolean consumeEmailVerification(String email, String purpose) {
        return VERIFIED_TRUE.equals(consumeKey(authVerifiedKey(email, purpose)));
    }

    /** 키를 읽고 즉시 삭제한다(1회용 소비). 없으면 null. {@link #GET_DEL_SCRIPT} 참고. */
    private String consumeKey(String key) {
        return redisTemplate.execute(GET_DEL_SCRIPT, List.of(key));
    }

    private ResponseEntity<String> handleFailedAttempt(String email, String purpose) {
        String attemptsKey = authAttemptsKey(email, purpose);
        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        redisTemplate.expire(attemptsKey, AUTH_CODE_TTL_MINUTES, TimeUnit.MINUTES);

        if (attempts != null && attempts >= MAX_VERIFY_ATTEMPTS) {
            redisTemplate.delete(authCodeKey(email, purpose));
            redisTemplate.delete(attemptsKey);
            // 보안(v2.22): 이메일 평문을 로그에 남기지 않는다(PII). 마스킹 후 기록.
            log.warn("인증코드 brute-force 의심: email={}, 시도={}", maskEmail(email), attempts);
            return ResponseEntity.status(429).body("실패 횟수 초과로 인증번호가 폐기되었습니다. 다시 발송해주세요.");
        }

        long remain = MAX_VERIFY_ATTEMPTS - (attempts == null ? 0 : attempts);
        return ResponseEntity.status(400).body("인증번호가 일치하지 않습니다. (남은 시도: " + remain + "회)");
    }

    private ResponseEntity<String> mapPasswordResetError(RuntimeException e) {
        String message = e.getMessage();
        if (message != null && message.startsWith(SOCIAL_USER_ERROR_PREFIX)) {
            return ResponseEntity.status(400).body(message);
        }
        // 우리가 문구를 쓴 예외만 그대로 전달한다. 예전엔 모든 RuntimeException 을 404 +
        // 원문 메시지로 내보냈는데, 그러면 Redis·DB 장애의 내부 구조가 응답에 실리고
        // 게다가 "그런 계정 없음" 이라는 거짓 정보까지 같이 나간다. 인프라 예외는
        // 그대로 올려보내 전역 처리기가 5xx 로 다루게 한다.
        if (e instanceof IllegalArgumentException || e instanceof ResourceNotFoundException) {
            return ResponseEntity.status(404).body(message);
        }
        throw e;
    }

    private User loadUser(String userId) {
        return authService.findUser(userId);
    }

    private Map<String, Object> toUserInfo(User user) {
        Map<String, Object> info = new HashMap<>();
        info.put("userId", user.getUserId());
        info.put("nickname", user.getNickname());
        info.put("role", user.getRole());
        info.put("isPremium", user.isPremium());
        // v2.15.3 — 네이버 OAuth 검수 활용처 증명 + MY 탭 "내 계정" 카드 노출용.
        info.put("email", user.getEmail());
        info.put("picture", user.getPicture());
        return info;
    }

    private boolean isBlank(String s) {
        return s == null || s.isEmpty();
    }

    /** 로그용 이메일 마스킹 — 앞 1글자 + *** + 도메인. PII 평문 로깅 방지. */
    private static String maskEmail(String email) {
        if (email == null || email.isBlank()) return "(none)";
        int at = email.indexOf('@');
        if (at <= 0) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }

    private static String normalizePurpose(String purpose) {
        return PURPOSE_PASSWORD_RESET.equals(purpose) ? PURPOSE_PASSWORD_RESET : PURPOSE_SIGNUP;
    }

    private static String authCodeKey(String email, String purpose) {
        return KEY_AUTH_CODE + purpose + ":" + email;
    }

    private static String authAttemptsKey(String email, String purpose) {
        return KEY_AUTH_ATTEMPTS + purpose + ":" + email;
    }

    private static String authVerifiedKey(String email, String purpose) {
        return KEY_AUTH_VERIFIED + purpose + ":" + email;
    }
}
