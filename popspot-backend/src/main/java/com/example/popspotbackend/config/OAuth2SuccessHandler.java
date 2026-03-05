package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;

    @Value("${app.oauth2.redirect-uri}")
    private String redirectUri;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException {
        log.info("🚀 [OAuth2SuccessHandler] === 로그인 성공 프로세스 시작 ===");

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        Map<String, Object> attributes = oAuth2User.getAttributes();

        String extractedEmail = (String) attributes.get("email");

        if (extractedEmail == null) {
            Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
            if (kakaoAccount != null) {
                extractedEmail = (String) kakaoAccount.get("email");
            } else {
                Map<String, Object> responseMap = (Map<String, Object>) attributes.get("response");
                if (responseMap != null) {
                    extractedEmail = (String) responseMap.get("email");
                }
            }
        }

        String finalEmail = extractedEmail;
        log.info("📧 [추출된 이메일]: {}", finalEmail);

        User user = userRepository.findByEmail(finalEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + finalEmail));

        log.info("👤 [확인된 유저]: ID={}, 닉네임={}, 역할={}", user.getUserId(), user.getNickname(), user.getRole());

        String accessToken = "TEMP_TOKEN_" + user.getUserId();

        ResponseCookie cookie = ResponseCookie.from("accessToken", accessToken)
                .path("/")
                .maxAge(60 * 5)
                .httpOnly(false)
                .secure(true)
                .sameSite("None")
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        // 🔥 [보안 고도화] 프론트엔드로 보낼 때 이 유저의 권한(role)도 암호화된 URL 파라미터로 명시적으로 넘겨줍니다.
        String targetUrl = UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("accessToken", accessToken)
                .queryParam("userId", user.getUserId())
                .queryParam("nickname", URLEncoder.encode(user.getNickname(), StandardCharsets.UTF_8))
                .queryParam("isPremium", user.isPremium())
                .queryParam("role", user.getRole()) // 👈 이 부분이 추가되었습니다!
                .build().toUriString();

        log.info("🔗 [최종 리다이렉트 주소]: {}", targetUrl);
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}