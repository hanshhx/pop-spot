package com.example.popspotbackend.service.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.test.util.ReflectionTestUtils;

/** 업로드 한도는 조회와 증가가 하나의 Redis 스크립트에서 끝나는지 검증한다. */
class UploadQuotaServiceTest {

    private static final String USER = "user-1";
    private static final long MB = 1024L * 1024L;

    private StringRedisTemplate redis;
    private UploadQuotaService quota;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        quota = new UploadQuotaService(redis);
        ReflectionTestUtils.setField(quota, "dailyMb", 20);
        ReflectionTestUtils.setField(quota, "dailyCount", 30);
    }

    @Test
    @DisplayName("예약 성공은 저장을 허용하고 Redis 스크립트 한 번으로 사용량을 잡는다")
    void reservesAtomically() {
        stubReserve(List.of(1L, 2 * MB, 1L, 0L));

        UploadQuotaService.Decision decision = quota.reserve(USER, 2 * MB);

        assertThat(decision.allowed()).isTrue();
        assertThat(decision.temporarilyUnavailable()).isFalse();
        verify(redis)
                .execute(any(RedisScript.class), anyList(), eq(2 * MB), eq(20 * MB), eq(30), any());
        verify(redis, never()).opsForValue();
    }

    @Test
    @DisplayName("하루 파일 개수를 넘기면 사용자에게 한도 이유를 돌려준다")
    void blocksCountLimit() {
        stubReserve(List.of(0L, MB, 30L, 1L));

        UploadQuotaService.Decision decision = quota.reserve(USER, 1024);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.temporarilyUnavailable()).isFalse();
        assertThat(decision.reason()).contains("30");
    }

    @Test
    @DisplayName("하루 용량을 넘기면 사용자에게 남은 용량을 돌려준다")
    void blocksByteLimit() {
        stubReserve(List.of(0L, 19 * MB, 2L, 2L));

        UploadQuotaService.Decision decision = quota.reserve(USER, 2 * MB);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.temporarilyUnavailable()).isFalse();
        assertThat(decision.reason()).contains("용량").contains("1MB");
    }

    @Test
    @DisplayName("Redis 장애 때 무제한 업로드를 열지 않고 임시 장애로 닫는다")
    void failsClosedWhenRedisDown() {
        when(redis.execute(any(RedisScript.class), anyList(), any(), any(), any(), any()))
                .thenThrow(new RedisConnectionFailureException("down"));

        UploadQuotaService.Decision decision = quota.reserve(USER, MB);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.temporarilyUnavailable()).isTrue();
    }

    @Test
    @DisplayName("손상된 Redis 응답도 한도 우회로 쓰지 못한다")
    void rejectsMalformedRedisResult() {
        stubReserve(List.of(1L));

        UploadQuotaService.Decision decision = quota.reserve(USER, MB);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.temporarilyUnavailable()).isTrue();
    }

    @Test
    @DisplayName("로그인 식별자가 없으면 Redis를 건드리지 않고 차단한다")
    void rejectsAnonymousReservation() {
        UploadQuotaService.Decision decision = quota.reserve(null, MB);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.temporarilyUnavailable()).isTrue();
        verify(redis, never())
                .execute(any(RedisScript.class), anyList(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("파일 저장 실패 시 예약한 개수와 용량을 원자적으로 돌려놓는다")
    void releasesFailedUploadReservation() {
        when(redis.execute(any(RedisScript.class), anyList(), eq(MB))).thenReturn(List.of(0L, 0L));

        quota.release(USER, MB);

        verify(redis).execute(any(RedisScript.class), anyList(), eq(MB));
    }

    @Test
    @DisplayName("예약 해제 중 Redis 장애는 원래 저장 오류를 덮어쓰지 않는다")
    void releaseDoesNotMaskOriginalFailure() {
        when(redis.execute(any(RedisScript.class), anyList(), eq(MB)))
                .thenThrow(new RedisConnectionFailureException("down"));

        quota.release(USER, MB);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private void stubReserve(List<Long> result) {
        when(redis.execute(any(RedisScript.class), anyList(), any(), any(), any(), any()))
                .thenReturn((List) result);
    }
}
