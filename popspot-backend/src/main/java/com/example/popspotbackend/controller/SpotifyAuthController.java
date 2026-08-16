package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.SpotifyAuth;
import com.example.popspotbackend.repository.SpotifyAuthRepository;
import com.example.popspotbackend.service.spotify.SpotifyOAuthService;
import java.net.URI;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    /** state → userId 매핑을 담아두는 Redis 키 접두사. 값은 popspot userId. */
    private static final String KEY_OAUTH_STATE = "SPOTIFY_OAUTH_STATE:";

    /** 사용자가 Spotify 로그인 화면에서 머무는 시간을 감안한 state 유효시간. */
    private static final long OAUTH_STATE_TTL_MINUTES = 10;

    /** 무의미하게 긴 값으로 Redis 키를 더럽히지 못하도록 하는 상한(정상 state 는 43자). */
    private static final int MAX_STATE_LENGTH = 128;

    /**
     * GET 후 DEL 을 한 번에(원자적으로) 수행하는 스크립트. {@code AuthController.GET_DEL_SCRIPT} 와 동일한 이유의 복제다.
     *
     * <p>Spring Data 의 {@code getAndDelete()} 는 Redis 명령 {@code GETDEL} 로 내려가는데 이는 Redis 6.2 이상에서만
     * 존재한다. 운영 서버(Redis 6.0.x)에는 그 명령이 없어 Lettuce 가 "Error in execution" 을 던지므로 쓸 수 없다.
     *
     * <p>Lua 스크립트는 Redis 2.6+ 에서 동작하고 서버에서 단일 원자 단위로 실행되므로, 하나의 state 가 두 번 소비되지 않는다는 보장(1회용)은
     * {@code GETDEL} 과 동일하게 유지된다.
     */
    private static final RedisScript<String> GET_DEL_SCRIPT =
            new DefaultRedisScript<>(
                    "local v = redis.call('GET', KEYS[1]) "
                            + "if v then redis.call('DEL', KEYS[1]) end "
                            + "return v",
                    String.class);

    private final SpotifyOAuthService oauth;
    private final SpotifyAuthRepository repo;
    private final StringRedisTemplate redisTemplate;

    @Value("${spotify.oauth.frontend-redirect:/}")
    private String frontendRedirect;

    /**
     * 로그인 URL 생성. state 는 <b>의미 없는 랜덤 값</b>이고, 실제 사용자 매칭 정보(userId)는 서버(Redis)에만 둔다.
     *
     * <p>보안: 예전에는 state 자체에 userId 를 실어 보내고 콜백에서 그 값을 그대로 믿었다. 콜백은 인증 없이 열려 있으므로, 공격자가 자기 userId 로
     * state 를 만들어 피해자에게 링크를 보내면 피해자의 Spotify 토큰이 공격자 계정에 저장되는 계정 가로채기가 가능했다. state 를 서버에서 발급·보관하면
     * 공격자가 임의로 만들어낸 state 는 Redis 에 없어 콜백에서 거부된다.
     *
     * <p>비로그인 사용자는 401.
     */
    @GetMapping("/login")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> login(Authentication authentication) {
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "로그인 후 Spotify 연결이 가능합니다."));
        }
        String state = issueState(userId);
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
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "error", required = false) String error) {
        if (error != null && !error.isBlank()) {
            log.info("[SpotifyOAuth] 사용자가 권한 거부: {}", error);
            return redirect(frontendRedirectWith("denied"));
        }
        // state 는 서버가 발급한 1회용 값만 인정한다. 위조·만료·재사용이면 여기서 끊는다.
        String popspotUserId = consumeState(state);
        if (popspotUserId == null) {
            log.warn("[SpotifyOAuth] 유효하지 않은 state — 콜백 거부(위조/만료/재사용 가능성)");
            return redirect(frontendRedirectWith("error"));
        }
        try {
            oauth.handleCallback(popspotUserId, code);
            log.info("[SpotifyOAuth] 연결 성공 — popspot user {}", popspotUserId);
            return redirect(frontendRedirectWith("connected"));
        } catch (Exception e) {
            log.warn("[SpotifyOAuth] 콜백 처리 실패", e);
            return redirect(frontendRedirectWith("error"));
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
    @PreAuthorize("isAuthenticated()")
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
    @PreAuthorize("isAuthenticated()")
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
     * Authentication 에서 popspot userId 추출. JwtAuthenticationFilter 가 principal 을 userId (String) 로
     * 넣으므로 {@code getName()} 이 userId. 비로그인 / 익명이면 null.
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

    /**
     * state = 32바이트 난수(Base64URL). 값에는 아무 의미가 없고, userId 는 Redis 에만 TTL {@value
     * #OAUTH_STATE_TTL_MINUTES}분으로 저장한다.
     */
    private String issueState(String userId) {
        byte[] nonce = new byte[32];
        RANDOM.nextBytes(nonce);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
        redisTemplate
                .opsForValue()
                .set(stateKey(state), userId, OAUTH_STATE_TTL_MINUTES, TimeUnit.MINUTES);
        return state;
    }

    /**
     * state 를 읽고 즉시 삭제해(1회용) 매핑된 userId 를 돌려준다. 없거나 형식이 이상하면 null.
     *
     * <p>1회용으로 소비하는 이유: 같은 콜백 URL 이 재전송(뒤로가기·링크 공유)돼도 토큰 교환이 두 번 일어나지 않게 하기 위함. 원자성 보장은 {@link
     * #GET_DEL_SCRIPT} 참고.
     */
    private String consumeState(String state) {
        if (state == null || state.isBlank() || state.length() > MAX_STATE_LENGTH) {
            return null;
        }
        return redisTemplate.execute(GET_DEL_SCRIPT, List.of(stateKey(state)));
    }

    private static String stateKey(String state) {
        return KEY_OAUTH_STATE + state;
    }

    /**
     * 콜백 완료 후 프론트로 보낼 redirect URL 구성.
     *
     * <p>항상 음악 탭으로 복귀하도록 {@code ?tab=MUSIC&spotify=<status>} 를 붙인다. SpotifyConnectButton 이 음악 탭 안에
     * 있어, 다른 탭으로 가면 결과 토스트가 안 뜬다.
     *
     * <p>frontendRedirect 에 이미 쿼리(예: {@code ?tab=MUSIC})가 있어도 이중 {@code ?} 가 생기지 않도록 기존 쿼리를 제거하고
     * 의도한 쿼리만 부착한다.
     */
    private String frontendRedirectWith(String status) {
        String base = frontendRedirect;
        int q = base.indexOf('?');
        if (q >= 0) {
            base = base.substring(0, q);
        }
        return base + "?tab=MUSIC&spotify=" + status;
    }

    private ResponseEntity<Void> redirect(String location) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).build();
    }
}
