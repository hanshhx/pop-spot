package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.admin.AdminAuditService;
import com.example.popspotbackend.service.auth.RefreshTokenService;
import com.example.popspotbackend.service.auth.TotpAuthService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class AuthServiceRefreshTokenTest {

    private static final String SECRET = "test-secret-that-is-at-least-thirty-two-bytes-long";

    @Test
    @DisplayName("전체 로그아웃 전 발급된 갱신 토큰은 새 접근 토큰을 만들 수 없다")
    void rejectsRefreshTokenFromOldSessionVersion() {
        UserRepository users = mock(UserRepository.class);
        RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
        AuthService service =
                new AuthService(
                        users,
                        mock(PasswordEncoder.class),
                        mock(TotpAuthService.class),
                        mock(AdminAuditService.class),
                        refreshTokens,
                        mock(PolicyVersionService.class));

        User user =
                User.builder()
                        .userId("user-1")
                        .email("owner@popspot.co.kr")
                        .accountActive(true)
                        .tokenVersion(8L)
                        .build();
        when(refreshTokens.consume("old-refresh"))
                .thenReturn(new RefreshTokenService.Consumed("user-1", 7L, 1_800_000_000L));
        when(users.findById("user-1")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.refresh("old-refresh"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("로그인이 만료");
    }

    @Test
    @DisplayName("갱신해도 최초 본인 인증 시각을 새 JWT와 다음 갱신 토큰에 보존한다")
    void preservesPrimaryAuthenticationTimeAcrossRefresh() {
        UserRepository users = mock(UserRepository.class);
        RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
        AuthService service = service(users, refreshTokens);
        long authenticatedAt = Instant.now().minusSeconds(300).getEpochSecond();
        User user =
                User.builder()
                        .userId("user-1")
                        .email("owner@popspot.co.kr")
                        .role("USER")
                        .accountActive(true)
                        .tokenVersion(7L)
                        .build();
        when(refreshTokens.consume("valid-refresh"))
                .thenReturn(new RefreshTokenService.Consumed("user-1", 7L, authenticatedAt));
        when(refreshTokens.issue("user-1", 7L, authenticatedAt))
                .thenReturn(new RefreshTokenService.Issued("next-refresh", 604_800L));
        when(users.findById("user-1")).thenReturn(Optional.of(user));

        var response = service.refresh("valid-refresh");

        verify(refreshTokens).issue("user-1", 7L, authenticatedAt);
        assertThat(response.getRefreshToken()).isEqualTo("next-refresh");
        Claims claims =
                Jwts.parserBuilder()
                        .setSigningKey(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                        .build()
                        .parseClaimsJws(response.getToken())
                        .getBody();
        assertThat(claims.get("auth_time", Number.class).longValue()).isEqualTo(authenticatedAt);
    }

    @Test
    @DisplayName("미래 시각으로 손상된 갱신 토큰은 새 접근 토큰을 만들 수 없다")
    void rejectsRefreshTokenWithFutureAuthenticationTime() {
        UserRepository users = mock(UserRepository.class);
        RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
        AuthService service = service(users, refreshTokens);
        long futureAuthenticationTime = Instant.now().plusSeconds(300).getEpochSecond();
        when(refreshTokens.consume("future-refresh"))
                .thenReturn(
                        new RefreshTokenService.Consumed("user-1", 7L, futureAuthenticationTime));

        assertThatThrownBy(() -> service.refresh("future-refresh"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("로그인이 만료");
    }

    private static AuthService service(UserRepository users, RefreshTokenService refreshTokens) {
        AuthService service =
                new AuthService(
                        users,
                        mock(PasswordEncoder.class),
                        mock(TotpAuthService.class),
                        mock(AdminAuditService.class),
                        refreshTokens,
                        mock(PolicyVersionService.class));
        ReflectionTestUtils.setField(service, "jwtSecret", SECRET);
        ReflectionTestUtils.setField(service, "accessTokenValidityMs", 3_600_000L);
        ReflectionTestUtils.setField(service, "adminAccessTokenValidityMs", 1_800_000L);
        ReflectionTestUtils.invokeMethod(service, "initJwtKey");
        return service;
    }
}
