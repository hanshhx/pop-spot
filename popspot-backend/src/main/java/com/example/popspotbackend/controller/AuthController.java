package com.example.popspotbackend.controller;

import com.example.popspotbackend.config.OAuth2SuccessHandler;
import com.example.popspotbackend.dto.LoginRequestDto;
import com.example.popspotbackend.dto.LoginResponseDto;
import com.example.popspotbackend.dto.ResetPasswordRequestDto;
import com.example.popspotbackend.dto.SignupRequestDto;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.service.AuthService;
import com.example.popspotbackend.service.EmailService;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
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

    @PostMapping("/oauth/exchange")
    public ResponseEntity<?> exchangeOAuthCode(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (isBlank(code) || code.length() > 100) {
            return ResponseEntity.badRequest().body("유효하지 않은 로그인 교환 코드입니다.");
        }
        String token =
                redisTemplate
                        .opsForValue()
                        .getAndDelete(OAuth2SuccessHandler.OAUTH_EXCHANGE_KEY_PREFIX + code);
        if (token == null) {
            return ResponseEntity.status(401).body("로그인 교환 코드가 만료되었거나 이미 사용되었습니다.");
        }
        return ResponseEntity.ok(Map.of("token", token));
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
        return VERIFIED_TRUE.equals(
                redisTemplate.opsForValue().getAndDelete(authVerifiedKey(email, purpose)));
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
        return ResponseEntity.status(404).body(message);
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
