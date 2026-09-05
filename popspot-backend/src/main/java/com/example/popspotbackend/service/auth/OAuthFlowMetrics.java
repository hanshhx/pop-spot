package com.example.popspotbackend.service.auth;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 소셜 로그인 교환이 <b>신방식과 구방식 중 어느 쪽으로 도는지</b> 날짜별로 센다.
 *
 * <h3>왜 세는가</h3>
 *
 * <p>구방식 교환을 끊을 시점을 정하려면 아직 누가 쓰는지 알아야 한다. 계측 없이 끊으면 남은 사용자의 로그인이 예고 없이 깨지고, 계측 없이 안 끊으면 잔여 위험이 무한정
 * 열려 있다.
 *
 * <p>다만 <b>교환 0건이 구방식 사용자 0명을 뜻하지는 않는다</b>. 이미 로그인한 사람은 갱신 토큰으로 계속 쓰므로 교환을 부르지 않고, 한동안 안 들어온 사람이
 * 나중에 돌아올 수도 있다. 반대로 공격자가 구방식 호출을 계속 만들면 "0건" 조건이 영원히 안 온다. 그래서 이 숫자는 <b>종료 시점을 고르는 재료</b>이지 그 자체가
 * 조건이 아니다 — 실제 종료는 발급을 끊는 쪽에서 한다.
 *
 * <h3>무엇을 남기지 않는가</h3>
 *
 * <p>교환 코드도 verifier 도 챌린지도 기록하지 않는다. 세는 것은 <b>가짓수뿐</b>이다. 로그나 Redis 에 그 값들이 남으면 그것 자체가 새 유출 경로가
 * 된다.
 *
 * <h3>읽는 법</h3>
 *
 * <pre>redis-cli HGETALL OAUTH_FLOW:2026-09-05</pre>
 *
 * <p>별도 화면을 만들지 않았다. 종료 판단을 위해 며칠만 보면 되는 값이라, 그 목적에는 이걸로 충분하다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuthFlowMetrics {

    private static final String KEY_PREFIX = "OAUTH_FLOW:";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 종료 판단에 며칠치면 충분하지만, 되돌아볼 여유를 둔다. */
    private static final Duration RETENTION = Duration.ofDays(90);

    /* 코드를 발급할 때 */
    public static final String ISSUED_BOUND = "issued_bound";
    public static final String ISSUED_LEGACY = "issued_legacy";

    /* 코드를 교환할 때 */
    public static final String EXCHANGED_BOUND = "exchanged_bound";
    public static final String EXCHANGED_LEGACY = "exchanged_legacy";

    /* 거부한 것 — 묶인 코드에 verifier 가 안 맞았거나, 구방식 코드에 verifier 가 붙어 왔다 */
    public static final String REJECTED_VERIFIER = "rejected_verifier";
    public static final String REJECTED_DOWNGRADE = "rejected_downgrade";

    /** 시도 기록이 없어 로그인을 거부한 수. 늘어나면 보존 방식 자체를 다시 봐야 한다. */
    public static final String REJECTED_NO_ATTEMPT = "rejected_no_attempt";

    private final StringRedisTemplate redis;

    /**
     * 한 건 센다.
     *
     * <p>계측이 실패해도 로그인은 계속되어야 한다 — 여기서 예외를 올리면 세는 일이 서비스를 멈춘다. 그래서 삼키되, 조용히는 아니다.
     */
    public void count(String field) {
        String key = KEY_PREFIX + LocalDate.now(KST);
        try {
            redis.opsForHash().increment(key, field, 1);
            // 만료가 없으면 하루치 키가 영원히 쌓인다. 이미 붙어 있으면 건드리지 않는다.
            if (redis.getExpire(key) < 0) redis.expire(key, RETENTION);
        } catch (RuntimeException e) {
            log.warn("[OAuthFlow] 계측 실패({}): {}", field, e.getClass().getSimpleName());
        }
    }
}
