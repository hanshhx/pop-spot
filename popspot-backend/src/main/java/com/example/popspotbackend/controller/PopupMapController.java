package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 지도 핀 표시를 위한 경량 응답. 좌표는 PopupStore 의 String 그대로 직렬화한다. */
@RestController
@RequestMapping("/api/map")
@RequiredArgsConstructor
public class PopupMapController {

    private static final String STATUS_PENDING = "PENDING";

    private final PopupStoreRepository popupStoreRepository;

    @GetMapping("/markers")
    public List<MapMarkerResponse> getMapMarkers() {
        return popupStoreRepository.findAll().stream()
                .filter(this::isVisibleOnMap)
                .map(this::toMarker)
                .toList();
    }

    /** 승인 전(PENDING) 팝업은 지도에 노출하지 않는다. status 가 null 이면 레거시 데이터로 보고 통과. */
    private boolean isVisibleOnMap(PopupStore store) {
        return store.getStatus() == null || !STATUS_PENDING.equals(store.getStatus());
    }

    private MapMarkerResponse toMarker(PopupStore store) {
        return MapMarkerResponse.builder()
                .id(store.getId())
                .name(store.getName())
                .location(store.getLocation())
                .latitude(store.getLatitude())
                .longitude(store.getLongitude())
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
    }
}
