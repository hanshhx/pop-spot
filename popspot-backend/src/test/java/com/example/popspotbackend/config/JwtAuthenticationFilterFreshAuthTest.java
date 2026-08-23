package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.auth.SessionAuthenticationDetails;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

class JwtAuthenticationFilterFreshAuthTest {

    private static final String SECRET = "test-secret-that-is-at-least-thirty-two-bytes-long";

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("JWT의 최초 본인 인증 시각을 SecurityContext에 전달한다")
    void preservesAuthenticationTime() {
        UserRepository users = mock(UserRepository.class);
        JwtAuthenticationFilter filter = filter(users);
        User user =
                User.builder()
                        .userId("user-1")
                        .role("USER")
                        .accountActive(true)
                        .tokenVersion(3L)
                        .build();
        when(users.findById("user-1")).thenReturn(Optional.of(user));
        Instant issuedAt = Instant.now().minusSeconds(30);
        Instant authenticatedAt =
                Instant.ofEpochSecond(issuedAt.minusSeconds(300).getEpochSecond());
        String token = token(issuedAt, authenticatedAt, 3L);

        boolean authenticated =
                Boolean.TRUE.equals(
                        ReflectionTestUtils.invokeMethod(filter, "tryAuthenticate", token));

        assertThat(authenticated).isTrue();
        Authentication result = SecurityContextHolder.getContext().getAuthentication();
        assertThat(result.getDetails())
                .isEqualTo(new SessionAuthenticationDetails(authenticatedAt, true));
    }

    @Test
    @DisplayName("auth_time 없는 구형 JWT는 로그인은 유지하되 민감 작업용 인증으로 표시하지 않는다")
    void marksLegacyTokenAsUnverifiedForFreshAuthentication() {
        UserRepository users = mock(UserRepository.class);
        JwtAuthenticationFilter filter = filter(users);
        User user =
                User.builder()
                        .userId("user-1")
                        .role("USER")
                        .accountActive(true)
                        .tokenVersion(3L)
                        .build();
        when(users.findById("user-1")).thenReturn(Optional.of(user));
        Instant issuedAt = Instant.now().minusSeconds(30);
        String token = legacyToken(issuedAt, 3L);

        boolean authenticated =
                Boolean.TRUE.equals(
                        ReflectionTestUtils.invokeMethod(filter, "tryAuthenticate", token));

        assertThat(authenticated).isTrue();
        Authentication result = SecurityContextHolder.getContext().getAuthentication();
        assertThat(result.getDetails())
                .isEqualTo(
                        new SessionAuthenticationDetails(
                                Instant.ofEpochSecond(issuedAt.getEpochSecond()), false));
    }

    @Test
    @DisplayName("JWT 발급 뒤 시각으로 auth_time을 조작하면 인증을 거부한다")
    void rejectsAuthenticationTimeAfterTokenIssue() {
        UserRepository users = mock(UserRepository.class);
        JwtAuthenticationFilter filter = filter(users);
        User user =
                User.builder()
                        .userId("user-1")
                        .role("USER")
                        .accountActive(true)
                        .tokenVersion(3L)
                        .build();
        when(users.findById("user-1")).thenReturn(Optional.of(user));
        Instant issuedAt = Instant.now().minusSeconds(30);

        boolean authenticated =
                Boolean.TRUE.equals(
                        ReflectionTestUtils.invokeMethod(
                                filter,
                                "tryAuthenticate",
                                token(issuedAt, issuedAt.plusSeconds(10), 3L)));

        assertThat(authenticated).isFalse();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private static JwtAuthenticationFilter filter(UserRepository users) {
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(users);
        ReflectionTestUtils.setField(filter, "jwtSecret", SECRET);
        ReflectionTestUtils.invokeMethod(filter, "validateSecret");
        return filter;
    }

    private static String token(Instant issuedAt, Instant authenticatedAt, long version) {
        return Jwts.builder()
                .setSubject("user-1")
                .claim("role", "USER")
                .claim("ver", version)
                .claim("auth_time", authenticatedAt.getEpochSecond())
                .setIssuedAt(Date.from(issuedAt))
                .setExpiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(
                        Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)),
                        SignatureAlgorithm.HS256)
                .compact();
    }

    private static String legacyToken(Instant issuedAt, long version) {
        return Jwts.builder()
                .setSubject("user-1")
                .claim("role", "USER")
                .claim("ver", version)
                .setIssuedAt(Date.from(issuedAt))
                .setExpiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(
                        Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)),
                        SignatureAlgorithm.HS256)
                .compact();
    }
}
