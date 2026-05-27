package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.PopupStoreService;
import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 지도 핀 표시 + 메인 BROWSE 섹션용 경량 응답. 좌표는 PopupStore 의 String 그대로 직렬화.
 *
 * <p>v2.21 — DTO 에 category / startDate / endDate 추가. 프론트가 메인 페이지의 지역 / 시점 / 카테고리 슬라이스 카운트를 클라이언트
 * 사이드에서 계산하므로 별도 엔드포인트 불필요. 모든 필드는 scalar 라 Jackson lazy 직렬화 위험 없음
 * (PopupStoreService#findVisibleMapMarkers 캐시 안전).
 */
@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class PopupMapController {

    private final PopupStoreService popupStoreService;

    @GetMapping("/markers")
    public List<MapMarkerResponse> getMapMarkers() {
        return popupStoreService.findVisibleMapMarkers().stream().map(this::toMarker).toList();
    }

    private MapMarkerResponse toMarker(PopupStore store) {
        return MapMarkerResponse.builder()
                .id(store.getId())
                .name(store.getName())
                .location(store.getLocation())
                .latitude(store.getLatitude())
                .longitude(store.getLongitude())
                .category(store.getCategory())
                .startDate(store.getStartDate())
                .endDate(store.getEndDate())
                .build();
    }

    @Getter
    @Builder
    public static class MapMarkerResponse {
        private Long id;
        private String name;
        private String location;
        private String latitude;
        private String longitude;
        // v2.21 — BROWSE 섹션 슬라이싱용
        private String category;
        private String startDate;
        private String endDate;
    }
}
