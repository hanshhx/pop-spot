package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 검색 API → Gemini 정규화 → DB 저장 까지 전체 파이프라인.
 *
 * 키워드는 "서울 + 카테고리/지역" 조합으로 다각도 수집.
 * confidence ≥ threshold 면 자동 게시 (AUTO_PUBLISHED), 그 외 PENDING_REVIEW.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupCrawlOrchestrator {

    private final NaverPopupCrawler naverCrawler;
    private final KakaoPopupCrawler kakaoCrawler;
    private final PopupNormalizationService normalizer;
    private final PopupStoreRepository popupStoreRepository;

    /** 자동 게시 임계값 — application.properties 의 popspot.crawler.confidence-threshold */
    @Value("${popspot.crawler.confidence-threshold:0.8}")
    private double confidenceThreshold;

    /** 검색 키워드 (서울 한정, 다각도) */
    private static final List<String> KEYWORDS = List.of(
            "서울 팝업스토어",
            "성수동 팝업스토어",
            "더현대 팝업스토어",
            "강남 팝업스토어",
            "홍대 팝업스토어",
            "서울 팝업 일정",
            "서울 신상 팝업"
    );

    /**
     * 전체 크롤 1회 실행.
     * @return 처리 통계 맵
     *
     * 의도적으로 @Transactional 미사용 — 크롤 1회가 1~2분 걸릴 수 있어
     * 단일 거대 트랜잭션으로 묶으면 DB 커넥션 점유 문제 발생.
     * popupStoreRepository.save() 는 Spring Data JPA 가 호출 단위로
     * 자동 트랜잭션 처리.
     */
    public Map<String, Integer> runOnce() {
        if (!naverCrawler.isConfigured() && !kakaoCrawler.isConfigured()) {
            log.warn("[PopupCrawlOrchestrator] Naver/Kakao 둘 다 미설정 → 실행 스킵");
            return Map.of("skipped", 1);
        }

        int totalSnippets = 0;
        int normalized = 0;
        int autoPublished = 0;
        int pendingReview = 0;
        int duplicates = 0;
        int rejected = 0;

        // 1) 키워드별 raw snippet 수집 → 동일 팝업 단위로 그룹핑
        Map<String, List<PopupCrawlSource>> grouped = new HashMap<>();

        for (String keyword : KEYWORDS) {
            List<PopupCrawlSource> snippets = new ArrayList<>();
            snippets.addAll(naverCrawler.searchBlog(keyword));
            snippets.addAll(naverCrawler.searchNews(keyword));
            snippets.addAll(kakaoCrawler.searchWeb(keyword));
            snippets.addAll(kakaoCrawler.searchBlog(keyword));
            totalSnippets += snippets.size();

            // 같은 키워드의 snippet 들을 묶음 단위로 정규화 (1 키워드 = 1 그룹)
            // 더 정교한 그룹핑은 향후 fuzzy match 로 개선 가능.
            String groupKey = "kw:" + keyword;
            grouped.computeIfAbsent(groupKey, k -> new ArrayList<>()).addAll(snippets);

            sleepQuietly(800);  // API 매너 — 폭주 방지
        }

        // 2) 각 그룹마다 Gemini 정규화 → 저장
        for (Map.Entry<String, List<PopupCrawlSource>> entry : grouped.entrySet()) {
            List<PopupCrawlSource> snippets = entry.getValue();
            if (snippets.isEmpty()) continue;

            NormalizedPopup result = normalizer.normalize(snippets);
            normalized++;

            if (result.getError() != null || result.getConfidence() == null
                    || result.getName() == null || result.getName().isBlank()) {
                rejected++;
                log.debug("[PopupCrawlOrchestrator] 정규화 거부: {}", result.getError());
                continue;
            }

            // 3) 중복 검사
            String externalId = computeExternalId(result.getName(), result.getLocation(), result.getStartDate());
            Optional<PopupStore> existing = popupStoreRepository.findByExternalId(externalId);

            if (existing.isPresent()) {
                duplicates++;
                PopupStore p = existing.get();
                p.setLastSeenAt(LocalDateTime.now());
                popupStoreRepository.save(p);
                continue;
            }

            // 4) 신뢰도에 따라 review_status 결정
            String reviewStatus = result.getConfidence() >= confidenceThreshold
                    ? "AUTO_PUBLISHED"
                    : "PENDING_REVIEW";

            if ("AUTO_PUBLISHED".equals(reviewStatus)) autoPublished++;
            else pendingReview++;

            // 5) 출처 첫번째 URL 을 source_url 로 저장
            PopupCrawlSource primarySource = snippets.get(0);

            PopupStore newPopup = PopupStore.builder()
                    .name(result.getName())
                    .location(result.getLocation())
                    .category(safeCategory(result.getCategory()))
                    .description(result.getDescription())
                    .content(result.getContent())
                    .startDate(result.getStartDate())
                    .endDate(result.getEndDate())
                    .viewCount(0)
                    .sourceType("CRAWLED")
                    .sourceUrl(primarySource.getLink())
                    .sourceName(primarySource.getSourceName())
                    .externalId(externalId)
                    .confidenceScore(BigDecimal.valueOf(result.getConfidence())
                            .setScale(2, RoundingMode.HALF_UP))
                    .crawledAt(LocalDateTime.now())
                    .lastSeenAt(LocalDateTime.now())
                    .reviewStatus(reviewStatus)
                    .build();

            popupStoreRepository.save(newPopup);
        }

        Map<String, Integer> stats = new LinkedHashMap<>();
        stats.put("totalSnippets", totalSnippets);
        stats.put("normalized", normalized);
        stats.put("autoPublished", autoPublished);
        stats.put("pendingReview", pendingReview);
        stats.put("duplicates", duplicates);
        stats.put("rejected", rejected);
        log.info("[PopupCrawlOrchestrator] 통계 = {}", stats);
        return stats;
    }

    /** SHA-256(name|location|startDate) — null 안전 */
    private String computeExternalId(String name, String location, String startDate) {
        String raw = (name == null ? "" : name.trim().toLowerCase())
                + "|" + (location == null ? "" : location.trim().toLowerCase())
                + "|" + (startDate == null ? "" : startDate);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(raw.hashCode());
        }
    }

    private String safeCategory(String c) {
        if (c == null) return "ETC";
        Set<String> allowed = Set.of("FASHION","FOOD","CULTURE","CHARACTER","BEAUTY","TECH","ETC");
        return allowed.contains(c.toUpperCase()) ? c.toUpperCase() : "ETC";
    }

    private void sleepQuietly(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
    }
}
