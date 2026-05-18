package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.LoginRequestDto;
import com.example.popspotbackend.dto.LoginResponseDto;
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

    private static final String SOCIAL_USER_ERROR_PREFIX = "SOCIAL_USER";

    private final AuthService authService;
    private final EmailService emailService;
    private final StringRedisTemplate redisTemplate;

    @PostMapping("/signup")
    public ResponseEntity<String> signup(@Valid @RequestBody SignupRequestDto requestDto) {
        String userId = authService.signup(requestDto);
        return ResponseEntity.ok("회원가입 성공! User ID: " + userId);
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDto> login(@RequestBody LoginRequestDto requestDto) {
        return ResponseEntity.ok(authService.login(requestDto));
    }

    @GetMapping("/check-email")
    public ResponseEntity<Boolean> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(authService.checkEmailExists(email));
    }

    @GetMapping("/find-email")
    public ResponseEntity<?> findEmail(
            @RequestParam String nickname, @RequestParam String phoneNumber) {
        try {
            return ResponseEntity.ok(authService.findEmailByNameAndPhone(nickname, phoneNumber));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body("가입된 정보가 없습니다.");
        }
    }

    @PostMapping("/email/send")
    public ResponseEntity<String> sendEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (isBlank(email)) {
            return ResponseEntity.badRequest().body("이메일을 입력해주세요.");
        }
        issueNewAuthCode(email);
        return ResponseEntity.ok("인증번호가 발송되었습니다.");
    }

    @PostMapping("/email/send-for-pw")
    public ResponseEntity<String> sendEmailForPw(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String nickname = body.get("nickname");
        try {
            authService.checkUserForPasswordReset(email, nickname);
            issueNewAuthCode(email);
            return ResponseEntity.ok("인증번호 발송 완료");
        } catch (RuntimeException e) {
            return mapPasswordResetError(e);
        }
    }

    @PostMapping("/email/verify")
    public ResponseEntity<String> verifyEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");

        if (email == null || code == null) {
            return ResponseEntity.badRequest().body("이메일/코드를 입력해주세요.");
        }

        String savedCode = redisTemplate.opsForValue().get(KEY_AUTH_CODE + email);
        if (savedCode == null) {
            return ResponseEntity.status(400).body("인증번호가 만료되었거나 발송되지 않았습니다. 다시 발송해주세요.");
        }

        if (savedCode.equals(code)) {
            markEmailVerified(email);
            return ResponseEntity.ok("인증 성공");
        }
        return handleFailedAttempt(email);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String newPassword = request.get("newPassword");

        if (!isEmailVerified(email)) {
            return ResponseEntity.status(403).body("이메일 인증이 완료되지 않았거나 만료되었습니다. 다시 인증해주세요.");
        }

        authService.updatePassword(email, newPassword);
        redisTemplate.delete(KEY_AUTH_VERIFIED + email);
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

    private void issueNewAuthCode(String email) {
        String authCode = emailService.sendMail(email);
        redisTemplate
                .opsForValue()
                .set(KEY_AUTH_CODE + email, authCode, AUTH_CODE_TTL_MINUTES, TimeUnit.MINUTES);
        redisTemplate.delete(KEY_AUTH_ATTEMPTS + email);
    }

    private void markEmailVerified(String email) {
        redisTemplate.delete(KEY_AUTH_CODE + email);
        redisTemplate.delete(KEY_AUTH_ATTEMPTS + email);
        redisTemplate
                .opsForValue()
                .set(
                        KEY_AUTH_VERIFIED + email,
                        VERIFIED_TRUE,
                        AUTH_VERIFIED_TTL_MINUTES,
                        TimeUnit.MINUTES);
    }

    private boolean isEmailVerified(String email) {
        return VERIFIED_TRUE.equals(redisTemplate.opsForValue().get(KEY_AUTH_VERIFIED + email));
    }

    private ResponseEntity<String> handleFailedAttempt(String email) {
        String attemptsKey = KEY_AUTH_ATTEMPTS + email;
        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        redisTemplate.expire(attemptsKey, AUTH_CODE_TTL_MINUTES, TimeUnit.MINUTES);

        if (attempts != null && attempts >= MAX_VERIFY_ATTEMPTS) {
            redisTemplate.delete(KEY_AUTH_CODE + email);
            redisTemplate.delete(attemptsKey);
            log.warn("인증코드 brute-force 의심: email={}, 시도={}", email, attempts);
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
        return info;
    }

    private boolean isBlank(String s) {
        return s == null || s.isEmpty();
    }
}
