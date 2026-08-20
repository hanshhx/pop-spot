package com.example.popspotbackend.admin.metrics;

import com.example.popspotbackend.repository.PopupStoreRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 자동수집 운영 지표 — 오늘 새 팝업 수, 평균 신뢰도, 검수 대기열 크기.
 *
 * <p>매 호출마다 DB 집계 쿼리 4건 (가벼움). 어드민 폴링 빈도 (3 초) 정도면 부담 없음.
 */
@Component
@RequiredArgsConstructor
public class CrawlerMetricSnapshotProvider implements MetricSnapshotProvider {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final long STALE_AFTER_HOURS = 36;

    private final PopupStoreRepository popupStoreRepository;

    /** Spring 예약 작업 전체 스위치. 서버 이전·복구 뒤 기본 false가 남는 사고를 관리자 화면에서 드러낸다. */
    @Value("${popspot.scheduling.enabled:false}")
    private boolean schedulingEnabled;

    /** 자동수집 자체 스위치. 전역 예약 작업이 켜져 있어도 이것이 false면 크롤러는 실행되지 않는다. */
    @Value("${popspot.crawler.enabled:false}")
    private boolean crawlerEnabled;

    @Override
    public String key() {
        return "crawler";
    }

    @Override
    public Map<String, Object> snapshot() {
        LocalDateTime now = LocalDateTime.now(KST);
        LocalDateTime startOfToday = LocalDate.now(KST).atStartOfDay();
        LocalDateTime latestNewPopupAt = popupStoreRepository.findLatestCrawledAt();

        Map<String, Object> out = new HashMap<>();
        out.put("crawledToday", popupStoreRepository.countCrawledSince(startOfToday));
        out.put("avgConfidence", round2(popupStoreRepository.averageConfidenceSince(startOfToday)));
        out.put("pendingReview", popupStoreRepository.countPendingReview());
        out.put("schedulingEnabled", schedulingEnabled);
        out.put("crawlerEnabled", crawlerEnabled);
        out.put("automationEnabled", schedulingEnabled && crawlerEnabled);
        out.put("lastNewPopupAt", latestNewPopupAt == null ? null : latestNewPopupAt.toString());
        out.put("newPopupDataStale", isStale(latestNewPopupAt, now));
        return out;
    }

    private boolean isStale(LocalDateTime latestNewPopupAt, LocalDateTime now) {
        if (latestNewPopupAt == null) return true;
        return Duration.between(latestNewPopupAt, now).toHours() >= STALE_AFTER_HOURS;
    }

    private double round2(BigDecimal value) {
        if (value == null) return 0.0;
        return Math.round(value.doubleValue() * 100) / 100.0;
    }
}
