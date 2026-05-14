package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.KakaoApiService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 자동수집 파이프라인 — 검색 API → LLM 정규화 → 신뢰도 검증 → DB 저장.
 *
 * <p>키워드는 "서울 + 카테고리/지역/브랜드" 조합으로 다각도 수집한다. Naver(블로그+뉴스) + Kakao(웹+블로그) 4개 채널의 snippet 을 키워드별로 묶어
 * LLM 에게 한 번씩 정규화 요청. 신뢰도 임계값 이상이면 자동게시 (AUTO_PUBLISHED), 미만이면 즉시 폐기 (검수 큐 미사용 — 품질 우선 정책).
 *
 * <p>크롤 1회가 1~2분 걸리므로 {@code @Transactional} 미사용 — 단일 거대 트랜잭션으로 묶으면 DB 커넥션 점유 시간이 길어진다. 각 save()
 * 호출이 Spring Data JPA 의 자동 트랜잭션 단위로 처리된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupCrawlOrchestrator {

    private static final long NAVER_KAKAO_API_INTERVAL_MS = 800L;
    private static final long GROQ_RPM_THROTTLE_MS = 2200L; // Groq 30 RPM = 2초 간격
    private static final long KAKAO_GEOCODING_INTERVAL_MS = 300L;

    private static final String SOURCE_TYPE_CRAWLED = "CRAWLED";
    private static final String REVIEW_STATUS_AUTO_PUBLISHED = "AUTO_PUBLISHED";
    private static final String DEFAULT_CATEGORY = "ETC";

    private static final Set<String> ALLOWED_CATEGORIES =
            Set.of("FASHION", "FOOD", "CULTURE", "CHARACTER", "BEAUTY", "TECH", "ETC");

    /** 서울 한정 다각도 검색 키워드. 구체적인 브랜드/지역명을 섞어 정확도 ↑. */
    private static final List<String> SEARCH_KEYWORDS =
            List.of(
                    // 일반
                    "서울 팝업스토어",
                    "서울 팝업 일정",
                    "서울 신상 팝업",
                    "서울 팝업 추천",
                    // 지역 (구 단위)
                    "성수동 팝업스토어",
                    "성수 팝업 카페",
                    "강남 팝업스토어",
                    "압구정 팝업",
                    "청담동 팝업",
                    "가로수길 팝업",
                    "홍대 팝업스토어",
                    "합정 팝업",
                    "연남동 팝업",
                    "이태원 팝업스토어",
                    "한남동 팝업",
                    "명동 팝업스토어",
                    "삼청동 팝업",
                    "잠실 팝업스토어",
                    // 백화점/대형 시설
                    "더현대 팝업스토어",
                    "더현대 서울 팝업",
                    "롯데월드몰 팝업스토어",
                    "코엑스 팝업스토어",
                    "신세계 팝업스토어",
                    "갤러리아 팝업",
                    "용산 아이파크몰 팝업",
                    "스타필드 팝업",
                    // K-패션 브랜드
                    "젠틀몬스터 팝업",
                    "탬버린즈 팝업",
                    "마뗑킴 팝업스토어",
                    "스튜디오톰보이 팝업",
                    "무신사스탠다드 팝업",
                    "디스이즈네버댓 팝업",
                    "아디다스 팝업스토어",
                    "나이키 팝업스토어 서울",
                    // 캐릭터/IP
                    "포켓몬 팝업스토어 서울",
                    "산리오 팝업스토어",
                    "디즈니 팝업스토어 서울",
                    "카카오프렌즈 팝업",
                    "라인프렌즈 팝업",
                    "헬로키티 팝업",
                    "짱구 팝업",
                    "원피스 팝업",
                    // K-뷰티
                    "올리브영 팝업스토어",
                    "이니스프리 팝업",
                    "라네즈 팝업",
                    "닥터자르트 팝업",
                    // F&B
                    "스타벅스 팝업 서울",
                    "투썸 팝업",
                    "노티드 팝업",
                    "노티드도넛 팝업",
                    // K-pop / 엔터
                    "BTS 팝업스토어",
                    "뉴진스 팝업",
                    "아이브 팝업",
                    "에스파 팝업",
                    "스트레이키즈 팝업",
                    // 카테고리
                    "패션 팝업스토어 서울",
                    "뷰티 팝업스토어 서울",
                    "캐릭터 팝업스토어 서울",
                    "콜라보 팝업 서울");

    private final NaverPopupCrawler naverCrawler;
    private final KakaoPopupCrawler kakaoCrawler;
    private final PopupNormalizationService normalizer;
    private final PopupStoreRepository popupStoreRepository;
    private final KakaoApiService kakaoApiService;

    @Value("${popspot.crawler.confidence-threshold:0.8}")
    private double confidenceThreshold;

    /** 자동게시 목표치 — 이 수에 도달하면 LLM 호출/시간 절약을 위해 조기 종료. 0 이면 제한 없음. */
    @Value("${popspot.crawler.max-auto-published:0}")
    private int maxAutoPublished;

    /** 전체 크롤 1회 실행. 처리 통계를 맵으로 반환. */
    public Map<String, Integer> runOnce() {
        if (areAllCrawlersUnconfigured()) {
            log.warn("[PopupCrawlOrchestrator] Naver/Kakao 둘 다 미설정 → 실행 스킵");
            return Map.of("skipped", 1);
        }

        CrawlStatistics stats = new CrawlStatistics();
        Map<String, List<PopupCrawlSource>> snippetsByKeyword = collectSnippetsByKeyword(stats);
        processNormalizationAndSave(snippetsByKeyword, stats);

        Map<String, Integer> result = stats.toMap();
        log.info("[PopupCrawlOrchestrator] 통계 = {}", result);
        return result;
    }

    /** 좌표 누락된 자동수집 row 를 일괄 backfill. admin 이 1회 호출. */
    public int geocodeMissing() {
        List<PopupStore> targets = popupStoreRepository.findCrawledMissingCoordinates();
        if (targets.isEmpty()) {
            log.info("[Geocode-Backfill] 대상 없음");
            return 0;
        }

        log.info("[Geocode-Backfill] 시작 — 대상 {}개", targets.size());
        int filledCount = 0;
        for (PopupStore popup : targets) {
            if (fillCoordinates(popup)) filledCount++;
            sleepQuietly(KAKAO_GEOCODING_INTERVAL_MS);
        }
        log.info("[Geocode-Backfill] 완료 — {}/{}개 좌표 채움", filledCount, targets.size());
        return filledCount;
    }

    /* =========================== 수집 단계 =========================== */

    private boolean areAllCrawlersUnconfigured() {
        return !naverCrawler.isConfigured() && !kakaoCrawler.isConfigured();
    }

    private Map<String, List<PopupCrawlSource>> collectSnippetsByKeyword(CrawlStatistics stats) {
        Map<String, List<PopupCrawlSource>> grouped = new HashMap<>();

        for (String keyword : SEARCH_KEYWORDS) {
            List<PopupCrawlSource> snippets = fetchSnippetsForKeyword(keyword);
            stats.totalSnippets += snippets.size();
            grouped.computeIfAbsent("kw:" + keyword, k -> new ArrayList<>()).addAll(snippets);
            sleepQuietly(NAVER_KAKAO_API_INTERVAL_MS);
        }
        return grouped;
    }

    private List<PopupCrawlSource> fetchSnippetsForKeyword(String keyword) {
        List<PopupCrawlSource> snippets = new ArrayList<>();
        snippets.addAll(naverCrawler.searchBlog(keyword));
        snippets.addAll(naverCrawler.searchNews(keyword));
        snippets.addAll(kakaoCrawler.searchWeb(keyword));
        snippets.addAll(kakaoCrawler.searchBlog(keyword));
        return snippets;
    }

    /* =========================== 정규화 + 저장 단계 =========================== */

    private void processNormalizationAndSave(
            Map<String, List<PopupCrawlSource>> grouped, CrawlStatistics stats) {
        boolean isFirstCall = true;

        for (Map.Entry<String, List<PopupCrawlSource>> entry : grouped.entrySet()) {
            if (shouldStopEarly(stats)) break;

            List<PopupCrawlSource> snippets = entry.getValue();
            if (snippets.isEmpty()) continue;

            if (!isFirstCall) sleepQuietly(GROQ_RPM_THROTTLE_MS);
            isFirstCall = false;

            NormalizedPopup normalized = normalizer.normalize(snippets);
            stats.normalized++;

            handleNormalizedResult(normalized, snippets, stats);
        }
    }

    private boolean shouldStopEarly(CrawlStatistics stats) {
        if (maxAutoPublished <= 0 || stats.autoPublished < maxAutoPublished) return false;
        log.info(
                "[PopupCrawlOrchestrator] 자동게시 목표 {}개 달성 → 조기 종료 (정규화 {}회 처리)",
                maxAutoPublished,
                stats.normalized);
        return true;
    }

    private void handleNormalizedResult(
            NormalizedPopup result, List<PopupCrawlSource> snippets, CrawlStatistics stats) {
        if (isInvalidResult(result)) {
            stats.rejected++;
            log.debug("[PopupCrawlOrchestrator] 정규화 거부: {}", result.getError());
            return;
        }
        if (result.getConfidence() < confidenceThreshold) {
            stats.rejected++;
            log.debug(
                    "[PopupCrawlOrchestrator] 신뢰도 미달 폐기: {} (confidence={}, threshold={})",
                    result.getName(),
                    result.getConfidence(),
                    confidenceThreshold);
            return;
        }

        String externalId =
                computeExternalId(result.getName(), result.getLocation(), result.getStartDate());

        if (markDuplicateAsSeen(externalId)) {
            stats.duplicates++;
            return;
        }

        saveNewPopup(result, snippets, externalId);
        stats.autoPublished++;
    }

    private boolean isInvalidResult(NormalizedPopup result) {
        return result.getError() != null
                || result.getConfidence() == null
                || result.getName() == null
                || result.getName().isBlank();
    }

    private boolean markDuplicateAsSeen(String externalId) {
        Optional<PopupStore> existing = popupStoreRepository.findByExternalId(externalId);
        if (existing.isEmpty()) return false;

        PopupStore popup = existing.get();
        popup.setLastSeenAt(LocalDateTime.now());
        popupStoreRepository.save(popup);
        return true;
    }

    private void saveNewPopup(
            NormalizedPopup result, List<PopupCrawlSource> snippets, String externalId) {
        PopupCrawlSource primarySource = snippets.get(0);
        String[] coordinates = geocode(result.getName(), result.getLocation());

        PopupStore newPopup =
                PopupStore.builder()
                        .name(result.getName())
                        .location(result.getLocation())
                        .category(safeCategory(result.getCategory()))
                        .description(result.getDescription())
                        .content(result.getContent())
                        .startDate(result.getStartDate())
                        .endDate(result.getEndDate())
                        .viewCount(0)
                        .latitude(coordinates != null ? coordinates[0] : null)
                        .longitude(coordinates != null ? coordinates[1] : null)
                        .sourceType(SOURCE_TYPE_CRAWLED)
                        .sourceUrl(primarySource.getLink())
                        .sourceName(primarySource.getSourceName())
                        .externalId(externalId)
                        .confidenceScore(
                                BigDecimal.valueOf(result.getConfidence())
                                        .setScale(2, RoundingMode.HALF_UP))
                        .crawledAt(LocalDateTime.now())
                        .lastSeenAt(LocalDateTime.now())
                        .reviewStatus(REVIEW_STATUS_AUTO_PUBLISHED)
                        .build();

        popupStoreRepository.save(newPopup);
    }

    /* =========================== Geocoding =========================== */

    /**
     * Kakao 로컬 키워드 검색으로 좌표 변환.
     *
     * <ol>
     *   <li>1차: 이름 + 위치 함께 검색 — 정확도 ↑
     *   <li>2차: 1차 실패 시 위치만 — fallback
     * </ol>
     */
    private String[] geocode(String name, String location) {
        try {
            String trimmedName = name == null ? "" : name.trim();
            String trimmedLoc = location == null ? "" : location.trim();

            String combinedQuery = (trimmedName + " " + trimmedLoc).trim();
            if (!combinedQuery.isBlank()) {
                String[] result = tryGeocodeOnce(combinedQuery);
                if (result != null) return result;
            }

            if (!trimmedLoc.isBlank() && !trimmedLoc.equals(combinedQuery)) {
                return tryGeocodeOnce(trimmedLoc);
            }
            return null;
        } catch (Exception e) {
            log.debug("[Geocode] '{}' 실패: {}", name, e.toString());
            return null;
        }
    }

    private String[] tryGeocodeOnce(String query) {
        try {
            Map<String, Object> response = kakaoApiService.searchPopups(query);
            if (response == null) return null;

            Object documentsRaw = response.get("documents");
            if (!(documentsRaw instanceof List<?> documents) || documents.isEmpty()) return null;

            Object firstDocRaw = documents.get(0);
            if (!(firstDocRaw instanceof Map<?, ?> firstDoc)) return null;

            Object longitude = firstDoc.get("x");
            Object latitude = firstDoc.get("y");
            if (longitude == null || latitude == null) return null;

            return new String[] {String.valueOf(latitude), String.valueOf(longitude)};
        } catch (Exception e) {
            return null;
        }
    }

    private boolean fillCoordinates(PopupStore popup) {
        String[] coords = geocode(popup.getName(), popup.getLocation());
        if (coords == null) return false;

        popup.setLatitude(coords[0]);
        popup.setLongitude(coords[1]);
        popupStoreRepository.save(popup);
        return true;
    }

    /* =========================== 단순 헬퍼 =========================== */

    /** SHA-256(name|location|startDate) — null 안전 한 외부 식별자 생성. */
    private String computeExternalId(String name, String location, String startDate) {
        String raw = normalizePart(name) + "|" + normalizePart(location) + "|" + safeStr(startDate);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (Exception e) {
            return Integer.toHexString(raw.hashCode());
        }
    }

    private String normalizePart(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    private String safeStr(String s) {
        return s == null ? "" : s;
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    private String safeCategory(String category) {
        if (category == null) return DEFAULT_CATEGORY;
        String upper = category.toUpperCase();
        return ALLOWED_CATEGORIES.contains(upper) ? upper : DEFAULT_CATEGORY;
    }

    private void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    /* =========================== 내부 통계 클래스 =========================== */

    private static class CrawlStatistics {
        int totalSnippets;
        int normalized;
        int autoPublished;
        int pendingReview;
        int duplicates;
        int rejected;

        Map<String, Integer> toMap() {
            Map<String, Integer> map = new LinkedHashMap<>();
            map.put("totalSnippets", totalSnippets);
            map.put("normalized", normalized);
            map.put("autoPublished", autoPublished);
            map.put("pendingReview", pendingReview);
            map.put("duplicates", duplicates);
            map.put("rejected", rejected);
            return map;
        }
    }
}
