package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * OAuth2 로그인 성공 시 JWT 를 발급하고 프론트 redirectUri 로 리다이렉트.
 *
 * <p>이메일은 provider 별 응답 구조가 달라 google (top-level) / kakao ({@code kakao_account}) / naver ({@code
 * response}) 순서로 탐색한다. JWT 시크릿은 32바이트 이상이어야 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final int JWT_SECRET_MIN_BYTES = 32;
    private static final String CLAIM_ROLE = "role";
    private static final String QUERY_PARAM_CODE = "code";
    public static final String OAUTH_EXCHANGE_KEY_PREFIX = "OAUTH_EXCHANGE:";
    private static final String REDIRECT_NO_EMAIL_QUERY = "?error=no_email";

    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.oauth2.redirect-uri}")
    private String redirectUri;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${jwt.access-token-validity-ms:3600000}")
    private long accessTokenValidityMs;

    private Key signingKey;

    @PostConstruct
    void initKey() {
        if (jwtSecret == null
                || jwtSecret.isBlank()
                || jwtSecret.getBytes(StandardCharsets.UTF_8).length < JWT_SECRET_MIN_BYTES) {
            throw new IllegalStateException(
                    "JWT_SECRET 환경변수 누락/짧음 (" + JWT_SECRET_MIN_BYTES + "B+ 필요)");
        }
        this.signingKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = extractEmail(oAuth2User.getAttributes());
        if (email == null) {
            log.warn("OAuth2 success but email not extracted (provider mismatch?)");
            getRedirectStrategy()
                    .sendRedirect(request, response, redirectUri + REDIRECT_NO_EMAIL_QUERY);
            return;
        }

        User user = findUserOrThrow(email);
        if (!user.isAccountActive()) {
            getRedirectStrategy().sendRedirect(request, response, redirectUri + "?error=inactive");
            return;
        }
        String accessToken = issueJwt(user);
        String exchangeCode = UUID.randomUUID().toString();
        redisTemplate
                .opsForValue()
                .set(OAUTH_EXCHANGE_KEY_PREFIX + exchangeCode, accessToken, 60, TimeUnit.SECONDS);
        String targetUrl =
                UriComponentsBuilder.fromUriString(redirectUri)
                        .queryParam(QUERY_PARAM_CODE, exchangeCode)
                        .build()
                        .toUriString();

        if (log.isDebugEnabled()) {
            log.debug("OAuth2 redirect to {} (one-time exchange code issued)", redirectUri);
        }
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    /* ============================== 내부 헬퍼 ============================== */

    @SuppressWarnings("unchecked")
    private String extractEmail(Map<String, Object> attributes) {
        Object topLevel = attributes.get("email");
        if (topLevel instanceof String s) return s;

        Object kakao = attributes.get("kakao_account");
        if (kakao instanceof Map<?, ?> kakaoMap) {
            Object email = ((Map<String, Object>) kakaoMap).get("email");
            if (email instanceof String s) return s;
        }

        Object naver = attributes.get("response");
        if (naver instanceof Map<?, ?> naverMap) {
            Object email = ((Map<String, Object>) naverMap).get("email");
            if (email instanceof String s) return s;
        }
        return null;
    }

    private User findUserOrThrow(String email) {
        return userRepository
                .findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private String issueJwt(User user) {
        return Jwts.builder()
                .setSubject(user.getUserId())
                .claim(CLAIM_ROLE, user.getRole())
                .claim("ver", user.getTokenVersion())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + accessTokenValidityMs))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }
}
