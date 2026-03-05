package com.example.popspotbackend.service;

import com.algolia.search.DefaultSearchClient;
import com.algolia.search.SearchClient;
import com.algolia.search.SearchIndex;
import com.example.popspotbackend.dto.PopupSearchDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final PopupStoreRepository popupStoreRepository;
    private SearchIndex<PopupSearchDto> index;

    @Value("${algolia.app-id}")
    private String appId;

    @Value("${algolia.api-key}")
    private String apiKey;

    @PostConstruct
    public void init() {
        // Algolia 클라이언트 초기화
        SearchClient client = DefaultSearchClient.create(appId, apiKey);
        index = client.initIndex("popups", PopupSearchDto.class);
    }

    // 1. DB에 있는 모든 데이터를 Algolia로 한 번 업로드 (초기 세팅용)
    public void syncAllPopups() {
        List<PopupStore> popups = popupStoreRepository.findAll();
        List<PopupSearchDto> searchDtos = popups.stream()
                .map(PopupSearchDto::fromEntity)
                .collect(Collectors.toList());

        index.saveObjects(searchDtos).waitTask(); // Algolia에 저장
        System.out.println("✅ Algolia 동기화 완료: " + searchDtos.size() + "개");
    }

    // 2. 새로운 팝업이 생길 때 호출 (PopupService에서 사용)
    public void addPopup(PopupStore popup) {
        index.saveObject(PopupSearchDto.fromEntity(popup));
    }
}