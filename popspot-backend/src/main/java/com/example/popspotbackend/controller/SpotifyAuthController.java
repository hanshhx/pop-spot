package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.SpotifyAuth;
import com.example.popspotbackend.repository.SpotifyAuthRepository;
import com.example.popspotbackend.service.spotify.SpotifyOAuthService;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * v2.21-S10 — Spotify OAuth + 연결 상태 API.
 *
 * <p>엔드포인트:
 *
 * <ul>
 *   <li>{@code GET /api/spotify/login} — Spotify 로그인 URL 반환 (프론트가 redirect)
 *   <li>{@code GET /api/spotify/callback} — Spotify → popspot 콜백. code 받아 token 교환 후 프론트로 302
 *       redirect
 *   <li>{@code GET /api/spotify/me} — 현재 사용자의 연결 상태 + Premium 여부
 *   <li>{@code POST /api/spotify/disconnect} — 토큰 삭제 (사용자 명시 요청)
 *   <li>{@code GET /api/spotify/token} — Web Playback SDK 가 사용할 access token (자동 refresh)
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/spotify")
@RequiredArgsConstructor
public class SpotifyAuthController {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final SpotifyOAuthService oauth;
    private final SpotifyAuthRepository repo;

    @Value("${spotify.oauth.frontend-redirect:/}")
    private String frontendRedirect;

    /**
     * 로그인 URL 생성. state 에 사용자 ID + 랜덤 nonce 를 인코딩해 콜백에서 사용자 매칭.
     *
     * <p>비로그인 사용자는 401.
     */
    @GetMapping("/login")
    public ResponseEntity<Map<String, String>> login(Authentication authentication) {
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "로그인 후 Spotify 연결이 가능합니다."));
        }
        String state = encodeState(userId);
        String url = oauth.buildAuthorizationUrl(state);
        return ResponseEntity.ok(Map.of("authorizationUrl", url));
    }

    /**
     * Spotify 가 직접 호출. permitAll — state 로 사용자 식별.
     *
     * <p>완료 후 프론트로 302 redirect (?spotify=connected 또는 ?spotify=error).
     */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam("code") String code,
            @RequestParam("state") String state,
            @RequestParam(value = "error", required = false) String error) {
        if (error != null && !error.isBlank()) {
            log.info("[SpotifyOAuth] 사용자가 권한 거부: {}", error);
            return redirect(frontendRedirect + "?spotify=denied");
        }
        try {
            String popspotUserId = decodeState(state);
            oauth.handleCallback(popspotUserId, code);
            log.info("[SpotifyOAuth] 연결 성공 — popspot user {}", popspotUserId);
            return redirect(frontendRedirect + "?spotify=connected");
        } catch (Exception e) {
            log.warn("[SpotifyOAuth] 콜백 처리 실패", e);
            return redirect(frontendRedirect + "?spotify=error");
        }
    }

    /** 현재 사용자의 Spotify 연결 상태 + Premium 여부. 미로그인 → connected=false. */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(Authentication authentication) {
        Map<String, Object> result = new HashMap<>();
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            result.put("connected", false);
            return ResponseEntity.ok(result);
        }
        SpotifyAuth auth = repo.findByUserId(userId).orElse(null);
        if (auth == null) {
            result.put("connected", false);
            return ResponseEntity.ok(result);
        }
        result.put("connected", true);
        result.put("isPremium", auth.getIsPremium());
        result.put("spotifyUserId", auth.getSpotifyUserId());
        return ResponseEntity.ok(result);
    }

    /** 사용자가 명시적으로 Spotify 연결 끊기. */
    @PostMapping("/disconnect")
    @Transactional
    public ResponseEntity<Void> disconnect(Authentication authentication) {
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        repo.deleteByUserId(userId);
        log.info("[SpotifyOAuth] 연결 끊기 — popspot user {}", userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Web Playback SDK 가 호출해 access token 받기. 만료 임박이면 자동 refresh 후 새 토큰 반환.
     *
     * <p>이 endpoint 는 짧은 TTL 의 access token 만 노출하고, refresh_token 은 절대 노출 X.
     */
    @GetMapping("/token")
    public ResponseEntity<Map<String, String>> token(Authentication authentication) {
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            String accessToken = oauth.getValidAccessToken(userId);
            return ResponseEntity.ok(Map.of("accessToken", accessToken));
        } catch (IllegalStateException e) {
            // Spotify 미연결 또는 키 미설정 등
            return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* ============================== 내부 헬퍼 ============================== */

    /**
     * Authentication 에서 popspot userId 추출. JwtAuthenticationFilter 가 principal 을 userId
     * (String) 로 넣으므로 {@code getName()} 이 userId. 비로그인 / 익명이면 null.
     */
    private String authenticatedUserId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            return null;
        }
        return authentication.getName();
    }

    /** state = Base64(userId + ":" + 16바이트 랜덤). 콜백 검증 시 디코딩하여 userId 추출. */
    private String encodeState(String userId) {
        byte[] nonce = new byte[16];
        RANDOM.nextBytes(nonce);
        String raw = userId + ":" + Base64.getEncoder().encodeToString(nonce);
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private String decodeState(String state) {
        String raw = new String(Base64.getUrlDecoder().decode(state), StandardCharsets.UTF_8);
        int colon = raw.indexOf(':');
        if (colon <= 0) throw new IllegalArgumentException("잘못된 state");
        return raw.substring(0, colon);
    }

    private ResponseEntity<Void> redirect(String location) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).build();
    }
}
