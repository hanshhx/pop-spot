package com.example.popspotbackend.service;

import com.algolia.search.DefaultSearchClient;
import com.algolia.search.SearchClient;
import com.algolia.search.SearchIndex;
import com.example.popspotbackend.dto.PopupSearchDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import jakarta.annotation.PostConstruct;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Algolia 검색 인덱스 동기화 서비스.
 *
 * <p>키 미설정 / 형식 오류 시 graceful 하게 비활성화되어 백엔드 부팅을 막지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final String INDEX_NAME = "popups";
    private static final int APP_ID_MIN_LENGTH = 6;
    private static final int API_KEY_MIN_LENGTH = 10;
    private static final String APP_ID_PATTERN = "^[A-Z0-9]+$";

    private final PopupStoreRepository popupStoreRepository;
    private SearchIndex<PopupSearchDto> index;
    private boolean enabled = false;

    @Value("${algolia.app-id:}")
    private String appId;

    @Value("${algolia.api-key:}")
    private String apiKey;

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

    /** DB → Algolia 일괄 동기화 (초기 세팅용). */
    public void syncAllPopups() {
        if (!enabled) {
            log.debug("[SearchService] 비활성화 상태 → syncAllPopups 스킵");
            return;
        }
        List<PopupSearchDto> dtos =
                popupStoreRepository.findAll().stream().map(PopupSearchDto::fromEntity).toList();
        index.saveObjects(dtos).waitTask();
        log.info("[SearchService] Algolia 동기화 완료: {}개", dtos.size());
    }

    /** 신규 팝업이 등록될 때 호출. */
    public void addPopup(PopupStore popup) {
        if (!enabled) return;
        index.saveObject(PopupSearchDto.fromEntity(popup));
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
