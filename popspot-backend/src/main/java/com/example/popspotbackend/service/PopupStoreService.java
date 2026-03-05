package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PopupStoreService {

    private final PopupStoreRepository popupStoreRepository;

    /**
     * [로직 해석] 팝업스토어 전체 또는 카테고리별 목록을 조회하는 핵심 로직입니다.
     * 컨트롤러에서 'category' 값을 받아와서 판단합니다.
     * * @param category 사용자가 선택한 카테고리 (예: "FASHION", "FOOD", "ALL" 또는 null)
     * @return 조건에 맞는 팝업스토어 리스트
     */
    public List<PopupStore> getAllPopups(String category) {
        List<PopupStore> allPopups;

        // 1. 카테고리 값이 아예 없거나(null), 빈 문자열("")이거나, "ALL"이라고 요청한 경우
        if (category == null || category.isEmpty() || "ALL".equalsIgnoreCase(category)) {
            // 조건 없이 DB에 있는 모든 팝업스토어를 가져옵니다.
            allPopups = popupStoreRepository.findAll();
        } else {
            // 2. 특정 카테고리(예: "FASHION")가 넘어온 경우
            allPopups = popupStoreRepository.findByCategory(category.toUpperCase());
        }

        // 🔥 [추가 필터링] DB에서 가져온 데이터 중 PENDING(대기중) 상태인 것만 제거하고 반환합니다.
        return allPopups.stream()
                .filter(popup -> popup.getStatus() == null || !popup.getStatus().equals("PENDING"))
                .collect(Collectors.toList());
    }

    /**
     * [로직 해석] 특정 ID를 가진 팝업스토어 1개의 상세 정보를 가져옵니다.
     * 상세 페이지(Detail Page)에서 사용됩니다.
     */
    // 🔥 [수정됨] 상세 페이지 들어올 때마다 조회수(viewCount) +1 증가 로직 및 @Transactional 추가
    @Transactional
    public PopupStore getPopupById(Long id) {
        PopupStore popup = popupStoreRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("팝업을 찾을 수 없습니다. ID: " + id));

        // 조회수 1 증가 (null 방어)
        int currentViews = popup.getViewCount() != null ? popup.getViewCount() : 0;
        popup.setViewCount(currentViews + 1);

        return popup;
    }

    /**
     * [로직 해석] 조회수(viewCount)가 가장 높은 상위 4개를 뽑아오는 로직입니다.
     * 메인 페이지의 '인기 팝업' 섹션에서 사용됩니다.
     * @Transactional(readOnly = true): 읽기 전용 트랜잭션을 걸어 성능을 최적화합니다.
     */
    @Transactional(readOnly = true)
    public List<PopupStore> getTrendingPopups() {
        // 🔥 [추가 필터링] 랭킹에서도 PENDING 상태인 데이터를 제외하고 조회수 순으로 정렬하여 4개만 가져옵니다.
        return popupStoreRepository.findAll().stream()
                .filter(popup -> popup.getStatus() == null || !popup.getStatus().equals("PENDING"))
                .sorted((a, b) -> Integer.compare(
                        b.getViewCount() != null ? b.getViewCount() : 0,
                        a.getViewCount() != null ? a.getViewCount() : 0
                ))
                .limit(4)
                .collect(Collectors.toList());
    }

    public List<PopupStore> searchPopups(String keyword) {
        // 🔥 [추가 필터링] 검색 결과에서도 PENDING 상태인 데이터를 제외합니다.
        return popupStoreRepository.findByNameContainingOrLocationContaining(keyword, keyword).stream()
                .filter(popup -> popup.getStatus() == null || !popup.getStatus().equals("PENDING"))
                .collect(Collectors.toList());
    }
}