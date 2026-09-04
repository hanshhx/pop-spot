package com.example.popspotbackend.service.auth;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * 소셜 로그인 <b>시도</b> 기록. 시작 시점에 쓰고 콜백에서 한 번 읽는다.
 *
 * <p>이 기록이 있어야 교환 코드에 PKCE 챌린지를 묶을 수 있다. 가로챈 코드를 쓰지 못하게 하는 것이 목적이다 — 앱이 만든 nonce 는 정상 앱이 <b>위조된</b>
 * 콜백을 걸러내는 장치이고, <b>탈취된</b> 콜백은 막지 못한다. 서로 다른 공격이다.
 *
 * <h3>키를 왜 {@code state} 로 잡는가</h3>
 *
 * <p>Spring 이 인가 요청마다 이미 만들고 있는 값이다 — 서버 생성이고, 추측할 수 없고, 시도마다 고유하다(그래서 여러 탭에서 로그인해도 서로 덮어쓰지 않는다).
 * 따로 시도 ID 를 발명하면 같은 것을 두 벌 갖게 된다.
 *
 * <p>앱 복귀용 쿠키({@code APP_FLOW_COOKIE})와는 <b>무관하다</b>. 그 쿠키는 웹이 앱으로 넘길지를 판단하는 값이지 서버의 로그인 시도 기록이
 * 아니다.
 *
 * <h3>기록이 없으면 구방식으로 해석하지 않는다</h3>
 *
 * <p>그래서 챌린지가 없어도 <b>항상</b> 기록을 남긴다({@link #LEGACY}). 그래야 콜백에서 세 가지가 구분된다 — 묶어야 함 / 전환기 구방식 / <b>기록
 * 없음</b>. 셋째는 실패다.
 *
 * <p>기록 없음을 구방식으로 취급하면, 요청에서 필드를 빼는 대신 <b>쿠키나 세션을 지우는</b> 방식으로 같은 강등 공격이 열린다. 정상 사용자도 이 경우 로그인이
 * 깨지지만, 그건 재시작을 안내할 일이지 보호를 낮출 일이 아니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuthAttemptStore {

    private static final String KEY_PREFIX = "OAUTH_ATTEMPT:";

    /**
     * 인가 왕복이 끝날 때까지 살아 있어야 하는 시간.
     *
     * <p>30분인 이유는 앱 nonce 와 같다 — 카카오에서 비밀번호를 찾거나 문자 인증을 하는 시간까지 덮어야 한다. 짧게 잡으면 그 사람의 로그인이 마지막 단계에서
     * 조용히 버려진다.
     */
    private static final Duration TTL = Duration.ofMinutes(30);

    /** 챌린지 없이 시작한 시도. 전환기에만 허용한다. */
    public static final String LEGACY = "-";

    /** 지금 지원하는 변환 방식. 평문(plain)은 받지 않는다 — 가로챈 쪽이 그대로 되쓸 수 있다. */
    public static final String METHOD_S256 = "S256";

    /** S256 챌린지는 32바이트를 base64url(패딩 없음)로 찍은 43자다. */
    private static final int S256_CHALLENGE_LENGTH = 43;

    /**
     * 읽고 즉시 지운다. 운영 Redis 가 6.0.x 라 {@code GETDEL} 이 없어 Lua 로 쓴다 — {@code AuthController} 의 같은 사연
     * 참고.
     */
    private static final RedisScript<String> GET_DEL =
            new DefaultRedisScript<>(
                    "local v = redis.call('GET', KEYS[1]) "
                            + "if v then redis.call('DEL', KEYS[1]) end "
                            + "return v",
                    String.class);

    private final StringRedisTemplate redis;

    /**
     * 시도를 기록한다. {@code challenge} 가 null·빈값·형식 불일치면 구방식으로 남긴다.
     *
     * <p>형식이 틀린 값을 <b>거부하지 않고 구방식으로 떨어뜨리는</b> 이유: 이 단계에서 실패시키면 아무 문자열이나 붙여 로그인 시작을 막을 수 있다. 대신 묶이지
     * 않으므로 보호도 받지 못한다.
     */
    public void record(String state, String challenge) {
        if (state == null || state.isBlank()) return;
        String value = isWellFormed(challenge) ? METHOD_S256 + ":" + challenge : LEGACY;
        try {
            redis.opsForValue().set(key(state), value, TTL);
        } catch (RuntimeException e) {
            // 여기서 못 쓰면 콜백에서 "기록 없음" 이 되어 로그인이 실패한다. 조용히 통과시키지 않는다.
            log.error(
                    "[OAuthAttempt] 시도 기록 실패 — 이 로그인은 콜백에서 거부된다: {}", e.getClass().getSimpleName());
        }
    }

    /**
     * 기록을 한 번만 읽어 소비한다.
     *
     * @return {@link #LEGACY} 또는 {@code "S256:<challenge>"}. <b>비어 있으면 기록이 없다는 뜻이고, 호출부는 로그인을 실패시켜야
     *     한다</b> — 구방식으로 해석하면 안 된다.
     */
    public Optional<String> consume(String state) {
        if (state == null || state.isBlank()) return Optional.empty();
        try {
            return Optional.ofNullable(redis.execute(GET_DEL, List.of(key(state))));
        } catch (RuntimeException e) {
            log.error("[OAuthAttempt] 시도 기록 조회 실패: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    /** base64url 43자만 통과. 길이·문자 집합이 어긋나면 우리가 발급한 모양이 아니다. */
    static boolean isWellFormed(String challenge) {
        if (challenge == null || challenge.length() != S256_CHALLENGE_LENGTH) return false;
        for (int i = 0; i < challenge.length(); i++) {
            char c = challenge.charAt(i);
            boolean ok =
                    (c >= 'A' && c <= 'Z')
                            || (c >= 'a' && c <= 'z')
                            || (c >= '0' && c <= '9')
                            || c == '-'
                            || c == '_';
            if (!ok) return false;
        }
        return true;
    }

    private String key(String state) {
        return KEY_PREFIX + state;
    }
}
