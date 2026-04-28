package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.KakaoApiService;
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
    /** Geocoding 용 — 카카오 로컬 키워드 검색 API */
    private final KakaoApiService kakaoApiService;

    /** 자동 게시 임계값 — application.properties 의 popspot.crawler.confidence-threshold */
    @Value("${popspot.crawler.confidence-threshold:0.8}")
    private double confidenceThreshold;

    /** 자동 게시 목표치 — 이만큼 모이면 조기 종료. 0 또는 음수면 제한 없음. */
    @Value("${popspot.crawler.max-auto-published:0}")
    private int maxAutoPublished;

    /** 검색 키워드 (서울 한정, 다각도) — 브랜드명 추가로 정확도 ↑, 한 번에 20+ 자동게시 목표 */
    private static final List<String> KEYWORDS = List.of(
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
            // 백화점/대형 시설 (구체적 → confidence 높음)
            "더현대 팝업스토어",
            "더현대 서울 팝업",
            "롯데월드몰 팝업스토어",
            "코엑스 팝업스토어",
            "신세계 팝업스토어",
            "갤러리아 팝업",
            "용산 아이파크몰 팝업",
            "스타필드 팝업",
            // K-패션 브랜드 (구체적 브랜드명 → 정확한 정보 매칭)
            "젠틀몬스터 팝업",
            "탬버린즈 팝업",
            "마뗑킴 팝업스토어",
            "스튜디오톰보이 팝업",
            "무신사스탠다드 팝업",
            "디스이즈네버댓 팝업",
            "아디다스 팝업스토어",
            "나이키 팝업스토어 서울",
            // 캐릭터/IP 팝업
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
            "콜라보 팝업 서울"
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
        // ⚠️ Gemini 무료 티어 RPM 10 회피 — 호출 사이 6.5초 대기
        boolean firstNormalization = true;
        for (Map.Entry<String, List<PopupCrawlSource>> entry : grouped.entrySet()) {
            // 🎯 자동게시 목표치 달성 시 조기 종료 (Gemini quota / 시간 절약)
            if (maxAutoPublished > 0 && autoPublished >= maxAutoPublished) {
                log.info("[PopupCrawlOrchestrator] 자동게시 목표 {}개 달성 → 조기 종료 (정규화 {}회 처리)",
                        maxAutoPublished, normalized);
                break;
            }

            List<PopupCrawlSource> snippets = entry.getValue();
            if (snippets.isEmpty()) continue;

            // 첫 호출 외엔 RPM 10 이하로 강제 (60/10 = 6초)
            if (!firstNormalization) {
                sleepQuietly(6500);
            }
            firstNormalization = false;

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

            // 6) Geocoding — 카카오 로컬 API 로 위경도 자동 변환 (지도 표시용)
            String[] coords = geocode(result.getName(), result.getLocation());

            PopupStore newPopup = PopupStore.builder()
                    .name(result.getName())
                    .location(result.getLocation())
                    .category(safeCategory(result.getCategory()))
                    .description(result.getDescription())
                    .content(result.getContent())
                    .startDate(result.getStartDate())
                    .endDate(result.getEndDate())
                    .viewCount(0)
                    .latitude(coords != null ? coords[0] : null)
                    .longitude(coords != null ? coords[1] : null)
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

    /**
     * Kakao 로컬 키워드 검색으로 좌표 변환.
     * 1차: 이름+위치 함께 → 정확도 ↑
     * 2차: (1차 실패 시) 위치만 → fallback
     * @return [lat, lng] 또는 null (실패/결과없음)
     */
    private String[] geocode(String name, String location) {
        try {
            String trimmedName = name == null ? "" : name.trim();
            String trimmedLoc = location == null ? "" : location.trim();

            // 1차 시도 — 이름+위치
            String query1 = (trimmedName + " " + trimmedLoc).trim();
            if (!query1.isBlank()) {
                String[] r = tryGeocodeOnce(query1);
                if (r != null) return r;
            }

            // 2차 시도 — 위치만
            if (!trimmedLoc.isBlank() && !trimmedLoc.equals(query1)) {
                String[] r = tryGeocodeOnce(trimmedLoc);
                if (r != null) return r;
            }

            return null;
        } catch (Exception e) {
            log.debug("[Geocode] '{}' 실패: {}", name, e.toString());
            return null;
        }
    }

    /** Kakao 로컬 API 호출 1회. 실패 시 null 반환 (예외 던지지 않음). */
    private String[] tryGeocodeOnce(String query) {
        try {
            Map<String, Object> response = kakaoApiService.searchPopups(query);
            if (response == null) return null;

            Object docsRaw = response.get("documents");
            if (!(docsRaw instanceof List<?>)) return null;
            List<?> documents = (List<?>) docsRaw;
            if (documents.isEmpty()) return null;

            Object firstRaw = documents.get(0);
            if (!(firstRaw instanceof Map<?, ?>)) return null;
            Map<?, ?> first = (Map<?, ?>) firstRaw;

            Object x = first.get("x"); // longitude
            Object y = first.get("y"); // latitude
            if (x == null || y == null) return null;

            return new String[]{String.valueOf(y), String.valueOf(x)};
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 좌표 누락된 자동수집 row 일괄 backfill (admin 1회 호출).
     * @return 좌표 채워진 row 수
     */
    public int geocodeMissing() {
        List<PopupStore> targets = popupStoreRepository.findCrawledMissingCoordinates();
        if (targets.isEmpty()) {
            log.info("[Geocode-Backfill] 대상 없음");
            return 0;
        }
        log.info("[Geocode-Backfill] 시작 — 대상 {}개", targets.size());
        int filled = 0;
        for (PopupStore p : targets) {
            String[] coords = geocode(p.getName(), p.getLocation());
            if (coords != null) {
                p.setLatitude(coords[0]);
                p.setLongitude(coords[1]);
                popupStoreRepository.save(p);
                filled++;
            }
            sleepQuietly(300); // Kakao API 매너
        }
        log.info("[Geocode-Backfill] 완료 — {}/{}개 좌표 채움", filled, targets.size());
        return filled;
    }
}
