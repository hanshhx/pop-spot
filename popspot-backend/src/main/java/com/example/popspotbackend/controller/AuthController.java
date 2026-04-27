package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.SignupRequestDto;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.AuthService;
import com.example.popspotbackend.service.EmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final EmailService emailService;
    private final StringRedisTemplate redisTemplate;
    private final UserRepository userRepository;

    /** 인증코드 검증 시도 한도 — 초과 시 코드 무효화 + 신규 발송 강제 */
    private static final int MAX_VERIFY_ATTEMPTS = 5;

    @PostMapping("/signup")
    public ResponseEntity<String> signup(@Valid @RequestBody SignupRequestDto requestDto) {
        String userId = authService.signup(requestDto);
        return ResponseEntity.ok("회원가입 성공! User ID: " + userId);
    }

    @GetMapping("/find-email")
    public ResponseEntity<?> findEmail(@RequestParam String nickname, @RequestParam String phoneNumber) {
        try {
            Map<String, String> result = authService.findEmailByNameAndPhone(nickname, phoneNumber);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body("가입된 정보가 없습니다.");
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String newPassword = request.get("newPassword");

        String verifiedStatus = redisTemplate.opsForValue().get("AUTH_VERIFIED:" + email);
        if (verifiedStatus == null || !verifiedStatus.equals("TRUE")) {
            return ResponseEntity.status(403).body("이메일 인증이 완료되지 않았거나 만료되었습니다. 다시 인증해주세요.");
        }

        authService.updatePassword(email, newPassword);
        redisTemplate.delete("AUTH_VERIFIED:" + email);

        return ResponseEntity.ok("비밀번호가 성공적으로 변경되었습니다.");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody com.example.popspotbackend.dto.LoginRequestDto requestDto) {
        com.example.popspotbackend.dto.LoginResponseDto response = authService.login(requestDto);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/email/send")
    public ResponseEntity<String> sendEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isEmpty()) {
            return ResponseEntity.badRequest().body("이메일을 입력해주세요.");
        }
        String authCode = emailService.sendMail(email);
        redisTemplate.opsForValue().set("AUTH_CODE:" + email, authCode, 5, TimeUnit.MINUTES);
        // 새 코드 발송 시 검증 시도 횟수 리셋
        redisTemplate.delete("AUTH_ATTEMPTS:" + email);
        return ResponseEntity.ok("인증번호가 발송되었습니다.");
    }

    /**
     * 변경 사항: 5회 이상 실패 시 코드 무효화 (brute-force 방어)
     */
    @PostMapping("/email/verify")
    public ResponseEntity<String> verifyEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");

        if (email == null || code == null) {
            return ResponseEntity.badRequest().body("이메일/코드를 입력해주세요.");
        }

        String attemptsKey = "AUTH_ATTEMPTS:" + email;
        String savedCode = redisTemplate.opsForValue().get("AUTH_CODE:" + email);

        if (savedCode == null) {
            return ResponseEntity.status(400).body("인증번호가 만료되었거나 발송되지 않았습니다. 다시 발송해주세요.");
        }

        if (savedCode.equals(code)) {
            redisTemplate.delete("AUTH_CODE:" + email);
            redisTemplate.delete(attemptsKey);
            redisTemplate.opsForValue().set("AUTH_VERIFIED:" + email, "TRUE", 10, TimeUnit.MINUTES);
            return ResponseEntity.ok("인증 성공");
        }

        // 실패 카운트 증가
        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        // 카운터에도 TTL 부여 (코드 만료와 동일 5분)
        redisTemplate.expire(attemptsKey, 5, TimeUnit.MINUTES);

        if (attempts != null && attempts >= MAX_VERIFY_ATTEMPTS) {
            redisTemplate.delete("AUTH_CODE:" + email);
            redisTemplate.delete(attemptsKey);
            log.warn("⛔ 인증코드 brute-force 의심: email={}, 시도={}", email, attempts);
            return ResponseEntity.status(429).body("실패 횟수 초과로 인증번호가 폐기되었습니다. 다시 발송해주세요.");
        }

        long remain = MAX_VERIFY_ATTEMPTS - (attempts == null ? 0 : attempts);
        return ResponseEntity.status(400).body("인증번호가 일치하지 않습니다. (남은 시도: " + remain + "회)");
    }

    @GetMapping("/check-email")
    public ResponseEntity<Boolean> checkEmail(@RequestParam String email) {
        boolean exists = authService.checkEmailExists(email);
        return ResponseEntity.ok(exists);
    }

    @PostMapping("/email/send-for-pw")
    public ResponseEntity<String> sendEmailForPw(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String nickname = body.get("nickname");
        try {
            authService.checkUserForPasswordReset(email, nickname);
            String authCode = emailService.sendMail(email);
            redisTemplate.opsForValue().set("AUTH_CODE:" + email, authCode, 5, TimeUnit.MINUTES);
            redisTemplate.delete("AUTH_ATTEMPTS:" + email);
            return ResponseEntity.ok("인증번호 발송 완료");
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().startsWith("SOCIAL_USER")) {
                return ResponseEntity.status(400).body(e.getMessage());
            }
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).body("인증 정보가 유효하지 않습니다.");
        }
        try {
            String userId = authentication.getName();
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

            Map<String, Object> userInfo = new HashMap<>();
            userInfo.put("userId", user.getUserId());
            userInfo.put("nickname", user.getNickname());
            userInfo.put("role", user.getRole());
            userInfo.put("isPremium", user.isPremium());

            return ResponseEntity.ok(userInfo);
        } catch (Exception e) {
            log.error("/me 처리 실패: {}", e.getClass().getSimpleName());
            return ResponseEntity.status(500).body("내 정보 조회 중 오류가 발생했습니다.");
        }
    }
}
