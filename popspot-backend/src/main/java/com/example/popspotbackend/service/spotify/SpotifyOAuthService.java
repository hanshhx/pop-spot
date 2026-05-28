package com.example.popspotbackend.service.spotify;

import com.example.popspotbackend.entity.SpotifyAuth;
import com.example.popspotbackend.repository.SpotifyAuthRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * v2.21-S10 — Spotify OAuth Authorization Code Flow.
 *
 * <p>흐름:
 *
 * <ol>
 *   <li>{@link #buildAuthorizationUrl} — 사용자를 Spotify 로그인 화면으로 보내는 URL 생성
 *   <li>Spotify → popspot 콜백 URL 로 {@code code} 전달
 *   <li>{@link #handleCallback} — code 를 access/refresh token 으로 교환 + DB 저장
 *   <li>{@link #getValidAccessToken} — 호출 시점 access token 반환 (만료 임박 시 refresh 자동)
 * </ol>
 *
 * <p>Scope: streaming (Web Playback SDK), user-read-email (사용자 식별), user-read-private (Premium
 * 여부). 그 외 scope 는 요청하지 않음 — Spotify 검수 시 "최소 권한 원칙" 검사 항목.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpotifyOAuthService {

    private static final String AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
    private static final String TOKEN_URL = "https://accounts.spotify.com/api/token";
    private static final String ME_URL = "https://api.spotify.com/v1/me";
    private static final String SCOPE = "streaming user-read-email user-read-private";
    private static final long REFRESH_GRACE_SECONDS = 60;

    @Value("${spotify.oauth.client-id:}")
    private String clientId;

    @Value("${spotify.oauth.client-secret:}")
    private String clientSecret;

    @Value("${spotify.oauth.redirect-uri:}")
    private String redirectUri;

    private final SpotifyAuthRepository repo;
    private final TokenEncryption encryption;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    /** Spotify 로그인 페이지 URL. 사용자를 redirect 시키면 됨. */
    public String buildAuthorizationUrl(String state) {
        ensureClientConfigured();
        return UriComponentsBuilder.fromUriString(AUTHORIZE_URL)
                .queryParam("client_id", clientId)
                .queryParam("response_type", "code")
                .queryParam("redirect_uri", redirectUri)
                .queryParam("scope", SCOPE)
                .queryParam("state", state)
                .queryParam("show_dialog", "false")
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUriString();
    }

    /** code → token 교환 + DB upsert. 같은 사용자가 재연결하면 기존 row 갱신. */
    @Transactional
    public SpotifyAuth handleCallback(String popspotUserId, String code) {
        ensureClientConfigured();
        TokenResponse tokens = exchangeCode(code);
        SpotifyMe me = fetchMe(tokens.accessToken());

        SpotifyAuth auth = repo.findByUserId(popspotUserId).orElseGet(SpotifyAuth::new);
        auth.setUserId(popspotUserId);
        auth.setSpotifyUserId(me.id());
        auth.setAccessTokenEncrypted(encryption.encrypt(tokens.accessToken()));
        auth.setRefreshTokenEncrypted(encryption.encrypt(tokens.refreshToken()));
        auth.setExpiresAt(LocalDateTime.now().plusSeconds(tokens.expiresIn()));
        auth.setIsPremium("premium".equalsIgnoreCase(me.product()));
        return repo.save(auth);
    }

    /**
     * 호출 시점 유효한 access token. 만료 임박 (60초 안) 이면 refresh_token 으로 자동 갱신 후 새 토큰 반환.
     *
     * @return access token 평문 (호출자가 Spotify API 헤더에 넣어 쓰는 용도)
     */
    @Transactional
    public String getValidAccessToken(String popspotUserId) {
        SpotifyAuth auth =
                repo.findByUserId(popspotUserId)
                        .orElseThrow(() -> new IllegalStateException("Spotify 미연결"));

        LocalDateTime threshold = LocalDateTime.now().plusSeconds(REFRESH_GRACE_SECONDS);
        if (auth.getExpiresAt().isAfter(threshold)) {
            return encryption.decrypt(auth.getAccessTokenEncrypted());
        }

        // 만료 임박 → refresh
        String refreshToken = encryption.decrypt(auth.getRefreshTokenEncrypted());
        TokenResponse refreshed = refreshAccessToken(refreshToken);

        auth.setAccessTokenEncrypted(encryption.encrypt(refreshed.accessToken()));
        auth.setExpiresAt(LocalDateTime.now().plusSeconds(refreshed.expiresIn()));
        // refresh 응답에 새 refresh_token 이 같이 오면 갱신, 아니면 기존 유지
        if (refreshed.refreshToken() != null && !refreshed.refreshToken().isBlank()) {
            auth.setRefreshTokenEncrypted(encryption.encrypt(refreshed.refreshToken()));
        }
        repo.save(auth);
        return refreshed.accessToken();
    }

    /* ============================== Spotify HTTP ============================== */

    private TokenResponse exchangeCode(String code) {
        String body =
                "grant_type=authorization_code"
                        + "&code="
                        + urlEncode(code)
                        + "&redirect_uri="
                        + urlEncode(redirectUri);
        return postToken(body);
    }

    private TokenResponse refreshAccessToken(String refreshToken) {
        String body =
                "grant_type=refresh_token"
                        + "&refresh_token="
                        + urlEncode(refreshToken);
        return postToken(body);
    }

    private TokenResponse postToken(String body) {
        try {
            String basicAuth =
                    Base64.getEncoder()
                            .encodeToString(
                                    (clientId + ":" + clientSecret)
                                            .getBytes(StandardCharsets.UTF_8));
            HttpRequest req =
                    HttpRequest.newBuilder(URI.create(TOKEN_URL))
                            .header("Content-Type", "application/x-www-form-urlencoded")
                            .header("Authorization", "Basic " + basicAuth)
                            .timeout(Duration.ofSeconds(10))
                            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                            .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                log.warn("[SpotifyOAuth] token endpoint {} → {}", res.statusCode(), res.body());
                throw new IllegalStateException("Spotify token endpoint 실패: " + res.statusCode());
            }
            JsonNode node = mapper.readTree(res.body());
            return new TokenResponse(
                    node.path("access_token").asText(),
                    node.path("refresh_token").asText(null),
                    node.path("expires_in").asLong(3600));
        } catch (Exception e) {
            throw new IllegalStateException("Spotify token 통신 실패", e);
        }
    }

    private SpotifyMe fetchMe(String accessToken) {
        try {
            HttpRequest req =
                    HttpRequest.newBuilder(URI.create(ME_URL))
                            .header("Authorization", "Bearer " + accessToken)
                            .timeout(Duration.ofSeconds(10))
                            .GET()
                            .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                throw new IllegalStateException("Spotify /me 실패: " + res.statusCode());
            }
            JsonNode node = mapper.readTree(res.body());
            return new SpotifyMe(
                    node.path("id").asText(),
                    node.path("email").asText(""),
                    node.path("product").asText("free"));
        } catch (Exception e) {
            throw new IllegalStateException("Spotify /me 통신 실패", e);
        }
    }

    /* ============================== 헬퍼 ============================== */

    private void ensureClientConfigured() {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalStateException(
                    "spotify.oauth.client-id / client-secret 미설정 — Spotify OAuth 사용 불가");
        }
    }

    private String urlEncode(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    /** Spotify token 응답 핵심 3필드. */
    public record TokenResponse(String accessToken, String refreshToken, long expiresIn) {}

    /** Spotify /v1/me 응답 핵심 3필드 (product = "premium" / "free"). */
    public record SpotifyMe(String id, String email, String product) {}
}
