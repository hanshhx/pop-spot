package com.example.popspotbackend.admin.metrics;

import com.example.popspotbackend.repository.PopupStoreRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 자동수집 운영 지표 — 오늘 새 팝업 수, 평균 신뢰도, 검수 대기열 크기.
 *
 * <p>매 호출마다 DB 집계 쿼리 3건 (가벼움). 어드민 폴링 빈도 (3 초) 정도면 부담 없음.
 */
@Component
@RequiredArgsConstructor
public class CrawlerMetricSnapshotProvider implements MetricSnapshotProvider {

    private final PopupStoreRepository popupStoreRepository;

    @Override
    public String key() {
        return "crawler";
    }

    @Override
    public Map<String, Object> snapshot() {
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();

        Map<String, Object> out = new HashMap<>();
        out.put("crawledToday", popupStoreRepository.countCrawledSince(startOfToday));
        out.put("avgConfidence", round2(popupStoreRepository.averageConfidenceSince(startOfToday)));
        out.put("pendingReview", popupStoreRepository.countPendingReview());
        return out;
    }

    private double round2(BigDecimal value) {
        if (value == null) return 0.0;
        return Math.round(value.doubleValue() * 100) / 100.0;
    }
}
