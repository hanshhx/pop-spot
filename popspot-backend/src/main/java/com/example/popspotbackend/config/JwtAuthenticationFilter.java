package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.auth.SessionAuthenticationDetails;
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
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
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
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final int JWT_SECRET_MIN_BYTES = 32;
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String ROLE_PREFIX = "ROLE_";
    private static final String CLAIM_ROLE = "role";

    private final UserRepository userRepository;

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
        String token = extractToken(request);
        if (token != null) {
            if (!tryAuthenticate(token)) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "만료되었거나 유효하지 않은 인증입니다.");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    /**
     * {@code Authorization: Bearer} <b>헤더만</b> 받는다.
     *
     * <p>예전에는 SSE 경로에 한해 {@code ?token=} 폴백이 있었다. {@code EventSource} 가 커스텀 헤더를 못 보내기 때문이었는데, 토큰이
     * URL 에 실리면 프록시·서버 접근 로그에 관리자 토큰이 그대로 남는다. 프론트를 {@code fetch()} 스트리밍으로 바꾸면서 폴백을
     * 없앴다(useSseStream.ts).
     *
     * <p><b>다시 넣지 말 것.</b> 쿼리 파라미터는 로그·Referer·브라우저 기록에 남는 경로가 너무 많다.
     */
    private String extractToken(HttpServletRequest request) {
        String bearerHeader = request.getHeader("Authorization");
        if (bearerHeader != null && bearerHeader.startsWith(BEARER_PREFIX)) {
            return bearerHeader.substring(BEARER_PREFIX.length());
        }
        return null;
    }

    private boolean tryAuthenticate(String token) {
        try {
            Claims claims =
                    Jwts.parserBuilder()
                            .setSigningKey(signingKey)
                            .build()
                            .parseClaimsJws(token)
                            .getBody();
            String userId = claims.getSubject();
            String role = ensureRolePrefix(claims.get(CLAIM_ROLE, String.class));
            if (userId == null || role == null) return false;

            User user = userRepository.findById(userId).orElse(null);
            Number tokenVersion = claims.get("ver", Number.class);
            if (user == null
                    || !user.isAccountActive()
                    || tokenVersion == null
                    || tokenVersion.longValue() != user.getTokenVersion()) {
                return false;
            }

            Number authTimeClaim = claims.get("auth_time", Number.class);
            Instant authenticatedAt;
            boolean primaryAuthenticationVerified;
            if (authTimeClaim != null && authTimeClaim.longValue() > 0) {
                authenticatedAt = Instant.ofEpochSecond(authTimeClaim.longValue());
                primaryAuthenticationVerified = true;
            } else if (claims.getIssuedAt() != null) {
                // 배포 직전 발급된 접근 토큰은 최대 1시간만 남아 있다. 전 사용자를 즉시 로그아웃시키지
                // 않되, 직접 본인 인증 시각을 증명하지 못하므로 민감 작업에는 사용할 수 없게 표시한다.
                authenticatedAt = claims.getIssuedAt().toInstant();
                primaryAuthenticationVerified = false;
            } else {
                return false;
            }
            if (claims.getIssuedAt() != null
                    && authenticatedAt.isAfter(claims.getIssuedAt().toInstant())) {
                return false;
            }

            List<SimpleGrantedAuthority> authorities =
                    Collections.singletonList(new SimpleGrantedAuthority(role));
            UserDetails principal =
                    org.springframework.security.core.userdetails.User.withUsername(userId)
                            .password("")
                            .authorities(authorities)
                            .build();
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(principal, null, authorities);
            authentication.setDetails(
                    new SessionAuthenticationDetails(
                            authenticatedAt, primaryAuthenticationVerified));
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            return true;
        } catch (Exception e) {
            log.warn("JWT 검증 실패: {}", e.getClass().getSimpleName());
            return false;
        }
    }

    private String ensureRolePrefix(String role) {
        if (role == null) return null;
        return role.startsWith(ROLE_PREFIX) ? role : ROLE_PREFIX + role;
    }
}
