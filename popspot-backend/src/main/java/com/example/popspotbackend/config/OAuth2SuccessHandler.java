package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;

    @Value("${app.oauth2.redirect-uri}")
    private String redirectUri;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${jwt.access-token-validity-ms:3600000}")
    private long accessTokenValidityMs;

    private java.security.Key signingKey;

    @PostConstruct
    void initKey() {
        if (jwtSecret == null || jwtSecret.isBlank()
                || jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET 환경변수 누락/짧음 (32B+ 필요)");
        }
        this.signingKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    @SuppressWarnings("unchecked")
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        Map<String, Object> attributes = oAuth2User.getAttributes();

        String extractedEmail = (String) attributes.get("email");
        if (extractedEmail == null) {
            Object kakaoRaw = attributes.get("kakao_account");
            if (kakaoRaw instanceof Map<?, ?> kakaoAccount) {
                extractedEmail = (String) ((Map<String, Object>) kakaoAccount).get("email");
            } else {
                Object naverRaw = attributes.get("response");
                if (naverRaw instanceof Map<?, ?> responseMap) {
                    extractedEmail = (String) ((Map<String, Object>) responseMap).get("email");
                }
            }
        }

        if (extractedEmail == null) {
            log.warn("OAuth2 success but email not extracted (provider mismatch?)");
            getRedirectStrategy().sendRedirect(request, response, redirectUri + "?error=no_email");
            return;
        }

        String finalEmail = extractedEmail;
        User user = userRepository.findByEmail(finalEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String accessToken = Jwts.builder()
                .setSubject(user.getUserId())
                .claim("role", user.getRole())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + accessTokenValidityMs))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();

        String targetUrl = UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("token", accessToken)
                .build().toUriString();

        if (log.isDebugEnabled()) {
            // PII 보호 — 토큰 절대 로그에 노출하지 말 것
            log.debug("🔗 OAuth2 redirect to {} (token length={}B)", redirectUri, accessToken.length());
        }
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}
