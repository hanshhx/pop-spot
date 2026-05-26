package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.UserRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * v2.19 — 약관 버전 관리 API.
 *
 * <p>두 엔드포인트:
 *
 * <ul>
 *   <li>{@code GET /api/v1/terms/status} — 현재 약관 버전 + 본인 동의 버전 + 재동의 필요 여부
 *   <li>{@code POST /api/v1/terms/accept} — 본인의 동의 버전을 현재로 업데이트
 * </ul>
 *
 * <p>현재 약관 버전은 환경변수 {@code popspot.terms.current-version} 로 관리. 약관 / 개인정보
 * 처리방침을 개정할 때마다 이 값을 올리면 (예: 1.0 → 2.0) 모든 사용자에게 재동의 모달이 노출.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/terms")
@RequiredArgsConstructor
public class TermsController {

    private final UserRepository userRepository;

    @Value("${popspot.terms.current-version:1.0}")
    private String currentVersion;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(Authentication authentication) {
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("currentVersion", currentVersion);

        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            // 비로그인 — 동의 정보 없음. 프론트가 약관 모달 보여줄 필요 없음.
            result.put("agreedVersion", null);
            result.put("needsReConsent", false);
            return ResponseEntity.ok(result);
        }

        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));
        String agreed = user.getAgreedTermsVersion();
        result.put("agreedVersion", agreed);
        result.put("needsReConsent", agreed == null || !agreed.equals(currentVersion));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/accept")
    @Transactional
    public ResponseEntity<Map<String, Object>> accept(Authentication authentication) {
        String userId = requireAuthenticatedUserId(authentication);
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));
        user.setAgreedTermsVersion(currentVersion);
        userRepository.save(user);
        log.info("[Terms] 사용자 {} 약관 v{} 동의 완료", userId, currentVersion);
        return ResponseEntity.ok(Map.of("status", "ACCEPTED", "version", currentVersion));
    }

    /* ============================== 내부 헬퍼 ============================== */

    private String authenticatedUserId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            return null;
        }
        return authentication.getName();
    }

    private String requireAuthenticatedUserId(Authentication authentication) {
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            throw new SecurityException("로그인이 필요합니다.");
        }
        return userId;
    }
}
