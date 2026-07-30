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
                .nameEn(store.getNameEn())
                .nameJa(store.getNameJa())
                .locationEn(store.getLocationEn())
                .locationJa(store.getLocationJa())
                .build();
    }

    @Getter
    @Builder
    public static class MapMarkerResponse {
        private Long id;

        /**
         * 한국어 원문. <b>번역이 있어도 이 값은 그대로 내보낸다.</b>
         *
         * <p>프론트가 이 값으로 지역을 분류하고(classifyRegion) 브랜드를 매칭한다. 번역된 값으로 바꾸면 성수·홍대 분류가 통째로 깨진다. 화면에서도
         * 외국어 이름 옆에 원문을 함께 보여준다 — 번역명은 지도 앱 검색이나 현장에서 물어볼 때 통하지 않기 때문이다.
         */
        private String name;

        private String location;
        private String latitude;
        private String longitude;
        // v2.21 — BROWSE 섹션 슬라이싱용
        private String category;
        private String startDate;
        private String endDate;

        /**
         * v2.51 — 외국어 화면 표시용. 비어 있으면 프론트가 원문을 쓴다.
         *
         * <p>확신이 없으면 채우지 않는다. 틀린 이름을 자신 있게 보여주면 관광객이 엉뚱한 곳으로 간다.
         */
        private String nameEn;

        private String nameJa;
        private String locationEn;
        private String locationJa;
    }
}
