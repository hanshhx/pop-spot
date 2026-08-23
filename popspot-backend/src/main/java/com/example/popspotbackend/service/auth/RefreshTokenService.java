package com.example.popspotbackend.service.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

/**
 * 리프레시 토큰 — 짧은 접근 토큰을 조용히 갱신하기 위한 장치.
 *
 * <p><b>왜 필요한가.</b> 접근 토큰(JWT)이 한 번 새면 만료될 때까지 아무도 못 막는다. 수명을 줄이면 그 창이 줄지만, 그것만 하면 관리자가 30분마다
 * 재로그인해야 한다. 그래서 <b>순서가 중요하다</b> — 리프레시를 먼저 만들고 그다음에 수명을 줄인다. 뒤집으면 쓸 수 없는 화면이 된다.
 *
 * <p><b>원문을 저장하지 않는다.</b> Redis 에는 SHA-256 해시만 넣는다. Redis 를 통째로 들여다본 사람이 그대로 로그인할 수 있으면 저장 위치를 하나 더
 * 늘린 것에 지나지 않는다. 리프레시 토큰은 우리가 만든 고엔트로피 난수라 느린 해시(BCrypt)가 필요 없다 — 사전 공격의 대상이 아니다.
 *
 * <p><b>한 번 쓰면 새것으로 바꾼다(rotation).</b> 같은 토큰을 계속 쓰게 두면 그것이 곧 장수 토큰이라 짧은 접근 토큰의 의미가 사라진다. 갱신할 때마다 새로
 * 발급하고 옛것을 즉시 버린다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    /**
     * 리프레시 토큰 수명.
     *
     * <p>이 값이 곧 "얼마나 오래 로그인 상태가 유지되는가" 다. 관리자 화면은 매일 쓰는 도구라 하루마다 재로그인은 과하고, 반대로 한 달은 분실 시 창이 너무 넓다.
     */
    private static final Duration TTL = Duration.ofDays(7);

    private static final String KEY_PREFIX = "REFRESH:";
    private static final String VALUE_SEPARATOR = "\n";

    /** Redis 6.0에서도 한 토큰이 동시에 두 번 소비되지 않게 하는 원자적 GET+DEL. */
    private static final RedisScript<String> GET_DEL_SCRIPT =
            new DefaultRedisScript<>(
                    "local v = redis.call('GET', KEYS[1]) "
                            + "if v then redis.call('DEL', KEYS[1]) end "
                            + "return v",
                    String.class);

    /** 256비트. 추측이 불가능해야 이 토큰만으로 접근 토큰을 계속 받아 갈 수 없다. */
    private static final int TOKEN_BYTES = 32;

    private final StringRedisTemplate redisTemplate;
    private final SecureRandom random = new SecureRandom();

    /** 발급 결과 — 원문은 <b>이때 한 번만</b> 존재한다. 서버에는 해시만 남는다. */
    public record Issued(String token, long expiresInSeconds) {}

    /** 소비한 토큰이 누구에게, 어느 전체-세션 버전·최초 본인 인증 시각에서 발급됐는지. */
    public record Consumed(String userId, long tokenVersion, long authenticatedAtEpochSeconds) {}

    /** 새 리프레시 토큰. 로그인 성공 직후에 부른다. */
    public Issued issue(String userId, long tokenVersion, long authenticatedAtEpochSeconds) {
        if (userId == null || userId.isBlank() || userId.contains(VALUE_SEPARATOR)) {
            throw new IllegalArgumentException("리프레시 토큰 사용자 식별자가 올바르지 않습니다.");
        }
        if (tokenVersion < 0) {
            throw new IllegalArgumentException("전체 세션 버전이 올바르지 않습니다.");
        }
        if (authenticatedAtEpochSeconds <= 0) {
            throw new IllegalArgumentException("본인 인증 시각이 올바르지 않습니다.");
        }
        byte[] raw = new byte[TOKEN_BYTES];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        String value =
                userId
                        + VALUE_SEPARATOR
                        + tokenVersion
                        + VALUE_SEPARATOR
                        + authenticatedAtEpochSeconds;
        redisTemplate.opsForValue().set(key(token), value, TTL.toSeconds(), TimeUnit.SECONDS);
        return new Issued(token, TTL.toSeconds());
    }

    /**
     * 토큰을 쓰고 <b>즉시 없앤다.</b> 주인의 userId 를 돌려주고, 없거나 이미 쓴 토큰이면 {@code null}.
     *
     * <p>먼저 지우고 나서 판단한다. 조회 후 삭제로 나누면 두 요청이 같은 토큰을 동시에 통과할 수 있다 — 그러면 하나의 토큰으로 두 세션이 생긴다.
     */
    public Consumed consume(String token) {
        if (token == null || token.isBlank() || token.length() > 200) return null;
        String value = redisTemplate.execute(GET_DEL_SCRIPT, List.of(key(token)));
        if (value == null) return null;

        String[] fields = value.split(VALUE_SEPARATOR, -1);
        if (fields.length != 3 || fields[0].isBlank()) {
            // 배포 전에 발급된 구형 토큰은 버전 또는 최초 본인 인증 시각이 없다. 현재 값을
            // 추측해 살리면 전체 로그아웃이나 민감 작업 재인증을 우회할 수 있으므로 재로그인을 요구한다.
            log.warn("[RefreshToken] 보안 메타데이터 없는 구형/손상 토큰 거부");
            return null;
        }
        try {
            long tokenVersion = Long.parseLong(fields[1]);
            long authenticatedAtEpochSeconds = Long.parseLong(fields[2]);
            if (tokenVersion < 0 || authenticatedAtEpochSeconds <= 0) {
                log.warn("[RefreshToken] 허용 범위를 벗어난 토큰 메타데이터 거부");
                return null;
            }
            return new Consumed(fields[0], tokenVersion, authenticatedAtEpochSeconds);
        } catch (NumberFormatException e) {
            log.warn("[RefreshToken] 손상된 토큰 메타데이터 거부");
            return null;
        }
    }

    /** 이 토큰 하나만 버린다. 로그아웃할 때 쓴다. */
    public void revoke(String token) {
        if (token != null && !token.isBlank()) redisTemplate.delete(key(token));
    }

    /**
     * 저장 키 — 원문이 아니라 해시로 만든다.
     *
     * <p>키 자체가 원문이면 Redis 의 키 목록만 봐도 유효한 토큰을 전부 얻는다. 해시로 두면 목록을 봐도 쓸 수 없다.
     */
    private String key(String token) {
        return KEY_PREFIX + sha256(token);
    }

    private static String sha256(String value) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 은 모든 JVM 이 반드시 제공한다. 여기 오면 실행 환경이 깨진 것이다.
            throw new IllegalStateException("SHA-256 을 쓸 수 없습니다.", e);
        }
    }
}
