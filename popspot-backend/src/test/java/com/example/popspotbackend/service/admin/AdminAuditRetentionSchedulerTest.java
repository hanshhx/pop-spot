package com.example.popspotbackend.service.admin;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.example.popspotbackend.repository.AdminAuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 감사 로그 보관 기간이 <b>하한</b>으로 동작하는지 확인한다.
 *
 * <p>다른 정리 작업은 "이 이상 갖고 있지 마라" 지만, 관리자 접속기록은 반대로 일정 기간 이상 반드시 보관해야 한다. 설정 실수 한 번으로 보관 의무를 어기는 쪽으로
 * 기울면 안 된다.
 */
class AdminAuditRetentionSchedulerTest {

    private AdminAuditLogRepository repository;
    private AdminAuditRetentionScheduler scheduler;

    @BeforeEach
    void setUp() {
        repository = mock(AdminAuditLogRepository.class);
        scheduler = new AdminAuditRetentionScheduler(repository);
    }

    private void setRetention(int days) {
        ReflectionTestUtils.setField(scheduler, "retentionDays", days);
    }

    @Test
    @DisplayName("법정 최소보다 짧게 설정하면 아무것도 지우지 않는다 — 설정 실수가 보관 의무를 어기면 안 된다")
    void refusesToDeleteBelowLegalMinimum() {
        setRetention(90);

        scheduler.deleteExpired();

        verify(repository, never()).deleteOlderThan(any());
    }

    @Test
    @DisplayName("0 이나 음수도 마찬가지로 거부한다 — 설정 누락이 전량 삭제가 되면 안 된다")
    void refusesZeroOrNegative() {
        setRetention(0);
        scheduler.deleteExpired();

        setRetention(-1);
        scheduler.deleteExpired();

        verify(repository, never()).deleteOlderThan(any());
    }

    @Test
    @DisplayName("최소 기간 이상이면 그 기준으로 정리한다")
    void deletesWhenAtOrAboveMinimum() {
        setRetention(365);

        scheduler.deleteExpired();

        verify(repository).deleteOlderThan(any());
    }
}
