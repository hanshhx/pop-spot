package com.example.popspotbackend.repository;

import com.example.popspotbackend.entity.PopupWaitReport;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PopupWaitReportRepository extends JpaRepository<PopupWaitReport, Long> {

    /** 집계용 — 특정 팝업의 최근 제보들. */
    List<PopupWaitReport> findByPopupIdAndCreatedAtAfter(Long popupId, LocalDateTime since);

    /** 쿨다운용 — 같은 사람이 이 팝업에 최근 제보한 적 있나. */
    long countByPopupIdAndReporterKeyAndCreatedAtAfter(
            Long popupId, String reporterKey, LocalDateTime since);
}
