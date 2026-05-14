package com.example.popspotbackend.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Collections;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 매 요청마다 Authorization Bearer 토큰을 검증해 SecurityContext 에 인증 정보를 채우는 필터.
 *
 * <p>운영 PII 노출 방지를 위해 토큰 / 헤더 자체는 로그에 절대 남기지 않는다. 시크릿은 32바이트 이상이어야 하며 미설정 / 짧으면 부팅 단계에서 차단된다 (배포 사고
 * 예방).
 */
@Slf4j
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final int JWT_SECRET_MIN_BYTES = 32;
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String ROLE_PREFIX = "ROLE_";
    private static final String CLAIM_ROLE = "role";

    @Value("${jwt.secret:}")
    private String jwtSecret;

    private Key signingKey;

    @PostConstruct
    void validateSecret() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                    "JWT_SECRET 환경변수가 설정되지 않았습니다. "
                            + "운영 환경에서는 반드시 32바이트 이상의 강한 시크릿을 환경변수로 주입해야 합니다.");
        }
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < JWT_SECRET_MIN_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET 길이가 너무 짧습니다 (현재 "
                            + keyBytes.length
                            + "B). HS256 은 최소 "
                            + JWT_SECRET_MIN_BYTES
                            + "B 이상 필요합니다. openssl rand -base64 48 으로 새로 생성하세요.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        log.info("JWT 서명 키 검증 통과 (길이: {}B)", keyBytes.length);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = extractToken(request.getHeader("Authorization"));
        if (token != null) {
            tryAuthenticate(token);
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(String bearerHeader) {
        if (bearerHeader == null || !bearerHeader.startsWith(BEARER_PREFIX)) return null;
        return bearerHeader.substring(BEARER_PREFIX.length());
    }

    private void tryAuthenticate(String token) {
        try {
            Claims claims =
                    Jwts.parserBuilder()
                            .setSigningKey(signingKey)
                            .build()
                            .parseClaimsJws(token)
                            .getBody();
            String userId = claims.getSubject();
            String role = ensureRolePrefix(claims.get(CLAIM_ROLE, String.class));
            if (userId == null || role == null) return;

            List<SimpleGrantedAuthority> authorities =
                    Collections.singletonList(new SimpleGrantedAuthority(role));
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(
                    new UsernamePasswordAuthenticationToken(userId, null, authorities));
            SecurityContextHolder.setContext(context);
        } catch (Exception e) {
            log.warn("JWT 검증 실패: {}", e.getClass().getSimpleName());
        }
    }

    private String ensureRolePrefix(String role) {
        if (role == null) return null;
        return role.startsWith(ROLE_PREFIX) ? role : ROLE_PREFIX + role;
    }
}
