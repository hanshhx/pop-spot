package com.example.popspotbackend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

/**
 * 로그인 시도 기록 — 교환 코드를 요청자에게 묶을 수 있게 하는 재료.
 *
 * <p>여기서 지키는 것은 하나다. <b>기록이 없는 것과 구방식으로 시작한 것은 다르다.</b> 둘을 섞으면 요청에서 필드를 빼는 대신 쿠키·세션을 지우는 것만으로 보호를
 * 벗겨내는 강등 공격이 열린다.
 */
class OAuthAttemptStoreTest {

    private static final String STATE = "state-abc";
    private static final String CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private OAuthAttemptStore store;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        store = new OAuthAttemptStore(redis);
    }

    /* ==================== 기록 ==================== */

    @Test
    @DisplayName("성한 챌린지는 S256 으로 묶어 기록한다")
    void recordsChallenge() {
        store.record(STATE, CHALLENGE);

        verify(values)
                .set(eq("OAUTH_ATTEMPT:" + STATE), eq("S256:" + CHALLENGE), any(Duration.class));
    }

    /**
     * 챌린지가 없어도 <b>기록은 남긴다</b>. 이게 이 클래스의 핵심이다 — 남기지 않으면 콜백에서 "구방식으로 시작했다" 와 "기록이 사라졌다" 를 구분할 수 없다.
     */
    @Test
    @DisplayName("챌린지가 없어도 구방식으로 기록을 남긴다")
    void recordsLegacyWhenNoChallenge() {
        store.record(STATE, null);

        verify(values)
                .set(
                        eq("OAUTH_ATTEMPT:" + STATE),
                        eq(OAuthAttemptStore.LEGACY),
                        any(Duration.class));
    }

    /** 형식이 틀린 값으로 실패시키지 않는다. 그러면 아무 문자열이나 붙여 로그인 시작을 막을 수 있다. 대신 묶이지 않으므로 보호도 받지 못한다. */
    @Test
    @DisplayName("형식이 틀린 챌린지는 거부가 아니라 구방식으로 떨어진다")
    void malformedChallengeFallsBackToLegacy() {
        store.record(STATE, "짧다");

        verify(values)
                .set(
                        eq("OAUTH_ATTEMPT:" + STATE),
                        eq(OAuthAttemptStore.LEGACY),
                        any(Duration.class));
    }

    /* ==================== 소비 ==================== */

    @Test
    @DisplayName("기록을 읽어 돌려준다")
    void consumeReturnsRecord() {
        when(redis.execute(any(RedisScript.class), anyList())).thenReturn("S256:" + CHALLENGE);

        assertThat(store.consume(STATE)).contains("S256:" + CHALLENGE);
    }

    /** 기록이 없으면 비어 있는 값을 돌려준다. 호출부는 이것을 <b>로그인 실패</b>로 다뤄야지 구방식으로 해석하면 안 된다. */
    @Test
    @DisplayName("기록이 없으면 비어 있다 — 구방식이 아니다")
    void consumeReturnsEmptyWhenMissing() {
        when(redis.execute(any(RedisScript.class), anyList())).thenReturn(null);

        assertThat(store.consume(STATE)).isEmpty();
    }

    /** Redis 가 죽어도 마찬가지다. 조용히 통과시키면 장애가 곧 우회로가 된다. */
    @Test
    @DisplayName("Redis 장애도 비어 있는 결과다 — 통과시키지 않는다")
    void consumeFailsClosedOnRedisError() {
        when(redis.execute(any(RedisScript.class), anyList()))
                .thenThrow(new IllegalStateException("redis down"));

        assertThat(store.consume(STATE)).isEmpty();
    }

    @Test
    @DisplayName("state 가 없으면 Redis 를 부르지도 않는다")
    void blankStateShortCircuits() {
        assertThat(store.consume(null)).isEmpty();
        assertThat(store.consume("  ")).isEmpty();
    }

    /* ==================== 챌린지 형식 ==================== */

    @Test
    @DisplayName("챌린지는 base64url 43자만 통과한다")
    void challengeShape() {
        assertThat(OAuthAttemptStore.isWellFormed(CHALLENGE)).isTrue();

        assertThat(OAuthAttemptStore.isWellFormed(null)).isFalse();
        assertThat(OAuthAttemptStore.isWellFormed("")).isFalse();
        assertThat(OAuthAttemptStore.isWellFormed("a".repeat(42))).isFalse();
        assertThat(OAuthAttemptStore.isWellFormed("a".repeat(44))).isFalse();
        // base64 표준 문자(+/=)는 url 안전이 아니라 우리가 발급한 모양이 아니다.
        assertThat(OAuthAttemptStore.isWellFormed("a".repeat(42) + "+")).isFalse();
        assertThat(OAuthAttemptStore.isWellFormed("a".repeat(42) + "=")).isFalse();
    }
}
