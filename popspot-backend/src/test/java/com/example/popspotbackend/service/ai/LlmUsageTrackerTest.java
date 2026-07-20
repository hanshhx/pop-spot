package com.example.popspotbackend.service.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.service.ai.LlmUsageTracker.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 쿼터 계측·차단 회귀 테스트.
 *
 * <p>여기서 두 번 틀렸다. (1) 일일 차단을 KST 달력일로 판정해 04시 회차가 막히면 16시 회차가 통째로 죽었다. (2) 응답을 받는 즉시 연속 실패를 초기화해,
 * 모델이 매번 깨진 JSON 을 주는 상황에서 차단기가 영영 안 걸렸다. 둘 다 "동작은 하는데 의도와 반대" 라 실행 없이는 안 보인다.
 */
class LlmUsageTrackerTest {

    private LlmUsageTracker tracker;

    @BeforeEach
    void setUp() {
        tracker = new LlmUsageTracker();
    }

    @Test
    @DisplayName("시도·응답·성공을 따로 센다 — 셋을 뭉치면 평균 토큰이 왜곡된다")
    void 카운터_분리() {
        tracker.recordAttempt(Role.CRAWLER);
        tracker.recordResponse(Role.CRAWLER, 5000, 500);
        tracker.recordSuccess(Role.CRAWLER);

        // 응답은 받았지만 파싱 실패한 호출 — 토큰은 이미 썼다.
        tracker.recordAttempt(Role.CRAWLER);
        tracker.recordResponse(Role.CRAWLER, 5000, 500);
        tracker.recordFailure(Role.CRAWLER, LlmFailureKind.PARSE);

        LlmUsageTracker.DailyUsage usage = tracker.today(Role.CRAWLER);
        assertThat(usage.attempts()).isEqualTo(2);
        assertThat(usage.successes()).isEqualTo(1); // 파싱까지 끝난 것만
        assertThat(usage.totalTokens()).isEqualTo(11_000); // 실패분 토큰도 포함
        assertThat(usage.avgTokensPerResponse()).isEqualTo(5_500); // 응답 2회 기준
    }

    @Test
    @DisplayName("역할이 다르면 집계도 분리된다 — 모델별로 한도가 따로 잡히기 때문")
    void 역할별_격리() {
        tracker.recordResponse(Role.CRAWLER, 1000, 100);
        assertThat(tracker.today(Role.CRAWLER).totalTokens()).isEqualTo(1100);
        assertThat(tracker.today(Role.USER).totalTokens()).isZero();
    }

    @Test
    @DisplayName("일일 429 를 받기 전에는 막히지 않는다")
    void 기본은_통과() {
        assertThat(tracker.isDailyQuotaExhausted(Role.CRAWLER)).isFalse();
    }

    @Test
    @DisplayName("서버가 준 대기 시간이 지나면 차단이 풀린다 — KST 자정까지 묶으면 오후 회차가 죽는다")
    void 차단은_만료시각_기준() {
        tracker.markDailyQuotaExhausted(Role.CRAWLER, 1L);
        assertThat(tracker.isDailyQuotaExhausted(Role.CRAWLER)).isTrue();

        // 1초짜리 차단이 지나면 풀려야 한다.
        await(1200);
        assertThat(tracker.isDailyQuotaExhausted(Role.CRAWLER)).isFalse();
    }

    @Test
    @DisplayName("대기 시간을 모르면 다음 UTC 자정까지 막는다")
    void 대기시간_미제공() {
        tracker.markDailyQuotaExhausted(Role.CRAWLER, null);
        assertThat(tracker.isDailyQuotaExhausted(Role.CRAWLER)).isTrue();
        // 사용자 역할은 영향받지 않는다.
        assertThat(tracker.isDailyQuotaExhausted(Role.USER)).isFalse();
    }

    @Test
    @DisplayName("더 늦은 만료가 이미 있으면 짧은 값으로 덮어쓰지 않는다")
    void 만료는_뒤로만_밀린다() {
        tracker.markDailyQuotaExhausted(Role.CRAWLER, 3600L);
        tracker.markDailyQuotaExhausted(Role.CRAWLER, 1L);
        await(1200);
        assertThat(tracker.isDailyQuotaExhausted(Role.CRAWLER)).isTrue();
    }

    @Test
    @DisplayName("연속 실패는 파싱 성공에서만 초기화된다 — 응답 수신으로 초기화하면 차단기가 안 걸린다")
    void 연속실패는_성공에서만_초기화() {
        // 모델이 매번 응답은 주는데 JSON 이 깨진 상황.
        for (int i = 1; i <= 3; i++) {
            tracker.recordResponse(Role.CRAWLER, 100, 10);
            assertThat(tracker.recordConsecutiveFailure(Role.CRAWLER)).isEqualTo(i);
        }

        // 파싱까지 성공해야 초기화된다.
        tracker.recordSuccess(Role.CRAWLER);
        assertThat(tracker.recordConsecutiveFailure(Role.CRAWLER)).isEqualTo(1);
    }

    private void await(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
