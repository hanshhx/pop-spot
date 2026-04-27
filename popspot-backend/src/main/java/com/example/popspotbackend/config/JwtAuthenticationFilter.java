package com.example.popspotbackend.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

@Slf4j
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    // 🔒 [보안 강화] 기본값 제거! 환경변수 누락 시 부팅 단계에서 차단됨.
    @Value("${jwt.secret:}")
    private String jwtSecret;

    private java.security.Key signingKey;

    /**
     * 부팅 시 시크릿 길이 검증.
     * - 미설정 / 32바이트 미만이면 즉시 실패.
     * - HS256 은 32바이트 이상 키 필요.
     */
    @PostConstruct
    void validateSecret() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                    "❌ JWT_SECRET 환경변수가 설정되지 않았습니다. " +
                    "운영 환경에서는 반드시 32바이트 이상의 강한 시크릿을 환경변수로 주입해야 합니다.");
        }
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "❌ JWT_SECRET 길이가 너무 짧습니다 (현재 " + keyBytes.length + "B). " +
                    "HS256 은 최소 32B 이상 필요합니다. " +
                    "openssl rand -base64 48 으로 새로 생성하세요.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        log.info("✅ JWT 서명 키 검증 통과 (길이: {}B)", keyBytes.length);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String bearerToken = request.getHeader("Authorization");

        // 운영 환경에서 PII 노출 방지 — Authorization 헤더 자체는 로깅하지 않음
        if (log.isDebugEnabled()) {
            log.debug("📡 [Filter] {} | Auth header present={}",
                    request.getRequestURI(), bearerToken != null);
        }

        String token = null;
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            token = bearerToken.substring(7);
        }

        if (token != null) {
            try {
                Claims claims = Jwts.parserBuilder()
                        .setSigningKey(signingKey)
                        .build()
                        .parseClaimsJws(token)
                        .getBody();

                String userId = claims.getSubject();
                String role = claims.get("role", String.class);

                if (role != null && !role.startsWith("ROLE_")) {
                    role = "ROLE_" + role;
                }

                if (userId != null && role != null) {
                    List<SimpleGrantedAuthority> authorities =
                            Collections.singletonList(new SimpleGrantedAuthority(role));
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userId, null, authorities);

                    SecurityContext context = SecurityContextHolder.createEmptyContext();
                    context.setAuthentication(authentication);
                    SecurityContextHolder.setContext(context);

                    if (log.isDebugEnabled()) {
                        log.debug("✅ [Filter] 인증 성공 userId={}, role={}", userId, role);
                    }
                }
            } catch (Exception e) {
                // 운영에서는 토큰 자체나 스택트레이스 노출 금지
                log.warn("❌ [Filter] JWT 검증 실패: {}", e.getClass().getSimpleName());
            }
        }

        filterChain.doFilter(request, response);
    }
}
