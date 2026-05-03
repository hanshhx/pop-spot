package com.example.popspotbackend.service;

import com.algolia.search.DefaultSearchClient;
import com.algolia.search.SearchClient;
import com.algolia.search.SearchIndex;
import com.example.popspotbackend.dto.PopupSearchDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Algolia 검색 서비스.
 * Algolia 키 미설정/잘못된 경우 graceful 하게 비활성화.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final PopupStoreRepository popupStoreRepository;
    private SearchIndex<PopupSearchDto> index;
    private boolean enabled = false;

    @Value("${algolia.app-id:}")
    private String appId;

    @Value("${algolia.api-key:}")
    private String apiKey;

    @PostConstruct
    public void init() {
        // 키 미설정/너무 짧으면 Algolia 비활성화 (백엔드 부팅 차단 방지)
        if (appId == null || appId.isBlank() || appId.length() < 6
                || apiKey == null || apiKey.isBlank() || apiKey.length() < 10
                || !appId.matches("^[A-Z0-9]+$")) {
            log.warn("[SearchService] Algolia 미설정 또는 잘못된 키 형식 → 검색 기능 비활성화");
            return;
        }

        try {
            SearchClient client = DefaultSearchClient.create(appId, apiKey);
            index = client.initIndex("popups", PopupSearchDto.class);
            enabled = true;
            log.info("[SearchService] Algolia 클라이언트 초기화 완료");
        } catch (Exception e) {
            log.warn("[SearchService] Algolia 클라이언트 초기화 실패 → 검색 기능 비활성화: {}", e.toString());
        }
    }

    // 1. DB에 있는 모든 데이터를 Algolia로 한 번 업로드 (초기 세팅용)
    public void syncAllPopups() {
        if (!enabled) {
            log.debug("[SearchService] Algolia 비활성화 상태 → syncAllPopups 스킵");
            return;
        }
        List<PopupStore> popups = popupStoreRepository.findAll();
        List<PopupSearchDto> searchDtos = popups.stream()
                .map(PopupSearchDto::fromEntity)
                .collect(Collectors.toList());

        index.saveObjects(searchDtos).waitTask();
        log.info("[SearchService] Algolia 동기화 완료: {}개", searchDtos.size());
    }

    // 2. 새로운 팝업이 생길 때 호출 (PopupService에서 사용)
    public void addPopup(PopupStore popup) {
        if (!enabled) return;
        index.saveObject(PopupSearchDto.fromEntity(popup));
    }
}