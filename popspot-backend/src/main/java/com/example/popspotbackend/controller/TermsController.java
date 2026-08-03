package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.AccountDeletionService;
import com.example.popspotbackend.service.PolicyVersionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
 * <p>현재 약관 버전은 환경변수 {@code popspot.terms.current-version} 로 관리. 약관 / 개인정보 처리방침을 개정할 때마다 이 값을 올리면
 * (예: 1.0 → 2.0) 모든 사용자에게 재동의 모달이 노출.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/terms")
@RequiredArgsConstructor
public class TermsController {

    private final UserRepository userRepository;
    private final PolicyVersionService policyVersions;
    private final AccountDeletionService accountDeletionService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(Authentication authentication) {
        Map<String, Object> result = new java.util.HashMap<>();
        String currentTermsVersion = policyVersions.publishedTermsVersion();
        String currentPrivacyVersion = policyVersions.publishedPrivacyVersion();
        result.put("currentVersion", currentTermsVersion); // 이전 프론트 호환
        result.put("currentTermsVersion", currentTermsVersion);
        result.put("currentPrivacyVersion", currentPrivacyVersion);
        result.put("consentEffectiveDate", policyVersions.consentEffectiveDate().toString());

        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            // 비로그인 — 동의 정보 없음. 프론트가 약관 모달 보여줄 필요 없음.
            result.put("agreedVersion", null);
            result.put("agreedTermsVersion", null);
            result.put("agreedPrivacyVersion", null);
            result.put("age14OrOlderVerified", false);
            result.put("needsReConsent", false);
            return ResponseEntity.ok(result);
        }

        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));
        String agreed = user.getAgreedTermsVersion();
        result.put("agreedVersion", agreed);
        result.put("agreedTermsVersion", agreed);
        result.put("agreedPrivacyVersion", user.getAgreedPrivacyVersion());
        result.put("age14OrOlderVerified", user.getAge14VerifiedAt() != null);
        result.put("needsReConsent", !policyVersions.hasRequiredConsent(user));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/accept")
    @Transactional
    public ResponseEntity<Map<String, Object>> accept(
            Authentication authentication, @Valid @RequestBody ConsentRequest request) {
        String userId = requireAuthenticatedUserId(authentication);
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));
        String currentTermsVersion = policyVersions.publishedTermsVersion();
        String currentPrivacyVersion = policyVersions.publishedPrivacyVersion();
        user.recordPolicyConsent(currentTermsVersion, currentPrivacyVersion);
        userRepository.save(user);
        log.info(
                "[Terms] 사용자 {} 약관 v{} / 개인정보 v{} 동의 완료",
                userId,
                currentTermsVersion,
                currentPrivacyVersion);
        return ResponseEntity.ok(
                Map.of(
                        "status", "ACCEPTED",
                        "termsVersion", currentTermsVersion,
                        "privacyVersion", currentPrivacyVersion));
    }

    /** 정책 동의를 거절하면 로그아웃한다. 아직 한 번도 동의하지 않은 신규 소셜 계정은 수집된 프로필을 남기지 않도록 계정 자체를 함께 삭제한다. */
    @PostMapping("/decline")
    public ResponseEntity<Map<String, Object>> decline(Authentication authentication) {
        String userId = requireAuthenticatedUserId(authentication);
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));
        boolean pendingOAuthAccount =
                PolicyVersionService.PENDING_CONSENT_VERSION.equals(user.getAgreedTermsVersion())
                        || PolicyVersionService.PENDING_CONSENT_VERSION.equals(
                                user.getAgreedPrivacyVersion());
        if (pendingOAuthAccount) {
            accountDeletionService.deleteAccount(userId);
            log.info("[Terms] 정책 미동의 신규 소셜 계정 삭제 userId={}", userId);
        }
        return ResponseEntity.ok(
                Map.of("status", "DECLINED", "accountDeleted", pendingOAuthAccount));
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class ConsentRequest {
        @AssertTrue(message = "만 14세 이상 확인이 필요합니다.")
        private boolean age14OrOlder;

        @AssertTrue(message = "이용약관 동의가 필요합니다.")
        private boolean termsAccepted;

        @AssertTrue(message = "개인정보 처리방침 동의가 필요합니다.")
        private boolean privacyAccepted;
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
