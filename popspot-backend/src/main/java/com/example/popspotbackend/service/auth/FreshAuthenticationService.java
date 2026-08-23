package com.example.popspotbackend.service.auth;

import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** 도난된 장수 세션으로 회원 탈퇴 같은 되돌릴 수 없는 작업을 실행하지 못하게 한다. */
@Service
public class FreshAuthenticationService {

    private static final Duration ALLOWED_FUTURE_CLOCK_SKEW = Duration.ofMinutes(1);

    private final Duration maximumAge;

    public FreshAuthenticationService(
            @Value("${app.security.account-deletion-reauth-minutes:10}") long maximumAgeMinutes) {
        if (maximumAgeMinutes <= 0 || maximumAgeMinutes > 60) {
            throw new IllegalArgumentException("회원 탈퇴 재인증 시간은 1~60분이어야 합니다.");
        }
        this.maximumAge = Duration.ofMinutes(maximumAgeMinutes);
    }

    public void requireFresh(Authentication authentication) {
        Instant now = Instant.now();
        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getDetails() instanceof SessionAuthenticationDetails details)
                || !details.primaryAuthenticationVerified()
                || details.authenticatedAt() == null
                || details.authenticatedAt().isAfter(now.plus(ALLOWED_FUTURE_CLOCK_SKEW))
                || details.authenticatedAt().isBefore(now.minus(maximumAge))) {
            throw new ResponseStatusException(
                    HttpStatus.PRECONDITION_REQUIRED, "보안을 위해 다시 로그인한 뒤 회원 탈퇴를 진행해 주세요.");
        }
    }
}
