package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

class SearchApiBudgetTrackerTest {

    @Test
    void Redis_장애_중_호출량을_기존_일일_호출량과_합쳐_복구한다() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(anyString()))
                .thenThrow(new RuntimeException("redis down"))
                .thenReturn("100");
        when(values.increment(anyString(), anyLong()))
                .thenThrow(new RuntimeException("redis down"))
                .thenReturn(130L);

        SearchApiBudgetTracker tracker = new SearchApiBudgetTracker(redis);
        tracker.record(20, 0);
        tracker.record(10, 0);

        assertThat(tracker.naverUsed()).isEqualTo(130);
        verify(values).increment(anyString(), eq(30L));
    }

    @Test
    void 다음_키워드_호출량까지_포함해_상한을_검사한다() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(anyString())).thenReturn("49");

        SearchApiBudgetTracker tracker = new SearchApiBudgetTracker(redis);
        ReflectionTestUtils.setField(tracker, "naverDailyLimit", 100);
        ReflectionTestUtils.setField(tracker, "kakaoDailyLimit", 100);
        ReflectionTestUtils.setField(tracker, "usageRatio", 0.5);

        assertThat(tracker.withinBudget(2, 0)).isFalse();
        assertThat(tracker.withinBudget(1, 0)).isTrue();
    }
}
