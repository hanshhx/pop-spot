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

class CrawlBudgetTrackerTest {

    @Test
    void 재시작_후_Redis_장애분을_기존_사용량과_합쳐_복구한다() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(anyString()))
                .thenThrow(new RuntimeException("redis down"))
                .thenReturn("6000");
        when(values.increment(anyString(), anyLong()))
                .thenThrow(new RuntimeException("redis down"))
                .thenReturn(7800L);

        CrawlBudgetTracker tracker = new CrawlBudgetTracker(redis);
        tracker.addUsedSeconds(1200); // 장애 중 20분
        tracker.addUsedSeconds(600); // 복구 뒤 10분: 미동기화 20분과 함께 반영

        assertThat(tracker.usedMinutes()).isEqualTo(130);
        verify(values).increment(anyString(), eq(1800L));
    }
}
