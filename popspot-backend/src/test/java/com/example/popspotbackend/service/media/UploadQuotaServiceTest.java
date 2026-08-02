package com.example.popspotbackend.service.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 계정당 하루 업로드 한도.
 *
 * <p>이 계산이 틀려도 <b>화면에는 증상이 없다.</b> 너무 느슨하면 그냥 잘 올라가고, 너무 빡빡하면 사용자가 "왜 안 올라가지" 하고 말지 운영자에게 보고가 오지
 * 않는다. 그래서 경계값을 테스트로 박는다.
 *
 * <p>Redis 는 목으로 대체한다 — 여기서 확인할 것은 저장소가 아니라 <b>판정 규칙</b>이다.
 */
class UploadQuotaServiceTest {

    private static final String USER = "user-1";
    private static final long MB = 1024L * 1024L;

    private Map<String, Long> store;
    private StringRedisTemplate redis;
    private ValueOperations<String, String> ops;
    private UploadQuotaService quota;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        store = new HashMap<>();
        redis = mock(StringRedisTemplate.class);
        ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.get(anyString()))
                .thenAnswer(
                        inv -> {
                            Long v = store.get(inv.getArgument(0, String.class));
                            return v == null ? null : String.valueOf(v);
                        });
        when(ops.increment(anyString(), anyLong()))
                .thenAnswer(
                        inv -> {
                            String key = inv.getArgument(0);
                            long delta = inv.getArgument(1);
                            return store.merge(key, delta, Long::sum);
                        });

        quota = new UploadQuotaService(redis);
        ReflectionTestUtils.setField(quota, "dailyMb", 20);
        ReflectionTestUtils.setField(quota, "dailyCount", 30);
    }

    @Test
    @DisplayName("처음 올리는 사람은 통과한다")
    void allowsFirstUpload() {
        assertThat(quota.check(USER, 2 * MB).allowed()).isTrue();
    }

    @Test
    @DisplayName("하루 용량을 넘기면 막는다 — 경계 바로 앞은 통과")
    void blocksWhenBytesExceeded() {
        // 19MB 를 이미 썼다.
        quota.record(USER, 19 * MB);

        assertThat(quota.check(USER, 1 * MB).allowed()).describedAs("정확히 20MB 는 통과").isTrue();
        assertThat(quota.check(USER, 1 * MB + 1).allowed())
                .describedAs("20MB + 1바이트는 거부")
                .isFalse();
    }

    @Test
    @DisplayName("하루 개수를 넘기면 막는다 — 용량이 남아 있어도")
    void blocksWhenCountExceeded() {
        for (int i = 0; i < 30; i++) quota.record(USER, 1024);

        UploadQuotaService.Decision decision = quota.check(USER, 1024);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reason()).contains("30");
    }

    @Test
    @DisplayName("막을 때는 이유를 함께 준다 — 사용자에게 보여 줄 문구")
    void deniedCarriesReason() {
        quota.record(USER, 20 * MB);

        UploadQuotaService.Decision decision = quota.check(USER, MB);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reason()).isNotBlank().contains("용량");
    }

    @Test
    @DisplayName("사용자마다 따로 센다 — 남의 사용량에 걸리면 안 된다")
    void quotaIsPerUser() {
        quota.record(USER, 20 * MB);

        assertThat(quota.check("user-2", 5 * MB).allowed()).isTrue();
    }

    @Test
    @DisplayName("Redis 가 죽으면 통과시킨다 — 한도 때문에 정상 업로드를 막지 않는다")
    void failsOpenWhenRedisDown() {
        when(ops.get(anyString())).thenThrow(new RedisConnectionFailureException("down"));

        assertThat(quota.check(USER, 5 * MB).allowed()).isTrue();
    }

    @Test
    @DisplayName("기록도 Redis 가 죽으면 조용히 넘어간다 — 업로드 자체는 성공해야 한다")
    void recordSurvivesRedisFailure() {
        when(ops.increment(anyString(), anyLong()))
                .thenThrow(new RedisConnectionFailureException("down"));

        quota.record(USER, MB); // 예외가 밖으로 나오면 업로드가 500 이 된다
    }

    @Test
    @DisplayName("로그인하지 않은 호출은 세지 않는다 — 업로드는 어차피 인증이 필요하다")
    void ignoresAnonymous() {
        assertThat(quota.check(null, 5 * MB).allowed()).isTrue();
        quota.record(null, 5 * MB);

        verify(ops, never()).increment(anyString(), anyLong());
    }

    @Test
    @DisplayName("키에는 만료를 건다 — 안 걸면 사용량이 영원히 남아 다음 날도 막힌다")
    void setsExpiryOnFirstWrite() {
        quota.record(USER, MB);

        verify(redis, org.mockito.Mockito.atLeastOnce()).expire(anyString(), any());
    }
}
