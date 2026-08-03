package com.example.popspotbackend.service.admin;

import com.example.popspotbackend.repository.AdminAuditLogRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 감사 로그 보관 기간을 지킨다.
 *
 * <p><b>여기서 기간은 상한이 아니라 하한이다.</b> 다른 정리 작업(방문 로그 90일 등)은 "이 이상 갖고 있지 마라" 는 개인정보 최소보관 요구를 지키는 것이지만,
 * 관리자 접속기록은 반대로 <b>일정 기간 이상 반드시 보관</b>해야 한다. 개인정보처리시스템에 누가 접근했는지를 사후에 확인할 수 있어야 하기 때문이다.
 *
 * <p>그래서 이 스케줄러는 "오래된 것을 지우는" 일을 하지만, 기본값은 법정 최소 기간에 맞춰져 있고 <b>그보다 짧게 설정하면 시작하지 않는다.</b> 설정 실수로 보관
 * 의무를 어기는 쪽으로 기울지 않게 한다.
 *
 * <p>정보주체가 5만 명을 넘거나 고유식별정보·민감정보를 다루기 시작하면 요구 기간이 2년으로 올라간다. 그때는 {@code
 * POPSPOT_ADMIN_AUDIT_RETENTION_DAYS} 를 730 으로 올린다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAuditRetentionScheduler {

    /** 법정 최소 보관 기간. 이보다 짧게 설정하면 정리를 아예 하지 않는다. */
    private static final int LEGAL_MINIMUM_DAYS = 365;

    private final AdminAuditLogRepository repository;

    @Value("${popspot.admin-audit.retention-days:365}")
    private int retentionDays;

    /** 방문 로그 정리(04:40)와 겹치지 않게 시간을 벌려 둔다. */
    @Scheduled(cron = "${popspot.admin-audit.cleanup-cron:0 50 4 * * *}", zone = "Asia/Seoul")
    @Transactional
    public void deleteExpired() {
        if (retentionDays < LEGAL_MINIMUM_DAYS) {
            // 설정이 최소 기간보다 짧다. 지우는 대신 알린다 — 조용히 따르면 보관 의무를 어긴다.
            log.warn(
                    "[감사로그] 보관 기간 설정이 법정 최소보다 짧아 정리를 건너뜁니다 — 설정={}일, 최소={}일",
                    retentionDays,
                    LEGAL_MINIMUM_DAYS);
            return;
        }

        LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
        int deleted = repository.deleteOlderThan(cutoff);
        if (deleted > 0) {
            log.info("[감사로그] 보관 기간이 지난 {}건 삭제 (기준={}일)", deleted, retentionDays);
        }
    }
}
