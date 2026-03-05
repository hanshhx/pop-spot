package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.SignupRequestDto;
import com.example.popspotbackend.service.AuthService;
import com.example.popspotbackend.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final EmailService emailService;

    // 인증번호 저장소
    private static final Map<String, String> emailAuthStore = new ConcurrentHashMap<>();

    // ================= [기존 코드 유지] =================

    // 회원가입 API
    @PostMapping("/signup")
    public ResponseEntity<String> signup(@RequestBody SignupRequestDto requestDto) {
        String userId = authService.signup(requestDto);
        return ResponseEntity.ok("회원가입 성공! User ID: " + userId);
    }

    // [수정됨] 아이디 찾기 API (이름 + 전화번호로 찾기, 가입경로 반환)
    @GetMapping("/find-email")
    public ResponseEntity<?> findEmail(@RequestParam String nickname, @RequestParam String phoneNumber) {
        try {
            // AuthService에서 {email: "...", provider: "..."} 형태의 Map을 반환함
            Map<String, String> result = authService.findEmailByNameAndPhone(nickname, phoneNumber);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body("가입된 정보가 없습니다.");
        }
    }

    // 비밀번호 재설정 API (최종 변경)
    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String newPassword = request.get("newPassword");

        authService.updatePassword(email, newPassword);

        return ResponseEntity.ok("비밀번호가 성공적으로 변경되었습니다.");
    }

    // 로그인 API
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody com.example.popspotbackend.dto.LoginRequestDto requestDto) {
        com.example.popspotbackend.dto.LoginResponseDto response = authService.login(requestDto);
        return ResponseEntity.ok(response);
    }

    // ================= [이메일 인증 API] =================

    // [회원가입용] 이메일 인증번호 발송 API
    @PostMapping("/email/send")
    public ResponseEntity<String> sendEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");

        if (email == null || email.isEmpty()) {
            return ResponseEntity.badRequest().body("이메일을 입력해주세요.");
        }

        String authCode = emailService.sendMail(email);
        emailAuthStore.put(email, authCode);

        return ResponseEntity.ok("인증번호가 발송되었습니다.");
    }

    // [공통] 이메일 인증번호 검증 API
    @PostMapping("/email/verify")
    public ResponseEntity<String> verifyEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");

        String savedCode = emailAuthStore.get(email);

        if (savedCode != null && savedCode.equals(code)) {
            emailAuthStore.remove(email);
            return ResponseEntity.ok("인증 성공");
        } else {
            return ResponseEntity.status(400).body("인증번호가 일치하지 않습니다.");
        }
    }

    // 이메일 존재 여부 확인 API (단순 체크용)
    @GetMapping("/check-email")
    public ResponseEntity<Boolean> checkEmail(@RequestParam String email) {
        boolean exists = authService.checkEmailExists(email);
        return ResponseEntity.ok(exists);
    }

    // ================= [🔥 새로 추가된 기능: 비밀번호 찾기용 메일 발송] =================

    /**
     * [추가] 비밀번호 찾기 전용 인증메일 발송
     * 1. 이메일과 이름이 일치하는지 확인
     * 2. 소셜 로그인 유저인지 확인 (소셜이면 에러 발생)
     * 3. 통과하면 인증메일 발송
     */
    @PostMapping("/email/send-for-pw")
    public ResponseEntity<String> sendEmailForPw(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String nickname = body.get("nickname");

        try {
            // 소셜 회원 체크 및 정보 일치 확인
            authService.checkUserForPasswordReset(email, nickname);

            // 통과했으면(LOCAL 회원이면) 메일 발송
            String authCode = emailService.sendMail(email);
            emailAuthStore.put(email, authCode);

            return ResponseEntity.ok("인증번호 발송 완료");

        } catch (RuntimeException e) {
            // 소셜 회원이면 "SOCIAL_USER:kakao" 같은 메시지가 옴 -> 400 Bad Request
            if (e.getMessage().startsWith("SOCIAL_USER")) {
                return ResponseEntity.status(400).body(e.getMessage());
            }
            // 그 외(정보 불일치 등) -> 404 Not Found
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }
}