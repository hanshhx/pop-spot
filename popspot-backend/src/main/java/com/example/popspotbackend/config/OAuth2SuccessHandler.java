package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.AdminAuditLog;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.admin.AdminAuditService;
import com.example.popspotbackend.service.auth.RefreshTokenService;
import com.example.popspotbackend.service.auth.TotpAuthService;
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

    /**
     * 교환 슬롯에 토큰 대신 "2단계 인증이 남았다" 를 담을 때 쓰는 표시.
     *
     * <p>소셜 로그인도 이메일 로그인과 <b>같은 2단계</b>를 거쳐야 한다. 처음에는 이메일 경로에만 붙였는데, 관리자 계정이 카카오로도 들어올 수 있어 그쪽이 통째로
     * 우회하고 있었다. 방어는 가장 약한 경로만큼만 강하다.
     */
    public static final String TOTP_CHALLENGE_MARKER = "TOTP:";

    /**
     * 교환 슬롯 안에서 접근 토큰과 리프레시 토큰을 가르는 구분자.
     *
     * <p>JWT 는 {@code .} 셋으로 이뤄지고 리프레시 토큰은 URL-safe Base64 라, 둘 다 줄바꿈을 포함하지 않는다.
     */
    public static final String TOKEN_SEPARATOR = "\n";

    private static final String REDIRECT_NO_EMAIL_QUERY = "?error=no_email";

    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;
    private final TotpAuthService totpAuth;
    private final AdminAuditService adminAudit;
    private final RefreshTokenService refreshTokens;

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
        String exchangeCode = UUID.randomUUID().toString();

        // 2단계 인증이 켜져 있으면 토큰을 만들지 않는다. 교환 슬롯에는 "코드를 더 받아야 한다" 는
        // 표시와 단기 표만 넣는다 — 토큰을 먼저 만들어 두면 그것만 가로채도 로그인이 끝난다.
        boolean totpPending = totpAuth.isRequiredFor(user);
        // 관리자 접근 토큰은 30분짜리다. 소셜 경로에도 리프레시 토큰을 함께 주지 않으면
        // 이 서비스의 주 관리자(카카오 로그인)가 30분마다 재로그인하게 된다.
        String slotValue =
                totpPending
                        ? TOTP_CHALLENGE_MARKER + totpAuth.issueChallenge(user.getUserId())
                        : issueJwt(user)
                                + TOKEN_SEPARATOR
                                + refreshTokens.issue(user.getUserId()).token();

        // 2단계 인증이 남았으면 아직 로그인이 아니다 — 그 기록은 코드까지 맞힌 뒤
        // AuthService.completeTotpLogin 이 남긴다. 여기서 남기면 코드를 못 맞힌 시도까지
        // "관리자 로그인 성공" 으로 기록된다.
        if (!totpPending) recordAdminLogin(user);

        redisTemplate
                .opsForValue()
                .set(OAUTH_EXCHANGE_KEY_PREFIX + exchangeCode, slotValue, 60, TimeUnit.SECONDS);
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

    /**
     * 관리자 세션이 <b>언제 어떻게</b> 만들어졌는지 감사 표에 남긴다.
     *
     * <p>이메일 로그인과 같은 표에 남겨야 한다. 소셜만 빠지면 "관리자가 언제 들어왔나" 를 물었을 때 절반만 나오는데, 이 서비스의 관리자는 주로 카카오로 들어온다 —
     * 정작 중요한 쪽이 비는 셈이다.
     *
     * <p>{@code endsWith} 로 보는 이유는 role 칸에 {@code "ADMIN"} 과 {@code "ROLE_ADMIN"} 이 둘 다 들어 있을 수 있기
     * 때문이다.
     */
    private void recordAdminLogin(User user) {
        if (user == null) return;
        String role = user.getRole();
        if (role == null || !role.endsWith("ADMIN")) return;
        adminAudit.record(
                user.getUserId(),
                "관리자 로그인",
                AdminAuditLog.TARGET_ADMIN_SELF,
                user.getUserId(),
                true,
                200,
                "소셜");
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
