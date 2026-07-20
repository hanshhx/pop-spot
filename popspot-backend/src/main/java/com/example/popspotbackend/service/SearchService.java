package com.example.popspotbackend.service;

import com.algolia.search.DefaultSearchClient;
import com.algolia.search.SearchClient;
import com.algolia.search.SearchIndex;
import com.example.popspotbackend.dto.PopupSearchDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Algolia 검색 인덱스 동기화 서비스.
 *
 * <p>키 미설정 / 형식 오류 시 graceful 하게 비활성화되어 백엔드 부팅을 막지 않는다.
 *
 * <p>v2.13 부터 인덱싱 시점에 "AUTO_PUBLISHED 또는 APPROVED + confidence ≥ 임계값" row 만 인덱싱하도록 가드한다. 정확도 낮은 row
 * 가 SearchBox 에 노출되던 문제를 백엔드 단에서 차단. 만료/검수 대기 row 는 인덱스에 올라가지 않으므로 프론트 추가 분기 없이도 자동으로 가려진다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final String INDEX_NAME = "popups";
    private static final int APP_ID_MIN_LENGTH = 6;
    private static final int API_KEY_MIN_LENGTH = 10;
    private static final String APP_ID_PATTERN = "^[A-Z0-9]+$";

    /** 인덱싱 허용 reviewStatus. null (레거시 수동 등록) 도 통과. */
    private static final Set<String> INDEXABLE_REVIEW_STATUSES =
            Set.of("AUTO_PUBLISHED", "APPROVED");

    /** 인덱싱 차단할 status. EXPIRED / PENDING 은 검색 결과에서 빠진다. */
    private static final Set<String> NON_INDEXABLE_STATUSES = Set.of("EXPIRED", "PENDING");

    private final PopupStoreRepository popupStoreRepository;
    private SearchIndex<PopupSearchDto> index;
    private boolean enabled = false;

    @Value("${algolia.app-id:}")
    private String appId;

    @Value("${algolia.api-key:}")
    private String apiKey;

    /** PopupCrawlOrchestrator 와 같은 임계값을 사용해 정확도 정책을 한 곳에서 통제. */
    @Value("${popspot.crawler.confidence-threshold:0.8}")
    private double confidenceThreshold;

    @PostConstruct
    public void init() {
        if (!isAlgoliaConfigured()) {
            log.warn("[SearchService] Algolia 미설정 또는 잘못된 키 형식 → 검색 기능 비활성화");
            return;
        }
        try {
            SearchClient client = DefaultSearchClient.create(appId, apiKey);
            index = client.initIndex(INDEX_NAME, PopupSearchDto.class);
            enabled = true;
            log.info("[SearchService] Algolia 클라이언트 초기화 완료");
        } catch (Exception e) {
            log.warn("[SearchService] Algolia 초기화 실패 → 비활성화: {}", e.toString());
        }
    }

    /**
     * DB → Algolia 전체 동기화. v2.13 부터 인덱싱 가능 row 만 push 하고, 그 외 row 는 인덱스에서 명시 삭제한다 (옛 garbage
     * cleanup).
     */
    public int syncAllPopups() {
        if (!enabled) {
            log.debug("[SearchService] 비활성화 상태 → syncAllPopups 스킵");
            return 0;
        }
        List<PopupStore> all = popupStoreRepository.findAll();

        List<PopupSearchDto> indexable =
                all.stream().filter(this::isIndexable).map(PopupSearchDto::fromEntity).toList();

        List<String> nonIndexableIds =
                all.stream()
                        .filter(p -> !isIndexable(p))
                        .map(p -> String.valueOf(p.getId()))
                        .toList();

        if (!indexable.isEmpty()) {
            index.saveObjects(indexable).waitTask();
        }
        if (!nonIndexableIds.isEmpty()) {
            index.deleteObjects(nonIndexableIds).waitTask();
        }
        log.info(
                "[SearchService] Algolia 동기화: 인덱싱 {}개, 삭제 {}개 (전체 {}개)",
                indexable.size(),
                nonIndexableIds.size(),
                all.size());
        return indexable.size();
    }

    /** 신규 또는 갱신된 팝업 1건 push. 인덱싱 가능 여부 검증 후, 부적격이면 인덱스에서 삭제까지 처리한다 (예: 검수에서 REJECTED 로 바뀐 row). */
    public void addPopup(PopupStore popup) {
        if (!enabled) return;
        String id = String.valueOf(popup.getId());
        if (isIndexable(popup)) {
            index.saveObject(PopupSearchDto.fromEntity(popup));
        } else {
            index.deleteObject(id);
        }
    }

    /** 인덱스에서 특정 id 강제 삭제 (어드민 삭제 후 호출). */
    public void removePopup(Long popupId) {
        if (!enabled || popupId == null) return;
        index.deleteObject(String.valueOf(popupId));
    }

    /* ============================== 인덱싱 정책 ============================== */

    private boolean isIndexable(PopupStore popup) {
        return passesReviewStatus(popup)
                && passesStatus(popup)
                && passesConfidence(popup)
                && passesEndDate(popup);
    }

    /**
     * 종료일이 지난 팝업은 인덱싱하지 않는다.
     *
     * <p>{@code status=EXPIRED} 는 {@link #passesStatus} 가 이미 거르지만, 그 전환은 하루 1회 스케줄러가 한다. 스케줄러가
     * 지연·실패하면 이미 끝난 팝업이 인덱스에 그대로 남는데, 인덱스에서 빠지는 유일한 경로가 그 스케줄러라 스스로 회복되지 않는다. DB 조회에 건 이중 차단과 같은
     * 기준을 인덱스에도 적용한다.
     *
     * <p>값이 없거나 형식이 다르면 통과 — 날짜 미상은 종료 근거가 아니다(DB 필터와 동일 정책).
     */
    private boolean passesEndDate(PopupStore popup) {
        String end = popup.getEndDate();
        if (end == null || end.isBlank()) return true;
        return end.compareTo(PopupStoreRepository.todayKst()) >= 0;
    }

    private boolean passesReviewStatus(PopupStore popup) {
        String rs = popup.getReviewStatus();
        return rs == null || INDEXABLE_REVIEW_STATUSES.contains(rs);
    }

    private boolean passesStatus(PopupStore popup) {
        String s = popup.getStatus();
        return s == null || !NON_INDEXABLE_STATUSES.contains(s);
    }

    /** 자동수집 row 는 임계값 충족 필수. 수동 등록(confidenceScore=null) 은 통과. */
    private boolean passesConfidence(PopupStore popup) {
        BigDecimal score = popup.getConfidenceScore();
        if (score == null) return true;
        return score.doubleValue() >= confidenceThreshold;
    }

    private boolean isAlgoliaConfigured() {
        return appId != null
                && !appId.isBlank()
                && appId.length() >= APP_ID_MIN_LENGTH
                && appId.matches(APP_ID_PATTERN)
                && apiKey != null
                && !apiKey.isBlank()
                && apiKey.length() >= API_KEY_MIN_LENGTH;
    }
}
