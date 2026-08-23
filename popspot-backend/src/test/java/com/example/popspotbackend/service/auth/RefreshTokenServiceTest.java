package com.example.popspotbackend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

class RefreshTokenServiceTest {

    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private RefreshTokenService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        service = new RefreshTokenService(redis);
    }

    @Test
    @DisplayName("발급 당시 전체 세션 버전을 토큰 메타데이터에 함께 저장한다")
    void issueStoresTokenVersion() {
        service.issue("user-1", 7L, 1_800_000_000L);

        verify(values)
                .set(
                        any(String.class),
                        eq("user-1\n7\n1800000000"),
                        anyLong(),
                        eq(TimeUnit.SECONDS));
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("Redis 6.0 호환 원자 연산으로 소비하고 발급 버전을 복원한다")
    void consumeIsAtomicAndRestoresVersion() {
        when(redis.execute(any(RedisScript.class), any(List.class)))
                .thenReturn("user-1\n7\n1800000000");

        RefreshTokenService.Consumed consumed = service.consume("valid-token");

        assertThat(consumed)
                .isEqualTo(new RefreshTokenService.Consumed("user-1", 7L, 1_800_000_000L));
        verify(redis).execute(any(RedisScript.class), any(List.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("본인 인증 시각이 없는 구형 토큰은 민감 작업 재인증을 우회할 수 있어 거부한다")
    void rejectsLegacyTokenWithoutAuthenticationTime() {
        when(redis.execute(any(RedisScript.class), any(List.class))).thenReturn("user-1\n7");

        assertThat(service.consume("legacy-token")).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("허용 범위를 벗어난 토큰 메타데이터를 거부한다")
    void rejectsOutOfRangeMetadata() {
        when(redis.execute(any(RedisScript.class), any(List.class))).thenReturn("user-1\n-1\n0");

        assertThat(service.consume("damaged-token")).isNull();
    }
}
